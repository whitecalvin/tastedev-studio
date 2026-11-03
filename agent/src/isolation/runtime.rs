//! Live Agent-context qualification, separate from Core project Runs.
use super::{
    catalog::{ApprovedProgram, Catalog},
    journal::{Binding, Journal},
    windows::{LeafCommand, LeafExit},
};
use crate::model::{no_links, Request, Requirements, Result, VERSION};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        OnceLock,
    },
    time::{Duration, Instant},
};

struct Runtime {
    catalog: Catalog,
    root: PathBuf,
    agent: String,
    _image_checksum: String,
    versions: BTreeMap<String, String>,
    child_process_limit: u32,
    // Real exclusive handle, not a persisted PID or a receipt-file assertion.
    _lease: fs::File,
}
static RUNTIME: OnceLock<Runtime> = OnceLock::new();
pub(super) fn qualified_process_limit() -> Option<u32> {
    RUNTIME.get().map(|runtime| runtime.child_process_limit)
}
struct LiveQualification {
    boundary: BTreeMap<String, bool>,
    versions: BTreeMap<String, String>,
    child_process_limit: u32,
}

fn live(request: &Request) -> Result<&'static Runtime> {
    let runtime = RUNTIME
        .get()
        .ok_or("Required OS execution isolation backend is not qualified")?;
    if request.agent_id != runtime.agent {
        return Err("Qualified Agent execution identity mismatch".into());
    }
    if request.requirements.execution_isolation != Some(1) {
        return Err("Required execution isolation identity missing".into());
    }
    Ok(runtime)
}
fn qualified(request: &Request) -> Result<&'static Runtime> {
    let runtime = live(request)?;
    if request
        .isolation
        .as_ref()
        .is_some_and(|policy| policy.process_limit() > runtime.child_process_limit)
    {
        return Err("Bounded descendants are not qualified in this Agent context".into());
    }
    if request.source.is_some() {
        return Err("Source preparation requires the trusted data broker".into());
    }
    request
        .isolation
        .as_ref()
        .ok_or("Explicit isolation policy required")?
        .validate_approval(&request.requirements)?;
    if request.requirements.execution_isolation != Some(1) {
        return Err("Required execution isolation identity missing".into());
    }
    // No host-side PATH/tool probes, framework launcher, service or transfer
    // fallback. These combinations need their own bounded broker contract.
    if request.requirements.docker.is_some()
        || request.requirements.browser.is_some()
        || request.requirements.framework_runtime.is_some()
        || request.browser.is_some()
        || request.healthcheck.is_some()
        || request.artifact_transfer.is_some()
    {
        return Err(
            "Requested workflow is not supported by the qualified isolated leaf broker".into(),
        );
    }
    runtime
        .catalog
        .resolve(&request.executable)?
        .validate_process_limit(
            request
                .isolation
                .as_ref()
                .ok_or("Isolation policy required")?
                .process_limit(),
        )?;
    observed_runtimes(request)?;
    if let Some(transfer) = &request.build_artifact_transfer {
        transfer.validate(request)?;
    }
    super::context::parse(request)?;
    Ok(runtime)
}

pub(super) fn observed_runtimes(request: &Request) -> Result<BTreeMap<String, String>> {
    let runtime = live(request)?;
    let source = (request.stage.as_deref() == Some("source")
        && request
            .source
            .as_ref()
            .is_some_and(|v| v.provider == "snapshot"))
        || super::trusted_cleanup(request)?;
    let mut candidates = Vec::new();
    for program in runtime.catalog.programs() {
        if !source && program.id() != request.executable {
            continue;
        }
        if let (Some(spec), Some(actual)) = (program.runtime(), runtime.versions.get(program.id()))
        {
            candidates.push((spec.name.clone(), actual.clone()));
        }
    }
    super::versions::select(
        request.requirements.runtimes.as_ref(),
        candidates.into_iter(),
    )
}

pub(super) fn verify_request(request: &Request) -> Result<()> {
    if super::trusted_cleanup(request)? {
        live(request)?;
        super::context::parse(request)?;
        return Ok(());
    }
    if request.stage.as_deref() == Some("source")
        && request
            .source
            .as_ref()
            .is_some_and(|source| source.provider == "snapshot")
    {
        live(request)?;
        // Source preparation is a fixed data-only broker, not permission to
        // run the Source step's executable/args or a host-selected PATH tool.
        let source = request.source.as_ref().ok_or("Snapshot Source required")?;
        crate::snapshot::validate(source)?;
        let snapshot = source
            .snapshot
            .as_ref()
            .ok_or("Snapshot Source reference required")?;
        super::context::verify(request, snapshot)?;
        if request.healthcheck.is_some()
            || request.browser.is_some()
            || request.build_artifact_transfer.is_some()
            || request.artifact_transfer.is_some()
        {
            return Err("Unexpected Source preparation operation".into());
        }
        return Ok(());
    }
    qualified(request).map(|_| ())
}

pub(super) fn execute(
    request: &Request,
    root: &Path,
    cancel: &std::sync::Arc<AtomicBool>,
    observer: &mut super::OutputObserver<'_>,
) -> Result<super::CommandExit> {
    let runtime = qualified(request)?;
    no_links(root)?;
    if root
        .canonicalize()
        .map_err(|_| "Qualified workspace unavailable")?
        != runtime.root
    {
        return Err("Qualified Agent workspace identity mismatch".into());
    }
    if cancel.load(Ordering::SeqCst) {
        return Ok(super::CommandExit::Cancelled);
    }
    let deadline = Instant::now()
        .checked_add(Duration::from_millis(request.timeout_ms))
        .ok_or("Isolated command budget invalid")?;
    let prepared = super::prepared::Prepared::using_catalog_controlled(
        request,
        root,
        &runtime.catalog,
        cancel,
    )?;
    let operation = (|| {
        prepared.install_inputs(request, cancel, deadline)?;
        observer.artifact_installation = crate::build_artifact::installation_report(request);
        let outcome = prepared.execute(request, cancel, observer)?;
        let captured = if outcome == LeafExit::Completed(0) {
            prepared.stage_outputs(request, root, cancel, deadline)?
        } else {
            Vec::new()
        };
        Ok::<_, String>((outcome, captured))
    })();
    let cleanup = prepared.close();
    cleanup?;
    let (outcome, captured) = operation?;
    // Private process/profile is gone before authenticated parent IO. A complete
    // immutable staging manifest survives a failed transfer or restart.
    if outcome == LeafExit::Completed(0) && request.build_artifact_transfer.is_some() {
        if let Err(error) =
            crate::build_artifact::upload_captured(request, captured, cancel, deadline)
        {
            if cancel.load(Ordering::SeqCst) {
                return Ok(super::CommandExit::Cancelled);
            }
            if Instant::now() >= deadline {
                return Ok(super::CommandExit::TimedOut);
            }
            return Err(error);
        }
    }
    Ok(match outcome {
        LeafExit::Completed(code) => super::CommandExit::Completed(code),
        LeafExit::TimedOut => super::CommandExit::TimedOut,
        LeafExit::Cancelled => super::CommandExit::Cancelled,
    })
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Bootstrap {
    version: u32,
    agent_id: String,
    project_id: String,
    run_id: String,
    job_id: String,
}
impl Bootstrap {
    fn new(agent: &str) -> Self {
        Self {
            version: 1,
            agent_id: agent.into(),
            project_id: "agent-self-check".into(),
            run_id: uuid::Uuid::new_v4().to_string(),
            job_id: uuid::Uuid::new_v4().to_string(),
        }
    }
    fn validate(&self, agent: &str) -> Result<()> {
        if self.version != 1
            || self.agent_id != agent
            || self.project_id != "agent-self-check"
            || [&self.run_id, &self.job_id]
                .iter()
                .any(|id| !uuid::Uuid::parse_str(id).is_ok_and(|v| v.get_version_num() == 4))
        {
            return Err("Isolation bootstrap identity mismatch".into());
        }
        Ok(())
    }
    fn request(&self) -> Request {
        // Internal ownership context only. Never enqueued, sent to Core, or
        // represented as a real project Snapshot/Run/Test result.
        Request {
            protocol_version: VERSION,
            kind: "execute".into(),
            agent_id: self.agent_id.clone(),
            job_id: self.job_id.clone(),
            run_id: self.run_id.clone(),
            project_id: self.project_id.clone(),
            requirements: Requirements::default(),
            isolation: None,
            executable: "agent-self-check".into(),
            args: vec![],
            cwd: ".".into(),
            env: BTreeMap::new(),
            timeout_ms: 30000,
            run_step_id: None,
            stage: None,
            source: None,
            healthcheck: None,
            browser: None,
            artifact_transfer: None,
            build_artifact_transfer: None,
        }
    }
}
fn read_bounded(path: &Path) -> Result<Vec<u8>> {
    no_links(path)?;
    let mut bytes = Vec::new();
    fs::File::open(path)
        .map_err(|_| "Isolation bootstrap record unavailable")?
        .take(16385)
        .read_to_end(&mut bytes)
        .map_err(|_| "Isolation bootstrap read failed")?;
    if bytes.len() > 16384 {
        return Err("Isolation bootstrap record limit".into());
    }
    Ok(bytes)
}
fn save_new(path: &Path, value: &impl Serialize) -> Result<()> {
    no_links(path)?;
    let bytes = serde_json::to_vec(value).map_err(|_| "Isolation bootstrap encoding failed")?;
    if bytes.len() > 16384 {
        return Err("Isolation bootstrap record limit".into());
    }
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| "New isolation bootstrap record required")?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Isolation bootstrap persistence failed".into())
}
fn begin(root: &Path, agent: &str) -> Result<Bootstrap> {
    let current = root.join("current.json");
    no_links(&current)?;
    if current.exists() {
        let bytes = read_bounded(&current)?;
        let previous: Bootstrap =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid isolation bootstrap record")?;
        previous.validate(agent)?;
        let owner = root
            .join("runs")
            .join(&previous.run_id)
            .join(format!("isolation-{}.owner", previous.job_id));
        let reservation = owner.with_extension("reservation");
        no_links(&owner)?;
        no_links(&reservation)?;
        // Context publication can precede reservation. The OS profile API is
        // never called until the durable reservation exists. Absence of both
        // records therefore means creation was not started, not cleanup PASS.
        if owner
            .try_exists()
            .map_err(|_| "Bootstrap owner lookup failed")?
            || reservation
                .try_exists()
                .map_err(|_| "Bootstrap reservation lookup failed")?
        {
            Journal::recover_claim(
                agent,
                &serde_json::to_value(&previous)
                    .map_err(|_| "Invalid bootstrap recovery identity")?,
                root,
            )?;
        }
        // Keep the exact earlier record. Advance only after exact recovery or
        // confirmed closed state, never over a reserved-name review failure.
        let history = root.join(format!("context-{}.json", previous.job_id));
        if history.exists() {
            if read_bounded(&history)? != bytes {
                return Err("Bootstrap history conflict".into());
            }
        } else {
            fs::hard_link(&current, &history)
                .map_err(|_| "Bootstrap history preservation failed")?;
        }
    }
    let record = Bootstrap::new(agent);
    let pending = root.join(format!("pending-{}.json", record.job_id));
    save_new(&pending, &record)?;
    // Atomic replacement; no OS profile is created until the new current
    // context is durable. A leftover pending file has never authorized creation.
    fs::rename(&pending, &current).map_err(|_| "Bootstrap context publication failed")?;
    Ok(record)
}

const REQUIRED: [&str; 12] = [
    "readDenied",
    "writeDenied",
    "networkDenied",
    "childDenied",
    "credentialAbsent",
    "nonInteractive",
    "interactiveReadDenied",
    "outsideWindowDenied",
    "privateDesktop",
    "privateStation",
    "inputDesktopSwitchDenied",
    "hostStationSwitchDenied",
];
fn check_boundary(bytes: &[u8]) -> Result<BTreeMap<String, bool>> {
    let report: BTreeMap<String, bool> =
        serde_json::from_slice(bytes).map_err(|_| "Malformed live isolation report")?;
    if report.len() != REQUIRED.len() + 1
        || !report.contains_key("screenDcDenied")
        || REQUIRED.iter().any(|key| report.get(*key) != Some(&true))
    {
        return Err("Live isolation boundary check failed".into());
    }
    // A private-station DC can exist. No host pixel-copy PASS is inferred.
    Ok(report)
}

struct Canary(*mut std::ffi::c_void);
impl Canary {
    fn new() -> Result<Self> {
        use windows_sys::Win32::UI::WindowsAndMessaging::{CreateWindowExW, GetWindowTextW};
        let wide = |s: &str| s.encode_utf16().chain(Some(0)).collect::<Vec<_>>();
        // New hidden, test-owned static window only; never enumerate user UI.
        let window = unsafe {
            CreateWindowExW(
                0,
                wide("STATIC").as_ptr(),
                wide("Dummy isolation canary").as_ptr(),
                0,
                0,
                0,
                1,
                1,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
            )
        };
        if window.is_null() {
            return Err("Isolation canary window unavailable".into());
        }
        let canary = Self(window);
        let mut text = [0u16; 128];
        if unsafe { GetWindowTextW(window, text.as_mut_ptr(), 128) } == 0 {
            return Err("Isolation canary baseline failed".into());
        }
        Ok(canary)
    }
}
impl Drop for Canary {
    fn drop(&mut self) {
        unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::DestroyWindow(self.0);
        }
    }
}

pub(super) fn initialize(
    catalog: &Path,
    root: &Path,
    agent: &str,
    token_key: &str,
    cancel: &AtomicBool,
) -> Result<()> {
    use std::os::windows::fs::OpenOptionsExt;
    if RUNTIME.get().is_some() {
        return Err("Isolation runtime already initialized".into());
    }
    if token_key.is_empty()
        || token_key.len() > 128
        || !token_key
            .bytes()
            .all(|v| v.is_ascii_alphanumeric() || v == b'_')
        || std::env::var_os(token_key).is_none()
    {
        return Err("Parent credential environment identity unavailable".into());
    }
    if cancel.load(Ordering::SeqCst) {
        return Err("Isolation qualification cancelled".into());
    }
    let catalog = Catalog::load(catalog, root)?;
    let lease_path = root.join("isolation-runtime.lease");
    no_links(&lease_path)?;
    let lease = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .share_mode(0)
        .open(&lease_path)
        .map_err(|_| "Isolation runtime is held by another live Agent")?;
    let bootstrap_root = root.join("isolation-self-check");
    no_links(&bootstrap_root)?;
    fs::create_dir_all(&bootstrap_root).map_err(|_| "Isolation bootstrap directory unavailable")?;
    no_links(&bootstrap_root)?;
    let record = begin(&bootstrap_root, agent)?;
    let request = record.request();
    let own_image = ApprovedProgram::self_image()?;
    let image_checksum = own_image.checksum().to_owned();
    let reservation = Journal::reserve(
        &request,
        &bootstrap_root,
        Binding {
            snapshot_id: uuid::Uuid::new_v4().to_string(),
            source_checksum: format!(
                "{:x}",
                Sha256::digest(b"internal qualification only; no project Source")
            ),
            program_id: own_image.id().into(),
            program_checksum: image_checksum.clone(),
            bundle_checksum: None,
            process_limit: None,
        },
    )?;
    let profile = reservation.create_profile()?;
    let journal = reservation.claim(&profile)?;
    let run = crate::pipeline::cwd(&bootstrap_root, &record.run_id, ".")?;
    let operation = (|| -> Result<LiveQualification> {
        if cancel.load(Ordering::SeqCst) {
            return Err("Isolation qualification cancelled".into());
        }
        let directory = profile.root.join("self-check");
        fs::create_dir(&directory).map_err(|_| "Private probe directory unavailable")?;
        profile.permit(&directory, true)?;
        let program = profile.prepare_program(&own_image)?;
        let outside = run.join("outside.txt");
        save_dummy(&outside)?;
        let listener = std::net::TcpListener::bind("127.0.0.1:0")
            .map_err(|_| "Isolation loopback canary unavailable")?;
        let socket = listener
            .local_addr()
            .map_err(|_| "Isolation loopback address unavailable")?;
        let _baseline = std::net::TcpStream::connect_timeout(&socket, Duration::from_secs(2))
            .map_err(|_| "Isolation loopback baseline failed")?;
        if fs::read(&outside).map_err(|_| "Canary baseline read failed")? != b"dummy-only-original"
            || fs::OpenOptions::new().write(true).open(&outside).is_err()
        {
            return Err("Isolation file baseline failed".into());
        }
        let canary = Canary::new()?;
        let report_path = directory.join("report.json");
        let environment = BTreeMap::from([
            ("PROBE_MODE".into(), "boundary".into()),
            (
                "PROBE_REPORT".into(),
                report_path.to_string_lossy().into_owned(),
            ),
            (
                "PROBE_OUTSIDE".into(),
                outside.to_string_lossy().into_owned(),
            ),
            ("PROBE_SOCKET".into(), socket.to_string()),
            (
                "PROBE_CANARY_WINDOW".into(),
                (canary.0 as usize).to_string(),
            ),
            (
                "PROBE_EXPECTED_DESKTOP".into(),
                format!("TASTESTUDIO-{}", profile.identity()),
            ),
            (
                "PROBE_EXPECTED_STATION".into(),
                format!("TASTESTUDIO-Station-{}", profile.identity()),
            ),
            // Name only. The credential value stays exclusively in the parent.
            ("PROBE_PARENT_ENV_NAME".into(), token_key.into()),
        ]);
        let mut environment = environment;
        environment.insert("PROBE_EXPECTED_SID".into(), profile.owned_identity()?.sid);
        let args = vec!["--isolation-self-check-child".into()];
        match profile.execute(LeafCommand {
            max_processes: 1,
            program: &program.path,
            args: &args,
            cwd: &directory,
            environment: &environment,
            timeout_ms: 30000,
            cancel: Some(cancel),
        })? {
            LeafExit::Completed(0) => (),
            LeafExit::Completed(_) => return Err("Isolation qualification child failed".into()),
            LeafExit::TimedOut => return Err("Isolation qualification timeout".into()),
            LeafExit::Cancelled => return Err("Isolation qualification cancelled".into()),
        }
        let report = check_boundary(&read_bounded(&report_path)?)?;
        if fs::read(&outside).map_err(|_| "Canary result unavailable")? != b"dummy-only-original" {
            return Err("Isolation canary changed".into());
        }
        let child_process_limit = catalog
            .programs()
            .map(ApprovedProgram::process_limit)
            .max()
            .unwrap_or(1);
        for limit in 2..=child_process_limit {
            let path = directory.join(format!("report-children-{limit}.json"));
            environment.insert("PROBE_REPORT".into(), path.to_string_lossy().into_owned());
            environment.insert("PROBE_MODE".into(), "spawn-boundary".into());
            environment.insert("PROBE_CHAIN_DEPTH".into(), (limit - 1).to_string());
            if profile.execute(LeafCommand {
                max_processes: limit,
                program: &program.path,
                args: &args,
                cwd: &directory,
                environment: &environment,
                timeout_ms: 30000,
                cancel: Some(cancel),
            })? != LeafExit::Completed(0)
            {
                return Err("Live private descendant qualification failed".into());
            }
            check_boundary(&read_bounded(&path)?)?;
            if fs::read(&outside).map_err(|_| "Descendant canary result unavailable")?
                != b"dummy-only-original"
            {
                return Err("Descendant canary changed".into());
            }
        }
        let versions = super::versions::probe(&catalog, &profile, cancel)?;
        Ok(LiveQualification {
            boundary: report,
            versions,
            child_process_limit,
        })
    })();
    // Program locks above are dropped before explicit profile cleanup. Neither
    // a report nor an exit code can qualify a runtime with incomplete cleanup.
    let cleanup = profile.close().and_then(|_| journal.closed());
    let result = serde_json::json!({"version":1,"context":record,"imageChecksum":image_checksum,"boundary":operation.as_ref().ok().map(|v| &v.boundary),"observedVersions":operation.as_ref().ok().map(|v| &v.versions),"childProcessLimit":operation.as_ref().ok().map(|v|v.child_process_limit),"error":operation.as_ref().err(),"cleanupError":cleanup.as_ref().err(),"qualified":operation.is_ok() && cleanup.is_ok(),"scope":"internal-live-agent-probe; not Core project Run or Godot/framework execution"});
    save_new(&run.join("qualification.json"), &result)?;
    cleanup?;
    let LiveQualification {
        versions,
        child_process_limit,
        ..
    } = operation?;
    if cancel.load(Ordering::SeqCst) {
        return Err("Isolation qualification cancelled".into());
    }
    RUNTIME
        .set(Runtime {
            catalog,
            root: root.into(),
            agent: agent.into(),
            _image_checksum: image_checksum,
            versions,
            child_process_limit,
            _lease: lease,
        })
        .map_err(|_| "Isolation runtime initialization conflict".to_string())?;
    eprintln!("Live execution isolation qualified for operator-registered command runtimes");
    Ok(())
}

fn save_dummy(path: &Path) -> Result<()> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| "New Dummy canary required")?;
    file.write_all(b"dummy-only-original")
        .and_then(|_| file.sync_all())
        .map_err(|_| "Dummy canary persistence failed".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn every_required_boundary_must_be_true_and_report_schema_is_exact() {
        let mut report: BTreeMap<String, bool> =
            REQUIRED.iter().map(|key| ((*key).into(), true)).collect();
        report.insert("screenDcDenied".into(), false);
        assert!(check_boundary(&serde_json::to_vec(&report).unwrap()).is_ok());
        for key in REQUIRED {
            let mut changed = report.clone();
            changed.insert(key.into(), false);
            assert!(
                check_boundary(&serde_json::to_vec(&changed).unwrap()).is_err(),
                "{key}"
            );
            changed.remove(key);
            assert!(
                check_boundary(&serde_json::to_vec(&changed).unwrap()).is_err(),
                "{key}"
            );
        }
        report.insert("untrustedExtra".into(), true);
        assert!(check_boundary(&serde_json::to_vec(&report).unwrap()).is_err());
        assert!(check_boundary(br#"{"readDenied":"true"}"#).is_err());
    }
    #[test]
    fn bootstrap_scope_is_not_a_core_project_and_rejects_foreign_identity() {
        let record = Bootstrap::new("agent");
        assert!(record.validate("agent").is_ok());
        assert!(record.validate("another-agent").is_err());
        let request = record.request();
        assert!(
            request.source.is_none()
                && request.env.is_empty()
                && request.artifact_transfer.is_none()
        );
        let mut value = serde_json::to_value(record).unwrap();
        value["projectId"] = serde_json::json!("real-project");
        assert!(serde_json::from_value::<Bootstrap>(value.clone())
            .unwrap()
            .validate("agent")
            .is_err());
        value["credential"] = serde_json::json!("dummy");
        assert!(serde_json::from_value::<Bootstrap>(value).is_err());
    }

    #[test]
    fn bootstrap_restart_preserves_history_and_foreign_agent_cannot_advance() {
        let directory = tempfile::tempdir().unwrap();
        let first = begin(directory.path(), "agent").unwrap();
        let bytes = fs::read(directory.path().join("current.json")).unwrap();
        assert!(begin(directory.path(), "foreign").is_err());
        assert_eq!(
            fs::read(directory.path().join("current.json")).unwrap(),
            bytes
        );
        let second = begin(directory.path(), "agent").unwrap();
        assert_ne!(first.run_id, second.run_id);
        assert_eq!(
            fs::read(
                directory
                    .path()
                    .join(format!("context-{}.json", first.job_id))
            )
            .unwrap(),
            bytes
        );
        assert!(
            !directory.path().join("runs").exists(),
            "No OS profile or Core Run is created by context publication"
        );
    }

    #[test]
    #[ignore = "Starts the explicitly selected real Agent twice with a Dummy token; live private probe, no Core tasks"]
    fn actual_agent_startup_rechecks_context_and_never_trusts_a_previous_result() {
        use std::{
            process::{Command, Stdio},
            time::Instant,
        };
        let executable = std::env::var_os("TASTESTUDIO_VERIFY_AGENT_EXE")
            .map(PathBuf::from)
            .expect("Select the actual production Agent explicitly");
        assert!(executable.is_absolute() && executable.is_file());
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        let fixture = tempfile::tempdir_in(base).unwrap();
        let root = fixture.path().join("workspace");
        fs::create_dir(&root).unwrap();
        fs::write(root.join("source-canary.txt"), b"existing saved user state").unwrap();
        let catalog = fixture.path().join("operator-runtimes.json");
        let checksum = format!("{:x}", Sha256::digest(fs::read(&executable).unwrap()));
        save_new(&catalog, &serde_json::json!({"version":1,"backend":"windows-private-appcontainer-v1","programs":[{"id":"engine","executable":executable,"checksum":checksum}]})).unwrap();
        let config = fixture.path().join("agent.json");
        save_new(&config, &serde_json::json!({"endpoint":"ws://127.0.0.1:1/agent","name":"Internal qualification fixture","workspaceRoot":root,"isolationCatalog":catalog})).unwrap();
        let mut previous_run = None;
        for iteration in 0..2 {
            let diagnostics = fixture.path().join(format!("agent-{iteration}.stderr"));
            let mut command = Command::new(&executable);
            command
                .args(["--config", config.to_str().unwrap()])
                .env_clear()
                .env("SystemRoot", std::env::var_os("SystemRoot").unwrap())
                .env("PATH", std::env::var_os("PATH").unwrap_or_default())
                .env("TASTEDEV_AGENT_TOKEN", "dummy-parent-token-not-for-source")
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(fs::File::create(&diagnostics).unwrap());
            let (mut child, tree) = crate::tree::Tree::spawn(&mut command).unwrap();
            let operation = (|| -> Result<(String, serde_json::Value)> {
                let deadline = Instant::now() + Duration::from_secs(60);
                loop {
                    if child
                        .try_wait()
                        .map_err(|_| "Actual Agent observation failed")?
                        .is_some()
                    {
                        return Err(
                            "Actual Agent stopped before publishing live qualification".into()
                        );
                    }
                    if Instant::now() >= deadline {
                        return Err("Actual Agent qualification observation timeout".into());
                    }
                    let pointer = root.join("isolation-self-check/current.json");
                    if let Ok(bytes) = read_bounded(&pointer) {
                        if let Ok(context) = serde_json::from_slice::<Bootstrap>(&bytes) {
                            if previous_run.as_ref() != Some(&context.run_id) {
                                let result = root
                                    .join("isolation-self-check/runs")
                                    .join(&context.run_id)
                                    .join("qualification.json");
                                if let Ok(bytes) = read_bounded(&result) {
                                    if let Ok(result) =
                                        serde_json::from_slice::<serde_json::Value>(&bytes)
                                    {
                                        return Ok((context.run_id, result));
                                    }
                                }
                            }
                        }
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
            })();
            let terminated = tree.terminate();
            let waited = child.wait();
            drop(tree);
            terminated.unwrap();
            waited.unwrap();
            let diagnostic_bytes = read_bounded(&diagnostics).unwrap();
            let diagnostic_text = String::from_utf8_lossy(&diagnostic_bytes);
            assert!(!diagnostic_text.contains("dummy-parent-token-not-for-source"));
            let (run, result) =
                operation.unwrap_or_else(|error| panic!("{error}: {diagnostic_text}"));
            assert!(result["cleanupError"].is_null());
            assert_eq!(result["imageChecksum"], checksum);
            assert_eq!(result["context"]["projectId"], "agent-self-check");
            if result["qualified"] == true {
                check_boundary(&serde_json::to_vec(&result["boundary"]).unwrap()).unwrap();
                assert!(result["error"].is_null());
            } else {
                assert_eq!(result["qualified"], false);
                assert_eq!(
                    result["error"],
                    "Owned private station unavailable; qualified Windows broker required: 5"
                );
                assert!(result["boundary"].is_null());
            }
            let context: Bootstrap = serde_json::from_value(result["context"].clone()).unwrap();
            let owner = root
                .join("isolation-self-check/runs")
                .join(&run)
                .join(format!("isolation-{}.owner", context.job_id));
            let bytes = read_bounded(&owner).unwrap();
            assert!(bytes.ends_with(b"CLOSED\n"));
            let header: serde_json::Value =
                serde_json::from_slice(bytes.split(|c| *c == b'\n').next().unwrap()).unwrap();
            assert!(!PathBuf::from(header["profile"]["root"].as_str().unwrap()).exists());
            assert_eq!(
                fs::read(root.join("source-canary.txt")).unwrap(),
                b"existing saved user state"
            );
            assert_eq!(fs::read_dir(root.join("claims")).unwrap().count(), 0);
            eprintln!("ACTUAL_AGENT_LIVE_QUALIFICATION={{\"qualified\":{},\"cleanup\":true,\"context\":\"{}\"}}", result["qualified"], run);
            previous_run = Some(run);
        }
        // No public capability is derived from either saved outcome.
        assert_eq!(crate::executor::detect().execution_isolation, None);
    }
}
