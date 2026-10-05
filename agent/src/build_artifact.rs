use crate::model::{no_links, Request, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::{
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};

pub const LIMIT: u64 = 128 * 1024 * 1024;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Artifact {
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable: Option<bool>,
    pub id: String,
    pub project_id: String,
    pub execution_id: String,
    pub graph_revision: u64,
    pub producer_activation_id: String,
    pub producer_node_id: String,
    pub producer_run_id: String,
    pub producer_step_id: String,
    pub snapshot_id: String,
    pub source_checksum: String,
    pub name: String,
    pub path: String,
    pub size: u64,
    pub checksum: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Output {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub executable: Option<bool>,
    pub name: String,
    pub path: String,
    pub id: String,
    pub url: String,
    pub token: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Input {
    pub name: String,
    pub path: String,
    pub artifact: Artifact,
    pub url: String,
    pub token: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Transfer {
    pub version: u32,
    pub outputs: Vec<Output>,
    pub inputs: Vec<Input>,
    #[serde(skip)]
    pub trusted_core: Option<String>,
}
impl std::fmt::Debug for Transfer {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("BuildArtifactTransfer")
            .field("version", &self.version)
            .field("outputs", &self.outputs.len())
            .field("inputs", &self.inputs.len())
            .finish()
    }
}
fn identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 120
        && value
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_' || c == b'-')
}
fn hex(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}
fn name(value: &str) -> bool {
    value.len() <= 64
        && value
            .as_bytes()
            .first()
            .is_some_and(u8::is_ascii_alphabetic)
        && identifier(value)
}
pub fn safe_path(value: &str) -> Result<()> {
    if value.is_empty() || value.len() > 240 || value.contains('\\') {
        return Err("Unsafe build artifact path".into());
    }
    for part in value.split('/') {
        let p = part.to_ascii_lowercase();
        let base = p.split('.').next().unwrap_or_default();
        if part.is_empty()
            || part == "."
            || part == ".."
            || part.ends_with('.')
            || part
                .chars()
                .any(|c| c.is_control() || c.is_whitespace() || ":*?\"<>|".contains(c))
            || matches!(base, "con" | "prn" | "aux" | "nul")
            || (base.len() == 4
                && (base.starts_with("com") || base.starts_with("lpt"))
                && matches!(base.as_bytes()[3], b'1'..=b'9'))
            || p.starts_with(".env")
            || matches!(p.as_str(), ".git" | ".ssh" | ".aws")
            || p.contains("credential")
            || p == "id_rsa"
            || p == "id_ed25519"
            || [".pem", ".key", ".p12", ".pfx"]
                .iter()
                .any(|s| p.ends_with(s))
        {
            return Err("Unsafe build artifact path".into());
        }
    }
    Ok(())
}
impl Transfer {
    pub fn validate(&self, request: &Request) -> Result<()> {
        if !matches!(self.version, 1 | 2)
            || self.outputs.len() > 16
            || self.inputs.len() > 16
            || self.outputs.is_empty() && self.inputs.is_empty()
            || request
                .requirements
                .build_artifacts
                .is_none_or(|v| v < self.version || v > 2)
            || request.run_step_id.is_none()
            || !matches!(request.stage.as_deref(), Some("install" | "build" | "test"))
        {
            return Err("Invalid build artifact operation".into());
        }
        let context: serde_json::Value = serde_json::from_str(
            request
                .env
                .get("TASTEDEV_GRAPH_CONTEXT")
                .ok_or("Graph artifact identity required")?,
        )
        .map_err(|_| "Invalid graph artifact identity")?;
        let mut core = reqwest::Url::parse(
            self.trusted_core
                .as_deref()
                .ok_or("Trusted Core required")?,
        )
        .map_err(|_| "Invalid trusted Core")?;
        let scheme = match core.scheme() {
            "ws" => "http",
            "wss" => "https",
            _ => return Err("Invalid trusted Core scheme".into()),
        };
        core.set_scheme(scheme)
            .map_err(|_| "Invalid trusted Core scheme")?;
        let endpoint = |url: &str, token: &str, kind: &str, id: &str| -> Result<()> {
            let url = reqwest::Url::parse(url).map_err(|_| "Invalid build endpoint")?;
            if url.origin() != core.origin()
                || !url.username().is_empty()
                || url.password().is_some()
                || url.query().is_some()
                || url.fragment().is_some()
                || !hex(token)
                || !hex(id)
                || url.path() != format!("/build-artifacts/{kind}/{id}")
            {
                return Err("Build endpoint outside configured Core or scope".into());
            }
            Ok(())
        };
        let mut paths = HashSet::new();
        let mut names = HashSet::new();
        for output in &self.outputs {
            if (self.version == 1 && output.executable.is_some())
                || (self.version == 2 && output.executable.is_none())
            {
                return Err("Build executable policy version mismatch".into());
            }
            safe_path(&output.path)?;
            if !name(&output.name)
                || !paths.insert(output.path.to_ascii_lowercase())
                || !names.insert(output.name.clone())
            {
                return Err("Duplicate build output scope".into());
            }
            endpoint(&output.url, &output.token, "upload", &output.id)?;
        }
        let mut inputs = HashSet::new();
        for input in &self.inputs {
            safe_path(&input.path)?;
            safe_path(&input.artifact.path)?;
            let a = &input.artifact;
            if a.version != self.version
                || (a.version == 1 && a.executable.is_some())
                || (a.version == 2 && a.executable.is_none())
                || !(1..=LIMIT).contains(&a.size)
                || !hex(&a.checksum)
                || !hex(&a.source_checksum)
                || !name(&input.name)
                || input.name != a.name
                || a.graph_revision == 0
                || a.project_id != request.project_id
                || context["executionId"] != a.execution_id
                || context["revision"] != a.graph_revision
                || context["snapshotId"] != a.snapshot_id
                || context["sourceChecksum"] != a.source_checksum
                || ![
                    &a.project_id,
                    &a.execution_id,
                    &a.producer_activation_id,
                    &a.producer_node_id,
                    &a.producer_run_id,
                    &a.producer_step_id,
                    &a.snapshot_id,
                ]
                .iter()
                .all(|s| identifier(s))
                || !paths.insert(input.path.to_ascii_lowercase())
                || !inputs.insert(a.id.clone())
            {
                return Err("Build artifact input lineage mismatch".into());
            }
            endpoint(&input.url, &input.token, "download", &a.id)?;
        }
        Ok(())
    }
}

fn check(cancel: &AtomicBool, deadline: Instant) -> Result<()> {
    if cancel.load(Ordering::SeqCst) {
        return Err("Build transfer cancelled".into());
    }
    if Instant::now() >= deadline {
        return Err("Build transfer timeout".into());
    }
    Ok(())
}
fn client(deadline: Instant) -> Result<reqwest::blocking::Client> {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
        return Err("Build transfer timeout".into());
    }
    reqwest::blocking::Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(2))
        .timeout(remaining.min(Duration::from_secs(15)))
        .build()
        .map_err(|_| "Build transfer client unavailable".into())
}
fn target(root: &Path, request: &Request, relative: &str) -> Result<PathBuf> {
    safe_path(relative)?;
    let run = crate::pipeline::cwd(root, &request.run_id, &request.cwd)?;
    let target = run.join(relative);
    no_links(&target)?;
    Ok(target)
}
fn rollback_file(file: &Path, checksum: &str) -> Result<()> {
    no_links(file)?;
    let metadata = match fs::symlink_metadata(file) {
        Ok(v) => v,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err("Build rollback file unavailable".into()),
    };
    if !metadata.is_file() || metadata.len() > LIMIT {
        return Err("Build rollback conflict".into());
    }
    let mut handle = fs::File::open(file)
        .map_err(|_| "Build rollback file unavailable")?
        .take(LIMIT + 1);
    let mut hash = Sha256::new();
    let mut bytes = [0u8; 65536];
    loop {
        let count = handle
            .read(&mut bytes)
            .map_err(|_| "Build rollback read failed")?;
        if count == 0 {
            break;
        }
        hash.update(&bytes[..count]);
    }
    if format!("{:x}", hash.finalize()) != checksum {
        return Err("Build rollback conflict".into());
    }
    fs::remove_file(file).map_err(|_| "Build rollback removal failed".into())
}
fn install_inputs(
    stage: &Path,
    destinations: &[PathBuf],
    checksums: &[String],
    verify: &mut dyn FnMut() -> Result<()>,
) -> Result<()> {
    let mut installed = Vec::new();
    let result = (|| -> Result<()> {
        for (index, dest) in destinations.iter().enumerate() {
            verify()?;
            no_links(dest)?;
            let parent = dest.parent().ok_or("Build target parent unavailable")?;
            fs::create_dir_all(parent).map_err(|_| "Build target directory unavailable")?;
            no_links(dest)?;
            fs::hard_link(stage.join(index.to_string()), dest)
                .map_err(|_| "Build input installation conflict")?;
            installed.push(index);
        }
        verify()?;
        Ok(())
    })();
    if result.is_err() {
        let mut conflict = false;
        // 한 파일이 충돌해도 다른 파일의 복구를 생략하지 않는다.
        for index in installed.into_iter().rev() {
            if rollback_file(&destinations[index], &checksums[index]).is_err() {
                conflict = true;
            }
        }
        if conflict {
            return Err("Build rollback conflict; changed inputs preserved".into());
        }
    }
    result
}
/// 검증된 모든 파일을 먼저 staging한 뒤 create-if-absent로 설치한다. 기존 파일은 덮어쓰지 않는다.
pub fn download(
    request: &Request,
    root: &Path,
    cancel: &Arc<AtomicBool>,
    deadline: Instant,
) -> Result<()> {
    let Some(transfer) = &request.build_artifact_transfer else {
        return Ok(());
    };
    transfer.validate(request)?;
    check(cancel, deadline)?;
    let mut destinations = Vec::new();
    for input in &transfer.inputs {
        let dest = target(root, request, &input.path)?;
        if fs::symlink_metadata(&dest).is_ok() {
            return Err("Build input target already exists".into());
        }
        destinations.push(dest);
    }
    if destinations.is_empty() {
        return Ok(());
    }
    let stage = root
        .join("runs")
        .join(&request.run_id)
        .join(format!(".build-transfer-{}", uuid::Uuid::new_v4()));
    no_links(&stage)?;
    fs::create_dir(&stage).map_err(|_| "Build staging unavailable")?;
    let operation = (|| -> Result<()> {
        for (index, input) in transfer.inputs.iter().enumerate() {
            check(cancel, deadline)?;
            let mut response = client(deadline)?
                .get(&input.url)
                .bearer_auth(&input.token)
                .header("X-Project-Id", &request.project_id)
                .header("If-Match", format!("\"{}\"", input.artifact.checksum))
                .send()
                .map_err(|_| "Build download failed")?;
            if response.status() != reqwest::StatusCode::OK
                || response.content_length() != Some(input.artifact.size)
                || response.headers().get("etag").and_then(|v| v.to_str().ok())
                    != Some(format!("\"{}\"", input.artifact.checksum).as_str())
            {
                return Err("Build download metadata mismatch".into());
            }
            let file = stage.join(index.to_string());
            let mut output = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&file)
                .map_err(|_| "Build staging file unavailable")?;
            let mut hash = Sha256::new();
            let mut size = 0u64;
            let mut bytes = [0u8; 65536];
            loop {
                check(cancel, deadline)?;
                let count = response
                    .read(&mut bytes)
                    .map_err(|_| "Build download interrupted")?;
                if count == 0 {
                    break;
                }
                size += count as u64;
                if size > input.artifact.size {
                    return Err("Build download size mismatch".into());
                }
                hash.update(&bytes[..count]);
                output
                    .write_all(&bytes[..count])
                    .map_err(|_| "Build staging write failed")?;
            }
            if size != input.artifact.size
                || format!("{:x}", hash.finalize()) != input.artifact.checksum
            {
                return Err("Build download checksum mismatch".into());
            }
            // owner-only permissions: never propagate setuid/setgid/sticky or arbitrary source mode.
            #[cfg(unix)]
            if let Some(executable) = input.artifact.executable {
                use std::os::unix::fs::PermissionsExt;
                output
                    .set_permissions(fs::Permissions::from_mode(if executable {
                        0o700
                    } else {
                        0o600
                    }))
                    .map_err(|_| "Build executable policy failed")?;
            }
            output.sync_all().map_err(|_| "Build staging sync failed")?;
        }
        let checksums = transfer
            .inputs
            .iter()
            .map(|i| i.artifact.checksum.clone())
            .collect::<Vec<_>>();
        install_inputs(&stage, &destinations, &checksums, &mut || {
            check(cancel, deadline)
        })
    })();
    let cleanup = fs::remove_dir_all(stage).map_err(|_| "Build staging cleanup failed");
    operation?;
    cleanup?;
    Ok(())
}
struct UploadReader {
    bytes: std::io::Cursor<Vec<u8>>,
    cancel: Arc<AtomicBool>,
    deadline: Instant,
}
impl Read for UploadReader {
    fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
        check(&self.cancel, self.deadline)
            .map_err(|_| std::io::Error::other("Build transfer interrupted"))?;
        let count = output.len().min(65536);
        self.bytes.read(&mut output[..count])
    }
}
pub fn upload(
    request: &Request,
    root: &Path,
    cancel: &Arc<AtomicBool>,
    deadline: Instant,
) -> Result<()> {
    let Some(transfer) = &request.build_artifact_transfer else {
        return Ok(());
    };
    transfer.validate(request)?;
    for output in &transfer.outputs {
        check(cancel, deadline)?;
        let file = target(root, request, &output.path)?;
        let metadata = fs::symlink_metadata(&file).map_err(|_| "Required build output missing")?;
        if !metadata.is_file() || !(1..=LIMIT).contains(&metadata.len()) {
            return Err("Invalid build output file".into());
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if metadata.nlink() != 1 {
                return Err("Hard-linked build output rejected".into());
            }
        }
        let mut handle = fs::File::open(&file).map_err(|_| "Build output unavailable")?;
        let mut bytes = Vec::new();
        let mut chunk = [0u8; 65536];
        loop {
            check(cancel, deadline)?;
            let count = handle
                .read(&mut chunk)
                .map_err(|_| "Build output read failed")?;
            if count == 0 {
                break;
            }
            if bytes.len() + count > metadata.len() as usize {
                return Err("Build output changed during read".into());
            }
            bytes.extend_from_slice(&chunk[..count]);
        }
        if bytes.len() as u64 != metadata.len() {
            return Err("Build output changed during read".into());
        }
        let private = request
            .env
            .iter()
            .filter(|(k, _)| k.as_str() != "TASTEDEV_GRAPH_CONTEXT")
            .map(|(_, v)| v.as_str())
            .chain(std::iter::once(output.token.as_str()));
        if private
            .filter(|v| v.len() >= 4)
            .any(|v| bytes.windows(v.len()).any(|w| w == v.as_bytes()))
        {
            return Err("Build output contains configured private value".into());
        }
        let checksum = format!("{:x}", Sha256::digest(&bytes));
        let mut upload = client(deadline)?.put(&output.url);
        if let Some(executable) = output.executable {
            upload = upload.header("X-Build-Executable", executable.to_string());
        }
        let response = upload
            .bearer_auth(&output.token)
            .header("X-Project-Id", &request.project_id)
            .header("X-Build-Size", bytes.len())
            .header("X-Build-Checksum", &checksum)
            .body(reqwest::blocking::Body::sized(
                UploadReader {
                    bytes: std::io::Cursor::new(bytes),
                    cancel: cancel.clone(),
                    deadline,
                },
                metadata.len(),
            ))
            .send()
            .map_err(|_| "Build upload failed")?;
        check(cancel, deadline)?;
        if response.status() != reqwest::StatusCode::OK {
            return Err("Build upload rejected".into());
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{net::TcpListener, thread};
    fn peer(body: Vec<u8>, advertised_checksum: String) -> (String, thread::JoinHandle<Vec<u8>>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let worker = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut received = Vec::new();
            let mut byte = [0u8; 1];
            while !received.ends_with(b"\r\n\r\n") {
                socket.read_exact(&mut byte).unwrap();
                received.extend_from_slice(&byte);
                assert!(received.len() < 16384);
            }
            let header = String::from_utf8(received).unwrap();
            assert!(header
                .to_ascii_lowercase()
                .contains(&format!("authorization: bearer {}", "b".repeat(64))));
            if header.starts_with("PUT ") {
                let length = header
                    .lines()
                    .find_map(|l| {
                        l.to_ascii_lowercase()
                            .strip_prefix("content-length: ")
                            .map(|v| v.parse::<usize>().unwrap())
                    })
                    .unwrap();
                let mut output = vec![0; length];
                socket.read_exact(&mut output).unwrap();
                socket
                    .write_all(
                        b"HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}",
                    )
                    .unwrap();
                output
            } else {
                assert!(header.to_ascii_lowercase().contains("if-match:"));
                socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: {}\r\nETag: \"{}\"\r\nConnection: close\r\n\r\n",body.len(),advertised_checksum).as_bytes()).unwrap();
                socket.write_all(&body).unwrap();
                Vec::new()
            }
        });
        (base, worker)
    }
    fn request(base: &str, bytes: &[u8], input: bool) -> Request {
        let mut r = crate::tests::request();
        r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
        r.stage = Some("build".into());
        r.requirements.build_artifacts = Some(1);
        r.env.insert("TASTEDEV_GRAPH_CONTEXT".into(),serde_json::json!({"executionId":"execution-1","revision":1,"snapshotId":"snapshot-1","sourceChecksum":"a".repeat(64)}).to_string());
        let id = "a".repeat(64);
        let checksum = format!("{:x}", Sha256::digest(bytes));
        let value = if input {
            serde_json::json!({"version":1,"outputs":[],"inputs":[{"name":"desktop","path":"received/app.exe","url":format!("{base}/build-artifacts/download/{id}"),"token":"b".repeat(64),"artifact":{"version":1,"id":id,"projectId":r.project_id,"executionId":"execution-1","graphRevision":1,"producerActivationId":"producer-1","producerNodeId":"build","producerRunId":"run-1","producerStepId":"step-1","snapshotId":"snapshot-1","sourceChecksum":"a".repeat(64),"name":"desktop","path":"out/app.exe","size":bytes.len(),"checksum":checksum}}]})
        } else {
            serde_json::json!({"version":1,"inputs":[],"outputs":[{"name":"desktop","path":"out/app.exe","id":id,"url":format!("{base}/build-artifacts/upload/{id}"),"token":"b".repeat(64)}]})
        };
        let mut transfer: Transfer = serde_json::from_value(value).unwrap();
        transfer.trusted_core = Some(base.replacen("http:", "ws:", 1) + "/agent");
        r.build_artifact_transfer = Some(transfer);
        r
    }
    fn root(r: &Request) -> tempfile::TempDir {
        let root = tempfile::tempdir().unwrap();
        fs::create_dir_all(root.path().join("runs").join(&r.run_id)).unwrap();
        root
    }
    #[test]
    fn actual_http_upload_and_download_preserve_bytes() {
        let bytes = b"binary\0artifact\xff".to_vec();
        let checksum = format!("{:x}", Sha256::digest(&bytes));
        let (base, worker) = peer(Vec::new(), checksum.clone());
        let r = request(&base, &bytes, false);
        let root = root(&r);
        let run = root.path().join("runs").join(&r.run_id);
        fs::create_dir(run.join("out")).unwrap();
        fs::write(run.join("out/app.exe"), &bytes).unwrap();
        upload(
            &r,
            root.path(),
            &Arc::new(AtomicBool::new(false)),
            Instant::now() + Duration::from_secs(3),
        )
        .unwrap();
        assert_eq!(worker.join().unwrap(), bytes);
        let (base, worker) = peer(bytes.clone(), checksum);
        let r = request(&base, &bytes, true);
        let target = root.path().join("runs").join(&r.run_id);
        fs::create_dir_all(&target).unwrap();
        download(
            &r,
            root.path(),
            &Arc::new(AtomicBool::new(false)),
            Instant::now() + Duration::from_secs(3),
        )
        .unwrap();
        worker.join().unwrap();
        assert_eq!(fs::read(target.join("received/app.exe")).unwrap(), bytes);
        assert!(!fs::read_dir(&target).unwrap().any(|p| p
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".build-transfer-")));
    }
    #[test]
    fn corrupt_download_preserves_workspace_and_cleans_staging() {
        let expected = b"expected";
        let (base, worker) = peer(
            b"tampered".to_vec(),
            format!("{:x}", Sha256::digest(expected)),
        );
        let r = request(&base, expected, true);
        let root = root(&r);
        assert!(download(
            &r,
            root.path(),
            &Arc::new(AtomicBool::new(false)),
            Instant::now() + Duration::from_secs(3)
        )
        .is_err());
        worker.join().unwrap();
        assert_eq!(
            fs::read_dir(root.path().join("runs").join(&r.run_id))
                .unwrap()
                .count(),
            0
        );
    }
    #[test]
    fn existing_input_and_cancellation_never_overwrite_or_transfer() {
        let r = request("http://127.0.0.1:1", b"expected", true);
        let root = root(&r);
        let target = root.path().join("runs").join(&r.run_id).join("received");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("app.exe"), b"user content").unwrap();
        assert!(download(
            &r,
            root.path(),
            &Arc::new(AtomicBool::new(false)),
            Instant::now() + Duration::from_secs(3)
        )
        .is_err());
        assert_eq!(fs::read(target.join("app.exe")).unwrap(), b"user content");
        assert!(download(
            &r,
            root.path(),
            &Arc::new(AtomicBool::new(true)),
            Instant::now() + Duration::from_secs(3)
        )
        .unwrap_err()
        .contains("cancelled"));
    }
    #[test]
    fn pipeline_preserves_installation_report_when_test_fails() {
        let bytes = b"compiled";
        let (base, worker) = peer(bytes.to_vec(), format!("{:x}", Sha256::digest(bytes)));
        let mut r = request(&base, bytes, true);
        r.args = vec!["-e".into(), "process.exit(1)".into()];
        let root = tempfile::tempdir().unwrap();
        let (events, _receiver) = std::sync::mpsc::sync_channel(32);
        let outcome = crate::pipeline::execute(
            r,
            root.path(),
            Arc::new(AtomicBool::new(false)),
            events,
            Arc::new(std::sync::Mutex::new(None)),
        );
        worker.join().unwrap();
        assert_eq!(outcome["status"], "failed");
        assert_eq!(
            outcome["artifactInstallation"][0]["checksum"],
            format!("{:x}", Sha256::digest(bytes))
        );
        assert_eq!(
            outcome["artifactInstallation"][0]["path"],
            "received/app.exe"
        );
        assert_eq!(
            outcome["artifactInstallation"][0]
                .as_object()
                .unwrap()
                .len(),
            4
        );
    }
    #[test]
    fn failed_download_does_not_emit_installation_report() {
        let bytes = b"compiled";
        let (base, worker) = peer(b"tampered".to_vec(), format!("{:x}", Sha256::digest(bytes)));
        let r = request(&base, bytes, true);
        let root = tempfile::tempdir().unwrap();
        let (events, _receiver) = std::sync::mpsc::sync_channel(32);
        let outcome = crate::pipeline::execute(
            r,
            root.path(),
            Arc::new(AtomicBool::new(false)),
            events,
            Arc::new(std::sync::Mutex::new(None)),
        );
        worker.join().unwrap();
        assert_eq!(outcome["status"], "failed");
        assert!(outcome.get("artifactInstallation").is_none());
    }
    #[test]
    fn pipeline_runs_command_then_uploads_before_success() {
        let bytes = b"compiled";
        let (base, worker) = peer(Vec::new(), String::new());
        let mut r = request(&base, bytes, false);
        r.args=vec!["-e".into(),"const fs=require('fs');fs.mkdirSync('out',{recursive:true});fs.writeFileSync('out/app.exe','compiled');".into()];
        let root = tempfile::tempdir().unwrap();
        let (events, _receiver) = std::sync::mpsc::sync_channel(32);
        let outcome = crate::pipeline::execute(
            r,
            root.path(),
            Arc::new(AtomicBool::new(false)),
            events,
            Default::default(),
        );
        assert_eq!(outcome["status"], "passed", "{outcome}");
        assert_eq!(worker.join().unwrap(), bytes);
    }
    #[test]
    fn multi_input_commit_failure_reverts_only_owned_files() {
        let root = tempfile::tempdir().unwrap();
        let stage = root.path().join("stage");
        fs::create_dir(&stage).unwrap();
        fs::write(stage.join("0"), b"artifact-a").unwrap();
        fs::write(stage.join("1"), b"artifact-b").unwrap();
        let paths = vec![root.path().join("a"), root.path().join("b")];
        fs::write(&paths[1], b"user-b").unwrap();
        let hashes = vec![
            format!("{:x}", Sha256::digest(b"artifact-a")),
            format!("{:x}", Sha256::digest(b"artifact-b")),
        ];
        assert!(install_inputs(&stage, &paths, &hashes, &mut || Ok(())).is_err());
        assert!(!paths[0].exists());
        assert_eq!(fs::read(&paths[1]).unwrap(), b"user-b");
    }
    #[test]
    fn multi_input_rollback_preserves_modified_file_and_cleans_other_owned_files() {
        let root = tempfile::tempdir().unwrap();
        let stage = root.path().join("stage");
        fs::create_dir(&stage).unwrap();
        let paths = (0..3)
            .map(|n| root.path().join(n.to_string()))
            .collect::<Vec<_>>();
        let hashes = (0..3)
            .map(|_| format!("{:x}", Sha256::digest(b"artifact")))
            .collect::<Vec<_>>();
        for n in 0..3 {
            fs::write(stage.join(n.to_string()), b"artifact").unwrap();
        }
        let mut calls = 0;
        let mut verify = || {
            calls += 1;
            if calls == 3 {
                fs::write(&paths[1], b"user edit").unwrap();
                return Err("cancelled".into());
            }
            Ok(())
        };
        assert!(install_inputs(&stage, &paths, &hashes, &mut verify)
            .unwrap_err()
            .contains("rollback conflict"));
        assert!(!paths[0].exists());
        assert_eq!(fs::read(&paths[1]).unwrap(), b"user edit");
        assert!(!paths[2].exists());
    }
    #[test]
    fn live_http_download_cancellation_cleans_staging() {
        let bytes = b"expected";
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        let (started_tx, started_rx) = std::sync::mpsc::channel();
        let (finish_tx, finish_rx) = std::sync::mpsc::channel();
        let peer = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut header = Vec::new();
            let mut byte = [0u8; 1];
            while !header.ends_with(b"\r\n\r\n") {
                socket.read_exact(&mut byte).unwrap();
                header.extend_from_slice(&byte);
            }
            socket.write_all(format!("HTTP/1.1 200 OK\r\nContent-Length: 8\r\nETag: \"{:x}\"\r\nConnection: close\r\n\r\n",Sha256::digest(bytes)).as_bytes()).unwrap();
            socket.write_all(&bytes[..4]).unwrap();
            started_tx.send(()).unwrap();
            finish_rx.recv_timeout(Duration::from_secs(3)).unwrap();
            let _ = socket.write_all(&bytes[4..]);
        });
        let r = request(&base, bytes, true);
        let root = root(&r);
        let workspace = root.path().to_owned();
        let run = r.run_id.clone();
        let cancel = Arc::new(AtomicBool::new(false));
        let flag = cancel.clone();
        let worker = thread::spawn(move || {
            download(
                &r,
                &workspace,
                &flag,
                Instant::now() + Duration::from_secs(3),
            )
        });
        started_rx.recv_timeout(Duration::from_secs(3)).unwrap();
        cancel.store(true, Ordering::SeqCst);
        finish_tx.send(()).unwrap();
        assert!(worker.join().unwrap().is_err());
        peer.join().unwrap();
        assert_eq!(
            fs::read_dir(root.path().join("runs").join(run))
                .unwrap()
                .count(),
            0
        );
    }
    #[test]
    fn v2_requires_explicit_policy_and_compatible_requirement() {
        let mut r = request("http://127.0.0.1:1", b"file", true);
        r.build_artifact_transfer.as_mut().unwrap().version = 2;
        let a = &mut r.build_artifact_transfer.as_mut().unwrap().inputs[0].artifact;
        a.version = 2;
        a.executable = Some(true);
        assert!(r
            .build_artifact_transfer
            .as_ref()
            .unwrap()
            .validate(&r)
            .is_err());
        r.requirements.build_artifacts = Some(2);
        assert!(r
            .build_artifact_transfer
            .as_ref()
            .unwrap()
            .validate(&r)
            .is_ok());
        r.build_artifact_transfer.as_mut().unwrap().inputs[0]
            .artifact
            .executable = None;
        assert!(r
            .build_artifact_transfer
            .as_ref()
            .unwrap()
            .validate(&r)
            .is_err());
    }
    #[cfg(unix)]
    #[test]
    fn v2_unix_owner_only_permissions_and_direct_execution() {
        use std::os::unix::fs::PermissionsExt;
        for executable in [true, false] {
            let bytes = b"#!/bin/sh\nexit 0\n";
            let (base, worker) = peer(bytes.to_vec(), format!("{:x}", Sha256::digest(bytes)));
            let mut r = request(&base, bytes, true);
            r.requirements.build_artifacts = Some(2);
            let transfer = r.build_artifact_transfer.as_mut().unwrap();
            transfer.version = 2;
            transfer.inputs[0].artifact.version = 2;
            transfer.inputs[0].artifact.executable = Some(executable);
            let root = root(&r);
            download(
                &r,
                root.path(),
                &Arc::new(AtomicBool::new(false)),
                Instant::now() + Duration::from_secs(3),
            )
            .unwrap();
            worker.join().unwrap();
            let file = root
                .path()
                .join("runs")
                .join(&r.run_id)
                .join("received/app.exe");
            assert_eq!(
                fs::metadata(&file).unwrap().permissions().mode() & 0o7777,
                if executable { 0o700 } else { 0o600 }
            );
            let execution = std::process::Command::new(&file).status();
            if executable {
                assert!(execution.unwrap().success());
            } else {
                assert!(execution.is_err());
            }
        }
    }
}
