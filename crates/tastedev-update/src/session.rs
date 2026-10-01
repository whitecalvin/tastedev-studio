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
    Asset, InstallKind, InstallResult, KIND_ENV, Os, Product, Release, UpdateError, capture_mode,
    clean_work_dir, detect_current, fetch_asset, fetch_list, is_local, kind_from_name, latest,
    list_url, pick_asset, take_result,
};

/// 일이 끝나면 부르는 것(제품: `ctx.request_repaint()`).
pub type Waker = Arc<dyn Fn() + Send + Sync>;

/// 제품 네트워크(제품마다 HTTP 스택이 다르다 — curl · reqwest).
pub trait Transport: Send + Sync {
    /// 공개 목록(JSON)을 받는다. 실패는 까닭 글.
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
        let mut cmd = std::process::Command::new(exe);
        quiet(&mut cmd);
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
    /// 앱이 끝나야 설치가 시작된다(Windows) — 제품은 곧바로 앱을 닫는다.
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
            list_url(),
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
        let url = self.list_url.clone();
        let local_only = self.local_only;
        let product = self.product;
        std::thread::spawn(move || {
            let result = fetch_list(&url, transport.as_ref(), local_only)
                .and_then(|body| latest(&body, product.tag_prefix))
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
            );
            let _ = tx.send(Event::Downloaded(result.map(|p| (release, p))));
            wake();
        });
        self.rx = Some(rx);
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
                self.write_script(&script, &body)?;
                self.runner
                    .spawn(&program, &args)
                    .map_err(|e| UpdateError::Install(e.to_string()))?;
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
        self.runner.relaunch(&self.exe)
    }

    /// 받은 파일을 폴더에서 보이거나(Windows) 연다(Linux: 소프트웨어 설치 프로그램).
    pub fn open_file(&self, file: &Path) -> io::Result<()> {
        self.runner.open(&file.to_string_lossy())
    }

    /// 릴리스 페이지를 연다.
    pub fn open_page(&self, url: &str) -> io::Result<()> {
        if !url.starts_with("https://") {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "not https"));
        }
        self.runner.open(url)
    }

    /// 켤 때: 지난번 앱이 끝난 뒤 설치한 결과를 읽고(있으면 지움), 작업 폴더의 받아 둔 파일을 치운다.
    pub fn take_last_result(&self) -> Option<InstallResult> {
        let result = take_result(&self.work_dir);
        clean_work_dir(&self.work_dir);
        result
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
