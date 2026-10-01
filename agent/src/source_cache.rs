use crate::model::{no_links, Result};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};
const LIMIT: usize = 256;
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
    if !metadata.is_file() || metadata.len() > 24000 {
        return Err("Cached source limit".into());
    }
    let bytes = fs::read(file).map_err(|_| "Cached source unavailable")?;
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
            if read(root, &id, &checksum).is_ok() {
                entries.push(format!("{id}:{checksum}"));
                if entries.len() == LIMIT {
                    return entries;
                }
            }
        }
    }
    entries
}
fn retained_count(root: &Path) -> usize {
    let base = root.join("source-cache");
    let Ok(projects) = fs::read_dir(base) else {
        return 0;
    };
    let mut count = 0;
    for project in projects.take(LIMIT + 1).flatten() {
        if no_links(&project.path()).is_err() {
            return LIMIT;
        }
        let Ok(files) = fs::read_dir(project.path()) else {
            continue;
        };
        count += files.take(LIMIT + 1).count();
        if count >= LIMIT {
            return LIMIT;
        }
    }
    count
}
pub fn save(root: &Path, project: &str, checksum: &str, bytes: &[u8]) -> Result<()> {
    if bytes.len() > 24000 || digest(bytes) != checksum {
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
    if !file.exists() && retained_count(root) >= LIMIT {
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
