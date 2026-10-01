//! Studio adapter for the unchanged shared TASTEDEV update engine.
use serde::Serialize;
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tastedev_update::{
    Event, InstallKind, Product, Release, Runner, Session, Started, SystemRunner, Transport,
};

const PRODUCT: Product = Product {
    name: "TASTESTUDIO",
    tag_prefix: "studio-v",
    package: "tastestudio",
    version: env!("CARGO_PKG_VERSION"),
};
const MAX_DOWNLOAD: u64 = tastedev_update::MAX_ASSET_BYTES;

fn redirect_allowed(url: &reqwest::Url) -> bool {
    url.scheme() == "https"
        && url.username().is_empty()
        && url.password().is_none()
        && matches!(
            url.host_str(),
            Some(
                "api.github.com"
                    | "github.com"
                    | "release-assets.githubusercontent.com"
                    | "objects.githubusercontent.com"
            )
        )
        && url.port_or_known_default() == Some(443)
}

struct Network {
    cancelled: Arc<AtomicBool>,
}
impl Network {
    fn response(&self, url: &str) -> Result<reqwest::blocking::Response, String> {
        if self.cancelled.load(Ordering::Relaxed) {
            return Err("cancelled".into());
        }
        let parsed = reqwest::Url::parse(url).map_err(|_| "network")?;
        if !redirect_allowed(&parsed) {
            return Err("untrusted-url".into());
        }
        let client = reqwest::blocking::Client::builder()
            .connect_timeout(Duration::from_secs(15))
            .timeout(Duration::from_secs(120))
            .user_agent(concat!("TASTESTUDIO/", env!("CARGO_PKG_VERSION")))
            .redirect(reqwest::redirect::Policy::custom(|attempt| {
                if attempt.previous().len() >= 5 || !redirect_allowed(attempt.url()) {
                    attempt.error("untrusted redirect")
                } else {
                    attempt.follow()
                }
            }))
            .build()
            .map_err(|_| "network")?;
        client
            .get(parsed)
            .send()
            .and_then(|r| r.error_for_status())
            .map_err(|_| "network".into())
    }
    fn copy(
        &self,
        mut response: impl Read,
        mut output: impl Write,
        limit: u64,
        progress: &dyn Fn(u64),
    ) -> Result<(), String> {
        let mut total = 0u64;
        let mut buffer = [0u8; 64 * 1024];
        loop {
            if self.cancelled.load(Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let n = response.read(&mut buffer).map_err(|_| "network")?;
            if n == 0 {
                return Ok(());
            }
            total += n as u64;
            if total > limit {
                return Err("too-large".into());
            }
            output.write_all(&buffer[..n]).map_err(|_| "storage")?;
            progress(total);
        }
    }
}
impl Transport for Network {
    fn get(&self, url: &str) -> Result<Vec<u8>, String> {
        let mut bytes = Vec::new();
        self.copy(
            self.response(url)?,
            &mut bytes,
            tastedev_update::MAX_LIST_BYTES as u64,
            &|_| {},
        )?;
        Ok(bytes)
    }
    fn download(&self, url: &str, to: &Path, progress: &dyn Fn(u64)) -> Result<(), String> {
        let mut file = fs::File::create(to).map_err(|_| "storage")?;
        self.copy(self.response(url)?, &mut file, MAX_DOWNLOAD, progress)?;
        file.sync_all().map_err(|_| "storage".into())
    }
}

/// Only the verified update helper may leave Studio's kill-on-exit job.
/// Ordinary terminal processes retain their existing cleanup boundary.
struct InstallerRunner;
impl Runner for InstallerRunner {
    fn spawn(&self, program: &str, args: &[String]) -> std::io::Result<()> {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            let mut command = std::process::Command::new(program);
            command
                .args(args)
                .stdin(std::process::Stdio::null())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null());
            command.creation_flags(0x0100_0000 | 0x0800_0000 | 0x0000_0200); // BREAKAWAY, NO_WINDOW, NEW_PROCESS_GROUP
            command.spawn().map(|_| ())
        }
        #[cfg(not(windows))]
        {
            SystemRunner.spawn(program, args)
        }
    }
    fn run(&self, program: &str, args: &[String]) -> std::io::Result<i32> {
        SystemRunner.run(program, args)
    }
    fn replace(&self, from: &Path, to: &Path) -> std::io::Result<()> {
        SystemRunner.replace(from, to)
    }
    fn open(&self, target: &str) -> std::io::Result<()> {
        #[cfg(windows)]
        {
            self.spawn(
                "rundll32.exe",
                &["url.dll,FileProtocolHandler".into(), target.into()],
            )
        }
        #[cfg(not(windows))]
        {
            SystemRunner.open(target)
        }
    }
    fn relaunch(&self, exe: &Path) -> std::io::Result<()> {
        self.spawn(&exe.to_string_lossy(), &[])
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub stage: String,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: String,
    pub page: Option<String>,
    pub can_install: bool,
    pub auto_check: bool,
    pub downloaded: u64,
    pub total: u64,
    pub error: Option<String>,
    pub previous_result: Option<String>,
}
struct Inner {
    session: Session,
    release: Option<Release>,
    file: Option<PathBuf>,
    status: Status,
    preference: PathBuf,
    cancelled: Arc<AtomicBool>,
}
pub struct Updates(Mutex<Inner>);
impl Updates {
    pub fn new(data: &Path, cache: &Path) -> Self {
        let preference = data.join("auto-update.json");
        let auto_check = match fs::read(&preference) {
            Ok(bytes) => serde_json::from_slice::<bool>(&bytes).unwrap_or(false),
            Err(error) => error.kind() == std::io::ErrorKind::NotFound,
        };
        let cancelled = Arc::new(AtomicBool::new(false));
        let exe = std::env::current_exe().unwrap_or_default();
        let mut kind = tastedev_update::detect_current(PRODUCT.package, &exe);
        // release-gate is a build output, never an installed portable application.
        if exe.components().any(|part| part.as_os_str() == "target") {
            kind = InstallKind::Unsupported(tastedev_update::Unsupported::Development);
        }
        let session = Session::with_parts(
            PRODUCT,
            Arc::new(Network {
                cancelled: cancelled.clone(),
            }),
            Arc::new(InstallerRunner),
            kind,
            exe,
            cache.join("updates"),
            tastedev_update::RELEASES_URL.into(),
            false,
            std::env::consts::ARCH.into(),
            Arc::new(|p| p.exists()),
        );
        let previous_result = session.take_last_result().map(|r| match r {
            tastedev_update::InstallResult::Ok(_) => "installed".into(),
            _ => "failed".into(),
        });
        Self(Mutex::new(Inner {
            session,
            release: None,
            file: None,
            preference,
            cancelled,
            status: Status {
                stage: "idle".into(),
                current_version: PRODUCT.version.into(),
                version: None,
                notes: String::new(),
                page: None,
                can_install: false,
                auto_check,
                downloaded: 0,
                total: 0,
                error: None,
                previous_result,
            },
        }))
    }
    pub fn action(
        &self,
        action: &str,
        enabled: Option<bool>,
        protected: bool,
    ) -> Result<(Status, bool), String> {
        let mut inner = self.0.lock().map_err(|_| "internal")?;
        if let Some(event) = inner.session.poll() {
            let cancelled = inner.cancelled.load(Ordering::Relaxed);
            match event {
                _ if cancelled => {
                    inner.status.stage = "cancelled".into();
                    inner.file = None;
                }
                Event::Checked(Ok(release)) => {
                    inner.status.stage = if release.is_some() {
                        "available"
                    } else {
                        "current"
                    }
                    .into();
                    inner.status.version = release.as_ref().map(|r| r.version.to_string());
                    inner.status.notes = release
                        .as_ref()
                        .map(|r| tastedev_update::notes_excerpt(&r.notes))
                        .unwrap_or_default();
                    inner.status.page = release.as_ref().map(|r| r.page.clone());
                    inner.status.can_install = release
                        .as_ref()
                        .is_some_and(|r| inner.session.can_install(r));
                    inner.release = release;
                }
                Event::Downloaded(Ok((release, file))) => {
                    inner.release = Some(release);
                    inner.file = Some(file);
                    inner.status.stage = "ready".into();
                }
                Event::Installed(Ok(_)) => {
                    inner.session.relaunch().map_err(|_| "install")?;
                    return Ok((inner.status.clone(), true));
                }
                Event::Checked(Err(_)) | Event::Downloaded(Err(_)) | Event::Installed(Err(_)) => {
                    inner.status.stage = "error".into();
                    inner.status.error = Some("update-failed".into());
                }
            }
        }
        let mut quit = false;
        match action {
            "status" => {}
            "release" => {
                let release = inner.release.as_ref().ok_or("invalid")?;
                let expected = format!("{}{}", tastedev_update::PAGE_BASE, release.tag);
                if release.page != expected {
                    return Err("invalid".into());
                }
                inner
                    .session
                    .open_page(&release.page)
                    .map_err(|_| "network")?;
            }
            "preference" => {
                let enabled = enabled.ok_or("invalid")?;
                fs::create_dir_all(inner.preference.parent().ok_or("storage")?)
                    .map_err(|_| "storage")?;
                let temporary = inner.preference.with_extension("pending");
                let mut file = fs::File::create(&temporary).map_err(|_| "storage")?;
                file.write_all(&serde_json::to_vec(&enabled).map_err(|_| "storage")?)
                    .map_err(|_| "storage")?;
                file.sync_all().map_err(|_| "storage")?;
                drop(file);
                fs::rename(&temporary, &inner.preference).map_err(|_| "storage")?;
                inner.status.auto_check = enabled;
            }
            "check" | "download" if inner.session.busy() => return Err("busy".into()),
            "check" => {
                inner.cancelled.store(false, Ordering::Relaxed);
                inner.status.error = None;
                inner.release = None;
                inner.file = None;
                inner.status.version = None;
                inner.status.can_install = false;
                inner.session.check(Arc::new(|| {}));
                inner.status.stage = "checking".into();
            }
            "download" => {
                let release = inner.release.clone().ok_or("invalid")?;
                if !inner.session.can_install(&release) {
                    return Err("unsupported".into());
                }
                inner.cancelled.store(false, Ordering::Relaxed);
                inner.status.error = None;
                inner.session.download(release, Arc::new(|| {}));
                inner.status.stage = "downloading".into();
            }
            "cancel" => {
                inner.cancelled.store(true, Ordering::Relaxed);
                inner.file = None;
                inner.status.stage = "cancelled".into();
            }
            "install" => {
                if protected {
                    return Err("workspace-busy".into());
                }
                if inner.status.stage != "ready" || inner.session.busy() {
                    return Err("invalid".into());
                }
                let release = inner.release.clone().ok_or("invalid")?;
                let file = inner.file.clone().ok_or("invalid")?;
                let asset = inner.session.asset(&release).ok_or("invalid")?;
                // Revalidate immediately before handoff: a cached file may have changed.
                tastedev_update::verify_file(&file, asset).map_err(|_| "verification")?;
                quit = inner
                    .session
                    .install_now(&release, &file, Arc::new(|| {}))
                    .map_err(|_| "install")?
                    == Started::QuitToInstall;
                inner.status.stage = "installing".into();
            }
            _ => return Err("invalid".into()),
        }
        let (done, total) = inner.session.progress();
        inner.status.downloaded = done;
        inner.status.total = total;
        Ok((inner.status.clone(), quit))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn redirect_boundary() {
        for url in [
            "https://github.com/a",
            "https://release-assets.githubusercontent.com/a",
        ] {
            assert!(redirect_allowed(&reqwest::Url::parse(url).unwrap()));
        }
        for url in [
            "http://github.com/a",
            "https://github.com.evil/a",
            "https://user@github.com/a",
            "https://github.com:8443/a",
        ] {
            assert!(!redirect_allowed(&reqwest::Url::parse(url).unwrap()));
        }
    }
    #[test]
    fn bounded_and_cancellable_stream() {
        let cancelled = Arc::new(AtomicBool::new(false));
        let network = Network {
            cancelled: cancelled.clone(),
        };
        assert!(network.copy(&b"abcd"[..], Vec::new(), 3, &|_| {}).is_err());
        cancelled.store(true, Ordering::Relaxed);
        assert_eq!(
            network
                .copy(&b"abcd"[..], Vec::new(), 5, &|_| {})
                .unwrap_err(),
            "cancelled"
        );
    }
    #[test]
    fn settings_persist_and_install_requires_verified_state() {
        let dir = tempfile::tempdir().unwrap();
        let updates = Updates::new(dir.path(), dir.path());
        assert!(updates.action("status", None, false).unwrap().0.auto_check);
        updates.action("preference", Some(false), false).unwrap();
        assert!(
            !Updates::new(dir.path(), dir.path())
                .action("status", None, false)
                .unwrap()
                .0
                .auto_check
        );
        assert_eq!(
            updates.action("install", None, true).err().as_deref(),
            Some("workspace-busy")
        );
        fs::write(dir.path().join("auto-update.json"), b"broken").unwrap();
        assert!(
            !Updates::new(dir.path(), dir.path())
                .action("status", None, false)
                .unwrap()
                .0
                .auto_check
        );
        assert_eq!(
            updates.action("install", None, false).err().as_deref(),
            Some("invalid")
        );
        assert_eq!(
            updates
                .action("https://evil/installer", None, false)
                .err()
                .as_deref(),
            Some("invalid")
        );
    }
    #[test]
    fn studio_release_matches_published_asset() {
        let json = br#"[{"tag_name":"studio-v0.2.0","draft":false,"prerelease":false,"assets":[{"name":"tastestudio_0.2.0_windows_x64-setup.exe","browser_download_url":"https://github.com/whitecalvin/tastedev-releases/releases/download/studio-v0.2.0/tastestudio_0.2.0_windows_x64-setup.exe","size":4,"digest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}]"#;
        let release = tastedev_update::latest(json, PRODUCT.tag_prefix)
            .unwrap()
            .unwrap();
        assert!(tastedev_update::pick_asset(
            &release,
            PRODUCT.package,
            &InstallKind::Nsis {
                dir: "C:/Studio".into()
            },
            "x86_64"
        )
        .is_some());
    }
    #[test]
    fn cached_payload_tampering_and_dirty_guard_block_handoff() {
        let dir = tempfile::tempdir().unwrap();
        let updates = Updates::new(dir.path(), dir.path());
        let file = dir.path().join("tastestudio_0.2.0_windows_x64.zip");
        fs::write(&file, b"bad!").unwrap();
        let release = Release { version: tastedev_update::Version::new(0,2,0), tag:"studio-v0.2.0".into(), page:String::new(), notes:String::new(), published:String::new(), assets:vec![tastedev_update::Asset { name:file.file_name().unwrap().to_string_lossy().into(), url:"https://github.com/whitecalvin/tastedev-releases/releases/download/studio-v0.2.0/test.zip".into(), size:4, sha256:"a".repeat(64) }] };
        {
            let mut inner = updates.0.lock().unwrap();
            inner.session = Session::with_parts(
                PRODUCT,
                Arc::new(Network {
                    cancelled: inner.cancelled.clone(),
                }),
                Arc::new(tastedev_update::DryRunner),
                InstallKind::Portable {
                    dir: dir.path().into(),
                },
                dir.path().join("tastestudio.exe"),
                dir.path().join("updates"),
                tastedev_update::RELEASES_URL.into(),
                false,
                "x86_64".into(),
                Arc::new(|_| true),
            );
            inner.release = Some(release);
            inner.file = Some(file);
            inner.status.stage = "ready".into();
        }
        assert_eq!(
            updates.action("install", None, true).err().as_deref(),
            Some("workspace-busy")
        );
        assert_eq!(
            updates.action("install", None, false).err().as_deref(),
            Some("verification")
        );
        assert!(!dir.path().join("updates/install-0.2.0.ps1").exists());
    }
    #[cfg(windows)]
    #[test]
    fn update_helper_survives_parent_job_exit() {
        use std::os::windows::io::AsRawHandle;
        const ENV: &str = "TASTESTUDIO_UPDATE_HELPER_TEST";
        if let Some(marker) = std::env::var_os(ENV) {
            let job = crate::job::ProcessJob::attach_app(unsafe {
                windows_sys::Win32::System::Threading::GetCurrentProcess()
            })
            .unwrap();
            let script = format!(
                "Start-Sleep -Seconds 2; Set-Content -LiteralPath {} -Value survived",
                tastedev_update::powershell_quote(&PathBuf::from(marker).to_string_lossy())
            );
            InstallerRunner
                .spawn(
                    "powershell.exe",
                    &[
                        "-NoProfile".into(),
                        "-NonInteractive".into(),
                        "-Command".into(),
                        script,
                    ],
                )
                .unwrap();
            // Close the parent job normally when this isolated test process exits.
            std::mem::forget(job);
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let marker = dir.path().join("survived.txt");
        let mut command = std::process::Command::new(std::env::current_exe().unwrap());
        use std::os::windows::process::CommandExt;
        command
            .args([
                "--exact",
                "update::tests::update_helper_survives_parent_job_exit",
            ])
            .env(ENV, &marker)
            .creation_flags(0x0800_0000);
        let mut child = command.spawn().unwrap();
        let _handle = child.as_raw_handle();
        assert!(child.wait().unwrap().success());
        for _ in 0..100 {
            if marker.exists() {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        assert_eq!(fs::read_to_string(marker).unwrap().trim(), "survived");
    }
    #[test]
    #[ignore = "Explicit public network smoke gate, run once separately"]
    fn live_public_release_metadata() {
        let network = Network {
            cancelled: Arc::new(AtomicBool::new(false)),
        };
        let bytes = network.get(tastedev_update::RELEASES_URL).unwrap();
        let release = tastedev_update::latest(&bytes, PRODUCT.tag_prefix)
            .unwrap()
            .unwrap();
        assert!(release.tag.starts_with("studio-v"));
        assert!(release.version >= PRODUCT.current());
        let nsis = InstallKind::Nsis {
            dir: "C:/Studio".into(),
        };
        let asset =
            tastedev_update::pick_asset(&release, PRODUCT.package, &nsis, "x86_64").unwrap();
        assert!(asset.verifiable());
        assert!(tastedev_update::trusted_url(
            &asset.url,
            &release.tag,
            false
        ));
        let directory = PathBuf::from(
            std::env::var_os("TASTESTUDIO_UPDATE_EVIDENCE_DIR")
                .expect("Set the approved download evidence directory"),
        );
        let file =
            tastedev_update::fetch_asset(asset, &release.tag, &directory, false, &network, &|_| {})
                .unwrap();
        tastedev_update::verify_file(&file, asset).unwrap();
        fs::write(directory.join("verified-download.json"), serde_json::to_vec_pretty(&serde_json::json!({"release":release.tag,"name":asset.name,"size":asset.size,"sha256":asset.sha256,"result":"PASS","installerExecuted":false})).unwrap()).unwrap();
        println!(
            "Actual public Studio release: {}; signed-release asset selection/digest contract PASS",
            release.tag
        );
    }
}
