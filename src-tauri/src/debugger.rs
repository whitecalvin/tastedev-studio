#[path = "debugger_python.rs"]
mod python;
#[path = "debugger_source_map.rs"]
mod source_map;
use crate::filesystem::{error, resolve, Result, Workspaces};
#[cfg(windows)]
use crate::job::ProcessJob;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{BufRead, BufReader, Read},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, SyncSender},
        Arc, Condvar, Mutex,
    },
    thread,
    time::{Duration, Instant},
};
use tungstenite::{protocol::WebSocketConfig, Message};
pub type Emit = Arc<dyn Fn(Value) + Send + Sync>;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Start {
    pub session_id: String,
    pub workspace_id: String,
    pub path: String,
    pub expected_hash: String,
    #[serde(default)]
    pub args: Vec<String>,
    pub runtime: Option<String>,
    pub python_path: Option<String>,
    pub adapter_path: Option<String>,
    pub binary_path: Option<String>,
    pub expected_binary_hash: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Action {
    pub session_id: String,
    pub workspace_id: String,
    pub action: String,
    pub path: Option<String>,
    pub line: Option<u32>,
    pub breakpoint_id: Option<String>,
    pub object_id: Option<String>,
    pub condition: Option<String>,
    pub log_message: Option<String>,
}
#[derive(Clone)]
struct Internal {
    action: String,
    path: Option<PathBuf>,
    line: Option<u32>,
    breakpoint_id: Option<String>,
    object_id: Option<String>,
    condition: Option<String>,
    log_message: Option<String>,
}
struct Session {
    workspace: String,
    root: PathBuf,
    cancel: Arc<AtomicBool>,
    commands: SyncSender<Internal>,
    done: (Mutex<bool>, Condvar),
    join: Mutex<Option<thread::JoinHandle<()>>>,
}
#[derive(Default)]
pub struct Debuggers {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    cancelled: Mutex<HashSet<String>>,
    updating: AtomicBool,
}
fn identity(value: &str) -> Result<()> {
    uuid::Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| error("invalid"))
}
fn script(root: &Path, path: &str) -> Result<PathBuf> {
    let file = resolve(root, path, false)?;
    if !file.is_file()
        || !matches!(
            file.extension().and_then(|e| e.to_str()),
            Some("js" | "cjs" | "mjs" | "ts" | "cts" | "mts" | "py" | "rs")
        )
    {
        return Err(error("debug-file"));
    }
    Ok(file)
}
impl Debuggers {
    pub fn start(&self, request: Start, workspaces: &Workspaces, emit: Emit) -> Result<()> {
        identity(&request.session_id)?;
        if request.args.len() > 32
            || request
                .args
                .iter()
                .any(|a| a.len() > 1024 || a.contains(['\0', '\n', '\r']))
        {
            return Err(error("invalid"));
        }
        let root = workspaces.root(&request.workspace_id)?;
        let file = script(&root, &request.path)?;
        if !matches!(
            request.runtime.as_deref(),
            None | Some("node" | "python" | "rust")
        ) {
            return Err(error("invalid"));
        }
        let rust_target = if request.runtime.as_deref() == Some("rust") {
            if file.extension().and_then(|e| e.to_str()) != Some("rs") {
                return Err(error("debug-file"));
            }
            let adapter = python::rust_adapter(
                request
                    .adapter_path
                    .as_deref()
                    .ok_or_else(|| error("debug-adapter"))?,
            )?;
            let binary = resolve(
                &root,
                request
                    .binary_path
                    .as_deref()
                    .ok_or_else(|| error("debug-file"))?,
                false,
            )?;
            if !binary.is_file()
                || binary.extension().and_then(|e| e.to_str()) != Some("exe")
                || fs::metadata(&binary)?.len() > 8 * 1024 * 1024
            {
                return Err(error("debug-file"));
            }
            let hash = request
                .expected_binary_hash
                .as_deref()
                .ok_or_else(|| error("conflict"))?;
            if hash != format!("{:x}", Sha256::digest(fs::read(&binary)?)) {
                return Err(error("conflict"));
            }
            Some((adapter, binary, hash.to_string()))
        } else {
            None
        };
        let interpreter = if request.runtime.as_deref() == Some("python") {
            if file.extension().and_then(|e| e.to_str()) != Some("py") {
                return Err(error("debug-file"));
            }
            Some(python::interpreter(
                request
                    .python_path
                    .as_deref()
                    .ok_or_else(|| error("debug-python"))?,
            )?)
        } else {
            if matches!(file.extension().and_then(|e| e.to_str()), Some("py" | "rs"))
                && rust_target.is_none()
            {
                return Err(error("debug-file"));
            }
            None
        };
        if fs::metadata(&file)?.len() > 2 * 1024 * 1024 {
            return Err(error("large"));
        }
        if request.expected_hash != format!("{:x}", Sha256::digest(fs::read(&file)?)) {
            return Err(error("conflict"));
        }
        let mut sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        if self.updating.load(Ordering::SeqCst) {
            return Err(error("workspace-busy"));
        }
        if self
            .cancelled
            .lock()
            .map_err(|_| error("internal"))?
            .remove(&request.session_id)
        {
            return Err(error("cancelled"));
        }
        sessions.retain(|_, s| !s.done.0.lock().map(|done| *done).unwrap_or(false));
        if !sessions.is_empty() {
            return Err(error("debug-busy"));
        }
        let (tx, rx) = mpsc::sync_channel(16);
        let session = Arc::new(Session {
            workspace: request.workspace_id.clone(),
            root: root.clone(),
            cancel: Arc::new(AtomicBool::new(false)),
            commands: tx,
            done: (Mutex::new(false), Condvar::new()),
            join: Mutex::new(None),
        });
        sessions.insert(request.session_id.clone(), session.clone());
        let worker = session.clone();
        let id = request.session_id.clone();
        let join = thread::spawn(move || {
            let mut sequence = 0u64;
            let publish = |sequence: &mut u64, kind: &str, data: Value| {
                *sequence += 1;
                emit(
                    json!({"sessionId":id,"workspaceId":request.workspace_id,"sequence":sequence,"type":kind,"data":data}),
                );
            };
            publish(&mut sequence, "starting", json!({"path":request.path}));
            let result = if let Some((adapter, program, hash)) = rust_target {
                python::run_rust(
                    &root,
                    &file,
                    (&adapter, &program, &hash),
                    &request.args,
                    &worker.cancel,
                    rx,
                    |kind, data| publish(&mut sequence, kind, data),
                )
            } else if let Some(interpreter) = interpreter {
                python::run(
                    &root,
                    &file,
                    &interpreter,
                    &request.args,
                    &worker.cancel,
                    rx,
                    |kind, data| publish(&mut sequence, kind, data),
                )
            } else {
                run(
                    &root,
                    &file,
                    &request.args,
                    &worker.cancel,
                    rx,
                    |kind, data| publish(&mut sequence, kind, data),
                )
            };
            match result {
                Ok(code) => publish(
                    &mut sequence,
                    if worker.cancel.load(Ordering::SeqCst) {
                        "stopped"
                    } else {
                        "exited"
                    },
                    json!({"exitCode":code}),
                ),
                Err(_) => publish(
                    &mut sequence,
                    if worker.cancel.load(Ordering::SeqCst) {
                        "stopped"
                    } else {
                        "failed"
                    },
                    json!({"reason":"Debug session failed; check Node, saved source and workspace access."}),
                ),
            };
            if let Ok(mut done) = worker.done.0.lock() {
                *done = true;
                worker.done.1.notify_all();
            }
        });
        *session.join.lock().map_err(|_| error("internal"))? = Some(join);
        Ok(())
    }
    pub fn action(&self, request: Action) -> Result<()> {
        identity(&request.session_id)?;
        let sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        let session = sessions
            .get(&request.session_id)
            .ok_or_else(|| error("debug-session"))?;
        if session.workspace != request.workspace_id
            || *session.done.0.lock().map_err(|_| error("internal"))?
        {
            return Err(error("debug-session"));
        }
        if ![
            "continue",
            "pause",
            "step-over",
            "step-into",
            "step-out",
            "set-breakpoint",
            "remove-breakpoint",
            "variables",
        ]
        .contains(&request.action.as_str())
        {
            return Err(error("debug-permission"));
        }
        let file = if request.action == "set-breakpoint" {
            let line = request.line.ok_or_else(|| error("invalid"))?;
            if !(1..=100000).contains(&line) {
                return Err(error("invalid"));
            }
            Some(script(
                &session.root,
                request.path.as_deref().ok_or_else(|| error("invalid"))?,
            )?)
        } else {
            None
        };
        for value in [&request.condition, &request.log_message] {
            if value
                .as_ref()
                .is_some_and(|v| v.len() > 2048 || v.contains(['\0', '\n', '\r']))
            {
                return Err(error("invalid"));
            }
        }
        for value in [&request.object_id, &request.breakpoint_id]
            .into_iter()
            .flatten()
        {
            if value.len() > 2048 || value.contains('\0') {
                return Err(error("invalid"));
            }
        }
        session
            .commands
            .try_send(Internal {
                action: request.action,
                path: file,
                line: request.line,
                breakpoint_id: request.breakpoint_id,
                object_id: request.object_id,
                condition: request.condition,
                log_message: request.log_message,
            })
            .map_err(|_| error("debug-busy"))
    }
    pub fn stop(&self, id: &str, workspace: &str) -> Result<()> {
        identity(id)?;
        let session = {
            let sessions = self.sessions.lock().map_err(|_| error("internal"))?;
            sessions.get(id).cloned()
        };
        if let Some(session) = session {
            if session.workspace != workspace {
                return Err(error("debug-session"));
            }
            session.cancel.store(true, Ordering::SeqCst);
            let done = session.done.0.lock().map_err(|_| error("internal"))?;
            let (done, timeout) = session
                .done
                .1
                .wait_timeout_while(done, Duration::from_secs(8), |done| !*done)
                .map_err(|_| error("internal"))?;
            if timeout.timed_out() && !*done {
                return Err(error("debug-timeout"));
            }
            drop(done);
            if let Some(join) = session.join.lock().map_err(|_| error("internal"))?.take() {
                join.join().map_err(|_| error("internal"))?;
            }
            let mut sessions = self.sessions.lock().map_err(|_| error("internal"))?;
            if sessions
                .get(id)
                .is_some_and(|current| Arc::ptr_eq(current, &session))
            {
                sessions.remove(id);
            }
        } else {
            let mut cancelled = self.cancelled.lock().map_err(|_| error("internal"))?;
            if cancelled.len() >= 64 {
                return Err(error("debug-busy"));
            }
            cancelled.insert(id.to_owned());
        }
        Ok(())
    }
    pub fn stop_all(&self) {
        let rows = self
            .sessions
            .lock()
            .map(|s| {
                s.iter()
                    .map(|(id, s)| (id.clone(), s.workspace.clone()))
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        for (id, workspace) in rows {
            if self.stop(&id, &workspace).is_err() {
                crate::diagnostics::record("cleanup", "debug-stop");
            }
        }
    }
    pub fn prepare_update(&self) -> Result<()> {
        let sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        if sessions
            .values()
            .any(|s| !s.done.0.lock().map(|v| *v).unwrap_or(false))
        {
            return Err(error("workspace-busy"));
        }
        self.updating.store(true, Ordering::SeqCst);
        Ok(())
    }
    pub fn cancel_update(&self) {
        self.updating.store(false, Ordering::SeqCst);
    }
}
fn inspector_endpoint(line: &str) -> Result<(String, SocketAddr)> {
    let raw = line
        .strip_prefix("Debugger listening on ")
        .ok_or_else(|| error("debug-endpoint"))?
        .trim();
    let url = reqwest::Url::parse(raw).map_err(|_| error("debug-endpoint"))?;
    if url.scheme() != "ws"
        || url.host_str() != Some("127.0.0.1")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
        || uuid::Uuid::parse_str(url.path().trim_start_matches('/')).is_err()
    {
        return Err(error("debug-endpoint"));
    }
    let port = url
        .port()
        .filter(|p| *p > 0)
        .ok_or_else(|| error("debug-endpoint"))?;
    Ok((raw.to_owned(), SocketAddr::from(([127, 0, 0, 1], port))))
}
fn source_path(root: &Path, url: &str) -> Option<String> {
    let raw = if url.starts_with("file:") {
        reqwest::Url::parse(url).ok()?.to_file_path().ok()?
    } else {
        let path = PathBuf::from(url);
        if !path.is_absolute() {
            return None;
        }
        path
    };
    let file = raw.canonicalize().ok()?;
    let relative = file.strip_prefix(root).ok()?.to_str()?.replace('\\', "/");
    let verified = resolve(root, &relative, false).ok()?;
    (verified == file).then_some(relative)
}
fn regex_escape(value: &str) -> String {
    value
        .chars()
        .flat_map(|c| {
            if "\\.^$|?*+()[]{}".contains(c) {
                vec!['\\', c]
            } else {
                vec![c]
            }
        })
        .collect()
}
fn breakpoint_condition(condition: Option<&str>, log: Option<&str>) -> String {
    let condition = condition.filter(|v| !v.trim().is_empty()).unwrap_or("true");
    if let Some(message) = log.filter(|v| !v.is_empty()) {
        format!(
            "(()=>{{if({condition})console.log({});return false;}})()",
            json!(message)
        )
    } else {
        condition.to_owned()
    }
}
fn safe_value(value: &Value) -> Value {
    let mut out = value.clone();
    if out.to_string().len() > 4096 {
        out = json!({"type":value["type"],"description":"Value exceeds display limit."});
    }
    out
}
fn run(
    root: &Path,
    file: &Path,
    args: &[String],
    cancel: &AtomicBool,
    commands: mpsc::Receiver<Internal>,
    mut emit: impl FnMut(&str, Value),
) -> Result<Option<i32>> {
    let mut command = Command::new("node");
    command
        .arg("--inspect-brk=127.0.0.1:0")
        .arg("--enable-source-maps")
        .arg(crate::filesystem::display_path(file))
        .args(args)
        .current_dir(crate::filesystem::display_path(root))
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env_clear();
    for key in [
        "PATH",
        "SystemRoot",
        "WINDIR",
        "TEMP",
        "TMP",
        "HOME",
        "USERPROFILE",
        "PATHEXT",
    ] {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| error("debug-node"))?;
    #[cfg(windows)]
    let job = {
        use std::os::windows::io::AsRawHandle;
        match ProcessJob::attach(child.as_raw_handle()) {
            Ok(job) => job,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        }
    };
    let (tx, rx) = mpsc::sync_channel::<(bool, String)>(32);
    let mut readers = vec![];
    for (stderr, pipe) in [
        (
            false,
            Box::new(child.stdout.take().ok_or_else(|| error("internal"))?) as Box<dyn Read + Send>,
        ),
        (
            true,
            Box::new(child.stderr.take().ok_or_else(|| error("internal"))?) as Box<dyn Read + Send>,
        ),
    ] {
        let tx = tx.clone();
        readers.push(thread::spawn(move || {
            let mut reader = BufReader::new(pipe);
            loop {
                let mut bytes = Vec::new();
                let read = reader.by_ref().take(4096).read_until(b'\n', &mut bytes);
                match read {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {
                        let text = String::from_utf8_lossy(&bytes).into_owned();
                        let _ = tx.try_send((stderr, text));
                    }
                }
            }
        }));
    }
    drop(tx);
    let result = (|| -> Result<Option<i32>> {
        let deadline = Instant::now() + Duration::from_secs(5);
        let endpoint = loop {
            if cancel.load(Ordering::SeqCst) {
                return Ok(None);
            }
            if Instant::now() > deadline {
                return Err(error("debug-timeout"));
            }
            if let Ok((stderr, text)) = rx.recv_timeout(Duration::from_millis(25)) {
                if stderr && text.starts_with("Debugger listening on ") {
                    break inspector_endpoint(text.trim())?;
                }
                emit(
                    "output",
                    json!({"stream":if stderr{"stderr"}else{"stdout"},"text":text}),
                );
            }
            if child.try_wait()?.is_some() {
                return Err(error("debug-node"));
            }
        };
        let stream = TcpStream::connect_timeout(&endpoint.1, Duration::from_secs(2))?;
        stream.set_read_timeout(Some(Duration::from_millis(25)))?;
        stream.set_write_timeout(Some(Duration::from_secs(2)))?;
        let config = WebSocketConfig::default()
            .max_message_size(Some(512 * 1024))
            .max_frame_size(Some(512 * 1024));
        let (mut ws, _) =
            tungstenite::client::client_with_config(endpoint.0.as_str(), stream, Some(config))
                .map_err(|_| error("debug-connect"))?;
        let mut next = 1u64;
        let mut pending = HashMap::<u64, (Internal, Instant)>::new();
        let mut scripts = HashMap::<String, String>::new();
        let mut maps = source_map::SourceMaps::new();
        maps.load(root, file);
        let mut objects = HashSet::<String>::new();
        let mut breakpoints = HashSet::<String>::new();
        let mut paused = false;
        for method in ["Runtime.enable", "Debugger.enable"] {
            ws.send(Message::Text(
                json!({"id":next,"method":method}).to_string().into(),
            ))
            .map_err(|_| error("debug-connect"))?;
            next += 1;
        }
        emit(
            "ready",
            json!({"path":file.strip_prefix(root).ok().and_then(|p|p.to_str()).unwrap_or("").replace('\\',"/")}),
        );
        loop {
            if cancel.load(Ordering::SeqCst) {
                let _ = ws.close(None);
                return Ok(None);
            }
            let mut ending = false;
            while let Ok((stderr, text)) = rx.try_recv() {
                if stderr && text.trim() == "Waiting for the debugger to disconnect..." {
                    ending = true;
                } else if !text.starts_with("For help, see:") {
                    emit(
                        "output",
                        json!({"stream":if stderr{"stderr"}else{"stdout"},"text":text}),
                    );
                }
            }
            if ending {
                let _ = ws.close(None);
                let finish = Instant::now() + Duration::from_secs(2);
                loop {
                    if let Some(status) = child.try_wait()? {
                        return Ok(status.code());
                    }
                    if Instant::now() > finish {
                        return Err(error("debug-timeout"));
                    }
                    thread::sleep(Duration::from_millis(10));
                }
            }
            if let Some(status) = child.try_wait()? {
                let _ = ws.close(None);
                return Ok(status.code());
            }
            while let Ok(action) = commands.try_recv() {
                if pending.len() >= 16
                    || (action.action == "set-breakpoint"
                        && breakpoints.len()
                            + pending
                                .values()
                                .filter(|(request, _)| request.action == "set-breakpoint")
                                .count()
                            >= 100)
                {
                    emit(
                        "operation-error",
                        json!({"reason":"Debug request limit reached."}),
                    );
                    continue;
                }
                let proposal = match action.action.as_str() {
                    "continue" => (
                        if paused {
                            "Debugger.resume"
                        } else {
                            "Runtime.runIfWaitingForDebugger"
                        },
                        json!({}),
                    ),
                    "pause" => ("Debugger.pause", json!({})),
                    "step-over" | "step-into" | "step-out" if paused => (
                        match action.action.as_str() {
                            "step-over" => "Debugger.stepOver",
                            "step-into" => "Debugger.stepInto",
                            _ => "Debugger.stepOut",
                        },
                        json!({}),
                    ),
                    "set-breakpoint" => {
                        let path = action.path.clone().ok_or_else(|| error("invalid"))?;
                        let original_line = action.line.ok_or_else(|| error("invalid"))? - 1;
                        let relative = path
                            .strip_prefix(root)
                            .ok()
                            .and_then(|p| p.to_str())
                            .map(|p| p.replace('\\', "/"))
                            .ok_or_else(|| error("debug-file"))?;
                        let (path, line, column) = if let Some((generated, line, column)) =
                            maps.generated(&relative, original_line)
                        {
                            (resolve(root, &generated, false)?, line, column)
                        } else {
                            (path, original_line, 0)
                        };
                        let path = PathBuf::from(crate::filesystem::display_path(&path));
                        let url =
                            reqwest::Url::from_file_path(&path).map_err(|_| error("invalid"))?;
                        (
                            "Debugger.setBreakpointByUrl",
                            json!({"urlRegex":format!("^(?:{}|{})$", regex_escape(url.as_str()), regex_escape(&crate::filesystem::display_path(&path))),"lineNumber":line,"columnNumber":column,"condition":breakpoint_condition(action.condition.as_deref(),action.log_message.as_deref())}),
                        )
                    }
                    "remove-breakpoint"
                        if action
                            .breakpoint_id
                            .as_ref()
                            .is_some_and(|id| breakpoints.contains(id)) =>
                    {
                        (
                            "Debugger.removeBreakpoint",
                            json!({"breakpointId":action.breakpoint_id}),
                        )
                    }
                    "variables"
                        if paused
                            && action
                                .object_id
                                .as_ref()
                                .is_some_and(|id| objects.contains(id)) =>
                    {
                        (
                            "Runtime.getProperties",
                            json!({"objectId":action.object_id,"ownProperties":true,"generatePreview":false}),
                        )
                    }
                    _ => {
                        emit(
                            "operation-error",
                            json!({"reason":"Debug action is not valid for this session or pause."}),
                        );
                        continue;
                    }
                };
                pending.insert(next, (action, Instant::now()));
                ws.send(Message::Text(
                    json!({"id":next,"method":proposal.0,"params":proposal.1})
                        .to_string()
                        .into(),
                ))
                .map_err(|_| error("debug-connect"))?;
                next += 1;
            }
            let expired: Vec<_> = pending
                .iter()
                .filter(|(_, (_, started))| started.elapsed() > Duration::from_secs(5))
                .map(|(id, _)| *id)
                .collect();
            for id in expired {
                pending.remove(&id);
                emit(
                    "operation-error",
                    json!({"reason":"Node Inspector request timed out."}),
                );
            }
            match ws.read() {
                Ok(Message::Text(raw)) => {
                    let message: Value =
                        serde_json::from_str(&raw).map_err(|_| error("debug-response"))?;
                    if let Some(id) = message["id"].as_u64() {
                        if let Some((request, _started)) = pending.remove(&id) {
                            let action = &request.action;
                            if message["error"].is_object() {
                                emit(
                                    "operation-error",
                                    json!({"action":action,"reason":"Node Inspector rejected this action."}),
                                );
                                continue;
                            }
                            let data = &message["result"];
                            if action == "set-breakpoint" {
                                if let Some(id) = data["breakpointId"].as_str() {
                                    if breakpoints.len() < 100 {
                                        breakpoints.insert(id.to_owned());
                                    }
                                    emit(
                                        "breakpoint",
                                        json!({"breakpointId":id,"locations":data["locations"],"path":request.path.as_ref().and_then(|p|p.strip_prefix(root).ok()).and_then(|p|p.to_str()).map(|p|p.replace('\\',"/")),"line":request.line}),
                                    );
                                }
                            } else if action == "remove-breakpoint" {
                                if let Some(id) = request.breakpoint_id {
                                    breakpoints.remove(&id);
                                    emit("breakpoint-removed", json!({"breakpointId":id}));
                                }
                            } else if action == "variables" {
                                let values=data["result"].as_array().map(|items|items.iter().take(100).map(|item|{if let Some(id)=item["value"]["objectId"].as_str(){if objects.len()<2048{objects.insert(id.to_owned());}}json!({"name":item["name"],"value":safe_value(&item["value"]),"getter":item.get("get").is_some(),"readOnly":true})}).collect::<Vec<_>>()).unwrap_or_default();
                                emit(
                                    "variables",
                                    json!({"objectId":request.object_id,"values":values}),
                                );
                            } else {
                                emit("action-complete", json!({"action":action}));
                            }
                        }
                    } else if message["method"] == "Debugger.scriptParsed" {
                        if scripts.len() < 500 {
                            if let (Some(id), Some(path)) = (
                                message["params"]["scriptId"].as_str(),
                                source_path(root, message["params"]["url"].as_str().unwrap_or("")),
                            ) {
                                if let Ok(file) = resolve(root, &path, false) {
                                    maps.load(root, &file);
                                }
                                scripts.insert(id.to_owned(), path);
                            }
                        }
                    } else if message["method"] == "Debugger.paused" {
                        paused = true;
                        objects.clear();
                        let frames=message["params"]["callFrames"].as_array().map(|items|items.iter().take(100).filter_map(|frame|{let path=source_path(root,frame["url"].as_str().unwrap_or("" )).or_else(||scripts.get(frame["location"]["scriptId"].as_str().unwrap_or("")).cloned())?;let scopes=frame["scopeChain"].as_array().map(|items|items.iter().take(10).filter(|scope|matches!(scope["type"].as_str(),Some("local"|"closure"|"catch"|"block"|"module"))).map(|scope|{if let Some(id)=scope["object"]["objectId"].as_str(){objects.insert(id.to_owned());}json!({"type":scope["type"],"objectId":scope["object"]["objectId"]})}).collect::<Vec<_>>()).unwrap_or_default();let line=frame["location"]["lineNumber"].as_u64().unwrap_or(0) as u32;let column=frame["location"]["columnNumber"].as_u64().unwrap_or(0) as u32;let(path,line,column)=maps.original(&path,line,column).unwrap_or((path,line,column));Some(json!({"functionName":frame["functionName"],"path":path,"line":line+1,"column":column+1,"scopes":scopes}))}).collect::<Vec<_>>()).unwrap_or_default();
                        emit(
                            "paused",
                            json!({"reason":message["params"]["reason"],"frames":frames}),
                        );
                    } else if message["method"] == "Debugger.resumed" {
                        paused = false;
                        objects.clear();
                        emit("resumed", json!({}));
                    }
                }
                Ok(Message::Close(_)) => {
                    let finish = Instant::now() + Duration::from_secs(2);
                    loop {
                        if let Some(status) = child.try_wait()? {
                            return Ok(status.code());
                        }
                        if Instant::now() > finish {
                            return Err(error("debug-timeout"));
                        }
                        thread::sleep(Duration::from_millis(10));
                    }
                }
                Ok(_) => {}
                Err(tungstenite::Error::Io(error))
                    if matches!(
                        error.kind(),
                        std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                    ) => {}
                Err(_) => return Err(error("debug-connect")),
            }
        }
    })();
    #[cfg(windows)]
    job.terminate();
    let _ = child.kill();
    let _ = child.wait();
    for reader in readers {
        let _ = reader.join();
    }
    while let Ok((stderr, text)) = rx.try_recv() {
        emit(
            "output",
            json!({"stream":if stderr{"stderr"}else{"stdout"},"text":text}),
        );
    }
    result
}
impl Drop for Debuggers {
    fn drop(&mut self) {
        self.stop_all();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn fixture() -> tempfile::TempDir {
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-4/native");
        fs::create_dir_all(&base).unwrap();
        tempfile::tempdir_in(&base).unwrap()
    }
    fn scope(dir: &Path) -> (Workspaces, String) {
        let workspaces = Workspaces::default();
        let value = serde_json::to_value(workspaces.register(dir.to_owned()).unwrap()).unwrap();
        let id = value["id"].as_str().unwrap().to_owned();
        (workspaces, id)
    }
    fn action(id: &str, workspace: &str, name: &str) -> Action {
        Action {
            session_id: id.into(),
            workspace_id: workspace.into(),
            action: name.into(),
            path: None,
            line: None,
            breakpoint_id: None,
            object_id: None,
            condition: None,
            log_message: None,
        }
    }
    fn event(rx: &mpsc::Receiver<Value>, events: &mut Vec<Value>, kind: &str) -> Value {
        let deadline = Instant::now() + Duration::from_secs(30);
        loop {
            assert!(
                Instant::now() < deadline,
                "Debug event timed out: {kind}; events: {}",
                serde_json::to_string(events).unwrap()
            );
            if let Ok(value) = rx.recv_timeout(Duration::from_millis(50)) {
                assert_ne!(value["type"], "failed", "Native debugger failed: {value}");
                events.push(value.clone());
                if value["type"] == kind {
                    return value;
                }
            }
        }
    }
    #[test]
    fn endpoint_and_source_boundaries() {
        let id = uuid::Uuid::new_v4();
        assert!(
            inspector_endpoint(&format!("Debugger listening on ws://127.0.0.1:1234/{id}")).is_ok()
        );
        for url in [
            format!("ws://192.168.0.102:1234/{id}"),
            format!("ws://localhost:1234/{id}"),
            format!("wss://127.0.0.1:1234/{id}"),
            format!("ws://user:pass@127.0.0.1:1234/{id}"),
            format!("ws://127.0.0.1:1234/{id}?x=1"),
        ] {
            assert!(inspector_endpoint(&format!("Debugger listening on {url}")).is_err());
        }
        let dir = fixture();
        fs::write(dir.path().join("main.cjs"), "console.log(1)").unwrap();
        assert!(script(&dir.path().canonicalize().unwrap(), "../outside.cjs").is_err());
        assert!(script(&dir.path().canonicalize().unwrap(), "main.cjs").is_ok());
        assert!(source_path(&dir.path().canonicalize().unwrap(), "node:internal/test").is_none());
    }
    #[test]
    fn stale_source_and_cancel_before_start_preserve_files() {
        let dir = fixture();
        fs::write(dir.path().join("main.cjs"), "user content").unwrap();
        let (workspaces, workspace) = scope(dir.path());
        let debugger = Debuggers::default();
        let id = uuid::Uuid::new_v4().to_string();
        let start = || Start {
            session_id: id.clone(),
            workspace_id: workspace.clone(),
            path: "main.cjs".into(),
            expected_hash: format!("{:x}", Sha256::digest(b"user content")),
            args: vec![],
            runtime: None,
            python_path: None,
            adapter_path: None,
            binary_path: None,
            expected_binary_hash: None,
        };
        let mut stale = start();
        stale.expected_hash = "0".repeat(64);
        assert_eq!(
            debugger
                .start(stale, &workspaces, Arc::new(|_| {}))
                .unwrap_err()
                .code,
            "conflict"
        );
        debugger.stop(&id, &workspace).unwrap();
        assert_eq!(
            debugger
                .start(start(), &workspaces, Arc::new(|_| {}))
                .unwrap_err()
                .code,
            "cancelled"
        );
        assert_eq!(
            fs::read_to_string(dir.path().join("main.cjs")).unwrap(),
            "user content"
        );
    }
    #[test]
    fn unknown_session_and_unrestricted_tools_are_not_available() {
        let debugger = Debuggers::default();
        let id = uuid::Uuid::new_v4().to_string();
        assert!(debugger
            .action(action(&id, "foreign", "Runtime.evaluate"))
            .is_err());
        assert!(serde_json::from_value::<Action>(json!({"sessionId":id,"workspaceId":"x","action":"variables","method":"Runtime.evaluate"})).is_err());
    }
    #[test]
    fn rust_binary_hash_adapter_and_project_boundaries() {
        let dir = fixture();
        fs::write(dir.path().join("main.rs"), "fn main() {}").unwrap();
        fs::write(dir.path().join("main.exe"), "controlled dummy binary").unwrap();
        fs::write(dir.path().join("codelldb.exe"), "controlled dummy adapter").unwrap();
        let (workspaces, workspace) = scope(dir.path());
        let debugger = Debuggers::default();
        let request = || Start {
            session_id: uuid::Uuid::new_v4().to_string(),
            workspace_id: workspace.clone(),
            path: "main.rs".into(),
            expected_hash: format!("{:x}", Sha256::digest(b"fn main() {}")),
            args: vec![],
            runtime: Some("rust".into()),
            python_path: None,
            adapter_path: Some(dir.path().join("codelldb.exe").to_string_lossy().into()),
            binary_path: Some("main.exe".into()),
            expected_binary_hash: Some("0".repeat(64)),
        };
        assert_eq!(
            debugger
                .start(request(), &workspaces, Arc::new(|_| {}))
                .unwrap_err()
                .code,
            "conflict"
        );
        let mut escape = request();
        escape.binary_path = Some("../outside.exe".into());
        assert!(debugger
            .start(escape, &workspaces, Arc::new(|_| {}))
            .is_err());
        let mut adapter = request();
        adapter.adapter_path = Some("codelldb.exe".into());
        assert!(debugger
            .start(adapter, &workspaces, Arc::new(|_| {}))
            .is_err());
        let (_, commands) = mpsc::sync_channel(1);
        assert_eq!(
            python::run_rust(
                dir.path(),
                &dir.path().join("main.rs"),
                (
                    &dir.path().join("codelldb.exe"),
                    &dir.path().join("main.exe"),
                    &"0".repeat(64)
                ),
                &[],
                &AtomicBool::new(false),
                commands,
                |_, _| {}
            )
            .unwrap_err()
            .code,
            "conflict"
        );
        assert!(debugger.sessions.lock().unwrap().is_empty());
        assert_eq!(
            fs::read_to_string(dir.path().join("main.rs")).unwrap(),
            "fn main() {}"
        );
    }
    #[test]
    fn actual_node_and_typescript_breakpoint_variables_steps_and_cleanup() {
        let mut scenarios = Vec::new();
        for extension in ["cjs", "ts"] {
            let dir = fixture();
            let file = "main.".to_owned() + extension;
            let content = if extension == "ts" {
                "function calculate(a: number, b: number) {\n const value = a + b;\n return value;\n}\nconst result = calculate(2, 3);\nconsole.log(result);\n"
            } else {
                "function calculate(a, b) {\n const value = a + b;\n return value;\n}\nconst result = calculate(2, 3);\nconsole.log(result);\n"
            };
            fs::write(dir.path().join(&file), content).unwrap();
            let (workspaces, workspace) = scope(dir.path());
            let debugger = Debuggers::default();
            let id = uuid::Uuid::new_v4().to_string();
            let (tx, rx) = mpsc::channel();
            let mut events = Vec::new();
            debugger
                .start(
                    Start {
                        session_id: id.clone(),
                        workspace_id: workspace.clone(),
                        path: file.clone(),
                        expected_hash: format!("{:x}", Sha256::digest(content)),
                        args: vec![],
                        runtime: None,
                        python_path: None,
                        adapter_path: None,
                        binary_path: None,
                        expected_binary_hash: None,
                    },
                    &workspaces,
                    Arc::new(move |value| {
                        let _ = tx.send(value);
                    }),
                )
                .unwrap();
            event(&rx, &mut events, "ready");
            assert_eq!(
                debugger.prepare_update().unwrap_err().code,
                "workspace-busy"
            );
            for name in [
                "Runtime.evaluate",
                "shell",
                "write_file",
                "setVariableValue",
            ] {
                assert_eq!(
                    debugger
                        .action(action(&id, &workspace, name))
                        .unwrap_err()
                        .code,
                    "debug-permission"
                );
            }
            assert!(debugger.action(action(&id, "other", "continue")).is_err());
            let mut breakpoint = action(&id, &workspace, "set-breakpoint");
            breakpoint.path = Some(file.clone());
            breakpoint.line = Some(3);
            debugger.action(breakpoint).unwrap();
            let applied = event(&rx, &mut events, "breakpoint");
            assert_eq!(applied["data"]["line"], 3);
            debugger
                .action(action(&id, &workspace, "continue"))
                .unwrap();
            let first = event(&rx, &mut events, "paused");
            assert!(!first["data"]["frames"].as_array().unwrap().is_empty());
            debugger
                .action(action(&id, &workspace, "step-into"))
                .unwrap();
            event(&rx, &mut events, "paused");
            debugger
                .action(action(&id, &workspace, "step-over"))
                .unwrap();
            let paused = event(&rx, &mut events, "paused");
            assert_eq!(paused["data"]["frames"][0]["path"], file);
            let object = paused["data"]["frames"][0]["scopes"][0]["objectId"]
                .as_str()
                .unwrap()
                .to_owned();
            let mut variables = action(&id, &workspace, "variables");
            variables.object_id = Some(object.clone());
            debugger.action(variables).unwrap();
            let properties = event(&rx, &mut events, "variables");
            assert!(properties["data"]["values"]
                .as_array()
                .unwrap()
                .iter()
                .any(|v| v["name"] == "value" && v["value"]["value"] == 5));
            let mut foreign = action(&id, &workspace, "variables");
            foreign.object_id = Some("foreign-object".into());
            debugger.action(foreign).unwrap();
            event(&rx, &mut events, "operation-error");
            debugger
                .action(action(&id, &workspace, "step-out"))
                .unwrap();
            event(&rx, &mut events, "paused");
            let mut remove = action(&id, &workspace, "remove-breakpoint");
            remove.breakpoint_id = applied["data"]["breakpointId"].as_str().map(str::to_owned);
            debugger.action(remove).unwrap();
            event(&rx, &mut events, "breakpoint-removed");
            debugger
                .action(action(&id, &workspace, "continue"))
                .unwrap();
            let end = event(&rx, &mut events, "exited");
            assert_eq!(end["data"]["exitCode"], 0);
            debugger.stop(&id, &workspace).unwrap();
            assert_eq!(fs::read_to_string(dir.path().join(&file)).unwrap(), content);
            debugger.prepare_update().unwrap();
            debugger.cancel_update();
            scenarios.push(json!({"extension":extension,"result":"PASS","events":events,"sourceUnchanged":true,"ownedProcessCleaned":true}));
        }
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-4");
        let name = if cfg!(debug_assertions) {
            "ACTUAL-NODE-DEBUG-DEV.json"
        } else {
            "ACTUAL-NODE-DEBUG-PROD.json"
        };
        fs::write(base.join(name),serde_json::to_vec_pretty(&json!({"result":"PASS","actualNode":true,"actualNativeRustHost":true,"scenarios":scenarios})).unwrap()).unwrap();
    }
    #[test]
    fn stop_while_waiting_for_debugger_reaps_owned_program() {
        let dir = fixture();
        let content = "setInterval(()=>{},1000);\n";
        fs::write(dir.path().join("main.cjs"), content).unwrap();
        let (workspaces, workspace) = scope(dir.path());
        let debugger = Debuggers::default();
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = mpsc::channel();
        debugger
            .start(
                Start {
                    session_id: id.clone(),
                    workspace_id: workspace.clone(),
                    path: "main.cjs".into(),
                    expected_hash: format!("{:x}", Sha256::digest(content)),
                    args: vec![],
                    runtime: None,
                    python_path: None,
                    adapter_path: None,
                    binary_path: None,
                    expected_binary_hash: None,
                },
                &workspaces,
                Arc::new(move |value| {
                    let _ = tx.send(value);
                }),
            )
            .unwrap();
        let mut events = vec![];
        event(&rx, &mut events, "ready");
        debugger.stop(&id, &workspace).unwrap();
        event(&rx, &mut events, "stopped");
        assert!(debugger.prepare_update().is_ok());
        assert_eq!(
            fs::read_to_string(dir.path().join("main.cjs")).unwrap(),
            content
        );
    }
    #[test]
    #[ignore = "Actual trusted local Python/debugpy, disposable source only"]
    fn actual_python_conditional_logpoint_variables_and_cleanup() {
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/sixth-advancement/phase-2/native-python");
        fs::create_dir_all(&base).unwrap();
        let dir = tempfile::tempdir_in(&base).unwrap();
        let source="def calculate(a,b):\n    value=a+b\n    return value\nresult=calculate(2,3)\nprint(result)\n";
        fs::write(dir.path().join("main.py"), source).unwrap();
        let (workspaces, workspace) = scope(dir.path());
        let debugger = Debuggers::default();
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = mpsc::channel();
        let mut events = Vec::new();
        debugger
            .start(
                Start {
                    session_id: id.clone(),
                    workspace_id: workspace.clone(),
                    path: "main.py".into(),
                    expected_hash: format!("{:x}", Sha256::digest(source.as_bytes())),
                    args: vec![],
                    runtime: Some("python".into()),
                    python_path: Some("C:/Users/whitecalvin/anaconda3/python.exe".into()),
                    adapter_path: None,
                    binary_path: None,
                    expected_binary_hash: None,
                },
                &workspaces,
                Arc::new(move |value| {
                    let _ = tx.send(value);
                }),
            )
            .unwrap();
        event(&rx, &mut events, "ready");
        event(&rx, &mut events, "paused");
        let mut point = action(&id, &workspace, "set-breakpoint");
        point.path = Some("main.py".into());
        point.line = Some(3);
        point.condition = Some("value == 5".into());
        debugger.action(point).unwrap();
        assert_eq!(
            event(&rx, &mut events, "breakpoint")["data"]["verified"],
            true
        );
        let mut log = action(&id, &workspace, "set-breakpoint");
        log.path = Some("main.py".into());
        log.line = Some(5);
        log.log_message = Some("PY_CONTROLLED_LOG".into());
        debugger.action(log).unwrap();
        event(&rx, &mut events, "breakpoint");
        debugger
            .action(action(&id, &workspace, "continue"))
            .unwrap();
        let paused = event(&rx, &mut events, "paused");
        assert_eq!(paused["data"]["frames"][0]["path"], "main.py");
        assert_eq!(paused["data"]["frames"][0]["line"], 3);
        let mut variables = action(&id, &workspace, "variables");
        variables.object_id = paused["data"]["frames"][0]["scopes"][0]["objectId"]
            .as_str()
            .map(str::to_owned);
        debugger.action(variables).unwrap();
        let values = event(&rx, &mut events, "variables");
        assert!(values["data"]["values"]
            .as_array()
            .unwrap()
            .iter()
            .any(|value| value["name"] == "value" && value["value"] == "5"));
        debugger
            .action(action(&id, &workspace, "continue"))
            .unwrap();
        let exited = event(&rx, &mut events, "exited");
        assert_eq!(exited["data"]["exitCode"], 0);
        assert!(events.iter().any(|e| e["type"] == "output"
            && e["data"]["text"]
                .as_str()
                .is_some_and(|text| text.contains("PY_CONTROLLED_LOG"))));
        debugger.stop(&id, &workspace).unwrap();
        assert_eq!(
            fs::read_to_string(dir.path().join("main.py")).unwrap(),
            source
        );
        assert!(debugger.sessions.lock().unwrap().is_empty());
        let evidence=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/sixth-advancement/phase-2/ACTUAL-PYTHON-DEBUG.json");
        fs::write(evidence,serde_json::to_string_pretty(&json!({"result":"PASS","events":events,"sourceChanged":false,"ownedSessionsRemaining":0})).unwrap()).unwrap();
    }
    #[test]
    fn actual_source_map_conditional_breakpoint_and_logpoint() {
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/phase-2/native-node-map");
        fs::create_dir_all(&base).unwrap();
        let dir = tempfile::tempdir_in(&base).unwrap();
        fs::create_dir(dir.path().join("dist")).unwrap();
        fs::create_dir(dir.path().join("src")).unwrap();
        let original="function calculate(a:number,b:number){\n const value=a+b;\n return value;\n}\nconst result=calculate(2,3);\nconsole.log(result);\n";
        let generated="'use strict';\nfunction calculate(a,b){\n const value=a+b;\n return value;\n}\nconst result=calculate(2,3);\nconsole.log(result);\n//# sourceMappingURL=main.js.map\n";
        fs::write(dir.path().join("src/main.ts"), original).unwrap();
        fs::write(dir.path().join("dist/main.js"), generated).unwrap();
        fs::write(dir.path().join("dist/main.js.map"),json!({"version":3,"sources":["../src/main.ts"],"names":[],"mappings":";AAAA;AACA;AACA;AACA;AACA;AACA"}).to_string()).unwrap();
        let (workspaces, workspace) = scope(dir.path());
        let debugger = Debuggers::default();
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = mpsc::channel();
        let mut events = Vec::new();
        debugger
            .start(
                Start {
                    session_id: id.clone(),
                    workspace_id: workspace.clone(),
                    path: "dist/main.js".into(),
                    expected_hash: format!("{:x}", Sha256::digest(generated.as_bytes())),
                    args: vec![],
                    runtime: Some("node".into()),
                    python_path: None,
                    adapter_path: None,
                    binary_path: None,
                    expected_binary_hash: None,
                },
                &workspaces,
                Arc::new(move |value| {
                    let _ = tx.send(value);
                }),
            )
            .unwrap();
        event(&rx, &mut events, "ready");
        debugger
            .action(action(&id, &workspace, "continue"))
            .unwrap();
        let first = event(&rx, &mut events, "paused");
        assert_eq!(first["data"]["frames"][0]["path"], "src/main.ts");
        let mut point = action(&id, &workspace, "set-breakpoint");
        point.path = Some("src/main.ts".into());
        point.line = Some(3);
        point.condition = Some("value === 5".into());
        debugger.action(point).unwrap();
        event(&rx, &mut events, "breakpoint");
        let mut log = action(&id, &workspace, "set-breakpoint");
        log.path = Some("src/main.ts".into());
        log.line = Some(6);
        log.log_message = Some("JS_CONTROLLED_LOG".into());
        debugger.action(log).unwrap();
        event(&rx, &mut events, "breakpoint");
        debugger
            .action(action(&id, &workspace, "continue"))
            .unwrap();
        let paused = event(&rx, &mut events, "paused");
        assert_eq!(paused["data"]["frames"][0]["path"], "src/main.ts");
        assert_eq!(paused["data"]["frames"][0]["line"], 3);
        debugger
            .action(action(&id, &workspace, "continue"))
            .unwrap();
        assert_eq!(event(&rx, &mut events, "exited")["data"]["exitCode"], 0);
        assert!(events.iter().any(|e| e["type"] == "output"
            && e["data"]["text"]
                .as_str()
                .is_some_and(|text| text.contains("JS_CONTROLLED_LOG"))));
        debugger.stop(&id, &workspace).unwrap();
        assert!(debugger.sessions.lock().unwrap().is_empty());
        assert_eq!(
            fs::read_to_string(dir.path().join("src/main.ts")).unwrap(),
            original
        );
        let evidence = base.parent().unwrap().join("ACTUAL-SOURCE-MAP-DEBUG.json");
        fs::write(evidence,serde_json::to_string_pretty(&json!({"result":"PASS","events":events,"sourceChanged":false,"ownedSessionsRemaining":0})).unwrap()).unwrap();
    }
    #[test]
    #[ignore = "Actual official CodeLLDB and trusted rustc, disposable source"]
    fn actual_rust_breakpoints_variables_steps_and_cleanup() {
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/sixth-advancement/phase-2");
        let dir = tempfile::tempdir_in(&base).unwrap();
        let source = "fn main() {\n let value=5;\n println!(\"{}\",value);\n}\n";
        fs::write(dir.path().join("main.rs"), source).unwrap();
        let compiled = Command::new("C:/Users/whitecalvin/.cargo/bin/rustc.exe")
            .args([
                "-C",
                "debuginfo=2",
                "-C",
                "opt-level=0",
                "main.rs",
                "-o",
                "main.exe",
            ])
            .current_dir(dir.path())
            .status()
            .unwrap();
        assert!(compiled.success());
        let workspaces = Workspaces::default();
        let workspace = uuid::Uuid::new_v4().to_string();
        workspaces
            .roots
            .lock()
            .unwrap()
            .insert(workspace.clone(), dir.path().canonicalize().unwrap());
        let debugger = Debuggers::default();
        let id = uuid::Uuid::new_v4().to_string();
        let (tx, rx) = mpsc::channel();
        let mut events = Vec::new();
        let hash = format!(
            "{:x}",
            Sha256::digest(fs::read(dir.path().join("main.exe")).unwrap())
        );
        debugger
            .start(
                Start {
                    session_id: id.clone(),
                    workspace_id: workspace.clone(),
                    path: "main.rs".into(),
                    expected_hash: format!("{:x}", Sha256::digest(source)),
                    args: vec![],
                    runtime: Some("rust".into()),
                    python_path: None,
                    adapter_path: Some(
                        base.join("tools/extension/adapter/codelldb.exe")
                            .to_string_lossy()
                            .into(),
                    ),
                    binary_path: Some("main.exe".into()),
                    expected_binary_hash: Some(hash),
                },
                &workspaces,
                Arc::new(move |event| {
                    let _ = tx.send(event);
                }),
            )
            .unwrap();
        event(&rx, &mut events, "ready");
        event(&rx, &mut events, "paused");
        let mut point = action(&id, &workspace, "set-breakpoint");
        point.path = Some("main.rs".into());
        point.line = Some(3);
        debugger.action(point).unwrap();
        let verified = event(&rx, &mut events, "breakpoint");
        assert_eq!(verified["data"]["verified"], true);
        debugger
            .action(action(&id, &workspace, "continue"))
            .unwrap();
        let paused = event(&rx, &mut events, "paused");
        assert_eq!(paused["data"]["frames"][0]["path"], "main.rs");
        let mut variables = action(&id, &workspace, "variables");
        variables.object_id = paused["data"]["frames"][0]["scopes"][0]["objectId"]
            .as_str()
            .map(str::to_owned);
        debugger.action(variables).unwrap();
        let values = event(&rx, &mut events, "variables");
        assert!(values["data"]["values"]
            .as_array()
            .unwrap()
            .iter()
            .any(|row| row["name"] == "value"
                && row["value"].as_str().is_some_and(|v| v.contains('5'))));
        let mut remove = action(&id, &workspace, "remove-breakpoint");
        remove.breakpoint_id = verified["data"]["breakpointId"].as_str().map(str::to_owned);
        debugger.action(remove).unwrap();
        event(&rx, &mut events, "breakpoint-removed");
        debugger
            .action(action(&id, &workspace, "step-over"))
            .unwrap();
        event(&rx, &mut events, "paused");
        debugger
            .action(action(&id, &workspace, "continue"))
            .unwrap();
        assert_eq!(event(&rx, &mut events, "exited")["data"]["exitCode"], 0);
        debugger.stop(&id, &workspace).unwrap();
        assert!(debugger.sessions.lock().unwrap().is_empty());
        assert_eq!(
            fs::read_to_string(dir.path().join("main.rs")).unwrap(),
            source
        );
        fs::write(base.join("ACTUAL-RUST-DEBUG.json"),serde_json::to_vec_pretty(&json!({"result":"PASS","events":events,"sourceChanged":false,"ownedSessionsRemaining":0})).unwrap()).unwrap();
    }
}
