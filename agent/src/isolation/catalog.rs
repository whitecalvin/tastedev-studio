//! Operator-owned executable policy. Loading a catalog does not qualify an OS
//! backend or authorize a Source/validation proposal.
use crate::model::{no_links, Result};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::{Read, Write},
    path::{Path, PathBuf},
};
const PROGRAM_LIMIT: u64 = 512 * 1024 * 1024;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Definition {
    version: u32,
    backend: String,
    programs: Vec<ProgramDefinition>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct ProgramDefinition {
    id: String,
    executable: PathBuf,
    checksum: String,
    #[serde(default)]
    runtime: Option<super::versions::RuntimeSpec>,
    #[serde(default)]
    files: Vec<super::bundle::Definition>,
    #[serde(default)]
    max_processes: Option<u32>,
}
pub struct Catalog {
    programs: BTreeMap<String, ApprovedProgram>,
}
pub struct ApprovedProgram {
    id: String,
    path: PathBuf,
    checksum: String,
    runtime: Option<super::versions::RuntimeSpec>,
    bundle: super::bundle::Bundle,
    max_processes: u32,
}

fn id(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 32
        && value.bytes().next().is_some_and(|b| b.is_ascii_lowercase())
        && value
            .bytes()
            .all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}
pub(super) fn local(path: &Path) -> Result<()> {
    if !path.is_absolute() {
        return Err("Absolute operator-owned runtime paths required".into());
    }
    #[cfg(windows)]
    {
        use std::{
            os::windows::ffi::OsStrExt,
            path::{Component, Prefix},
        };
        let Some(Component::Prefix(prefix)) = path.components().next() else {
            return Err("Local runtime drive required".into());
        };
        let drive = match prefix.kind() {
            Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => drive,
            _ => return Err("Network/device runtime paths are not allowed".into()),
        };
        let root = PathBuf::from(format!("{}:\\", drive as char))
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>();
        // No implicit SMB authentication or remote executable loading.
        if !matches!(
            unsafe { windows_sys::Win32::Storage::FileSystem::GetDriveTypeW(root.as_ptr()) },
            2 | 3 | 5 | 6
        ) {
            return Err("Runtime must be on a local filesystem".into());
        }
    }
    Ok(())
}
#[cfg(windows)]
fn component_equal(a: &std::ffi::OsStr, b: &std::ffi::OsStr) -> bool {
    use std::os::windows::ffi::OsStrExt;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn CompareStringOrdinal(
            a: *const u16,
            a_len: i32,
            b: *const u16,
            b_len: i32,
            ignore_case: i32,
        ) -> i32;
    }
    let a = a.encode_wide().collect::<Vec<_>>();
    let b = b.encode_wide().collect::<Vec<_>>();
    if a.len() > 32768 || b.len() > 32768 {
        return false;
    }
    unsafe { CompareStringOrdinal(a.as_ptr(), a.len() as i32, b.as_ptr(), b.len() as i32, 1) == 2 }
}
#[cfg(not(windows))]
fn component_equal(a: &std::ffi::OsStr, b: &std::ffi::OsStr) -> bool {
    a == b
}
pub(super) fn inside(path: &Path, root: &Path) -> bool {
    let mut parts = path.components();
    root.components().all(|part| {
        parts
            .next()
            .is_some_and(|next| component_equal(next.as_os_str(), part.as_os_str()))
    })
}

impl Catalog {
    pub fn load(file: &Path, source_root: &Path) -> Result<Self> {
        local(file)?;
        local(source_root)?;
        no_links(file)?;
        no_links(source_root)?;
        let source = source_root
            .canonicalize()
            .map_err(|_| "Project Source root unavailable")?;
        let file = file
            .canonicalize()
            .map_err(|_| "Operator runtime catalog unavailable")?;
        if inside(&file, &source) {
            return Err("Project Source cannot define execution permissions".into());
        }
        let mut bytes = Vec::new();
        fs::File::open(&file)
            .map_err(|_| "Runtime catalog unavailable")?
            .take(262145)
            .read_to_end(&mut bytes)
            .map_err(|_| "Runtime catalog read failed")?;
        if bytes.len() > 262144 {
            return Err("Runtime catalog limit".into());
        }
        let definition: Definition =
            serde_json::from_slice(&bytes).map_err(|_| "Invalid operator runtime catalog")?;
        if definition.version != 1
            || definition.backend != "windows-private-appcontainer-v1"
            || definition.programs.is_empty()
            || definition.programs.len() > 20
        {
            return Err("Unsupported operator runtime policy".into());
        }
        let mut programs = BTreeMap::new();
        for program in definition.programs {
            if program.max_processes.is_some_and(|n| !(2..=4).contains(&n)) {
                return Err("Invalid operator child process bound".into());
            }
            if !id(&program.id)
                || program.id == "agent-self-check"
                || program.checksum.len() != 64
                || !program
                    .checksum
                    .bytes()
                    .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
            {
                return Err("Invalid approved runtime identity".into());
            }
            if let Some(runtime) = &program.runtime {
                runtime.validate()?;
                if runtime.name == "node"
                    && crate::model::version(&runtime.version).is_none_or(|v| v < [10, 2, 0])
                {
                    return Err("Private Node execution requires Node10.2 or newer".into());
                }
            }
            local(&program.executable)?;
            no_links(&program.executable)?;
            let executable = program
                .executable
                .canonicalize()
                .map_err(|_| "Approved runtime unavailable")?;
            if inside(&executable, &source) || !executable.is_file() {
                return Err("Project code cannot replace the approved runtime".into());
            }
            let name = executable
                .file_stem()
                .and_then(|value| value.to_str())
                .ok_or("Invalid runtime name")?
                .to_ascii_lowercase();
            if [
                "cmd",
                "powershell",
                "pwsh",
                "bash",
                "sh",
                "zsh",
                "fish",
                "wsl",
                "rundll32",
                "regsvr32",
                "mshta",
                "cscript",
                "wscript",
            ]
            .contains(&name.as_str())
                || executable.components().any(|part| {
                    part.as_os_str()
                        .to_string_lossy()
                        .eq_ignore_ascii_case("WindowsApps")
                })
            {
                return Err("Shells and execution aliases are not approved leaf runtimes".into());
            }
            #[cfg(windows)]
            if executable
                .extension()
                .is_none_or(|value| !value.eq_ignore_ascii_case("exe"))
            {
                return Err("Native executable runtime required".into());
            }
            let file_name = if program.files.is_empty() {
                format!("{}.exe", program.id)
            } else {
                executable
                    .file_name()
                    .and_then(|v| v.to_str())
                    .ok_or("Runtime filename unavailable")?
                    .into()
            };
            crate::build_artifact::safe_path(&file_name)?;
            let bundle = super::bundle::Bundle::load(program.files, &source, &file_name)?;
            let approved = ApprovedProgram {
                id: program.id.clone(),
                path: executable,
                checksum: program.checksum,
                runtime: program.runtime,
                bundle,
                max_processes: program.max_processes.unwrap_or(1),
            };
            if programs.insert(program.id, approved).is_some() {
                return Err("Duplicate approved runtime ID".into());
            }
        }
        Ok(Self { programs })
    }
    pub fn resolve(&self, reference: &str) -> Result<&ApprovedProgram> {
        // Never resolve a Source-provided path or consult its PATH/aliases.
        if !id(reference) {
            return Err("Use an operator-registered runtime ID".into());
        }
        self.programs
            .get(reference)
            .ok_or_else(|| "Requested runtime is not approved".into())
    }
    pub(super) fn programs(&self) -> impl Iterator<Item = &ApprovedProgram> {
        self.programs.values()
    }
}
impl ApprovedProgram {
    /// Trusted bootstrap only: the current Agent image, never a Source path.
    pub(super) fn self_image() -> Result<Self> {
        let path = std::env::current_exe().map_err(|_| "Agent image unavailable")?;
        local(&path)?;
        no_links(&path)?;
        let mut file = fs::File::open(&path).map_err(|_| "Agent image unavailable")?;
        let size = file
            .metadata()
            .map_err(|_| "Agent image metadata unavailable")?
            .len();
        if size == 0 || size > PROGRAM_LIMIT {
            return Err("Agent image size limit".into());
        }
        let mut hash = Sha256::new();
        let mut bytes = [0u8; 65536];
        let mut total = 0u64;
        loop {
            let count = file
                .read(&mut bytes)
                .map_err(|_| "Agent image read failed")?;
            if count == 0 {
                break;
            }
            total += count as u64;
            if total > PROGRAM_LIMIT {
                return Err("Agent image size limit".into());
            }
            hash.update(&bytes[..count]);
        }
        Ok(Self {
            id: "agent-self-check".into(),
            path,
            checksum: format!("{:x}", hash.finalize()),
            runtime: None,
            bundle: super::bundle::Bundle::default(),
            max_processes: 1,
        })
    }
    pub fn id(&self) -> &str {
        &self.id
    }
    pub(super) fn validate_process_limit(&self, count: u32) -> Result<()> {
        if count < 1 || count > self.max_processes {
            Err("Isolated child policy exceeds operator runtime scope".into())
        } else {
            Ok(())
        }
    }
    pub(super) fn process_limit(&self) -> u32 {
        self.max_processes
    }
    pub fn checksum(&self) -> &str {
        &self.checksum
    }
    pub(super) fn runtime(&self) -> Option<&super::versions::RuntimeSpec> {
        self.runtime.as_ref()
    }
    /// AppContainer deliberately cannot enumerate host-drive ancestors. Node's
    /// default realpath module resolution does that before reading the entry.
    /// Preserve logical paths inside the copied workspace, without changing ACLs.
    pub(super) fn isolated_arguments(&self, arguments: &[String]) -> Result<Vec<String>> {
        if !self
            .runtime
            .as_ref()
            .is_some_and(|runtime| runtime.name == "node")
        {
            return Ok(arguments.to_vec());
        }
        let runtime = self
            .runtime
            .as_ref()
            .ok_or("Node runtime identity required")?;
        if crate::model::version(&runtime.version).is_none_or(|v| v < [10, 2, 0]) {
            return Err("Private Node execution requires Node10.2 or newer".into());
        }
        Ok([
            "--preserve-symlinks".to_string(),
            "--preserve-symlinks-main".to_string(),
        ]
        .into_iter()
        .chain(arguments.iter().cloned())
        .collect())
    }
    pub(super) fn bundle_checksum(&self) -> Option<String> {
        if self
            .runtime
            .as_ref()
            .is_some_and(|runtime| runtime.name == "node")
        {
            return Some(format!(
                "{:x}",
                Sha256::digest(
                    serde_json::to_vec(&(
                        self.filename().expect("validated runtime name"),
                        self.bundle.checksum(),
                        self.isolated_arguments(&[])
                            .expect("validated Node runtime")
                    ))
                    .expect("serializable runtime binding")
                )
            ));
        }
        self.bundle.checksum().map(|checksum| {
            format!(
                "{:x}",
                Sha256::digest(
                    serde_json::to_vec(&(
                        self.filename().expect("validated runtime name"),
                        checksum
                    ))
                    .expect("serializable bundle binding")
                )
            )
        })
    }
    pub(super) fn bundle(&self) -> &super::bundle::Bundle {
        &self.bundle
    }
    pub(super) fn filename(&self) -> Result<String> {
        if self.bundle.is_empty() {
            Ok(format!("{}.exe", self.id))
        } else {
            self.path
                .file_name()
                .and_then(|v| v.to_str())
                .map(str::to_string)
                .ok_or_else(|| "Runtime filename unavailable".into())
        }
    }
    /// Caller supplies a newly owned private runtime directory, never Source.
    /// Verify the bytes actually copied, not an earlier read of the executable.
    #[cfg(test)]
    pub fn copy_to(&self, destination: &Path) -> Result<u64> {
        self.copy_controlled(
            destination,
            &std::sync::atomic::AtomicBool::new(false),
            std::time::Instant::now() + std::time::Duration::from_secs(30),
        )
    }
    pub fn copy_controlled(
        &self,
        destination: &Path,
        cancel: &std::sync::atomic::AtomicBool,
        deadline: std::time::Instant,
    ) -> Result<u64> {
        super::bundle::check(cancel, deadline)?;
        local(destination)?;
        no_links(&self.path)?;
        no_links(destination)?;
        let mut input = fs::File::open(&self.path).map_err(|_| "Approved runtime unavailable")?;
        let metadata = input
            .metadata()
            .map_err(|_| "Runtime metadata unavailable")?;
        if !metadata.is_file() || metadata.len() == 0 || metadata.len() > PROGRAM_LIMIT {
            return Err("Approved runtime size limit".into());
        }
        let mut output = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(destination)
            .map_err(|_| "New private runtime destination required")?;
        let result = (|| {
            let mut hash = Sha256::new();
            let mut buffer = [0u8; 65536];
            let mut total = 0u64;
            loop {
                super::bundle::check(cancel, deadline)?;
                let count = input.read(&mut buffer).map_err(|_| "Runtime read failed")?;
                if count == 0 {
                    break;
                }
                total += count as u64;
                if total > PROGRAM_LIMIT {
                    return Err("Runtime copy limit".to_string());
                }
                hash.update(&buffer[..count]);
                output
                    .write_all(&buffer[..count])
                    .map_err(|_| "Private runtime write failed")?;
            }
            if format!("{:x}", hash.finalize()) != self.checksum {
                return Err("Approved runtime checksum changed".into());
            }
            output
                .sync_all()
                .map_err(|_| "Private runtime flush failed")?;
            Ok(total)
        })();
        drop(output);
        if result.is_err() {
            fs::remove_file(destination).map_err(|_| "Private runtime copy cleanup failed")?;
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn setup() -> (
        tempfile::TempDir,
        PathBuf,
        PathBuf,
        PathBuf,
        serde_json::Value,
    ) {
        let root = tempfile::tempdir().unwrap();
        let source = root.path().join("project");
        fs::create_dir(&source).unwrap();
        let runtime = root.path().join("engine.exe");
        fs::write(&runtime, b"controlled runtime bytes").unwrap();
        let policy = root.path().join("runtime.json");
        let config = serde_json::json!({"version":1,"backend":"windows-private-appcontainer-v1","programs":[{"id":"engine","executable":runtime,"checksum":format!("{:x}",Sha256::digest(b"controlled runtime bytes"))}]});
        fs::write(&policy, config.to_string()).unwrap();
        (root, source, runtime, policy, config)
    }
    #[test]
    fn operator_catalog_selects_a_registered_id_and_preserves_existing_destinations() {
        let (root, source, _, policy, _) = setup();
        let catalog = Catalog::load(&policy, &source).unwrap();
        let program = catalog.resolve("engine").unwrap();
        assert_eq!(program.id(), "engine");
        assert_eq!(program.checksum().len(), 64);
        for reference in [
            "missing",
            "../engine",
            "C:/engine.exe",
            "\\\\server\\engine.exe",
        ] {
            assert!(catalog.resolve(reference).is_err());
        }
        let target = root.path().join("private.exe");
        assert_eq!(program.copy_to(&target).unwrap(), 24);
        assert_eq!(fs::read(&target).unwrap(), b"controlled runtime bytes");
        assert!(program.copy_to(&target).is_err());
        assert_eq!(fs::read(&target).unwrap(), b"controlled runtime bytes");
    }
    #[test]
    fn stale_runtime_checksum_does_not_leave_an_executable_copy() {
        let (root, source, runtime, policy, _) = setup();
        let catalog = Catalog::load(&policy, &source).unwrap();
        fs::write(&runtime, b"updated runtime").unwrap();
        let target = root.path().join("private.exe");
        assert!(catalog.resolve("engine").unwrap().copy_to(&target).is_err());
        assert!(!target.exists());
    }
    #[test]
    fn private_node_keeps_logical_entry_and_dependency_paths_without_host_acl_changes() {
        let (_root, source, _, policy, mut config) = setup();
        let args = vec!["verify.cjs".to_string()];
        assert_eq!(
            Catalog::load(&policy, &source)
                .unwrap()
                .resolve("engine")
                .unwrap()
                .isolated_arguments(&args)
                .unwrap(),
            args
        );
        config["programs"][0]["runtime"] = serde_json::json!({"name":"node","version":"24.22.1","probeArgs":["--version"],"timeoutMs":2000});
        fs::write(&policy, config.to_string()).unwrap();
        let catalog = Catalog::load(&policy, &source).unwrap();
        let program = catalog.resolve("engine").unwrap();
        assert_eq!(
            program.isolated_arguments(&args).unwrap(),
            vec![
                "--preserve-symlinks",
                "--preserve-symlinks-main",
                "verify.cjs"
            ]
        );
        assert_eq!(args, vec!["verify.cjs"]);
        assert!(program.bundle_checksum().is_some());
    }
    #[test]
    fn operator_child_scope_defaults_to_denial_and_caps_reviewed_work() {
        let (_root, source, _, policy, mut config) = setup();
        let catalog = Catalog::load(&policy, &source).unwrap();
        let program = catalog.resolve("engine").unwrap();
        assert!(program.validate_process_limit(1).is_ok());
        assert!(program.validate_process_limit(2).is_err());
        config["programs"][0]["maxProcesses"] = serde_json::json!(2);
        fs::write(&policy, config.to_string()).unwrap();
        let catalog = Catalog::load(&policy, &source).unwrap();
        let program = catalog.resolve("engine").unwrap();
        assert!(program.validate_process_limit(2).is_ok());
        assert!(program.validate_process_limit(4).is_err());
    }
    #[test]
    fn dependency_manifest_preserves_native_name_and_binds_its_bytes() {
        let (root, source, _, policy, mut config) = setup();
        let library = root.path().join("runtime.dll");
        fs::write(&library, b"library").unwrap();
        config["programs"][0]["id"] = serde_json::json!("python-runtime");
        config["programs"][0]["files"] = serde_json::json!([{"source":library,"path":"lib/runtime.dll","size":7,"checksum":format!("{:x}",Sha256::digest(b"library"))}]);
        fs::write(&policy, config.to_string()).unwrap();
        let catalog = Catalog::load(&policy, &source).unwrap();
        let program = catalog.resolve("python-runtime").unwrap();
        assert_eq!(program.filename().unwrap(), "engine.exe");
        assert!(program.bundle_checksum().is_some());
        let first = program.bundle_checksum();
        config["programs"][0]["files"][0]["path"] = serde_json::json!("other/runtime.dll");
        fs::write(&policy, config.to_string()).unwrap();
        assert_ne!(
            first,
            Catalog::load(&policy, &source)
                .unwrap()
                .resolve("python-runtime")
                .unwrap()
                .bundle_checksum()
        );
    }
    #[test]
    fn runtime_probe_declaration_is_optional_validated_and_not_an_observation() {
        let (_root, source, _, policy, config) = setup();
        assert!(Catalog::load(&policy, &source)
            .unwrap()
            .resolve("engine")
            .unwrap()
            .runtime()
            .is_none());
        let mut valid = config.clone();
        valid["programs"][0]["runtime"] = serde_json::json!({"name":"godot","version":"4.7.2","probeArgs":["--version"],"timeoutMs":2000});
        fs::write(&policy, valid.to_string()).unwrap();
        assert_eq!(
            Catalog::load(&policy, &source)
                .unwrap()
                .resolve("engine")
                .unwrap()
                .runtime()
                .unwrap()
                .name,
            "godot"
        );
        for (key, value) in [
            ("timeoutMs", serde_json::json!(0)),
            ("version", serde_json::json!("latest")),
            ("probeArgs", serde_json::json!([])),
            ("allowHost", serde_json::json!(true)),
        ] {
            let mut invalid = valid.clone();
            invalid["programs"][0]["runtime"][key] = value;
            fs::write(&policy, invalid.to_string()).unwrap();
            assert!(Catalog::load(&policy, &source).is_err());
        }
        let mut reserved = config;
        reserved["programs"][0]["id"] = serde_json::json!("agent-self-check");
        fs::write(&policy, reserved.to_string()).unwrap();
        assert!(Catalog::load(&policy, &source).is_err());
    }
    #[test]
    fn source_defined_policy_runtime_and_weakened_or_duplicate_definitions_are_rejected() {
        let (_root, source, runtime, policy, config) = setup();
        let project_policy = source.join("runtime.json");
        fs::write(&project_policy, config.to_string()).unwrap();
        assert!(Catalog::load(&project_policy, &source).is_err());
        let mut variants = Vec::new();
        let mut changed = config.clone();
        changed["version"] = 2.into();
        variants.push(changed);
        let mut changed = config.clone();
        changed["allowShell"] = true.into();
        variants.push(changed);
        let mut changed = config.clone();
        changed["programs"]
            .as_array_mut()
            .unwrap()
            .push(config["programs"][0].clone());
        variants.push(changed);
        let project_runtime = source.join("engine.exe");
        fs::copy(runtime, &project_runtime).unwrap();
        let mut changed = config;
        changed["programs"][0]["executable"] =
            project_runtime.to_string_lossy().into_owned().into();
        variants.push(changed);
        for variant in variants {
            fs::write(&policy, variant.to_string()).unwrap();
            assert!(Catalog::load(&policy, &source).is_err());
        }
    }
    #[cfg(windows)]
    #[test]
    fn windows_local_policy_rejects_network_aliases_and_preserves_unicode_boundaries() {
        assert!(inside(
            Path::new("C:\\Ärea\\project\\runtime.json"),
            Path::new("c:\\ärea\\PROJECT")
        ));
        assert!(!inside(
            Path::new("C:\\area2\\runtime.json"),
            Path::new("c:\\area")
        ));
        let (root, source, _, policy, config) = setup();
        for path in [
            "\\\\server\\share\\engine.exe",
            "\\\\?\\UNC\\server\\share\\engine.exe",
            "\\\\.\\pipe\\engine",
        ] {
            let mut changed = config.clone();
            changed["programs"][0]["executable"] = path.into();
            fs::write(&policy, changed.to_string()).unwrap();
            let error = Catalog::load(&policy, &source)
                .err()
                .expect("network/device executable must be rejected before file lookup");
            assert!(error.contains("Network/device"), "{error}");
        }
        for name in ["cmd.exe", "pwsh.exe", "wsl.exe"] {
            let runtime = root.path().join(name);
            fs::write(&runtime, b"controlled runtime bytes").unwrap();
            let mut changed = config.clone();
            changed["programs"][0]["executable"] = runtime.to_string_lossy().into_owned().into();
            fs::write(&policy, changed.to_string()).unwrap();
            assert!(Catalog::load(&policy, &source)
                .err()
                .unwrap()
                .contains("Shells and execution aliases"));
        }
    }
}
