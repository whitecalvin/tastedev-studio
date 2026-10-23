//! 가짜 사이트 답(로컬 파일 · 가짜 전송 [`testing::FakeSite`])으로 시험한다. 네트워크에 가지 않고, 설치 프로그램을 실제로 돌리지 않는다
//! (가짜 [`Runner`] 가 명령만 기록한다).

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::{Duration, Instant};

use crate::sha256;
use crate::*;

const PRODUCT: Product = Product {
    name: "TASTEFILES",
    tag_prefix: "files-v",
    package: "tastefiles",
    version: "0.1.1",
};

#[test]
fn renamed_windows_packages_match_without_accepting_neighbor_products() {
    let kinds = [
        (
            InstallKind::Nsis {
                dir: PathBuf::new(),
            },
            "-setup.exe",
        ),
        (InstallKind::Msi, ".msi"),
        (
            InstallKind::Portable {
                dir: PathBuf::new(),
            },
            ".zip",
        ),
    ];
    for (kind, suffix) in kinds {
        let name = format!("tastedev-files_0.2.1_windows_x64{suffix}");
        assert!(asset_name_matches(&name, "tastefiles", &kind, "x86_64"));
        assert!(asset_name_matches(&name, "tastedev-files", &kind, "x86_64"));
        assert!(!asset_name_matches(
            &format!("tastedev-files-cli_0.2.1_windows_x64{suffix}"),
            "tastefiles",
            &kind,
            "x86_64"
        ));
        assert!(!asset_name_matches(
            &format!("tastedev-ftp_0.2.1_windows_x64{suffix}"),
            "tastefiles",
            &kind,
            "x86_64"
        ));
    }
}

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
    assert_eq!(r.page, "https://tastedev.net/products/files");
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
    assert!(
        manual_kinds(Os::Windows)
            .iter()
            .all(|k| !matches!(k, InstallKind::Portable { .. }))
    );
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
    assert!(!is_local("https://tastedev.net/api/updates/files"));
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
        site_updates_url(PRODUCT.tag_prefix).unwrap(),
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
    // 설치 프로그램이 "다른 앱 창이 열려 있음"(종료 코드 10)으로 멈추면 "앱이 끝나지 않았음" 알림으로 간다.
    assert!(body.contains(&format!(
        "if ($p.ExitCode -eq {}) {{ throw '{} (another window is open)' }}",
        crate::plan::NSIS_APP_RUNNING_EXIT,
        crate::APP_STILL_RUNNING
    )));
    // 앱이 관리자 권한으로 떠 있어도 기다린다: Wait-Process(접근 거부로 곧바로 돌아옴)가 아니라 0.5초마다 폴링.
    assert!(
        !body.contains("Wait-Process"),
        "권한에 따라 곧바로 돌아오는 Wait-Process 를 쓰지 않는다"
    );
    assert!(body.contains("Get-Process -Name $name"));
    assert!(
        body.contains("[IO.Path]::GetFullPath($path), [IO.Path]::GetFullPath($app)"),
        "같은 이름의 다른 설치본은 종료 대상으로 보지 않는다"
    );
    assert!(body.contains("Start-Sleep -Milliseconds 500"));
    assert!(body.contains("$deadline = (Get-Date).AddSeconds(600)"));
    // 시작하자마자 `started`, 단계마다 기록, 설치 뒤 실행 파일이 바뀌었는지 본다.
    let started = body.find("'started 0.2.0 '").expect("started");
    let waits = body.find("    Wait-AppInstances").unwrap();
    assert!(started < waits, "기다리기 전에 시작 기록");
    assert!(body.contains(&powershell_quote(
        &h.work.0.join(LOG_FILE).to_string_lossy()
    )));
    assert!(body.contains("Write-Log ('installer exit code ' + $p.ExitCode)"));
    let runs = body.find("-Verb RunAs").unwrap();
    let replaced = body.find("Assert-Replaced $before").unwrap();
    assert!(
        runs < replaced,
        "설치 프로그램 뒤에 실행 파일이 바뀌었는지 본다"
    );
    // 앱은 띄우기 전에 `pending` 을 남긴다(스크립트가 돌지 못하면 다음 실행이 안다).
    assert_eq!(
        std::fs::read_to_string(h.work.0.join(RESULT_FILE)).unwrap(),
        "pending 0.2.0\n"
    );
    assert!(body.contains(&format!(
        "Start-Process -FilePath {} -ArgumentList '/S /NS /D=C:/Program Files/TASTE FILES' -Verb RunAs -Wait -PassThru",
        powershell_quote(&file.to_string_lossy())
    )));
    assert!(
        body.contains("Restart-App -Executable 'C:/Program Files/TASTE FILES/tastefiles.exe'"),
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
        "-FilePath 'msiexec.exe' -ArgumentList '/i \"{}\" /qb! /norestart MSIRESTARTMANAGERCONTROL=Disable' -Verb RunAs",
        file.display()
    )));
    assert!(body.contains("-ne 3010"), "3010(다시 부팅 필요)도 성공");
    assert!(body.contains("Restart-App -Executable 'C:/Program Files/TASTEFILES/tastefiles.exe'"));
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
    assert!(body.contains("Restart-App -Executable 'D:/tools/it''s files/tastefiles.exe'"));
}

/// 설치 프로그램은 GXSOFT 서명을 확인한 **다음에만** 돈다. 크기 · SHA-256 은 같은 릴리스 응답에서 오므로
/// 깨진 것만 막는다 — 릴리스 쪽이 바꿔치기되면 서명이 막는다.
#[test]
fn windows_installers_are_checked_for_the_gxsoft_signature_before_running() {
    for kind in [
        InstallKind::Nsis {
            dir: "C:/Program Files/TASTEFILES".into(),
        },
        InstallKind::Msi,
    ] {
        let fx = fixture("0.2.0", &WIN, None);
        let mut h = harness(
            &fx,
            kind.clone(),
            "C:/Program Files/TASTEFILES/tastefiles.exe",
            &[],
        );
        let r = check(&mut h).unwrap();
        let file = download(&mut h, &r).unwrap();
        let Step::AfterExit { body, .. } = h.session.plan(&r, &file).unwrap() else {
            panic!("스크립트");
        };
        assert!(
            body.contains(&powershell_quote(WINDOWS_SIGNER)),
            "{kind:?}: 서명자"
        );
        assert!(
            body.contains("TimeStamperCertificate"),
            "{kind:?}: 타임스탬프"
        );
        let checked = body
            .find(&format!(
                "Assert-Signed {}",
                powershell_quote(&file.to_string_lossy())
            ))
            .unwrap_or_else(|| panic!("{kind:?}: 설치 파일 서명을 보지 않는다"));
        let runs = body.find("-Verb RunAs").unwrap();
        assert!(checked < runs, "{kind:?}: 서명 확인이 실행보다 먼저");
    }
}

/// zip 은 풀어 놓은 실행 파일마다 서명을 보고, 그다음에 바꾼다. 실행 파일이 하나도 없어도 멈춘다.
/// Windows 설치 스크립트 셋(NSIS · MSI · zip)을 만든다.
fn windows_scripts() -> Vec<(String, String)> {
    let kinds = [
        (
            "nsis",
            InstallKind::Nsis {
                dir: "C:/Program Files/TASTEFILES".into(),
            },
        ),
        ("msi", InstallKind::Msi),
        (
            "zip",
            InstallKind::Portable {
                dir: "D:/tools/it's files".into(),
            },
        ),
    ];
    kinds
        .into_iter()
        .map(|(name, kind)| {
            let fx = fixture("0.2.0", &WIN, None);
            let mut h = harness(&fx, kind, "C:/Program Files/TASTEFILES/tastefiles.exe", &[]);
            let r = check(&mut h).unwrap();
            let file = download(&mut h, &r).unwrap();
            let Step::AfterExit { body, .. } = h.session.plan(&r, &file).unwrap() else {
                panic!("스크립트");
            };
            (name.to_owned(), body)
        })
        .collect()
}

/// 설치가 실패하면(서명 · 설치 프로그램 · 교체) 옛 판을 다시 켠다 — 앱이 이미 끝난 뒤의 실패일 때만.
/// 앱이 아직 떠 있어 실패한 것이면 켜지 않는다(두 개가 뜬다).
#[test]
fn a_failed_install_relaunches_the_old_app_only_after_it_exited() {
    for (name, body) in windows_scripts() {
        let exited = body
            .find("$exited = $true")
            .unwrap_or_else(|| panic!("{name}"));
        let still_running = body.find("    Wait-AppInstances").unwrap();
        assert!(still_running < exited, "{name}: 끝난 것을 확인한 뒤에 표시");
        // 바깥(줄 맨 앞) catch 부터 끝까지.
        let catch = body.find("\n} catch {").unwrap();
        let tail = &body[catch..];
        assert!(tail.contains("if ($exited)"), "{name}");
        assert!(
            tail.contains("Restart-App -Executable 'C:/Program Files/TASTEFILES/tastefiles.exe'"),
            "{name}: 실패해도 옛 판을 다시 켠다"
        );
    }
}

#[test]
fn windows_restart_is_observed_without_reclassifying_install_success() {
    for (name, body) in windows_scripts() {
        assert!(body.contains(include_str!("windows_restart.ps1")), "{name}");
        assert!(body.contains("-WorkingDirectory $workingDirectory -WindowStyle Normal -PassThru"));
        let installed = body.find("Write-Log 'installed ").unwrap();
        let restart = body[installed..].find("Restart-App -Executable").unwrap();
        assert!(body[installed..installed + restart].contains("$installLock.Dispose()"));
        // Restart-App catches its own error; a successful installation must not
        // become an install failure or trigger the recovery relaunch a second time.
        assert!(body.contains("Write-Log ('restart failed: '"));
        assert!(body.contains("restart confirmed: pid="));
    }
}

/// 만든 스크립트가 PowerShell 문법으로 맞는지 실제 PowerShell 파서로 본다(실행하지 않는다).
#[cfg(windows)]
#[test]
fn the_install_scripts_parse_in_windows_powershell() {
    let tmp = Temp::new("parse");
    for (name, body) in windows_scripts() {
        let script = tmp.0.join(format!("{name}.ps1"));
        std::fs::write(&script, format!("\u{feff}{body}")).unwrap();
        let check = tmp.0.join(format!("check-{name}.ps1"));
        std::fs::write(
            &check,
            format!(
                "$errors = $null\n[void][System.Management.Automation.Language.Parser]::ParseFile({}, [ref]$null, [ref]$errors)\nif ($errors.Count -gt 0) {{ $errors | ForEach-Object {{ $_.Message }} }} else {{ 'parsed' }}\n",
                powershell_quote(&script.to_string_lossy())
            ),
        )
        .unwrap();
        let out = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&check)
            .output()
            .unwrap();
        let text = String::from_utf8_lossy(&out.stdout);
        assert_eq!(text.trim(), "parsed", "{name}: {text}\n{body}");
    }
}

#[test]
fn windows_zip_checks_every_program_before_replacing() {
    let fx = fixture("0.2.0", &WIN, None);
    let mut h = harness(
        &fx,
        InstallKind::Portable {
            dir: "D:/tools/files".into(),
        },
        "D:/tools/files/tastefiles.exe",
        &[],
    );
    let r = check(&mut h).unwrap();
    let file = download(&mut h, &r).unwrap();
    let Step::AfterExit { body, .. } = h.session.plan(&r, &file).unwrap() else {
        panic!("스크립트");
    };
    let checked = body
        .find("foreach ($e in $exes) { Assert-Signed $e.FullName }")
        .unwrap();
    let replaced = body.find("Copy-Item -LiteralPath $f.FullName").unwrap();
    assert!(checked < replaced, "서명 확인이 교체보다 먼저");
    assert!(body.contains("throw 'no program in the update'"));
}

/// 스크립트의 서명 확인 함수를 실제 PowerShell 로 돌린다: 서명 없는 파일과 다른 회사(Microsoft) 서명은 모두 거절.
/// GXSOFT 서명 파일로 통과하는 쪽은 출시 도구가 같은 조건으로 확인한다(`Test-WindowsSignedBinaries`).
#[cfg(windows)]
#[test]
fn the_signature_check_rejects_unsigned_and_foreign_programs() {
    let tmp = Temp::new("sigcheck");
    let unsigned = tmp.0.join("unsigned.exe");
    std::fs::write(&unsigned, b"MZ not really a program").unwrap();
    let windir = std::env::var("WINDIR").unwrap_or_else(|_| "C:\\Windows".into());
    let foreign = PathBuf::from(windir).join("System32").join("notepad.exe");

    let mut targets = vec![unsigned];
    if foreign.is_file() {
        targets.push(foreign);
    }
    for target in targets {
        let script = tmp.0.join("check.ps1");
        let body = format!(
            "\u{feff}$ErrorActionPreference = 'Stop'\n{}try {{ Assert-Signed {}; 'accepted' }} catch {{ 'rejected: ' + $_.Exception.Message }}\n",
            crate::plan::signature_check(),
            powershell_quote(&target.to_string_lossy()),
        );
        std::fs::write(&script, body).unwrap();
        let out = std::process::Command::new("powershell.exe")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
            ])
            .arg(&script)
            .output()
            .unwrap();
        let text = String::from_utf8_lossy(&out.stdout);
        assert!(
            text.contains("rejected: signature not trusted"),
            "{}: {text} {}",
            target.display(),
            String::from_utf8_lossy(&out.stderr)
        );
    }
}

/// 통과 쪽: 실제 GXSOFT 서명 파일(출시 도구가 만든 설치 파일 · 실행 파일)을 `TASTEDEV_SIGNED_SAMPLE` 로 주고
/// `cargo test -- --ignored signed_gxsoft` 로 돌린다. 서명 파일이 저장소에 없어 평소엔 건너뛴다.
#[cfg(windows)]
#[test]
#[ignore = "TASTEDEV_SIGNED_SAMPLE 에 GXSOFT 서명 파일 경로가 있어야 한다"]
fn the_signature_check_accepts_a_signed_gxsoft_program() {
    let sample =
        PathBuf::from(std::env::var("TASTEDEV_SIGNED_SAMPLE").expect("TASTEDEV_SIGNED_SAMPLE"));
    let tmp = Temp::new("sigok");
    let script = tmp.0.join("check.ps1");
    let body = format!(
        "\u{feff}$ErrorActionPreference = 'Stop'\n{}try {{ Assert-Signed {}; 'accepted' }} catch {{ 'rejected: ' + $_.Exception.Message }}\n",
        crate::plan::signature_check(),
        powershell_quote(&sample.to_string_lossy()),
    );
    std::fs::write(&script, body).unwrap();
    let out = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(&script)
        .output()
        .unwrap();
    let text = String::from_utf8_lossy(&out.stdout);
    assert!(text.contains("accepted"), "{}: {text}", sample.display());
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
        "relaunch /home/u/Apps/TASTEFILES.AppImage"
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
        std::fs::read_dir(&h.work.0)
            .unwrap()
            .filter(|e| e.as_ref().unwrap().file_name() != ".update-install.lock")
            .count(),
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
    let made = Arc::new(AtomicUsize::new(0));
    let counter = Arc::clone(&made);
    let mut flow = Flow::start(
        false,
        move || {
            counter.fetch_add(1, Ordering::Relaxed);
            unreachable!("꺼져 있으면 세션을 만들지 않는다")
        },
        noop(),
    );
    assert_eq!(made.load(Ordering::Relaxed), 0);
    assert!(flow.session().is_none());
    assert_eq!(flow.poll(&noop()), None);
    // 며칠이 지나도 스스로는 확인하지 않는다.
    let later = Instant::now() + AUTO_CHECK_INTERVAL * 3;
    assert_eq!(flow.poll_at(later, &noop()), None);
    assert!(flow.session().is_none() && !flow.showing());
    assert_eq!(flow.status(), Status::Unchecked);
    assert_eq!(flow.next_check(later), None);
}

// ───────────────────────────── 자동 확인 주기 ─────────────────────────────

/// 다섯 제품이 같은 주기 하나(24시간)를 쓴다.
#[test]
fn auto_check_interval_is_one_day() {
    assert_eq!(AUTO_CHECK_INTERVAL_SECS, 86_400);
    assert_eq!(AUTO_CHECK_INTERVAL, Duration::from_secs(86_400));
}

#[test]
fn schedule_is_due_at_start_then_every_24_hours_only_when_auto() {
    let t0 = Instant::now();
    let mut s = Schedule::new();
    assert!(s.due(true, t0), "아직 확인하지 않았으면 곧바로");
    assert!(!s.due(false, t0), "꺼져 있으면 언제나 아님");
    assert_eq!(s.wait(true, t0), Some(Duration::ZERO));
    assert_eq!(s.wait(false, t0), None);
    s.checked(t0);
    assert_eq!(s.last(), Some(t0));
    let almost = t0 + AUTO_CHECK_INTERVAL - Duration::from_secs(1);
    assert!(!s.due(true, almost));
    assert_eq!(s.wait(true, almost), Some(Duration::from_secs(1)));
    assert!(s.due(true, t0 + AUTO_CHECK_INTERVAL));
    assert!(!s.due(false, t0 + AUTO_CHECK_INTERVAL * 2));
    assert_eq!(
        s.wait(true, t0 + AUTO_CHECK_INTERVAL * 2),
        Some(Duration::ZERO)
    );
    // 시계가 뒤로 가도 차례로 치지 않는다.
    s.checked(t0 + AUTO_CHECK_INTERVAL);
    assert!(!s.due(true, t0));
}

/// 끝난 확인 하나를 기다린다(`now` 때로).
fn pump_checked(flow: &mut Flow, now: Instant) -> Checked {
    let start = Instant::now();
    loop {
        if let Some(c) = flow.poll_at(now, &noop()) {
            return c;
        }
        assert!(
            start.elapsed() < Duration::from_secs(20),
            "시간 초과: {:?}",
            flow.status()
        );
        std::thread::sleep(Duration::from_millis(5));
    }
}

fn flow_at(h: Harness, auto: bool, t0: Instant) -> (Flow, Arc<Recorder>, Arc<NoNetwork>, Temp) {
    let Harness {
        session,
        runner,
        net,
        work,
    } = h;
    let flow = Flow::start_at(auto, move || session, noop(), t0);
    (flow, runner, net, work)
}

fn msi_harness(version: &str) -> (Fixture, Harness) {
    let fx = fixture(version, &WIN, None);
    let h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    (fx, h)
}

/// 켬: 켤 때 한 번 확인해 묻고, "나중에" 뒤 24시간마다 다시 확인하되 이번 실행에서는 다시 묻지 않는다(카드에만).
#[test]
fn flow_on_rechecks_every_24_hours_without_asking_twice() {
    let (_fx, h) = msi_harness("0.2.0");
    let t0 = Instant::now();
    let (mut flow, runner, net, _work) = flow_at(h, true, t0);
    assert_eq!(flow.status(), Status::Checking);
    let first = pump_checked(&mut flow, t0);
    assert!(!first.manual, "켤 때 확인은 자동");
    assert_eq!(
        first.found().map(|r| r.version),
        Some(Version::new(0, 2, 0))
    );
    assert!(matches!(flow.stage(), Stage::Ask(_)));
    flow.later();
    assert!(matches!(flow.status(), Status::Available(_)));
    assert_eq!(flow.next_check(t0), Some(AUTO_CHECK_INTERVAL));

    // 24시간이 되기 전에는 다시 확인하지 않는다.
    let almost = t0 + AUTO_CHECK_INTERVAL - Duration::from_secs(60);
    for _ in 0..5 {
        assert_eq!(flow.poll_at(almost, &noop()), None);
        assert!(!flow.checking());
    }
    // 24시간 뒤 다시 확인 — 이미 물었으니 묻는 창 없이 카드에만.
    let day = t0 + AUTO_CHECK_INTERVAL;
    let second = pump_checked(&mut flow, day);
    assert!(!second.manual);
    assert!(second.found().is_some());
    assert!(
        !flow.showing(),
        "나중에 뒤에는 이번 실행에서 스스로 다시 묻지 않는다"
    );
    assert_eq!(flow.schedule().last(), Some(day));
    assert!(runner.lines().is_empty());
    assert_eq!(net.calls(), 0, "로컬 목록만");
}

/// 끔: 스스로는 확인하지 않지만 `지금 확인` 은 된다(묻지 않고 결과만), `업데이트 설치…` 는 공통 묻는 창을 연다.
#[test]
fn flow_off_manual_check_and_install_button_still_work() {
    let (_fx, h) = msi_harness("0.2.0");
    let t0 = Instant::now();
    let (mut flow, runner, _net, _work) = flow_at(h, false, t0);
    assert!(flow.session().is_none());
    assert!(flow.check_now(&noop()));
    assert!(flow.session().is_some(), "누를 때 세션을 만든다");
    assert_eq!(flow.status(), Status::Checking);
    let c = pump_checked(&mut flow, t0);
    assert!(c.manual);
    assert!(c.found().is_some());
    assert!(!flow.showing(), "지금 확인은 묻는 창을 띄우지 않는다");
    assert!(matches!(flow.status(), Status::Available(_)));
    // 꺼져 있으니 하루가 지나도 스스로 확인하지 않는다.
    assert_eq!(flow.poll_at(t0 + AUTO_CHECK_INTERVAL * 2, &noop()), None);
    assert!(!flow.checking());
    // 업데이트 설치… → 공통 묻는 창 → 지금 설치 → 받기 · 검증 · 설치 명령.
    flow.offer(&noop());
    assert!(matches!(flow.stage(), Stage::Ask(_)));
    flow.install(&noop());
    pump(&mut flow, |f| matches!(f.stage(), Stage::Installing(_)));
    assert!(!flow.take_quit());
    assert_eq!(runner.lines().len(), 1);
    assert!(runner.lines()[0].starts_with("spawn powershell.exe "));
}

/// `업데이트 설치…` 를 찾은 판 없이 누르면 확인한 뒤 새 판이면 곧바로 묻는다("나중에" 뒤에도 누르면 다시).
#[test]
fn flow_offer_checks_first_and_asks_even_after_later() {
    let (_fx, h) = msi_harness("0.2.0");
    let t0 = Instant::now();
    let (mut flow, _runner, _net, _work) = flow_at(h, false, t0);
    flow.offer(&noop());
    let c = pump_checked(&mut flow, t0);
    assert!(c.manual);
    assert!(matches!(flow.stage(), Stage::Ask(_)));
    flow.later();
    assert!(!flow.showing());
    flow.offer(&noop());
    assert!(
        matches!(flow.stage(), Stage::Ask(_)),
        "사용자가 누르면 다시 묻는다"
    );
}

/// 새 판이 없으면 최신. 실행 중에 자동 업데이트를 켜면 곧바로 확인하고, 수동 확인도 24시간 일정을 새로 맞춘다.
#[test]
fn flow_turning_auto_on_checks_and_manual_check_resets_the_schedule() {
    let (_fx, h) = msi_harness("0.0.1");
    let t0 = Instant::now();
    let (mut flow, _runner, _net, _work) = flow_at(h, false, t0);
    assert_eq!(flow.poll_at(t0, &noop()), None);
    flow.set_auto(true);
    assert!(flow.auto());
    let t1 = t0 + Duration::from_secs(5);
    let c = pump_checked(&mut flow, t1);
    assert!(!c.manual);
    assert_eq!(c.result, Ok(None));
    assert_eq!(flow.status(), Status::Latest);
    assert!(!flow.showing());
    assert_eq!(flow.schedule().last(), Some(t1));
    // 수동 확인 → 일정이 그때부터(이 시험의 수동 확인 때는 실제 지금).
    assert!(flow.check_now(&noop()));
    let c = pump_checked(&mut flow, t1);
    assert!(c.manual);
    let t2 = flow.schedule().last().unwrap();
    assert!(t2 >= t0);
    assert!(
        !flow
            .schedule()
            .due(true, t2 + AUTO_CHECK_INTERVAL - Duration::from_secs(1))
    );
    // 끄면 일정도 멈춘다.
    flow.set_auto(false);
    assert_eq!(flow.next_check(t2), None);
    assert_eq!(flow.poll_at(t2 + AUTO_CHECK_INTERVAL * 2, &noop()), None);
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
fn flow_install_now_on_windows_waits_without_closing_unsaved_work() {
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
    assert!(
        !flow.take_quit(),
        "미저장 작업이 있을 수 있어 자동 종료하지 않는다"
    );
    assert!(!flow.take_quit());
    assert_eq!(runner.lines().len(), 1);
    assert!(runner.lines()[0].starts_with("spawn powershell.exe "));
    let body = std::fs::read_to_string(work.0.join("install-0.2.0.ps1")).unwrap();
    assert!(body.contains("-ArgumentList '/S /NS /D=C:/Program Files/TASTEFILES' -Verb RunAs"));
    assert!(flow.next_check(Instant::now()).unwrap() <= Duration::from_millis(250));
    assert!(
        !flow.showing(),
        "대기 중에는 앱의 저장·작업 UI를 가리지 않는다"
    );
    std::fs::write(
        work.0.join(RESULT_FILE),
        "fail 0.2.0 the app is still running (postponed)\n",
    )
    .unwrap();
    flow.poll(&noop());
    assert!(matches!(flow.stage(), Stage::Failed { .. }));
    assert!(!flow.take_quit(), "취소 시에도 현재 작업 창을 유지한다");
}

#[test]
fn windows_pending_update_is_preserved_and_duplicate_install_is_refused() {
    let fx = fixture("0.2.0", &WIN, None);
    let mut h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Apps/TASTEFILES/tastefiles.exe",
        &[],
    );
    let release = check(&mut h).unwrap();
    let file = download(&mut h, &release).unwrap();
    assert_eq!(h.session.take_last_result(), None);
    assert!(
        file.exists(),
        "설치 기록이 없으면 다른 인스턴스의 내려받기를 치우지 않는다"
    );
    h.session.install_now(&release, &file, noop()).unwrap();
    assert_eq!(h.session.take_last_result(), None);
    assert!(file.exists(), "다른 인스턴스가 설치 파일을 치우면 안 된다");
    assert!(h.session.install_now(&release, &file, noop()).is_err());
    assert_eq!(
        h.runner.lines().len(),
        1,
        "중복 설치 스크립트를 띄우지 않는다"
    );
    std::fs::write(
        h.work.0.join(RESULT_FILE),
        "fail 0.2.0 the app is still running (postponed)\n",
    )
    .unwrap();
    assert!(h.session.waiting_install_failure().is_some());
    assert!(file.exists(), "보류 후에도 검증한 설치 파일을 보존한다");
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
fn flow_linux_relaunch_failure_keeps_current_app_open() {
    for kind in [
        InstallKind::Deb,
        InstallKind::Rpm,
        InstallKind::AppImage {
            path: "/home/u/Apps/TASTEFILES.AppImage".into(),
        },
    ] {
        let fx = fixture("0.2.0", &LINUX, None);
        let h = harness(
            &fx,
            kind,
            "/usr/bin/tastefiles",
            &["/usr/bin/pkexec", "/usr/bin/apt-get"],
        );
        *h.runner.code.lock().unwrap() = Some(0);
        *h.runner.relaunch_error.lock().unwrap() = Some(std::io::ErrorKind::PermissionDenied);
        let (mut flow, _runner, _net, _work) = flow_with(h);
        pump(&mut flow, Flow::showing);
        flow.install(&noop());
        pump(&mut flow, |f| matches!(f.stage(), Stage::Failed { .. }));
        assert!(!flow.take_quit());
        let Stage::Failed { error, .. } = flow.stage() else {
            unreachable!()
        };
        assert!(error.to_string().contains("restart failed"));
    }
}

#[test]
fn linux_relaunch_waits_for_parent_and_passes_path_as_an_argument() {
    let path = Path::new("/home/u/Apps/TASTE FTP's.AppImage");
    let command = crate::session::linux_relaunch_command(path, 1234);
    assert_eq!(command.get_program(), "/bin/sh");
    let args: Vec<_> = command.get_args().collect();
    assert_eq!(args[0], "-c");
    let script = args[1].to_string_lossy();
    assert!(script.contains("while kill -0 \"$1\""));
    assert!(script.contains("sleep 1; done; exec \"$2\""));
    assert!(!script.contains("TASTE FTP"));
    assert_eq!(args[3], "1234");
    assert_eq!(args[4], path.as_os_str());
    assert_eq!(command.get_current_dir(), Some(Path::new("/")));
    for name in ["APPIMAGE", "APPDIR", "ARGV0", "OWD"] {
        assert!(
            command
                .get_envs()
                .any(|(key, value)| key == name && value.is_none())
        );
    }
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
        vec!["open https://tastedev.net/products/files".to_owned()]
    );
}

/// Linux 설치 파일은 릴리스의 `<파일>.sig` 를 받아 제품이 준 검증기로 본다. 서명 파일이 없거나 검증기가
/// 거절하면 실패, 맞으면 통과. 검증기에는 받은 파일과 서명 내용이 그대로 간다.
#[test]
fn linux_packages_are_checked_against_their_published_signature() {
    let tmp = Temp::new("sig");
    let deb = tmp.0.join("tastedev-files-0.2.0-linux-x86_64.deb");
    std::fs::write(&deb, b"package").unwrap();
    let sig = tmp.0.join("tastedev-files-0.2.0-linux-x86_64.deb.sig");
    std::fs::write(
        &sig,
        b"-----BEGIN SSH SIGNATURE-----\ngood\n-----END SSH SIGNATURE-----\n",
    )
    .unwrap();
    let asset = |name: &str, path: &Path| Asset {
        name: name.to_owned(),
        url: crate::testing::file_url(path),
        size: std::fs::metadata(path).unwrap().len(),
        sha256: String::new(),
    };
    let deb_asset = asset("tastedev-files-0.2.0-linux-x86_64.deb", &deb);
    let mut release = Release {
        version: Version::parse("0.2.0").unwrap(),
        tag: "files-v0.2.0".into(),
        page: String::new(),
        notes: String::new(),
        published: String::new(),
        assets: vec![
            deb_asset.clone(),
            asset("tastedev-files-0.2.0-linux-x86_64.deb.sig", &sig),
        ],
    };
    let net = NoNetwork(AtomicUsize::new(0));
    let seen = Arc::new(std::sync::Mutex::new(Vec::new()));
    let seen2 = Arc::clone(&seen);
    let check: SignatureCheck = Arc::new(move |file: &Path, sig: &[u8]| {
        seen2
            .lock()
            .unwrap()
            .push((file.to_path_buf(), sig.to_vec()));
        if String::from_utf8_lossy(sig).contains("good") {
            Ok(())
        } else {
            Err("bad signature".into())
        }
    });

    assert_eq!(
        verify_signature(&release, &deb_asset, &deb, true, &net, &check),
        Ok(())
    );
    let calls = seen.lock().unwrap().clone();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].0, deb);
    assert!(calls[0].1.starts_with(b"-----BEGIN SSH SIGNATURE-----"));

    std::fs::write(&sig, b"tampered").unwrap();
    release.assets[1].size = 8;
    assert!(matches!(
        verify_signature(&release, &deb_asset, &deb, true, &net, &check),
        Err(UpdateError::Signature(_))
    ));

    release.assets.pop();
    assert!(
        matches!(
            verify_signature(&release, &deb_asset, &deb, true, &net, &check),
            Err(UpdateError::Signature(_))
        ),
        "서명 파일이 없으면 실패"
    );
    // 믿지 않는 주소(로컬 허용 아님)의 서명은 받지 않는다.
    release
        .assets
        .push(asset("tastedev-files-0.2.0-linux-x86_64.deb.sig", &sig));
    assert!(verify_signature(&release, &deb_asset, &deb, false, &net, &check).is_err());
}

// ───────────────────────────── 사이트 API ─────────────────────────────

const SITE_SHA: &str = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SITE_URL: &str = "https://tastedev.net/api/updates/files";

/// 사이트가 주는 모양(배열 한 칸, 2026-10-10 계약): `version` 판, 설치 파일 하나(`url`, `digest` 가 있으면
/// SHA-256 포함), `html_url` 은 사이트 제품 페이지.
fn site_body(version: &str, url: Option<&str>, digest: bool) -> Result<Vec<u8>, String> {
    let tag = format!("{}{version}", PRODUCT.tag_prefix);
    let name = format!("tastefiles_{version}_windows_x64.msi");
    let url = url.map_or_else(|| format!("{DOWNLOAD_BASE}{tag}/{name}"), str::to_owned);
    let mut asset = serde_json::json!({"name": name, "browser_download_url": url, "size": 10});
    if digest {
        asset["digest"] = serde_json::json!(SITE_SHA);
    }
    let item = serde_json::json!({
        "tag_name": tag, "name": format!("TASTEFILES {version}"),
        "html_url": "https://tastedev.net/en/products/files",
        "draft": false, "prerelease": false, "published_at": "2026-10-10T00:00:00Z",
        "body": "- 노트", "assets": [asset],
    });
    Ok(serde_json::to_vec(&vec![item]).unwrap())
}

fn site_check(net: &testing::FakeSite) -> Result<Option<Release>, UpdateError> {
    check_latest(SITE_URL, net, false, PRODUCT.tag_prefix)
}

/// 받은 주소에 GitHub API 가 없는지.
fn no_github_api(net: &testing::FakeSite) {
    for url in net.requested() {
        assert!(!url.contains("api.github.com"), "{url}");
        assert!(!url.contains("/releases?"), "{url}");
    }
}

#[test]
fn site_slug_comes_from_the_tag_prefix() {
    for (prefix, slug) in [
        ("ftp-v", "ftp"),
        ("cad-v", "cad"),
        ("files-v", "files"),
        ("ssh-v", "ssh"),
        ("zip-v", "zip"),
    ] {
        assert_eq!(product_slug(prefix), Some(slug));
        assert_eq!(
            site_updates_url(prefix).unwrap(),
            format!("https://tastedev.net/api/updates/{slug}")
        );
        assert_eq!(
            product_page_url(prefix),
            format!("https://tastedev.net/products/{slug}")
        );
    }
    for bad in ["files", "-v", "Ftp-v", "a/b-v", "a.b-v", "ftp-v-v", ""] {
        assert_eq!(product_slug(bad), None, "{bad}");
    }
    assert_eq!(site_updates_url("files"), None);
    assert_eq!(product_page_url("files"), "https://tastedev.net/products");
}

#[test]
fn the_default_address_is_the_site_api() {
    // 시험 실행에 TASTEDEV_UPDATE_URL 이 걸려 있지 않을 때만 기본 주소를 본다(환경 변수는 바꾸지 않는다).
    if std::env::var_os(URL_ENV).is_none() {
        assert_eq!(list_url("files-v"), SITE_URL);
        assert_eq!(
            list_url("files"),
            "",
            "slug 를 얻지 못하면 빈 주소(확인 실패)"
        );
    }
    let net = testing::FakeSite::new(site_body("0.3.0", None, true));
    assert!(matches!(
        check_latest("", &net, false, PRODUCT.tag_prefix),
        Err(UpdateError::Network(_))
    ));
    assert!(net.requested().is_empty());
}

#[test]
fn site_answer_is_read_once_without_github() {
    let net = testing::FakeSite::new(site_body("0.3.0", None, true));
    let got = site_check(&net).unwrap().expect("사이트의 판");
    assert_eq!(got.version, Version::parse("0.3.0").unwrap());
    assert_eq!(got.assets[0].sha256, "a".repeat(64));
    assert_eq!(got.page, "https://tastedev.net/en/products/files");
    assert_eq!(got.notes, "- 노트");
    assert_eq!(got.published, "2026-10-10");
    assert_eq!(net.requested(), vec![SITE_URL.to_owned()]);
    no_github_api(&net);
}

#[test]
fn site_empty_list_means_no_update() {
    let net = testing::FakeSite::new(Ok(b"[]".to_vec()));
    assert_eq!(site_check(&net), Ok(None));
    assert_eq!(net.requested(), vec![SITE_URL.to_owned()]);
}

#[test]
fn site_failures_are_check_errors_without_any_fallback() {
    let network = [
        "HTTP status client error (404 Not Found)",
        "HTTP status server error (503 Service Unavailable)",
        "error sending request: connection refused",
    ];
    for why in network {
        let net = testing::FakeSite::new(Err(why.into()));
        assert_eq!(site_check(&net), Err(UpdateError::Network(why.into())));
        assert_eq!(net.requested(), vec![SITE_URL.to_owned()], "한 번만 부른다");
    }
    let bad: Vec<Vec<u8>> = vec![
        b"{\"error\":\"unknown product\"}".to_vec(),
        b"<html>bad gateway</html>".to_vec(),
        b"[{\"tag_name\": ".to_vec(),
        vec![b' '; MAX_LIST_BYTES + 1],
    ];
    for body in bad {
        let net = testing::FakeSite::new(Ok(body));
        assert_eq!(site_check(&net), Err(UpdateError::BadList));
        assert_eq!(net.requested().len(), 1, "다른 주소로 돌아가지 않는다");
    }
}

#[test]
fn site_answer_without_sha256_is_offered_but_only_as_a_page() {
    let net = Arc::new(testing::FakeSite::new(site_body("0.3.0", None, false)));
    let got = site_check(&net).unwrap().expect("판은 알린다");
    assert!(got.assets[0].sha256.is_empty());
    assert_eq!(
        pick_asset(&got, PRODUCT.package, &InstallKind::Msi, "x86_64"),
        None,
        "SHA-256 없는 설치 파일은 자동 설치에 쓰지 않는다"
    );
    let work = Temp::new("site-nodigest");
    assert_eq!(
        fetch_asset(
            &got.assets[0],
            &got.tag,
            &work.0,
            false,
            net.as_ref(),
            &|_| {}
        ),
        Err(UpdateError::NoAsset)
    );
    // 세션: 설치할 수 없으므로 사이트 페이지를 연다(받지 않는다).
    let runner = Arc::new(Recorder::default());
    let session = Session::with_parts(
        PRODUCT,
        net.clone(),
        runner.clone(),
        InstallKind::Msi,
        PathBuf::from("C:/Program Files/TASTEFILES/tastefiles.exe"),
        work.0.clone(),
        SITE_URL.into(),
        false,
        "x86_64".into(),
        Arc::new(|_: &Path| false),
    );
    assert!(!session.can_install(&got));
    session.open_page(&got.page).unwrap();
    assert_eq!(
        runner.lines(),
        vec!["open https://tastedev.net/en/products/files".to_owned()]
    );
    assert_eq!(net.requested(), vec![SITE_URL.to_owned()]);
}

/// 서명 칸(`<파일>.sig`)에는 digest 가 없을 수 있다 — 그래도 판 · 서명 파일로 읽힌다. SHA256SUMS.txt 는 쓰지 않는다.
#[test]
fn site_signature_entries_without_digest_are_kept() {
    let tag = "files-v0.3.0";
    let deb = "tastedev-files-0.3.0-linux-x86_64.deb";
    let body = serde_json::json!([{
        "tag_name": tag, "name": "TASTEFILES 0.3.0", "html_url": "https://tastedev.net/products/files",
        "draft": false, "prerelease": false, "published_at": "2026-10-10T00:00:00Z", "body": "",
        "assets": [
            {"name": deb, "browser_download_url": format!("{DOWNLOAD_BASE}{tag}/{deb}"), "size": 10,
             "digest": SITE_SHA},
            {"name": format!("{deb}.sig"), "browser_download_url": format!("{DOWNLOAD_BASE}{tag}/{deb}.sig"),
             "size": 300},
        ],
    }]);
    let net = testing::FakeSite::new(Ok(serde_json::to_vec(&body).unwrap()));
    let got = site_check(&net).unwrap().expect("판");
    assert_eq!(got.assets.len(), 2);
    let asset = pick_asset(&got, PRODUCT.package, &InstallKind::Deb, "x86_64").expect("deb");
    assert_eq!(asset.name, deb);
    let sig = got
        .assets
        .iter()
        .find(|a| a.name.ends_with(".sig"))
        .unwrap();
    assert!(sig.sha256.is_empty());
    assert!(trusted_url(&sig.url, &got.tag, false));
}

#[test]
fn page_must_be_on_the_site() {
    assert!(site_page("https://tastedev.net/products/files"));
    assert!(site_page("https://tastedev.net/en/products/files"));
    for bad in [
        "https://github.com/whitecalvin/tastedev-releases/releases/tag/files-v0.3.0",
        "https://tastedev.net.evil.invalid/products/files",
        "https://tastedev.net@evil.invalid/",
        "http://tastedev.net/products/files",
        "https://tastedev.netx/",
        "javascript:alert(1)",
        "https://tastedev.net/a b",
    ] {
        assert!(!site_page(bad), "{bad}");
    }
    // html_url 이 사이트 주소가 아니면(옛 GitHub 페이지 등) 사이트 제품 페이지로 바꾼다.
    for html in [
        Some("https://github.com/whitecalvin/tastedev-releases/releases/tag/files-v0.3.0"),
        Some("https://evil.invalid/x"),
        None,
    ] {
        let mut item = serde_json::json!({"tag_name": "files-v0.3.0", "assets": []});
        if let Some(h) = html {
            item["html_url"] = serde_json::json!(h);
        }
        let got = latest(&serde_json::to_vec(&vec![item]).unwrap(), "files-v")
            .unwrap()
            .unwrap();
        assert_eq!(got.page, "https://tastedev.net/products/files", "{html:?}");
    }
}

#[test]
fn screen_language_is_sent_as_site_lang() {
    for (app, want) in [
        ("en", Some("en")),
        ("de", Some("de")),
        ("es", Some("es")),
        ("fr", Some("fr")),
        ("it", Some("it")),
        ("pt-BR", Some("pt")),
        ("pt_br", Some("pt")),
        ("ja", Some("ja")),
        ("zh", Some("zh")),
        ("zh-Hans", Some("zh")),
        ("zh_hant", Some("zh-hant")),
        ("zh-TW", Some("zh-hant")),
        ("ko", None),
        ("ru", None),
        ("nl", None),
        ("", None),
    ] {
        assert_eq!(site_lang(app), want, "{app}");
    }
    assert_eq!(
        with_site_lang(SITE_URL, "en"),
        format!("{SITE_URL}?lang=en")
    );
    assert_eq!(
        with_site_lang(SITE_URL, "zh_hant"),
        format!("{SITE_URL}?lang=zh-hant")
    );
    assert_eq!(with_site_lang(SITE_URL, "ko"), SITE_URL);
    assert_eq!(with_site_lang(SITE_URL, "ru"), SITE_URL);
    assert_eq!(
        with_site_lang("file:///C:/x/releases.json", "en"),
        "file:///C:/x/releases.json",
        "로컬 주소에는 붙이지 않는다"
    );
    assert_eq!(
        with_site_lang("https://example.invalid/r", "en"),
        "https://example.invalid/r"
    );
    // 세션: set_language 의 언어를 확인 주소에 붙인다.
    let net = Arc::new(testing::FakeSite::new(Ok(b"[]".to_vec())));
    let work = Temp::new("site-lang");
    let mut session = Session::with_parts(
        PRODUCT,
        net.clone(),
        Arc::new(Recorder::default()),
        InstallKind::Msi,
        PathBuf::from("C:/x.exe"),
        work.0.clone(),
        SITE_URL.into(),
        false,
        "x86_64".into(),
        Arc::new(|_: &Path| false),
    );
    session.set_language(|| "ja");
    session.check(noop());
    assert!(matches!(wait(&mut session), Event::Checked(Ok(None))));
    session.set_language(|| "ko");
    session.check(noop());
    assert!(matches!(wait(&mut session), Event::Checked(Ok(None))));
    assert_eq!(
        net.requested(),
        vec![format!("{SITE_URL}?lang=ja"), SITE_URL.to_owned()]
    );
}

#[test]
fn local_only_and_overridden_addresses() {
    // 시험 빌드(local_only): 원격 주소는 부르지 않는다.
    let net = testing::FakeSite::new(site_body("0.3.0", None, true));
    assert!(matches!(
        check_latest(SITE_URL, &net, true, PRODUCT.tag_prefix),
        Err(UpdateError::Network(_))
    ));
    assert!(net.requested().is_empty());
    // TASTEDEV_UPDATE_URL 로 바꾼 원격 주소는 그 주소 하나만, 같은 모양으로 읽는다.
    let net = testing::FakeSite::new(site_body("0.3.0", None, true));
    let got = check_latest("https://example.invalid/r", &net, false, PRODUCT.tag_prefix)
        .unwrap()
        .unwrap();
    assert_eq!(got.version, Version::parse("0.3.0").unwrap());
    assert_eq!(
        net.requested(),
        vec!["https://example.invalid/r".to_owned()]
    );
    // 로컬 파일(시험 · 캡처)은 네트워크를 부르지 않는다. local_only 여도 읽는다.
    let fx = fixture("0.2.0", &WIN, None);
    for local_only in [false, true] {
        let net = testing::FakeSite::new(site_body("0.3.0", None, true));
        let got = check_latest(&fx.url(), &net, local_only, PRODUCT.tag_prefix)
            .unwrap()
            .unwrap();
        assert_eq!(got.version, Version::parse("0.2.0").unwrap());
        assert_eq!(got.page, "https://tastedev.net/products/files");
        assert!(net.requested().is_empty());
    }
    // 원격이 아닌 다른 주소(https 아님)는 부르지 않는다.
    let net = testing::FakeSite::new(site_body("0.3.0", None, true));
    assert!(matches!(
        check_latest(
            "http://tastedev.net/api/updates/files",
            &net,
            false,
            PRODUCT.tag_prefix
        ),
        Err(UpdateError::Network(_))
    ));
    assert!(net.requested().is_empty());
}

#[test]
fn site_asset_outside_the_release_repository_is_refused() {
    let work = Temp::new("site-trust");
    for url in [
        "https://tastedev.net/downloads/tastefiles_0.3.0_windows_x64.msi",
        "https://api.github.com/repos/whitecalvin/tastedev-releases/releases/assets/1",
        "https://github.com/someone/else/releases/download/files-v0.3.0/tastefiles_0.3.0_windows_x64.msi",
        // 같은 저장소라도 다른 태그 아래는 믿지 않는다.
        "https://github.com/whitecalvin/tastedev-releases/releases/download/files-v0.2.0/tastefiles_0.3.0_windows_x64.msi",
    ] {
        let net = testing::FakeSite::new(site_body("0.3.0", Some(url), true));
        let release = site_check(&net).unwrap().expect("사이트의 판");
        let asset = pick_asset(&release, PRODUCT.package, &InstallKind::Msi, "x86_64")
            .expect("이름은 맞다");
        assert_eq!(
            fetch_asset(asset, &release.tag, &work.0, false, &net, &|_| {}),
            Err(UpdateError::NoAsset),
            "{url}"
        );
        assert_eq!(
            net.requested(),
            vec![SITE_URL.to_owned()],
            "받으러 가지 않는다"
        );
    }
    // 배포 저장소의 그 태그 아래는 믿는다(받기는 제품 전송 — 가짜는 실패).
    let net = testing::FakeSite::new(site_body("0.3.0", None, true));
    let release = site_check(&net).unwrap().expect("사이트의 판");
    let asset = pick_asset(&release, PRODUCT.package, &InstallKind::Msi, "x86_64").unwrap();
    assert!(trusted_url(&asset.url, &release.tag, false));
    assert!(matches!(
        fetch_asset(asset, &release.tag, &work.0, false, &net, &|_| {}),
        Err(UpdateError::Network(_))
    ));
    assert_eq!(
        net.requested(),
        vec![
            SITE_URL.to_owned(),
            format!("{DOWNLOAD_BASE}files-v0.3.0/tastefiles_0.3.0_windows_x64.msi")
        ]
    );
    no_github_api(&net);
    // 세션도 같은 길로 확인한다(사이트 → 판, 받기는 믿는 주소만).
    let net = Arc::new(testing::FakeSite::new(site_body(
        "0.3.0",
        Some("https://tastedev.net/x/tastefiles_0.3.0_windows_x64.msi"),
        true,
    )));
    let mut session = Session::with_parts(
        PRODUCT,
        net.clone(),
        Arc::new(Recorder::default()),
        InstallKind::Msi,
        PathBuf::from("C:/Program Files/TASTEFILES/tastefiles.exe"),
        work.0.clone(),
        SITE_URL.into(),
        false,
        "x86_64".into(),
        Arc::new(|_: &Path| false),
    );
    session.check(noop());
    let Event::Checked(Ok(Some(release))) = wait(&mut session) else {
        panic!("사이트의 판을 찾아야 한다");
    };
    assert_eq!(release.version, Version::parse("0.3.0").unwrap());
    session.download(release, noop());
    assert!(matches!(
        wait(&mut session),
        Event::Downloaded(Err(UpdateError::NoAsset))
    ));
    assert_eq!(net.requested(), vec![SITE_URL.to_owned()]);
}

// ───────────────────────────── 설치 직전 다시 확인 · 결과 알림 ─────────────────────────────

/// 켤 때 0.2.4 를 찾아 묻는 창을 띄운 뒤, 사이트 목록을 `next` 로 바꾸고(`None` 이면 목록을 지워 확인 실패)
/// "지금 설치" 를 눌러 설치 단계까지 간다. 설치한 판 · 다시 확인 결과 · 받은 파일 내용을 돌려준다.
fn install_after_recheck(next: Option<&str>) -> (Version, Recheck, String, Temp) {
    let fx = fixture("0.2.4", &WIN, None);
    let h = harness(
        &fx,
        InstallKind::Msi,
        "C:/Program Files/TASTEFILES/tastefiles.exe",
        &[],
    );
    let (mut flow, runner, net, work) = flow_with(h);
    pump(&mut flow, |f| matches!(f.stage(), Stage::Ask(_)));
    assert_eq!(flow.release().unwrap().version, Version::new(0, 2, 4));
    // 그사이 사이트가 바뀐다(출시가 하루에 여러 번).
    let newer = next.map(|v| fixture(v, &WIN, None));
    match &newer {
        Some(n) => std::fs::copy(&n.list, &fx.list).map(|_| ()).unwrap(),
        None => std::fs::remove_file(&fx.list).unwrap(),
    }
    flow.install(&noop());
    assert!(
        matches!(flow.stage(), Stage::Downloading(_)),
        "다시 확인하는 동안은 받는 중으로 보인다"
    );
    assert!(!flow.checking(), "카드는 확인 중이 아니라 받는 중");
    pump(&mut flow, |f| matches!(f.stage(), Stage::Installing(_)));
    assert!(!flow.take_quit());
    let installed = flow.release().unwrap().version;
    assert_eq!(
        flow.available().map(|r| r.version),
        Some(installed),
        "카드 · 배지도 설치하는 판"
    );
    assert_eq!(runner.lines().len(), 1, "스크립트 하나만 띄운다");
    assert_eq!(net.calls(), 0, "로컬 목록만(실제 네트워크 없음)");
    assert!(
        work.0.join(format!("install-{installed}.ps1")).is_file(),
        "설치하는 판의 스크립트"
    );
    let file = work.0.join(WIN[1]);
    let body = std::fs::read_to_string(&file).unwrap();
    let recheck = flow.recheck().cloned().expect("다시 확인 결과");
    drop(newer);
    (installed, recheck, body, work)
}

/// 기억한 판 0.2.4, 설치 직전 확인에서 0.2.5 → 0.2.5 를 받아 설치한다.
#[test]
fn install_rechecks_and_takes_a_newer_release() {
    let (installed, recheck, body, work) = install_after_recheck(Some("0.2.5"));
    assert_eq!(installed, Version::new(0, 2, 5));
    assert_eq!(
        recheck,
        Recheck::Newer {
            from: Version::new(0, 2, 4),
            to: Version::new(0, 2, 5)
        }
    );
    assert_eq!(body, "installer 0.2.5", "0.2.5 설치 파일을 받았다");
    let log = std::fs::read_to_string(work.0.join(LOG_FILE)).unwrap();
    assert!(
        log.contains("recheck before install: 0.2.4 -> 0.2.5"),
        "{log}"
    );
}

/// 설치 직전 확인이 실패하면 기억한 0.2.4 로 진행하고 그 사실을 기록한다.
#[test]
fn install_goes_on_with_the_remembered_release_when_the_recheck_fails() {
    let (installed, recheck, body, work) = install_after_recheck(None);
    assert_eq!(installed, Version::new(0, 2, 4));
    assert!(
        matches!(&recheck, Recheck::Failed { version, .. } if *version == Version::new(0, 2, 4)),
        "{recheck:?}"
    );
    assert_eq!(body, "installer 0.2.4");
    let log = std::fs::read_to_string(work.0.join(LOG_FILE)).unwrap();
    assert!(
        log.contains("recheck before install failed, installing remembered 0.2.4"),
        "{log}"
    );
}

/// 설치 직전 확인이 같은 판이면 그대로 설치한다.
#[test]
fn install_keeps_the_release_when_the_recheck_finds_the_same() {
    let (installed, recheck, body, _work) = install_after_recheck(Some("0.2.4"));
    assert_eq!(installed, Version::new(0, 2, 4));
    assert_eq!(recheck, Recheck::Same(Version::new(0, 2, 4)));
    assert_eq!(body, "installer 0.2.4");
}

/// "나중에" 로 다시 확인 중에 그만두면 받지 않는다.
#[test]
fn later_during_the_recheck_downloads_nothing() {
    let (_fx, h) = msi_harness("0.2.4");
    let (mut flow, runner, _net, work) = flow_with(h);
    pump(&mut flow, |f| matches!(f.stage(), Stage::Ask(_)));
    flow.install(&noop());
    flow.later();
    let start = Instant::now();
    while start.elapsed() < Duration::from_millis(300) {
        flow.poll(&noop());
        std::thread::sleep(Duration::from_millis(5));
    }
    assert!(!flow.showing());
    assert!(runner.lines().is_empty());
    assert!(!work.0.join(WIN[1]).exists(), "받지 않았다");
}

/// 결과 파일의 `pending`(스크립트가 돌지 못함) · `started`(도중에 멈춤)도 실패로 읽고, "앱이 끝나지 않음" 을 가린다.
/// 업데이트 기록은 켤 때 치우지 않는다.
#[test]
fn unfinished_install_scripts_are_reported_as_failures() {
    assert_eq!(
        parse_result("pending 0.2.6\n"),
        Some(InstallResult::Failed {
            version: Some(Version::new(0, 2, 6)),
            detail: "the update script did not run".into()
        })
    );
    assert_eq!(
        parse_result("\u{feff}started 0.2.6 2026-10-11T11:37:28+09:00\r\n"),
        Some(InstallResult::Failed {
            version: Some(Version::new(0, 2, 6)),
            detail:
                "the update script stopped before finishing (started 2026-10-11T11:37:28+09:00)"
                    .into()
        })
    );
    let running = parse_result("\u{feff}fail 0.2.6 the app is still running\r\n").unwrap();
    assert!(running.app_was_running());
    assert!(
        !parse_result("fail 0.2.6 installer exit code 2")
            .unwrap()
            .app_was_running()
    );
    assert!(!InstallResult::Ok(Version::new(0, 2, 6)).app_was_running());

    let t = Temp::new("log");
    std::fs::write(t.0.join(LOG_FILE), "x\n").unwrap();
    std::fs::write(t.0.join("install-0.2.6.ps1"), "x").unwrap();
    clean_work_dir(&t.0);
    assert!(t.0.join(LOG_FILE).is_file(), "기록은 남긴다");
    assert!(!t.0.join("install-0.2.6.ps1").exists());
    std::fs::write(
        t.0.join(LOG_FILE),
        vec![b'x'; usize::try_from(MAX_LOG_BYTES).unwrap() + 1],
    )
    .unwrap();
    clean_work_dir(&t.0);
    assert!(!t.0.join(LOG_FILE).exists(), "너무 커지면 지운다");
}

/// 2026-10-11 CAD 0.2.6 실증: 결과 파일 `fail 0.2.6 the app is still running` 이 다음 실행에서 실패로 읽힌다.
#[test]
fn the_app_still_running_failure_reaches_the_next_start() {
    let (_fx, h) = msi_harness("0.2.0");
    std::fs::write(
        h.work.0.join(RESULT_FILE),
        "\u{feff}fail 0.2.6 the app is still running\r\n",
    )
    .unwrap();
    let (mut flow, _runner, _net, _work) = flow_with(h);
    let last = flow.take_last_result().expect("지난 결과");
    assert!(last.app_was_running());
    assert_eq!(flow.take_last_result(), None, "한 번만");
}

#[test]
fn startup_cleanup_preserves_the_live_progress_window_until_it_closes() {
    let tmp = Temp::new("progress-cleanup");
    let state = tmp.0.join("progress-1.2.3.json");
    std::fs::write(&state, "{}").unwrap();
    let lease = std::fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(tmp.0.join(".update-progress.lock"))
        .unwrap();
    lease.try_lock().unwrap();
    clean_work_dir(&tmp.0);
    assert!(state.is_file());
    drop(lease);
    clean_work_dir(&tmp.0);
    assert!(!state.exists());
}

/// 실제 설치·GUI 없이 Windows 대기 함수를 실행한다.
#[cfg(windows)]
#[test]
fn the_wait_loop_polls_until_all_instances_exit_without_native_dialogs() {
    let tmp = Temp::new("waitloop");
    let helper = include_str!("windows_instances.ps1");
    assert!(!helper.contains("WScript.Shell"));
    assert!(!helper.contains(".Popup("));
    let cases = r#"
$ErrorActionPreference = 'Stop'
$app = 'C:/Apps/tastefiles.exe'
$stillMessage = 'the app is still running'
function Get-Process { [pscustomobject]@{Path='C:/Apps/tastefiles.exe'}; [pscustomobject]@{Path='C:/Other/tastefiles.exe'} }
if (@(Get-AppInstances).Count -ne 1) { throw 'wrong install identity' }
function Get-Process { [pscustomobject]@{Path=$null} }
if (@(Get-AppInstances | Where-Object { $_.PathVerified -eq $false }).Count -ne 1) { throw 'unverified live path did not block installation' }
function Write-Log { param($text) }
$script:checks = 0
function Get-AppInstances { $script:checks++; if ($script:checks -lt 4) { [pscustomobject]@{Id=123} } }
function New-Object { throw 'native dialogs are forbidden' }
Wait-AppInstances
if ($script:checks -lt 4) { throw 'did not wait for every instance' }
function Get-AppInstances { [pscustomobject]@{Id=123} }
function Get-Date { $script:checks++; [datetime]::new(2026, 1, 1).AddSeconds($script:checks * 601) }
try { Wait-AppInstances; throw 'timeout was ignored' } catch { if ($_.Exception.Message -ne $stillMessage) { throw } }
'instances-and-cancel-pass'
"#;
    let script = tmp.0.join("wait.ps1");
    std::fs::write(&script, format!("\u{feff}{helper}\n{cases}")).unwrap();
    let output = std::process::Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(&script)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    assert!(String::from_utf8_lossy(&output.stdout).contains("instances-and-cancel-pass"));
}
