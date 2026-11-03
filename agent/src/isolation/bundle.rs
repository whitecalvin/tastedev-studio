//! Explicit runtime dependencies, never recursive host-directory copying.
use crate::model::{no_links, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

const TOTAL_LIMIT: u64 = 512 * 1024 * 1024;
const FILE_LIMIT: u64 = 128 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Definition {
    source: PathBuf,
    path: String,
    checksum: String,
    size: u64,
}
#[derive(Serialize)]
struct Entry {
    #[serde(skip)]
    source: PathBuf,
    path: String,
    checksum: String,
    size: u64,
}
#[derive(Default)]
pub(super) struct Bundle {
    files: Vec<Entry>,
}
impl Bundle {
    pub fn load(
        definitions: Vec<Definition>,
        source_root: &Path,
        executable_name: &str,
    ) -> Result<Self> {
        super::catalog::local(source_root)?;
        no_links(source_root)?;
        let source_root = source_root
            .canonicalize()
            .map_err(|_| "Runtime Source boundary unavailable")?;
        if definitions.len() > 256 {
            return Err("Runtime bundle file count limit".into());
        }
        let mut names = BTreeSet::from([executable_name.to_ascii_lowercase()]);
        let mut total = 0u64;
        let mut files = Vec::new();
        for definition in definitions {
            crate::build_artifact::safe_path(&definition.path)?;
            super::catalog::local(&definition.source)?;
            no_links(&definition.source)?;
            let source = definition
                .source
                .canonicalize()
                .map_err(|_| "Runtime dependency unavailable")?;
            if super::catalog::inside(&source, &source_root) {
                return Err("Project Source cannot supply runtime dependencies".into());
            }
            crate::build_artifact::safe_path(
                source
                    .file_name()
                    .and_then(|s| s.to_str())
                    .ok_or("Runtime dependency name unavailable")?,
            )?;
            let name = definition.path.to_ascii_lowercase();
            if names.iter().any(|old| {
                name == *old
                    || name.starts_with(&format!("{old}/"))
                    || old.starts_with(&format!("{name}/"))
            }) {
                return Err("Runtime bundle path collision".into());
            }
            names.insert(name);
            total = total
                .checked_add(definition.size)
                .ok_or("Runtime bundle size overflow")?;
            if definition.size > FILE_LIMIT || total > TOTAL_LIMIT || !hex(&definition.checksum) {
                return Err("Runtime bundle integrity policy limit".into());
            }
            let metadata =
                fs::metadata(&source).map_err(|_| "Runtime dependency metadata unavailable")?;
            if !metadata.is_file() || metadata.len() != definition.size {
                return Err("Runtime dependency size mismatch".into());
            }
            files.push(Entry {
                source,
                path: definition.path,
                checksum: definition.checksum,
                size: definition.size,
            });
        }
        files.sort_by(|a, b| a.path.cmp(&b.path));
        Ok(Self { files })
    }
    pub fn is_empty(&self) -> bool {
        self.files.is_empty()
    }
    pub fn checksum(&self) -> Option<String> {
        (!self.files.is_empty()).then(|| {
            format!(
                "{:x}",
                Sha256::digest(serde_json::to_vec(&self.files).expect("serializable manifest"))
            )
        })
    }
    /// All destinations must be in an owned new program directory. On failure
    /// its owning profile performs cleanup; this API never deletes host files.
    #[cfg(test)]
    pub fn copy_into(&self, directory: &Path) -> Result<Vec<PathBuf>> {
        self.copy_controlled(
            directory,
            &std::sync::atomic::AtomicBool::new(false),
            std::time::Instant::now() + std::time::Duration::from_secs(30),
        )
    }
    pub fn copy_controlled(
        &self,
        directory: &Path,
        cancel: &std::sync::atomic::AtomicBool,
        deadline: std::time::Instant,
    ) -> Result<Vec<PathBuf>> {
        check(cancel, deadline)?;
        super::catalog::local(directory)?;
        no_links(directory)?;
        let mut paths = Vec::new();
        for entry in &self.files {
            let destination = directory.join(&entry.path);
            no_links(&destination)?;
            if destination.exists() {
                return Err("Runtime dependency destination already exists".into());
            }
        }
        for entry in &self.files {
            no_links(&entry.source)?;
            check(cancel, deadline)?;
            let destination = directory.join(&entry.path);
            let parent = destination
                .parent()
                .ok_or("Runtime dependency parent missing")?;
            no_links(parent)?;
            fs::create_dir_all(parent).map_err(|_| "Runtime dependency directory unavailable")?;
            no_links(parent)?;
            let mut input =
                fs::File::open(&entry.source).map_err(|_| "Runtime dependency read unavailable")?;
            let metadata = input
                .metadata()
                .map_err(|_| "Runtime dependency metadata unavailable")?;
            if !metadata.is_file() || metadata.len() != entry.size {
                return Err("Runtime dependency changed".into());
            }
            let mut output = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&destination)
                .map_err(|_| "New private runtime dependency required")?;
            let mut hash = Sha256::new();
            let mut size = 0u64;
            let mut bytes = [0u8; 65536];
            let result = (|| -> Result<()> {
                loop {
                    check(cancel, deadline)?;
                    let count = input
                        .read(&mut bytes)
                        .map_err(|_| "Runtime dependency read failed")?;
                    if count == 0 {
                        break;
                    }
                    size += count as u64;
                    if size > entry.size {
                        return Err("Runtime dependency grew during copy".into());
                    }
                    hash.update(&bytes[..count]);
                    output
                        .write_all(&bytes[..count])
                        .map_err(|_| "Runtime dependency write failed")?;
                }
                if size != entry.size || format!("{:x}", hash.finalize()) != entry.checksum {
                    return Err("Runtime dependency checksum changed".into());
                }
                output
                    .sync_all()
                    .map_err(|_| "Runtime dependency sync failed".into())
            })();
            drop(output);
            if result.is_err() {
                fs::remove_file(&destination).map_err(|_| "Runtime dependency cleanup failed")?;
            }
            result?;
            paths.push(destination);
        }
        Ok(paths)
    }
}
pub(super) fn check(
    cancel: &std::sync::atomic::AtomicBool,
    deadline: std::time::Instant,
) -> Result<()> {
    if cancel.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("Private runtime preparation cancelled".into());
    }
    if std::time::Instant::now() >= deadline {
        return Err("Private runtime preparation timeout".into());
    }
    Ok(())
}
fn hex(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn definition(source: &Path, path: &str, bytes: &[u8]) -> Definition {
        Definition {
            source: source.into(),
            path: path.into(),
            checksum: format!("{:x}", Sha256::digest(bytes)),
            size: bytes.len() as u64,
        }
    }
    #[test]
    fn exact_dependency_bytes_and_manifest_identity_preserve_original() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("project");
        fs::create_dir(&source).unwrap();
        let library = root.path().join("runtime.dll");
        fs::write(&library, b"library bytes").unwrap();
        let bundle = Bundle::load(
            vec![definition(&library, "lib/runtime.dll", b"library bytes")],
            &source,
            "python.exe",
        )
        .unwrap();
        let private = root.path().join("private");
        fs::create_dir(&private).unwrap();
        assert_eq!(
            bundle.copy_into(&private).unwrap(),
            vec![private.join("lib/runtime.dll")]
        );
        assert_eq!(
            fs::read(private.join("lib/runtime.dll")).unwrap(),
            b"library bytes"
        );
        assert!(bundle.copy_into(&private).is_err());
        assert_eq!(fs::read(&library).unwrap(), b"library bytes");
        assert!(bundle.checksum().is_some());
        assert!(Bundle::default().checksum().is_none());
        fs::write(&library, b"changed bytes").unwrap();
        let second = root.path().join("second");
        fs::create_dir(&second).unwrap();
        assert!(bundle.copy_into(&second).is_err());
        assert!(!second.join("lib/runtime.dll").exists());
    }
    #[test]
    fn source_secrets_paths_duplicates_and_parent_aliases_are_rejected() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("project");
        fs::create_dir(&source).unwrap();
        let library = root.path().join("runtime.dll");
        fs::write(&library, b"bytes").unwrap();
        for path in [
            "../escape.dll",
            ".env",
            "credential.json",
            "python.exe",
            "lib/../runtime.dll",
            "C:/runtime.dll",
        ] {
            assert!(Bundle::load(
                vec![definition(&library, path, b"bytes")],
                &source,
                "python.exe"
            )
            .is_err());
        }
        for paths in [["lib.dll", "LIB.dll"], ["lib", "lib/runtime.dll"]] {
            assert!(Bundle::load(
                paths
                    .into_iter()
                    .map(|p| definition(&library, p, b"bytes"))
                    .collect(),
                &source,
                "python.exe"
            )
            .is_err());
        }
        let project_library = source.join("runtime.dll");
        fs::write(&project_library, b"bytes").unwrap();
        assert!(Bundle::load(
            vec![definition(&project_library, "runtime.dll", b"bytes")],
            &source,
            "python.exe"
        )
        .is_err());
    }
    #[test]
    fn checksum_is_independent_of_host_source_path_and_definition_order() {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("project");
        fs::create_dir(&source).unwrap();
        let a = root.path().join("a.dll");
        let b = root.path().join("b.dll");
        fs::write(&a, b"same").unwrap();
        fs::write(&b, b"same").unwrap();
        let one = Bundle::load(
            vec![
                definition(&a, "a.dll", b"same"),
                definition(&b, "b.dll", b"same"),
            ],
            &source,
            "python.exe",
        )
        .unwrap();
        let two = Bundle::load(
            vec![
                definition(&a, "b.dll", b"same"),
                definition(&b, "a.dll", b"same"),
            ],
            &source,
            "python.exe",
        )
        .unwrap();
        assert_eq!(one.checksum(), two.checksum());
    }
    #[test]
    fn copy_checks_cancellation_deadline_and_declared_limits_before_writes() {
        use std::{
            sync::atomic::AtomicBool,
            time::{Duration, Instant},
        };
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("project");
        fs::create_dir(&source).unwrap();
        let library = root.path().join("runtime.dll");
        fs::write(&library, b"bytes").unwrap();
        let bundle = Bundle::load(
            vec![definition(&library, "runtime.dll", b"bytes")],
            &source,
            "python.exe",
        )
        .unwrap();
        let private = root.path().join("private");
        fs::create_dir(&private).unwrap();
        assert!(bundle
            .copy_controlled(
                &private,
                &AtomicBool::new(true),
                Instant::now() + Duration::from_secs(3)
            )
            .unwrap_err()
            .contains("cancelled"));
        assert!(bundle
            .copy_controlled(&private, &AtomicBool::new(false), Instant::now())
            .unwrap_err()
            .contains("timeout"));
        assert_eq!(fs::read_dir(&private).unwrap().count(), 0);
        let mut huge = definition(&library, "runtime.dll", b"bytes");
        huge.size = FILE_LIMIT + 1;
        assert!(Bundle::load(vec![huge], &source, "python.exe").is_err());
        assert!(Bundle::load(
            (0..257)
                .map(|_| definition(&library, "runtime.dll", b"bytes"))
                .collect(),
            &source,
            "python.exe"
        )
        .is_err());
    }
}
