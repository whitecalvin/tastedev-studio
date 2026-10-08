use crate::model::{no_links, Result};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::SystemTime,
};
const LIMIT: usize = 256;
const FILE_LIMIT: usize = 8 * 1024 * 1024;
type Verified = HashMap<PathBuf, (u64, SystemTime)>;
static VERIFIED: OnceLock<Mutex<Verified>> = OnceLock::new();
fn advertised(root: &Path, project: &str, checksum: &str) -> bool {
    let Ok(path) = location(root, project, checksum) else {
        return false;
    };
    let Ok(meta) = fs::metadata(&path) else {
        return false;
    };
    if !meta.is_file() || meta.len() > FILE_LIMIT as u64 {
        return false;
    }
    let Ok(modified) = meta.modified() else {
        return false;
    };
    let fingerprint = (meta.len(), modified);
    let memo = VERIFIED.get_or_init(|| Mutex::new(HashMap::new()));
    if memo
        .lock()
        .is_ok_and(|m| m.get(&path) == Some(&fingerprint))
    {
        return true;
    }
    if read(root, project, checksum).is_err() {
        return false;
    }
    if let Ok(mut m) = memo.lock() {
        if m.len() >= LIMIT {
            m.clear();
        }
        m.insert(path, fingerprint);
    }
    true
}
fn digest(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn location(root: &Path, project: &str, checksum: &str) -> Result<PathBuf> {
    uuid::Uuid::parse_str(project).map_err(|_| "Cache project identity")?;
    if checksum.len() != 64
        || !checksum
            .bytes()
            .all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
    {
        return Err("Cache checksum identity".into());
    }
    let file = root.join("source-cache").join(project).join(checksum);
    no_links(&file)?;
    Ok(file)
}
pub fn read(root: &Path, project: &str, checksum: &str) -> Result<Vec<u8>> {
    let file = location(root, project, checksum)?;
    let metadata = fs::metadata(&file).map_err(|_| "Cached source unavailable")?;
    if !metadata.is_file() || metadata.len() > FILE_LIMIT as u64 {
        return Err("Cached source limit".into());
    }
    // 이미 검증한 최대 8MiB 파일 크기만 예약해 읽기 중 반복 재할당을 줄인다.
    // 읽기 도중 파일이 바뀌어도 아래 take 상한과 checksum 검증은 그대로 적용한다.
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    fs::File::open(file)
        .map_err(|_| "Cached source unavailable")?
        .take(FILE_LIMIT as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Cached source unavailable")?;
    if bytes.len() > FILE_LIMIT {
        return Err("Cached source limit".into());
    }
    if digest(&bytes) != checksum {
        return Err("Cached source integrity".into());
    }
    Ok(bytes)
}
pub fn inventory(root: &Path) -> Vec<String> {
    let base = root.join("source-cache");
    if no_links(&base).is_err() {
        return vec![];
    }
    let mut entries = vec![];
    let Ok(projects) = fs::read_dir(&base) else {
        return entries;
    };
    for project in projects.take(LIMIT).flatten() {
        let Some(id) = project.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if uuid::Uuid::parse_str(&id).is_err() {
            continue;
        }
        if no_links(&project.path()).is_err() {
            continue;
        }
        let Ok(files) = fs::read_dir(project.path()) else {
            continue;
        };
        for file in files.take(LIMIT).flatten() {
            let Some(checksum) = file.file_name().to_str().map(str::to_owned) else {
                continue;
            };
            if advertised(root, &id, &checksum) {
                entries.push(format!("{id}:{checksum}"));
                if entries.len() == LIMIT {
                    return entries;
                }
            }
        }
    }
    entries
}
fn retained_count(root: &Path, incoming: usize) -> usize {
    let base = root.join("source-cache");
    let Ok(projects) = fs::read_dir(base) else {
        return 0;
    };
    let mut count = 0;
    let mut bytes = incoming as u64;
    for project in projects.take(LIMIT + 1).flatten() {
        if no_links(&project.path()).is_err() {
            return LIMIT;
        }
        let Ok(files) = fs::read_dir(project.path()) else {
            continue;
        };
        for file in files.take(LIMIT + 1).flatten() {
            if no_links(&file.path()).is_err() {
                return LIMIT;
            }
            let Ok(meta) = file.metadata() else {
                return LIMIT;
            };
            if !meta.is_file() {
                return LIMIT;
            }
            bytes = bytes.saturating_add(meta.len());
            count += 1;
            if bytes > 512 * 1024 * 1024 || count >= LIMIT {
                return LIMIT;
            }
        }
        if count >= LIMIT {
            return LIMIT;
        }
    }
    count
}
pub fn save(root: &Path, project: &str, checksum: &str, bytes: &[u8]) -> Result<()> {
    if bytes.len() > FILE_LIMIT || digest(bytes) != checksum {
        return Err("Cache content integrity".into());
    }
    if read(root, project, checksum).is_ok() {
        return Ok(());
    }
    let file = location(root, project, checksum)?;
    let parent = file.parent().ok_or("Cache parent")?;
    no_links(parent)?;
    fs::create_dir_all(parent).map_err(|_| "Cache directory unavailable")?;
    // Only a bounded, project-scoped cache is retained. A full cache never prevents execution.
    if !file.exists() && retained_count(root, bytes.len()) >= LIMIT {
        return Err("Source cache capacity".into());
    }
    let temp = file.with_extension(format!("{}.partial", uuid::Uuid::new_v4()));
    no_links(&temp)?;
    let outcome = (|| -> Result<()> {
        let mut output = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp)
            .map_err(|_| "Cache staging unavailable")?;
        output
            .write_all(bytes)
            .and_then(|_| output.sync_all())
            .map_err(|_| "Cache write failed")?;
        if file.exists() {
            no_links(&file)?;
            fs::remove_file(&file).map_err(|_| "Cache repair failed")?;
        }
        fs::rename(&temp, &file).map_err(|_| "Cache commit failed")?;
        Ok(())
    })();
    if outcome.is_err() {
        let _ = fs::remove_file(temp);
    }
    outcome
}

#[cfg(test)]
mod tests {
    use super::*;
    fn root() -> tempfile::TempDir {
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-2/rust");
        fs::create_dir_all(&base).unwrap();
        tempfile::tempdir_in(base).unwrap()
    }
    #[test]
    fn binary_cache_exceeds_legacy_text_limit_and_rechecks_bytes() {
        let dir = root();
        let project = uuid::Uuid::new_v4().to_string();
        let bytes = vec![128; 600000];
        let checksum = digest(&bytes);
        save(dir.path(), &project, &checksum, &bytes).unwrap();
        assert_eq!(read(dir.path(), &project, &checksum).unwrap(), bytes);
        assert_eq!(inventory(dir.path()).len(), 1);
        fs::write(
            location(dir.path(), &project, &checksum).unwrap(),
            vec![129; 600000],
        )
        .unwrap();
        assert!(read(dir.path(), &project, &checksum).is_err());
    }
    #[test]
    fn persisted_cache_reopens_and_is_project_scoped() {
        let dir = root();
        let project = uuid::Uuid::new_v4().to_string();
        let checksum = digest(b"verified source");
        save(dir.path(), &project, &checksum, b"verified source").unwrap();
        assert_eq!(
            read(dir.path(), &project, &checksum).unwrap(),
            b"verified source"
        );
        assert_eq!(inventory(dir.path()), vec![format!("{project}:{checksum}")]);
        assert!(read(dir.path(), &uuid::Uuid::new_v4().to_string(), &checksum).is_err());
    }
    #[test]
    fn bounded_read_accepts_empty_and_limit_files_but_rejects_oversize() {
        let dir = root();
        let project = uuid::Uuid::new_v4().to_string();
        for bytes in [Vec::new(), vec![31; FILE_LIMIT]] {
            let checksum = digest(&bytes);
            let path = location(dir.path(), &project, &checksum).unwrap();
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(&path, &bytes).unwrap();
            assert_eq!(read(dir.path(), &project, &checksum).unwrap(), bytes);
            fs::write(&path, vec![31; FILE_LIMIT + 1]).unwrap();
            assert!(read(dir.path(), &project, &checksum).is_err());
        }
    }
    #[test]
    fn corruption_and_escape_are_not_advertised() {
        let dir = root();
        let project = uuid::Uuid::new_v4().to_string();
        let checksum = digest(b"verified");
        save(dir.path(), &project, &checksum, b"verified").unwrap();
        fs::write(
            location(dir.path(), &project, &checksum).unwrap(),
            b"corrupt",
        )
        .unwrap();
        assert!(inventory(dir.path()).is_empty());
        assert!(read(dir.path(), &project, &checksum).is_err());
        assert!(save(dir.path(), "../escape", &checksum, b"verified").is_err());
        assert!(save(dir.path(), &project, "../escape", b"verified").is_err());
        assert!(save(dir.path(), &project, &checksum, b"bad").is_err());
    }
}
