//! 시험 도우미(이 크레이트와 제품 시험이 함께 쓴다): 가짜 릴리스 목록 · 가짜 설치 파일(로컬 파일),
//! 네트워크를 쓰지 않는 [`NoNetwork`], 명령만 기록하는 [`Recorder`]. 실제로 받거나 설치하지 않는다.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};

use crate::{InstallKind, Product, Runner, Session, Transport, sha256};

static SEQ: AtomicUsize = AtomicUsize::new(0);

/// 시험마다 따로 쓰는 임시 폴더(버리면 지운다).
pub struct Temp(pub PathBuf);

impl Temp {
    pub fn new(tag: &str) -> Self {
        let n = SEQ.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!(
            "tastedev-update-test-{}-{tag}-{n}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("임시 폴더");
        Self(dir)
    }
}

impl Drop for Temp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

/// 파일 경로 → `file:///…` 주소.
pub fn file_url(p: &Path) -> String {
    let s = p.to_string_lossy().replace('\\', "/");
    if s.starts_with('/') {
        format!("file://{s}")
    } else {
        format!("file:///{s}")
    }
}

/// 네트워크 금지: 불리면 세고 실패한다.
#[derive(Default)]
pub struct NoNetwork(pub AtomicUsize);

impl NoNetwork {
    pub fn calls(&self) -> usize {
        self.0.load(Ordering::Relaxed)
    }
}

impl Transport for NoNetwork {
    fn get(&self, _url: &str) -> Result<Vec<u8>, String> {
        self.0.fetch_add(1, Ordering::Relaxed);
        Err("network forbidden in tests".into())
    }
    fn download(&self, _url: &str, _to: &Path, _progress: &dyn Fn(u64)) -> Result<(), String> {
        self.0.fetch_add(1, Ordering::Relaxed);
        Err("network forbidden in tests".into())
    }
}

/// 명령만 기록하는 가짜 실행기. `run` 은 [`Recorder::code`] 끝 코드를 돌려준다(없으면 "없는 프로그램").
#[derive(Default)]
pub struct Recorder {
    pub log: Mutex<Vec<String>>,
    pub code: Mutex<Option<i32>>,
}

impl Recorder {
    pub fn lines(&self) -> Vec<String> {
        self.log.lock().map(|l| l.clone()).unwrap_or_default()
    }
    fn push(&self, s: String) {
        if let Ok(mut l) = self.log.lock() {
            l.push(s);
        }
    }
}

impl Runner for Recorder {
    fn spawn(&self, program: &str, args: &[String]) -> std::io::Result<()> {
        self.push(format!("spawn {program} {}", args.join(" ")));
        Ok(())
    }
    fn run(&self, program: &str, args: &[String]) -> std::io::Result<i32> {
        self.push(format!("run {program} {}", args.join(" ")));
        match self.code.lock().ok().and_then(|c| *c) {
            Some(c) => Ok(c),
            None => Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "no such program",
            )),
        }
    }
    fn replace(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        self.push(format!("replace {} -> {}", from.display(), to.display()));
        Ok(())
    }
    fn open(&self, target: &str) -> std::io::Result<()> {
        self.push(format!("open {target}"));
        Ok(())
    }
    fn relaunch(&self, exe: &Path) -> std::io::Result<()> {
        self.push(format!("relaunch {}", exe.display()));
        Ok(())
    }
}

/// 가짜 릴리스 하나(설치 파일 내용 `payload`)와 목록 파일.
pub struct Fixture {
    pub dir: Temp,
    pub list: PathBuf,
    pub payload: Vec<u8>,
}

impl Fixture {
    /// 목록 주소(`file:///…`).
    pub fn url(&self) -> String {
        file_url(&self.list)
    }
}

/// `product` 의 `version` 판(설치 파일 `names`, `tamper` 이름은 내용을 바꿔 해시가 어긋나게)과 다른 제품 ·
/// 초안 · 시험판 · 옛 판이 섞인 목록을 만든다.
pub fn fixture(product: &Product, version: &str, names: &[&str], tamper: Option<&str>) -> Fixture {
    let dir = Temp::new("fixture");
    let payload = format!("installer {version}").into_bytes();
    let digest = sha256::digest_hex(&payload);
    let mut assets = Vec::new();
    for name in names {
        let path = dir.0.join(name);
        let body = if tamper == Some(*name) {
            b"tampered!!!!!!!!!".to_vec()
        } else {
            payload.clone()
        };
        std::fs::write(&path, &body).expect("가짜 설치 파일");
        assets.push(serde_json::json!({
            "name": name,
            "size": payload.len(),
            "digest": format!("sha256:{digest}"),
            "browser_download_url": file_url(&path),
        }));
    }
    let p = product.tag_prefix;
    let list = serde_json::json!([
        {"tag_name": "other-v9.9.9", "draft": false, "prerelease": false, "assets": []},
        {"tag_name": format!("{p}{version}"), "draft": false, "prerelease": false,
         "html_url": format!("https://github.com/whitecalvin/tastedev-releases/releases/tag/{p}{version}"),
         "published_at": "2026-10-01T09:00:00Z", "body": "## 바뀐 점\n- 켤 때 새 버전 설치\n- 빠른 목록", "assets": assets},
        {"tag_name": format!("{p}0.0.9"), "draft": false, "prerelease": false, "assets": []},
        {"tag_name": format!("{p}99.0.0"), "draft": true, "prerelease": false, "assets": []},
        {"tag_name": format!("{p}98.0.0"), "draft": false, "prerelease": true, "assets": []},
    ]);
    let list_path = dir.0.join("releases.json");
    std::fs::write(&list_path, serde_json::to_vec(&list).expect("목록")).expect("목록 파일");
    Fixture {
        list: list_path,
        payload,
        dir,
    }
}

/// 가짜 목록 · 가짜 실행기로 만든 세션(작업 폴더는 `work`).
pub struct Harness {
    pub session: Session,
    pub runner: Arc<Recorder>,
    pub net: Arc<NoNetwork>,
    pub work: Temp,
}

/// `has` 는 있다고 칠 파일(`/usr/bin/pkexec` 등).
pub fn harness(
    product: Product,
    fx: &Fixture,
    kind: InstallKind,
    exe: &str,
    has: &'static [&'static str],
) -> Harness {
    let runner = Arc::new(Recorder::default());
    let net = Arc::new(NoNetwork::default());
    let work = Temp::new("work");
    let session = Session::with_parts(
        product,
        net.clone(),
        runner.clone(),
        kind,
        PathBuf::from(exe),
        work.0.clone(),
        fx.url(),
        true,
        "x86_64".into(),
        Arc::new(move |p: &Path| has.iter().any(|h| Path::new(h) == p)),
    );
    Harness {
        session,
        runner,
        net,
        work,
    }
}
