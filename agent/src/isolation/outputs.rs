//! Parent-owned immutable recovery evidence, outside original Source. Never
//! reinterpret a pre-existing directory as success or automatically re-execute.
use crate::{
    build_artifact::CapturedOutput,
    model::{no_links, Request, Result},
};
use serde::Serialize;
use std::{fs, io::Write, path::Path, sync::atomic::AtomicBool, time::Instant};

pub(super) fn persist(
    request: &Request,
    root: &Path,
    binding: &super::journal::Binding,
    graph: Option<&super::context::GraphContext>,
    captured: &[CapturedOutput],
    cancel: &AtomicBool,
    deadline: Instant,
) -> Result<()> {
    crate::build_artifact::validate_captured(request, captured, cancel, deadline)?;
    if graph.is_none() {
        return Err("Isolated output graph identity required".into());
    }
    let transfer = request
        .build_artifact_transfer
        .as_ref()
        .ok_or("Isolated output transfer required")?;
    let step = request
        .run_step_id
        .as_deref()
        .ok_or("Isolated output Step identity required")?;
    uuid::Uuid::parse_str(step).map_err(|_| "Invalid isolated output Step")?;
    uuid::Uuid::parse_str(&request.job_id).map_err(|_| "Invalid isolated output Job")?;
    let run = crate::pipeline::cwd(root, &request.run_id, ".")?;
    let directory = run.join(format!("isolation-results-{}-{step}", request.job_id));
    no_links(&directory)?;
    fs::create_dir(&directory)
        .map_err(|_| "New isolated output staging required; existing evidence preserved")?;
    #[derive(Serialize)]
    #[serde(rename_all = "camelCase")]
    struct Manifest<'a> {
        version: u32,
        project_id: &'a str,
        run_id: &'a str,
        job_id: &'a str,
        step_id: &'a str,
        binding: &'a super::journal::Binding,
        graph: Option<&'a super::context::GraphContext>,
        cwd: &'a str,
        artifact_version: u32,
        inputs: Vec<serde_json::Value>,
        files: Vec<serde_json::Value>,
    }
    let mut files = Vec::new();
    for (index, output) in captured.iter().enumerate() {
        if cancel.load(std::sync::atomic::Ordering::SeqCst) {
            return Err("Isolated output staging cancelled".into());
        }
        if Instant::now() >= deadline {
            return Err("Isolated output staging timeout".into());
        }
        let declared = transfer
            .outputs
            .iter()
            .find(|value| value.path == output.path)
            .ok_or("Isolated output scope mismatch")?;
        let name = format!("{index}.bin");
        write_new(&directory.join(&name), &output.bytes)?;
        files.push(serde_json::json!({"file":name,"path":output.path,"checksum":output.checksum,"size":output.bytes.len(),"artifactId":declared.id,"name":declared.name,"executable":declared.executable}));
    }
    let manifest = Manifest {
        version: 1,
        project_id: &request.project_id,
        run_id: &request.run_id,
        job_id: &request.job_id,
        step_id: step,
        binding,
        graph,
        cwd: &request.cwd,
        artifact_version: transfer.version,
        inputs: transfer.inputs.iter().map(|input|serde_json::json!({"id":input.artifact.id,"path":input.path,"size":input.artifact.size,"checksum":input.artifact.checksum,"executable":input.artifact.executable,"producerRunId":input.artifact.producer_run_id,"producerStepId":input.artifact.producer_step_id,"snapshotId":input.artifact.snapshot_id,"sourceChecksum":input.artifact.source_checksum})).collect(),
        files,
    };
    let bytes =
        serde_json::to_vec(&manifest).map_err(|_| "Isolated output manifest encoding failed")?;
    if bytes.len() > 16384 {
        return Err("Isolated output manifest limit".into());
    }
    if cancel.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("Isolated output staging cancelled".into());
    }
    if Instant::now() >= deadline {
        return Err("Isolated output staging timeout".into());
    }
    // Publish only the fully synced manifest. Incomplete files remain explicit
    // recovery evidence, never a successful manifest, after a crash or IO error.
    let pending = directory.join("manifest.pending");
    write_new(&pending, &bytes)?;
    fs::hard_link(&pending, directory.join("manifest.json"))
        .map_err(|_| "Isolated output manifest publication failed")?;
    fs::remove_file(pending).map_err(|_| "Isolated output manifest staging cleanup failed".into())
}

fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    no_links(path)?;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| "New isolated output file required")?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Isolated output persistence failed".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sha2::{Digest, Sha256};
    use std::time::Duration;
    #[test]
    fn immutable_result_stage_is_step_scoped_credential_free_and_preserves_source() {
        let directory = tempfile::tempdir().unwrap();
        let mut request = crate::tests::request();
        request.job_id = uuid::Uuid::new_v4().to_string();
        request.run_step_id = Some(uuid::Uuid::new_v4().to_string());
        request.stage = Some("build".into());
        request.cwd = "source/src".into();
        request.requirements.build_artifacts = Some(1);
        let snapshot = uuid::Uuid::new_v4().to_string();
        request.env.insert("TASTEDEV_GRAPH_CONTEXT".into(),serde_json::json!({"executionId":"execution","activationId":"activation","nodeId":"build","attempt":1,"revision":1,"snapshotId":snapshot,"sourceChecksum":"a".repeat(64)}).to_string());
        let id = "d".repeat(64);
        let token = "e".repeat(64);
        let mut transfer: crate::build_artifact::Transfer = serde_json::from_value(serde_json::json!({"version":1,"inputs":[],"outputs":[{"name":"frame","path":"out/frame.png","id":id,"url":format!("http://127.0.0.1:1/build-artifacts/upload/{id}"),"token":token}]})).unwrap();
        transfer.trusted_core = Some("ws://127.0.0.1:1/agent".into());
        request.build_artifact_transfer = Some(transfer);
        let binding = super::super::journal::Binding {
            snapshot_id: snapshot,
            source_checksum: "a".repeat(64),
            program_id: "engine".into(),
            program_checksum: "c".repeat(64),
            bundle_checksum: None,
            process_limit: None,
        };
        let graph = super::super::context::parse(&request).unwrap().unwrap();
        let run = crate::pipeline::cwd(directory.path(), &request.run_id, ".").unwrap();
        fs::create_dir_all(run.join("source/src")).unwrap();
        fs::write(run.join("source/src/main.gd"), b"original saved source").unwrap();
        let bytes = b"png\0\xff".to_vec();
        let captured = vec![CapturedOutput {
            path: "out/frame.png".into(),
            checksum: format!("{:x}", Sha256::digest(&bytes)),
            bytes: bytes.clone(),
        }];
        let cancel = AtomicBool::new(false);
        let deadline = Instant::now() + Duration::from_secs(5);
        persist(
            &request,
            directory.path(),
            &binding,
            Some(&graph),
            &captured,
            &cancel,
            deadline,
        )
        .unwrap();
        let stage = run.join(format!(
            "isolation-results-{}-{}",
            request.job_id,
            request.run_step_id.as_ref().unwrap()
        ));
        let manifest_bytes = fs::read(stage.join("manifest.json")).unwrap();
        assert!(!String::from_utf8_lossy(&manifest_bytes).contains(&token));
        let manifest: serde_json::Value = serde_json::from_slice(&manifest_bytes).unwrap();
        assert_eq!(manifest["cwd"], "source/src");
        assert_eq!(manifest["files"][0]["path"], "out/frame.png");
        assert_eq!(fs::read(stage.join("0.bin")).unwrap(), bytes);
        assert!(persist(
            &request,
            directory.path(),
            &binding,
            Some(&graph),
            &captured,
            &cancel,
            deadline
        )
        .is_err());
        assert_eq!(
            fs::read(stage.join("manifest.json")).unwrap(),
            manifest_bytes
        );
        request.run_step_id = Some(uuid::Uuid::new_v4().to_string());
        persist(
            &request,
            directory.path(),
            &binding,
            Some(&graph),
            &captured,
            &cancel,
            deadline,
        )
        .unwrap();
        assert_eq!(
            fs::read(run.join("source/src/main.gd")).unwrap(),
            b"original saved source"
        );
        assert!(!run.join("source/src/out").exists());
    }
}
