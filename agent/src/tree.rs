use crate::model::Result;
use std::process::{Child, Command};
#[cfg(windows)]
pub struct Tree(isize);
#[cfg(unix)]
pub struct Tree(i32);
impl Tree {
    pub fn spawn(command: &mut Command) -> Result<(Child, Self)> {
        #[cfg(windows)]
        {
            use std::os::windows::{io::AsRawHandle, process::CommandExt};
            use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
            command.creation_flags(0x00000004 | 0x08000000); // Suspended: attach before any child code may fork.
            let mut child = command.spawn().map_err(|_| "Process start failed")?;
            // SAFETY: all pointers refer to initialized structures; the job handle is owned by Tree.
            unsafe {
                let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if job.is_null() {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("Job creation failed".into());
                }
                let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
                info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                if SetInformationJobObject(
                    job,
                    JobObjectExtendedLimitInformation,
                    &info as *const _ as _,
                    std::mem::size_of_val(&info) as u32,
                ) == 0
                    || AssignProcessToJobObject(job, child.as_raw_handle()) == 0
                {
                    CloseHandle(job);
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err("Process tree attachment failed".into());
                }
                let tree = Self(job as isize);
                #[link(name = "ntdll")]
                unsafe extern "system" {
                    fn NtResumeProcess(handle: *mut std::ffi::c_void) -> i32;
                }
                if NtResumeProcess(child.as_raw_handle()) < 0 {
                    let _ = tree.terminate();
                    let _ = child.wait();
                    return Err("Process resume failed".into());
                }
                Ok((child, tree))
            }
        }
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
            let child = command.spawn().map_err(|_| "Process start failed")?;
            let tree = Self(child.id() as i32);
            Ok((child, tree))
        }
    }
    pub fn terminate(&self) -> Result<()> {
        #[cfg(windows)]
        {
            // SAFETY: live owned Job Object handle.
            if unsafe { windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0 as _, 1) }
                == 0
            {
                return Err("Process tree cleanup failed".into());
            }
        }
        #[cfg(unix)]
        {
            // SAFETY: dedicated child process group, never the Agent's group.
            if unsafe { libc::kill(-self.0, libc::SIGKILL) } != 0
                && std::io::Error::last_os_error().raw_os_error() != Some(libc::ESRCH)
            {
                return Err("Process group cleanup failed".into());
            }
        }
        Ok(())
    }
}
impl Drop for Tree {
    fn drop(&mut self) {
        let _ = self.terminate();
        #[cfg(windows)]
        unsafe {
            windows_sys::Win32::Foundation::CloseHandle(self.0 as _);
        }
    }
}
