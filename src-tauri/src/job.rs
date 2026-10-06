#[cfg(windows)]
use crate::filesystem::{error, Result};

/// Unix에서는 이 실행에서 만든 독립 프로세스 그룹만 정리한다.
#[cfg(unix)]
pub struct ProcessJob {
    pid: u32,
    terminated: std::sync::atomic::AtomicBool,
}
#[cfg(unix)]
impl ProcessJob {
    pub fn attach(child: &std::process::Child) -> crate::filesystem::Result<Self> {
        Self::attach_pid(child.id())
    }
    pub fn attach_pid(pid: u32) -> crate::filesystem::Result<Self> {
        if pid <= 1 || pid > i32::MAX as u32 {
            return Err(crate::filesystem::error("process"));
        }
        Ok(Self {
            pid,
            terminated: std::sync::atomic::AtomicBool::new(false),
        })
    }
    pub fn terminate(&self) {
        use std::sync::atomic::Ordering;
        if self.terminated.swap(true, Ordering::SeqCst) {
            return;
        }
        // 고정된 kill 프로그램과 숫자 그룹 ID만 사용하며 shell 문자열을 실행하지 않는다.
        let group = format!("-{}", self.pid);
        let live = std::process::Command::new("/bin/kill")
            .args(["-0", "--", &group])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .is_ok_and(|status| status.success());
        if live
            && !std::process::Command::new("/bin/kill")
                .args(["-KILL", "--", &group])
                .stdout(std::process::Stdio::null())
                .stderr(std::process::Stdio::null())
                .status()
                .is_ok_and(|status| status.success())
        {
            crate::diagnostics::record("cleanup", "process-group-terminate");
        }
    }
}
#[cfg(unix)]
impl Drop for ProcessJob {
    fn drop(&mut self) {
        self.terminate();
    }
}

#[cfg(all(test, unix))]
mod tests {
    use super::*;
    use std::os::unix::process::CommandExt;
    #[test]
    fn owned_process_group_is_terminated_once() {
        let mut child = std::process::Command::new("/bin/sh")
            .args(["-c", "sleep 30 & wait"])
            .process_group(0)
            .spawn()
            .unwrap();
        let job = ProcessJob::attach(&child).unwrap();
        job.terminate();
        job.terminate();
        let deadline = std::time::Instant::now() + std::time::Duration::from_secs(5);
        loop {
            if let Some(status) = child.try_wait().unwrap() {
                assert!(!status.success());
                break;
            }
            if std::time::Instant::now() >= deadline {
                let _ = child.kill();
                let _ = child.wait();
                panic!("Owned group did not terminate");
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
    #[test]
    fn unsafe_group_identifiers_are_rejected() {
        for pid in [0, 1, u32::MAX] {
            assert!(ProcessJob::attach_pid(pid).is_err());
        }
    }
}
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
