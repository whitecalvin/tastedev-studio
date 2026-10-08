//! 가짜 릴리스 목록(로컬 파일)으로 시험한다. 네트워크에 가지 않고, 설치 프로그램을 실제로 돌리지 않는다
//! (가짜 [`Runner`] 가 명령만 기록한다).

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use crate::sha256;
use crate::*;

const PRODUCT: Product = Product {
    name: "TASTEFILES",
    tag_prefix: "files-v",
    package: "tastefiles",
    version: "0.1.1",
};

// ───────────────────────────── 도우미 ─────────────────────────────

use crate::testing::{Fixture, Harness, NoNetwork, Recorder, Temp};

fn fixture(version: &str, names: &[&str], tamper: Option<&str>) -> Fixture {
    crate::testing::fixture(&PRODUCT, version, names, tamper)
}

fn harness(fx: &Fixture, kind: InstallKind, exe: &str, has: &'static [&'static str]) -> Harness {
    crate::testing::harness(PRODUCT, fx, kind, exe, has)
}

fn noop() -> Waker {
    Arc::new(|| {})
}

fn wait(session: &mut Session) -> Event {
    let start = Instant::now();
    loop {
        if let Some(e) = session.poll() {
            return e;
        }
        assert!(start.elapsed() < Duration::from_secs(20), "시간 초과");
        std::thread::sleep(Duration::from_millis(5));
    }
}

fn check(h: &mut Harness) -> Option<Release> {
    h.session.check(noop());
    match wait(&mut h.session) {
        Event::Checked(r) => r.expect("확인"),
        other => panic!("{other:?}"),
    }
}

fn download(h: &mut Harness, r: &Release) -> Result<PathBuf, UpdateError> {
    h.session.download(r.clone(), noop());
    match wait(&mut h.session) {
        Event::Downloaded(r) => r.map(|(_, p)| p),
        other => panic!("{other:?}"),
    }
}

const WIN: [&str; 3] = [
    "tastefiles_0.2.0_windows_x64-setup.exe",
    "tastefiles_0.2.0_windows_x64.msi",
    "tastefiles_0.2.0_windows_x64.zip",
];
const LINUX: [&str; 4] = [
    "tastefiles_0.2.0_linux_x86_64.deb",
    "tastefiles_0.2.0_linux_x86_64.rpm",
    "tastefiles_0.2.0_linux_x86_64.AppImage",
    "tastefiles_0.2.0_linux_x86_64.tar.gz",
];

// ───────────────────────────── 낱 기능 ─────────────────────────────

#[test]
fn sha256_matches_known_vectors() {
    assert_eq!(
        sha256::digest_hex(b""),
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
    assert_eq!(
        sha256::digest_hex(b"abc"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    assert_eq!(
        sha256::digest_hex(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq"),
        "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
    );
    // 나눠 넣어도 같다(64바이트 경계를 넘나든다).
    let data: Vec<u8> = (0..1000u32).map(|i| (i * 7 % 251) as u8).collect();
    let mut h = sha256::Sha256::new();
    for chunk in data.chunks(37) {
        h.update(chunk);
    }
    assert_eq!(h.finish_hex(), sha256::digest_hex(&data));
    assert_eq!(
        sha256::read_hex(&data[..]).unwrap(),
        (1000, sha256::digest_hex(&data))
    );
}

#[test]
fn versions_parse_and_compare_numerically() {
    assert_eq!(Version::parse("v1.2.3"), Some(Version::new(1, 2, 3)));
    assert_eq!(Version::parse("1.2"), Some(Version::new(1, 2, 0)));
    assert_eq!(Version::parse("1.2.3+abc"), Some(Version::new(1, 2, 3)));
    assert_eq!(
        Version::parse("1.2.3-rc1"),
        None,
        "시험판은 설치하지 않는다"
    );
    assert_eq!(Version::parse("1.x.3"), None);
    assert_eq!(Version::parse("1.2.3.4"), None);
    assert_eq!(Version::parse(""), None);
    assert!(Version::new(0, 10, 0) > Version::new(0, 9, 9));
    assert_eq!(Version::new(0, 2, 0).to_string(), "0.2.0");
    assert_eq!(PRODUCT.current(), Version::new(0, 1, 1));
}

#[test]
fn latest_picks_the_newest_stable_release_of_this_product() {
    let fx = fixture("0.2.0", &WIN, None);
    let body = std::fs::read(&fx.list).unwrap();
    let r = latest(&body, "files-v").unwrap().expect("판");
    assert_eq!(
        r.version,
        Version::new(0, 2, 0),
        "초안 99 · 시험판 98 · 다른 제품 zip 9.9.9 는 건너뜀"
    );
    assert_eq!(r.tag, "files-v0.2.0");
    assert_eq!(r.published, "2026-10-01");
    assert!(r.page.ends_with("/files-v0.2.0"));
    assert_eq!(r.assets.len(), 3);
    assert_eq!(r.assets[0].sha256.len(), 64);
    assert!(latest(&body, "cad-v").unwrap().is_none());
    assert_eq!(latest(b"{}", "files-v"), Err(UpdateError::BadList));
    assert_eq!(latest(b"not json", "files-v"), Err(UpdateError::BadList));
}

#[test]
fn notes_excerpt_keeps_the_head_of_the_release_notes() {
    assert_eq!(
        notes_excerpt("## 바뀐 점\n\n- 하나\n* 둘\n**굵게**"),
        "바뀐 점\n• 하나\n• 둘\n굵게"
    );
    let long: String = (0..20).map(|i| format!("- 줄 {i}\n")).collect();
    let e = notes_excerpt(&long);
    assert_eq!(e.lines().count(), NOTES_LINES + 1);
    assert!(e.ends_with('…'));
    assert_eq!(notes_excerpt(""), "");
}

#[test]
fn assets_are_picked_by_install_kind_and_cpu() {
    let mut names: Vec<&str> = WIN.to_vec();
    names.extend(LINUX);
    names.push("tastecad_0.2.0_windows_x64.msi");
    let fx = fixture("0.2.0", &names, None);
    let r = latest(&std::fs::read(&fx.list).unwrap(), "files-v")
        .unwrap()
        .unwrap();
    let pick = |kind: InstallKind, arch: &str| {
        pick_asset(&r, "tastefiles", &kind, arch).map(|a| a.name.clone())
    };
    let dir = PathBuf::from("C:/Program Files/TASTEFILES");
    assert_eq!(
        pick(InstallKind::Nsis { dir: dir.clone() }, "x86_64").as_deref(),
        Some(WIN[0])
    );
    assert_eq!(pick(InstallKind::Msi, "x86_64").as_deref(), Some(WIN[1]));
    assert_eq!(
        pick(InstallKind::Portable { dir }, "x86_64").as_deref(),
        Some(WIN[2])
    );
    assert_eq!(pick(InstallKind::Deb, "x86_64").as_deref(), Some(LINUX[0]));
    assert_eq!(pick(InstallKind::Rpm, "x86_64").as_deref(), Some(LINUX[1]));
    assert_eq!(
        pick(InstallKind::AppImage { path: "/a".into() }, "x86_64").as_deref(),
        Some(LINUX[2])
    );
    assert_eq!(pick(InstallKind::Msi, "aarch64"), None, "arm64 파일이 없다");
    assert_eq!(
        pick(InstallKind::Unsupported(Unsupported::Platform), "x86_64"),
        None
    );
    // 크기 · SHA-256 이 없으면 고르지 않는다.
    let mut bad = r.clone();
    for a in &mut bad.assets {
        a.sha256.clear();
    }
    assert!(pick_asset(&bad, "tastefiles", &InstallKind::Msi, "x86_64").is_none());
}

#[test]
fn manual_download_uses_the_release_file_names() {
    // 출시 도구의 실제 이름 꼴: Windows `_windows_x64`, Linux `_linux_x86_64`(Linux 에 `_x64` 는 없다).
    let names = [
        "tastecad_0.2.0_linux_x86_64.deb",
        "tastecad_0.2.0_linux_x86_64.rpm",
        "tastecad_0.2.0_linux_x86_64.AppImage",
        "tastecad_0.2.0_windows_x64.msi",
        "tastecad_0.2.0_windows_x64-setup.exe",
        "tastecad_0.2.0_windows_x64.zip",
        "tastefiles_0.2.0_linux_x86_64.deb",
    ];
    let pick = |os: Os, arch: &str, usable: &dyn Fn(&&str) -> bool| {
        pick_manual(&names, "tastecad", os, arch, |n| n, usable).copied()
    };
    let all = |_: &&str| true;
    // Windows: NSIS 먼저, 없으면 MSI. zip 은 고르지 않는다.
    assert_eq!(
        pick(Os::Windows, "x86_64", &all),
        Some("tastecad_0.2.0_windows_x64-setup.exe")
    );
    assert_eq!(
        pick(Os::Windows, "x86_64", &|n| n.ends_with(".msi")),
        Some("tastecad_0.2.0_windows_x64.msi")
    );
    assert_eq!(pick(Os::Windows, "x86_64", &|n| n.ends_with(".zip")), None);
    // Linux: deb → rpm → AppImage.
    assert_eq!(
        pick(Os::Linux, "x86_64", &all),
        Some("tastecad_0.2.0_linux_x86_64.deb")
    );
    assert_eq!(
        pick(Os::Linux, "x86_64", &|n| !n.ends_with(".deb")),
        Some("tastecad_0.2.0_linux_x86_64.rpm")
    );
    assert_eq!(
        pick(Os::Linux, "x86_64", &|n| n.ends_with(".AppImage")),
        Some("tastecad_0.2.0_linux_x86_64.AppImage")
    );
    // 옛 잘못된 가정(`_linux_x64`)의 이름은 없는 꼴이라 고르지 않고, 다른 CPU · OS · 제품도 고르지 않는다.
    assert!(!asset_name_matches(
        "tastecad_0.2.0_linux_x64.deb",
        "tastecad",
        &InstallKind::Deb,
        "x86_64"
    ));
    assert_eq!(pick(Os::Linux, "aarch64", &all), None);
    assert_eq!(pick(Os::Mac, "x86_64", &all), None);
    assert_eq!(
        pick_manual(&names, "tasteftp", Os::Linux, "x86_64", |n| n, all),
        None
    );
    assert!(asset_name_matches(
        "tastecad_0.2.0_linux_amd64.deb",
        "tastecad",
        &InstallKind::Deb,
        "x86_64"
    ));
    assert!(manual_kinds(Os::Windows)
        .iter()
        .all(|k| !matches!(k, InstallKind::Portable { .. })));
}

#[test]
fn linux_new_release_names_are_accepted_alongside_the_old_ones() {
    // 다음 판부터 Linux: `tastedev-<제품>-<판>-linux-<CPU>.<확장자>`, 패키지 `tastedev-<제품>`. Windows 는 그대로.
    assert_eq!(
        linux_package_names("tastefiles"),
        ["tastefiles", "tastedev-files"]
    );
    assert_eq!(
        linux_package_names("TASTEDEV-FILES"),
        ["tastefiles", "tastedev-files"]
    );
    assert_eq!(
        linux_package_names("tastecad"),
        ["tastecad", "tastedev-cad"]
    );
    let appimage = InstallKind::AppImage {
        path: PathBuf::new(),
    };
    let m = |name: &str, kind: &InstallKind, arch: &str| {
        asset_name_matches(name, "tastefiles", kind, arch)
    };
    // 새 꼴 · 옛 꼴 모두(대소문자 무시).
    for (name, kind) in [
        ("tastedev-files-0.1.3-linux-x86_64.deb", &InstallKind::Deb),
        ("tastedev-files-0.1.3-linux-x86_64.rpm", &InstallKind::Rpm),
        ("tastedev-files-0.1.3-linux-x86_64.AppImage", &appimage),
        ("tastedev-files-0.1.30-linux-x86_64.deb", &InstallKind::Deb),
        ("tastefiles_0.1.3_linux_x86_64.deb", &InstallKind::Deb),
        ("tastefiles_0.1.3_linux_x86_64.AppImage", &appimage),
    ] {
        assert!(m(name, kind, "x86_64"), "{name}");
        assert!(!m(name, kind, "aarch64"), "{name}");
    }
    assert!(m(
        "tastedev-files-0.1.3-linux-aarch64.deb",
        &InstallKind::Deb,
        "aarch64"
    ));
    assert!(!m(
        "tastedev-files-0.1.3-linux-aarch64.deb",
        &InstallKind::Deb,
        "x86_64"
    ));
    // 제품이 새 이름을 주어도 두 꼴을 모두 받는다.
    for name in [
        "tastedev-files-0.1.3-linux-x86_64.deb",
        "tastefiles_0.1.3_linux_x86_64.deb",
    ] {
        assert!(
            asset_name_matches(name, "tastedev-files", &InstallKind::Deb, "x86_64"),
            "{name}"
        );
    }
    // 확장자 · 제품 · 판 모양 · 구분자가 어긋나면 받지 않는다.
    for (name, kind) in [
        (
            "tastedev-files-0.1.3-linux-x86_64.tar.gz",
            &InstallKind::Deb,
        ),
        ("tastedev-files-0.1.3-linux-x86_64.deb", &InstallKind::Rpm),
        ("tastedev-files-0.1.3-linux-x86_64.deb", &appimage),
        ("tastedev-ftp-0.1.3-linux-x86_64.deb", &InstallKind::Deb),
        ("tastedev-filesx-0.1.3-linux-x86_64.deb", &InstallKind::Deb),
        (
            "tastedev-files-cli-0.1.3-linux-x86_64.deb",
            &InstallKind::Deb,
        ),
        (
            "tastedev-files-0.1.3-rc1-linux-x86_64.deb",
            &InstallKind::Deb,
        ),
        ("tastedev-files-0..3-linux-x86_64.deb", &InstallKind::Deb),
        ("tastedev-files--linux-x86_64.deb", &InstallKind::Deb),
        ("tastedev-files-0.1.3-linux-x64.deb", &InstallKind::Deb),
        (
            "tastedev-files-0.1.3-linux-x86_64-debug.deb",
            &InstallKind::Deb,
        ),
        ("tastedev-files_0.1.3_linux_x86_64.deb", &InstallKind::Deb),
        ("tastedev_files-0.1.3-linux-x86_64.deb", &InstallKind::Deb),
    ] {
        assert!(!m(name, kind, "x86_64"), "{name}");
    }
    // Windows 는 새 꼴을 쓰지 않는다.
    assert!(!m(
        "tastedev-files-0.1.3-windows-x64-setup.exe",
        &InstallKind::Nsis {
            dir: PathBuf::new()
        },
        "x86_64"
    ));
    assert!(!m(
        "tastedev-files-0.1.3-linux-x86_64.msi",
        &InstallKind::Msi,
        "x86_64"
    ));
    // 수동 "내려받기" 도 새 꼴을 deb → rpm → AppImage 차례로 고른다.
    let names = [
        "tastedev-files-0.1.3-linux-x86_64.tar.gz",
        "tastedev-files-0.1.3-linux-x86_64.AppImage",
        "tastedev-files-0.1.3-linux-x86_64.rpm",
        "tastedev-files-0.1.3-linux-x86_64.deb",
        "tastefiles_0.1.3_windows_x64-setup.exe",
    ];
    let pick = |usable: &dyn Fn(&&str) -> bool| {
        pick_manual(&names, "tastefiles", Os::Linux, "x86_64", |n| n, usable).copied()
    };
    assert_eq!(
        pick(&|_| true),
        Some("tastedev-files-0.1.3-linux-x86_64.deb")
    );
    assert_eq!(
        pick(&|n| !n.ends_with(".deb")),
        Some("tastedev-files-0.1.3-linux-x86_64.rpm")
    );
    assert_eq!(
        pick(&|n| n.ends_with(".AppImage") || n.ends_with(".tar.gz")),
        Some("tastedev-files-0.1.3-linux-x86_64.AppImage")
    );
    assert_eq!(pick(&|n| n.ends_with(".tar.gz")), None);
    assert_eq!(
        pick_manual(&names, "tastefiles", Os::Windows, "x86_64", |n| n, |_| true).copied(),
        Some("tastefiles_0.1.3_windows_x64-setup.exe")
    );
}

#[test]
fn install_kind_is_detected_from_the_executable_and_files() {
    let none = |_: &Path| false;
    fn probe(os: Os, exe: &str, app: Option<&str>, exists: &dyn Fn(&Path) -> bool) -> InstallKind {
        detect(
            "tastefiles",
            &Probe {
                os,
                exe: Path::new(exe),
                appimage: app.map(Path::new),
                exists,
            },
        )
    }
    let nsis = |p: &Path| p.ends_with("uninstall.exe");
    assert_eq!(
        probe(
            Os::Windows,
            "C:/Program Files/TASTEFILES/tastefiles.exe",
            None,
            &nsis
        ),
        InstallKind::Nsis {
            dir: PathBuf::from("C:/Program Files/TASTEFILES")
        }
    );
    assert_eq!(
        probe(
            Os::Windows,
            "C:/Program Files/TASTEFILES/tastefiles.exe",
            None,
            &none
        ),
        InstallKind::Msi
    );
    assert_eq!(
        probe(
            Os::Windows,
            "D:/tools/tastefiles/tastefiles.exe",
            None,
            &none
        ),
        InstallKind::Portable {
            dir: PathBuf::from("D:/tools/tastefiles")
        }
    );
    assert_eq!(
        probe(
            Os::Windows,
            "D:\\src\\tastedev-files\\target\\debug\\tastefiles.exe",
            None,
            &nsis
        ),
        InstallKind::Unsupported(Unsupported::Development),
        "개발 빌드는 저장소 파일을 덮지 않는다"
    );
    assert_eq!(
        probe(
            Os::Linux,
            "/tmp/.mount_x/usr/bin/tastefiles",
            Some("/home/u/TASTEFILES.AppImage"),
            &none
        ),
        InstallKind::AppImage {
            path: PathBuf::from("/home/u/TASTEFILES.AppImage")
        }
    );
    // 새 패키지 이름(`tastedev-files`)으로 깔린 deb 도 안다(아키텍처 꼬리 포함).
    for list in [
        "/var/lib/dpkg/info/tastedev-files.list",
        "/var/lib/dpkg/info/tastedev-files:amd64.list",
        "/var/lib/dpkg/info/tastedev-files:arm64.list",
    ] {
        let new_deb = move |p: &Path| p == Path::new(list);
        assert_eq!(
            probe(Os::Linux, "/usr/bin/tastefiles", None, &new_deb),
            InstallKind::Deb,
            "{list}"
        );
    }
    // 다른 제품의 새 이름은 이 제품이 아니다.
    let other = |p: &Path| p == Path::new("/var/lib/dpkg/info/tastedev-ftp.list");
    assert_eq!(
        probe(Os::Linux, "/usr/bin/tastefiles", None, &other),
        InstallKind::Unsupported(Unsupported::Unknown)
    );
    let deb = |p: &Path| p == Path::new("/var/lib/dpkg/info/tastefiles.list");
    assert_eq!(
        probe(Os::Linux, "/usr/bin/tastefiles", None, &deb),
        InstallKind::Deb
    );
    let rpm = |p: &Path| p == Path::new("/usr/bin/rpm");
    assert_eq!(
        probe(Os::Linux, "/usr/bin/tastefiles", None, &rpm),
        InstallKind::Rpm
    );
    assert_eq!(
        probe(Os::Linux, "/home/u/tastefiles/tastefiles", None, &rpm),
        InstallKind::Unsupported(Unsupported::Unknown)
    );
    assert_eq!(
        probe(
            Os::Mac,
            "/Applications/TASTEFILES.app/Contents/MacOS/tastefiles",
            None,
            &none
        ),
        InstallKind::Unsupported(Unsupported::Platform),
        "macOS 는 이번 범위 밖 — 확인 · 안내만"
    );
}

#[test]
fn local_urls_and_trust() {
    assert!(is_local("file:///C:/x/releases.json"));
    assert!(!is_local("https://api.github.com/x"));
    assert_eq!(
        local_path("file:///C:/a%20b/x.json"),
        Some(PathBuf::from("C:/a b/x.json"))
    );
    assert_eq!(
        local_path("file:///home/u/x.json"),
        Some(PathBuf::from("/home/u/x.json"))
    );
    assert_eq!(local_path("https://x"), None);
    let good = format!("{DOWNLOAD_BASE}files-v0.2.0/tastefiles_0.2.0_windows_x64.msi");
    assert!(trusted_url(&good, "files-v0.2.0", false));
    assert!(
        !trusted_url(&good, "files-v0.3.0", false),
        "다른 태그 아래는 믿지 않는다"
    );
    assert!(!trusted_url(
        "https://evil.invalid/x.msi",
        "files-v0.2.0",
        false
    ));
    assert!(
        !trusted_url("file:///C:/x.msi", "files-v0.2.0", false),
        "목록이 원격이면 로컬 파일을 믿지 않는다"
    );
    assert!(trusted_url("file:///C:/x.msi", "files-v0.2.0", true));
}

#[test]
fn install_results_are_read_once() {
    assert_eq!(
        parse_result("ok 0.2.0\n"),
        Some(InstallResult::Ok(Version::new(0, 2, 0)))
    );
    assert_eq!(
        parse_result("\u{feff}ok 0.2.0\r\n"),
        Some(InstallResult::Ok(Version::new(0, 2, 0))),
        "PowerShell BOM"
    );
    assert_eq!(
        parse_result("fail 0.2.0 The operation was canceled by the user."),
        Some(InstallResult::Failed {
            version: Some(Version::new(0, 2, 0)),
            detail: "The operation was canceled by the user.".into()
        })
    );
    assert_eq!(parse_result("garbage"), None);
    let t = Temp::new("result");
    std::fs::write(t.0.join(RESULT_FILE), "fail 0.2.0 exit 126\n").unwrap();
    std::fs::write(t.0.join("tastefiles_0.2.0_windows_x64.msi"), b"x").unwrap();
    std::fs::create_dir_all(t.0.join("stage-0.2.0")).unwrap();
    assert!(matches!(
        take_result(&t.0),
        Some(InstallResult::Failed { .. })
    ));
    assert_eq!(take_result(&t.0), None, "한 번만 읽는다");
    clean_work_dir(&t.0);
    assert_eq!(std::fs::read_dir(&t.0).unwrap().count(), 0);
}

// ───────────────────────────── 흐름(가짜 목록 · 가짜 실행기) ─────────────────────────────

#[test]
fn check_finds_a_newer_version_without_touching_the_network() {
    let fx = fixture("0.2.0", &WIN, None);
    let mut h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).expect("새 판");
    assert_eq!(r.version, Version::new(0, 2, 0));
    assert!(h.session.can_install(&r));
    assert_eq!(
        h.net.0.load(Ordering::Relaxed),
        0,
        "로컬 목록은 네트워크를 쓰지 않는다"
    );
}

#[test]
fn check_reports_nothing_when_up_to_date() {
    let fx = fixture("0.1.1", &WIN, None);
    let mut h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    assert_eq!(check(&mut h), None, "같은 판은 새 판이 아니다");
    // 원격 목록 + 시험(local_only)이면 네트워크를 부르지 않고 실패한다.
    let mut remote = Session::with_parts(
        PRODUCT,
        h.net.clone(),
        h.runner.clone(),
        InstallKind::Msi,
        PathBuf::from("C:/x.exe"),
        h.work.0.clone(),
        RELEASES_URL.into(),
        true,
        "x86_64".into(),
        Arc::new(|_: &Path| false),
    );
    remote.check(noop());
    assert!(matches!(
        wait(&mut remote),
        Event::Checked(Err(UpdateError::Network(_)))
    ));
    assert_eq!(h.net.0.load(Ordering::Relaxed), 0);
}

#[test]
fn download_verifies_size_and_sha256() {
    let fx = fixture("0.2.0", &WIN, None);
    let mut h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).expect("받기");
    assert_eq!(std::fs::read(&file).unwrap(), fx.payload);
    assert_eq!(file.file_name().unwrap(), WIN[1]);
    assert_eq!(
        h.session.progress(),
        (fx.payload.len() as u64, fx.payload.len() as u64)
    );
    assert!(!h.work.0.join(format!("{}.partial", WIN[1])).exists());
    // 다시 받으면 검증된 파일을 그대로 쓴다.
    assert_eq!(download(&mut h, &r).unwrap(), file);
}

#[test]
fn download_rejects_a_hash_mismatch_and_keeps_nothing() {
    let fx = fixture("0.2.0", &WIN, Some(WIN[1]));
    let mut h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).unwrap();
    let err = download(&mut h, &r).unwrap_err();
    assert!(
        matches!(err, UpdateError::Size { .. } | UpdateError::Hash),
        "{err:?}"
    );
    assert_eq!(err.kind(), ErrorKind::Mismatch);
    assert_eq!(
        std::fs::read_dir(&h.work.0).unwrap().count(),
        0,
        "받다 만 파일을 남기지 않는다"
    );
}

#[test]
fn download_failure_is_reported() {
    let fx = fixture("0.2.0", &WIN, None);
    std::fs::remove_file(fx.dir.0.join(WIN[1])).unwrap();
    let mut h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).unwrap();
    let err = download(&mut h, &r).unwrap_err();
    assert!(matches!(err, UpdateError::Network(_)), "{err:?}");
    assert_eq!(err.kind(), ErrorKind::Download);
    // 맞는 파일이 없는 설치 방식.
    let mut h = harness(&fx, InstallKind::Deb, "/usr/bin/tastefiles", &[]);
    let r = check(&mut h).unwrap();
    assert!(!h.session.can_install(&r));
    assert_eq!(download(&mut h, &r), Err(UpdateError::NoAsset));
}

#[test]
fn windows_nsis_install_now_waits_for_the_app_then_runs_setup_silently_and_relaunches() {
    let fx = fixture("0.2.0", &WIN, None);
    let dir = "C:/Program Files/TASTE FILES";
    let mut h = harness(
        &fx,
        InstallKind::Nsis { dir: dir.into() },
        "C:/Program Files/TASTE FILES/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    assert_eq!(
        h.session.install_now(&r, &file, noop()),
        Ok(Started::QuitToInstall)
    );
    let lines = h.runner.lines();
    assert_eq!(lines.len(), 1);
    let script = h.work.0.join("install-0.2.0.ps1");
    assert_eq!(
        lines[0],
        format!(
            "spawn powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File {}",
            script.display()
        )
    );
    let body = std::fs::read_to_string(&script).unwrap();
    assert!(body.starts_with('\u{feff}'), "PowerShell 5.1 용 BOM");
    assert!(body.contains(&format!("Wait-Process -Id {} ", std::process::id())));
    assert!(body.contains(&format!(
        "Start-Process -FilePath {} -ArgumentList '/S /NS /D=C:/Program Files/TASTE FILES' -Verb RunAs -Wait -PassThru",
        powershell_quote(&file.to_string_lossy())
    )));
    assert!(
        body.contains("Start-Process -FilePath 'C:/Program Files/TASTE FILES/tastefiles.exe'"),
        "다시 켠다"
    );
    assert!(body.contains(&powershell_quote(
        &h.work.0.join(RESULT_FILE).to_string_lossy()
    )));
    assert!(body.contains("'fail 0.2.0 '"));
}

#[test]
fn windows_msi_install_now_runs_msiexec_after_the_app_exits() {
    let fx = fixture("0.2.0", &WIN, None);
    let mut h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    assert_eq!(
        h.session.install_now(&r, &file, noop()),
        Ok(Started::QuitToInstall)
    );
    assert_eq!(
        h.runner.lines().len(),
        1,
        "스크립트 하나만 띄운다(설치 프로그램은 앱이 끝난 뒤)"
    );
    let body = std::fs::read_to_string(h.work.0.join("install-0.2.0.ps1")).unwrap();
    assert!(body.contains(&format!(
        "-FilePath 'msiexec.exe' -ArgumentList '/i \"{}\" /qb! /norestart' -Verb RunAs",
        file.display()
    )));
    assert!(body.contains("-ne 3010"), "3010(다시 부팅 필요)도 성공");
    assert!(body.contains("Start-Process -FilePath 'C:/Program Files/TASTEFILES/tastefiles.exe'"));
}

#[test]
fn windows_zip_replaces_files_with_rollback() {
    let fx = fixture("0.2.0", &WIN, None);
    let dir = "D:/tools/it's files";
    let mut h = harness(
        &fx,
        InstallKind::Portable { dir: dir.into() },
        "D:/tools/it's files/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    assert_eq!(file.file_name().unwrap(), WIN[2]);
    let Step::AfterExit { body, .. } = h.session.plan(&r, &file).unwrap() else {
        panic!("스크립트");
    };
    assert!(
        body.contains("$dest = 'D:/tools/it''s files'"),
        "작은따옴표를 겹쳐 쓴다"
    );
    assert!(body.contains("Expand-Archive -LiteralPath"));
    assert!(
        body.contains("Copy-Item -LiteralPath $b -Destination $t -Force"),
        "실패하면 되돌린다"
    );
    assert!(body.contains("Start-Process -FilePath 'D:/tools/it''s files/tastefiles.exe'"));
}

#[test]
fn linux_deb_install_now_asks_pkexec_once_then_relaunches() {
    let fx = fixture("0.2.0", &LINUX, None);
    let mut h = harness(
        &fx,
        InstallKind::Deb,
        "/usr/bin/tastefiles",
        &["/usr/bin/pkexec", "/usr/bin/apt-get"],
    );
    *h.runner.code.lock().unwrap() = Some(0);
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    assert_eq!(
        h.session.install_now(&r, &file, noop()),
        Ok(Started::Background)
    );
    assert_eq!(wait(&mut h.session), Event::Installed(Ok(r.clone())));
    h.session.relaunch().unwrap();
    assert_eq!(
        h.runner.lines(),
        vec![
            format!("run pkexec apt-get install -y {}", file.display()),
            "relaunch /usr/bin/tastefiles".to_owned()
        ]
    );
}

#[test]
fn linux_deb_install_takes_the_new_release_file_name() {
    // 다음 판부터의 Linux 이름 꼴만 있는 릴리스에서도 받아서 설치한다.
    let fx = fixture(
        "0.2.0",
        &[
            "tastedev-files-0.2.0-linux-x86_64.deb",
            "tastedev-files-0.2.0-linux-x86_64.rpm",
            "tastedev-files-0.2.0-linux-x86_64.AppImage",
            "tastedev-files-0.2.0-linux-x86_64.tar.gz",
        ],
        None,
    );
    let mut h = harness(
        &fx,
        InstallKind::Deb,
        "/usr/bin/tastefiles",
        &["/usr/bin/pkexec", "/usr/bin/apt-get"],
    );
    *h.runner.code.lock().unwrap() = Some(0);
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    assert!(
        file.to_string_lossy()
            .ends_with("tastedev-files-0.2.0-linux-x86_64.deb"),
        "{}",
        file.display()
    );
    assert_eq!(
        h.session.install_now(&r, &file, noop()),
        Ok(Started::Background)
    );
    assert_eq!(wait(&mut h.session), Event::Installed(Ok(r.clone())));
    assert_eq!(
        h.runner.lines(),
        vec![format!("run pkexec apt-get install -y {}", file.display())]
    );
}

#[test]
fn linux_deb_without_apt_uses_dpkg_and_denial_offers_the_file() {
    let fx = fixture("0.2.0", &LINUX, None);
    let mut h = harness(
        &fx,
        InstallKind::Deb,
        "/usr/bin/tastefiles",
        &["/usr/bin/pkexec"],
    );
    *h.runner.code.lock().unwrap() = Some(126);
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    h.session.install_now(&r, &file, noop()).unwrap();
    let Event::Installed(Err(e)) = wait(&mut h.session) else {
        panic!("거절");
    };
    assert_eq!(e.kind(), ErrorKind::Denied);
    assert!(e.offers_file(), "거절되면 내려받은 파일 열기로 안내");
    assert_eq!(
        h.runner.lines(),
        vec![format!("run pkexec dpkg -i {}", file.display())]
    );
    h.session.open_file(&file).unwrap();
    assert_eq!(h.runner.lines()[1], format!("open {}", file.display()));
}

#[test]
fn linux_without_pkexec_is_denied_before_running_anything() {
    let fx = fixture("0.2.0", &LINUX, None);
    let mut h = harness(&fx, InstallKind::Rpm, "/usr/bin/tastefiles", &[]);
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    let err = h.session.install_now(&r, &file, noop()).unwrap_err();
    assert!(matches!(err, UpdateError::Denied(_)));
    assert!(h.runner.lines().is_empty());
    // pkexec 가 있으면 dnf → 없으면 rpm -U.
    let ctx_has = |has: &'static [&'static str]| {
        let h2 = harness(&fx, InstallKind::Rpm, "/usr/bin/tastefiles", has);
        h2.session.plan(&r, &file).unwrap()
    };
    assert_eq!(
        ctx_has(&["/usr/bin/pkexec", "/usr/bin/dnf"]),
        Step::Elevated {
            program: "pkexec".into(),
            args: vec![
                "dnf".into(),
                "install".into(),
                "-y".into(),
                file.to_string_lossy().into()
            ]
        }
    );
    assert_eq!(
        ctx_has(&["/usr/bin/pkexec"]),
        Step::Elevated {
            program: "pkexec".into(),
            args: vec!["rpm".into(), "-U".into(), file.to_string_lossy().into()]
        }
    );
}

#[test]
fn linux_appimage_is_swapped_then_relaunched() {
    let fx = fixture("0.2.0", &LINUX, None);
    let app = "/home/u/Apps/TASTEFILES.AppImage";
    let mut h = harness(
        &fx,
        InstallKind::AppImage { path: app.into() },
        "/tmp/.mount/usr/bin/tastefiles",
        &[],
    );
    *h.runner.code.lock().unwrap() = Some(0);
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    assert!(file.to_string_lossy().ends_with(".AppImage"));
    h.session.install_now(&r, &file, noop()).unwrap();
    assert_eq!(wait(&mut h.session), Event::Installed(Ok(r.clone())));
    assert_eq!(
        h.runner.lines(),
        vec![format!("replace {} -> {app}", file.display())]
    );
    h.session.relaunch().unwrap();
    assert_eq!(
        h.runner.lines()[1],
        "relaunch /tmp/.mount/usr/bin/tastefiles"
    );
}

#[test]
fn unsupported_installs_only_guide_to_the_page() {
    let fx = fixture("0.2.0", &WIN, None);
    let mut h = harness(
        &fx,
        InstallKind::Unsupported(Unsupported::Platform),
        "/Applications/TASTEFILES.app/Contents/MacOS/tastefiles",
        &[],
    );
    let r = check(&mut h).unwrap();
    assert!(!h.session.can_install(&r));
    assert_eq!(
        h.session.plan(&r, Path::new("/x")),
        Err(UpdateError::Unsupported)
    );
    h.session.open_page(&r.page).unwrap();
    assert!(h.session.open_page("javascript:alert(1)").is_err());
    assert_eq!(h.runner.lines(), vec![format!("open {}", r.page)]);
}

#[test]
fn a_failed_install_leaves_a_result_for_the_next_start() {
    let fx = fixture("0.2.0", &WIN, None);
    let h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    std::fs::write(
        h.work.0.join(RESULT_FILE),
        "\u{feff}fail 0.2.0 The operation was canceled by the user.\r\n",
    )
    .unwrap();
    std::fs::write(h.work.0.join("install-0.2.0.ps1"), "x").unwrap();
    let got = h.session.take_last_result();
    assert_eq!(
        got,
        Some(InstallResult::Failed {
            version: Some(Version::new(0, 2, 0)),
            detail: "The operation was canceled by the user.".into()
        })
    );
    assert_eq!(
        std::fs::read_dir(&h.work.0).unwrap().count(),
        0,
        "스크립트 · 받은 파일을 치운다"
    );
}

#[test]
fn capture_kind_override_names() {
    let exe = Path::new("D:/src/target/debug/tastefiles.exe");
    assert_eq!(kind_from_name("msi", exe), Some(InstallKind::Msi));
    assert_eq!(
        kind_from_name("NSIS", exe),
        Some(InstallKind::Nsis {
            dir: PathBuf::from("D:/src/target/debug")
        })
    );
    assert_eq!(kind_from_name("deb", exe), Some(InstallKind::Deb));
    assert_eq!(kind_from_name("nope", exe), None);
    // 캡처용 실행기는 아무것도 띄우지 않는다.
    assert_eq!(DryRunner.run("pkexec", &[]).unwrap(), 0);
}

// ───────────────────────────── 켤 때 묻기 흐름 ─────────────────────────────

fn flow_with(h: Harness) -> (Flow, Arc<Recorder>, Arc<NoNetwork>, Temp) {
    let Harness {
        session,
        runner,
        net,
        work,
    } = h;
    let flow = Flow::start(true, move || session, noop());
    (flow, runner, net, work)
}

fn pump(flow: &mut Flow, until: impl Fn(&Flow) -> bool) {
    let start = Instant::now();
    while !until(flow) {
        flow.poll(&noop());
        assert!(
            start.elapsed() < Duration::from_secs(20),
            "시간 초과: {:?}",
            flow.stage()
        );
        std::thread::sleep(Duration::from_millis(5));
    }
}

#[test]
fn flow_off_makes_no_request_and_never_asks() {
    let made = AtomicUsize::new(0);
    let mut flow = Flow::start(
        false,
        || {
            made.fetch_add(1, Ordering::Relaxed);
            unreachable!("꺼져 있으면 세션을 만들지 않는다")
        },
        noop(),
    );
    assert_eq!(made.load(Ordering::Relaxed), 0);
    assert!(flow.session().is_none());
    assert_eq!(flow.poll(&noop()), None);
    assert!(!flow.showing());
}

#[test]
fn flow_on_asks_once_and_later_does_not_ask_again() {
    let fx = fixture("0.2.0", &WIN, None);
    let h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let (mut flow, runner, net, _work) = flow_with(h);
    pump(&mut flow, Flow::showing);
    let Stage::Ask(r) = flow.stage().clone() else {
        panic!("묻기");
    };
    assert_eq!(r.version, Version::new(0, 2, 0));
    assert!(flow.can_install(&r));
    assert_eq!(
        Flow::notes(&r),
        "바뀐 점\n• 켤 때 새 버전 설치\n• 빠른 목록"
    );
    flow.later();
    assert!(!flow.showing());
    assert_eq!(flow.poll(&noop()), None);
    assert!(
        !flow.showing(),
        "나중에 뒤 이번 실행에서는 다시 묻지 않는다"
    );
    assert!(runner.lines().is_empty());
    assert_eq!(net.0.load(Ordering::Relaxed), 0);
}

#[test]
fn flow_install_now_on_windows_writes_the_script_and_quits() {
    let fx = fixture("0.2.0", &WIN, None);
    let h = harness(
        &fx,
        InstallKind::Nsis {
            dir: "C:/Program Files/TASTEFILES".into(),
        },
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let (mut flow, runner, _net, work) = flow_with(h);
    pump(&mut flow, Flow::showing);
    flow.install(&noop());
    assert!(matches!(flow.stage(), Stage::Downloading(_)));
    pump(&mut flow, |f| matches!(f.stage(), Stage::Installing(_)));
    assert!(flow.take_quit(), "Windows 는 앱을 닫아야 설치가 시작된다");
    assert!(!flow.take_quit());
    assert_eq!(runner.lines().len(), 1);
    assert!(runner.lines()[0].starts_with("spawn powershell.exe "));
    let body = std::fs::read_to_string(work.0.join("install-0.2.0.ps1")).unwrap();
    assert!(body.contains("-ArgumentList '/S /NS /D=C:/Program Files/TASTEFILES' -Verb RunAs"));
}

#[test]
fn flow_hash_mismatch_fails_without_installing() {
    let fx = fixture("0.2.0", &WIN, Some(WIN[1]));
    let h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let (mut flow, runner, _net, _work) = flow_with(h);
    pump(&mut flow, Flow::showing);
    flow.install(&noop());
    pump(&mut flow, |f| matches!(f.stage(), Stage::Failed { .. }));
    let Stage::Failed { error, file, .. } = flow.stage().clone() else {
        unreachable!()
    };
    assert_eq!(error.kind(), ErrorKind::Mismatch);
    assert_eq!(file, None);
    assert!(
        runner.lines().is_empty(),
        "검증에 실패하면 아무것도 돌리지 않는다"
    );
    flow.later();
    assert!(!flow.showing());
}

#[test]
fn flow_linux_denied_offers_the_downloaded_file() {
    let fx = fixture("0.2.0", &LINUX, None);
    let h = harness(
        &fx,
        InstallKind::Deb,
        "/usr/bin/tastefiles",
        &["/usr/bin/pkexec", "/usr/bin/apt-get"],
    );
    *h.runner.code.lock().unwrap() = Some(126);
    let (mut flow, runner, _net, _work) = flow_with(h);
    pump(&mut flow, Flow::showing);
    flow.install(&noop());
    pump(&mut flow, |f| matches!(f.stage(), Stage::Failed { .. }));
    let Stage::Failed { error, file, .. } = flow.stage().clone() else {
        unreachable!()
    };
    assert_eq!(error.kind(), ErrorKind::Denied);
    let file = file.expect("받은 파일");
    flow.open_file();
    assert_eq!(runner.lines()[1], format!("open {}", file.display()));
    assert!(!flow.take_quit());
}

#[test]
fn flow_linux_success_relaunches_and_quits() {
    let fx = fixture("0.2.0", &LINUX, None);
    let h = harness(
        &fx,
        InstallKind::Deb,
        "/usr/bin/tastefiles",
        &["/usr/bin/pkexec", "/usr/bin/apt-get"],
    );
    *h.runner.code.lock().unwrap() = Some(0);
    let (mut flow, runner, _net, _work) = flow_with(h);
    pump(&mut flow, Flow::showing);
    flow.install(&noop());
    pump(&mut flow, |f| !f.showing());
    assert!(flow.take_quit());
    assert_eq!(
        runner.lines().last().unwrap(),
        "relaunch /usr/bin/tastefiles"
    );
}

#[test]
fn flow_cannot_install_opens_the_page_instead() {
    let fx = fixture("0.2.0", &WIN, None);
    let h = harness(
        &fx,
        InstallKind::Unsupported(Unsupported::Development),
        "D:/src/target/debug/tastefiles.exe",
        &[],
    );
    let (mut flow, runner, _net, _work) = flow_with(h);
    pump(&mut flow, Flow::showing);
    flow.install(&noop());
    assert!(!flow.showing());
    assert_eq!(
        runner.lines(),
        vec![
            "open https://github.com/whitecalvin/tastedev-releases/releases/tag/files-v0.2.0"
                .to_owned()
        ]
    );
}

#[test]
fn sha256_block_and_padding_boundaries_match_independent_vectors() {
    // .NET SHA256 독립 결과: 완전 블록/잔여 조각/두 블록 패딩의 경계를 확인한다.
    let vectors = [
        (
            0,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        ),
        (
            1,
            "6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d",
        ),
        (
            55,
            "463eb28e72f82e0a96c0a4cc53690c571281131f672aa229e0d45ae59b598b59",
        ),
        (
            56,
            "da2ae4d6b36748f2a318f23e7ab1dfdf45acdc9d049bd80e59de82a60895f562",
        ),
        (
            63,
            "29af2686fd53374a36b0846694cc342177e428d1647515f078784d69cdb9e488",
        ),
        (
            64,
            "fdeab9acf3710362bd2658cdc9a29e8f9c757fcf9811603a8c447cd1d9151108",
        ),
        (
            65,
            "4bfd2c8b6f1eec7a2afeb48b934ee4b2694182027e6d0fc075074f2fabb31781",
        ),
        (
            127,
            "92ca0fa6651ee2f97b884b7246a562fa71250fedefe5ebf270d31c546bfea976",
        ),
        (
            128,
            "471fb943aa23c511f6f72f8d1652d9c880cfa392ad80503120547703e56a2be5",
        ),
        (
            129,
            "5099c6a56203f9687f7d33f4bfdf576d31dc91f6b695ecea38b2770c87631135",
        ),
        (
            4096,
            "d67c656e01756650d77717b0839985a056ec28ffe174601d690fc407a2ceffca",
        ),
    ];
    for (len, expected) in vectors {
        let data: Vec<u8> = (0..len).map(|n| (n % 251) as u8).collect();
        assert_eq!(sha256::digest_hex(&data), expected, "length {len}");
        for size in [1, 7, 37, 63, 64, 65, 128, 4096] {
            let mut hash = sha256::Sha256::new();
            for chunk in data.chunks(size) {
                hash.update(chunk);
                hash.update(&[]);
            }
            assert_eq!(hash.finish_hex(), expected, "length {len}, chunk {size}");
        }
    }
    assert_eq!(
        sha256::digest_hex(&vec![b'a'; 1_000_000]),
        "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0"
    );
}

#[test]
fn sha256_reader_retries_interrupts_but_preserves_real_errors() {
    use std::io::{self, Read};
    struct Interrupted {
        data: io::Cursor<Vec<u8>>,
        interrupt: bool,
    }
    impl Read for Interrupted {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            self.interrupt = !self.interrupt;
            if self.interrupt {
                return Err(io::ErrorKind::Interrupted.into());
            }
            let len = buffer.len().min(3);
            self.data.read(&mut buffer[..len])
        }
    }
    let reader = Interrupted {
        data: io::Cursor::new(b"abc".to_vec()),
        interrupt: false,
    };
    assert_eq!(
        sha256::read_hex(reader).unwrap(),
        (
            3,
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad".into()
        )
    );
    struct Denied;
    impl Read for Denied {
        fn read(&mut self, _: &mut [u8]) -> io::Result<usize> {
            Err(io::ErrorKind::PermissionDenied.into())
        }
    }
    assert_eq!(
        sha256::read_hex(Denied).unwrap_err().kind(),
        io::ErrorKind::PermissionDenied
    );
}
