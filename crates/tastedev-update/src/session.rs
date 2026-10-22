//! 켤 때 업데이트 한 번의 흐름: 확인 → (제품이 묻기) → 받기 · 검증 → 설치 → 다시 시작.
//!
//! 일은 모두 뒤 스레드에서 하고, 제품은 매 프레임 [`Session::poll`] 로 끝난 일을 거둔다.
//! 네트워크는 제품의 [`Transport`], 프로그램 실행은 [`Runner`](기본 [`SystemRunner`]) 가 한다 — 시험은
//! 가짜를 끼워 실제로 받거나 설치하지 않고 명령만 본다.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, channel};

use crate::plan::{self, Ctx, Step};
use crate::{
    Asset, InstallKind, InstallResult, KIND_ENV, LOG_FILE, Os, Product, RESULT_FILE, Release,
    UpdateError, capture_mode, check_latest, clean_work_dir, detect_current, fetch_asset, is_local,
    kind_from_name, list_url, pick_asset, site_page, take_result, with_site_lang,
};

/// 지금 화면 언어 코드를 주는 함수(제품의 `i18n::current().id()` 등 — 확인할 때마다 부른다).
pub type Language = fn() -> &'static str;

/// 일이 끝나면 부르는 것(제품: `ctx.request_repaint()`).
pub type Waker = Arc<dyn Fn() + Send + Sync>;

/// 제품 네트워크(제품마다 HTTP 스택이 다르다 — curl · reqwest).
pub trait Transport: Send + Sync {
    /// 업데이트 답(사이트 API 의 JSON) · 서명 파일을 받는다. 2xx 가 아니면 `Err`(까닭 글).
    fn get(&self, url: &str) -> Result<Vec<u8>, String>;
    /// 파일을 `to` 에 받는다. `progress` 에 지금까지 받은 바이트 수를 알린다.
    fn download(&self, url: &str, to: &Path, progress: &dyn Fn(u64)) -> Result<(), String>;
}

/// 프로그램 실행(시험은 가짜로 바꿔 명령만 기록한다).
pub trait Runner: Send + Sync {
    /// 떼어 놓고 띄운다(앱이 끝나도 계속 돈다).
    fn spawn(&self, program: &str, args: &[String]) -> io::Result<()>;
    /// 돌리고 끝 코드를 기다린다.
    fn run(&self, program: &str, args: &[String]) -> io::Result<i32>;
    /// `from` 을 `to` 자리에 놓는다(실행 권한 포함, 원자적 이름 바꾸기).
    fn replace(&self, from: &Path, to: &Path) -> io::Result<()>;
    /// 파일(폴더에서 보이기) · 웹 페이지를 연다.
    fn open(&self, target: &str) -> io::Result<()>;
    /// 새 앱을 켠다.
    fn relaunch(&self, exe: &Path) -> io::Result<()>;
}

/// 실제 실행.
pub struct SystemRunner;

/// 리눅스에서는 이전 앱이 DB 소유권을 놓기 전에 새 앱을 시작하면 잠금 검사에 실패한다.
/// 경로는 셸 소스에 삽입하지 않고 위치 인자로 전달한다(공백·따옴표 경로도 그대로 보존).
#[cfg(any(target_os = "linux", test))]
pub(crate) fn linux_relaunch_command(exe: &Path, parent: u32) -> std::process::Command {
    let mut cmd = std::process::Command::new("/bin/sh");
    cmd.arg("-c")
        .arg("count=0; while kill -0 \"$1\" 2>/dev/null; do count=$((count + 1)); if [ \"$count\" -ge 120 ]; then echo 'update restart: parent did not exit' >&2; exit 1; fi; sleep 1; done; exec \"$2\"")
        .arg("taste-update-restart")
        .arg(parent.to_string())
        .arg(exe)
        .current_dir("/");
    for name in ["APPIMAGE", "APPDIR", "ARGV0", "OWD"] {
        cmd.env_remove(name);
    }
    cmd
}

fn quiet(cmd: &mut std::process::Command) {
    cmd.stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP
        cmd.creation_flags(0x0800_0000 | 0x0000_0200);
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
}

impl Runner for SystemRunner {
    fn spawn(&self, program: &str, args: &[String]) -> io::Result<()> {
        let mut cmd = std::process::Command::new(program);
        cmd.args(args);
        quiet(&mut cmd);
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            // 앱이 끝나도(앱이 KILL_ON_JOB_CLOSE 작업 개체 안에서 떴더라도) 설치 스크립트가 함께 끝나지 않게
            // 작업 개체에서 떼어 띄운다. 떼어 내기를 허락하지 않는 작업 개체면 거절되므로 그때는 그냥 띄운다.
            // CREATE_NO_WINDOW | CREATE_NEW_PROCESS_GROUP | CREATE_BREAKAWAY_FROM_JOB
            cmd.creation_flags(0x0800_0000 | 0x0000_0200 | 0x0100_0000);
            if let Ok(child) = cmd.spawn() {
                drop(child);
                return Ok(());
            }
            cmd.creation_flags(0x0800_0000 | 0x0000_0200);
        }
        cmd.spawn().map(|_| ())
    }

    fn run(&self, program: &str, args: &[String]) -> io::Result<i32> {
        let mut cmd = std::process::Command::new(program);
        cmd.args(args);
        cmd.stdin(std::process::Stdio::null());
        Ok(cmd.status()?.code().unwrap_or(-1))
    }

    fn replace(&self, from: &Path, to: &Path) -> io::Result<()> {
        let new = PathBuf::from(format!("{}.new", to.to_string_lossy()));
        fs::copy(from, &new)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&new, fs::Permissions::from_mode(0o755))?;
        }
        fs::rename(&new, to).inspect_err(|_| {
            let _ = fs::remove_file(&new);
        })
    }

    fn open(&self, target: &str) -> io::Result<()> {
        let web = !is_local(target);
        let (program, args): (&str, Vec<String>) = match Os::current() {
            Os::Windows if web => (
                "rundll32.exe",
                vec!["url.dll,FileProtocolHandler".into(), target.into()],
            ),
            Os::Windows => ("explorer.exe", vec![format!("/select,{target}")]),
            Os::Mac => ("open", vec![target.into()]),
            _ => ("xdg-open", vec![target.into()]),
        };
        self.spawn(program, &args)
    }

    fn relaunch(&self, exe: &Path) -> io::Result<()> {
        #[cfg(target_os = "linux")]
        let mut cmd = {
            use std::os::unix::fs::PermissionsExt;
            let metadata = fs::metadata(exe)?;
            if !metadata.is_file() || metadata.permissions().mode() & 0o111 == 0 {
                return Err(io::Error::new(
                    io::ErrorKind::PermissionDenied,
                    "restart target is not executable",
                ));
            }
            linux_relaunch_command(exe, std::process::id())
        };
        #[cfg(not(target_os = "linux"))]
        let mut cmd = std::process::Command::new(exe);
        quiet(&mut cmd);
        // 도우미/새 앱의 지연된 실패도 데스크톱 로그에서 확인할 수 있도록 stderr를 남긴다.
        #[cfg(target_os = "linux")]
        cmd.stderr(std::process::Stdio::inherit());
        cmd.spawn().map(|_| ())
    }
}

/// 아무것도 띄우지 않는 실행기(캡처 모드 — 명령을 버리고 성공으로 친다).
pub struct DryRunner;

impl Runner for DryRunner {
    fn spawn(&self, _program: &str, _args: &[String]) -> io::Result<()> {
        Ok(())
    }

    fn run(&self, _program: &str, _args: &[String]) -> io::Result<i32> {
        Ok(0)
    }

    fn replace(&self, _from: &Path, _to: &Path) -> io::Result<()> {
        Ok(())
    }

    fn open(&self, _target: &str) -> io::Result<()> {
        Ok(())
    }

    fn relaunch(&self, _exe: &Path) -> io::Result<()> {
        Ok(())
    }
}

/// 끝난 일.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Event {
    /// 확인 끝. 지금보다 새 판이면 `Some`.
    Checked(Result<Option<Release>, UpdateError>),
    /// 받기 · 검증 끝(받은 파일).
    Downloaded(Result<(Release, PathBuf), UpdateError>),
    /// 앱 안 설치(Linux deb · rpm · AppImage) 끝. 성공이면 제품이 [`Session::relaunch`] 하고 닫는다.
    Installed(Result<Release, UpdateError>),
}

/// "지금 설치" 를 시작한 뒤 제품이 할 일.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Started {
    /// 모든 앱 창을 사용자가 저장 후 닫을 때까지 기다린다(Windows). 자동 종료하지 않는다.
    QuitToInstall,
    /// 뒤에서 설치 중(Linux) — [`Event::Installed`] 를 기다린다.
    Background,
}

/// 켤 때 업데이트 한 번.
pub struct Session {
    product: Product,
    transport: Arc<dyn Transport>,
    runner: Arc<dyn Runner>,
    kind: InstallKind,
    exe: PathBuf,
    work_dir: PathBuf,
    list_url: String,
    local_only: bool,
    arch: String,
    exists: Arc<dyn Fn(&Path) -> bool + Send + Sync>,
    rx: Option<Receiver<Event>>,
    done: Arc<AtomicU64>,
    total: u64,
    /// Linux 설치 파일의 발행자 서명 검증기(제품이 준다). 없으면 크기 · SHA-256 만 본다.
    signature: Option<crate::SignatureCheck>,
    /// 지금 화면 언어(사이트 API 에 `?lang=` 으로 붙인다 — [`Session::set_language`]). 없으면 붙이지 않는다.
    language: Option<Language>,
}

impl Session {
    /// 이 PC 로 만든다. `work_dir` 는 받은 설치 파일 · 스크립트 · 결과를 둘 곳(제품 캐시 폴더의 `updates`).
    /// `local_only` 면(시험 빌드 · 캡처 모드) 로컬 주소만 읽는다.
    pub fn new(
        product: Product,
        transport: Arc<dyn Transport>,
        work_dir: PathBuf,
        local_only: bool,
    ) -> Self {
        let exe = std::env::current_exe().unwrap_or_default();
        let capture = capture_mode();
        let kind = capture
            .then(|| {
                std::env::var(KIND_ENV)
                    .ok()
                    .and_then(|k| kind_from_name(&k, &exe))
            })
            .flatten()
            .unwrap_or_else(|| detect_current(product.package, &exe));
        // 캡처 모드는 설치 프로그램 · 브라우저를 띄우지 않는다(명령을 버린다).
        let runner: Arc<dyn Runner> = if capture {
            Arc::new(DryRunner)
        } else {
            Arc::new(SystemRunner)
        };
        Self::with_parts(
            product,
            transport,
            runner,
            kind,
            exe,
            work_dir,
            list_url(product.tag_prefix),
            local_only,
            std::env::consts::ARCH.to_owned(),
            Arc::new(|p: &Path| p.exists()),
        )
    }

    /// 부품을 모두 받아 만든다(시험).
    #[allow(clippy::too_many_arguments)]
    pub fn with_parts(
        product: Product,
        transport: Arc<dyn Transport>,
        runner: Arc<dyn Runner>,
        kind: InstallKind,
        exe: PathBuf,
        work_dir: PathBuf,
        list_url: String,
        local_only: bool,
        arch: String,
        exists: Arc<dyn Fn(&Path) -> bool + Send + Sync>,
    ) -> Self {
        Self {
            product,
            transport,
            runner,
            kind,
            exe,
            work_dir,
            list_url,
            local_only,
            arch,
            exists,
            rx: None,
            done: Arc::new(AtomicU64::new(0)),
            total: 0,
            signature: None,
            language: None,
        }
    }

    pub fn product(&self) -> &Product {
        &self.product
    }

    /// 이 PC 에 깔린 방식.
    pub fn kind(&self) -> &InstallKind {
        &self.kind
    }

    pub fn work_dir(&self) -> &Path {
        &self.work_dir
    }

    /// 뒤에서 일하는 중인지.
    pub fn busy(&self) -> bool {
        self.rx.is_some()
    }

    /// 목록이 로컬 파일이면(시험 · 캡처) 로컬 설치 파일 주소도 믿는다.
    fn allow_local(&self) -> bool {
        is_local(&self.list_url)
    }

    /// 이 판에서 받을 설치 파일.
    pub fn asset<'a>(&self, release: &'a Release) -> Option<&'a Asset> {
        pick_asset(release, self.product.package, &self.kind, &self.arch)
    }

    /// 이 판을 이 PC 에서 자동으로 설치할 수 있는지(설치 방식 · 맞는 파일).
    pub fn can_install(&self, release: &Release) -> bool {
        self.kind.can_install() && self.asset(release).is_some()
    }

    /// 새 판을 확인한다(뒤 스레드). 끝나면 [`Event::Checked`].
    pub fn check(&mut self, wake: Waker) {
        if self.busy() {
            return;
        }
        let (tx, rx) = channel();
        let transport = Arc::clone(&self.transport);
        let url = match self.language {
            Some(language) => with_site_lang(&self.list_url, language()),
            None => self.list_url.clone(),
        };
        let local_only = self.local_only;
        let product = self.product;
        std::thread::spawn(move || {
            let result = check_latest(&url, transport.as_ref(), local_only, product.tag_prefix)
                .map(|r| r.filter(|r| r.version > product.current()));
            let _ = tx.send(Event::Checked(result));
            wake();
        });
        self.rx = Some(rx);
    }

    /// 설치 파일을 받고 검증한다(뒤 스레드). 끝나면 [`Event::Downloaded`].
    pub fn download(&mut self, release: Release, wake: Waker) {
        if self.busy() {
            return;
        }
        let (tx, rx) = channel();
        self.done.store(0, Ordering::Relaxed);
        let Some(asset) = self.asset(&release).cloned() else {
            let _ = tx.send(Event::Downloaded(Err(UpdateError::NoAsset)));
            self.rx = Some(rx);
            wake();
            return;
        };
        self.total = asset.size;
        let transport = Arc::clone(&self.transport);
        let dir = self.work_dir.clone();
        let allow_local = self.allow_local();
        let done = Arc::clone(&self.done);
        let signature = self.signature.clone().filter(|_| {
            matches!(
                self.kind,
                InstallKind::Deb | InstallKind::Rpm | InstallKind::AppImage { .. }
            )
        });
        std::thread::spawn(move || {
            let progress = |n: u64| {
                done.store(n, Ordering::Relaxed);
                wake();
            };
            let result = fetch_asset(
                &asset,
                &release.tag,
                &dir,
                allow_local,
                transport.as_ref(),
                &progress,
            )
            .and_then(|path| {
                let Some(check) = &signature else {
                    return Ok(path);
                };
                match crate::verify_signature(
                    &release,
                    &asset,
                    &path,
                    allow_local,
                    transport.as_ref(),
                    check,
                ) {
                    Ok(()) => Ok(path),
                    Err(e) => {
                        // 서명이 맞지 않은 파일은 남겨 두지 않는다(다음에 "이미 받은 파일"로 쓰지 않게).
                        let _ = std::fs::remove_file(&path);
                        Err(e)
                    }
                }
            });
            let _ = tx.send(Event::Downloaded(result.map(|p| (release, p))));
            wake();
        });
        self.rx = Some(rx);
    }

    /// Linux(deb · rpm · AppImage) 설치 파일을 받은 뒤 발행자 서명을 이 검증기로 보게 한다. 주면 서명이
    /// 없거나 틀린 설치 파일은 쓰지 않는다. Windows 는 설치 스크립트가 Authenticode 로 따로 본다.
    pub fn set_signature_check(&mut self, check: crate::SignatureCheck) {
        self.signature = Some(check);
    }

    /// 확인할 때 지금 화면 언어를 사이트에 알린다(`?lang=en` — 사이트가 그 언어의 제품 페이지 주소를 준다).
    /// 한국어 · 사이트가 모르는 언어면 붙이지 않는다([`crate::site_lang`]). 로컬 · 바꾼 주소에는 붙이지 않는다.
    pub fn set_language(&mut self, language: Language) {
        self.language = Some(language);
    }

    pub(crate) fn install_notice(&self) -> &'static str {
        crate::install_notice::text(self.language.map_or("en", |language| language()))
    }

    /// 받기 진행을 0 으로 되돌린다("지금 설치" 를 다시 누를 때 — 다시 확인하는 동안 지난 비율을 보이지 않게).
    pub(crate) fn reset_progress(&mut self) {
        self.done.store(0, Ordering::Relaxed);
        self.total = 0;
    }

    /// 작업 폴더의 업데이트 기록([`LOG_FILE`])에 한 줄 남긴다(실패해도 조용히 넘어간다). 설치 스크립트도 같은 파일에 쓴다.
    pub fn log(&self, line: &str) {
        use std::io::Write;
        let secs = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| d.as_secs());
        let _ = fs::create_dir_all(&self.work_dir);
        if let Ok(mut f) = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.work_dir.join(LOG_FILE))
        {
            let _ = writeln!(f, "unix:{secs} app: {line}");
        }
    }

    /// 받은 바이트 · 전체 바이트.
    pub fn progress(&self) -> (u64, u64) {
        (self.done.load(Ordering::Relaxed), self.total)
    }

    /// 끝난 일을 거둔다(매 프레임).
    pub fn poll(&mut self) -> Option<Event> {
        let rx = self.rx.as_ref()?;
        match rx.try_recv() {
            Ok(event) => {
                self.rx = None;
                Some(event)
            }
            Err(std::sync::mpsc::TryRecvError::Empty) => None,
            Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                self.rx = None;
                Some(Event::Checked(Err(UpdateError::Io(
                    "worker stopped".into(),
                ))))
            }
        }
    }

    /// 설치 명령을 만든다(실행하지 않는다 — 시험 · 확인용).
    pub fn plan(&self, release: &Release, file: &Path) -> Result<Step, UpdateError> {
        let exists = Arc::clone(&self.exists);
        let ctx = Ctx {
            product: &self.product,
            exe: &self.exe,
            pid: std::process::id(),
            work_dir: &self.work_dir,
            version: release.version,
            exists: &move |p: &Path| exists(p),
        };
        plan::plan(&self.kind, file, &ctx)
    }

    fn write_script(&self, script: &Path, body: &str) -> Result<(), UpdateError> {
        fs::create_dir_all(&self.work_dir).map_err(|e| UpdateError::Io(e.to_string()))?;
        // Windows PowerShell 5.1 은 BOM 이 없으면 ANSI 로 읽는다(한글 경로가 깨짐).
        let bom = if script.extension().is_some_and(|e| e == "ps1") {
            "\u{feff}"
        } else {
            ""
        };
        fs::write(script, format!("{bom}{body}")).map_err(|e| UpdateError::Io(e.to_string()))
    }

    /// "지금 설치": 받은 파일(검증됨)로 곧바로 설치하고 다시 켠다.
    pub fn install_now(
        &mut self,
        release: &Release,
        file: &Path,
        wake: Waker,
    ) -> Result<Started, UpdateError> {
        if self.busy() {
            return Err(UpdateError::Io("busy".into()));
        }
        let step = self.plan(release, file)?;
        match step {
            Step::AfterExit {
                script,
                body,
                program,
                args,
            } => {
                fs::create_dir_all(&self.work_dir).map_err(|e| UpdateError::Io(e.to_string()))?;
                let lease = fs::OpenOptions::new()
                    .create(true)
                    .truncate(false)
                    .read(true)
                    .write(true)
                    .open(self.work_dir.join(".update-install.lock"))
                    .map_err(|e| UpdateError::Io(e.to_string()))?;
                lease.try_lock().map_err(|_| {
                    UpdateError::Install("another update is already waiting".into())
                })?;
                if self.update_is_pending() {
                    return Err(UpdateError::Install(
                        "another update is already waiting".into(),
                    ));
                }
                self.write_script(&script, &body)?;
                // 스크립트가 아예 돌지 못하면(보안 프로그램이 막음 등) 다음 실행이 알 수 있게 먼저 남긴다.
                // 스크립트는 시작하자마자 `started` 로, 끝나면 `ok` · `fail` 로 덮어쓴다.
                let result = self.work_dir.join(RESULT_FILE);
                let _ = fs::write(&result, format!("pending {}\n", release.version));
                if let Err(e) = self.runner.spawn(&program, &args) {
                    let _ = fs::remove_file(&result);
                    self.log(&format!("could not start the install script: {e}"));
                    return Err(UpdateError::Install(e.to_string()));
                }
                self.log(&format!("install script started for {}", release.version));
                Ok(Started::QuitToInstall)
            }
            step => {
                let (tx, rx) = channel();
                let runner = Arc::clone(&self.runner);
                let release = release.clone();
                std::thread::spawn(move || {
                    let result = run_in_app(runner.as_ref(), &step).map(|()| release);
                    let _ = tx.send(Event::Installed(result));
                    wake();
                });
                self.rx = Some(rx);
                Ok(Started::Background)
            }
        }
    }

    /// 새 앱을 켠다(앱 안 설치가 끝난 뒤).
    pub fn relaunch(&self) -> io::Result<()> {
        // current_exe는 AppImage의 임시 마운트 내부 ELF다. 교체한 원본 런처로 새 판을 시작한다.
        let exe = match &self.kind {
            InstallKind::AppImage { path } => path.as_path(),
            _ => self.exe.as_path(),
        };
        self.runner.relaunch(exe)
    }

    /// 받은 파일을 폴더에서 보이거나(Windows) 연다(Linux: 소프트웨어 설치 프로그램).
    pub fn open_file(&self, file: &Path) -> io::Result<()> {
        self.runner.open(&file.to_string_lossy())
    }

    /// 사이트의 제품 페이지(내려받기 안내)를 연다. [`crate::SITE_BASE`] 아래 주소만 연다.
    pub fn open_page(&self, url: &str) -> io::Result<()> {
        if !site_page(url) {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "not a TASTEDEV site page",
            ));
        }
        self.runner.open(url)
    }

    /// 켤 때: 지난번 앱이 끝난 뒤 설치한 결과를 읽고(있으면 지움), 작업 폴더의 받아 둔 파일을 치운다.
    pub fn take_last_result(&self) -> Option<InstallResult> {
        // Another instance may still be downloading/installing. Never remove
        // its package/script on startup, even when a result is still pending.
        let lease = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(self.work_dir.join(".update-install.lock"))
            .ok()?;
        lease.try_lock().ok()?;
        if self.update_is_pending() {
            return None;
        }
        let result = take_result(&self.work_dir);
        if result.is_some() {
            clean_work_dir(&self.work_dir);
        }
        result
    }

    fn update_is_pending(&self) -> bool {
        let path = self.work_dir.join(RESULT_FILE);
        fs::read_to_string(&path).ok().is_some_and(|text| {
            let text = text.trim_start_matches('\u{feff}');
            (text.starts_with("pending ") || text.starts_with("started "))
                && fs::metadata(&path)
                    .and_then(|m| m.modified())
                    .ok()
                    .and_then(|t| t.elapsed().ok())
                    .is_none_or(|age| age.as_secs() < 1300)
        })
    }

    /// A waiting Windows helper can be cancelled without closing this app.
    pub fn waiting_install_failure(&self) -> Option<UpdateError> {
        let lease = fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(self.work_dir.join(".update-install.lock"))
            .ok()?;
        lease.try_lock().ok()?;
        let text = fs::read_to_string(self.work_dir.join(RESULT_FILE)).ok()?;
        if !text.trim_start_matches('\u{feff}').starts_with("fail ") {
            return None;
        }
        match take_result(&self.work_dir)? {
            InstallResult::Failed { detail, .. } => Some(UpdateError::Install(detail)),
            InstallResult::Ok(_) => None,
        }
    }
}

/// 앱 안에서 하는 설치(Linux). pkexec 126 · 127 = 권한을 받지 못함.
fn run_in_app(runner: &dyn Runner, step: &Step) -> Result<(), UpdateError> {
    match step {
        Step::Elevated { program, args } => match runner.run(program, args) {
            Ok(0) => Ok(()),
            Ok(code @ (126 | 127)) => Err(UpdateError::Denied(format!("{program} exit {code}"))),
            Ok(code) => Err(UpdateError::Install(format!("{program} exit {code}"))),
            Err(e) if e.kind() == io::ErrorKind::NotFound => {
                Err(UpdateError::Denied(format!("{program}: {e}")))
            }
            Err(e) => Err(UpdateError::Install(e.to_string())),
        },
        Step::Replace { from, to } => runner
            .replace(from, to)
            .map_err(|e| UpdateError::Install(e.to_string())),
        Step::AfterExit { program, args, .. } => runner
            .spawn(program, args)
            .map_err(|e| UpdateError::Install(e.to_string())),
    }
}
