use crate::model::{no_links, Request, Result, Source};
use crate::snapshot::{File, Snapshot};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Duration,
};
pub const FILE_LIMIT: usize = 8 * 1024 * 1024;
pub const TOTAL_LIMIT: u64 = 100 * 1024 * 1024;
const MANIFEST_LIMIT: usize = 2 * 1024 * 1024;
const CHUNK: usize = 256 * 1024;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Transfer {
    pub manifest_checksum: String,
    pub file_count: u32,
    pub changed_file_count: u32,
    pub total_bytes: u64,
    pub url: String,
    pub token: String,
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
pub fn origin(source: &Source) -> Result<reqwest::Url> {
    let s = source.snapshot.as_ref().ok_or("Snapshot missing")?;
    let t = s.transfer.as_ref().ok_or("Source transfer missing")?;
    let url = reqwest::Url::parse(&t.url).map_err(|_| "Invalid Source endpoint")?;
    let mut core = reqwest::Url::parse(
        source
            .trusted_core
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
        .map_err(|_| "Core scheme mismatch")?;
    if url.origin() != core.origin()
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Source endpoint outside configured Core".into());
    }
    let parts: Vec<_> = url.path().split('/').collect();
    if parts.len() != 6
        || parts[1] != "sources"
        || parts[2] != "agent"
        || parts[4] != s.snapshot_id
        || parts[5] != "manifest"
        || uuid::Uuid::parse_str(parts[3]).is_err()
    {
        return Err("Source endpoint scope".into());
    }
    Ok(url)
}
pub fn validate_reference(source: &Source) -> Result<()> {
    let s = source.snapshot.as_ref().ok_or("Snapshot missing")?;
    let t = s.transfer.as_ref().ok_or("Source transfer missing")?;
    for id in [&s.project_id, &s.snapshot_id, &s.proposal_id] {
        uuid::Uuid::parse_str(id).map_err(|_| "Invalid Source identity")?;
    }
    if source.provider != "snapshot"
        || s.provider != "snapshot"
        || s.schema_version != Some(2)
        || source.repository != format!("snapshot:{}", s.snapshot_id)
        || source.revision != s.base_revision
        || s.base_revision.len() > 200
        || !(1..=10).contains(&s.attempt)
        || !s.files.is_empty()
        || !s.changed_files.is_empty()
        || t.manifest_checksum != s.checksum
        || !(1..=10000).contains(&t.file_count)
        || t.changed_file_count > 10000
        || t.total_bytes > TOTAL_LIMIT
        || t.token.len() != 64
        || !t.token.bytes().all(|c| c.is_ascii_hexdigit())
        || s.checksum.len() != 64
        || !s
            .checksum
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err("Invalid Source reference".into());
    }
    origin(source)?;
    Ok(())
}
pub fn manifest_hash(s: &Snapshot) -> Result<String> {
    let mut values = vec![
        json!(2),
        json!(s.snapshot_id),
        json!(s.project_id),
        json!(s.proposal_id),
        json!(s.attempt),
        json!(s.base_revision),
        json!(s.changed_files),
    ];
    for f in &s.files {
        values.push(json!([f.path, f.checksum, f.encoding, f.size]));
    }
    Ok(digest(
        serde_json::to_string(&values)
            .map_err(|_| "Source manifest encoding")?
            .as_bytes(),
    ))
}
pub fn validate_manifest(s: &Snapshot) -> Result<()> {
    let mut paths = HashSet::new();
    let mut bytes = 0u64;
    if s.schema_version != Some(2)
        || s.transfer.is_some()
        || s.files.is_empty()
        || s.files.len() > 10000
        || s.changed_files.len() > 10000
    {
        return Err("Source manifest limit".into());
    }
    for f in &s.files {
        crate::snapshot::safe(&f.path)?;
        for part in f.path.split('/') {
            let lower = part.to_ascii_lowercase();
            let stem = lower.split('.').next().unwrap_or("");
            if ["con", "prn", "aux", "nul"].contains(&stem)
                || (stem.len() == 4
                    && (stem.starts_with("com") || stem.starts_with("lpt"))
                    && matches!(stem.as_bytes()[3], b'1'..=b'9'))
            {
                return Err("Source device path".into());
            }
        }
        if !paths.insert(f.path.to_lowercase())
            || !f.content.is_empty()
            || f.cached
            || !matches!(f.encoding.as_deref(), Some("utf8" | "base64"))
            || f.size.is_none_or(|v| v > FILE_LIMIT as u64)
            || f.checksum.len() != 64
            || !f
                .checksum
                .bytes()
                .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
        {
            return Err("Source manifest file".into());
        }
        bytes = bytes
            .checked_add(f.size.unwrap_or(0))
            .ok_or("Source size overflow")?;
    }
    if bytes > TOTAL_LIMIT
        || s.changed_files
            .iter()
            .any(|p| !s.files.iter().any(|f| &f.path == p))
        || manifest_hash(s)? != s.checksum
    {
        return Err("Source manifest integrity".into());
    }
    Ok(())
}
fn client() -> Result<Client> {
    Client::builder()
        .no_proxy()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|_| "Source HTTP initialization failed".into())
}
pub fn manifest(request: &Request, cancel: &Arc<AtomicBool>) -> Result<Snapshot> {
    let source = request.source.as_ref().ok_or("Source missing")?;
    validate_reference(source)?;
    let descriptor = source.snapshot.as_ref().ok_or("Snapshot missing")?;
    let t = descriptor
        .transfer
        .as_ref()
        .ok_or("Source transfer missing")?;
    let url = origin(source)?;
    if url.path()
        != format!(
            "/sources/agent/{}/{}/manifest",
            request.run_id, descriptor.snapshot_id
        )
    {
        return Err("Source Run mismatch".into());
    }
    if cancel.load(Ordering::SeqCst) {
        return Err("Source cancelled".into());
    }
    let response = client()?
        .get(url)
        .bearer_auth(&t.token)
        .send()
        .map_err(|_| "Source manifest unavailable")?;
    if response.status() != reqwest::StatusCode::OK {
        return Err("Source manifest denied".into());
    }
    let mut bytes = Vec::new();
    response
        .take(MANIFEST_LIMIT as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Source manifest read failed")?;
    if bytes.len() > MANIFEST_LIMIT {
        return Err("Source manifest too large".into());
    }
    let s: Snapshot = serde_json::from_slice(&bytes).map_err(|_| "Source manifest invalid")?;
    validate_manifest(&s)?;
    let total: u64 = s.files.iter().map(|f| f.size.unwrap_or(0)).sum();
    if s.snapshot_id != descriptor.snapshot_id
        || s.project_id != request.project_id
        || s.project_id != descriptor.project_id
        || s.proposal_id != descriptor.proposal_id
        || s.attempt != descriptor.attempt
        || s.base_revision != descriptor.base_revision
        || s.checksum != descriptor.checksum
        || s.files.len() != t.file_count as usize
        || s.changed_files.len() != t.changed_file_count as usize
        || total != t.total_bytes
    {
        return Err("Source manifest identity mismatch".into());
    }
    Ok(s)
}
#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Prefix {
    checksum: String,
    offset: u64,
    prefix_hash: String,
}
fn save_prefix(path: &Path, value: &Prefix) -> Result<()> {
    no_links(path)?;
    let temp = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    no_links(&temp)?;
    let result = (|| {
        let mut f = fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&temp)
            .map_err(|_| "Source prefix open failed")?;
        f.write_all(
            serde_json::to_string(value)
                .map_err(|_| "Source prefix encoding")?
                .as_bytes(),
        )
        .and_then(|_| f.sync_all())
        .map_err(|_| "Source prefix sync failed")?;
        fs::rename(&temp, path).map_err(|_| "Source prefix commit failed")?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}
pub fn file(request: &Request, root: &Path, f: &File, cancel: &Arc<AtomicBool>) -> Result<Vec<u8>> {
    let source = request.source.as_ref().ok_or("Source missing")?;
    let s = source.snapshot.as_ref().ok_or("Snapshot missing")?;
    let t = s.transfer.as_ref().ok_or("Source transfer missing")?;
    let size = f.size.ok_or("Source size missing")?;
    if size > FILE_LIMIT as u64
        || f.checksum.len() != 64
        || !f
            .checksum
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err("Source file too large".into());
    }
    let directory = crate::pipeline::cwd(root, &request.run_id, ".")?.join("snapshot-downloads");
    no_links(&directory)?;
    fs::create_dir_all(&directory).map_err(|_| "Source download directory")?;
    let part = directory.join(format!("{}.partial", f.checksum));
    let checkpoint = directory.join(format!("{}.json", f.checksum));
    no_links(&part)?;
    no_links(&checkpoint)?;
    let mut offset = 0u64;
    let mut prefix = Sha256::new();
    if checkpoint.exists() {
        if fs::metadata(&checkpoint)
            .map_err(|_| "Source prefix missing")?
            .len()
            > 2048
        {
            return Err("Source prefix limit".into());
        }
        let saved: Prefix =
            serde_json::from_slice(&fs::read(&checkpoint).map_err(|_| "Source prefix missing")?)
                .map_err(|_| "Source prefix invalid")?;
        if saved.checksum != f.checksum || saved.offset > size {
            return Err("Source prefix identity mismatch".into());
        }
        let mut bytes = Vec::new();
        fs::File::open(&part)
            .map_err(|_| "Source acknowledged prefix missing")?
            .take(saved.offset)
            .read_to_end(&mut bytes)
            .map_err(|_| "Source prefix read failed")?;
        if bytes.len() as u64 != saved.offset || digest(&bytes) != saved.prefix_hash {
            return Err("Source prefix corrupted".into());
        }
        fs::OpenOptions::new()
            .write(true)
            .open(&part)
            .and_then(|p| p.set_len(saved.offset))
            .map_err(|_| "Source tail recovery failed")?;
        prefix.update(&bytes);
        offset = saved.offset;
    } else {
        fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&part)
            .map_err(|_| "Source partial unavailable")?;
    }
    let mut url = origin(source)?;
    url.set_path(&format!(
        "/sources/agent/{}/{}/blobs/{}",
        request.run_id, s.snapshot_id, f.checksum
    ));
    let http = client()?;
    let mut retries = 0;
    while offset < size {
        if cancel.load(Ordering::SeqCst) {
            return Err("Source cancelled".into());
        }
        let end = (offset + CHUNK as u64).min(size) - 1;
        let outcome = (|| -> Result<Vec<u8>> {
            let response = http
                .get(url.clone())
                .bearer_auth(&t.token)
                .header("Range", format!("bytes={offset}-{end}"))
                .header("If-Match", format!("\"{}\"", f.checksum))
                .send()
                .map_err(|_| "Source chunk unavailable")?;
            if response.status() != reqwest::StatusCode::PARTIAL_CONTENT
                || response
                    .headers()
                    .get("Content-Range")
                    .and_then(|v| v.to_str().ok())
                    != Some(format!("bytes {offset}-{end}/{size}").as_str())
            {
                return Err("Source chunk scope mismatch".into());
            }
            let mut chunk = Vec::new();
            response
                .take(CHUNK as u64 + 1)
                .read_to_end(&mut chunk)
                .map_err(|_| "Source chunk interrupted")?;
            if chunk.len() as u64 != end - offset + 1 {
                return Err("Source chunk size mismatch".into());
            }
            Ok(chunk)
        })();
        let chunk = match outcome {
            Ok(v) => {
                retries = 0;
                v
            }
            Err(error) => {
                retries += 1;
                if retries >= 3 {
                    return Err(error);
                }
                continue;
            }
        };
        let mut handle = fs::OpenOptions::new()
            .append(true)
            .open(&part)
            .map_err(|_| "Source partial unavailable")?;
        handle
            .write_all(&chunk)
            .and_then(|_| handle.sync_all())
            .map_err(|_| "Source partial sync failed")?;
        prefix.update(&chunk);
        offset += chunk.len() as u64;
        save_prefix(
            &checkpoint,
            &Prefix {
                checksum: f.checksum.clone(),
                offset,
                prefix_hash: format!("{:x}", prefix.clone().finalize()),
            },
        )?;
    }
    if cancel.load(Ordering::SeqCst) {
        return Err("Source cancelled".into());
    }
    no_links(&part)?;
    let mut bytes = Vec::new();
    fs::File::open(&part)
        .map_err(|_| "Source download unavailable")?
        .take(size + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Source download unavailable")?;
    if bytes.len() as u64 != size || digest(&bytes) != f.checksum {
        return Err("Source download integrity mismatch".into());
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::TcpListener;
    use std::thread;
    fn request(port: u16, bytes: &[u8]) -> (Request, File) {
        let project = uuid::Uuid::new_v4().to_string();
        let snapshot = uuid::Uuid::new_v4().to_string();
        let run = uuid::Uuid::new_v4().to_string();
        let mut req:Request=serde_json::from_value(json!({"protocolVersion":1,"type":"execute","agentId":"fixture","jobId":uuid::Uuid::new_v4(),"runId":run,"projectId":project,"requirements":{"sourceSnapshot":2},"executable":"snapshot","args":[],"cwd":".","env":{},"timeoutMs":10000,"runStepId":uuid::Uuid::new_v4(),"stage":"source","source":{"provider":"snapshot","repository":format!("snapshot:{snapshot}"),"revision":"working-tree","snapshot":{"schemaVersion":2,"provider":"snapshot","snapshotId":snapshot,"projectId":project,"proposalId":uuid::Uuid::new_v4(),"attempt":1,"baseRevision":"working-tree","changedFiles":[],"files":[],"checksum":"a".repeat(64),"transfer":{"manifestChecksum":"a".repeat(64),"fileCount":1,"changedFileCount":0,"totalBytes":bytes.len(),"url":format!("http://127.0.0.1:{port}/sources/agent/{run}/{snapshot}/manifest"),"token":"b".repeat(64)}}}})).unwrap();
        req.source.as_mut().unwrap().trusted_core = Some(format!("ws://127.0.0.1:{port}/agent"));
        (
            req,
            File {
                path: "asset.bin".into(),
                content: String::new(),
                checksum: digest(bytes),
                cached: false,
                encoding: Some("base64".into()),
                size: Some(bytes.len() as u64),
            },
        )
    }
    fn root() -> tempfile::TempDir {
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/phase-2/rust");
        fs::create_dir_all(&base).unwrap();
        tempfile::tempdir_in(base).unwrap()
    }
    #[test]
    fn configured_core_origin_and_checksum_paths_are_enforced() {
        let (mut r, mut f) = request(4300, b"binary");
        assert!(validate_reference(r.source.as_ref().unwrap()).is_ok());
        r.source
            .as_mut()
            .unwrap()
            .snapshot
            .as_mut()
            .unwrap()
            .transfer
            .as_mut()
            .unwrap()
            .url = "http://evil.invalid/sources".into();
        assert!(validate_reference(r.source.as_ref().unwrap()).is_err());
        f.checksum = "../escape".into();
        assert!(file(&r, root().path(), &f, &Arc::new(AtomicBool::new(false))).is_err());
    }
    #[test]
    fn cancellation_and_corrupted_acknowledged_prefix_preserve_workspace_boundary() {
        let (r, f) = request(4300, b"binary");
        let dir = root();
        let cancel = Arc::new(AtomicBool::new(true));
        assert!(file(&r, dir.path(), &f, &cancel).is_err());
        let download = crate::pipeline::cwd(dir.path(), &r.run_id, ".")
            .unwrap()
            .join("snapshot-downloads");
        fs::write(download.join(format!("{}.partial", f.checksum)), b"corrupt").unwrap();
        save_prefix(
            &download.join(format!("{}.json", f.checksum)),
            &Prefix {
                checksum: f.checksum.clone(),
                offset: 6,
                prefix_hash: digest(b"binary"),
            },
        )
        .unwrap();
        assert!(file(&r, dir.path(), &f, &Arc::new(AtomicBool::new(false)))
            .unwrap_err()
            .contains("corrupted"));
        assert!(!crate::pipeline::cwd(dir.path(), &r.run_id, ".")
            .unwrap()
            .join("source")
            .exists());
    }
    #[test]
    fn actual_http_chunks_resume_after_restart_and_verify_original_binary() {
        let bytes: Vec<u8> = (0..600000).map(|i| (i % 251) as u8).collect();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let (r, f) = request(port, &bytes);
        let dir = root();
        let data = bytes.clone();
        let server = thread::spawn(move || {
            for (index, incoming) in listener.incoming().take(6).enumerate() {
                let mut stream = incoming.unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(2)))
                    .unwrap();
                let mut raw = Vec::new();
                loop {
                    let mut byte = [0];
                    stream.read_exact(&mut byte).unwrap();
                    raw.push(byte[0]);
                    if raw.ends_with(b"\r\n\r\n") {
                        break;
                    }
                    assert!(raw.len() < 8192);
                }
                let text = String::from_utf8(raw).unwrap();
                let range = text
                    .lines()
                    .find(|s| s.to_lowercase().starts_with("range:"))
                    .unwrap();
                let bounds = range.split("bytes=").nth(1).unwrap();
                let (start, end) = bounds.split_once('-').unwrap();
                let start: usize = start.parse().unwrap();
                let end: usize = end.parse().unwrap();
                if (1..=3).contains(&index) {
                    assert_eq!(start, CHUNK);
                    write!(stream,"HTTP/1.1 503 Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").unwrap();
                    continue;
                }
                if index == 4 {
                    assert_eq!(start, CHUNK);
                }
                write!(stream,"HTTP/1.1 206 Partial Content\r\nContent-Length: {}\r\nContent-Range: bytes {start}-{end}/{}\r\nConnection: close\r\n\r\n",end-start+1,data.len()).unwrap();
                stream.write_all(&data[start..=end]).unwrap();
            }
        });
        let cancel = Arc::new(AtomicBool::new(false));
        assert!(file(&r, dir.path(), &f, &cancel).is_err());
        assert_eq!(file(&r, dir.path(), &f, &cancel).unwrap(), bytes);
        server.join().unwrap();
    }
}
