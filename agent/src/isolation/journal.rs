//! Exact broker-owned profile identity, not a profile-prefix cleanup scan.
use super::windows::{OwnedIdentity, Profile};
use crate::model::{no_links, Request, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
};
const LIMIT: u64 = 16384;
const CLOSED: &[u8] = b"CLOSED\n";

#[derive(Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Binding {
    pub snapshot_id: String,
    pub source_checksum: String,
    pub program_id: String,
    pub program_checksum: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bundle_checksum: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub process_limit: Option<u32>,
}
impl Binding {
    fn validate(&self) -> Result<()> {
        if self.process_limit.is_some_and(|n| !(2..=4).contains(&n)) {
            return Err("Invalid owned process bound".into());
        }
        uuid::Uuid::parse_str(&self.snapshot_id).map_err(|_| "Invalid owned execution Snapshot")?;
        if [&self.source_checksum, &self.program_checksum]
            .iter()
            .copied()
            .chain(self.bundle_checksum.iter())
            .any(|v| {
                v.len() != 64
                    || !v
                        .bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            })
            || self.program_id.is_empty()
            || self.program_id.len() > 32
            || !self
                .program_id
                .bytes()
                .next()
                .is_some_and(|b| b.is_ascii_lowercase())
            || !self
                .program_id
                .bytes()
                .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
        {
            return Err("Invalid owned execution Source/program identity".into());
        }
        Ok(())
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Owner {
    version: u32,
    agent_id: String,
    project_id: String,
    run_id: String,
    job_id: String,
    run_step_id: Option<String>,
    binding: Binding,
    profile: OwnedIdentity,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ReservedOwner {
    version: u32,
    agent_id: String,
    project_id: String,
    run_id: String,
    job_id: String,
    run_step_id: Option<String>,
    binding: Binding,
    profile_name: String,
}
pub(super) struct Reservation<'a> {
    request: &'a Request,
    root: &'a Path,
    record: ReservedOwner,
    _file: fs::File,
}
impl Reservation<'_> {
    pub fn create_profile(&self) -> Result<Profile> {
        Profile::create_reserved(self.record.profile_name.clone())
    }
    pub fn claim(self, profile: &Profile) -> Result<Journal> {
        if profile.identity() != self.record.profile_name {
            return Err("Reserved profile creation identity mismatch".into());
        }
        Journal::claim(self.request, self.root, profile, self.record.binding)
    }
}
pub(super) struct Journal {
    file: fs::File,
}

fn path(request: &Request, root: &Path) -> Result<PathBuf> {
    uuid::Uuid::parse_str(&request.run_id).map_err(|_| "Invalid isolation journal Run")?;
    uuid::Uuid::parse_str(&request.job_id).map_err(|_| "Invalid isolation journal Job")?;
    crate::pipeline::cwd(root, &request.run_id, ".")?;
    scoped_path(
        &request.run_id,
        &request.job_id,
        request.run_step_id.as_deref(),
        root,
    )
}
fn scoped_path(run: &str, job: &str, step: Option<&str>, root: &Path) -> Result<PathBuf> {
    let legacy = path_for(run, job, root)?;
    let Some(step) = step else {
        return Ok(legacy);
    };
    uuid::Uuid::parse_str(step).map_err(|_| "Invalid isolation journal Step")?;
    let scoped = legacy.with_file_name(format!("isolation-{job}-{step}.owner"));
    no_links(&scoped)?;
    Ok(scoped)
}
fn path_for(run: &str, job: &str, root: &Path) -> Result<PathBuf> {
    uuid::Uuid::parse_str(run).map_err(|_| "Invalid isolation journal Run")?;
    uuid::Uuid::parse_str(job).map_err(|_| "Invalid isolation journal Job")?;
    let path = root
        .join("runs")
        .join(run)
        .join(format!("isolation-{job}.owner"));
    no_links(&path)?;
    Ok(path)
}
fn options() -> fs::OpenOptions {
    use std::os::windows::fs::OpenOptionsExt;
    let mut options = fs::OpenOptions::new();
    // A live broker keeps this exclusive handle. A persisted PID or lock file
    // alone is never treated as evidence that another process is still alive.
    options.read(true).write(true).share_mode(0);
    options
}
impl Journal {
    pub fn reserve<'a>(
        request: &'a Request,
        root: &'a Path,
        binding: Binding,
    ) -> Result<Reservation<'a>> {
        binding.validate()?;
        Self::ensure_new(request, root)?;
        let record = ReservedOwner {
            version: 1,
            agent_id: request.agent_id.clone(),
            project_id: request.project_id.clone(),
            run_id: request.run_id.clone(),
            job_id: request.job_id.clone(),
            run_step_id: request.run_step_id.clone(),
            binding,
            profile_name: format!("TASTESTUDIO.{}", uuid::Uuid::new_v4().simple()),
        };
        let bytes =
            serde_json::to_vec(&record).map_err(|_| "Isolation reservation encoding failed")?;
        if bytes.len() as u64 > LIMIT {
            return Err("Isolation reservation limit".into());
        }
        let reservation = path(request, root)?.with_extension("reservation");
        no_links(&reservation)?;
        let mut file = options()
            .create_new(true)
            .open(&reservation)
            .map_err(|_| "New exclusive isolation reservation required")?;
        // No OS profile may be created until this complete identity is durable.
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Isolation reservation sync failed")?;
        Ok(Reservation {
            request,
            root,
            record,
            _file: file,
        })
    }
    pub fn ensure_new(request: &Request, root: &Path) -> Result<()> {
        if path(request, root)?
            .try_exists()
            .map_err(|_| "Isolation journal unavailable")?
        {
            return Err(
                "Isolation execution already recorded; recover the existing identity first".into(),
            );
        }
        if request.run_step_id.is_some() {
            let legacy = path_for(&request.run_id, &request.job_id, root)?;
            if legacy
                .try_exists()
                .map_err(|_| "Legacy isolation journal lookup failed")?
            {
                let mut file = options()
                    .open(&legacy)
                    .map_err(|_| "Legacy isolation journal is unavailable or live")?;
                let mut bytes = Vec::new();
                (&mut file)
                    .take(LIMIT + 1)
                    .read_to_end(&mut bytes)
                    .map_err(|_| "Legacy isolation journal read failed")?;
                let end = bytes
                    .iter()
                    .position(|b| *b == b'\n')
                    .ok_or("Legacy isolation ownership incomplete")?;
                let owner: Owner = serde_json::from_slice(&bytes[..end])
                    .map_err(|_| "Invalid legacy isolation ownership")?;
                owner.binding.validate()?;
                Profile::validate_reserved_name(&owner.profile.name)?;
                if bytes.len() as u64 > LIMIT
                    || owner.version != 1
                    || owner.agent_id != request.agent_id
                    || owner.project_id != request.project_id
                    || owner.run_id != request.run_id
                    || owner.job_id != request.job_id
                    || owner.run_step_id == request.run_step_id
                    || &bytes[end + 1..] != CLOSED
                {
                    return Err(
                        "Legacy isolation execution must be recovered before a new Step".into(),
                    );
                }
            } else if legacy
                .with_extension("reservation")
                .try_exists()
                .map_err(|_| "Legacy isolation reservation lookup failed")?
            {
                return Err("Legacy isolation creation requires ownership review".into());
            }
        }
        Ok(())
    }
    pub fn claim(
        request: &Request,
        root: &Path,
        profile: &Profile,
        binding: Binding,
    ) -> Result<Self> {
        binding.validate()?;
        let owner = Owner {
            version: 1,
            agent_id: request.agent_id.clone(),
            project_id: request.project_id.clone(),
            run_id: request.run_id.clone(),
            job_id: request.job_id.clone(),
            run_step_id: request.run_step_id.clone(),
            binding,
            profile: profile.owned_identity()?,
        };
        let mut bytes =
            serde_json::to_vec(&owner).map_err(|_| "Isolation journal encoding failed")?;
        bytes.push(b'\n');
        if bytes.len() as u64 > LIMIT {
            return Err("Isolation journal identity limit".into());
        }
        let mut file = options()
            .create_new(true)
            .open(path(request, root)?)
            .map_err(|_| "New exclusive isolation journal required")?;
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Isolation journal sync failed")?;
        Ok(Self { file })
    }
    pub fn closed(mut self) -> Result<()> {
        self.file
            .seek(SeekFrom::End(0))
            .and_then(|_| self.file.write_all(CLOSED))
            .and_then(|_| self.file.sync_all())
            .map_err(|_| "Isolation cleanup receipt sync failed".into())
    }
    /// Does not resume execution or kill a PID. A live broker's exclusive handle
    /// prevents recovery; leftover mapped files also make OS deletion fail.
    #[cfg(test)]
    pub fn recover(request: &Request, root: &Path) -> Result<bool> {
        Self::recover_context(
            &request.agent_id,
            &request.project_id,
            &request.run_id,
            &request.job_id,
            request.run_step_id.as_deref(),
            root,
        )
    }
    pub fn recover_claim(agent: &str, record: &serde_json::Value, root: &Path) -> Result<bool> {
        let required = |key: &str| {
            record[key]
                .as_str()
                .ok_or("Isolation claim identity missing")
        };
        Self::recover_context(
            agent,
            required("projectId")?,
            required("runId")?,
            required("jobId")?,
            record["runStepId"].as_str(),
            root,
        )
    }
    fn recover_context(
        agent: &str,
        project: &str,
        run: &str,
        job: &str,
        step: Option<&str>,
        root: &Path,
    ) -> Result<bool> {
        let mut owner_path = scoped_path(run, job, step, root)?;
        if step.is_some()
            && !owner_path
                .try_exists()
                .map_err(|_| "Isolation journal lookup failed")?
            && !owner_path
                .with_extension("reservation")
                .try_exists()
                .map_err(|_| "Isolation reservation lookup failed")?
        {
            // Older v1 records used Job-only filenames. Header context still
            // must match the exact Step; never recover another Step by name.
            let legacy = path_for(run, job, root)?;
            if legacy
                .try_exists()
                .map_err(|_| "Legacy isolation journal lookup failed")?
                || legacy
                    .with_extension("reservation")
                    .try_exists()
                    .map_err(|_| "Legacy isolation reservation lookup failed")?
            {
                owner_path = legacy;
            }
        }
        let reserved = owner_path.with_extension("reservation");
        let read_reservation = || -> Result<ReservedOwner> {
            no_links(&reserved)?;
            let mut bytes = Vec::new();
            options()
                .open(&reserved)
                .map_err(|_| "Isolation reservation unavailable or held by a live creator")?
                .take(LIMIT + 1)
                .read_to_end(&mut bytes)
                .map_err(|_| "Isolation reservation read failed")?;
            if bytes.len() as u64 > LIMIT {
                return Err("Isolation reservation limit".into());
            }
            let saved: ReservedOwner = serde_json::from_slice(&bytes)
                .map_err(|_| "Incomplete isolation reservation; creation not confirmed")?;
            if saved.version != 1
                || saved.agent_id != agent
                || saved.project_id != project
                || saved.run_id != run
                || saved.job_id != job
                || saved.run_step_id.as_deref() != step
            {
                return Err("Isolation reservation execution identity mismatch".into());
            }
            saved.binding.validate()?;
            Profile::validate_reserved_name(&saved.profile_name)?;
            Ok(saved)
        };
        let review = || -> Result<bool> {
            let saved = read_reservation()?;
            Err(format!("Isolation creation incomplete; reserved profile {} requires ownership review; automatic deletion blocked", saved.profile_name))
        };
        let mut file = match options().open(&owner_path) {
            Ok(file) => file,
            Err(error)
                if error.kind() == std::io::ErrorKind::NotFound
                    && reserved
                        .try_exists()
                        .map_err(|_| "Isolation reservation lookup failed")? =>
            {
                return review()
            }
            Err(_) => {
                return Err("Isolation journal is unavailable or owned by a live broker".into())
            }
        };
        let mut bytes = Vec::new();
        (&mut file)
            .take(LIMIT + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Isolation journal read failed")?;
        if bytes.len() as u64 > LIMIT {
            return Err("Isolation journal limit".into());
        }
        let end = match bytes.iter().position(|v| *v == b'\n') {
            Some(end) => end,
            None if reserved
                .try_exists()
                .map_err(|_| "Isolation reservation lookup failed")? =>
            {
                return review()
            }
            None => {
                return Err("Incomplete isolation ownership record; manual review required".into())
            }
        };
        let owner: Owner = match serde_json::from_slice(&bytes[..end]) {
            Ok(owner) => owner,
            Err(_)
                if reserved
                    .try_exists()
                    .map_err(|_| "Isolation reservation lookup failed")? =>
            {
                return review()
            }
            Err(_) => return Err("Invalid isolation ownership record".into()),
        };
        if owner.version != 1
            || owner.agent_id != agent
            || owner.project_id != project
            || owner.run_id != run
            || owner.job_id != job
            || owner.run_step_id.as_deref() != step
        {
            return Err("Isolation recovery execution identity mismatch".into());
        }
        let state = &bytes[end + 1..];
        owner.binding.validate()?;
        if reserved
            .try_exists()
            .map_err(|_| "Isolation reservation lookup failed")?
        {
            let saved = read_reservation()?;
            if saved.profile_name != owner.profile.name || saved.binding != owner.binding {
                return Err("Isolation reservation and created ownership conflict".into());
            }
        }
        if state == CLOSED {
            return Ok(false);
        }
        if !CLOSED.starts_with(state) {
            return Err("Invalid isolation cleanup record".into());
        }
        Profile::recover_owned(&owner.profile)?;
        // Replace only an incomplete final completion marker while holding the
        // exclusive broker handle. The immutable ownership header is preserved.
        file.set_len((end + 1) as u64)
            .map_err(|_| "Isolation journal completion repair failed")?;
        file.seek(SeekFrom::End(0))
            .and_then(|_| file.write_all(CLOSED))
            .and_then(|_| file.sync_all())
            .map_err(|_| "Isolation recovered receipt sync failed")?;
        Ok(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn request() -> Request {
        serde_json::from_value(json!({"protocolVersion":1,"type":"execute","agentId":"controlled-agent",
            "projectId":uuid::Uuid::new_v4().to_string(),"runId":uuid::Uuid::new_v4().to_string(),
            "jobId":uuid::Uuid::new_v4().to_string(),"runStepId":uuid::Uuid::new_v4().to_string(),
            "requirements":{},"executable":"engine","cwd":"source","args":[],"env":{},"timeoutMs":5000})).unwrap()
    }

    #[test]
    fn steps_of_one_job_have_independent_reservations_and_reject_replay() {
        let root = tempfile::tempdir().unwrap();
        let first = request();
        let mut second = first.clone();
        second.run_step_id = Some(uuid::Uuid::new_v4().to_string());
        let binding = Binding {
            snapshot_id: uuid::Uuid::new_v4().to_string(),
            source_checksum: "a".repeat(64),
            program_id: "engine".into(),
            program_checksum: "c".repeat(64),
            bundle_checksum: None,
            process_limit: None,
        };
        let one = Journal::reserve(&first, root.path(), binding.clone()).unwrap();
        let two = Journal::reserve(&second, root.path(), binding.clone()).unwrap();
        assert_ne!(
            path(&first, root.path()).unwrap(),
            path(&second, root.path()).unwrap()
        );
        let first_name = one.record.profile_name.clone();
        let second_name = two.record.profile_name.clone();
        drop(one);
        drop(two);
        assert!(Journal::reserve(&first, root.path(), binding).is_err());
        let first_review = Journal::recover(&first, root.path()).unwrap_err();
        let second_review = Journal::recover(&second, root.path()).unwrap_err();
        assert!(first_review.contains(&first_name) && !first_review.contains(&second_name));
        assert!(second_review.contains(&second_name) && !second_review.contains(&first_name));
    }

    #[test]
    fn legacy_closed_job_record_remains_readable_without_replaying_its_step() {
        let root = tempfile::tempdir().unwrap();
        let first = request();
        crate::pipeline::cwd(root.path(), &first.run_id, ".").unwrap();
        let legacy = path_for(&first.run_id, &first.job_id, root.path()).unwrap();
        let owner = Owner {
            version: 1,
            agent_id: first.agent_id.clone(),
            project_id: first.project_id.clone(),
            run_id: first.run_id.clone(),
            job_id: first.job_id.clone(),
            run_step_id: first.run_step_id.clone(),
            binding: Binding {
                snapshot_id: uuid::Uuid::new_v4().to_string(),
                source_checksum: "a".repeat(64),
                program_id: "engine".into(),
                program_checksum: "c".repeat(64),
                bundle_checksum: None,
                process_limit: None,
            },
            profile: OwnedIdentity {
                name: format!("TASTESTUDIO.{}", uuid::Uuid::new_v4().simple()),
                sid: "controlled-closed-record-no-os-call".into(),
                root: root.path().join("must-not-delete"),
            },
        };
        let mut bytes = serde_json::to_vec(&owner).unwrap();
        bytes.push(b'\n');
        bytes.extend_from_slice(CLOSED);
        fs::write(&legacy, &bytes).unwrap();
        assert!(!Journal::recover(&first, root.path()).unwrap());
        assert!(Journal::ensure_new(&first, root.path()).is_err());
        let mut second = first.clone();
        second.run_step_id = Some(uuid::Uuid::new_v4().to_string());
        assert!(Journal::ensure_new(&second, root.path()).is_ok());
        assert_eq!(fs::read(legacy).unwrap(), bytes);
    }

    #[test]
    fn journal_paths_and_incomplete_or_foreign_records_fail_closed() {
        let root = tempfile::tempdir().unwrap();
        let mut request = request();
        request.job_id = "../foreign".into();
        assert!(Journal::ensure_new(&request, root.path()).is_err());
        request.job_id = uuid::Uuid::new_v4().to_string();
        let record = path(&request, root.path()).unwrap();
        fs::write(&record, b"{\"version\":1").unwrap();
        assert!(Journal::recover(&request, root.path())
            .unwrap_err()
            .contains("Incomplete"));
        assert!(Journal::ensure_new(&request, root.path()).is_err());
        assert_eq!(fs::read(record).unwrap(), b"{\"version\":1");
    }

    fn binding() -> Binding {
        Binding {
            snapshot_id: uuid::Uuid::new_v4().to_string(),
            source_checksum: "a".repeat(64),
            program_id: "controlled-engine".into(),
            program_checksum: "b".repeat(64),
            bundle_checksum: None,
            process_limit: None,
        }
    }
    #[test]
    fn legacy_binding_is_preserved_and_dependency_identity_is_distinct() {
        let old = binding();
        let encoded = serde_json::to_value(&old).unwrap();
        assert!(encoded.get("bundleChecksum").is_none());
        assert!(serde_json::from_value::<Binding>(encoded).unwrap() == old);
        let mut changed = old.clone();
        changed.bundle_checksum = Some("f".repeat(64));
        assert!(changed.validate().is_ok());
        assert!(changed != old);
        changed.bundle_checksum = Some("invalid".into());
        assert!(changed.validate().is_err());
    }
    #[test]
    fn reservation_precedes_creation_and_keeps_exact_review_identity() {
        let root = tempfile::tempdir().unwrap();
        let mut request = request();
        request
            .env
            .insert("DUMMY_AUTH".into(), "DUMMY_RESERVATION_EXCLUDED".into());
        let reserved = Journal::reserve(&request, root.path(), binding()).unwrap();
        let name = reserved.record.profile_name.clone();
        assert!(reserved._file.metadata().unwrap().len() > 0);
        assert!(Journal::reserve(&request, root.path(), binding()).is_err());
        assert!(Journal::recover(&request, root.path())
            .unwrap_err()
            .contains("live creator"));
        let owner = path(&request, root.path()).unwrap();
        assert!(
            !owner.exists(),
            "reservation must be durable before any ownership claim"
        );
        drop(reserved);
        let bytes = fs::read(owner.with_extension("reservation")).unwrap();
        assert!(!String::from_utf8_lossy(&bytes).contains("DUMMY_RESERVATION_EXCLUDED"));
        let saved: ReservedOwner = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(saved.profile_name, name);
        let error = Journal::recover(&request, root.path()).unwrap_err();
        assert!(error.contains(&name) && error.contains("review"));
        let mut foreign = request.clone();
        foreign.project_id = uuid::Uuid::new_v4().to_string();
        let error = Journal::recover(&foreign, root.path()).unwrap_err();
        assert!(error.contains("identity mismatch") && !error.contains(&name));
    }

    #[test]
    #[ignore = "Creates exact reserved AppContainer profiles; validates ambiguous creation without process execution"]
    fn actual_reserved_creation_gap_preserves_profiles_until_ownership_proven() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        let root = tempfile::tempdir_in(base).unwrap();
        let request = request();
        let control = Profile::create().unwrap();
        let control_root = control.root.clone();
        let binding = binding();
        let reservation = Journal::reserve(&request, root.path(), binding.clone()).unwrap();
        let name = reservation.record.profile_name.clone();
        let profile = reservation.create_profile().unwrap();
        let location = profile.root.clone();
        assert_eq!(profile.identity(), name);
        drop(reservation); // Simulated interruption before complete ownership publication.
        let review = Journal::recover(&request, root.path()).unwrap_err();
        assert!(review.contains(&name) && review.contains("review"));
        assert!(location.exists() && control_root.exists());
        // Only the still-live creator can publish its actual creation proof.
        let journal = Journal::claim(&request, root.path(), &profile, binding).unwrap();
        drop(journal);
        profile.leave_for_recovery();
        let owner = path(&request, root.path()).unwrap();
        let original = fs::read(&owner).unwrap();
        let mut changed: serde_json::Value = serde_json::from_slice(&original).unwrap();
        changed["profile"] = serde_json::to_value(control.owned_identity().unwrap()).unwrap();
        fs::write(&owner, changed.to_string() + "\n").unwrap();
        assert!(Journal::recover(&request, root.path())
            .unwrap_err()
            .contains("conflict"));
        assert!(location.exists() && control_root.exists());
        fs::write(&owner, original).unwrap();
        assert!(Journal::recover(&request, root.path()).unwrap());
        assert!(!location.exists() && control_root.exists());
        control.close().unwrap();
    }

    #[test]
    #[ignore = "Starts the explicitly supplied production Agent for interrupted-claim recovery; no Core tasks or sandbox child execution"]
    fn actual_agent_startup_recovers_claim_without_reexecuting_work() {
        use std::{
            process::{Command, Stdio},
            time::{Duration, Instant},
        };
        let binary = std::env::var_os("TASTESTUDIO_VERIFY_AGENT_EXE")
            .expect("Supply the exact freshly built Agent image");
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        for phase in [
            "interrupted",
            "pending-result",
            "acknowledged",
            "creation-review",
        ] {
            let temp = tempfile::tempdir_in(&base).unwrap();
            let root = temp.path().join("workspace");
            fs::create_dir(&root).unwrap();
            let mut request = request();
            request.agent_id = crate::model::identity(&root).unwrap();
            let claims = root.join("claims");
            fs::create_dir(&claims).unwrap();
            let execution = request.run_step_id.as_ref().unwrap();
            let claim = json!({"executionIsolation":true,"runId":request.run_id,"projectId":request.project_id,"jobId":request.job_id,"runStepId":request.run_step_id});
            let claim_path = claims.join(format!("{execution}.claim"));
            let claim_bytes = claim.to_string();
            fs::write(&claim_path, &claim_bytes).unwrap();
            let pending_path = claims.join(format!("{execution}.pending"));
            let preserved_result = if matches!(phase, "pending-result" | "acknowledged") {
                let now = chrono::Utc::now().to_rfc3339();
                let bytes = json!({"protocolVersion":1,"type":"result","jobId":request.job_id,"runId":request.run_id,
                "runStepId":request.run_step_id,"status":"passed","classification":"PASSED","exitCode":0,
                "startedAt":now,"finishedAt":now}).to_string().into_bytes();
                fs::write(&pending_path, &bytes).unwrap();
                Some(bytes)
            } else {
                None
            };
            let ack = claims.join(format!("{execution}.ack"));
            if phase == "acknowledged" {
                fs::write(&ack, b"{\"acknowledged\":true}").unwrap();
            }
            fs::write(root.join("source-canary.txt"), b"existing user state").unwrap();
            let control = Profile::create().unwrap();
            let control_root = control.root.clone();
            let reservation = Journal::reserve(&request, &root, binding()).unwrap();
            let profile = reservation.create_profile().unwrap();
            let reserved_name = profile.identity().to_string();
            let owned_root = profile.root.clone();
            let manual_profile = if phase == "creation-review" {
                drop(reservation);
                Some(profile)
            } else {
                let journal = reservation.claim(&profile).unwrap();
                drop(journal);
                profile.leave_for_recovery();
                None
            };
            let config = temp.path().join("agent.json");
            fs::write(&config, json!({"endpoint":"ws://127.0.0.1:1/agent","name":"owned restart verification", "workspaceRoot":root,
            "tokenEnv":"VERIFY_DUMMY_AGENT_TOKEN","logLevel":"error"}).to_string()).unwrap();
            let operation = (|| -> Result<()> {
                let mut command = Command::new(&binary);
                command
                    .args(["--config"])
                    .arg(&config)
                    .env_clear()
                    .env(
                        "VERIFY_DUMMY_AGENT_TOKEN",
                        "controlled-dummy-agent-value-only",
                    )
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null());
                for key in [
                    "PATH",
                    "SystemRoot",
                    "WINDIR",
                    "TEMP",
                    "TMP",
                    "USERPROFILE",
                    "LOCALAPPDATA",
                ] {
                    if let Some(value) = std::env::var_os(key) {
                        command.env(key, value);
                    }
                }
                let (mut child, tree) = crate::tree::Tree::spawn(&mut command)?;
                let pending = claims.join(format!("{execution}.pending"));
                let deadline = Instant::now() + Duration::from_secs(10);
                let observed = || {
                    fs::read_dir(&claims).unwrap().any(|v| {
                        v.unwrap()
                            .file_name()
                            .to_string_lossy()
                            .contains(".isolation-recovery-")
                    })
                };
                while !(observed() && pending.exists()) && Instant::now() < deadline {
                    if child
                        .try_wait()
                        .map_err(|_| "Agent observation failed")?
                        .is_some()
                    {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(20));
                }
                let cleaned_by_agent = !owned_root.exists();
                tree.terminate()?;
                child
                    .wait()
                    .map_err(|_| "Owned verification Agent wait failed")?;
                let bytes =
                    fs::read(pending).map_err(|_| "Agent did not preserve/publish its result")?;
                let result: serde_json::Value = serde_json::from_slice(&bytes)
                    .map_err(|_| "Actual Agent recovery result malformed")?;
                if cleaned_by_agent == manual_profile.is_some() {
                    return Err(format!(
                        "Actual Agent cleanup/review policy mismatch for {phase}"
                    ));
                }
                if let Some(expected) = &preserved_result {
                    if &bytes != expected {
                        return Err("Actual Agent changed an existing task result".into());
                    }
                } else if result["classification"] != "AGENT_RESTARTED"
                    || result["status"] != "failed"
                    || result["error"]
                        .as_str()
                        .is_some_and(|v| v.contains("cleanup incomplete"))
                        != manual_profile.is_some()
                {
                    return Err("Actual Agent did not publish the interrupted failure".into());
                }
                let observation = fs::read_dir(&claims)
                    .unwrap()
                    .find(|v| {
                        v.as_ref()
                            .unwrap()
                            .file_name()
                            .to_string_lossy()
                            .contains(".isolation-recovery-")
                    })
                    .ok_or("Actual Agent cleanup observation missing")?
                    .map_err(|_| "Actual Agent cleanup observation unavailable")?
                    .path();
                let saved: serde_json::Value = serde_json::from_slice(
                    &fs::read(observation)
                        .map_err(|_| "Actual Agent cleanup observation unreadable")?,
                )
                .map_err(|_| "Actual Agent cleanup observation malformed")?;
                let expected_phase = if manual_profile.is_some() {
                    "interrupted"
                } else {
                    phase
                };
                let expected_outcome = if manual_profile.is_some() {
                    "blocked"
                } else {
                    "recovered"
                };
                if saved["event"]["phase"] != expected_phase
                    || saved["event"]["outcome"] != expected_outcome
                {
                    return Err("Actual Agent cleanup observation mismatch".into());
                }
                if manual_profile.is_some()
                    && !saved["event"]["error"]
                        .as_str()
                        .is_some_and(|v| v.contains(&reserved_name) && v.contains("review"))
                {
                    return Err("Actual Agent creation review lost the reserved identity".into());
                }
                Ok(())
            })();
            // Safety cleanup never substitutes for the observed production result.
            let safety_cleanup = if let Some(profile) = manual_profile {
                profile.close().map(|_| false)
            } else {
                Journal::recover(&request, &root)
            };
            operation.unwrap();
            assert!(
                !safety_cleanup.unwrap(),
                "production Agent must already have closed the ownership record"
            );
            assert_eq!(fs::read_to_string(&claim_path).unwrap(), claim_bytes);
            assert_eq!(
                fs::read_dir(&claims)
                    .unwrap()
                    .filter(|v| v
                        .as_ref()
                        .unwrap()
                        .path()
                        .extension()
                        .is_some_and(|x| x == "claim"))
                    .count(),
                1
            );
            assert_eq!(
                fs::read(root.join("source-canary.txt")).unwrap(),
                b"existing user state"
            );
            assert!(control_root.exists());
            if phase == "acknowledged" {
                assert_eq!(fs::read(ack).unwrap(), b"{\"acknowledged\":true}");
            }
            control.close().unwrap();
        }
    }

    #[test]
    #[ignore = "Creates/deletes exact owned AppContainer profiles; simulates released broker handles without process execution"]
    fn actual_recovery_requires_exclusive_exact_context_sid_and_os_path() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        let root = tempfile::tempdir_in(base).unwrap();
        let request = request();
        let control = Profile::create().unwrap();
        let control_root = control.root.clone();
        let profile = Profile::create().unwrap();
        let profile_root = profile.root.clone();
        fs::write(profile_root.join("owned.txt"), b"controlled isolated data").unwrap();
        let binding = Binding {
            snapshot_id: uuid::Uuid::new_v4().to_string(),
            source_checksum: "a".repeat(64),
            program_id: "controlled-engine".into(),
            program_checksum: "b".repeat(64),
            bundle_checksum: None,
            process_limit: None,
        };
        let journal = Journal::claim(&request, root.path(), &profile, binding.clone()).unwrap();
        assert!(Journal::recover(&request, root.path()).is_err());
        assert!(Journal::claim(&request, root.path(), &profile, binding).is_err());
        drop(journal);
        profile.leave_for_recovery();
        let record = path(&request, root.path()).unwrap();
        let original = fs::read(&record).unwrap();
        let mut foreign = request.clone();
        foreign.project_id = uuid::Uuid::new_v4().to_string();
        assert!(Journal::recover(&foreign, root.path())
            .unwrap_err()
            .contains("identity mismatch"));
        for (field, value) in [
            ("sid", json!("S-1-15-2-0")),
            ("root", json!(root.path())),
            ("name", json!("TASTESTUDIO.foreign")),
        ] {
            let mut owner: serde_json::Value = serde_json::from_slice(&original).unwrap();
            owner["profile"][field] = value;
            fs::write(&record, owner.to_string() + "\n").unwrap();
            assert!(Journal::recover(&request, root.path()).is_err());
            assert!(profile_root.exists());
            assert!(control_root.exists());
        }
        fs::write(&record, &original).unwrap();
        crate::isolation::recover_recorded(
            root.path(),
            &request.agent_id,
            &json!({
                "executionIsolation":true,"projectId":request.project_id,"runId":request.run_id,
                "jobId":request.job_id,"runStepId":request.run_step_id
            }),
            crate::isolation::ClaimPhase::Interrupted,
        )
        .unwrap();
        assert!(!profile_root.exists());
        assert!(
            control_root.exists(),
            "another owned profile must not be prefix-cleaned"
        );
        assert!(!Journal::recover(&request, root.path()).unwrap());
        let mut partial = original;
        partial.extend_from_slice(b"CLO");
        fs::write(&record, partial).unwrap();
        assert!(Journal::recover(&request, root.path()).unwrap());
        assert!(!Journal::recover(&request, root.path()).unwrap());
        assert!(control_root.exists());
        control.close().unwrap();
        assert!(!control_root.exists());
    }
}
