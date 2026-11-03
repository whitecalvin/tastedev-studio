//! Windows leaf-process boundary. The trusted parent owns profile lifecycle.
pub(super) mod probe;
mod stdio;
mod system;
use crate::model::Result;
use std::os::windows::{ffi::OsStrExt, fs::MetadataExt};
use std::{
    collections::BTreeMap,
    ffi::c_void,
    fs,
    path::{Path, PathBuf},
    ptr,
};
use windows_sys::Win32::{
    Foundation::{
        CloseHandle, DuplicateHandle, LocalFree, DUPLICATE_SAME_ACCESS, INVALID_HANDLE_VALUE,
        WAIT_OBJECT_0,
    },
    Security::{
        Authorization::*, FreeSid, GetTokenInformation, Isolation::*, TokenUser,
        DACL_SECURITY_INFORMATION, PSID, SECURITY_ATTRIBUTES, SECURITY_CAPABILITIES, TOKEN_QUERY,
        TOKEN_USER,
    },
    Storage::FileSystem::{FILE_GENERIC_EXECUTE, FILE_GENERIC_READ, FILE_GENERIC_WRITE},
    System::{Com::CoTaskMemFree, StationsAndDesktops::*, Threading::*},
};
fn wide(value: impl AsRef<std::ffi::OsStr>) -> Vec<u16> {
    value.as_ref().encode_wide().chain(Some(0)).collect()
}
fn win_error(context: &str) -> String {
    format!(
        "{context}: {}",
        std::io::Error::last_os_error().raw_os_error().unwrap_or(0)
    )
}
unsafe fn string(pointer: *const u16) -> Result<PathBuf> {
    if pointer.is_null() {
        return Err("AppContainer path missing".into());
    }
    let mut length = 0;
    while length < 32768 && unsafe { *pointer.add(length) } != 0 {
        length += 1;
    }
    if length == 32768 {
        return Err("AppContainer path too long".into());
    }
    // SAFETY: OS-owned terminated UTF-16 buffer, bounded above and alive until copied.
    Ok(PathBuf::from(std::ffi::OsString::from_wide(unsafe {
        std::slice::from_raw_parts(pointer, length)
    })))
}
use std::os::windows::ffi::OsStringExt;
pub struct LeafCommand<'a> {
    pub max_processes: u32,
    pub program: &'a Path,
    pub args: &'a [String],
    pub cwd: &'a Path,
    pub environment: &'a BTreeMap<String, String>,
    pub timeout_ms: u32,
    pub cancel: Option<&'a std::sync::atomic::AtomicBool>,
}
#[derive(Debug, PartialEq)]
pub enum LeafExit {
    Completed(u32),
    TimedOut,
    Cancelled,
}
#[cfg(test)]
impl LeafExit {
    fn code(self) -> Result<u32> {
        match self {
            Self::Completed(code) => Ok(code),
            Self::TimedOut => Err("Sandbox process timeout".into()),
            Self::Cancelled => Err("Sandbox process cancelled".into()),
        }
    }
}
enum LaunchMode {
    PrivateAppContainer,
    #[cfg(test)]
    SystemDiagnostic,
    #[cfg(test)]
    MinimalDiagnostic,
}
pub struct Profile {
    name: String,
    sid: PSID,
    pub root: PathBuf,
    package: PathBuf,
    active: bool,
}
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct OwnedIdentity {
    pub name: String,
    pub sid: String,
    pub root: PathBuf,
}
/// File and directory handles forbid writes/deletion of the approved executable
/// for the entire launch lifetime. An additive RX ACL alone is not read-only.
pub(super) struct LockedProgram {
    pub path: PathBuf,
    _file: fs::File,
    _directory: fs::File,
    _bundle_files: Vec<fs::File>,
    _bundle_directories: Vec<fs::File>,
}
impl Profile {
    #[cfg(test)]
    pub fn create() -> Result<Self> {
        let name = format!("TASTESTUDIO.{}", uuid::Uuid::new_v4().simple());
        Self::create_reserved(name)
    }
    pub(super) fn validate_reserved_name(name: &str) -> Result<()> {
        let suffix = name
            .strip_prefix("TASTESTUDIO.")
            .ok_or("Invalid reserved profile name")?;
        if suffix.len() != 32
            || !suffix
                .bytes()
                .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            || !uuid::Uuid::parse_str(suffix).is_ok_and(|v| v.get_version_num() == 4)
        {
            return Err("Invalid reserved profile identity".into());
        }
        Ok(())
    }
    pub(super) fn create_reserved(name: String) -> Result<Self> {
        Self::validate_reserved_name(&name)?;
        let w = wide(&name);
        let mut sid = ptr::null_mut();
        // SAFETY: temporary unique name, no inherited capabilities, initialized SID out pointer.
        let hr = unsafe {
            CreateAppContainerProfile(w.as_ptr(), w.as_ptr(), w.as_ptr(), ptr::null(), 0, &mut sid)
        };
        if hr < 0 {
            return Err(format!("AppContainer creation unavailable: {hr:#x}"));
        }
        let result = (|| -> Result<(PathBuf, PathBuf)> {
            let mut text = ptr::null_mut();
            // SAFETY: newly returned valid SID; conversion allocation is released below.
            if unsafe { ConvertSidToStringSidW(sid, &mut text) } == 0 {
                return Err(win_error("AppContainer SID conversion"));
            }
            let mut raw = ptr::null_mut();
            // SAFETY: conversion buffer remains alive through this call.
            let hr = unsafe { GetAppContainerFolderPath(text, &mut raw) };
            unsafe {
                LocalFree(text.cast());
            }
            if hr < 0 {
                return Err(format!("AppContainer storage unavailable: {hr:#x}"));
            }
            // SAFETY: GetAppContainerFolderPath returns a CoTaskMem-owned UTF-16 string.
            let root = unsafe { string(raw) };
            unsafe {
                CoTaskMemFree(raw.cast());
            }
            let root = root?;
            let package = root
                .parent()
                .ok_or("Invalid AppContainer storage")?
                .to_path_buf();
            if !root.is_absolute()
                || !package
                    .file_name()
                    .is_some_and(|v| v.to_string_lossy().eq_ignore_ascii_case(&name))
                || root
                    .file_name()
                    .is_none_or(|v| !v.to_string_lossy().eq_ignore_ascii_case("AC"))
            {
                return Err("AppContainer storage identity mismatch".into());
            }
            Ok((root, package))
        })();
        match result {
            Ok((root, package)) => Ok(Self {
                name,
                sid,
                root,
                package,
                active: true,
            }),
            Err(error) => {
                unsafe {
                    DeleteAppContainerProfile(w.as_ptr());
                    FreeSid(sid);
                }
                Err(error)
            }
        }
    }
    pub fn identity(&self) -> &str {
        &self.name
    }
    pub(super) fn owned_identity(&self) -> Result<OwnedIdentity> {
        let mut text = ptr::null_mut();
        // SAFETY: profile owns the live SID; conversion allocation is freed below.
        if unsafe { ConvertSidToStringSidW(self.sid, &mut text) } == 0 {
            return Err(win_error("Owned profile SID unavailable"));
        }
        let sid = unsafe { string(text) };
        unsafe {
            LocalFree(text.cast());
        }
        Ok(OwnedIdentity {
            name: self.name.clone(),
            sid: sid?.to_string_lossy().into_owned(),
            root: self.root.clone(),
        })
    }
    /// Only call with a broker journal held exclusively and matching this Run.
    /// Derive the SID and OS storage path again; never delete a recorded path.
    pub(super) fn recover_owned(owner: &OwnedIdentity) -> Result<()> {
        super::catalog::local(&owner.root)?;
        let suffix = owner
            .name
            .strip_prefix("TASTESTUDIO.")
            .ok_or("Invalid owned profile name")?;
        if suffix.len() != 32
            || !suffix
                .bytes()
                .all(|v| v.is_ascii_digit() || (b'a'..=b'f').contains(&v))
        {
            return Err("Invalid owned profile identity".into());
        }
        let recorded_package = owner
            .root
            .parent()
            .ok_or("Owned profile recovery parent missing")?;
        if owner
            .root
            .file_name()
            .is_none_or(|v| !v.eq_ignore_ascii_case("AC"))
            || recorded_package
                .file_name()
                .is_none_or(|v| !v.to_string_lossy().eq_ignore_ascii_case(&owner.name))
        {
            return Err("Owned profile recovery storage mismatch".into());
        }
        let mut sid = ptr::null_mut();
        // SAFETY: terminated validated name and initialized SID out pointer.
        let hr = unsafe {
            DeriveAppContainerSidFromAppContainerName(wide(&owner.name).as_ptr(), &mut sid)
        };
        if hr < 0 {
            return Err(format!("Owned profile recovery SID unavailable: {hr:#x}"));
        }
        // Inactive until every identity/path check passes; Drop still frees SID.
        let mut profile = Self {
            name: owner.name.clone(),
            sid,
            root: owner.root.clone(),
            package: PathBuf::new(),
            active: false,
        };
        if profile.owned_identity()?.sid != owner.sid {
            return Err("Owned profile recovery SID mismatch".into());
        }
        let mut raw = ptr::null_mut();
        let sid_text = wide(&owner.sid);
        // SAFETY: SID text was compared to the OS-derived identity above.
        let hr = unsafe { GetAppContainerFolderPath(sid_text.as_ptr(), &mut raw) };
        if hr < 0 {
            // Cleanup can finish before its completion marker is synced. On
            // retry Windows reports FILE/PATH_NOT_FOUND for the deleted profile.
            // Confirm the recorded local storage is also absent; never treat an
            // access failure or an existing unverified directory as absence.
            if matches!(hr as u32, 0x80070002 | 0x80070003) {
                crate::model::no_links(recorded_package)?;
                if fs::symlink_metadata(&owner.root)
                    .is_err_and(|e| e.kind() == std::io::ErrorKind::NotFound)
                {
                    // SAFETY: exact journal name, matching OS-derived SID; this
                    // idempotent API does not delete a recorded arbitrary path.
                    let deleted = unsafe { DeleteAppContainerProfile(wide(&owner.name).as_ptr()) };
                    if deleted >= 0 {
                        return Ok(());
                    }
                    return Err(format!(
                        "Owned profile recovery completion failed: {deleted:#x}"
                    ));
                }
            }
            return Err(format!(
                "Owned profile recovery storage unavailable: {hr:#x}"
            ));
        }
        let root = unsafe { string(raw) };
        unsafe {
            CoTaskMemFree(raw.cast());
        }
        let root = root?;
        let package = root
            .parent()
            .ok_or("Owned profile recovery parent missing")?
            .to_path_buf();
        if root != owner.root
            || !root.is_absolute()
            || root
                .file_name()
                .is_none_or(|v| !v.eq_ignore_ascii_case("AC"))
            || package
                .file_name()
                .is_none_or(|v| !v.to_string_lossy().eq_ignore_ascii_case(&owner.name))
        {
            return Err("Owned profile recovery storage mismatch".into());
        }
        crate::model::no_links(&package)?;
        profile.package = package;
        profile.active = true;
        profile.close()
    }
    #[cfg(test)]
    pub(super) fn leave_for_recovery(mut self) {
        self.active = false;
    }
    pub(super) fn prepare_program(
        &self,
        program: &super::catalog::ApprovedProgram,
    ) -> Result<LockedProgram> {
        self.prepare_program_controlled(
            program,
            &std::sync::atomic::AtomicBool::new(false),
            std::time::Instant::now() + std::time::Duration::from_secs(30),
        )
    }
    pub(super) fn prepare_program_controlled(
        &self,
        program: &super::catalog::ApprovedProgram,
        cancel: &std::sync::atomic::AtomicBool,
        deadline: std::time::Instant,
    ) -> Result<LockedProgram> {
        super::bundle::check(cancel, deadline)?;
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::{
            FILE_FLAG_BACKUP_SEMANTICS, FILE_SHARE_READ, FILE_SHARE_WRITE,
        };
        let base = self.root.join("runtime");
        crate::model::no_links(&base)?;
        fs::create_dir_all(&base).map_err(|_| "Private runtime root unavailable")?;
        self.permit(&base, false)?;
        let directory = base.join(program.id());
        fs::create_dir(&directory).map_err(|_| "New private runtime directory required")?;
        crate::model::no_links(&directory)?;
        // Hold this directory open without FILE_SHARE_DELETE so a writable
        // parent cannot rename/replace the program's containing directory.
        let directory_lock = fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
            .open(&directory)
            .map_err(|_| "Private runtime directory lock failed")?;
        let path = directory.join(program.filename()?);
        program.copy_controlled(&path, cancel, deadline)?;
        let file = fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ)
            .open(&path)
            .map_err(|_| "Private runtime file lock failed")?;
        self.permit(&directory, false)?;
        self.permit(&path, false)?;
        let dependencies = program
            .bundle()
            .copy_controlled(&directory, cancel, deadline)?;
        let mut bundle_files = Vec::new();
        let mut directories = std::collections::BTreeSet::new();
        for dependency in dependencies {
            super::bundle::check(cancel, deadline)?;
            let handle = fs::OpenOptions::new()
                .read(true)
                .share_mode(FILE_SHARE_READ)
                .open(&dependency)
                .map_err(|_| "Private dependency file lock failed")?;
            self.permit(&dependency, false)?;
            bundle_files.push(handle);
            let mut parent = dependency.parent();
            while let Some(folder) = parent {
                if folder == directory {
                    break;
                }
                if !folder.starts_with(&directory) {
                    return Err("Runtime dependency escaped private directory".into());
                }
                directories.insert(folder.to_path_buf());
                parent = folder.parent();
            }
        }
        let mut bundle_directories = Vec::new();
        for folder in directories {
            super::bundle::check(cancel, deadline)?;
            self.permit(&folder, false)?;
            bundle_directories.push(
                fs::OpenOptions::new()
                    .read(true)
                    .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
                    .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
                    .open(&folder)
                    .map_err(|_| "Private dependency directory lock failed")?,
            );
        }
        Ok(LockedProgram {
            path,
            _file: file,
            _directory: directory_lock,
            _bundle_files: bundle_files,
            _bundle_directories: bundle_directories,
        })
    }
    /// Prepare only the already sealed manifest in the newly owned profile.
    /// This does not launch or qualify the execution backend.
    pub fn prepare_source(
        &self,
        source: &Path,
        files: &[crate::snapshot::File],
    ) -> Result<super::mirror::Mirror> {
        let mirror = super::mirror::Mirror::stage(source, &self.root.join("source"), files)?;
        self.permit(&mirror.root, true)?;
        for file in files {
            let path = mirror.root.join(&file.path);
            self.permit(&path, true)?;
            let mut parent = path.parent();
            while let Some(directory) = parent {
                if directory == mirror.root {
                    break;
                }
                self.permit(directory, true)?;
                parent = directory.parent();
            }
        }
        mirror.verify_original()?;
        mirror.verify_staged()?;
        Ok(mirror)
    }
    /// ACL changes are confined to copies in this newly owned profile.
    pub fn permit(&self, path: &Path, write: bool) -> Result<()> {
        let real = path
            .canonicalize()
            .map_err(|_| "Sandbox path unavailable")?;
        let package = self
            .package
            .canonicalize()
            .map_err(|_| "Sandbox profile unavailable")?;
        if !real.starts_with(&package)
            || fs::symlink_metadata(path)
                .map_err(|_| "Sandbox path unavailable")?
                .file_attributes()
                & 0x400
                != 0
        {
            return Err("Sandbox ACL boundary mismatch".into());
        }
        let name = wide(path);
        let mut old = ptr::null_mut();
        let mut descriptor = ptr::null_mut();
        // SAFETY: out pointers initialized; returned descriptor owns old ACL storage.
        let status = unsafe {
            GetNamedSecurityInfoW(
                name.as_ptr(),
                SE_FILE_OBJECT,
                DACL_SECURITY_INFORMATION,
                ptr::null_mut(),
                ptr::null_mut(),
                &mut old,
                ptr::null_mut(),
                &mut descriptor,
            )
        };
        if status != 0 {
            return Err(format!("Sandbox ACL read failed: {status}"));
        }
        let entry = EXPLICIT_ACCESS_W {
            grfAccessPermissions: FILE_GENERIC_READ
                | FILE_GENERIC_EXECUTE
                | if write { FILE_GENERIC_WRITE } else { 0 },
            grfAccessMode: GRANT_ACCESS,
            grfInheritance: if path.is_dir() { 3 } else { 0 },
            Trustee: TRUSTEE_W {
                pMultipleTrustee: ptr::null_mut(),
                MultipleTrusteeOperation: NO_MULTIPLE_TRUSTEE,
                TrusteeForm: TRUSTEE_IS_SID,
                TrusteeType: TRUSTEE_IS_UNKNOWN,
                ptstrName: self.sid.cast(),
            },
        };
        let mut acl = ptr::null_mut();
        // SAFETY: entry references the live profile SID and old ACL is kept alive.
        let built = unsafe { SetEntriesInAclW(1, &entry, old, &mut acl) };
        let status = if built == 0 {
            unsafe {
                SetNamedSecurityInfoW(
                    name.as_ptr(),
                    SE_FILE_OBJECT,
                    DACL_SECURITY_INFORMATION,
                    ptr::null_mut(),
                    ptr::null_mut(),
                    acl,
                    ptr::null(),
                )
            }
        } else {
            built
        };
        unsafe {
            if !acl.is_null() {
                LocalFree(acl.cast());
            }
            LocalFree(descriptor);
        }
        if status != 0 {
            return Err(format!("Sandbox ACL grant failed: {status}"));
        }
        Ok(())
    }
    pub fn close(mut self) -> Result<()> {
        self.remove()?;
        self.active = false;
        Ok(())
    }
    fn remove(&self) -> Result<()> {
        if !self.active {
            return Ok(());
        }
        remove_reparse_points(&self.package, &self.package)?;
        let name = wide(&self.name);
        // SAFETY: only the unique identity successfully created by this Profile is deleted.
        let hr = unsafe { DeleteAppContainerProfile(name.as_ptr()) };
        if hr < 0 {
            return Err(format!("Owned AppContainer cleanup failed: {hr:#x}"));
        }
        Ok(())
    }
    pub fn execute(&self, command: LeafCommand<'_>) -> Result<LeafExit> {
        self.run_layout(command, LaunchMode::PrivateAppContainer)
    }
    pub fn execute_observed(
        &self,
        command: LeafCommand<'_>,
        observer: &mut super::OutputObserver<'_>,
    ) -> Result<LeafExit> {
        let mut stdio = stdio::PrivateStdio::observed(&observer.secrets)?;
        let operation = self.run_with_stdio(
            command,
            LaunchMode::PrivateAppContainer,
            &mut stdio,
            observer.receive,
        );
        let connected = stdio.finish(observer)?;
        if !connected && operation.is_ok() {
            return Ok(LeafExit::Cancelled);
        }
        operation
    }
    #[cfg(test)]
    pub fn run(
        &self,
        program: &Path,
        args: &[String],
        cwd: &Path,
        extra: &BTreeMap<String, String>,
        timeout_ms: u32,
    ) -> Result<u32> {
        self.execute(LeafCommand {
            max_processes: 1,
            program,
            args,
            cwd,
            environment: extra,
            timeout_ms,
            cancel: None,
        })?
        .code()
    }
    #[cfg(test)]
    pub fn run_system(
        &self,
        program: &Path,
        args: &[String],
        cwd: &Path,
        extra: &BTreeMap<String, String>,
        timeout_ms: u32,
    ) -> Result<u32> {
        self.run_layout(
            LeafCommand {
                max_processes: 1,
                program,
                args,
                cwd,
                environment: extra,
                timeout_ms,
                cancel: None,
            },
            LaunchMode::SystemDiagnostic,
        )?
        .code()
    }
    fn run_layout(&self, command: LeafCommand<'_>, mode: LaunchMode) -> Result<LeafExit> {
        let mut stdio = stdio::PrivateStdio::new()?;
        self.run_with_stdio(command, mode, &mut stdio, &mut |_, _| true)
    }
    fn run_with_stdio(
        &self,
        command: LeafCommand<'_>,
        mode: LaunchMode,
        stdio: &mut stdio::PrivateStdio,
        receive: &mut dyn FnMut(&str, &str) -> bool,
    ) -> Result<LeafExit> {
        let LeafCommand {
            max_processes,
            program,
            args,
            cwd,
            environment: extra,
            timeout_ms,
            cancel,
        } = command;
        if !(1..=4).contains(&max_processes) {
            return Err("Invalid isolated process bound".into());
        }
        #[cfg(test)]
        let system_backend = matches!(mode, LaunchMode::SystemDiagnostic);
        #[cfg(not(test))]
        let system_backend = false;
        let private_ui = matches!(mode, LaunchMode::PrivateAppContainer);
        let cancelled =
            || cancel.is_some_and(|flag| flag.load(std::sync::atomic::Ordering::Acquire));
        let package = self
            .package
            .canonicalize()
            .map_err(|_| "Sandbox profile unavailable")?;
        crate::model::no_links(program)?;
        crate::model::no_links(cwd)?;
        if !program
            .canonicalize()
            .map_err(|_| "Sandbox program unavailable")?
            .starts_with(&package)
            || !cwd
                .canonicalize()
                .map_err(|_| "Sandbox directory unavailable")?
                .starts_with(&package)
            || !program.is_file()
            || !cwd.is_dir()
            || !(1..=3600000).contains(&timeout_ms)
            || args.len() > 100
            || args.iter().any(|v| v.len() > 1024 || v.contains('\0'))
        {
            return Err("Sandbox launch scope mismatch".into());
        }
        let mut environment = BTreeMap::new();
        let system = std::env::var("SystemRoot").map_err(|_| "Windows runtime unavailable")?;
        environment.insert("SystemRoot".to_string(), system.clone());
        environment.insert("WINDIR".into(), system.clone());
        environment.insert("PATH".into(), format!("{system}\\System32"));
        // Use the AppContainer profile location documented by Windows, not a
        // nested substitute or the host's LocalAppData credential directory.
        environment.insert(
            "LOCALAPPDATA".into(),
            self.root.to_string_lossy().into_owned(),
        );
        for (key, sub) in [
            ("TEMP", "temp"),
            ("TMP", "temp"),
            ("HOME", "home"),
            ("USERPROFILE", "home"),
            ("APPDATA", "home/roaming"),
        ] {
            let p = self.root.join(sub);
            fs::create_dir_all(&p).map_err(|_| "Sandbox environment preparation failed")?;
            self.permit(&p, true)?;
            environment.insert(key.into(), p.to_string_lossy().into_owned());
        }
        for (key, value) in extra {
            let upper = key.to_ascii_uppercase();
            if environment.keys().any(|k| k.eq_ignore_ascii_case(key))
                || [
                    "TOKEN",
                    "SECRET",
                    "PASSWORD",
                    "CREDENTIAL",
                    "AUTH",
                    "API_KEY",
                    "TASTEDEV",
                    "TASTESTUDIO",
                ]
                .iter()
                .any(|v| upper.contains(v))
                || key.contains(['=', '\0'])
                || value.contains('\0')
            {
                return Err("Sandbox environment policy rejected".into());
            }
            environment.insert(key.clone(), value.clone());
        }
        let mut env = Vec::<u16>::new();
        for (k, v) in environment {
            env.extend(wide(format!("{k}={v}")));
        }
        env.push(0);
        let application = wide(program);
        let mut line = wide(
            std::iter::once(program.to_string_lossy().into_owned())
                .chain(args.iter().cloned())
                .map(|s| quote(&s))
                .collect::<Vec<_>>()
                .join(" "),
        );
        let directory = wide(cwd);
        if cancelled() {
            return Ok(LeafExit::Cancelled);
        }
        let desktop = if system_backend || !private_ui {
            None
        } else {
            Some(PrivateDesktop::create(self.sid, &self.name)?)
        };
        let mut desktop_name = wide(
            desktop
                .as_ref()
                .map(|value| value.path.as_str())
                .unwrap_or(""),
        );
        // SAFETY: pointer-valued attribute storage remains alive until CreateProcessW returns;
        // buffers have explicit UTF-16 terminators and only three stdio handles are inherited.
        unsafe {
            let mut size = 0;
            let count = 2;
            InitializeProcThreadAttributeList(ptr::null_mut(), count, 0, &mut size);
            if size == 0 || size > 65536 {
                return Err(win_error("Sandbox attribute sizing"));
            }
            let mut storage = vec![0u128; size.div_ceil(16)];
            let list = storage.as_mut_ptr().cast();
            if InitializeProcThreadAttributeList(list, count, 0, &mut size) == 0 {
                return Err(win_error("Sandbox attributes"));
            }
            struct Attributes(LPPROC_THREAD_ATTRIBUTE_LIST);
            impl Drop for Attributes {
                fn drop(&mut self) {
                    unsafe {
                        DeleteProcThreadAttributeList(self.0);
                    }
                }
            }
            let _attributes = Attributes(list);
            let capabilities = SECURITY_CAPABILITIES {
                AppContainerSid: self.sid,
                Capabilities: ptr::null_mut(),
                CapabilityCount: 0,
                Reserved: 0,
            };
            let handles = stdio.handles().map(|handle| OwnedHandle::duplicate(handle));
            let [input, output, error] = handles;
            let handles = [input?, output?, error?];
            let inherited = handles
                .iter()
                .map(|handle| handle.0)
                .filter(|h| !h.is_null())
                .collect::<Vec<_>>();
            // Connect by the explicit station\\desktop name. Do not mix it
            // with inherited UI objects or leak the broker's console handles.
            for (attribute, value, length) in [
                (
                    PROC_THREAD_ATTRIBUTE_SECURITY_CAPABILITIES,
                    &capabilities as *const _ as *const c_void,
                    std::mem::size_of_val(&capabilities),
                ),
                (
                    PROC_THREAD_ATTRIBUTE_HANDLE_LIST,
                    inherited.as_ptr().cast(),
                    std::mem::size_of_val(inherited.as_slice()),
                ),
            ] {
                if system_backend {
                    continue;
                }
                if UpdateProcThreadAttribute(
                    list,
                    0,
                    attribute as usize,
                    value,
                    length,
                    ptr::null_mut(),
                    ptr::null(),
                ) == 0
                {
                    return Err(win_error("Sandbox policy attributes"));
                }
            }
            let mut startup: STARTUPINFOEXW = std::mem::zeroed();
            startup.StartupInfo.cb = std::mem::size_of::<STARTUPINFOEXW>() as u32;
            if !system_backend {
                startup.StartupInfo.dwFlags = STARTF_USESTDHANDLES;
                if desktop.is_some() {
                    startup.StartupInfo.lpDesktop = desktop_name.as_mut_ptr();
                }
                startup.StartupInfo.hStdInput = handles[0].0;
                startup.StartupInfo.hStdOutput = handles[1].0;
                startup.StartupInfo.hStdError = handles[2].0;
            }
            startup.lpAttributeList = list;
            let mut process: PROCESS_INFORMATION = std::mem::zeroed();
            if system_backend {
                startup.StartupInfo.cb = std::mem::size_of::<STARTUPINFOW>() as u32;
                system::create(
                    system::ProcessInput {
                        application: application.as_ptr(),
                        line: line.as_mut_ptr(),
                        flags: CREATE_SUSPENDED | CREATE_UNICODE_ENVIRONMENT | CREATE_NO_WINDOW,
                        environment: env.as_ptr().cast(),
                        directory: directory.as_ptr(),
                        startup: &startup.StartupInfo,
                    },
                    &self.name,
                    &self.root,
                    &mut process,
                )?;
            } else if CreateProcessW(
                application.as_ptr(),
                line.as_mut_ptr(),
                ptr::null(),
                ptr::null(),
                1,
                CREATE_SUSPENDED
                    | EXTENDED_STARTUPINFO_PRESENT
                    | CREATE_UNICODE_ENVIRONMENT
                    | CREATE_NO_WINDOW,
                env.as_ptr().cast(),
                directory.as_ptr(),
                &startup.StartupInfo,
                &mut process,
            ) == 0
            {
                return Err(win_error("AppContainer process start"));
            }
            let _thread = OwnedHandle(process.hThread);
            let _process = OwnedHandle(process.hProcess);
            // Reuse Agent process ownership. The active-process limit enforces
            // the leaf policy before the first instruction, including loader
            // initialization; no breakaway or host fallback is enabled.
            let tree = match crate::tree::Tree::attach_isolated(process.hProcess, max_processes) {
                Ok(tree) => tree,
                Err(error) => {
                    TerminateProcess(process.hProcess, 1);
                    wait_owned_exit(process.hProcess)?;
                    return Err(error);
                }
            };
            if cancelled() {
                tree.terminate()?;
                wait_owned_exit(process.hProcess)?;
                drop(_thread);
                drop(_process);
                tree.wait_empty(std::time::Duration::from_secs(5))?;
                return Ok(LeafExit::Cancelled);
            }
            if ResumeThread(process.hThread) == u32::MAX {
                let error = win_error("Sandbox process resume");
                tree.terminate()?;
                wait_owned_exit(process.hProcess)?;
                drop(_thread);
                drop(_process);
                tree.wait_empty(std::time::Duration::from_secs(5))?;
                return Err(error);
            }
            let started = std::time::Instant::now();
            loop {
                if !stdio.forward(receive) || cancelled() {
                    tree.terminate()?;
                    wait_owned_exit(process.hProcess)?;
                    drop(_thread);
                    drop(_process);
                    tree.wait_empty(std::time::Duration::from_secs(5))?;
                    return Ok(LeafExit::Cancelled);
                }
                let remaining = std::time::Duration::from_millis(timeout_ms as u64)
                    .saturating_sub(started.elapsed());
                if remaining.is_zero() {
                    tree.terminate()?;
                    wait_owned_exit(process.hProcess)?;
                    drop(_thread);
                    drop(_process);
                    tree.wait_empty(std::time::Duration::from_secs(5))?;
                    return Ok(LeafExit::TimedOut);
                }
                let wait = WaitForSingleObject(
                    process.hProcess,
                    remaining.as_millis().clamp(1, 50) as u32,
                );
                if wait == WAIT_OBJECT_0 {
                    break;
                }
                if wait != windows_sys::Win32::Foundation::WAIT_TIMEOUT {
                    let error = win_error("Sandbox process observation");
                    tree.terminate()?;
                    wait_owned_exit(process.hProcess)?;
                    drop(_thread);
                    drop(_process);
                    tree.wait_empty(std::time::Duration::from_secs(5))?;
                    return Err(error);
                }
            }
            let mut code = 1;
            let ok = GetExitCodeProcess(process.hProcess, &mut code);
            if ok == 0 {
                return Err(win_error("Sandbox process result"));
            }
            tree.terminate()?;
            drop(_thread);
            drop(_process);
            tree.wait_empty(std::time::Duration::from_secs(5))?;
            Ok(LeafExit::Completed(code))
        }
    }
}
/// Duplicate only the handles explicitly passed to the child. Never change
/// inheritance flags on the Agent's own process-wide standard handles.
struct OwnedHandle(*mut c_void);
fn wait_owned_exit(process: *mut c_void) -> Result<()> {
    // SAFETY: caller retains the live handle returned by its own CreateProcess.
    let wait = unsafe { WaitForSingleObject(process, 5000) };
    if wait == WAIT_OBJECT_0 {
        Ok(())
    } else if wait == windows_sys::Win32::Foundation::WAIT_TIMEOUT {
        Err("Owned sandbox child cleanup is still pending; termination not confirmed".into())
    } else {
        Err(win_error("Owned sandbox child cleanup observation failed"))
    }
}
impl OwnedHandle {
    unsafe fn duplicate(handle: *mut c_void) -> Result<Self> {
        if handle.is_null() || handle == INVALID_HANDLE_VALUE {
            return Ok(Self(ptr::null_mut()));
        }
        let process = unsafe { GetCurrentProcess() };
        let mut copy = ptr::null_mut();
        if unsafe {
            DuplicateHandle(
                process,
                handle,
                process,
                &mut copy,
                0,
                1,
                DUPLICATE_SAME_ACCESS,
            )
        } == 0
        {
            return Err(win_error("Sandbox stdio duplication"));
        }
        Ok(Self(copy))
    }
}
impl Drop for OwnedHandle {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}
struct PrivateDesktop {
    path: String,
    station: HWINSTA,
    desktop: HDESK,
}
struct DesktopNames {
    station: String,
    desktop: String,
    qualified: String,
}
impl DesktopNames {
    fn for_profile(identity: &str) -> Result<Self> {
        Profile::validate_reserved_name(identity)?;
        let station = format!("TASTESTUDIO-Station-{identity}");
        let desktop = format!("TASTESTUDIO-{identity}");
        let qualified = format!("{station}\\{desktop}");
        Ok(Self {
            station,
            desktop,
            qualified,
        })
    }
}
struct WindowSecurity(*mut c_void);
impl Drop for WindowSecurity {
    fn drop(&mut self) {
        unsafe {
            LocalFree(self.0);
        }
    }
}
fn window_security(sid: PSID) -> Result<WindowSecurity> {
    let mut raw = ptr::null_mut();
    // SAFETY: live profile SID; only newly created private objects use this descriptor.
    if unsafe { ConvertSidToStringSidW(sid, &mut raw) } == 0 {
        return Err(win_error("Desktop SID text"));
    }
    let text = unsafe { string(raw) };
    unsafe {
        LocalFree(raw.cast());
    }
    let text = text?.to_string_lossy().into_owned();
    // An elevated broker may own objects as Administrators. Include its actual
    // user SID so the filtered AppContainer passes the user half of the check.
    let mut token = ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err(win_error("Private UI user token"));
    }
    let _token = OwnedHandle(token);
    let mut needed = 0;
    unsafe {
        GetTokenInformation(token, TokenUser, ptr::null_mut(), 0, &mut needed);
    }
    if needed == 0 || needed > 8192 {
        return Err("Private UI token identity unavailable".into());
    }
    let mut data = vec![0usize; (needed as usize).div_ceil(std::mem::size_of::<usize>())];
    if unsafe {
        GetTokenInformation(
            token,
            TokenUser,
            data.as_mut_ptr().cast(),
            needed,
            &mut needed,
        )
    } == 0
    {
        return Err(win_error("Private UI token identity"));
    }
    let user = unsafe { (*(data.as_ptr().cast::<TOKEN_USER>())).User.Sid };
    let mut raw_user = ptr::null_mut();
    if unsafe { ConvertSidToStringSidW(user, &mut raw_user) } == 0 {
        return Err(win_error("Private UI user identity"));
    }
    let user_text = unsafe { string(raw_user) };
    unsafe {
        LocalFree(raw_user.cast());
    }
    let user_text = user_text?.to_string_lossy().into_owned();
    // No shared application-package or restricted-code grant on another run's UI.
    let sddl = wide(format!(
        "D:P(A;;GA;;;OW)(A;;GA;;;SY)(A;;GA;;;{user_text})(A;;GA;;;{text})S:(ML;;NW;;;LW)"
    ));
    let mut descriptor = ptr::null_mut();
    if unsafe {
        ConvertStringSecurityDescriptorToSecurityDescriptorW(
            sddl.as_ptr(),
            1,
            &mut descriptor,
            ptr::null_mut(),
        )
    } == 0
    {
        return Err(win_error("Private window security"));
    }
    Ok(WindowSecurity(descriptor))
}
impl PrivateDesktop {
    fn create(sid: PSID, identity: &str) -> Result<Self> {
        static LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());
        let _lock = LOCK
            .lock()
            .map_err(|_| "Private UI preparation unavailable")?;
        let names = DesktopNames::for_profile(identity)?;
        let security = window_security(sid)?;
        let attributes = SECURITY_ATTRIBUTES {
            nLength: std::mem::size_of::<SECURITY_ATTRIBUTES>() as u32,
            lpSecurityDescriptor: security.0,
            bInheritHandle: 0,
        };
        // Only newly owned objects receive permissions. No shared-station or
        // active-desktop fallback: a regular user must use a qualified broker.
        unsafe {
            let original = GetProcessWindowStation();
            if original.is_null() {
                return Err(win_error("Sandbox station unavailable"));
            }
            let station =
                CreateWindowStationW(wide(&names.station).as_ptr(), 1, 0x000f037f, &attributes);
            if station.is_null() {
                return Err(win_error(
                    "Owned private station unavailable; qualified Windows broker required",
                ));
            }
            let mut owned = Self {
                path: names.qualified,
                station,
                desktop: ptr::null_mut(),
            };
            if SetProcessWindowStation(station) == 0 {
                return Err(win_error("Private station selection"));
            }
            owned.desktop = CreateDesktopW(
                wide(&names.desktop).as_ptr(),
                ptr::null(),
                ptr::null(),
                0,
                0x000f01ff,
                &attributes,
            );
            let creation_error = std::io::Error::last_os_error().raw_os_error().unwrap_or(0);
            if SetProcessWindowStation(original) == 0 {
                return Err(win_error("Original station restoration"));
            }
            if owned.desktop.is_null() {
                return Err(format!("Private sandbox desktop: {creation_error}"));
            }
            Ok(owned)
        }
    }
}
impl Drop for PrivateDesktop {
    fn drop(&mut self) {
        unsafe {
            if !self.desktop.is_null() {
                CloseDesktop(self.desktop);
            }
            if !self.station.is_null() {
                CloseWindowStation(self.station);
            }
        }
    }
}
impl Drop for Profile {
    fn drop(&mut self) {
        if self.active {
            let _ = self.remove();
        }
        unsafe {
            FreeSid(self.sid);
        }
    }
}
fn remove_reparse_points(path: &Path, root: &Path) -> Result<()> {
    remove_owned_links(path, root, 65536)
}
fn remove_owned_links(path: &Path, root: &Path, limit: usize) -> Result<()> {
    if path != root || !root.is_absolute() {
        return Err("Owned profile cleanup boundary mismatch".into());
    }
    crate::model::no_links(root)?;
    let mut pending = vec![(root.to_path_buf(), 0usize)];
    let mut links = Vec::new();
    let mut entries = 1usize;
    let mut path_bytes = root.as_os_str().len();
    // Bound enumeration before removing any link. Untrusted directory depth
    // cannot overflow the broker stack or cause an unbounded cleanup scan.
    while let Some((path, depth)) = pending.pop() {
        if entries > limit || depth > 64 || path_bytes > 16 * 1024 * 1024 {
            return Err("Owned profile cleanup enumeration limit; journal retained".into());
        }
        let metadata = match fs::symlink_metadata(&path) {
            Ok(v) => v,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => continue,
            Err(_) => return Err("Owned profile cleanup unavailable".into()),
        };
        if metadata.file_attributes() & 0x400 != 0 {
            links.push((path, metadata.file_attributes() & 0x10 != 0));
        } else if metadata.is_dir() {
            for entry in fs::read_dir(&path).map_err(|_| "Owned profile enumeration failed")? {
                let entry = entry.map_err(|_| "Owned profile entry failed")?.path();
                entries += 1;
                path_bytes = path_bytes
                    .checked_add(entry.as_os_str().len())
                    .ok_or("Owned cleanup path size overflow")?;
                if entries > limit || path_bytes > 16 * 1024 * 1024 {
                    return Err("Owned profile cleanup enumeration limit; journal retained".into());
                }
                pending.push((entry, depth + 1));
            }
        }
    }
    for (link, directory) in links {
        crate::model::no_links(link.parent().ok_or("Owned link parent missing")?)?;
        let metadata =
            fs::symlink_metadata(&link).map_err(|_| "Owned link changed during cleanup")?;
        if metadata.file_attributes() & 0x400 == 0
            || (metadata.file_attributes() & 0x10 != 0) != directory
        {
            return Err("Owned profile link identity changed".into());
        }
        if directory {
            fs::remove_dir(&link)
        } else {
            fs::remove_file(&link)
        }
        .map_err(|_| "Owned profile link cleanup failed")?;
    }
    Ok(())
}
fn quote(value: &str) -> String {
    let mut out = String::from("\"");
    let mut slashes = 0;
    for c in value.chars() {
        if c == '\\' {
            slashes += 1;
        } else {
            if c == '"' {
                out.extend(std::iter::repeat_n('\\', slashes * 2 + 1));
            } else {
                out.extend(std::iter::repeat_n('\\', slashes));
            }
            out.push(c);
            slashes = 0;
        }
    }
    out.extend(std::iter::repeat_n('\\', slashes * 2));
    out.push('"');
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn startup_desktop_selects_the_exact_private_station_and_desktop() {
        let identity = format!("TASTESTUDIO.{}", uuid::Uuid::new_v4().simple());
        let names = DesktopNames::for_profile(&identity).unwrap();
        let (station, desktop) = names.qualified.split_once('\\').unwrap();
        assert_eq!(station, names.station);
        assert_eq!(desktop, names.desktop);
        assert!(station.ends_with(&identity) && desktop.ends_with(&identity));
        assert!(!names.qualified.contains("WinSta0"));
        assert!(DesktopNames::for_profile("WinSta0\\Default").is_err());
    }
    #[test]
    fn owned_cleanup_bounds_preflight_and_removes_only_junction_itself() {
        let owned = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        fs::write(outside.path().join("canary.txt"), b"outside stays").unwrap();
        fs::create_dir(owned.path().join("ordinary")).unwrap();
        let link = owned.path().join("link");
        let status = std::process::Command::new("cmd.exe")
            .args(["/d", "/c", "mklink", "/J"])
            .arg(&link)
            .arg(outside.path())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .unwrap();
        assert!(status.success());
        assert!(remove_owned_links(owned.path(), owned.path(), 1)
            .unwrap_err()
            .contains("limit"));
        assert!(
            fs::symlink_metadata(&link).is_ok(),
            "bounded preflight must not partially remove links"
        );
        remove_reparse_points(owned.path(), owned.path()).unwrap();
        assert!(fs::symlink_metadata(link).is_err());
        assert!(owned.path().join("ordinary").is_dir());
        assert_eq!(
            fs::read(outside.path().join("canary.txt")).unwrap(),
            b"outside stays"
        );
        let mut deep = owned.path().to_path_buf();
        for _ in 0..65 {
            deep.push("a");
            fs::create_dir(&deep).unwrap();
        }
        assert!(remove_reparse_points(owned.path(), owned.path())
            .unwrap_err()
            .contains("limit"));
        assert!(deep.exists());
    }
    #[test]
    fn duplicated_stdio_does_not_change_agent_handle_inheritance() {
        use windows_sys::Win32::Foundation::{GetHandleInformation, HANDLE_FLAG_INHERIT};
        unsafe {
            let event = CreateEventW(ptr::null(), 0, 0, ptr::null());
            assert!(!event.is_null());
            let owner = OwnedHandle(event);
            let mut flags = 0;
            assert_ne!(GetHandleInformation(owner.0, &mut flags), 0);
            assert_eq!(flags & HANDLE_FLAG_INHERIT, 0);
            let copy = OwnedHandle::duplicate(owner.0).unwrap();
            let mut copied_flags = 0;
            assert_ne!(GetHandleInformation(copy.0, &mut copied_flags), 0);
            assert_ne!(copied_flags & HANDLE_FLAG_INHERIT, 0);
            drop(copy);
            assert_ne!(GetHandleInformation(owner.0, &mut flags), 0);
            assert_eq!(flags & HANDLE_FLAG_INHERIT, 0);
        }
    }
    #[test]
    #[ignore = "Creates and removes a new per-user AppContainer profile; no process launch"]
    fn actual_profile_mirror_preserves_original_and_cleans_owned_profile() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        let source = tempfile::tempdir_in(base).unwrap();
        fs::write(source.path().join("player.gd"), b"saved user changes").unwrap();
        fs::write(source.path().join(".env"), b"DUMMY_ONLY=true").unwrap();
        use sha2::{Digest, Sha256};
        let file = crate::snapshot::File {
            path: "player.gd".into(),
            content: String::new(),
            checksum: format!("{:x}", Sha256::digest(b"saved user changes")),
            cached: true,
            encoding: None,
            size: Some(18),
        };
        let profile = Profile::create().unwrap();
        assert!(profile.identity().starts_with("TASTESTUDIO."));
        let location = profile.root.clone();
        let mirror = profile.prepare_source(source.path(), &[file]).unwrap();
        assert!(!mirror.root.join(".env").exists());
        mirror.verify_staged().unwrap();
        mirror.verify_original().unwrap();
        let program = profile.root.join("cancel-probe.exe");
        fs::copy(std::env::current_exe().unwrap(), &program).unwrap();
        profile.permit(&program, false).unwrap();
        let flag = std::sync::atomic::AtomicBool::new(true);
        assert_eq!(
            profile
                .execute(LeafCommand {
                    max_processes: 1,
                    program: &program,
                    args: &[],
                    cwd: &mirror.root,
                    environment: &BTreeMap::new(),
                    timeout_ms: 1000,
                    cancel: Some(&flag)
                })
                .unwrap(),
            LeafExit::Cancelled
        );
        mirror.verify_original().unwrap();
        profile.close().unwrap();
        assert!(!location.exists());
        assert_eq!(
            fs::read(source.path().join("player.gd")).unwrap(),
            b"saved user changes"
        );
    }
    #[test]
    fn windows_argument_quoting_preserves_spaces_quotes_and_trailing_slashes() {
        assert_eq!(quote("a b"), "\"a b\"");
        assert_eq!(quote("a\\"), "\"a\\\\\"");
        assert_eq!(quote("a\"b"), "\"a\\\"b\"");
    }
    #[test]
    fn appcontainer_child_probe() {
        if std::env::var_os("PROBE_MODE").is_none() && std::env::var_os("PROBE_REPORT").is_none() {
            return;
        }
        super::probe::run().unwrap();
        if std::env::var("PROBE_DIRECT_EXIT").as_deref() == Ok("1") {
            std::process::exit(0);
        }
    }
    #[test]
    #[ignore = "Actual per-user AppContainer filesystem/network/process boundary; run explicitly on Windows"]
    fn actual_appcontainer_confinement_and_cleanup() {
        actual_boundary_probe(false, 1);
    }
    #[test]
    #[ignore = "Actual optional Windows system sandbox API; no host execution fallback"]
    fn actual_system_sandbox_confinement_and_cleanup() {
        actual_boundary_probe(true, 1);
    }
    #[test]
    #[ignore = "Actual same-SID private descendant boundary and cleanup; qualified administrator context required"]
    fn actual_bounded_descendant_confinement_and_cleanup() {
        for limit in 2..=4 {
            actual_boundary_probe(false, limit);
        }
    }
    #[test]
    #[ignore = "Actual private-UI leaf timeout/cancel and cleanup; qualified Windows broker required"]
    fn actual_leaf_timeout_and_cancellation() {
        for cancellation in [false, true] {
            let profile = Profile::create().unwrap();
            let directory = profile.root.join("source");
            fs::create_dir_all(&directory).unwrap();
            profile.permit(&directory, true).unwrap();
            let program = directory.join("probe.exe");
            fs::copy(std::env::current_exe().unwrap(), &program).unwrap();
            profile.permit(&program, false).unwrap();
            let ready = directory.join("ready.txt");
            let env = BTreeMap::from([
                ("PROBE_MODE".into(), "sleep".into()),
                ("PROBE_READY".into(), ready.to_string_lossy().into_owned()),
            ]);
            let flag = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
            let watch = if cancellation {
                let flag = flag.clone();
                let ready = ready.clone();
                Some(std::thread::spawn(move || {
                    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
                    while std::time::Instant::now() < deadline {
                        if ready.is_file() {
                            flag.store(true, std::sync::atomic::Ordering::Release);
                            return true;
                        }
                        std::thread::sleep(std::time::Duration::from_millis(5));
                    }
                    false
                }))
            } else {
                None
            };
            let args = [
                "--exact".into(),
                "isolation::windows::tests::appcontainer_child_probe".into(),
                "--nocapture".into(),
            ];
            let result = profile.execute(LeafCommand {
                max_processes: 1,
                program: &program,
                args: &args,
                cwd: &directory,
                environment: &env,
                timeout_ms: if cancellation { 10000 } else { 2000 },
                cancel: Some(&flag),
            });
            eprintln!(
                "CONTROLLED_LEAF_ENTRY outcome={result:?} ready={}",
                ready.is_file()
            );
            if let Some(watch) = watch {
                assert!(
                    watch.join().unwrap(),
                    "cancellation must follow actual child entry"
                );
            }
            assert!(
                ready.is_file(),
                "Child never entered; timeout/cancel is not verified; launch outcome: {result:?}"
            );
            assert_eq!(
                result.unwrap(),
                if cancellation {
                    LeafExit::Cancelled
                } else {
                    LeafExit::TimedOut
                }
            );
            let pid = fs::read_to_string(&ready)
                .expect("actual child must have entered before timeout/cancel")
                .parse::<u32>()
                .unwrap();
            unsafe {
                let process = OpenProcess(
                    PROCESS_QUERY_LIMITED_INFORMATION | PROCESS_SYNCHRONIZE,
                    0,
                    pid,
                );
                if process.is_null() {
                    assert_eq!(std::io::Error::last_os_error().raw_os_error(), Some(87));
                } else {
                    let handle = OwnedHandle(process);
                    assert_eq!(
                        WaitForSingleObject(handle.0, 0),
                        WAIT_OBJECT_0,
                        "owned process must have exited"
                    );
                }
            }
            let root = profile.root.clone();
            profile.close().unwrap();
            assert!(!root.exists());
            eprintln!(
                "ACTUAL_LEAF_CONTROL={}",
                serde_json::json!({"cancellation":cancellation,"ownedPid":pid,"exited":true,"profileRemoved":true})
            );
        }
    }
    #[test]
    #[ignore = "Diagnostic minimal loader fixture only; never counts as Agent or Godot qualification"]
    fn actual_minimal_loader_diagnostic() {
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes/loader-probe.exe");
        assert!(
            fixture.is_file(),
            "compile the recorded loader-probe.rs fixture first"
        );
        let mut results = BTreeMap::new();
        for library in [
            "",
            "user32.dll",
            "userenv.dll",
            "ws2_32.dll",
            "crypt32.dll",
            "shell32.dll",
        ] {
            let profile = Profile::create().unwrap();
            let directory = profile.root.join("source");
            fs::create_dir_all(&directory).unwrap();
            profile.permit(&directory, true).unwrap();
            let program = directory.join("probe.exe");
            fs::copy(&fixture, &program).unwrap();
            profile.permit(&program, false).unwrap();
            let mut env = BTreeMap::new();
            if !library.is_empty() {
                env.insert("PROBE_DLL".into(), library.to_string());
            }
            let code = profile
                .run_layout(
                    LeafCommand {
                        max_processes: 1,
                        program: &program,
                        args: &[],
                        cwd: &directory,
                        environment: &env,
                        timeout_ms: 10000,
                        cancel: None,
                    },
                    LaunchMode::MinimalDiagnostic,
                )
                .and_then(LeafExit::code);
            let initialization_failed = !matches!(code, Ok(0));
            results.insert(
                if library.is_empty() {
                    "kernel-only"
                } else {
                    library
                },
                serde_json::json!(code),
            );
            profile.close().unwrap();
            if library.is_empty() && initialization_failed {
                break;
            }
        }
        eprintln!(
            "MINIMAL_LOADER_DIAGNOSTIC={}",
            serde_json::to_string(&results).unwrap()
        );
    }
    fn actual_boundary_probe(system_backend: bool, max_processes: u32) {
        assert!(
            std::env::var("TASTESTUDIO_ISOLATION_DUMMY")
                .is_ok_and(|value| value == "dummy-parent-control-only"),
            "Set the documented Dummy parent control before this explicit probe"
        );
        struct Canary(*mut c_void);
        impl Drop for Canary {
            fn drop(&mut self) {
                unsafe {
                    windows_sys::Win32::UI::WindowsAndMessaging::DestroyWindow(self.0);
                }
            }
        }
        // A new hidden test-owned window only. Never inspect user window text,
        // clipboard contents or screen pixels to test the isolation boundary.
        let canary = Canary(unsafe {
            windows_sys::Win32::UI::WindowsAndMessaging::CreateWindowExW(
                0,
                wide("STATIC").as_ptr(),
                wide("Dummy isolation canary").as_ptr(),
                0,
                0,
                0,
                1,
                1,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null(),
            )
        });
        assert!(!canary.0.is_null());
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        let fixture = tempfile::tempdir_in(base).unwrap();
        let outside = fixture.path().join("outside.txt");
        fs::write(&outside, b"dummy-only-original").unwrap();
        let profile = Profile::create().unwrap();
        let directory = profile.root.join("source");
        fs::create_dir_all(&directory).unwrap();
        profile.permit(&directory, true).unwrap();
        let program = directory.join("probe.exe");
        fs::copy(std::env::current_exe().unwrap(), &program).unwrap();
        profile.permit(&program, false).unwrap();
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let report = directory.join("report.json");
        let mut env = BTreeMap::from([
            ("PROBE_REPORT".into(), report.to_string_lossy().into_owned()),
            (
                "PROBE_OUTSIDE".into(),
                outside.to_string_lossy().into_owned(),
            ),
            (
                "PROBE_SOCKET".into(),
                listener.local_addr().unwrap().to_string(),
            ),
        ]);
        env.insert("PROBE_DIRECT_EXIT".into(), "1".into());
        env.insert(
            "PROBE_EXPECTED_SID".into(),
            profile.owned_identity().unwrap().sid,
        );
        if max_processes > 1 {
            env.insert("PROBE_MODE".into(), "spawn-boundary".into());
            env.insert("PROBE_CHAIN_DEPTH".into(), (max_processes - 1).to_string());
        }
        env.insert(
            "PROBE_CANARY_WINDOW".into(),
            (canary.0 as usize).to_string(),
        );
        let expected = DesktopNames::for_profile(profile.identity()).unwrap();
        env.insert("PROBE_EXPECTED_DESKTOP".into(), expected.desktop);
        env.insert("PROBE_EXPECTED_STATION".into(), expected.station);
        let args = [
            "--exact".into(),
            "isolation::windows::tests::appcontainer_child_probe".into(),
            "--nocapture".into(),
        ];
        let code = if system_backend {
            profile.run_system(&program, &args, &directory, &env, 30000)
        } else if max_processes == 1 {
            profile.run(&program, &args, &directory, &env, 30000)
        } else {
            profile
                .execute(LeafCommand {
                    program: &program,
                    args: &args,
                    cwd: &directory,
                    environment: &env,
                    timeout_ms: 30000,
                    cancel: None,
                    max_processes,
                })
                .and_then(LeafExit::code)
        }
        .unwrap();
        assert_eq!(
            code, 0,
            "Controlled child did not enter/complete; exit status {code:#010x}"
        );
        let value: serde_json::Value = serde_json::from_slice(&fs::read(&report).unwrap()).unwrap();
        eprintln!("ACTUAL_BOUNDARY_REPORT={value}");
        for key in [
            "readDenied",
            "writeDenied",
            "networkDenied",
            "childDenied",
            "credentialAbsent",
            "interactiveReadDenied",
            "outsideWindowDenied",
            "privateDesktop",
            "privateStation",
            "inputDesktopSwitchDenied",
            "hostStationSwitchDenied",
            "nonInteractive",
        ] {
            assert_eq!(value[key], true, "{key}: {value}");
        }
        assert_eq!(fs::read(&outside).unwrap(), b"dummy-only-original");
        let location = profile.root.clone();
        profile.close().unwrap();
        assert!(!location.exists());
        eprintln!(
            "ACTUAL_BOUNDARY_SCOPE={}",
            serde_json::json!({"maxProcesses":max_processes,"sameSid":true,"profileRemoved":true})
        );
    }
}
