//! Optional Windows system mechanism. Export presence is not qualification.
//! No feature flags, services, registry settings or host DACLs are changed.
use super::*;

#[link(name = "kernel32")]
unsafe extern "system" {
    fn LoadLibraryExW(name: *const u16, file: *mut c_void, flags: u32) -> *mut c_void;
    fn GetProcAddress(module: *mut c_void, name: *const u8) -> *mut c_void;
    fn FreeLibrary(module: *mut c_void) -> i32;
}
struct Library(*mut c_void);
impl Drop for Library {
    fn drop(&mut self) {
        unsafe {
            FreeLibrary(self.0);
        }
    }
}

// Microsoft SandboxSpec v0.1.0 wire slots: version=0, app_container=1,
// fs_read_write=7. All other fields retain their restrictive/default values.
// https://github.com/microsoft/mxc/blob/main/external/windows-sdk/BaseContainerSpecification.fbs
fn specification(root: &Path) -> Result<Vec<u8>> {
    let root = root.to_str().ok_or("System sandbox path is not Unicode")?;
    if !Path::new(root).is_absolute() || root.contains('\0') || root.len() > 32768 {
        return Err("Invalid system sandbox path".into());
    }
    let mut bytes = vec![0u8; 52];
    bytes[0..4].copy_from_slice(&36u32.to_le_bytes());
    bytes[4..8].copy_from_slice(b"SBOX");
    bytes[8..10].copy_from_slice(&28u16.to_le_bytes());
    bytes[10..12].copy_from_slice(&16u16.to_le_bytes());
    for (slot, offset) in [(0usize, 4u16), (1, 8), (7, 12)] {
        bytes[12 + slot * 2..14 + slot * 2].copy_from_slice(&offset.to_le_bytes());
    }
    bytes[36..40].copy_from_slice(&28u32.to_le_bytes());
    bytes[40..44].copy_from_slice(&12u32.to_le_bytes());
    bytes[44] = 1;
    bytes[48..52].copy_from_slice(&16u32.to_le_bytes());
    bytes.extend_from_slice(&5u32.to_le_bytes());
    bytes.extend_from_slice(b"0.1.0\0");
    while !bytes.len().is_multiple_of(4) {
        bytes.push(0);
    }
    bytes.extend_from_slice(&1u32.to_le_bytes());
    bytes.extend_from_slice(&4u32.to_le_bytes());
    bytes.extend_from_slice(&(root.len() as u32).to_le_bytes());
    bytes.extend_from_slice(root.as_bytes());
    bytes.push(0);
    while !bytes.len().is_multiple_of(4) {
        bytes.push(0);
    }
    Ok(bytes)
}

pub(super) struct ProcessInput {
    pub application: *const u16,
    pub line: *mut u16,
    pub flags: u32,
    pub environment: *const c_void,
    pub directory: *const u16,
    pub startup: *const STARTUPINFOW,
}
pub(super) unsafe fn create(
    input: ProcessInput,
    identity: &str,
    root: &Path,
    process: *mut PROCESS_INFORMATION,
) -> Result<()> {
    let ProcessInput {
        application,
        line,
        flags,
        environment,
        directory,
        startup,
    } = input;
    // SAFETY: load only the OS-owned System32 implementation, never PATH/cwd.
    let module =
        unsafe { LoadLibraryExW(wide("processmodel.dll").as_ptr(), ptr::null_mut(), 0x800) };
    if module.is_null() {
        return Err("Windows system sandbox API unavailable".into());
    }
    let module = Library(module);
    let raw = unsafe {
        GetProcAddress(
            module.0,
            c"Experimental_CreateProcessInSandbox".as_ptr().cast(),
        )
    };
    if raw.is_null() {
        return Err("Windows system sandbox export unavailable".into());
    }
    type Create = unsafe extern "system" fn(
        *const u16,
        *mut u16,
        *const SECURITY_ATTRIBUTES,
        *const SECURITY_ATTRIBUTES,
        i32,
        u32,
        *const c_void,
        *const u16,
        *const STARTUPINFOW,
        *const u16,
        *const c_void,
        u32,
        *mut PROCESS_INFORMATION,
    ) -> i32;
    // SAFETY: signature follows the documented OS export; buffers owned by caller
    // and local specification remain alive until synchronous creation returns.
    let create: Create = unsafe { std::mem::transmute(raw) };
    let spec = specification(root)?;
    let identity = wide(identity);
    if unsafe {
        create(
            application,
            line,
            ptr::null(),
            ptr::null(),
            0,
            flags,
            environment,
            directory,
            startup,
            identity.as_ptr(),
            spec.as_ptr().cast(),
            spec.len() as u32,
            process,
        )
    } == 0
    {
        return Err(win_error("Windows system sandbox creation"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn spec_encodes_only_the_owned_profile_not_host_paths_or_capabilities() {
        let root = Path::new("C:/Owned/Profile/AC");
        let bytes = specification(root).unwrap();
        assert_eq!(&bytes[4..8], b"SBOX");
        assert_eq!(bytes[44], 1);
        let u32_at = |offset: usize| {
            u32::from_le_bytes(bytes[offset..offset + 4].try_into().unwrap()) as usize
        };
        let table = u32_at(0);
        let version = table + 4 + u32_at(table + 4);
        assert_eq!(&bytes[version + 4..version + 4 + u32_at(version)], b"0.1.0");
        let vector = table + 12 + u32_at(table + 12);
        assert_eq!(u32_at(vector), 1);
        let path = vector + 4 + u32_at(vector + 4);
        assert_eq!(
            &bytes[path + 4..path + 4 + u32_at(path)],
            root.to_str().unwrap().as_bytes()
        );
        assert!(specification(Path::new("relative")).is_err());
    }
}
