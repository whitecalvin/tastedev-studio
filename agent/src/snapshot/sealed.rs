//! Broker-owned Source metadata outside the untrusted execution tree.
//! This receipt is not an OS-isolation qualification or a cryptographic signature.
use super::{bounded_read, validate, verify_tree, Snapshot};
use crate::model::{no_links, Request, Result, Source};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs, io::Write, path::Path};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Receipt {
    version: u32,
    project_id: String,
    run_id: String,
    snapshot: Snapshot,
}
fn identity(s: &Snapshot) -> Value {
    json!({"snapshotId":s.snapshot_id,"projectId":s.project_id,"checksum":s.checksum})
}
fn validate_metadata(s: &Snapshot) -> Result<()> {
    if s.transfer.is_some() || s.files.iter().any(|f| !f.content.is_empty()) {
        return Err("Sealed Source contains payload or transfer credentials".into());
    }
    if s.schema_version == Some(2) {
        crate::snapshot_download::validate_manifest(s)
    } else {
        validate(&Source {
            trusted_core: None,
            provider: "snapshot".into(),
            repository: format!("snapshot:{}", s.snapshot_id),
            revision: s.base_revision.clone(),
            snapshot: Some(s.clone()),
        })
    }
}
pub(super) fn publish(request: &Request, run: &Path, snapshot: &Snapshot) -> Result<()> {
    let mut snapshot = snapshot.clone();
    snapshot.transfer = None;
    for file in &mut snapshot.files {
        file.content.clear();
        if snapshot.schema_version.is_none() {
            file.cached = true;
        }
    }
    validate_metadata(&snapshot)?;
    if snapshot.project_id != request.project_id {
        return Err("Sealed Source project mismatch".into());
    }
    let receipt = Receipt {
        version: 1,
        project_id: request.project_id.clone(),
        run_id: request.run_id.clone(),
        snapshot,
    };
    let bytes = serde_json::to_vec(&receipt).map_err(|_| "Sealed Source encoding failed")?;
    if bytes.len() > crate::snapshot_download::FILE_LIMIT {
        return Err("Sealed Source metadata limit".into());
    }
    let path = run.join("sealed-source.json");
    no_links(&path)?;
    if path.exists() {
        return if bounded_read(&path)? == bytes {
            Ok(())
        } else {
            Err("Sealed Source receipt conflict".into())
        };
    }
    // Publish synced metadata without replacing another receipt. A crash may
    // leave this unique broker staging file, never a partially valid receipt.
    let temporary = run.join(format!("sealed-source-{}.pending", uuid::Uuid::new_v4()));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|_| "Sealed Source staging failed")?;
    let result: Result<()> = (|| {
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Sealed Source sync failed")?;
        no_links(&path)?;
        match fs::hard_link(&temporary, &path) {
            Ok(()) => Ok(()),
            Err(_) if path.exists() && bounded_read(&path)? == bytes => Ok(()),
            Err(_) => Err("Sealed Source publication conflict".into()),
        }
    })();
    drop(file);
    let cleanup = fs::remove_file(&temporary).map_err(|_| "Sealed Source staging cleanup failed");
    result?;
    cleanup?;
    Ok(())
}
/// Bind the manifest to this execution, then recheck every original Source file.
pub(crate) fn load(request: &Request, root: &Path) -> Result<Snapshot> {
    let run = crate::pipeline::cwd(root, &request.run_id, ".")?;
    let receipt: Receipt = serde_json::from_slice(&bounded_read(&run.join("sealed-source.json"))?)
        .map_err(|_| "Sealed Source receipt invalid")?;
    if receipt.version != 1
        || receipt.run_id != request.run_id
        || receipt.project_id != request.project_id
        || receipt.snapshot.project_id != request.project_id
    {
        return Err("Sealed Source execution identity mismatch".into());
    }
    validate_metadata(&receipt.snapshot)?;
    let checkpoint: Value =
        serde_json::from_slice(&bounded_read(&run.join("source-transfer.json"))?)
            .map_err(|_| "Sealed Source checkpoint invalid")?;
    if checkpoint != identity(&receipt.snapshot) {
        return Err("Sealed Source checkpoint mismatch".into());
    }
    if let Some(source) = &request.source {
        let s = source
            .snapshot
            .as_ref()
            .ok_or("Sealed Source reference missing")?;
        if identity(s) != identity(&receipt.snapshot) {
            return Err("Sealed Source request mismatch".into());
        }
    }
    verify_tree(&run.join("source"), &receipt.snapshot.files)?;
    Ok(receipt.snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{atomic::AtomicBool, Arc};
    fn request() -> Request {
        let source = crate::snapshot::tests::source();
        serde_json::from_value(json!({
            "protocolVersion":1,"type":"execute","agentId":"agent",
            "jobId":uuid::Uuid::new_v4().to_string(),"runId":uuid::Uuid::new_v4().to_string(),
            "projectId":source.snapshot.as_ref().unwrap().project_id,"requirements":{},
            "executable":"node","args":[],"cwd":"source","timeoutMs":5000,
            "env":{"DUMMY_AUTH":"not-for-source-receipt"},"source":source
        }))
        .unwrap()
    }
    #[test]
    fn prepared_receipt_is_content_free_idempotent_and_bound_to_run() {
        let root = tempfile::tempdir().unwrap();
        let request = request();
        let cancel = Arc::new(AtomicBool::new(false));
        crate::snapshot::prepare(&request, root.path(), cancel.clone()).unwrap();
        let s = load(&request, root.path()).unwrap();
        assert!(s.files.iter().all(|f| f.content.is_empty()));
        assert!(s.transfer.is_none());
        let run = crate::pipeline::cwd(root.path(), &request.run_id, ".").unwrap();
        let bytes = fs::read_to_string(run.join("sealed-source.json")).unwrap();
        assert!(!bytes.contains("console.log"));
        assert!(!bytes.contains("not-for-source-receipt"));
        crate::snapshot::prepare(&request, root.path(), cancel).unwrap();
        assert_eq!(
            bytes,
            fs::read_to_string(run.join("sealed-source.json")).unwrap()
        );
        let mut foreign = request.clone();
        foreign.project_id = uuid::Uuid::new_v4().to_string();
        assert!(load(&foreign, root.path()).is_err());
        foreign = request.clone();
        foreign.run_id = uuid::Uuid::new_v4().to_string();
        let other = crate::pipeline::cwd(root.path(), &foreign.run_id, ".").unwrap();
        fs::copy(
            run.join("sealed-source.json"),
            other.join("sealed-source.json"),
        )
        .unwrap();
        assert!(load(&foreign, root.path())
            .unwrap_err()
            .contains("identity"));
    }
    #[test]
    fn tampering_fails_closed_without_overwriting_source() {
        let root = tempfile::tempdir().unwrap();
        let request = request();
        crate::snapshot::prepare(&request, root.path(), Arc::new(AtomicBool::new(false))).unwrap();
        let run = crate::pipeline::cwd(root.path(), &request.run_id, ".").unwrap();
        let file = run.join("source/main.js");
        fs::write(&file, "user change").unwrap();
        assert!(load(&request, root.path()).is_err());
        assert_eq!(fs::read_to_string(&file).unwrap(), "user change");
        fs::write(&file, "console.log(1);").unwrap();
        let path = run.join("sealed-source.json");
        let mut receipt: Value = serde_json::from_slice(&fs::read(&path).unwrap()).unwrap();
        receipt["snapshot"]["files"][0]["path"] = json!("../outside");
        fs::write(&path, receipt.to_string()).unwrap();
        assert!(load(&request, root.path()).is_err());
        assert!(publish(
            &request,
            &run,
            request.source.as_ref().unwrap().snapshot.as_ref().unwrap()
        )
        .is_err());
    }

    #[test]
    fn v2_receipt_keeps_binary_identity_and_rejects_stale_reference() {
        let root = tempfile::tempdir().unwrap();
        let mut request = request();
        let run = crate::pipeline::cwd(root.path(), &request.run_id, ".").unwrap();
        fs::create_dir(run.join("source")).unwrap();
        let mut snapshot = request
            .source
            .as_ref()
            .unwrap()
            .snapshot
            .as_ref()
            .unwrap()
            .clone();
        snapshot.schema_version = Some(2);
        let bytes = [0, 255, 17, 0];
        snapshot.files[0].path = "sprite.dat".into();
        snapshot.files[0].content.clear();
        snapshot.files[0].checksum = crate::snapshot::hash(&bytes);
        snapshot.files[0].encoding = Some("base64".into());
        snapshot.files[0].size = Some(bytes.len() as u64);
        snapshot.changed_files = vec!["sprite.dat".into()];
        snapshot.checksum = crate::snapshot_download::manifest_hash(&snapshot).unwrap();
        fs::write(run.join("source/sprite.dat"), bytes).unwrap();
        fs::write(
            run.join("source-transfer.json"),
            identity(&snapshot).to_string(),
        )
        .unwrap();
        request.source.as_mut().unwrap().snapshot = Some(snapshot.clone());
        publish(&request, &run, &snapshot).unwrap();
        let restored = load(&request, root.path()).unwrap();
        assert_eq!(restored.files[0].encoding.as_deref(), Some("base64"));
        assert_eq!(restored.files[0].size, Some(4));
        assert!(restored.files[0].content.is_empty());
        assert!(!restored.files[0].cached);
        request
            .source
            .as_mut()
            .unwrap()
            .snapshot
            .as_mut()
            .unwrap()
            .checksum = "0".repeat(64);
        assert!(load(&request, root.path())
            .unwrap_err()
            .contains("request mismatch"));
        request.source = None;
        fs::write(run.join("source-transfer.json"), "{}").unwrap();
        assert!(load(&request, root.path())
            .unwrap_err()
            .contains("checkpoint mismatch"));
    }
}
