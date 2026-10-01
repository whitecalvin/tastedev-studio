//! TASTEDEV 데스크톱 다섯 제품이 함께 쓰는 "켤 때 새 버전이 있으면 설치할지 묻기"(규격 2-2 업데이트).
//!
//! 사용자 요청(2026-09-30): 앱 시작 때 새 버전이 있으면 설치한다 — **자동 업데이트가 켜져 있을 때만, 묻고 나서**.
//!
//! 1. **확인** — 설정 "자동 업데이트"(제품의 기존 자동 확인 스위치)가 켜져 있으면 앱이 켜진 뒤(본 창이 뜬 뒤)
//!    한 번, 공개 배포 저장소(GitHub Releases `whitecalvin/tastedev-releases`)의 `<제품>-v<판>` 태그 중
//!    가장 새 정식 판을 고른다([`latest`] — 초안 · 시험판 · 다른 제품은 건너뜀). 꺼져 있으면 아무 요청도 하지 않는다.
//! 2. **묻기** — 지금 판보다 새 판이면 제품이 묻는 창(`tastedev-ui-kit::update_dialog`)을 띄운다.
//!    "나중에" 는 이번 실행에서 다시 묻지 않는다(다음 실행 때 다시). 조용히 설치하지 않는다.
//! 3. **받기 · 검증**([`fetch_asset`]) — "지금 설치" 를 누르면 이 PC 에 깔린 방식([`InstallKind`], [`detect`])에 맞는
//!    설치 파일([`pick_asset`])을 받는다. 릴리스가 알려 준 **크기와 SHA-256**(GitHub `digest`)이 모두 맞아야 쓴다.
//! 4. **설치**([`plan`]) — OS 별 명령을 만든다(Windows: 앱이 끝난 뒤 PowerShell 이 NSIS `/S` · msiexec `/qb!` ·
//!    zip 교체 후 다시 시작, Linux: `pkexec apt-get install` · `pkexec rpm -U` · AppImage 바꿔치기 후 다시 시작).
//!    실패하면 옛 판을 그대로 둔다. 실행은 [`Runner`] 가 하므로 시험은 명령만 본다.
//!
//! 네트워크는 제품이 준다([`Transport`]). `TASTEDEV_UPDATE_URL` 이 로컬 파일이면 목록을 그 파일에서 읽고
//! (그때만 로컬 설치 파일 주소를 믿는다), 캡처 모드(`TASTEDEV_CAPTURE=1`)는 로컬 주소만 읽는다.
//!
//! 기준 원본은 `sources/v1.0/tastedev-common/update/` 이다. 제품 저장소의
//! `crates/tastedev-update/` 는 그 사본이므로 사본을 고치지 말고 기준을 고쳐 다섯 곳에 복사한다.

use std::fs;
use std::path::{Path, PathBuf};

mod flow;
mod plan;
mod session;
pub mod sha256;
#[doc(hidden)]
pub mod testing;

#[cfg(test)]
mod tests;

pub use flow::{Flow, Stage};
pub use plan::{Ctx, Step, plan, powershell_quote};
pub use session::{DryRunner, Event, Runner, Session, Started, SystemRunner, Transport, Waker};

/// 공개 릴리스 목록(익명으로 읽는다).
pub const RELEASES_URL: &str =
    "https://api.github.com/repos/whitecalvin/tastedev-releases/releases?per_page=100";
/// 설치 파일을 믿는 주소 앞머리(뒤에 `<태그>/`).
pub const DOWNLOAD_BASE: &str =
    "https://github.com/whitecalvin/tastedev-releases/releases/download/";
/// 릴리스 페이지 앞머리(뒤에 태그).
pub const PAGE_BASE: &str = "https://github.com/whitecalvin/tastedev-releases/releases/tag/";
/// 릴리스 목록 주소를 바꾸는 환경 변수(시험 · 캡처용 — 로컬 파일이면 로컬 설치 파일 주소도 믿는다).
pub const URL_ENV: &str = "TASTEDEV_UPDATE_URL";
/// 캡처 모드에서만 읽는 설치 방식 바꾸기(`nsis` · `msi` · `zip` · `deb` · `rpm` · `appimage`) — 개발 빌드로
/// 묻는 창을 찍을 때 쓴다. 캡처 모드는 [`DryRunner`] 라 실제로 설치하지 않는다.
pub const KIND_ENV: &str = "TASTEDEV_UPDATE_KIND";
/// 캡처 모드 환경 변수(`tastedev-ui-kit` 과 같은 이름). 켜져 있으면 로컬 주소만 읽는다.
pub const CAPTURE_ENV: &str = "TASTEDEV_CAPTURE";
/// 목록 응답 최대 크기.
pub const MAX_LIST_BYTES: usize = 8 * 1024 * 1024;
/// 설치 파일 최대 크기.
pub const MAX_ASSET_BYTES: u64 = 2 * 1024 * 1024 * 1024;
/// 앱이 끝난 뒤 설치한 결과를 남기는 파일(작업 폴더 안). 다음 실행이 읽고 지운다.
pub const RESULT_FILE: &str = "update-result.txt";
/// 릴리스 노트 앞부분 줄 수(묻는 창).
pub const NOTES_LINES: usize = 8;
/// 릴리스 노트 앞부분 글자 수.
pub const NOTES_CHARS: usize = 600;

// ───────────────────────────── 제품 · 판 ─────────────────────────────

/// 제품 한 벌(이름 · 태그 · 패키지 이름 · 지금 판).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Product {
    /// "TASTEFILES"
    pub name: &'static str,
    /// "files-v"
    pub tag_prefix: &'static str,
    /// 설치 파일 앞머리이자 deb · rpm 패키지 이름: "tastefiles". Linux 새 이름(`tastedev-files`)은 여기서
    /// 끌어낸다([`linux_package_names`]).
    pub package: &'static str,
    /// 지금 판(`env!("CARGO_PKG_VERSION")`).
    pub version: &'static str,
}

impl Product {
    pub fn current(&self) -> Version {
        Version::parse(self.version).unwrap_or_default()
    }
}

/// 판 번호 `주.부.수`. 시험판 꼬리(`-rc1`)가 있으면 읽지 않는다(정식 판만 설치한다).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Version {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
}

impl Version {
    pub const fn new(major: u64, minor: u64, patch: u64) -> Self {
        Self {
            major,
            minor,
            patch,
        }
    }

    /// `1.2.3` · `v1.2.3` · `1.2`(= 1.2.0) · `1.2.3+build`. `1.2.3-rc1` 같은 시험판은 `None`.
    pub fn parse(s: &str) -> Option<Self> {
        let s = s.trim();
        let s = s.strip_prefix('v').unwrap_or(s);
        let core = s.split('+').next()?;
        if core.contains('-') || core.is_empty() {
            return None;
        }
        let mut it = core.split('.');
        let num = |p: Option<&str>| -> Option<u64> {
            let p = p?;
            if p.is_empty() || !p.bytes().all(|b| b.is_ascii_digit()) {
                return None;
            }
            p.parse().ok()
        };
        let major = num(it.next())?;
        let minor = num(it.next())?;
        let patch = match it.next() {
            Some(p) => num(Some(p))?,
            None => 0,
        };
        if it.next().is_some() {
            return None;
        }
        Some(Self::new(major, minor, patch))
    }
}

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}.{}.{}", self.major, self.minor, self.patch)
    }
}

// ───────────────────────────── 릴리스 ─────────────────────────────

/// 릴리스에 붙은 파일 하나.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Asset {
    pub name: String,
    pub url: String,
    pub size: u64,
    /// GitHub `digest`("sha256:…")에서 앞머리를 뗀 소문자 64자리. 없으면 빈 글.
    pub sha256: String,
}

impl Asset {
    /// 크기 · SHA-256 이 모두 있어 검증할 수 있는지.
    pub fn verifiable(&self) -> bool {
        self.size > 0
            && self.size <= MAX_ASSET_BYTES
            && self.sha256.len() == 64
            && self.sha256.bytes().all(|b| b.is_ascii_hexdigit())
    }

    /// 파일 이름이 경로 없는 이름 하나인지(받을 자리를 벗어나지 않게).
    pub fn plain_name(&self) -> bool {
        !self.name.is_empty()
            && !self.name.contains(['/', '\\', ':'])
            && self.name != "."
            && self.name != ".."
            && !self.name.starts_with('.')
    }
}

/// 공개된 판 하나.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Release {
    pub version: Version,
    pub tag: String,
    /// 릴리스 페이지(자세히 보기 · 내려받기 페이지).
    pub page: String,
    /// 릴리스 노트 원문(마크다운).
    pub notes: String,
    /// 공개일 YYYY-MM-DD(없으면 빈 글).
    pub published: String,
    pub assets: Vec<Asset>,
}

/// 릴리스 목록(JSON 배열)에서 `tag_prefix` 의 가장 새 정식 판을 고른다. 초안 · 시험판 · 다른 제품은 건너뛴다.
/// 배열이 아니면 오류.
pub fn latest(json: &[u8], tag_prefix: &str) -> Result<Option<Release>, UpdateError> {
    let value: serde_json::Value =
        serde_json::from_slice(json).map_err(|_| UpdateError::BadList)?;
    let list = value.as_array().ok_or(UpdateError::BadList)?;
    let mut best: Option<Release> = None;
    for item in list {
        let Some(r) = release_from(item, tag_prefix) else {
            continue;
        };
        if best.as_ref().is_none_or(|b| r.version > b.version) {
            best = Some(r);
        }
    }
    Ok(best)
}

fn release_from(item: &serde_json::Value, tag_prefix: &str) -> Option<Release> {
    let text =
        |v: &serde_json::Value, key: &str| v.get(key).and_then(|x| x.as_str()).map(str::to_owned);
    let flag = |key: &str| {
        item.get(key)
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false)
    };
    let tag = text(item, "tag_name")?;
    let version = Version::parse(tag.strip_prefix(tag_prefix)?)?;
    if flag("draft") || flag("prerelease") {
        return None;
    }
    let assets = item
        .get("assets")
        .and_then(|a| a.as_array())
        .map(|list| {
            list.iter()
                .filter_map(|a| {
                    Some(Asset {
                        name: text(a, "name")?,
                        url: text(a, "browser_download_url")?,
                        size: a.get("size").and_then(serde_json::Value::as_u64)?,
                        sha256: text(a, "digest")
                            .and_then(|d| d.strip_prefix("sha256:").map(str::to_ascii_lowercase))
                            .unwrap_or_default(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();
    let page = text(item, "html_url")
        .filter(|u| u.starts_with("https://"))
        .unwrap_or_else(|| format!("{PAGE_BASE}{tag}"));
    Some(Release {
        version,
        page,
        notes: text(item, "body").unwrap_or_default(),
        published: text(item, "published_at")
            .map(|p| p.chars().take(10).collect())
            .unwrap_or_default(),
        assets,
        tag,
    })
}

/// 묻는 창에 보일 릴리스 노트 앞부분: 마크다운 머리표(`#`) · 목록표(`-` `*`)를 다듬고 빈 줄을 줄여
/// 앞 [`NOTES_LINES`] 줄 · [`NOTES_CHARS`] 자까지. 잘랐으면 끝에 "…".
pub fn notes_excerpt(notes: &str) -> String {
    let mut lines: Vec<String> = Vec::new();
    let mut cut = false;
    let mut chars = 0usize;
    for raw in notes.lines() {
        let line = raw.trim();
        if line.is_empty() || line.starts_with("<!--") {
            continue;
        }
        let line = line.trim_start_matches('#').trim();
        let line = if let Some(rest) = line.strip_prefix("- ").or_else(|| line.strip_prefix("* ")) {
            format!("• {}", rest.trim())
        } else {
            line.replace("**", "")
        };
        if lines.len() == NOTES_LINES || chars + line.chars().count() > NOTES_CHARS {
            cut = true;
            break;
        }
        chars += line.chars().count();
        lines.push(line);
    }
    let mut out = lines.join("\n");
    if cut {
        out.push_str("\n…");
    }
    out
}

// ───────────────────────────── 로컬 주소 ─────────────────────────────

/// 로컬 주소인지(`http(s)://` 가 아니면 로컬 — `file:` 또는 경로).
pub fn is_local(url: &str) -> bool {
    let lower = url.trim().to_ascii_lowercase();
    !(lower.starts_with("https://") || lower.starts_with("http://"))
}

/// 로컬 주소의 파일 경로(`file:///C:/x` → `C:/x`, `file:///home/x` → `/home/x`, 경로는 그대로).
pub fn local_path(url: &str) -> Option<PathBuf> {
    if !is_local(url) {
        return None;
    }
    let url = url.trim();
    let path = if url.len() >= 5 && url[..5].eq_ignore_ascii_case("file:") {
        let rest = url[5..].trim_start_matches('/');
        let decoded = percent_decode(rest);
        if decoded.len() >= 2 && decoded.as_bytes()[1] == b':' {
            decoded
        } else {
            format!("/{decoded}")
        }
    } else {
        url.to_owned()
    };
    Some(PathBuf::from(path))
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%'
            && i + 2 < b.len()
            && let (Some(h), Some(l)) = (hexval(b[i + 1]), hexval(b[i + 2]))
        {
            out.push(h * 16 + l);
            i += 3;
            continue;
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn hexval(c: u8) -> Option<u8> {
    match c {
        b'0'..=b'9' => Some(c - b'0'),
        b'a'..=b'f' => Some(c - b'a' + 10),
        b'A'..=b'F' => Some(c - b'A' + 10),
        _ => None,
    }
}

/// 캡처 모드(`TASTEDEV_CAPTURE=1`)인지.
pub fn capture_mode() -> bool {
    std::env::var(CAPTURE_ENV).is_ok_and(|v| v.trim() == "1")
}

/// 읽을 목록 주소: `TASTEDEV_UPDATE_URL` 이 있으면 그것, 없으면 [`RELEASES_URL`].
pub fn list_url() -> String {
    std::env::var(URL_ENV)
        .ok()
        .map(|v| v.trim().to_owned())
        .filter(|v| !v.is_empty())
        .unwrap_or_else(|| RELEASES_URL.to_owned())
}

/// 설치 파일 주소를 믿는지: 배포 저장소의 그 태그 아래이거나, 목록이 로컬일 때의 로컬 주소.
pub fn trusted_url(url: &str, tag: &str, allow_local: bool) -> bool {
    if is_local(url) {
        return allow_local;
    }
    url.starts_with(&format!("{DOWNLOAD_BASE}{tag}/"))
}

// ───────────────────────────── 설치 방식 ─────────────────────────────

/// 운영체제.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Os {
    Windows,
    Linux,
    Mac,
    Other,
}

impl Os {
    pub fn current() -> Self {
        if cfg!(windows) {
            Self::Windows
        } else if cfg!(target_os = "linux") {
            Self::Linux
        } else if cfg!(target_os = "macos") {
            Self::Mac
        } else {
            Self::Other
        }
    }
}

/// 이 PC 에 앱이 깔린 방식(받을 설치 파일 · 설치 명령이 여기에 달렸다).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InstallKind {
    /// Windows NSIS 설치본(`-setup.exe`, 설치 폴더에 `uninstall.exe`).
    Nsis { dir: PathBuf },
    /// Windows MSI 설치본(Program Files 아래, `uninstall.exe` 없음).
    Msi,
    /// Windows zip(그 자리에 푼 것) — 앱이 끝난 뒤 파일을 바꾼다.
    Portable { dir: PathBuf },
    /// Linux deb(dpkg 가 이 패키지를 안다).
    Deb,
    /// Linux rpm.
    Rpm,
    /// Linux AppImage(`APPIMAGE` 가 가리키는 파일).
    AppImage { path: PathBuf },
    /// 자동 설치를 하지 않는다(확인 · 안내만).
    Unsupported(Unsupported),
}

/// 자동 설치를 하지 않는 까닭.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unsupported {
    /// 개발 빌드(`target/debug` 등) — 저장소 파일을 덮지 않는다.
    Development,
    /// 이번 범위 밖 운영체제(macOS 등).
    Platform,
    /// 깔린 방식을 모른다(Linux tar.gz 등).
    Unknown,
}

impl InstallKind {
    pub fn can_install(&self) -> bool {
        !matches!(self, Self::Unsupported(_))
    }
}

/// [`detect`] 에 줄 것(시험은 가짜 파일 있음 여부를 준다).
pub struct Probe<'a> {
    pub os: Os,
    /// 지금 실행 파일.
    pub exe: &'a Path,
    /// `APPIMAGE` 환경 변수.
    pub appimage: Option<&'a Path>,
    /// 파일이 있는지.
    pub exists: &'a dyn Fn(&Path) -> bool,
}

/// 앱이 깔린 방식을 알아낸다.
pub fn detect(package: &str, probe: &Probe<'_>) -> InstallKind {
    let norm = probe
        .exe
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase();
    if norm.contains("/target/debug/")
        || norm.contains("/target/release/")
        || norm.contains("/target/x86_64-")
    {
        return InstallKind::Unsupported(Unsupported::Development);
    }
    let dir = probe
        .exe
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_default();
    match probe.os {
        Os::Windows => {
            if (probe.exists)(&dir.join("uninstall.exe")) {
                InstallKind::Nsis { dir }
            } else if norm.contains("/program files") {
                InstallKind::Msi
            } else {
                InstallKind::Portable { dir }
            }
        }
        Os::Linux => {
            if let Some(path) = probe.appimage.filter(|p| !p.as_os_str().is_empty()) {
                return InstallKind::AppImage {
                    path: path.to_path_buf(),
                };
            }
            // 옛 패키지 이름(`tastefiles`)과 새 이름(`tastedev-files`) 둘 다 본다.
            let dpkg = Path::new("/var/lib/dpkg/info");
            let known = linux_package_names(package).iter().any(|name| {
                ["", ":amd64", ":arm64"]
                    .iter()
                    .any(|a| (probe.exists)(&dpkg.join(format!("{name}{a}.list"))))
            });
            if known {
                InstallKind::Deb
            } else if norm.starts_with("/usr/") && (probe.exists)(Path::new("/usr/bin/rpm")) {
                InstallKind::Rpm
            } else {
                InstallKind::Unsupported(Unsupported::Unknown)
            }
        }
        Os::Mac | Os::Other => InstallKind::Unsupported(Unsupported::Platform),
    }
}

/// [`KIND_ENV`] 값으로 설치 방식을 만든다(캡처 모드 전용).
pub fn kind_from_name(name: &str, exe: &Path) -> Option<InstallKind> {
    let dir = exe.parent().map(Path::to_path_buf).unwrap_or_default();
    Some(match name.trim().to_ascii_lowercase().as_str() {
        "nsis" => InstallKind::Nsis { dir },
        "msi" => InstallKind::Msi,
        "zip" => InstallKind::Portable { dir },
        "deb" => InstallKind::Deb,
        "rpm" => InstallKind::Rpm,
        "appimage" => InstallKind::AppImage {
            path: exe.to_path_buf(),
        },
        _ => return None,
    })
}

/// 이 PC(지금 실행 파일 · 환경)로 [`detect`].
pub fn detect_current(package: &str, exe: &Path) -> InstallKind {
    let appimage = std::env::var_os("APPIMAGE").map(PathBuf::from);
    detect(
        package,
        &Probe {
            os: Os::current(),
            exe,
            appimage: appimage.as_deref(),
            exists: &|p: &Path| p.exists(),
        },
    )
}

/// 이 설치 방식 · CPU 에 맞는 설치 파일을 고른다(크기 · SHA-256 이 있는 것만).
///
/// 이름 꼴(출시 도구): `<패키지>_<판>_windows_x64-setup.exe` · `_windows_x64.msi` · `_windows_x64.zip` ·
/// `_linux_x86_64.deb` · `.rpm` · `.AppImage`, 다음 판부터 Linux 는 `tastedev-<제품>-<판>-linux-x86_64.deb` 꼴도.
pub fn pick_asset<'a>(
    release: &'a Release,
    package: &str,
    kind: &InstallKind,
    arch: &str,
) -> Option<&'a Asset> {
    release.assets.iter().find(|a| {
        asset_name_matches(&a.name, package, kind, arch) && a.verifiable() && a.plain_name()
    })
}

/// 설치 파일 이름이 이 제품 · 설치 방식 · CPU(`std::env::consts::ARCH`)의 이름 꼴인지(출시 도구 이름 규칙,
/// 대소문자 무시). Windows 는 `_windows_x64` · `_windows_arm64`, Linux 는 `_linux_x86_64`(· `_amd64`) ·
/// `_linux_aarch64`(· `_arm64`) 이다 — Linux 에 `_x64` 는 없다. 수동 "내려받기"(제품 설정 › 업데이트)도 이것을 쓴다.
/// Linux 는 옛 꼴(`tastefiles_0.1.3_linux_x86_64.deb`)과 새 꼴(`tastedev-files-0.1.3-linux-x86_64.deb`,
/// [`linux_package_names`])을 모두 받는다.
pub fn asset_name_matches(name: &str, package: &str, kind: &InstallKind, arch: &str) -> bool {
    let (platform, suffix) = match kind {
        InstallKind::Nsis { .. } => ("_windows_", "-setup.exe"),
        InstallKind::Msi => ("_windows_", ".msi"),
        InstallKind::Portable { .. } => ("_windows_", ".zip"),
        InstallKind::Deb => ("_linux_", ".deb"),
        InstallKind::Rpm => ("_linux_", ".rpm"),
        InstallKind::AppImage { .. } => ("_linux_", ".appimage"),
        InstallKind::Unsupported(_) => return false,
    };
    let arches: &[&str] = match (platform, arch) {
        ("_windows_", "x86_64") => &["_x64"],
        ("_windows_", "aarch64") => &["_arm64"],
        ("_linux_", "x86_64") => &["_x86_64", "_amd64"],
        ("_linux_", "aarch64") => &["_aarch64", "_arm64"],
        _ => return false,
    };
    let name = name.to_ascii_lowercase();
    let [old, new] = linux_package_names(package);
    let prefix = format!("{old}_");
    let old_form = name.starts_with(&prefix)
        && name.contains(platform)
        && name.ends_with(suffix)
        && arches
            .iter()
            .any(|t| name.contains(&format!("{t}.")) || name.contains(&format!("{t}-")));
    old_form || (platform == "_linux_" && new_linux_form(&name, &new, suffix, arches))
}

/// Linux 새 이름 꼴 `tastedev-<제품>-<판>-linux-<CPU><확장자>`(예: `tastedev-files-0.1.3-linux-x86_64.deb`,
/// 이미 소문자). 판은 숫자와 점만 — 다른 제품 · 다른 이름(`tastedev-files-cli-…`)이 섞이지 않는다.
fn new_linux_form(name: &str, package: &str, suffix: &str, arches: &[&str]) -> bool {
    let Some(stem) = name
        .strip_suffix(suffix)
        .and_then(|s| s.strip_prefix(package))
        .and_then(|s| s.strip_prefix('-'))
    else {
        return false;
    };
    let Some((version, arch)) = stem.split_once("-linux-") else {
        return false;
    };
    let version_ok = !version.is_empty()
        && version
            .split('.')
            .all(|p| !p.is_empty() && p.bytes().all(|b| b.is_ascii_digit()));
    version_ok && arches.iter().any(|t| t.strip_prefix('_') == Some(arch))
}

/// Linux 패키지 이름 두 벌 `[옛, 새]`: `tastefiles` → `["tastefiles", "tastedev-files"]`. 출시 도구가 다음 판부터
/// Linux 패키지(deb `Package` · rpm `Name`)와 파일 이름을 `tastedev-<제품>` 으로 바꾸었다(Windows 는 그대로).
/// 제품이 새 이름(`tastedev-files`)을 주어도 같은 두 벌을 돌려준다. 대소문자는 소문자로 맞춘다.
pub fn linux_package_names(package: &str) -> [String; 2] {
    let p = package.to_ascii_lowercase();
    if let Some(id) = p.strip_prefix("tastedev-") {
        [format!("taste{id}"), p.clone()]
    } else if let Some(id) = p.strip_prefix("taste") {
        [p.clone(), format!("tastedev-{id}")]
    } else {
        [p.clone(), p]
    }
}

/// 수동 "내려받기"(제품 설정 › 업데이트 — 받은 파일을 사용자가 연다)가 찾는 설치 방식 차례.
/// Windows: NSIS(`-setup.exe`) → MSI, Linux: deb → rpm → AppImage. 그 밖의 OS 는 없다.
/// zip(`Portable`)은 열어서 설치할 수 없으니 넣지 않는다.
pub fn manual_kinds(os: Os) -> Vec<InstallKind> {
    match os {
        Os::Windows => vec![
            InstallKind::Nsis {
                dir: PathBuf::new(),
            },
            InstallKind::Msi,
        ],
        Os::Linux => vec![
            InstallKind::Deb,
            InstallKind::Rpm,
            InstallKind::AppImage {
                path: PathBuf::new(),
            },
        ],
        Os::Mac | Os::Other => Vec::new(),
    }
}

/// 수동 "내려받기" 가 고를 파일: [`manual_kinds`] 차례로 이름 꼴([`asset_name_matches`])이 맞고 `usable`(제품의
/// 크기 · SHA-256 · 주소 검사)을 통과한 첫 파일. 제품마다 파일 형이 달라 이름을 꺼내는 `name` 을 받는다.
pub fn pick_manual<'a, T>(
    assets: &'a [T],
    package: &str,
    os: Os,
    arch: &str,
    name: impl Fn(&T) -> &str,
    usable: impl Fn(&T) -> bool,
) -> Option<&'a T> {
    manual_kinds(os).iter().find_map(|kind| {
        assets
            .iter()
            .find(|a| asset_name_matches(name(a), package, kind, arch) && usable(a))
    })
}

// ───────────────────────────── 오류 ─────────────────────────────

/// 업데이트 오류. 제품이 [`UpdateError::kind`] 로 번역 문구를 고르고 [`UpdateError::detail`] 을 붙인다.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum UpdateError {
    /// 목록 · 파일을 받지 못함(네트워크 · 4xx · 5xx · 시간 초과).
    Network(String),
    /// 목록이 JSON 배열이 아님.
    BadList,
    /// 이 PC 에 맞는 검증 가능한 설치 파일이 없음 · 믿지 않는 주소.
    NoAsset,
    /// 크기가 다름.
    Size { got: u64, want: u64 },
    /// SHA-256 이 다름.
    Hash,
    /// 파일을 쓰거나 읽지 못함.
    Io(String),
    /// 권한을 받지 못함(pkexec 없음 · 거절 · UAC 취소).
    Denied(String),
    /// 설치 명령이 실패함.
    Install(String),
    /// 이 설치 방식은 자동 설치를 하지 않음.
    Unsupported,
}

/// 오류 갈래(제품 번역 문구 하나씩).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ErrorKind {
    /// "새 버전을 내려받지 못했습니다: {0}"
    Download,
    /// "내려받은 파일이 릴리스 정보와 맞지 않습니다(크기 또는 SHA-256)."
    Mismatch,
    /// "설치 권한을 받지 못했습니다. 내려받은 파일을 직접 열어 설치하세요."
    Denied,
    /// "설치하지 못했습니다: {0}"
    Install,
    /// "이 설치 방식은 자동 설치를 지원하지 않습니다. 내려받기 페이지에서 받으세요."
    Unsupported,
}

impl UpdateError {
    pub fn kind(&self) -> ErrorKind {
        match self {
            Self::Network(_) | Self::BadList | Self::Io(_) => ErrorKind::Download,
            Self::Size { .. } | Self::Hash => ErrorKind::Mismatch,
            Self::Denied(_) => ErrorKind::Denied,
            Self::Install(_) => ErrorKind::Install,
            Self::NoAsset | Self::Unsupported => ErrorKind::Unsupported,
        }
    }

    /// 번역 문구 뒤에 붙일 원문 까닭(없으면 빈 글).
    pub fn detail(&self) -> String {
        match self {
            Self::Network(s) | Self::Io(s) | Self::Denied(s) | Self::Install(s) => s.clone(),
            Self::Size { got, want } => format!("{got} / {want}"),
            Self::BadList => "invalid release list".into(),
            Self::Hash | Self::NoAsset | Self::Unsupported => String::new(),
        }
    }

    /// 사용자가 내려받은 파일을 직접 열어 볼 만한 오류인지(권한 거절 · 설치 실패).
    pub fn offers_file(&self) -> bool {
        matches!(self, Self::Denied(_) | Self::Install(_))
    }
}

impl std::fmt::Display for UpdateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.kind(), self.detail())
    }
}

// ───────────────────────────── 받기 · 검증 ─────────────────────────────

/// 파일이 릴리스가 알려 준 크기 · SHA-256 과 맞는지.
pub fn verify_file(path: &Path, asset: &Asset) -> Result<(), UpdateError> {
    if !asset.verifiable() {
        return Err(UpdateError::NoAsset);
    }
    let len = fs::metadata(path)
        .map_err(|e| UpdateError::Io(e.to_string()))?
        .len();
    if len != asset.size {
        return Err(UpdateError::Size {
            got: len,
            want: asset.size,
        });
    }
    let file = fs::File::open(path).map_err(|e| UpdateError::Io(e.to_string()))?;
    let (_, hex) = sha256::read_hex(std::io::BufReader::new(file))
        .map_err(|e| UpdateError::Io(e.to_string()))?;
    if !hex.eq_ignore_ascii_case(&asset.sha256) {
        return Err(UpdateError::Hash);
    }
    Ok(())
}

/// 설치 파일을 `dir` 에 받는다: `<이름>.partial` 로 받고 → 크기 · SHA-256 검증 → 이름을 바꾼다.
/// 이미 받아 둔 같은 파일이 검증되면 다시 받지 않는다. 실패하면 받던 파일을 지운다.
/// `progress` 는 지금까지 받은 바이트 수를 받는다.
pub fn fetch_asset(
    asset: &Asset,
    tag: &str,
    dir: &Path,
    allow_local: bool,
    transport: &dyn Transport,
    progress: &dyn Fn(u64),
) -> Result<PathBuf, UpdateError> {
    if !asset.verifiable() || !asset.plain_name() || !trusted_url(&asset.url, tag, allow_local) {
        return Err(UpdateError::NoAsset);
    }
    fs::create_dir_all(dir).map_err(|e| UpdateError::Io(e.to_string()))?;
    let target = dir.join(&asset.name);
    if target.is_file() && verify_file(&target, asset).is_ok() {
        progress(asset.size);
        return Ok(target);
    }
    let partial = dir.join(format!("{}.partial", asset.name));
    let _ = fs::remove_file(&partial);
    let got = if is_local(&asset.url) {
        copy_local(&asset.url, &partial, progress)
    } else if capture_mode() {
        Err(UpdateError::Network("capture mode: local only".into()))
    } else {
        transport
            .download(&asset.url, &partial, progress)
            .map_err(UpdateError::Network)
    };
    let result = got
        .and_then(|()| verify_file(&partial, asset))
        .and_then(|()| {
            let _ = fs::remove_file(&target);
            fs::rename(&partial, &target).map_err(|e| UpdateError::Io(e.to_string()))
        });
    match result {
        Ok(()) => Ok(target),
        Err(e) => {
            let _ = fs::remove_file(&partial);
            Err(e)
        }
    }
}

fn copy_local(url: &str, to: &Path, progress: &dyn Fn(u64)) -> Result<(), UpdateError> {
    use std::io::{Read, Write};
    let from = local_path(url).ok_or(UpdateError::NoAsset)?;
    let mut src = fs::File::open(&from).map_err(|e| UpdateError::Network(e.to_string()))?;
    let mut dst = fs::File::create(to).map_err(|e| UpdateError::Io(e.to_string()))?;
    let mut buf = vec![0u8; 64 * 1024];
    let mut total = 0u64;
    loop {
        let n = src
            .read(&mut buf)
            .map_err(|e| UpdateError::Network(e.to_string()))?;
        if n == 0 {
            break;
        }
        total += n as u64;
        if total > MAX_ASSET_BYTES {
            return Err(UpdateError::Size {
                got: total,
                want: MAX_ASSET_BYTES,
            });
        }
        dst.write_all(&buf[..n])
            .map_err(|e| UpdateError::Io(e.to_string()))?;
        progress(total);
    }
    dst.sync_all().map_err(|e| UpdateError::Io(e.to_string()))
}

/// 목록을 읽는다: 로컬이면 파일, 아니면 제품 네트워크(캡처 모드에서는 읽지 않는다).
pub fn fetch_list(
    url: &str,
    transport: &dyn Transport,
    local_only: bool,
) -> Result<Vec<u8>, UpdateError> {
    if is_local(url) {
        let path = local_path(url).ok_or(UpdateError::BadList)?;
        return fs::read(path).map_err(|e| UpdateError::Network(e.to_string()));
    }
    if local_only || capture_mode() {
        return Err(UpdateError::Network("local only".into()));
    }
    let body = transport.get(url).map_err(UpdateError::Network)?;
    if body.len() > MAX_LIST_BYTES {
        return Err(UpdateError::BadList);
    }
    Ok(body)
}

// ───────────────────────────── 지난 설치 결과 ─────────────────────────────

/// 앱이 끝난 뒤 설치한 결과(다음 실행이 읽는다).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InstallResult {
    Ok(Version),
    Failed {
        version: Option<Version>,
        detail: String,
    },
}

/// 결과 줄(`ok 1.2.3` · `fail 1.2.3 까닭`)을 읽는다.
pub fn parse_result(text: &str) -> Option<InstallResult> {
    let line = text.trim_start_matches('\u{feff}').lines().next()?.trim();
    let mut parts = line.splitn(3, ' ');
    let head = parts.next()?;
    let version = parts.next().and_then(Version::parse);
    match head {
        "ok" => Some(InstallResult::Ok(version?)),
        "fail" => Some(InstallResult::Failed {
            version,
            detail: parts.next().unwrap_or("").trim().to_owned(),
        }),
        _ => None,
    }
}

/// 작업 폴더의 결과 파일을 읽고 지운다.
pub fn take_result(work_dir: &Path) -> Option<InstallResult> {
    let path = work_dir.join(RESULT_FILE);
    let text = fs::read_to_string(&path).ok()?;
    let _ = fs::remove_file(&path);
    parse_result(&text)
}

/// 작업 폴더를 치운다(받아 둔 설치 파일 · 스크립트 · 받다 만 파일). 결과 파일은 남긴다.
pub fn clean_work_dir(work_dir: &Path) {
    let Ok(entries) = fs::read_dir(work_dir) else {
        return;
    };
    for e in entries.flatten() {
        if e.file_name() == RESULT_FILE {
            continue;
        }
        let p = e.path();
        if p.is_dir() {
            let _ = fs::remove_dir_all(&p);
        } else {
            let _ = fs::remove_file(&p);
        }
    }
}
