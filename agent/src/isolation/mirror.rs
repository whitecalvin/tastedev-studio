//! Copies only the sealed Source manifest, never the containing host directory.
//! This is staging, not proof that the eventual process is OS-isolated.
use crate::{
    model::{no_links, Result},
    snapshot::File,
    snapshot_download::{FILE_LIMIT, TOTAL_LIMIT},
};
use sha2::{Digest, Sha256};
use std::{
    collections::HashSet,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};

pub struct Mirror {
    source: PathBuf,
    pub root: PathBuf,
    files: Vec<(String, String)>,
}
/// Bounded bytes captured from an explicitly declared result. Keep credentials
/// and host destinations in the trusted transfer broker, not this structure.
pub type CollectedOutput = crate::build_artifact::CapturedOutput;

fn read(path: &Path) -> Result<Vec<u8>> {
    read_file(path, false)
}

fn read_file(path: &Path, output: bool) -> Result<Vec<u8>> {
    no_links(path)?;
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(windows)]
    if output {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(windows_sys::Win32::Storage::FileSystem::FILE_SHARE_READ);
    }
    let file = options
        .open(path)
        .map_err(|_| "Sealed Source file unavailable")?;
    let metadata = file
        .metadata()
        .map_err(|_| "Sealed Source metadata unavailable")?;
    let limit = if output {
        crate::build_artifact::LIMIT
    } else {
        FILE_LIMIT as u64
    };
    if !metadata.is_file() || metadata.len() > limit {
        return Err("Sealed Source file limit".into());
    }
    if output {
        #[cfg(windows)]
        {
            use std::os::windows::io::AsRawHandle;
            use windows_sys::Win32::Storage::FileSystem::{
                GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
            };
            let mut information = std::mem::MaybeUninit::<BY_HANDLE_FILE_INFORMATION>::uninit();
            // SAFETY: live read handle and correctly sized initialized out storage.
            if unsafe { GetFileInformationByHandle(file.as_raw_handle(), information.as_mut_ptr()) }
                == 0
            {
                return Err("Isolated output link identity unavailable".into());
            }
            if unsafe { information.assume_init() }.nNumberOfLinks != 1 {
                return Err("Hard-linked isolated output rejected".into());
            }
        }
        #[cfg(unix)]
        {
            use std::os::unix::fs::MetadataExt;
            if metadata.nlink() != 1 {
                return Err("Hard-linked isolated output rejected".into());
            }
        }
    }
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Sealed Source read failed")?;
    if bytes.len() as u64 > limit {
        return Err("Sealed Source file limit".into());
    }
    Ok(bytes)
}

fn checksum(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

impl Mirror {
    pub fn stage(source: &Path, destination: &Path, files: &[File]) -> Result<Self> {
        no_links(source)?;
        no_links(destination)?;
        if !source.is_absolute()
            || !source.is_dir()
            || !destination.is_absolute()
            || fs::symlink_metadata(destination).is_ok()
            || files.is_empty()
            || files.len() > 20000
        {
            return Err("Invalid isolated Source staging scope".into());
        }
        let source = source
            .canonicalize()
            .map_err(|_| "Sealed Source root unavailable")?;
        let parent = destination
            .parent()
            .ok_or("Isolated Source parent missing")?
            .canonicalize()
            .map_err(|_| "Isolated Source parent unavailable")?;
        if parent.starts_with(&source) || source.starts_with(&parent) {
            return Err("Isolated Source must not overlap the host Source".into());
        }
        // Preflight the complete manifest before creating the owned destination.
        // Read bounded bytes and hash them before writing; do not reopen a source
        // path with fs::copy after validating a different version of that file.
        let mut prepared = Vec::new();
        let mut seen = HashSet::new();
        let mut total = 0u64;
        for file in files {
            crate::snapshot::safe_project(&file.path)?;
            if !seen.insert(file.path.to_ascii_lowercase())
                || file.checksum.len() != 64
                || !file
                    .checksum
                    .bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
            {
                return Err("Invalid isolated Source manifest".into());
            }
            let bytes = read(&source.join(&file.path))?;
            total = total
                .checked_add(bytes.len() as u64)
                .ok_or("Isolated Source size overflow")?;
            if total > TOTAL_LIMIT {
                return Err("Isolated Source total limit".into());
            }
            if checksum(&bytes) != file.checksum {
                return Err("Sealed Source checksum mismatch".into());
            }
            prepared.push((file.path.clone(), file.checksum.clone(), bytes));
        }
        fs::create_dir(destination).map_err(|_| "Isolated Source directory creation failed")?;
        for (path, _, bytes) in &prepared {
            let target = destination.join(path);
            no_links(&target)?;
            fs::create_dir_all(target.parent().ok_or("Isolated Source path missing")?)
                .map_err(|_| "Isolated Source parent creation failed")?;
            no_links(&target)?;
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&target)
                .map_err(|_| "Isolated Source creation failed")?;
            file.write_all(bytes)
                .and_then(|_| file.sync_all())
                .map_err(|_| "Isolated Source write failed")?;
        }
        let mirror = Self {
            source,
            root: destination.to_path_buf(),
            files: prepared
                .into_iter()
                .map(|(path, hash, _)| (path, hash))
                .collect(),
        };
        mirror.verify_staged()?;
        Ok(mirror)
    }

    pub fn verify_original(&self) -> Result<()> {
        self.verify(&self.source)
    }
    pub fn verify_staged(&self) -> Result<()> {
        self.verify(&self.root)
    }
    /// Call only after the owned process tree has exited. This reads declared
    /// files into verified bytes; it never copies output over original Source.
    pub fn collect_outputs(&self, declared: &[String]) -> Result<Vec<CollectedOutput>> {
        if declared.len() > 16 {
            return Err("Isolated output count limit".into());
        }
        self.verify_original()?;
        let mut seen = HashSet::new();
        // Validate every declaration before reading any output, retaining the
        // existing build-artifact secret/device/path policy.
        for path in declared {
            crate::build_artifact::safe_path(path)?;
            if !seen.insert(path.to_lowercase()) {
                return Err("Duplicate isolated output path".into());
            }
        }
        let mut outputs = Vec::with_capacity(declared.len());
        let mut total = 0u64;
        for path in declared {
            let bytes = read_file(&self.root.join(path), true)?;
            total = total
                .checked_add(bytes.len() as u64)
                .ok_or("Isolated output size overflow")?;
            if total > crate::build_artifact::CAPTURED_TOTAL_LIMIT {
                return Err("Isolated output total limit".into());
            }
            outputs.push(CollectedOutput {
                path: path.clone(),
                checksum: checksum(&bytes),
                bytes,
            });
        }
        self.verify_original()?;
        Ok(outputs)
    }
    fn verify(&self, root: &Path) -> Result<()> {
        no_links(root)?;
        for (path, expected) in &self.files {
            if checksum(&read(&root.join(path))?) != *expected {
                return Err("Isolated Source integrity conflict".into());
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn entry(path: &str, bytes: &[u8]) -> File {
        File {
            path: path.into(),
            content: String::new(),
            checksum: checksum(bytes),
            cached: true,
            encoding: None,
            size: Some(bytes.len() as u64),
        }
    }
    #[test]
    fn declared_outputs_capture_binary_bytes_without_copying_source_or_unlisted_files() {
        let host = tempfile::tempdir().unwrap();
        let owned = tempfile::tempdir().unwrap();
        fs::write(host.path().join("main.gd"), b"original").unwrap();
        let mirror = Mirror::stage(
            host.path(),
            &owned.path().join("source"),
            &[entry("main.gd", b"original")],
        )
        .unwrap();
        fs::write(mirror.root.join("frame.png"), [137, 80, 78, 71, 0, 255]).unwrap();
        fs::write(mirror.root.join("unlisted.txt"), b"not declared").unwrap();
        fs::write(mirror.root.join("main.gd"), b"isolated changes").unwrap();
        #[cfg(windows)]
        {
            let writer = fs::OpenOptions::new()
                .write(true)
                .open(mirror.root.join("frame.png"))
                .unwrap();
            assert!(mirror.collect_outputs(&["frame.png".into()]).is_err());
            drop(writer);
        }
        let outputs = mirror.collect_outputs(&["frame.png".into()]).unwrap();
        assert_eq!(outputs.len(), 1);
        assert_eq!(outputs[0].path, "frame.png");
        assert_eq!(outputs[0].bytes, [137, 80, 78, 71, 0, 255]);
        assert_eq!(outputs[0].checksum, checksum(&outputs[0].bytes));
        assert_eq!(fs::read(host.path().join("main.gd")).unwrap(), b"original");
        assert!(!host.path().join("frame.png").exists());
        for declared in [
            vec!["../outside".into()],
            vec![".env".into()],
            vec!["private.key".into()],
            vec!["frame.png".into(), "FRAME.png".into()],
            vec!["missing.png".into()],
            vec!["frame.png".into(); 17],
        ] {
            assert!(mirror.collect_outputs(&declared).is_err());
        }
        fs::write(host.path().join("main.gd"), b"user edit").unwrap();
        assert!(mirror.collect_outputs(&["frame.png".into()]).is_err());
        assert_eq!(fs::read(host.path().join("main.gd")).unwrap(), b"user edit");
    }

    #[test]
    fn declared_outputs_reject_oversized_files_and_reparse_escape() {
        let host = tempfile::tempdir().unwrap();
        let owned = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(host.path().join("main.gd"), b"original").unwrap();
        let mirror = Mirror::stage(
            host.path(),
            &owned.path().join("source"),
            &[entry("main.gd", b"original")],
        )
        .unwrap();
        let large = fs::File::create(mirror.root.join("large.bin")).unwrap();
        large.set_len(crate::build_artifact::LIMIT + 1).unwrap();
        drop(large);
        assert!(mirror
            .collect_outputs(&["large.bin".into()])
            .err()
            .unwrap()
            .contains("limit"));
        fs::write(outside.path().join("outside.txt"), b"outside fixture").unwrap();
        let hardlink = mirror.root.join("hard-linked-output.txt");
        fs::hard_link(outside.path().join("outside.txt"), &hardlink).unwrap();
        assert!(mirror
            .collect_outputs(&["hard-linked-output.txt".into()])
            .err()
            .unwrap()
            .contains("Hard-linked"));
        fs::remove_file(hardlink).unwrap();
        let link = mirror.root.join("escape");
        #[cfg(windows)]
        {
            let status = std::process::Command::new("cmd.exe")
                .args(["/d", "/c", "mklink", "/J"])
                .arg(&link)
                .arg(outside.path())
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .unwrap();
            assert!(
                status.success(),
                "controlled junction creation must succeed"
            );
        }
        #[cfg(unix)]
        std::os::unix::fs::symlink(outside.path(), &link).unwrap();
        assert!(mirror
            .collect_outputs(&["escape/outside.txt".into()])
            .is_err());
        #[cfg(windows)]
        fs::remove_dir(&link).unwrap();
        #[cfg(unix)]
        fs::remove_file(&link).unwrap();
        assert_eq!(
            fs::read(outside.path().join("outside.txt")).unwrap(),
            b"outside fixture"
        );
    }
    #[test]
    fn build_outputs_use_artifact_limits_without_loosening_source_limits() {
        let host = tempfile::tempdir().unwrap();
        let owned = tempfile::tempdir().unwrap();
        fs::write(host.path().join("main.gd"), b"original").unwrap();
        let mirror = Mirror::stage(
            host.path(),
            &owned.path().join("source"),
            &[entry("main.gd", b"original")],
        )
        .unwrap();
        let path = mirror.root.join("application.bin");
        let file = fs::File::create(&path).unwrap();
        file.set_len(FILE_LIMIT as u64 + 1).unwrap();
        drop(file);
        let outputs = mirror.collect_outputs(&["application.bin".into()]).unwrap();
        assert_eq!(outputs[0].bytes.len(), FILE_LIMIT + 1);
        assert!(
            read(&path).is_err(),
            "The same size is still invalid for a Source file"
        );
        assert!(!host.path().join("application.bin").exists());
        assert_eq!(fs::read(host.path().join("main.gd")).unwrap(), b"original");
    }
    #[test]
    fn copies_only_sealed_saved_changes_and_checks_both_sources() {
        let host = tempfile::tempdir().unwrap();
        let owned = tempfile::tempdir().unwrap();
        fs::create_dir(host.path().join("src")).unwrap();
        fs::write(host.path().join("src/player.gd"), b"saved user changes").unwrap();
        fs::write(
            host.path().join(".env"),
            b"DUMMY_SECRET=not-a-real-credential",
        )
        .unwrap();
        fs::write(host.path().join("unapproved.txt"), b"not in the manifest").unwrap();
        let mirror = Mirror::stage(
            host.path(),
            &owned.path().join("source"),
            &[entry("src/player.gd", b"saved user changes")],
        )
        .unwrap();
        assert_eq!(
            fs::read(mirror.root.join("src/player.gd")).unwrap(),
            b"saved user changes"
        );
        assert!(!mirror.root.join(".env").exists());
        assert!(!mirror.root.join("unapproved.txt").exists());
        mirror.verify_original().unwrap();
        mirror.verify_staged().unwrap();
        fs::write(mirror.root.join("src/player.gd"), b"changed by game").unwrap();
        assert!(mirror.verify_staged().is_err());
        mirror.verify_original().unwrap();
        fs::write(host.path().join("src/player.gd"), b"later user edit").unwrap();
        assert!(mirror.verify_original().is_err());
        assert_eq!(
            fs::read(host.path().join("src/player.gd")).unwrap(),
            b"later user edit"
        );
    }
    #[test]
    fn preflight_rejects_secrets_escape_duplicates_stale_and_overlapping_source() {
        let host = tempfile::tempdir().unwrap();
        let owned = tempfile::tempdir().unwrap();
        fs::write(host.path().join("main.gd"), b"original").unwrap();
        for files in [
            vec![entry("../outside", b"original")],
            vec![entry(".env", b"original")],
            vec![entry("main.gd", b"original"), entry("MAIN.gd", b"original")],
            vec![entry("main.gd", b"stale")],
        ] {
            let destination = owned.path().join("source");
            assert!(Mirror::stage(host.path(), &destination, &files).is_err());
            assert!(
                !destination.exists(),
                "preflight must not leave a partial mirror"
            );
        }
        assert!(Mirror::stage(
            host.path(),
            &host.path().join("mirror"),
            &[entry("main.gd", b"original")]
        )
        .is_err());
        let existing = owned.path().join("existing");
        fs::create_dir(&existing).unwrap();
        fs::write(existing.join("user.txt"), b"preserve").unwrap();
        assert!(Mirror::stage(host.path(), &existing, &[entry("main.gd", b"original")]).is_err());
        assert_eq!(fs::read(existing.join("user.txt")).unwrap(), b"preserve");
    }
}
