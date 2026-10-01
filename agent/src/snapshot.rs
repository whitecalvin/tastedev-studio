use crate::model::{no_links, Request, Result, Source};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct File {
    pub path: String,
    pub content: String,
    pub checksum: String,
    #[serde(default, skip_serializing_if = "is_false")]
    pub cached: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    pub provider: String,
    pub snapshot_id: String,
    pub project_id: String,
    pub proposal_id: String,
    pub attempt: u32,
    pub base_revision: String,
    pub changed_files: Vec<String>,
    pub files: Vec<File>,
    pub checksum: String,
}
fn is_false(value: &bool) -> bool {
    !*value
}
fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn safe(path: &str) -> Result<()> {
    if path.is_empty()
        || path.len() > 240
        || path.contains(['\\', ':', '\0'])
        || path.starts_with('/')
    {
        return Err("Snapshot path escape".into());
    }
    for part in path.split('/') {
        let p = part.to_ascii_lowercase();
        if p.is_empty()
            || p == "."
            || p == ".."
            || p.ends_with('.')
            || p.ends_with(' ')
            || p.starts_with(".env")
            || [
                ".git",
                ".ssh",
                "node_modules",
                "target",
                "dist",
                "build",
                "out",
                "coverage",
                ".next",
                ".cache",
                "artifacts",
                "resources",
                "vendor",
                "bin",
                "obj",
            ]
            .contains(&p.as_str())
            || [
                "secret",
                "credential",
                "password",
                "token",
                ".pem",
                ".key",
                ".pfx",
                ".p12",
                "id_rsa",
                "id_ed25519",
            ]
            .iter()
            .any(|v| p.contains(v))
        {
            return Err("Excluded snapshot path".into());
        }
    }
    Ok(())
}
pub fn validate(source: &Source) -> Result<()> {
    let s = source.snapshot.as_ref().ok_or("Snapshot missing")?;
    for id in [&s.snapshot_id, &s.project_id, &s.proposal_id] {
        uuid::Uuid::parse_str(id).map_err(|_| "Invalid snapshot identity")?;
    }
    if source.provider != "snapshot"
        || s.provider != "snapshot"
        || source.repository != format!("snapshot:{}", s.snapshot_id)
        || source.revision != s.base_revision
        || s.base_revision.len() > 200
        || !(1..=10).contains(&s.attempt)
        || s.files.is_empty()
        || s.files.len() > 100
    {
        return Err("Invalid snapshot".into());
    }
    let mut seen = HashSet::new();
    let mut size = 0;
    for f in &s.files {
        safe(&f.path)?;
        if !seen.insert(f.path.to_ascii_lowercase())
            || f.content.contains('\0')
            || if f.cached {
                !f.content.is_empty()
                    || f.checksum.len() != 64
                    || !f
                        .checksum
                        .bytes()
                        .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
            } else {
                hash(f.content.as_bytes()) != f.checksum
            }
        {
            return Err("Snapshot integrity failed".into());
        }
        size += f.content.len();
    }
    if size > 24000
        || s.changed_files
            .iter()
            .any(|p| !s.files.iter().any(|f| &f.path == p))
    {
        return Err("Snapshot limit or scope".into());
    }
    let mut manifest = vec![
        json!(s.snapshot_id),
        json!(s.project_id),
        json!(s.proposal_id),
        json!(s.attempt),
        json!(s.base_revision),
        json!(s.changed_files),
    ];
    for f in &s.files {
        manifest.push(json!([f.path, f.checksum]));
    }
    if hash(
        serde_json::to_string(&manifest)
            .map_err(|_| "Invalid manifest")?
            .as_bytes(),
    ) != s.checksum
    {
        return Err("Snapshot manifest mismatch".into());
    }
    Ok(())
}
fn bounded_read(path: &Path) -> Result<Vec<u8>> {
    no_links(path)?;
    let meta = fs::metadata(path).map_err(|_| "Snapshot file unavailable")?;
    if !meta.is_file() || meta.len() > 24000 {
        return Err("Snapshot file limit".into());
    }
    fs::read(path).map_err(|_| "Snapshot file read failed".into())
}
fn verify_tree(root: &Path, files: &[File]) -> Result<()> {
    let mut pending = vec![root.to_path_buf()];
    let mut count = 0;
    let mut seen = HashSet::new();
    while let Some(dir) = pending.pop() {
        no_links(&dir)?;
        for entry in fs::read_dir(&dir).map_err(|_| "Snapshot tree unavailable")? {
            let entry = entry.map_err(|_| "Snapshot tree unavailable")?;
            count += 1;
            if count > 1000 {
                return Err("Snapshot tree limit".into());
            }
            let path = entry.path();
            no_links(&path)?;
            if path.is_dir() {
                pending.push(path);
                continue;
            }
            let name = path
                .strip_prefix(root)
                .map_err(|_| "Snapshot tree escape")?
                .to_string_lossy()
                .replace('\\', "/");
            let expected = files
                .iter()
                .find(|f| f.path == name)
                .ok_or("Unexpected source file")?;
            if hash(&bounded_read(&path)?) != expected.checksum {
                return Err("Snapshot tree integrity".into());
            }
            seen.insert(name);
        }
    }
    if seen.len() != files.len() {
        return Err("Snapshot tree incomplete".into());
    }
    Ok(())
}
pub fn prepare(request: &Request, root: &Path, cancel: Arc<AtomicBool>) -> Result<Value> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Snapshot cancelled".into());
    }
    let source = request.source.as_ref().ok_or("Source missing")?;
    validate(source)?;
    let s = source.snapshot.as_ref().ok_or("Snapshot missing")?;
    if s.project_id != request.project_id {
        return Err("Snapshot project mismatch".into());
    }
    let run = crate::pipeline::cwd(root, &request.run_id, ".")?;
    let staging = run.join("snapshot-staging");
    let target = run.join("source");
    let checkpoint = run.join("source-transfer.json");
    no_links(&checkpoint)?;
    no_links(&staging)?;
    no_links(&target)?;
    let identity =
        json!({"snapshotId":s.snapshot_id,"projectId":s.project_id,"checksum":s.checksum});
    if checkpoint.exists() {
        let saved: Value = serde_json::from_slice(&bounded_read(&checkpoint)?)
            .map_err(|_| "Source checkpoint invalid")?;
        if saved != identity {
            return Err("Source checkpoint conflict".into());
        }
    } else {
        if staging.exists() || target.exists() {
            return Err("Unowned source workspace".into());
        }
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&checkpoint)
            .map_err(|_| "Source checkpoint write failed")?;
        use std::io::Write;
        file.write_all(identity.to_string().as_bytes())
            .and_then(|_| file.sync_all())
            .map_err(|_| "Source checkpoint sync failed")?;
    }
    if target.exists() {
        verify_tree(&target, &s.files)?;
    } else {
        fs::create_dir_all(&staging).map_err(|_| "Snapshot staging unavailable")?;
    }
    let already_complete = target.exists();
    let outcome = (|| -> Result<()> {
        let mut materialized = 0usize;
        for f in &s.files {
            if cancel.load(Ordering::SeqCst) {
                return Err("Snapshot cancelled".into());
            }
            let path = if already_complete {
                target.join(&f.path)
            } else {
                staging.join(&f.path)
            };
            no_links(&path)?;
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|_| "Snapshot directory failed")?;
            }
            let bytes = if already_complete {
                bounded_read(&path)?
            } else if f.cached {
                match bounded_read(&path) {
                    Ok(bytes) if hash(&bytes) == f.checksum => bytes,
                    _ => crate::source_cache::read(root, &s.project_id, &f.checksum)?,
                }
            } else {
                f.content.as_bytes().to_vec()
            };
            materialized += bytes.len();
            if materialized > 24000 || bytes.contains(&0) || std::str::from_utf8(&bytes).is_err() {
                return Err("Materialized snapshot limit".into());
            }
            let _ = crate::source_cache::save(root, &s.project_id, &f.checksum, &bytes);
            if !already_complete
                && bounded_read(&path)
                    .map(|old| hash(&old) != f.checksum)
                    .unwrap_or(true)
            {
                fs::write(&path, &bytes).map_err(|_| "Snapshot write failed")?;
            }
            let bytes = bounded_read(&path)?;
            if hash(&bytes) != f.checksum {
                return Err("Snapshot readback mismatch".into());
            }
        }
        // Cancellation received during the final write must not publish a source tree.
        if cancel.load(Ordering::SeqCst) {
            return Err("Snapshot cancelled".into());
        }
        verify_tree(if already_complete { &target } else { &staging }, &s.files)?;
        if !already_complete {
            fs::rename(&staging, &target).map_err(|_| "Snapshot commit failed")?;
        }
        Ok(())
    })();
    if outcome.is_err() && cancel.load(Ordering::SeqCst) {
        let _ = fs::remove_dir_all(&staging);
    }
    outcome?;
    let now = chrono::Utc::now().to_rfc3339();
    Ok(
        json!({"protocolVersion":1,"type":"result","agentId":request.agent_id,"jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"status":"passed","exitCode":0,"startedAt":now,"finishedAt":now,"revision":{"repository":source.repository,"branch":source.revision,"commit":s.checksum,"snapshotId":s.snapshot_id,"proposalId":s.proposal_id,"attempt":s.attempt}}),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    fn source() -> Source {
        let f = File {
            path: "main.js".into(),
            content: "console.log(1);".into(),
            checksum: hash(b"console.log(1);"),
            cached: false,
        };
        let mut s = Snapshot {
            provider: "snapshot".into(),
            snapshot_id: uuid::Uuid::new_v4().to_string(),
            project_id: uuid::Uuid::new_v4().to_string(),
            proposal_id: uuid::Uuid::new_v4().to_string(),
            attempt: 1,
            base_revision: "main".into(),
            changed_files: vec!["main.js".into()],
            files: vec![f],
            checksum: String::new(),
        };
        let manifest = json!([
            s.snapshot_id,
            s.project_id,
            s.proposal_id,
            s.attempt,
            s.base_revision,
            s.changed_files,
            [s.files[0].path, s.files[0].checksum]
        ]);
        s.checksum = hash(manifest.to_string().as_bytes());
        Source {
            provider: "snapshot".into(),
            repository: format!("snapshot:{}", s.snapshot_id),
            revision: "main".into(),
            snapshot: Some(s),
        }
    }
    #[test]
    fn validates_hash_and_manifest() {
        let mut s = source();
        assert!(validate(&s).is_ok());
        s.snapshot.as_mut().unwrap().files[0].content.push('x');
        assert!(validate(&s).is_err());
    }
    #[test]
    fn traversal_and_secret_paths_blocked() {
        for path in [
            "../escape",
            "/outside",
            "C:/outside",
            "a\\..\\x",
            ".env",
            "secrets.json",
            "node_modules/a.js",
            "a/../x",
            "a:stream",
        ] {
            assert!(safe(path).is_err());
        }
    }
    #[test]
    fn case_alias_rejected() {
        let mut s = source();
        let mut f = s.snapshot.as_ref().unwrap().files[0].clone();
        f.path = "MAIN.JS".into();
        s.snapshot.as_mut().unwrap().files.push(f);
        assert!(validate(&s).is_err());
    }
    #[test]
    fn cancelled_snapshot_does_not_create_or_publish_a_workspace() {
        let request = serde_json::from_value::<Request>(json!({
            "protocolVersion":1,"type":"execute","agentId":"agent",
            "jobId":uuid::Uuid::new_v4().to_string(),
            "runId":uuid::Uuid::new_v4().to_string(),
            "projectId":uuid::Uuid::new_v4().to_string(),
            "executable":"node","args":[],"cwd":".","timeoutMs":5000,
            "requirements":{},"env":{},"source":source()
        }))
        .unwrap();
        let root = tempfile::tempdir().unwrap();
        let result = prepare(&request, root.path(), Arc::new(AtomicBool::new(true)));
        assert_eq!(result.unwrap_err(), "Snapshot cancelled");
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
    }
    #[test]
    fn cached_snapshot_reuses_verified_bytes_and_resumes_same_identity() {
        let source = source();
        let snapshot = source.snapshot.as_ref().unwrap();
        let project = snapshot.project_id.clone();
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-2/rust");
        fs::create_dir_all(&base).unwrap();
        let root = tempfile::tempdir_in(base).unwrap();
        let mut request=serde_json::from_value::<Request>(json!({"protocolVersion":1,"type":"execute","agentId":"agent","jobId":uuid::Uuid::new_v4().to_string(),"runId":uuid::Uuid::new_v4().to_string(),"projectId":project,"executable":"node","args":[],"cwd":".","timeoutMs":5000,"requirements":{},"env":{},"source":source})).unwrap();
        prepare(&request, root.path(), Arc::new(AtomicBool::new(false))).unwrap();
        let file = request
            .source
            .as_mut()
            .unwrap()
            .snapshot
            .as_mut()
            .unwrap()
            .files
            .first_mut()
            .unwrap();
        file.content.clear();
        file.cached = true;
        assert!(validate(request.source.as_ref().unwrap()).is_ok());
        prepare(&request, root.path(), Arc::new(AtomicBool::new(false))).unwrap();
        request.run_id = uuid::Uuid::new_v4().to_string();
        prepare(&request, root.path(), Arc::new(AtomicBool::new(false))).unwrap();
        let target = crate::pipeline::cwd(root.path(), &request.run_id, ".")
            .unwrap()
            .join("source/main.js");
        assert_eq!(fs::read_to_string(&target).unwrap(), "console.log(1);");
        fs::write(target, "user modification").unwrap();
        assert!(prepare(&request, root.path(), Arc::new(AtomicBool::new(false))).is_err());
    }
}
