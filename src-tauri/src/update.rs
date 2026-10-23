//! Tauri serialization/network bridge; all update transitions belong to the shared Flow.
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
use tastedev_update::{Flow, InstallKind, Product, Session, Stage, SystemRunner, Transport};

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
                "tastedev.net"
                    | "api.github.com"
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
    pub show_prompt: bool,
    pub prompt_title: Option<String>,
    pub prompt_action: Option<String>,
    pub install_notice: String,
}
struct Inner {
    flow: Flow,
    preference: PathBuf,
    cancelled: Arc<AtomicBool>,
    cancelled_ui: bool,
    previous_result: Option<String>,
}
pub struct Updates(Mutex<Inner>);
impl Inner {
    fn status(&self) -> Status {
        use tastedev_update::Status as SharedStatus;
        let card = self.flow.status();
        let stage = match self.flow.stage() {
            _ if self.flow.exit_confirmation() => "exit-confirmation",
            _ if self.flow.prepared() => "ready",
            Stage::Downloading(_) => "downloading",
            Stage::Installing(_) => "installing",
            Stage::Failed { .. } => "error",
            _ if self.cancelled_ui => "cancelled",
            _ => match card {
                SharedStatus::Checking => "checking",
                SharedStatus::Latest => "current",
                SharedStatus::Available(_) => "available",
                SharedStatus::Failed(_) => "error",
                SharedStatus::Unchecked => "idle",
            },
        };
        let release = self.flow.release().or_else(|| self.flow.available());
        let (downloaded, total) = self
            .flow
            .session()
            .map(Session::progress)
            .unwrap_or_default();
        Status {
            stage: stage.into(),
            current_version: PRODUCT.version.into(),
            version: release.map(|r| r.version.to_string()),
            notes: release.map(Flow::notes).unwrap_or_default(),
            page: release.map(|r| r.page.clone()),
            can_install: release.is_some_and(|r| self.flow.can_install(r)),
            auto_check: self.flow.auto(),
            downloaded,
            total,
            error: (stage == "error").then(|| "update-failed".into()),
            previous_result: self.previous_result.clone(),
            show_prompt: self.flow.showing(),
            prompt_title: self.flow.prompt_texts().map(|(title, _)| title.into()),
            prompt_action: self.flow.prompt_texts().map(|(_, action)| action.into()),
            install_notice: self.flow.install_notice().into(),
        }
    }
}
impl Updates {
    pub fn requires_exit(&self) -> bool {
        self.0
            .lock()
            .is_ok_and(|inner| inner.flow.prepared() || inner.flow.exit_confirmation())
    }

    pub fn reject_exit(&self) {
        if let Ok(mut inner) = self.0.lock() {
            inner.flow.reject_exit();
        }
    }
    pub fn new(data: &Path, cache: &Path) -> Self {
        let preference = data.join("auto-update.json");
        let auto_check = match fs::read(&preference) {
            Ok(bytes) => serde_json::from_slice::<bool>(&bytes).unwrap_or(false),
            Err(error) => error.kind() == std::io::ErrorKind::NotFound,
        };
        let cancelled = Arc::new(AtomicBool::new(false));
        let exe = std::env::current_exe().unwrap_or_default();
        let mut kind = tastedev_update::detect_current(PRODUCT.package, &exe);
        if exe.components().any(|part| part.as_os_str() == "target") {
            kind = InstallKind::Unsupported(tastedev_update::Unsupported::Development);
        }
        let mut session = Session::with_parts(
            PRODUCT,
            Arc::new(Network {
                cancelled: cancelled.clone(),
            }),
            Arc::new(SystemRunner),
            kind,
            exe,
            cache.join("updates"),
            tastedev_update::list_url(PRODUCT.tag_prefix),
            false,
            std::env::consts::ARCH.into(),
            Arc::new(|p| p.exists()),
        );
        session.set_signature_check(tastedev_update::gxsoft_release_signature());
        let previous_result = session.take_last_result().map(|r| match r {
            tastedev_update::InstallResult::Ok(_) => "installed".into(),
            _ => "failed".into(),
        });
        // Creation is lazy with auto checking off, just like the native desktop adapters.
        let mut flow = Flow::start(false, move || session, Arc::new(|| {}));
        flow.set_auto(auto_check);
        Self(Mutex::new(Inner {
            flow,
            preference,
            cancelled,
            cancelled_ui: false,
            previous_result,
        }))
    }
    pub fn action(
        &self,
        action: &str,
        enabled: Option<bool>,
        protected: bool,
    ) -> Result<(Status, bool), String> {
        let mut inner = self.0.lock().map_err(|_| "internal")?;
        let wake: tastedev_update::Waker = Arc::new(|| {});
        if action == "install"
            && protected
            && (inner.flow.prepared() || inner.flow.exit_confirmation())
        {
            return Err("workspace-busy".into());
        }
        if matches!(inner.flow.stage(), Stage::Installing(_))
            && matches!(action, "install" | "check" | "cancel")
        {
            return Err("busy".into());
        }
        if matches!(inner.flow.stage(), Stage::Downloading(_))
            && matches!(action, "install" | "check")
        {
            return Err("busy".into());
        }
        // Cancel before polling: an already completed download must not hand off after cancellation.
        if action == "cancel" {
            inner.cancelled.store(true, Ordering::Relaxed);
            inner.flow.later();
            inner.cancelled_ui = true;
        }
        if action != "cancel"
            && matches!(inner.flow.stage(), Stage::Idle)
            && inner.flow.session().is_none_or(|session| !session.busy())
        {
            inner.cancelled.store(false, Ordering::Relaxed);
        }
        if inner.flow.poll(&wake).is_some() && !inner.cancelled.load(Ordering::Relaxed) {
            inner.cancelled_ui = false;
        }
        match action {
            "status" | "cancel" => {}
            "release" => {
                if inner.flow.available().is_none() && inner.flow.release().is_none() {
                    return Err("invalid".into());
                }
                inner.flow.open_page();
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
                inner.flow.set_auto(enabled);
            }
            "check" => {
                if matches!(inner.flow.stage(), Stage::Downloading(_)) {
                    return Err("busy".into());
                }
                inner.cancelled.store(false, Ordering::Relaxed);
                inner.cancelled_ui = false;
                inner.flow.later();
                if !inner.flow.check_now(&wake) {
                    return Err("busy".into());
                }
            }
            "install" => {
                if matches!(inner.flow.stage(), Stage::Downloading(_)) {
                    return Err("busy".into());
                }
                if !inner.flow.exit_confirmation() {
                    let release = inner.flow.available().ok_or("invalid")?;
                    if !inner.flow.can_install(release) {
                        return Err("unsupported".into());
                    }
                }
                inner.cancelled.store(false, Ordering::Relaxed);
                inner.cancelled_ui = false;
                let show_cached_prompt = !inner.flow.exit_confirmation()
                    && !inner.flow.prepared()
                    && inner.flow.has_prepared();
                if !inner.flow.exit_confirmation() {
                    inner.flow.offer(&wake);
                }
                if !show_cached_prompt {
                    inner.flow.install(&wake);
                }
            }
            // Old two-step installation is intentionally not a second engine.
            _ => return Err("invalid".into()),
        }
        let status = inner.status();
        Ok((status, inner.flow.take_quit()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tastedev_update::Runner;

    #[test]
    fn shared_flow_is_send_and_studio_uses_the_site_endpoint() {
        fn send<T: Send>() {}
        send::<Flow>();
        send::<Updates>();
        assert_eq!(
            tastedev_update::site_updates_url(PRODUCT.tag_prefix).as_deref(),
            Some("https://tastedev.net/api/updates/studio")
        );
        assert!(redirect_allowed(
            &reqwest::Url::parse("https://tastedev.net/api/updates/studio").unwrap()
        ));
    }
    fn fixture_updates() -> (
        Updates,
        tastedev_update::testing::Fixture,
        tastedev_update::testing::Harness,
    ) {
        use tastedev_update::testing::{fixture, harness};
        let product = Product {
            version: "0.0.1",
            ..PRODUCT
        };
        let fx = fixture(
            &product,
            "0.2.0",
            &["tastestudio_0.2.0_windows_x64.zip"],
            None,
        );
        let h = harness(
            product,
            &fx,
            InstallKind::Portable {
                dir: "C:/Studio".into(),
            },
            "C:/Studio/tastestudio.exe",
            &[],
        );
        let session = Session::with_parts(
            product,
            h.net.clone(),
            h.runner.clone(),
            InstallKind::Portable {
                dir: "C:/Studio".into(),
            },
            "C:/Studio/tastestudio.exe".into(),
            h.work.0.clone(),
            fx.url(),
            true,
            "x86_64".into(),
            Arc::new(|_| true),
        );
        let updates = Updates(Mutex::new(Inner {
            flow: Flow::start(false, move || session, Arc::new(|| {})),
            preference: h.work.0.join("preference.json"),
            cancelled: Arc::new(AtomicBool::new(false)),
            cancelled_ui: false,
            previous_result: None,
        }));
        updates.action("check", None, false).unwrap();
        pump(&updates, "available");
        (updates, fx, h)
    }
    fn pump(updates: &Updates, stage: &str) -> Status {
        let start = std::time::Instant::now();
        loop {
            let (status, quit) = updates.action("status", None, false).unwrap();
            assert!(!quit, "Windows update must not auto-close the workspace");
            if status.stage == stage {
                return status;
            }
            assert!(
                start.elapsed() < Duration::from_secs(20),
                "expected {stage}, got {}",
                status.stage
            );
            std::thread::sleep(Duration::from_millis(5));
        }
    }
    #[test]
    fn shared_install_waits_preserves_payload_and_reports_postponement() {
        let (updates, _fx, h) = fixture_updates();
        assert_eq!(
            updates.action("install", None, true).err().as_deref(),
            Some("workspace-busy")
        );
        assert!(h.runner.lines().is_empty());
        assert!(
            updates.action("download", None, false).is_err(),
            "no separate download/install pipeline"
        );
        let (status, quit) = updates.action("install", None, false).unwrap();
        assert_eq!(status.stage, "downloading");
        assert!(!quit);
        assert!(updates.action("install", None, false).is_err());
        assert!(updates.action("check", None, false).is_err());
        pump(&updates, "installing");
        assert_eq!(h.runner.lines().len(), 1);
        assert!(updates.action("install", None, false).is_err());
        assert!(updates.action("check", None, false).is_err());
        assert!(updates.action("cancel", None, false).is_err());
        fs::write(
            h.work.0.join(tastedev_update::RESULT_FILE),
            "fail 0.2.0 the app is still running (postponed)\n",
        )
        .unwrap();
        let status = pump(&updates, "error");
        assert_eq!(status.error.as_deref(), Some("update-failed"));
        assert!(h.work.0.join("tastestudio_0.2.0_windows_x64.zip").exists());
    }
    #[test]
    fn shared_cancel_prevents_queued_download_from_handing_off() {
        let (updates, _fx, h) = fixture_updates();
        updates.action("install", None, false).unwrap();
        updates.action("cancel", None, false).unwrap();
        for _ in 0..50 {
            updates.action("status", None, false).unwrap();
            std::thread::sleep(Duration::from_millis(2));
        }
        assert!(h.runner.lines().is_empty());
        assert_eq!(
            updates.action("status", None, false).unwrap().0.stage,
            "cancelled"
        );
    }

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
    fn current_package_names_match_the_shared_asset_contract() {
        for (name, kind) in [
            (
                "tastedev-studio_0.2.4_windows_x64.zip",
                InstallKind::Portable {
                    dir: "C:/Studio".into(),
                },
            ),
            ("tastedev-studio_0.2.4_windows_x64.msi", InstallKind::Msi),
            (
                "tastedev-studio_0.2.4_windows_x64-setup.exe",
                InstallKind::Nsis {
                    dir: "C:/Studio".into(),
                },
            ),
        ] {
            assert!(tastedev_update::asset_name_matches(
                name,
                PRODUCT.package,
                &kind,
                "x86_64"
            ));
            assert!(!tastedev_update::asset_name_matches(
                &name.replace("studio_", "studio-agent_"),
                PRODUCT.package,
                &kind,
                "x86_64"
            ));
        }
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
            SystemRunner
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
        let bytes = network
            .get(&tastedev_update::site_updates_url(PRODUCT.tag_prefix).unwrap())
            .unwrap();
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
