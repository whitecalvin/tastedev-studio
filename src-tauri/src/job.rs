use crate::filesystem::{error, Result};
#[cfg(windows)]
pub struct ProcessJob(isize);
#[cfg(windows)]
impl ProcessJob {
    pub fn attach(handle: std::os::windows::io::RawHandle) -> Result<Self> {
        Self::attach_with_breakaway(handle, false)
    }
    pub fn attach_app(handle: std::os::windows::io::RawHandle) -> Result<Self> {
        Self::attach_with_breakaway(handle, true)
    }
    fn attach_with_breakaway(handle: std::os::windows::io::RawHandle, allow: bool) -> Result<Self> {
        use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
        // SAFETY: initialized job information, valid borrowed child handle, owned job
        // handle closed exactly once. The child handle is never closed here.
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err(error("process"));
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if allow {
                info.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_BREAKAWAY_OK;
            }
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as _,
                std::mem::size_of_val(&info) as u32,
            ) == 0
                || AssignProcessToJobObject(job, handle) == 0
            {
                CloseHandle(job);
                return Err(error("process"));
            }
            Ok(Self(job as isize))
        }
    }
    pub fn terminate(&self) {
        unsafe {
            if windows_sys::Win32::System::JobObjects::TerminateJobObject(self.0 as _, 1) == 0 {
                crate::diagnostics::record("cleanup", "job-terminate");
            }
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessJob {
    fn drop(&mut self) {
        unsafe {
            if windows_sys::Win32::Foundation::CloseHandle(self.0 as _) == 0 {
                crate::diagnostics::record("cleanup", "job-close");
            }
        }
    }
}
