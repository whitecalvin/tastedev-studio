use crate::filesystem::{error, resolve, Result, Workspaces};
use crate::job::ProcessJob;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    collections::{HashMap, HashSet},
    io::{BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, AtomicU64, Ordering},
        mpsc, Arc, Mutex,
    },
    thread,
    time::Duration,
};
pub type Emit = Arc<dyn Fn(Value) + Send + Sync>;
const MAX_FRAME: usize = 4 * 1024 * 1024;
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Start {
    pub session_id: String,
    pub workspace_id: String,
    pub language: String,
    pub tool_path: String,
    pub node_path: Option<String>,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Call {
    pub session_id: String,
    pub workspace_id: String,
    pub method: String,
    pub params: Value,
}
struct Session {
    workspace: String,
    root: PathBuf,
    language: String,
    child: Mutex<Child>,
    input: Mutex<ChildStdin>,
    job: ProcessJob,
    pending: Mutex<HashMap<u64, mpsc::Sender<Value>>>,
    next: AtomicU64,
    live: AtomicBool,
    open: Mutex<HashMap<String, i64>>,
    emit: Emit,
}
#[derive(Default)]
pub struct Languages {
    sessions: Mutex<HashMap<String, Arc<Session>>>,
    cancelled: Mutex<HashSet<String>>,
    updating: AtomicBool,
}
fn identity(id: &str) -> Result<()> {
    uuid::Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| error("invalid"))
}
fn tool(path: &str, name: &str) -> Result<PathBuf> {
    let file = PathBuf::from(path);
    if !file.is_absolute()
        || file.file_stem().and_then(|s| s.to_str()) != Some(name)
        || file.extension().and_then(|s| s.to_str())
            != Some(if name == "pyright-langserver" {
                "js"
            } else {
                "exe"
            })
        || !file.is_file()
    {
        return Err(error("language-tool"));
    }
    Ok(fs_canonical(file)?)
}
fn fs_canonical(file: PathBuf) -> Result<PathBuf> {
    Ok(std::fs::canonicalize(file)?)
}
fn display(path: &Path) -> String {
    crate::filesystem::display_path(path).replace('\\', "/")
}

fn uri(path: &Path) -> Result<String> {
    reqwest::Url::from_file_path(PathBuf::from(display(&path.canonicalize()?)))
        .map(|u| u.to_string())
        .map_err(|_| error("path"))
}
fn scoped_uri(root: &Path, value: &str, language: &str) -> Result<PathBuf> {
    let url = reqwest::Url::parse(value).map_err(|_| error("path"))?;
    if url.scheme() != "file" || url.query().is_some() || url.fragment().is_some() {
        return Err(error("path"));
    }
    let absolute = url.to_file_path().map_err(|_| error("path"))?;
    let absolute_text = display(&absolute);
    let prefix = display(root).trim_end_matches('/').to_string() + "/";
    if !absolute_text
        .to_ascii_lowercase()
        .starts_with(&prefix.to_ascii_lowercase())
    {
        return Err(error("path"));
    }
    let path = absolute_text[prefix.len()..].to_string();
    if path.split('/').any(|p| {
        p.eq_ignore_ascii_case(".git")
            || p.eq_ignore_ascii_case("credentials")
            || p.starts_with(".env")
    }) {
        return Err(error("path"));
    }
    let resolved = resolve(root, &path, false)?;
    let ext = resolved.extension().and_then(|s| s.to_str());
    if (language == "rust" && ext != Some("rs"))
        || (language == "python" && !matches!(ext, Some("py" | "pyi")))
    {
        return Err(error("path"));
    }
    Ok(resolved)
}
fn frame(reader: &mut impl Read) -> std::io::Result<Value> {
    let mut header = Vec::new();
    while !header.ends_with(b"\r\n\r\n") {
        if header.len() >= 8192 {
            return Err(std::io::ErrorKind::InvalidData.into());
        }
        let mut b = [0];
        reader.read_exact(&mut b)?;
        header.push(b[0]);
    }
    let header = std::str::from_utf8(&header).map_err(|_| std::io::ErrorKind::InvalidData)?;
    let sizes = header
        .lines()
        .filter_map(|line| line.split_once(':'))
        .filter(|(k, _)| k.eq_ignore_ascii_case("content-length"))
        .map(|(_, v)| v.trim().parse::<usize>())
        .collect::<Vec<_>>();
    if sizes.len() != 1 {
        return Err(std::io::ErrorKind::InvalidData.into());
    }
    let size = *sizes[0]
        .as_ref()
        .map_err(|_| std::io::ErrorKind::InvalidData)?;
    if size == 0 || size > MAX_FRAME {
        return Err(std::io::ErrorKind::InvalidData.into());
    }
    let mut bytes = vec![0; size];
    reader.read_exact(&mut bytes)?;
    serde_json::from_slice(&bytes).map_err(|_| std::io::ErrorKind::InvalidData.into())
}
impl Session {
    fn send(&self, value: Value) -> Result<()> {
        let bytes = serde_json::to_vec(&value).map_err(|_| error("invalid"))?;
        if bytes.len() > MAX_FRAME || !self.live.load(Ordering::SeqCst) {
            return Err(error("language-stopped"));
        }
        let mut input = self.input.lock().map_err(|_| error("internal"))?;
        write!(input, "Content-Length: {}\r\n\r\n", bytes.len())?;
        input.write_all(&bytes)?;
        input.flush()?;
        Ok(())
    }
    fn request(&self, method: &str, params: Value) -> Result<Value> {
        let id = self.next.fetch_add(1, Ordering::SeqCst);
        let (send, receive) = mpsc::channel();
        {
            let mut pending = self.pending.lock().map_err(|_| error("internal"))?;
            if pending.len() >= 16 {
                return Err(error("language-limit"));
            }
            pending.insert(id, send);
        }
        if let Err(error) =
            self.send(json!({"jsonrpc":"2.0","id":id,"method":method,"params":params}))
        {
            self.pending.lock().unwrap().remove(&id);
            return Err(error);
        }
        let result = receive.recv_timeout(Duration::from_secs(if method == "initialize" {
            30
        } else {
            10
        }));
        self.pending.lock().unwrap().remove(&id);
        match result {
            Ok(value) if value.get("error").is_none() => {
                Ok(value.get("result").cloned().unwrap_or(Value::Null))
            }
            Ok(value) => {
                let code = value["error"]["code"].as_i64().unwrap_or(0);
                #[cfg(test)]
                eprintln!("Language response method={method} code={code}");
                Err(error(if matches!(code, -32800 | -32801 | -32802) {
                    "language-content-modified"
                } else {
                    "language-response"
                }))
            }
            Err(_) => {
                let _ = self
                    .send(json!({"jsonrpc":"2.0","method":"$/cancelRequest","params":{"id":id}}));
                Err(error("language-timeout"))
            }
        }
    }
    fn settings(&self) -> Value {
        if self.language == "rust" {
            json!({"cargo":{"buildScripts":{"enable":false},"noDeps":true,"autoreload":false,"metadataExtraArgs":["--offline","--locked"]},"procMacro":{"enable":false},"checkOnSave":false})
        } else {
            json!({"analysis":{"diagnosticMode":"workspace","autoSearchPaths":true,"useLibraryCodeForTypes":true}})
        }
    }
    fn stop(&self) {
        self.live.store(false, Ordering::SeqCst);
        self.job.terminate();
        if let Ok(mut child) = self.child.lock() {
            let _ = child.kill();
            let _ = child.wait();
        }
        self.pending.lock().unwrap().clear();
    }
}
impl Languages {
    pub fn start(&self, r: Start, workspaces: &Workspaces, emit: Emit) -> Result<Value> {
        identity(&r.session_id)?;
        if !matches!(r.language.as_str(), "rust" | "python") {
            return Err(error("invalid"));
        }
        let root = workspaces.root(&r.workspace_id)?;
        let executable = tool(
            &r.tool_path,
            if r.language == "rust" {
                "rust-analyzer"
            } else {
                "pyright-langserver"
            },
        )?;
        let mut command = if r.language == "python" {
            let node = tool(
                r.node_path
                    .as_deref()
                    .ok_or_else(|| error("language-tool"))?,
                "node",
            )?;
            let mut cmd = Command::new(node);
            cmd.arg(display(&executable)).arg("--stdio");
            cmd
        } else {
            Command::new(executable)
        };
        command
            .current_dir(display(&root))
            .env_clear()
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        for key in [
            "PATH",
            "SYSTEMROOT",
            "WINDIR",
            "TEMP",
            "TMP",
            "HOME",
            "USERPROFILE",
            "RUSTUP_HOME",
            "RUSTUP_TOOLCHAIN",
            "CARGO_HOME",
        ] {
            if let Some(value) = std::env::var_os(key) {
                command.env(key, value);
            }
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x0800_0000);
        }
        let mut sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        if self.updating.load(Ordering::SeqCst)
            || sessions.len() >= 2
            || sessions.contains_key(&r.session_id)
        {
            return Err(error("workspace-busy"));
        }
        if self.cancelled.lock().unwrap().remove(&r.session_id) {
            return Err(error("cancelled"));
        }
        let mut child = command.spawn().map_err(|_| error("language-start"))?;
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
        #[cfg(not(windows))]
        let job = ProcessJob::attach(&child)?;
        let input = child.stdin.take().ok_or_else(|| error("language-start"))?;
        let output = child.stdout.take().ok_or_else(|| error("language-start"))?;
        let mut stderr = child.stderr.take().ok_or_else(|| error("language-start"))?;
        let session = Arc::new(Session {
            workspace: r.workspace_id.clone(),
            root,
            language: r.language,
            input: Mutex::new(input),
            child: Mutex::new(child),
            job,
            pending: Mutex::new(HashMap::new()),
            next: AtomicU64::new(1),
            live: AtomicBool::new(true),
            open: Mutex::new(HashMap::new()),
            emit,
        });
        sessions.insert(r.session_id.clone(), session.clone());
        drop(sessions);
        thread::spawn(move || {
            let mut bytes = [0; 4096];
            while stderr.read(&mut bytes).is_ok_and(|n| n > 0) {}
        });
        let reader_session = session.clone();
        let id = r.session_id.clone();
        thread::spawn(move || {
            let mut reader = BufReader::new(output);
            while reader_session.live.load(Ordering::SeqCst) {
                let Ok(message) = frame(&mut reader) else {
                    break;
                };
                if let Some(request) = message.get("id") {
                    if message.get("method").is_none() {
                        if let Some(task) = request
                            .as_u64()
                            .and_then(|n| reader_session.pending.lock().unwrap().remove(&n))
                        {
                            let _ = task.send(message);
                        }
                        continue;
                    }
                    let method = message["method"].as_str().unwrap_or("");
                    let reply = if method == "workspace/configuration" {
                        json!({"jsonrpc":"2.0","id":request,"result":message["params"]["items"].as_array().map(|items|items.iter().take(64).map(|_|reader_session.settings()).collect::<Vec<_>>()).unwrap_or_default()})
                    } else if matches!(
                        method,
                        "client/registerCapability" | "window/workDoneProgress/create"
                    ) {
                        json!({"jsonrpc":"2.0","id":request,"result":null})
                    } else {
                        json!({"jsonrpc":"2.0","id":request,"error":{"code":-32601,"message":"Client action unavailable"}})
                    };
                    let _ = reader_session.send(reply);
                } else if message["method"] == "textDocument/publishDiagnostics" {
                    let params = &message["params"];
                    if params["uri"].as_str().is_some_and(|u| {
                        scoped_uri(&reader_session.root, u, &reader_session.language).is_ok()
                    }) {
                        (reader_session.emit)(
                            json!({"sessionId":id,"workspaceId":reader_session.workspace,"type":"diagnostics","params":params}),
                        );
                    }
                }
            }
            reader_session.live.store(false, Ordering::SeqCst);
            reader_session.pending.lock().unwrap().clear();
            (reader_session.emit)(
                json!({"sessionId":id,"workspaceId":reader_session.workspace,"type":"stopped"}),
            );
        });
        let result=session.request("initialize",json!({"processId":std::process::id(),"rootUri":uri(&session.root)?,"workspaceFolders":[{"uri":uri(&session.root)?,"name":"Project"}],"capabilities":{"general":{"positionEncodings":["utf-16"]},"textDocument":{"publishDiagnostics":{"versionSupport":true},"synchronization":{"didSave":true},"rename":{"prepareSupport":false}},"workspace":{"configuration":true,"workspaceFolders":true,"applyEdit":false}},"initializationOptions":session.settings()}));
        match result {
            Ok(value) => {
                if !session.live.load(Ordering::SeqCst) {
                    self.stop(&r.session_id, &r.workspace_id)?;
                    return Err(error("cancelled"));
                }
                session.send(json!({"jsonrpc":"2.0","method":"initialized","params":{}}))?;
                Ok(
                    json!({"rootUri":uri(&session.root)?,"capabilities":value["capabilities"],"language":session.language}),
                )
            }
            Err(error) => {
                let _ = self.stop(&r.session_id, &r.workspace_id);
                Err(error)
            }
        }
    }
    pub fn call(&self, r: Call) -> Result<Value> {
        let session = self
            .sessions
            .lock()
            .map_err(|_| error("internal"))?
            .get(&r.session_id)
            .cloned()
            .ok_or_else(|| error("language-stopped"))?;
        if session.workspace != r.workspace_id {
            return Err(error("access"));
        }
        if !matches!(
            r.method.as_str(),
            "textDocument/didOpen"
                | "textDocument/didChange"
                | "textDocument/didClose"
                | "textDocument/didSave"
                | "textDocument/definition"
                | "textDocument/references"
                | "textDocument/rename"
                | "textDocument/hover"
                | "textDocument/completion"
        ) {
            return Err(error("language-method"));
        }
        let document = &r.params["textDocument"];
        let u = document["uri"].as_str().ok_or_else(|| error("invalid"))?;
        scoped_uri(&session.root, u, &session.language)?;
        let mut open = session.open.lock().map_err(|_| error("internal"))?;
        if r.method == "textDocument/didOpen" {
            let version = document["version"]
                .as_i64()
                .ok_or_else(|| error("invalid"))?;
            if open.len() >= 256
                || open.contains_key(u)
                || document["text"]
                    .as_str()
                    .is_none_or(|s| s.len() > 2 * 1024 * 1024 || s.contains('\0'))
            {
                return Err(error("language-document"));
            }
            open.insert(u.to_string(), version);
        } else {
            let version = open.get(u).ok_or_else(|| error("language-document"))?;
            if r.method == "textDocument/didChange" {
                let next = document["version"]
                    .as_i64()
                    .ok_or_else(|| error("invalid"))?;
                let changes = r.params["contentChanges"]
                    .as_array()
                    .ok_or_else(|| error("invalid"))?;
                if next <= *version
                    || changes.len() != 1
                    || changes[0].get("range").is_some()
                    || changes[0]["text"]
                        .as_str()
                        .is_none_or(|s| s.len() > 2 * 1024 * 1024 || s.contains('\0'))
                {
                    return Err(error("language-document"));
                }
                open.insert(u.to_string(), next);
            } else if r.method == "textDocument/didClose" {
                open.remove(u);
            }
        }
        if r.method == "textDocument/rename"
            && r.params["newName"].as_str().is_none_or(|s| {
                s.is_empty() || s.len() > 100 || s.chars().any(|c| !c.is_alphanumeric() && c != '_')
            })
        {
            return Err(error("invalid"));
        }
        drop(open);
        if matches!(
            r.method.as_str(),
            "textDocument/didOpen"
                | "textDocument/didChange"
                | "textDocument/didClose"
                | "textDocument/didSave"
        ) {
            session.send(json!({"jsonrpc":"2.0","method":r.method,"params":r.params}))?;
            Ok(Value::Null)
        } else {
            session.request(&r.method, r.params)
        }
    }
    pub fn stop(&self, id: &str, workspace: &str) -> Result<()> {
        identity(id)?;
        let mut sessions = self.sessions.lock().map_err(|_| error("internal"))?;
        if let Some(session) = sessions.get(id) {
            if session.workspace != workspace {
                return Err(error("access"));
            }
            let session = sessions.remove(id).unwrap();
            drop(sessions);
            session.stop();
        } else {
            let mut cancelled = self.cancelled.lock().unwrap();
            if cancelled.len() < 64 {
                cancelled.insert(id.to_string());
            }
        }
        Ok(())
    }
    pub fn stop_all(&self) {
        let sessions = std::mem::take(&mut *self.sessions.lock().unwrap());
        for session in sessions.values() {
            session.stop();
        }
    }
    pub fn begin_update(&self) {
        self.updating.store(true, Ordering::SeqCst);
        self.stop_all();
    }
    pub fn end_update(&self) {
        self.updating.store(false, Ordering::SeqCst);
    }
}
impl Drop for Languages {
    fn drop(&mut self) {
        self.stop_all();
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn bounded_frames_and_unicode() {
        let message = json!({"text":"한글🦀"});
        let bytes = serde_json::to_vec(&message).unwrap();
        let mut stream = format!("Content-Length: {}\r\n\r\n", bytes.len()).into_bytes();
        stream.extend(bytes);
        assert_eq!(frame(&mut &stream[..]).unwrap(), message);
        for body in [
            b"Content-Length: 99999999\r\n\r\n".as_slice(),
            b"Content-Length: 1\r\nContent-Length: 1\r\n\r\n0",
            b"Unknown: 1\r\n\r\n",
        ] {
            assert!(frame(&mut &body[..]).is_err());
        }
    }
    #[test]
    fn uri_and_tool_boundaries() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::write(dir.path().join("main.py"), "value=1").unwrap();
        let root = dir.path().canonicalize().unwrap();
        assert!(scoped_uri(&root, &uri(&dir.path().join("main.py")).unwrap(), "python").is_ok());
        assert!(scoped_uri(&root, &uri(&dir.path().join("main.py")).unwrap(), "rust").is_err());
        assert!(scoped_uri(&root, "file:///C:/outside.py", "python").is_err());
        assert!(scoped_uri(&root, "https://example.com/main.py", "python").is_err());
        assert!(tool("relative/rust-analyzer.exe", "rust-analyzer").is_err());
    }
    #[test]
    #[ignore = "Actual installed public language servers; approved disposable tools only"]
    fn actual_python_and_rust_servers() {
        let evidence = PathBuf::from(std::env::var("TASTESTUDIO_LSP_EVIDENCE_DIR").unwrap());
        let tools = evidence.join("tools");
        let workspaces = Workspaces::default();
        let languages = Languages::default();
        let mut results = Vec::new();
        for language in ["python", "rust"] {
            if std::env::var("TASTESTUDIO_LSP_LANGUAGE").is_ok_and(|selected| selected != language)
            {
                continue;
            }
            let root = evidence.join(format!("actual-{}-{}", language, uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&root).unwrap();
            let (main, other, content, other_content) = if language == "python" {
                (
                    "main.py",
                    "math_local.py",
                    "from math_local import add\nvalue=add(2,3)\nwrong: str=value\n",
                    "def add(a:int,b:int)->int:\n    return a+b\n",
                )
            } else {
                ("main.rs","math.rs","mod math;\nfn main() { let value=math::add(2,3); let wrong: String=value; let syntax_error=; println!(\"{wrong}\"); }\n","pub fn add(a:i32,b:i32)->i32 {a+b}\n")
            };
            std::fs::write(root.join(main), content).unwrap();
            std::fs::write(root.join(other), other_content).unwrap();
            if language == "rust" {
                std::fs::write(root.join("Cargo.toml"),"[package]\nname=\"lsp_verify\"\nversion=\"0.1.0\"\nedition=\"2024\"\n[[bin]]\nname=\"lsp_verify\"\npath=\"main.rs\"\n").unwrap();
                std::fs::write(
                    root.join("Cargo.lock"),
                    "version = 4\n[[package]]\nname = \"lsp_verify\"\nversion = \"0.1.0\"\n",
                )
                .unwrap();
            }
            let canonical = root.canonicalize().unwrap();
            let workspace = uuid::Uuid::new_v4().to_string();
            let session = uuid::Uuid::new_v4().to_string();
            workspaces
                .roots
                .lock()
                .unwrap()
                .insert(workspace.clone(), canonical.clone());
            let (send, receive) = mpsc::channel();
            let tool_path = if language == "rust" {
                tools.join("rust-analyzer/rust-analyzer.exe")
            } else {
                tools.join("node_modules/pyright/dist/pyright-langserver.js")
            };
            let start = languages
                .start(
                    Start {
                        session_id: session.clone(),
                        workspace_id: workspace.clone(),
                        language: language.into(),
                        tool_path: display(&tool_path),
                        node_path: Some("C:/Program Files/nodejs/node.exe".into()),
                    },
                    &workspaces,
                    Arc::new(move |event| {
                        let _ = send.send(event);
                    }),
                )
                .unwrap();
            assert!(start["capabilities"]["definitionProvider"] != Value::Null);
            for (file, text) in [(main, content), (other, other_content)] {
                languages.call(Call{session_id:session.clone(),workspace_id:workspace.clone(),method:"textDocument/didOpen".into(),params:json!({"textDocument":{"uri":uri(&canonical.join(file)).unwrap(),"languageId":language,"version":1,"text":text}})}).unwrap();
            }
            let line = content.lines().nth(1).unwrap();
            let position = json!({"line":1,"character":line.find("add(").unwrap()+1});
            let document = json!({"uri":uri(&canonical.join(main)).unwrap()});
            let invoke = |method: &str, params: Value| {
                for attempt in 0..50 {
                    match languages.call(Call {
                        session_id: session.clone(),
                        workspace_id: workspace.clone(),
                        method: method.into(),
                        params: params.clone(),
                    }) {
                        Ok(value) => return value,
                        Err(error) if error.code == "language-content-modified" && attempt < 49 => {
                            thread::sleep(Duration::from_millis(100))
                        }
                        Err(error) => panic!("Actual {language} {method}: {:?}", error),
                    }
                }
                unreachable!()
            };
            let mut definition = Value::Null;
            for _ in 0..100 {
                definition = invoke(
                    "textDocument/definition",
                    json!({"textDocument":document,"position":position}),
                );
                if !definition.is_null() && definition != json!([]) {
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
            assert!(
                definition.to_string().contains(other),
                "{} definition missing: {}",
                language,
                definition
            );
            let mut references = Value::Null;
            for _ in 0..100 {
                references = invoke(
                    "textDocument/references",
                    json!({"textDocument":document,"position":position,"context":{"includeDeclaration":true}}),
                );
                if references.as_array().is_some_and(|rows| rows.len() >= 2) {
                    break;
                }
                thread::sleep(Duration::from_millis(100));
            }
            assert!(
                references.as_array().is_some_and(|rows| rows.len() >= 2),
                "{} references missing: {}",
                language,
                references
            );
            let rename = invoke(
                "textDocument/rename",
                json!({"textDocument":document,"position":position,"newName":"sum_values"}),
            );
            assert!(
                rename.to_string().contains("sum_values") && rename.to_string().contains(other)
            );
            assert!(languages
                .call(Call {
                    session_id: session.clone(),
                    workspace_id: workspace.clone(),
                    method: "workspace/executeCommand".into(),
                    params: json!({"command":"shell"})
                })
                .is_err());
            let mut diagnostics = false;
            for _ in 0..60 {
                if let Ok(event) = receive.recv_timeout(Duration::from_millis(200)) {
                    if event["type"] == "diagnostics"
                        && event["params"]["diagnostics"]
                            .as_array()
                            .is_some_and(|rows| !rows.is_empty())
                    {
                        diagnostics = true;
                        break;
                    }
                }
            }
            assert!(diagnostics, "{} diagnostics missing", language);
            languages.stop(&session, &workspace).unwrap();
            assert!(languages.sessions.lock().unwrap().is_empty());
            assert_eq!(std::fs::read_to_string(root.join(main)).unwrap(), content);
            assert_eq!(
                std::fs::read_to_string(root.join(other)).unwrap(),
                other_content
            );
            results.push(json!({"language":language,"definition":definition,"references":references,"rename":rename,"diagnostics":true,"sourceChanged":false,"ownedSessionRemaining":0}));
            println!("Actual {} LSP: PASS", language);
            std::fs::write(
                evidence.join(format!("ACTUAL-{}-SERVER.json", language.to_uppercase())),
                serde_json::to_vec_pretty(results.last().unwrap()).unwrap(),
            )
            .unwrap();
        }
        std::fs::write(
            evidence.join("ACTUAL-LANGUAGE-SERVERS.json"),
            serde_json::to_vec_pretty(&json!({"result":"PASS","results":results})).unwrap(),
        )
        .unwrap();
    }
}
