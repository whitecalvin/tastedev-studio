use crate::model::Result;
use std::process::{Child, Command};
#[cfg(windows)]
pub struct Tree(isize);
#[cfg(unix)]
pub struct Tree(i32);
impl Tree {
    /// Attach an owned suspended Windows process before any of its code runs.
    /// A leaf job admits only its initial process; breakaway is never enabled.
    ///
    /// # Safety
    /// `process` must be a live owned process handle, still suspended. The caller
    /// must terminate/reap it if attachment or the subsequent resume fails.
    #[cfg(windows)]
    pub unsafe fn attach_suspended(
        process: *mut std::ffi::c_void,
        allow_children: bool,
    ) -> Result<Self> {
        // Legacy execution retains its existing behavior. Isolated execution
        // never uses the unlimited branch.
        unsafe { Self::attach_with_limit(process, if allow_children { None } else { Some(1) }) }
    }
    /// Attach a reviewed isolated process tree before resuming its root. The
    /// count includes that root; UI restrictions and no-breakaway always apply.
    /// This kernel primitive does not authorize a job to allow children.
    ///
    /// # Safety
    /// Same live, owned, suspended-process requirements as attach_suspended.
    #[cfg(windows)]
    pub unsafe fn attach_isolated(
        process: *mut std::ffi::c_void,
        max_processes: u32,
    ) -> Result<Self> {
        if !(1..=4).contains(&max_processes) {
            return Err("Isolated process count must be between1 and4".into());
        }
        unsafe { Self::attach_with_limit(process, Some(max_processes)) }
    }
    #[cfg(windows)]
    unsafe fn attach_with_limit(
        process: *mut std::ffi::c_void,
        max_processes: Option<u32>,
    ) -> Result<Self> {
        use windows_sys::Win32::{Foundation::CloseHandle, System::JobObjects::*};
        unsafe {
            let job = CreateJobObjectW(std::ptr::null(), std::ptr::null());
            if job.is_null() {
                return Err("Job creation failed".into());
            }
            let mut info: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = std::mem::zeroed();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if let Some(limit) = max_processes {
                info.BasicLimitInformation.LimitFlags |= JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
                info.BasicLimitInformation.ActiveProcessLimit = limit;
            }
            if SetInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &info as *const _ as _,
                std::mem::size_of_val(&info) as u32,
            ) == 0
                || AssignProcessToJobObject(job, process) == 0
            {
                CloseHandle(job);
                return Err("Process tree attachment failed".into());
            }
            if max_processes.is_some() {
                let ui = JOBOBJECT_BASIC_UI_RESTRICTIONS {
                    UIRestrictionsClass: JOB_OBJECT_UILIMIT_HANDLES
                        | JOB_OBJECT_UILIMIT_READCLIPBOARD
                        | JOB_OBJECT_UILIMIT_WRITECLIPBOARD
                        | JOB_OBJECT_UILIMIT_SYSTEMPARAMETERS
                        | JOB_OBJECT_UILIMIT_DISPLAYSETTINGS
                        | JOB_OBJECT_UILIMIT_DESKTOP
                        | JOB_OBJECT_UILIMIT_EXITWINDOWS,
                };
                if SetInformationJobObject(
                    job,
                    JobObjectBasicUIRestrictions,
                    &ui as *const _ as _,
                    std::mem::size_of_val(&ui) as u32,
                ) == 0
                {
                    CloseHandle(job);
                    return Err("Leaf UI restrictions unavailable".into());
                }
            }
            Ok(Self(job as isize))
        }
    }
    pub fn spawn(command: &mut Command) -> Result<(Child, Self)> {
        #[cfg(windows)]
        {
            use std::os::windows::{io::AsRawHandle, process::CommandExt};
            command.creation_flags(0x00000004 | 0x08000000); // Suspended: attach before any child code may fork.
            let mut child = command.spawn().map_err(|_| "Process start failed")?;
            // SAFETY: all pointers refer to initialized structures; the job handle is owned by Tree.
            unsafe {
                let tree = match Self::attach_suspended(child.as_raw_handle(), true) {
                    Ok(tree) => tree,
                    Err(error) => {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Err(error);
                    }
                };
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
    /// Confirm zero members before private output capture/profile removal.
    /// Caller must terminate/reap owned processes and close its process/thread
    /// handles first: terminated processes with open handles can remain counted.
    #[cfg(windows)]
    pub fn wait_empty(&self, timeout: std::time::Duration) -> Result<()> {
        let deadline = std::time::Instant::now() + timeout;
        loop {
            if self.active_processes()? == 0 {
                return Ok(());
            }
            if std::time::Instant::now() >= deadline {
                return Err("Owned process tree cleanup is still pending".into());
            }
            std::thread::sleep(std::time::Duration::from_millis(10));
        }
    }
    #[cfg(windows)]
    fn active_processes(&self) -> Result<u32> {
        use windows_sys::Win32::System::JobObjects::*;
        let mut info: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { std::mem::zeroed() };
        // SAFETY: live owned Job handle and correctly sized output structure.
        if unsafe {
            QueryInformationJobObject(
                self.0 as _,
                JobObjectBasicAccountingInformation,
                (&mut info as *mut JOBOBJECT_BASIC_ACCOUNTING_INFORMATION).cast(),
                std::mem::size_of_val(&info) as u32,
                std::ptr::null_mut(),
            )
        } == 0
        {
            return Err("Owned process tree observation failed".into());
        }
        Ok(info.ActiveProcesses)
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::{
        os::windows::{io::AsRawHandle, process::CommandExt},
        process::Stdio,
        time::{Duration, Instant},
    };
    fn leaf(script: &str) -> (Child, Tree) {
        limited(script, 1)
    }
    fn limited(script: &str, limit: u32) -> (Child, Tree) {
        let mut command = Command::new("node");
        command
            .args(["-e", script])
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(0x00000004 | 0x08000000);
        command.env_clear();
        for key in ["SystemRoot", "WINDIR"] {
            if let Some(value) = std::env::var_os(key) {
                command.env(key, value);
            }
        }
        let mut child = command
            .spawn()
            .expect("actual Node fixture runtime required");
        let tree = unsafe { Tree::attach_isolated(child.as_raw_handle(), limit) }.unwrap_or_else(
            |error| {
                let _ = child.kill();
                let _ = child.wait();
                panic!("{error}")
            },
        );
        #[link(name = "ntdll")]
        unsafe extern "system" {
            fn NtResumeProcess(process: *mut std::ffi::c_void) -> i32;
        }
        if unsafe { NtResumeProcess(child.as_raw_handle()) } < 0 {
            let _ = tree.terminate();
            let _ = child.wait();
            panic!("leaf fixture resume failed");
        }
        (child, tree)
    }
    #[test]
    fn leaf_job_blocks_a_readable_executable_before_child_code_runs() {
        let (child,_tree)=leaf("const r=require('node:child_process').spawnSync(process.execPath,['-e','process.exit(0)']);if(!r.error)process.exit(5);process.stdout.write(JSON.stringify({blocked:true}));");
        let output = child.wait_with_output().unwrap();
        assert!(
            output.status.success(),
            "leaf child denial fixture did not complete"
        );
        assert_eq!(
            serde_json::from_slice::<serde_json::Value>(&output.stdout).unwrap()["blocked"],
            true
        );
    }
    #[test]
    fn closing_a_leaf_job_reaps_its_owned_process() {
        let (mut child, tree) = leaf("setInterval(()=>{},1000)");
        drop(tree);
        let deadline = Instant::now() + Duration::from_secs(5);
        while child.try_wait().unwrap().is_none() {
            assert!(
                Instant::now() < deadline,
                "owned leaf process survived job closure"
            );
            std::thread::sleep(Duration::from_millis(5));
        }
        assert!(!child.wait().unwrap().success());
    }
    #[test]
    fn bounded_job_counts_descendants_and_confirms_complete_tree_termination() {
        let root = tempfile::tempdir().unwrap();
        let ready = root.path().join("child-ready");
        let overflow = root.path().join("overflow-entered");
        let report = root.path().join("report.json");
        let child_script = format!(
            "require('node:fs').writeFileSync({},'ready');setInterval(()=>{{}},1000)",
            serde_json::to_string(&ready).unwrap()
        );
        let overflow_script = format!(
            "require('node:fs').writeFileSync({},'unexpected');",
            serde_json::to_string(&overflow).unwrap()
        );
        let script=format!("const fs=require('node:fs'),cp=require('node:child_process');const child=cp.spawn(process.execPath,['-e',{}],{{stdio:'ignore'}});child.on('error',()=>process.exit(7));const timer=setInterval(()=>{{if(!fs.existsSync({}))return;clearInterval(timer);const denied=cp.spawnSync(process.execPath,['-e',{}],{{stdio:'ignore',timeout:2000}});fs.writeFileSync({},JSON.stringify({{childPid:child.pid,blocked:!!denied.error}}));}},10);setInterval(()=>{{}},1000);",serde_json::to_string(&child_script).unwrap(),serde_json::to_string(&ready).unwrap(),serde_json::to_string(&overflow_script).unwrap(),serde_json::to_string(&report).unwrap());
        let (mut parent, tree) = limited(&script, 2);
        let deadline = Instant::now() + Duration::from_secs(8);
        while std::fs::read(&report)
            .ok()
            .is_none_or(|bytes| serde_json::from_slice::<serde_json::Value>(&bytes).is_err())
        {
            assert!(
                parent.try_wait().unwrap().is_none(),
                "bounded root exited before its report"
            );
            assert!(Instant::now() < deadline, "bounded fixture did not report");
            std::thread::sleep(Duration::from_millis(10));
        }
        let value: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&report).unwrap()).unwrap();
        assert_eq!(value["blocked"], true);
        assert!(!overflow.exists());
        // A denied association can remain counted until its terminated process
        // handles close. Verify the configured kernel limit separately.
        let mut limits:windows_sys::Win32::System::JobObjects::JOBOBJECT_EXTENDED_LIMIT_INFORMATION=unsafe {std::mem::zeroed()};
        assert_ne!(
            unsafe {
                windows_sys::Win32::System::JobObjects::QueryInformationJobObject(tree.0 as _,windows_sys::Win32::System::JobObjects::JobObjectExtendedLimitInformation,(&mut limits as *mut windows_sys::Win32::System::JobObjects::JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),std::mem::size_of_val(&limits) as u32,std::ptr::null_mut())
            },
            0
        );
        assert_eq!(limits.BasicLimitInformation.ActiveProcessLimit, 2);
        assert_eq!(
            limits.BasicLimitInformation.LimitFlags
                & (windows_sys::Win32::System::JobObjects::JOB_OBJECT_LIMIT_BREAKAWAY_OK
                    | windows_sys::Win32::System::JobObjects::JOB_OBJECT_LIMIT_SILENT_BREAKAWAY_OK),
            0
        );
        tree.terminate().unwrap();
        assert!(!parent.wait().unwrap().success());
        drop(parent);
        tree.wait_empty(Duration::from_secs(5)).unwrap();
        assert_eq!(tree.active_processes().unwrap(), 0);
    }
    #[test]
    fn isolated_process_limits_reject_unbounded_or_excessive_values_before_attachment() {
        for limit in [0, 5, u32::MAX] {
            // Validation must run before any OS call on this deliberately null handle.
            assert!(unsafe { Tree::attach_isolated(std::ptr::null_mut(), limit) }.is_err());
        }
    }
}
