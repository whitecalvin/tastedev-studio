use crate::filesystem::{error, resolve, Result, Workspaces};
use crate::job::ProcessJob;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Deserialize;
use std::{
    collections::{HashMap, HashSet},
    io::{Read, Write},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Condvar, Mutex,
    },
    time::Duration,
};
use tauri::Emitter;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    command: String,
    args: Vec<String>,
    cwd: String,
    environment: HashMap<String, String>,
    terminal_mode: String,
    workspace_id: Option<String>,
}
pub fn validate(r: &Request) -> Result<()> {
    if r.command.is_empty()
        || r.command.len() > 1024
        || r.command.contains(['\0', '\n', '\r'])
        || r.args.len() > 256
        || r.args.iter().any(|a| a.len() > 8192 || a.contains('\0'))
        || r.environment.len() > 128
        || r.environment.iter().any(|(k, v)| {
            k.is_empty() || k.contains(['=', '\0']) || v.contains('\0') || v.len() > 32768
        })
        || !["pty", "output"].contains(&r.terminal_mode.as_str())
    {
        return Err(error("invalid"));
    }
    crate::filesystem::relative(&r.cwd, true)
}
struct Session {
    master: Mutex<Option<Box<dyn MasterPty + Send>>>,
    writer: Mutex<Option<Box<dyn Write + Send>>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    job: ProcessJob,
    stopped: AtomicBool,
    done: (Mutex<bool>, Condvar),
}
#[derive(Default)]
pub struct Processes {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    cancelled: Mutex<HashSet<String>>,
}
impl Processes {
    pub fn start(
        &self,
        app: tauri::AppHandle,
        workspaces: &Workspaces,
        id: String,
        request: Request,
    ) -> Result<()> {
        validate(&request)?;
        if id.len() > 100 || uuid::Uuid::parse_str(&id).is_err() {
            return Err(error("invalid"));
        }
        let mut sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        // Start and stop serialize registration, so cancellation cannot lose a spawn.
        if self
            .cancelled
            .lock()
            .map_err(|_| error("internal"))?
            .remove(&id)
        {
            return Err(error("cancelled"));
        }
        sessions.retain(|_, session| !session.done.0.lock().map(|done| *done).unwrap_or(false));
        if sessions.contains_key(&id) || sessions.len() >= 16 {
            return Err(error("process"));
        }
        let root = workspaces.root(
            request
                .workspace_id
                .as_deref()
                .ok_or_else(|| error("access"))?,
        )?;
        let cwd = resolve(&root, &request.cwd, true)?;
        if !cwd.is_dir() {
            return Err(error("path"));
        }
        let Launch {
            mut child,
            master,
            writer,
            readers,
        } = launch(request, &cwd)?;
        let job = match child
            .as_raw_handle()
            .ok_or_else(|| error("process"))
            .and_then(ProcessJob::attach)
        {
            Ok(job) => job,
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(e);
            }
        };
        let session = Arc::new(Session {
            master: Mutex::new(master),
            writer: Mutex::new(writer),
            killer: Mutex::new(child.clone_killer()),
            job,
            stopped: AtomicBool::new(false),
            done: (Mutex::new(false), Condvar::new()),
        });
        sessions.insert(id.clone(), session.clone());
        drop(sessions);
        let sequence = Arc::new(Mutex::new(0u64));
        emit(&app, &id, &sequence, serde_json::json!({"type":"started"}));
        let outputs = readers
            .into_iter()
            .map(|(stream, reader)| {
                stream_output(app.clone(), id.clone(), sequence.clone(), stream, reader)
            })
            .collect::<Vec<_>>();
        std::thread::spawn(move || {
            let status = child.wait();
            session.job.terminate();
            if let Ok(mut writer) = session.writer.lock() {
                writer.take();
            }
            if let Ok(mut master) = session.master.lock() {
                master.take();
            }
            for output in outputs {
                if output.join().is_err() {
                    crate::diagnostics::record("cleanup", "output-thread");
                }
            }
            let event = if session.stopped.load(Ordering::SeqCst) {
                serde_json::json!({"type":"stopped"})
            } else {
                match status {
                    Ok(status) => {
                        serde_json::json!({"type":"exited","exitCode":status.exit_code()})
                    }
                    Err(_) => {
                        crate::diagnostics::record("process", "wait-error");
                        serde_json::json!({"type":"failed","reason":"unexpected-exit"})
                    }
                }
            };
            emit(&app, &id, &sequence, event);
            if let Ok(mut done) = session.done.0.lock() {
                *done = true;
                session.done.1.notify_all();
            }
        });
        Ok(())
    }
    pub fn stop(&self, id: &str) -> Result<()> {
        let session = {
            let sessions = self.sessions.lock().map_err(|_| error("internal"))?;
            let result = sessions.get(id).cloned();
            if result.is_none() {
                self.cancelled
                    .lock()
                    .map_err(|_| error("internal"))?
                    .insert(id.into());
            }
            result
        };
        if let Some(session) = session {
            session.stopped.store(true, Ordering::SeqCst);
            session.job.terminate();
            let _ = session.killer.lock().map_err(|_| error("internal"))?.kill();
            let done = session.done.0.lock().map_err(|_| error("internal"))?;
            let result = session
                .done
                .1
                .wait_timeout_while(done, Duration::from_secs(10), |done| !*done)
                .map_err(|_| error("internal"))?;
            if !*result.0 {
                crate::diagnostics::record("cleanup", "stop-timeout");
                return Err(error("process-stop"));
            }
            self.sessions
                .lock()
                .map_err(|_| error("internal"))?
                .remove(id);
        }
        Ok(())
    }
    pub fn write(&self, id: &str, data: &str) -> Result<()> {
        if data.len() > 65536 {
            return Err(error("invalid"));
        }
        let sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        let session = sessions.get(id).ok_or_else(|| error("process"))?;
        let mut writer = session.writer.lock().map_err(|_| error("internal"))?;
        let writer = writer.as_mut().ok_or_else(|| error("process"))?;
        writer.write_all(data.as_bytes())?;
        writer.flush()?;
        Ok(())
    }
    pub fn resize(&self, id: &str, columns: u16, rows: u16) -> Result<()> {
        if !(2..=1000).contains(&columns) || !(1..=1000).contains(&rows) {
            return Err(error("invalid"));
        }
        let sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        let session = sessions.get(id).ok_or_else(|| error("process"))?;
        session
            .master
            .lock()
            .map_err(|_| error("internal"))?
            .as_ref()
            .ok_or_else(|| error("process"))?
            .resize(PtySize {
                cols: columns,
                rows,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|_| error("pty"))?;
        Ok(())
    }
    pub fn stop_all(&self) {
        let ids = self
            .sessions
            .lock()
            .map(|s| s.keys().cloned().collect::<Vec<_>>())
            .unwrap_or_else(|_| {
                crate::diagnostics::record("cleanup", "session-lock");
                Vec::new()
            });
        for id in ids {
            if self.stop(&id).is_err() {
                crate::diagnostics::record("cleanup", "stop-failed");
            }
        }
    }
}
fn emit(app: &tauri::AppHandle, id: &str, sequence: &Mutex<u64>, mut event: serde_json::Value) {
    if let Ok(mut n) = sequence.lock() {
        *n += 1;
        event["sessionId"] = serde_json::json!(id);
        event["sequence"] = serde_json::json!(*n);
        if app.emit("studio-process", event).is_err() {
            crate::diagnostics::record("process", "event-error");
        }
    } else {
        crate::diagnostics::record("process", "event-lock");
    }
}
fn default_shell() -> String {
    let root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".into());
    let powershell = format!("{root}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    if std::path::Path::new(&powershell).exists() {
        powershell
    } else {
        format!("{root}\\System32\\cmd.exe")
    }
}
struct Launch {
    child: Box<dyn portable_pty::Child + Send + Sync>,
    master: Option<Box<dyn MasterPty + Send>>,
    writer: Option<Box<dyn Write + Send>>,
    readers: Vec<(&'static str, Box<dyn Read + Send>)>,
}
fn launch(mut request: Request, cwd: &std::path::Path) -> Result<Launch> {
    let executable = if request.command == "@default-shell" {
        let shell = default_shell();
        if shell.to_ascii_lowercase().ends_with("powershell.exe") {
            request
                .args
                .splice(0..0, ["-NoLogo".into(), "-NoProfile".into()]);
        }
        shell
    } else {
        request.command
    };
    let executable_path = resolve_executable(&executable)?;
    if request.terminal_mode == "output" {
        use std::os::windows::process::CommandExt;
        use std::process::{Command, Stdio};
        let mut child = Command::new(executable_path)
            .args(request.args)
            .current_dir(cwd)
            .envs(request.environment)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .creation_flags(0x08000000)
            .spawn()
            .map_err(|_| error("executable"))?;
        let readers = vec![
            (
                "stdout",
                Box::new(child.stdout.take().ok_or_else(|| error("process"))?)
                    as Box<dyn Read + Send>,
            ),
            (
                "stderr",
                Box::new(child.stderr.take().ok_or_else(|| error("process"))?)
                    as Box<dyn Read + Send>,
            ),
        ];
        return Ok(Launch {
            child: Box::new(child),
            master: None,
            writer: None,
            readers,
        });
    }
    let pair = native_pty_system()
        .openpty(PtySize {
            rows: 24,
            cols: 100,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|_| error("pty"))?;
    let reader = pair.master.try_clone_reader().map_err(|_| error("pty"))?;
    let writer = pair.master.take_writer().map_err(|_| error("pty"))?;
    let mut command = CommandBuilder::new(executable_path);
    command.args(request.args);
    command.cwd(cwd);
    for (key, value) in request.environment {
        command.env(key, value);
    }
    let child = pair
        .slave
        .spawn_command(command)
        .map_err(|_| error("executable"))?;
    drop(pair.slave);
    Ok(Launch {
        child,
        master: Some(pair.master),
        writer: Some(writer),
        readers: vec![("stdout", reader)],
    })
}
fn resolve_executable(command: &str) -> Result<std::path::PathBuf> {
    let path = std::path::PathBuf::from(command);
    let candidates = if path.is_absolute() {
        vec![path]
    } else if command.contains(['/', '\\']) {
        return Err(error("executable"));
    } else {
        std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default())
            .flat_map(|dir| vec![dir.join(command), dir.join(format!("{command}.exe"))])
            .collect()
    };
    for candidate in candidates {
        if candidate.is_file()
            && candidate
                .extension()
                .is_some_and(|ext| ext.eq_ignore_ascii_case("exe"))
        {
            return Ok(candidate);
        }
    }
    Err(error("executable"))
}
fn stream_output(
    app: tauri::AppHandle,
    id: String,
    sequence: Arc<Mutex<u64>>,
    stream: &'static str,
    mut reader: Box<dyn Read + Send>,
) -> std::thread::JoinHandle<()> {
    std::thread::spawn(move || {
        let mut buffer = [0u8; 8192];
        let mut pending = Vec::new();
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(count) => {
                    pending.extend_from_slice(&buffer[..count]);
                    loop {
                        let valid = match std::str::from_utf8(&pending) {
                            Ok(_) => pending.len(),
                            Err(e) => e.valid_up_to(),
                        };
                        if valid > 0 {
                            let data = String::from_utf8_lossy(&pending[..valid]).into_owned();
                            pending.drain(..valid);
                            emit(
                                &app,
                                &id,
                                &sequence,
                                serde_json::json!({"type":stream,"data":data}),
                            );
                        }
                        if pending.is_empty() {
                            break;
                        }
                        match std::str::from_utf8(&pending) {
                            Err(e) if e.error_len().is_some() => {
                                let len = e.error_len().unwrap_or(1);
                                pending.drain(..len);
                                emit(
                                    &app,
                                    &id,
                                    &sequence,
                                    serde_json::json!({"type":stream,"data":"�"}),
                                );
                            }
                            _ => break,
                        }
                    }
                }
                Err(e) => {
                    if !matches!(
                        e.kind(),
                        std::io::ErrorKind::BrokenPipe | std::io::ErrorKind::UnexpectedEof
                    ) {
                        crate::diagnostics::record("process", "stream-read");
                    }
                    break;
                }
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_injected_cwd_and_environment() {
        let mut r = Request {
            command: "cmd.exe".into(),
            args: vec![],
            cwd: "../escape".into(),
            environment: HashMap::new(),
            terminal_mode: "pty".into(),
            workspace_id: Some("test".into()),
        };
        assert!(validate(&r).is_err());
        r.cwd = String::new();
        assert!(validate(&r).is_ok());
        r.environment.insert("A=B".into(), "value".into());
        assert!(validate(&r).is_err());
    }
    #[test]
    fn output_process_has_separate_streams_and_exit_code() {
        let temp = tempfile::tempdir().unwrap();
        let request = Request {
            command: "cmd.exe".into(),
            args: vec![
                "/D".into(),
                "/C".into(),
                "echo native-output & echo native-error 1>&2 & exit /b 7".into(),
            ],
            cwd: String::new(),
            environment: HashMap::new(),
            terminal_mode: "output".into(),
            workspace_id: None,
        };
        let mut result = launch(request, temp.path()).unwrap();
        let output = result
            .readers
            .drain(..)
            .map(|(name, mut reader)| {
                let mut value = String::new();
                reader.read_to_string(&mut value).unwrap();
                (name, value)
            })
            .collect::<Vec<_>>();
        assert!(output[0].1.contains("native-output"));
        assert!(output[1].1.contains("native-error"));
        assert_eq!(result.child.wait().unwrap().exit_code(), 7);
    }
    #[test]
    fn conpty_runs_command_resizes_and_terminates() {
        let temp = tempfile::tempdir().unwrap();
        let request = Request {
            command: "cmd.exe".into(),
            args: vec!["/D".into(), "/C".into(), "echo NATIVE_PTY_VERIFIED".into()],
            cwd: String::new(),
            environment: HashMap::new(),
            terminal_mode: "pty".into(),
            workspace_id: None,
        };
        let mut result = launch(request, temp.path()).unwrap();
        let job = ProcessJob::attach(result.child.as_raw_handle().unwrap()).unwrap();
        result
            .master
            .as_ref()
            .unwrap()
            .resize(PtySize {
                rows: 30,
                cols: 120,
                pixel_width: 0,
                pixel_height: 0,
            })
            .unwrap();
        assert_eq!(
            result.master.as_ref().unwrap().get_size().unwrap().cols,
            120
        );
        let (_, mut reader) = result.readers.remove(0);
        let mut terminal_writer = result.writer.take().unwrap();
        let read = std::thread::spawn(move || {
            let mut bytes = Vec::new();
            let mut buffer = [0u8; 4096];
            loop {
                let count = reader.read(&mut buffer).unwrap_or(0);
                if count == 0 {
                    break;
                }
                bytes.extend_from_slice(&buffer[..count]);
                // ConPTY requests the initial terminal cursor (xterm handles this in UI).
                if bytes.windows(4).any(|w| w == b"\x1b[6n") {
                    let _ = terminal_writer.write_all(b"\x1b[1;1R");
                    let _ = terminal_writer.flush();
                }
            }
            bytes
        });
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        while result.child.try_wait().unwrap().is_none() {
            if std::time::Instant::now() > deadline {
                job.terminate();
                panic!("PTY command timed out");
            }
            std::thread::sleep(Duration::from_millis(20));
        }
        job.terminate();
        drop(result.writer);
        drop(result.master);
        assert!(String::from_utf8_lossy(&read.join().unwrap()).contains("NATIVE_PTY_VERIFIED"));
    }
}
