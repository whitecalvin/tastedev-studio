use crate::model::{Request, Result, Source};
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
            || hash(f.content.as_bytes()) != f.checksum
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
pub fn prepare(request: &Request, root: &Path, cancel: Arc<AtomicBool>) -> Result<Value> {
    let source = request.source.as_ref().ok_or("Source missing")?;
    validate(source)?;
    let s = source.snapshot.as_ref().ok_or("Snapshot missing")?;
    if s.project_id != request.project_id {
        return Err("Snapshot project mismatch".into());
    }
    let run = crate::pipeline::cwd(root, &request.run_id, ".")?;
    let staging = run.join("snapshot-staging");
    let target = run.join("source");
    if staging.exists() || target.exists() {
        return Err("Snapshot workspace already exists".into());
    }
    fs::create_dir(&staging).map_err(|_| "Snapshot staging unavailable")?;
    let outcome = (|| -> Result<()> {
        for f in &s.files {
            if cancel.load(Ordering::SeqCst) {
                return Err("Snapshot cancelled".into());
            }
            let path = staging.join(&f.path);
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|_| "Snapshot directory failed")?;
            }
            fs::write(&path, f.content.as_bytes()).map_err(|_| "Snapshot write failed")?;
            let bytes = fs::read(&path).map_err(|_| "Snapshot readback failed")?;
            if hash(&bytes) != f.checksum {
                return Err("Snapshot readback mismatch".into());
            }
        }
        fs::rename(&staging, &target).map_err(|_| "Snapshot commit failed")?;
        Ok(())
    })();
    if outcome.is_err() {
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
}
