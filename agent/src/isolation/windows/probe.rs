//! Internal child protocol. Never performs probe IO in a regular host process.
use super::*;
use windows_sys::Win32::Security::TokenIsAppContainer;

fn object_name(handle: *mut c_void) -> Result<String> {
    let mut name = [0u16; 256];
    let mut needed = 0;
    // SAFETY: borrowed live process/thread UI handle and a bounded output buffer.
    if unsafe {
        GetUserObjectInformationW(handle, UOI_NAME, name.as_mut_ptr().cast(), 512, &mut needed)
    } == 0
    {
        return Err("Isolation child UI identity unavailable".into());
    }
    let end = name
        .iter()
        .position(|c| *c == 0)
        .ok_or("Isolation UI name too long")?;
    String::from_utf16(&name[..end]).map_err(|_| "Invalid isolation UI name".into())
}

/// OS state, not environment variables or a previous verification receipt, is
/// the admission boundary. This runs before looking up any caller-selected path.
fn require_private_child() -> Result<()> {
    let mut token = ptr::null_mut();
    if unsafe { OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token) } == 0 {
        return Err("Isolation child token unavailable".into());
    }
    let _token = OwnedHandle(token);
    let mut confined = 0u32;
    let mut needed = 0;
    if unsafe {
        GetTokenInformation(
            token,
            TokenIsAppContainer,
            (&mut confined as *mut u32).cast(),
            4,
            &mut needed,
        )
    } == 0
        || confined != 1
    {
        return Err("Isolation self-check child requires an AppContainer token".into());
    }
    if let Ok(expected) = std::env::var("PROBE_EXPECTED_SID") {
        use windows_sys::Win32::Security::{TokenAppContainerSid, TOKEN_APPCONTAINER_INFORMATION};
        let mut storage = [0u128; 256];
        // SAFETY: aligned bounded output storage, live token handle.
        if unsafe {
            GetTokenInformation(
                token,
                TokenAppContainerSid,
                storage.as_mut_ptr().cast(),
                4096,
                &mut needed,
            )
        } == 0
            || needed > 4096
            || needed < std::mem::size_of::<TOKEN_APPCONTAINER_INFORMATION>() as u32
        {
            return Err("Child AppContainer SID unavailable".into());
        }
        let info = unsafe { &*storage.as_ptr().cast::<TOKEN_APPCONTAINER_INFORMATION>() };
        let mut raw = ptr::null_mut();
        if unsafe { ConvertSidToStringSidW(info.TokenAppContainer, &mut raw) } == 0 {
            return Err("Child SID conversion failed".into());
        }
        let actual = unsafe { string(raw) };
        unsafe {
            LocalFree(raw.cast());
        }
        if actual?.to_string_lossy() != expected {
            return Err("Descendant AppContainer SID changed".into());
        }
    }
    let station = unsafe { GetProcessWindowStation() };
    let station_name = object_name(station)?;
    let identity = station_name
        .strip_prefix("TASTESTUDIO-Station-")
        .ok_or("Isolation child requires an owned private station")?;
    let expected = DesktopNames::for_profile(identity)?;
    let desktop_name = object_name(unsafe { GetThreadDesktop(GetCurrentThreadId()) })?;
    let mut flags = [0u32; 3];
    let mut needed = 0;
    if desktop_name != expected.desktop
        || unsafe {
            GetUserObjectInformationW(
                station,
                UOI_FLAGS,
                flags.as_mut_ptr().cast(),
                12,
                &mut needed,
            )
        } == 0
        || flags[2] & 1 != 0
    {
        return Err("Isolation child requires a noninteractive private desktop".into());
    }
    Ok(())
}

fn value(key: &str) -> Result<String> {
    let value = std::env::var(key).map_err(|_| "Missing isolation probe input")?;
    if value.is_empty() || value.len() > 32768 || value.contains('\0') {
        return Err("Invalid isolation probe input".into());
    }
    Ok(value)
}

fn output_path(key: &str) -> Result<PathBuf> {
    let path = PathBuf::from(value(key)?);
    let cwd =
        std::env::current_dir().map_err(|_| "Isolation child working directory unavailable")?;
    if !path.is_absolute() || path.parent() != Some(cwd.as_path()) || path.exists() {
        return Err("Isolation report must be a new file in the private working directory".into());
    }
    crate::model::no_links(&cwd)?;
    Ok(path)
}

fn publish(path: &Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| "Isolation report creation failed")?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Isolation report persistence failed".into())
}

pub(crate) fn run() -> Result<()> {
    require_private_child()?;
    match std::env::var("PROBE_MODE").as_deref() {
        Ok("spawn-boundary") => {
            // Only this fixed entry point under an already verified private
            // token. Never accept a caller-selected executable or shell command.
            let depth = std::env::var("PROBE_CHAIN_DEPTH")
                .ok()
                .map(|v| v.parse::<u32>())
                .transpose()
                .map_err(|_| "Invalid bounded probe depth")?
                .unwrap_or(1);
            if !(1..=3).contains(&depth) {
                return Err("Invalid bounded probe depth".into());
            }
            let status = std::process::Command::new(
                std::env::current_exe().map_err(|_| "Probe image unavailable")?,
            )
            .args(std::env::args_os().skip(1))
            .env(
                "PROBE_MODE",
                if depth > 1 {
                    "spawn-boundary"
                } else {
                    "boundary"
                },
            )
            .env("PROBE_CHAIN_DEPTH", depth.saturating_sub(1).to_string())
            .status()
            .map_err(|_| "Approved private descendant did not start")?;
            return if status.success() {
                Ok(())
            } else {
                Err("Private descendant boundary failed".into())
            };
        }
        Ok("sleep") => {
            publish(
                &output_path("PROBE_READY")?,
                std::process::id().to_string().as_bytes(),
            )?;
            loop {
                std::thread::sleep(std::time::Duration::from_secs(1));
            }
        }
        Ok("boundary") | Err(std::env::VarError::NotPresent) => (),
        _ => return Err("Unknown isolation probe mode".into()),
    }
    let report = output_path("PROBE_REPORT")?;
    let outside = PathBuf::from(value("PROBE_OUTSIDE")?);
    // The parent supplies only its own disposable canary. Never overwrite an
    // arbitrary existing file even when the boundary is unexpectedly weak.
    if !outside.is_absolute() || outside.file_name().and_then(|s| s.to_str()) != Some("outside.txt")
    {
        return Err("Invalid isolation canary path".into());
    }
    let socket: std::net::SocketAddr = value("PROBE_SOCKET")?
        .parse()
        .map_err(|_| "Invalid isolation canary endpoint")?;
    if !socket.ip().is_loopback() || socket.port() == 0 {
        return Err("Isolation canary must use loopback".into());
    }
    let canary = value("PROBE_CANARY_WINDOW")?
        .parse::<usize>()
        .map_err(|_| "Invalid isolation canary window")?;
    if canary == 0 {
        return Err("Missing isolation canary window".into());
    }
    let expected_desktop = value("PROBE_EXPECTED_DESKTOP")?;
    let expected_station = value("PROBE_EXPECTED_STATION")?;
    let read_denied = fs::File::open(&outside).is_err();
    let write_denied = fs::OpenOptions::new().write(true).open(&outside).is_err();
    let network_denied =
        std::net::TcpStream::connect_timeout(&socket, std::time::Duration::from_secs(2)).is_err();
    let child_denied =
        std::process::Command::new(std::env::current_exe().map_err(|_| "Probe image unavailable")?)
            // Deliberately invalid entry point: if a weakened boundary admits a
            // child, it exits immediately rather than recursively probing/forking.
            .args(["--isolation-self-check-child-denied"])
            .status()
            .is_err();
    let parent_key_absent = match std::env::var("PROBE_PARENT_ENV_NAME") {
        Err(std::env::VarError::NotPresent) => true,
        Ok(key)
            if !key.is_empty()
                && key.len() <= 128
                && key.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'_') =>
        {
            std::env::var_os(key).is_none()
        }
        _ => return Err("Invalid parent environment name".into()),
    };
    let credential_absent =
        parent_key_absent && std::env::var_os("TASTESTUDIO_ISOLATION_DUMMY").is_none();
    let host_station_switch_denied = unsafe {
        let own = GetProcessWindowStation();
        let host = OpenWindowStationW(wide("WinSta0").as_ptr(), 0, 0x00020123);
        if host.is_null() {
            true
        } else {
            let switched = SetProcessWindowStation(host) != 0;
            let restored = !switched || SetProcessWindowStation(own) != 0;
            CloseWindowStation(host);
            if !restored {
                return Err("Probe station restore failed".into());
            }
            !switched
        }
    };
    let (non_interactive, interactive_read_denied) = unsafe {
        let mut flags = [0u32; 3];
        let mut needed = 0;
        let got = GetUserObjectInformationW(
            GetProcessWindowStation(),
            UOI_FLAGS,
            flags.as_mut_ptr().cast(),
            12,
            &mut needed,
        );
        let interactive = OpenWindowStationW(wide("WinSta0").as_ptr(), 0, 0x00020200);
        let denied = interactive.is_null();
        if !denied {
            CloseWindowStation(interactive);
        }
        (got != 0 && flags[2] & 1 == 0, denied)
    };
    let (outside_window_denied, screen_dc_denied) = unsafe {
        use windows_sys::Win32::{
            Graphics::Gdi::{GetDC, ReleaseDC},
            UI::WindowsAndMessaging::GetWindowTextW,
        };
        let mut text = [0u16; 128];
        let denied = GetWindowTextW(canary as *mut c_void, text.as_mut_ptr(), 128) == 0;
        let dc = GetDC(ptr::null_mut());
        let screen_denied = dc.is_null();
        if !screen_denied {
            ReleaseDC(ptr::null_mut(), dc);
        }
        (denied, screen_denied)
    };
    let private_desktop =
        object_name(unsafe { GetThreadDesktop(GetCurrentThreadId()) })? == expected_desktop;
    let private_station = object_name(unsafe { GetProcessWindowStation() })? == expected_station;
    let input_switch_denied = std::thread::spawn(|| -> Result<bool> {
        unsafe {
            let original = GetThreadDesktop(GetCurrentThreadId());
            let input = OpenInputDesktop(0, 0, 1);
            if input.is_null() {
                return Ok(true);
            }
            let switched = SetThreadDesktop(input) != 0;
            let restored = !switched || SetThreadDesktop(original) != 0;
            CloseDesktop(input);
            if !restored {
                return Err("Probe thread desktop restore failed".into());
            }
            Ok(!switched)
        }
    })
    .join()
    .map_err(|_| "Probe desktop thread failed")??;
    let bytes = serde_json::to_vec(&serde_json::json!({
        "readDenied":read_denied,"writeDenied":write_denied,"networkDenied":network_denied,
        "childDenied":child_denied,"credentialAbsent":credential_absent,"nonInteractive":non_interactive,
        "interactiveReadDenied":interactive_read_denied,"outsideWindowDenied":outside_window_denied,
        "screenDcDenied":screen_dc_denied,"privateDesktop":private_desktop,"privateStation":private_station,
        "inputDesktopSwitchDenied":input_switch_denied,"hostStationSwitchDenied":host_station_switch_denied
    })).map_err(|_| "Probe report encoding failed")?;
    publish(&report, &bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn regular_host_cannot_enter_child_protocol() {
        assert!(require_private_child().is_err());
        assert!(run().is_err());
    }

    #[test]
    fn report_publication_never_replaces_an_existing_file() {
        let temp = tempfile::tempdir().unwrap();
        let report = temp.path().join("report.json");
        publish(&report, b"original dummy report").unwrap();
        assert!(publish(&report, b"replacement").is_err());
        assert_eq!(fs::read(report).unwrap(), b"original dummy report");
    }

    #[test]
    #[ignore = "Runs the explicitly selected real Agent image in a regular host token; no private UI creation"]
    fn actual_agent_refuses_host_probe_before_any_path_io() {
        use std::{
            process::{Command, Stdio},
            time::{Duration, Instant},
        };
        let executable = std::env::var_os("TASTESTUDIO_VERIFY_AGENT_EXE")
            .map(PathBuf::from)
            .expect("Select the actual Agent image explicitly");
        assert!(executable.is_absolute() && executable.is_file());
        let temp = tempfile::tempdir().unwrap();
        let original = temp.path().join("outside.txt");
        fs::write(&original, b"existing dummy user state").unwrap();
        for mode in ["sleep", "boundary", "invalid"] {
            let ready = temp.path().join(format!("{mode}-ready.txt"));
            let report = temp.path().join(format!("{mode}-report.json"));
            let mut command = Command::new(&executable);
            command
                .args(["--isolation-self-check-child"])
                .current_dir(temp.path())
                .env_clear()
                .env("SystemRoot", std::env::var_os("SystemRoot").unwrap())
                .env("PROBE_MODE", mode)
                .env("PROBE_READY", &ready)
                .env("PROBE_REPORT", &report)
                .env("PROBE_OUTSIDE", &original)
                .env("PROBE_SOCKET", "127.0.0.1:1")
                .env("PROBE_CANARY_WINDOW", "1")
                .env("TASTESTUDIO_ISOLATION_DUMMY", "dummy-must-not-be-printed")
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());
            let (mut child, tree) = crate::tree::Tree::spawn(&mut command).unwrap();
            let deadline = Instant::now() + Duration::from_secs(5);
            let status = loop {
                if let Some(status) = child.try_wait().unwrap() {
                    break Some(status);
                }
                if Instant::now() >= deadline {
                    tree.terminate().unwrap();
                    child.wait().unwrap();
                    break None;
                }
                std::thread::sleep(Duration::from_millis(10));
            };
            assert_eq!(
                status
                    .expect("Host guard must not enter the sleep loop")
                    .code(),
                Some(1)
            );
            let output = child.wait_with_output().unwrap();
            drop(tree);
            assert!(output.stdout.is_empty());
            assert_eq!(
                String::from_utf8(output.stderr).unwrap().trim(),
                "Agent stopped: Isolation self-check child requires an AppContainer token"
            );
            assert!(!ready.exists() && !report.exists());
            assert_eq!(fs::read(&original).unwrap(), b"existing dummy user state");
        }
    }
}
