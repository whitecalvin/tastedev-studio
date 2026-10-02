use super::*;
use std::io::Write;
fn send(
    input: &mut impl Write,
    seq: &mut u64,
    command: &str,
    args: Value,
    pending: &mut HashMap<u64, (String, Instant)>,
) -> Result<u64> {
    if pending.len() >= 16 {
        return Err(error("debug-busy"));
    }
    let id = *seq;
    *seq += 1;
    let bytes =
        serde_json::to_vec(&json!({"seq":id,"type":"request","command":command,"arguments":args}))
            .map_err(|_| error("debug-message"))?;
    write!(input, "Content-Length: {}\r\n\r\n", bytes.len())?;
    input.write_all(&bytes)?;
    input.flush()?;
    pending.insert(id, (command.into(), Instant::now()));
    Ok(id)
}
pub(super) fn interpreter(path: &str) -> Result<PathBuf> {
    let file = PathBuf::from(path);
    if !file.is_absolute()
        || file.extension().and_then(|e| e.to_str()) != Some("exe")
        || !matches!(
            file.file_stem().and_then(|e| e.to_str()),
            Some("python" | "python3")
        )
        || !file.is_file()
    {
        return Err(error("debug-python"));
    }
    Ok(file.canonicalize()?)
}
pub(super) fn rust_adapter(path: &str) -> Result<PathBuf> {
    let file = PathBuf::from(path);
    if !file.is_absolute()
        || !file.is_file()
        || file.file_name().and_then(|n| n.to_str()) != Some("codelldb.exe")
    {
        return Err(error("debug-adapter"));
    }
    Ok(file.canonicalize()?)
}
pub(super) fn run(
    root: &Path,
    file: &Path,
    python: &Path,
    args: &[String],
    cancel: &AtomicBool,
    commands: mpsc::Receiver<Internal>,
    emit: impl FnMut(&str, Value),
) -> Result<Option<i32>> {
    run_adapter(root, (file, None), python, args, cancel, commands, emit)
}
pub(super) fn run_rust(
    root: &Path,
    file: &Path,
    target: (&Path, &Path, &str),
    args: &[String],
    cancel: &AtomicBool,
    commands: mpsc::Receiver<Internal>,
    emit: impl FnMut(&str, Value),
) -> Result<Option<i32>> {
    let (adapter, program, expected_hash) = target;
    if format!("{:x}", Sha256::digest(fs::read(program)?)) != expected_hash {
        return Err(error("conflict"));
    }
    run_adapter(
        root,
        (file, Some(program)),
        adapter,
        args,
        cancel,
        commands,
        emit,
    )
}
fn run_adapter(
    root: &Path,
    source: (&Path, Option<&Path>),
    executable: &Path,
    args: &[String],
    cancel: &AtomicBool,
    commands: mpsc::Receiver<Internal>,
    mut emit: impl FnMut(&str, Value),
) -> Result<Option<i32>> {
    let (file, program) = source;
    let rust = program.is_some();
    let mut command = Command::new(crate::filesystem::display_path(executable));
    if !rust {
        command.args(["-m", "debugpy.adapter"]);
    }
    command
        .current_dir(if rust {
            root
        } else {
            executable.parent().unwrap_or(root)
        })
        .stdin(Stdio::piped())
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
    ] {
        if let Some(value) = std::env::var_os(key) {
            command.env(key, value);
        }
    }
    command.env("PYTHONUTF8", "1");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    let mut child = command.spawn().map_err(|_| error("debug-python"))?;
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
    let mut input = child.stdin.take().ok_or_else(|| error("debug-python"))?;
    let output = child.stdout.take().ok_or_else(|| error("debug-python"))?;
    let stderr = child.stderr.take().ok_or_else(|| error("debug-python"))?;
    let (tx, rx) = mpsc::sync_channel::<Value>(128);
    let reader = thread::spawn(move || {
        let mut output = BufReader::new(output);
        while let Ok(message) = crate::language::frame(&mut output) {
            if tx.try_send(message).is_err() {
                break;
            }
        }
    });
    let drain = thread::spawn(move || {
        let mut stderr = BufReader::new(stderr);
        let mut bytes = [0u8; 4096];
        while let Ok(size) = stderr.read(&mut bytes) {
            if size == 0 {
                break;
            }
        }
    });
    let result = (|| -> Result<Option<i32>> {
        let mut seq = 1;
        let mut pending = HashMap::new();
        let mut thread_id = None::<i64>;
        let mut frames = HashSet::<i64>::new();
        let mut variable_frames = HashMap::<u64, i64>::new();
        let mut vars = HashMap::<u64, String>::new();
        let mut breakpoint_actions = HashMap::<u64, Internal>::new();
        let mut breakpoint_updates = HashMap::<u64, (String, Vec<(String, Internal)>)>::new();
        let mut breakpoints = HashMap::<String, Vec<(String, Internal)>>::new();
        let mut serial = 1u64;
        let mut exit_code = None;
        let begun = Instant::now();
        send(
            &mut input,
            &mut seq,
            "initialize",
            json!({"clientID":"tastestudio","adapterID":if rust {"lldb"} else {"python"},"pathFormat":"path","linesStartAt1":true,"columnsStartAt1":true,"supportsRunInTerminalRequest":false}),
            &mut pending,
        )?;
        loop {
            if cancel.load(Ordering::SeqCst) {
                return Ok(None);
            }
            if begun.elapsed() > Duration::from_secs(1800) {
                return Err(error("debug-timeout"));
            }
            if pending
                .values()
                .any(|(_, at)| at.elapsed() > Duration::from_secs(30))
            {
                return Err(error("debug-timeout"));
            }
            while let Ok(action) = commands.try_recv() {
                let result = (|| -> Result<()> {
                    if pending.len() >= 16 {
                        return Err(error("debug-busy"));
                    }
                    match action.action.as_str() {
                        "continue" | "pause" | "step-over" | "step-into" | "step-out" => {
                            let thread = thread_id.ok_or_else(|| error("debug-state"))?;
                            let method = match action.action.as_str() {
                                "continue" => "continue",
                                "pause" => "pause",
                                "step-over" => "next",
                                "step-into" => "stepIn",
                                _ => "stepOut",
                            };
                            send(
                                &mut input,
                                &mut seq,
                                method,
                                json!({"threadId":thread,"singleThread":true}),
                                &mut pending,
                            )?;
                        }
                        "variables" => {
                            let id = action
                                .object_id
                                .as_deref()
                                .and_then(|id| id.strip_prefix("pyframe:"))
                                .and_then(|id| id.parse::<i64>().ok())
                                .filter(|id| frames.contains(id))
                                .ok_or_else(|| error("debug-permission"))?;
                            let request = send(
                                &mut input,
                                &mut seq,
                                "scopes",
                                json!({"frameId":id}),
                                &mut pending,
                            )?;
                            variable_frames.insert(request, id);
                        }
                        "set-breakpoint" | "remove-breakpoint" => {
                            let target = if action.action == "set-breakpoint" {
                                let path = action.path.as_ref().ok_or_else(|| error("invalid"))?;
                                path.strip_prefix(root)
                                    .ok()
                                    .and_then(|p| p.to_str())
                                    .map(|p| p.replace('\\', "/"))
                                    .ok_or_else(|| error("debug-file"))?
                            } else {
                                let id = action
                                    .breakpoint_id
                                    .as_ref()
                                    .ok_or_else(|| error("invalid"))?;
                                breakpoints
                                    .iter()
                                    .find(|(_, points)| points.iter().any(|(key, _)| key == id))
                                    .map(|(path, _)| path.clone())
                                    .ok_or_else(|| error("debug-permission"))?
                            };
                            if breakpoints.values().map(Vec::len).sum::<usize>() >= 100
                                && action.action == "set-breakpoint"
                            {
                                return Err(error("debug-busy"));
                            }
                            // Serialize per-source updates so rejected adapter requests never
                            // become the committed breakpoint state used by the next action.
                            if breakpoint_updates.values().any(|(path, _)| path == &target) {
                                return Err(error("debug-busy"));
                            }
                            let mut points = breakpoints.get(&target).cloned().unwrap_or_default();
                            if action.action == "set-breakpoint" {
                                let id = format!("pybp:{serial}");
                                serial += 1;
                                points.push((id, action.clone()));
                            } else {
                                points.retain(|(id, _)| Some(id) != action.breakpoint_id.as_ref());
                            }
                            let requested=points.iter().map(|(_,point)|json!({"line":point.line,"condition":point.condition,"logMessage":point.log_message})).collect::<Vec<_>>();
                            let path = resolve(root, &target, false)?;
                            let id = send(
                                &mut input,
                                &mut seq,
                                "setBreakpoints",
                                json!({"source":{"path":crate::filesystem::display_path(&path)},"breakpoints":requested,"sourceModified":false}),
                                &mut pending,
                            )?;
                            let mut action = action.clone();
                            if action.action == "set-breakpoint" {
                                action.breakpoint_id = points.last().map(|(id, _)| id.clone());
                            }
                            breakpoint_updates.insert(id, (target, points));
                            breakpoint_actions.insert(id, action);
                        }
                        _ => return Err(error("debug-permission")),
                    };
                    Ok(())
                })();
                if result.is_err() {
                    emit(
                        "operation-error",
                        json!({"reason":"DAP debug action could not complete. Wait for a paused session and check the selected source."}),
                    );
                }
            }
            let message = match rx.recv_timeout(Duration::from_millis(25)) {
                Ok(value) => value,
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(_) => return exit_code.map(Some).ok_or_else(|| error("debug-python")),
            };
            if message["type"] == "request" {
                let bytes=serde_json::to_vec(&json!({"seq":seq,"type":"response","request_seq":message["seq"],"success":false,"command":message["command"],"message":"Client execution requests are not allowed."})).map_err(|_|error("debug-message"))?;
                seq += 1;
                write!(input, "Content-Length: {}\r\n\r\n", bytes.len())?;
                input.write_all(&bytes)?;
                input.flush()?;
                continue;
            }
            if message["type"] == "response" {
                let Some(id) = message["request_seq"].as_u64() else {
                    continue;
                };
                let Some((name, _)) = pending.remove(&id) else {
                    continue;
                };
                if message["success"] != true {
                    variable_frames.remove(&id);
                    vars.remove(&id);
                    breakpoint_actions.remove(&id);
                    breakpoint_updates.remove(&id);
                    emit(
                        "operation-error",
                        json!({"reason":"DAP debug adapter rejected the request."}),
                    );
                    if matches!(name.as_str(), "initialize" | "launch" | "configurationDone") {
                        return Err(error("debug-python"));
                    }
                    continue;
                }
                let body = &message["body"];
                match name.as_str() {
                    "initialize" => {
                        send(
                            &mut input,
                            &mut seq,
                            "launch",
                            if let Some(program) = program {
                                json!({"type":"lldb","request":"launch","name":"TASTESTUDIO","program":crate::filesystem::display_path(program),"cwd":crate::filesystem::display_path(root),"args":args,"terminal":"console","stopOnEntry":true,"env":{},"sourceLanguages":["rust"]})
                            } else {
                                json!({"type":"python","request":"launch","name":"TASTESTUDIO","program":crate::filesystem::display_path(file),"cwd":crate::filesystem::display_path(root),"python":[crate::filesystem::display_path(executable)],"args":args,"console":"internalConsole","justMyCode":true,"stopOnEntry":true,"redirectOutput":true,"subProcess":false,"env":{}})
                            },
                            &mut pending,
                        )?;
                    }
                    "configurationDone" => emit("ready", json!({})),
                    "stackTrace" => {
                        frames.clear();
                        let rows=body["stackFrames"].as_array().map(|items|items.iter().take(100).filter_map(|frame|{let path=source_path(root,frame["source"]["path"].as_str()?)?;if !(if rust {path.ends_with(".rs")} else {path.ends_with(".py")}){return None;}let id=frame["id"].as_i64()?;frames.insert(id);Some(json!({"functionName":frame["name"],"path":path,"line":frame["line"],"column":frame["column"],"scopes":[{"type":"locals","objectId":format!("pyframe:{id}")}]}))}).collect::<Vec<_>>()).unwrap_or_default();
                        emit(
                            "paused",
                            json!({"reason":if rust {"Rust paused"} else {"Python paused"},"frames":rows}),
                        );
                    }
                    "scopes" => {
                        if variable_frames.remove(&id).is_some() {
                            if let Some(reference) = body["scopes"]
                                .as_array()
                                .and_then(|rows| {
                                    rows.iter()
                                        .find(|row| row["presentationHint"] == "locals")
                                        .or_else(|| rows.first())
                                })
                                .and_then(|scope| scope["variablesReference"].as_i64())
                                .filter(|v| *v > 0)
                            {
                                let id = send(
                                    &mut input,
                                    &mut seq,
                                    "variables",
                                    json!({"variablesReference":reference,"start":0,"count":100}),
                                    &mut pending,
                                )?;
                                vars.insert(id, "locals".into());
                            }
                        }
                    }
                    "variables" => {
                        if vars.remove(&id).is_some() {
                            let values=body["variables"].as_array().map(|rows|rows.iter().take(100).map(|value|json!({"name":value["name"].as_str().unwrap_or("").chars().take(256).collect::<String>(),"value":value["value"].as_str().unwrap_or("").chars().take(4096).collect::<String>()})).collect::<Vec<_>>()).unwrap_or_default();
                            emit("variables", json!({"values":values}));
                        }
                    }
                    "setBreakpoints" => {
                        if let Some((path, points)) = breakpoint_updates.remove(&id) {
                            breakpoints.insert(path, points);
                        }
                        if let Some(action) = breakpoint_actions.remove(&id) {
                            if action.action == "remove-breakpoint" {
                                emit(
                                    "breakpoint-removed",
                                    json!({"breakpointId":action.breakpoint_id}),
                                );
                            } else {
                                let verified = body["breakpoints"]
                                    .as_array()
                                    .and_then(|rows| rows.last())
                                    .is_some_and(|row| row["verified"] == true);
                                emit(
                                    "breakpoint",
                                    json!({"breakpointId":action.breakpoint_id,"path":action.path.and_then(|p|p.strip_prefix(root).ok().map(|p|p.to_string_lossy().replace('\\',"/"))),"line":action.line,"verified":verified}),
                                );
                            }
                        }
                    }
                    _ => {}
                };
            } else if message["type"] == "event" {
                let body = &message["body"];
                match message["event"].as_str().unwrap_or("") {
                    "initialized" => {
                        send(
                            &mut input,
                            &mut seq,
                            "setExceptionBreakpoints",
                            json!({"filters":[]}),
                            &mut pending,
                        )?;
                        send(
                            &mut input,
                            &mut seq,
                            "configurationDone",
                            json!({}),
                            &mut pending,
                        )?;
                    }
                    "stopped" => {
                        thread_id = body["threadId"].as_i64();
                        send(
                            &mut input,
                            &mut seq,
                            "stackTrace",
                            json!({"threadId":thread_id,"startFrame":0,"levels":100}),
                            &mut pending,
                        )?;
                    }
                    "continued" => {
                        frames.clear();
                        emit("resumed", json!({}));
                    }
                    "output" => emit(
                        "output",
                        json!({"stream":"debug","text":body["output"].as_str().unwrap_or("").chars().take(16384).collect::<String>()}),
                    ),
                    "exited" => exit_code = body["exitCode"].as_i64().map(|code| code as i32),
                    "terminated" => {
                        return exit_code.map(Some).ok_or_else(|| error("debug-python"))
                    }
                    _ => {}
                };
            }
        }
    })();
    #[cfg(windows)]
    job.terminate();
    let _ = child.kill();
    let _ = child.wait();
    drop(input);
    let _ = reader.join();
    let _ = drain.join();
    result
}
