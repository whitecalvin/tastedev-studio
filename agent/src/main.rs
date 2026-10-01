mod browser;
mod executor;
mod model;
mod pipeline;
mod reliability;
mod snapshot;
mod source_cache;
mod tree;
use model::*;
use serde_json::{json, Value};
use std::{
    fs,
    io::{ErrorKind, Write},
    net::{TcpStream, ToSocketAddrs},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread,
    time::{Duration, Instant},
};
use tungstenite::{protocol::WebSocketConfig, stream::MaybeTlsStream, Message, WebSocket};
struct Active {
    run_id: String,
    execution_id: String,
    cancel: Arc<AtomicBool>,
    termination: Option<&'static str>,
    thread: thread::JoinHandle<Value>,
}
fn persist(path: &std::path::Path, value: &Value) -> Result<()> {
    no_links(path)?;
    let temp = path.with_extension("tmp");
    no_links(&temp)?;
    let mut file = fs::File::create(&temp).map_err(|_| "Result storage failed")?;
    file.write_all(value.to_string().as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|_| "Result storage failed")?;
    fs::rename(temp, path).map_err(|_| "Result commit failed".into())
}
fn connect(endpoint: &str) -> Result<WebSocket<MaybeTlsStream<TcpStream>>> {
    let uri: endpoint_uri::Uri = endpoint.parse().map_err(|_| "Invalid endpoint")?;
    let host = uri.host().ok_or("Missing host")?;
    let port = uri
        .port_u16()
        .unwrap_or(if uri.scheme_str() == Some("wss") {
            443
        } else {
            80
        });
    let addr = (host, port)
        .to_socket_addrs()
        .map_err(|_| "DNS unavailable")?
        .next()
        .ok_or("DNS unavailable")?;
    let tcp = TcpStream::connect_timeout(&addr, Duration::from_secs(2))
        .map_err(|_| "Core unavailable")?;
    tcp.set_read_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| "Socket configuration failed")?;
    tcp.set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(|_| "Socket configuration failed")?;
    let config = WebSocketConfig::default()
        .max_message_size(Some(MAX_MESSAGE))
        .max_frame_size(Some(MAX_MESSAGE))
        .write_buffer_size(0)
        .max_write_buffer_size(262144);
    let (mut socket, _) = tungstenite::client_tls_with_config(endpoint, tcp, Some(config), None)
        .map_err(|_| "WebSocket handshake failed")?;
    match socket.get_mut() {
        MaybeTlsStream::Plain(s) => s.set_nonblocking(true),
        MaybeTlsStream::Rustls(s) => s.sock.set_nonblocking(true),
        _ => return Err("Unsupported TLS backend".into()),
    }
    .map_err(|_| "Socket configuration failed")?;
    Ok(socket)
}
mod endpoint_uri {
    pub type Uri = tungstenite::http::Uri;
}
fn send(socket: &mut WebSocket<MaybeTlsStream<TcpStream>>, mut value: Value) -> bool {
    value["protocolVersion"] = json!(VERSION);
    match socket.send(Message::Text(value.to_string().into())) {
        Ok(()) => true,
        Err(tungstenite::Error::Io(e)) if e.kind() == ErrorKind::WouldBlock => true,
        _ => false,
    }
}
fn run(config: Config) -> Result<()> {
    config.validate()?;
    let token = std::env::var(&config.token_env)
        .map_err(|_| "Agent token environment variable is missing")?;
    if token.len() < 16 || token.len() > 512 {
        return Err("Invalid Agent token length".into());
    }
    let root = prepare_root(&config.workspace_root)?;
    let id = identity(&root)?;
    let claims = root.join("claims");
    no_links(&claims)?;
    fs::create_dir_all(&claims).map_err(|_| "Claims directory unavailable")?;
    // Core rejects concurrent connections using the same identity. Atomic persistent
    // run claims remain the execution authority, including across process restarts.
    let capabilities = executor::detect();
    if capabilities.memory_mi_b == 0 || capabilities.cpu_cores == 0 {
        return Err("Hardware detection failed".into());
    }
    let stop = Arc::new(AtomicBool::new(false));
    let signal = stop.clone();
    ctrlc::set_handler(move || signal.store(true, Ordering::SeqCst))
        .map_err(|_| "Shutdown handler failed")?;
    let (tx, rx) = mpsc::sync_channel::<Value>(64);
    let mut active: Option<Active> = None;
    let sessions: pipeline::Sessions = Arc::new(std::sync::Mutex::new(None));
    let mut results = Vec::<Value>::new();
    // Claims with no result represent an interrupted prior Agent. Never re-execute them.
    for entry in fs::read_dir(&claims)
        .map_err(|_| "Claims unavailable")?
        .flatten()
    {
        let p = entry.path();
        if p.extension().is_some_and(|x| x == "claim") {
            no_links(&p)?;
            let record: Value =
                serde_json::from_str(&fs::read_to_string(&p).map_err(|_| "Claim unreadable")?)
                    .map_err(|_| "Claim invalid")?;
            let run_id = record["runId"].as_str().ok_or("Claim invalid")?;
            uuid::Uuid::parse_str(run_id).map_err(|_| "Claim invalid")?;
            let execution_id = record["runStepId"].as_str().unwrap_or(run_id);
            uuid::Uuid::parse_str(execution_id).map_err(|_| "Claim invalid")?;
            let pending = claims.join(format!("{execution_id}.pending"));
            let ack = claims.join(format!("{execution_id}.ack"));
            if ack.exists() {
                continue;
            }
            if pending.exists() {
                no_links(&pending)?;
                results.push(
                    serde_json::from_str(
                        &fs::read_to_string(pending).map_err(|_| "Result unreadable")?,
                    )
                    .map_err(|_| "Result invalid")?,
                );
            } else {
                let now = chrono::Utc::now().to_rfc3339();
                let mut result = json!({"type":"result","protocolVersion":VERSION,"jobId":record["jobId"],"runId":run_id,"runStepId":record["runStepId"],"status":"failed","exitCode":null,"startedAt":now,"finishedAt":now,"classification":"AGENT_RESTARTED","error":"Agent restarted after interrupted execution"});
                if let Some(summary) =
                    browser::resume_evidence(&root, &record, tx.clone(), stop.clone())
                {
                    result["browserResult"] = summary;
                }
                persist(&pending, &result)?;
                results.push(result);
            }
        }
    }
    let mut socket = None;
    let mut ready = false;
    let mut retry_at = Instant::now();
    let mut backoff = 250u64;
    let mut beat = Instant::now();
    let mut last_core = Instant::now();
    let mut reported = reliability::DeliveryClock::default();
    let retry_seed = Instant::now();
    if config.log_level == "info" {
        eprintln!("tastedev-agent ready; workspace identity loaded; waiting for Core");
    }
    loop {
        if stop.load(Ordering::SeqCst) {
            pipeline::stop(&sessions);
            if let Some(a) = &mut active {
                a.termination.get_or_insert("AGENT_SHUTDOWN");
                a.cancel.store(true, Ordering::SeqCst);
            }
            if active.is_none() {
                break;
            }
        }
        if active.as_ref().is_some_and(|a| a.thread.is_finished()) {
            let a = active.take().ok_or("Execution state lost")?;
            let mut result = a.thread.join().map_err(|_| "Executor panicked")?;
            if result.get("classification").is_none() {
                result["classification"] = json!(match result["status"].as_str() {
                    Some("passed") => "PASSED",
                    Some("timeout") => "TIMEOUT",
                    Some("cancelled") => "CANCELLED",
                    _ => "EXECUTION_ERROR",
                });
            }
            if result["status"] == "cancelled" {
                result["classification"] = json!(a.termination.unwrap_or("CANCELLED"));
            }
            persist(&claims.join(format!("{}.pending", a.execution_id)), &result)?;
            results.push(result);
        }
        for _ in 0..64 {
            let Ok(event) = rx.try_recv() else { break };
            if ready {
                if let Some(ws) = socket.as_mut() {
                    if !send(ws, event) {
                        ready = false;
                    }
                }
            }
        }
        if socket.is_none() && !stop.load(Ordering::SeqCst) && Instant::now() >= retry_at {
            match connect(&config.endpoint) {
                Ok(mut ws) => {
                    if send(
                        &mut ws,
                        json!({"type":"register","token":token,"agentId":id,"name":config.name,"agentVersion":env!("CARGO_PKG_VERSION"),"sourceCache":source_cache::inventory(&root),"platform":platform(),"architecture":architecture(),"capabilities":capabilities,"activeRunId":active.as_ref().map(|a|a.run_id.as_str()).or_else(||results.first().and_then(|r|r["runId"].as_str()))}),
                    ) {
                        socket = Some(ws);
                        last_core = Instant::now();
                    } else {
                        retry_at = Instant::now()
                            + reliability::retry_delay(
                                backoff,
                                config.reconnect_max_ms,
                                retry_seed.elapsed().as_nanos() as u64,
                            );
                        backoff = backoff.saturating_mul(2).min(config.reconnect_max_ms);
                    }
                }
                Err(_) => {
                    retry_at = Instant::now()
                        + reliability::retry_delay(
                            backoff,
                            config.reconnect_max_ms,
                            retry_seed.elapsed().as_nanos() as u64,
                        );
                    backoff = backoff.saturating_mul(2).min(config.reconnect_max_ms);
                }
            }
        }
        let mut lost = false;
        if let Some(ws) = socket.as_mut() {
            if ready && beat.elapsed() >= Duration::from_millis(config.heartbeat_ms) {
                lost = !send(
                    ws,
                    json!({"type":"heartbeat","sourceCache":source_cache::inventory(&root),"agentId":id,"timestamp":chrono::Utc::now().to_rfc3339(),"status":if active.is_some(){"busy"}else{"idle"},"activeRunId":active.as_ref().map(|a|&a.run_id)}),
                );
                beat = Instant::now();
            }
            if ready {
                for result in &results {
                    let run_id = result["runStepId"]
                        .as_str()
                        .or_else(|| result["runId"].as_str())
                        .ok_or("Invalid result")?;
                    if reported.due(run_id, Instant::now()) {
                        if send(ws, result.clone()) {
                            reported.sent(run_id, Instant::now());
                        } else {
                            lost = true;
                            break;
                        }
                    }
                }
            }
            for _ in 0..32 {
                let message = match ws.read() {
                    Ok(m) => m,
                    Err(tungstenite::Error::Io(e)) if e.kind() == ErrorKind::WouldBlock => break,
                    Err(_) => {
                        lost = true;
                        break;
                    }
                };
                last_core = Instant::now();
                match message {
                    Message::Text(text) => {
                        let parsed = serde_json::from_str::<Value>(&text);
                        let Ok(m) = parsed else { continue };
                        if m["protocolVersion"] != VERSION {
                            lost = true;
                            break;
                        }
                        match m["type"].as_str() {
                            Some("registered") => {
                                if m["agentId"] != id {
                                    lost = true;
                                    break;
                                }
                                ready = true;
                                backoff = 250;
                                reported.reset();
                                beat = Instant::now() - Duration::from_millis(config.heartbeat_ms);
                            }
                            Some("execute") if ready => {
                                let parsed = serde_json::from_value::<Request>(m.clone());
                                let request = match parsed {
                                    Ok(r) => r,
                                    Err(_) => {
                                        send(
                                            ws,
                                            json!({"type":"rejected","runId":m["runId"],"runStepId":m["runStepId"],"jobId":m["jobId"],"reason":"Malformed execution request"}),
                                        );
                                        continue;
                                    }
                                };
                                let valid = request.validate(&id).and_then(|_| {
                                    if request.matches(&capabilities) {
                                        Ok(())
                                    } else {
                                        Err("Capability mismatch".into())
                                    }
                                });
                                if valid.is_err() || active.is_some() || !results.is_empty() {
                                    send(
                                        ws,
                                        json!({"type":"rejected","runId":request.run_id,"projectId":request.project_id,"runStepId":request.run_step_id,"jobId":request.job_id,"reason":"Invalid, incompatible or busy Agent"}),
                                    );
                                    continue;
                                }
                                let claim =
                                    claims.join(format!("{}.claim", request.execution_id()));
                                no_links(&claim)?;
                                let claimed = fs::OpenOptions::new()
                                    .write(true)
                                    .create_new(true)
                                    .open(&claim);
                                let Ok(mut file) = claimed else {
                                    send(
                                        ws,
                                        json!({"type":"rejected","runId":request.run_id,"runStepId":request.run_step_id,"jobId":request.job_id,"reason":"Duplicate run or claim unavailable"}),
                                    );
                                    continue;
                                };
                                file.write_all(
                                    json!({"runId":request.run_id,"projectId":request.project_id,"runStepId":request.run_step_id,"jobId":request.job_id})
                                        .to_string()
                                        .as_bytes(),
                                )
                                .and_then(|_| file.sync_all())
                                .map_err(|_| "Durable claim failed")?;
                                let cancelled = Arc::new(AtomicBool::new(false));
                                let flag = cancelled.clone();
                                let run_id = request.run_id.clone();
                                let execution_id = request.execution_id().to_owned();
                                let run_sessions = sessions.clone();
                                let root = root.clone();
                                let sender = tx.clone();
                                let current_capabilities = capabilities.clone();
                                send(
                                    ws,
                                    json!({"type":"accepted","jobId":request.job_id,"runId":run_id,"runStepId":request.run_step_id}),
                                );
                                active = Some(Active {
                                    run_id,
                                    execution_id,
                                    cancel: cancelled,
                                    termination: None,
                                    thread: thread::spawn(move || {
                                        let started = chrono::Utc::now().to_rfc3339();
                                        let probe_start = Instant::now();
                                        let mut request = request;
                                        let capability_error = executor::verify_capabilities(
                                            &request,
                                            current_capabilities,
                                            &flag,
                                        )
                                        .err();
                                        let elapsed = probe_start.elapsed().as_millis() as u64;
                                        if capability_error.is_some()
                                            || flag.load(Ordering::SeqCst)
                                            || elapsed >= request.timeout_ms
                                        {
                                            let (status, classification) =
                                                if flag.load(Ordering::SeqCst) {
                                                    ("cancelled", "CANCELLED")
                                                } else if elapsed >= request.timeout_ms {
                                                    ("timeout", "TIMEOUT")
                                                } else {
                                                    ("failed", "CAPABILITY_MISMATCH")
                                                };
                                            return json!({"type":"result","protocolVersion":VERSION,"jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"status":status,"exitCode":null,"startedAt":started,"finishedAt":chrono::Utc::now().to_rfc3339(),"classification":classification,"error":capability_error});
                                        }
                                        request.timeout_ms -= elapsed;
                                        if request.run_step_id.is_some() {
                                            pipeline::execute(
                                                request,
                                                &root,
                                                flag,
                                                sender,
                                                run_sessions,
                                            )
                                        } else {
                                            executor::execute(request, &root, flag, sender)
                                        }
                                    }),
                                });
                            }
                            Some("cancel") => {
                                if sessions
                                    .lock()
                                    .ok()
                                    .and_then(|g| g.as_ref().map(|s| s.run_id.clone()))
                                    .is_some_and(|r| m["runId"] == r)
                                {
                                    pipeline::stop(&sessions);
                                }
                                if let Some(a) = &mut active {
                                    if m["runId"] == a.run_id {
                                        a.termination.get_or_insert("CANCELLED");
                                        a.cancel.store(true, Ordering::SeqCst);
                                    }
                                }
                            }
                            Some("closeRun") => {
                                if active.is_none()
                                    && sessions
                                        .lock()
                                        .ok()
                                        .and_then(|g| g.as_ref().map(|s| s.run_id.clone()))
                                        .is_some_and(|r| m["runId"] == r)
                                {
                                    pipeline::close(&sessions)?;
                                }
                            }
                            Some("ack") => {
                                if let Some(run) =
                                    m["runStepId"].as_str().or_else(|| m["runId"].as_str())
                                {
                                    if results.iter().any(|r| {
                                        r["runStepId"].as_str().or_else(|| r["runId"].as_str())
                                            == Some(run)
                                    }) {
                                        persist(
                                            &claims.join(format!("{run}.ack")),
                                            &json!({"acknowledged":true}),
                                        )?;
                                        results.retain(|r| {
                                            r["runStepId"].as_str().or_else(|| r["runId"].as_str())
                                                != Some(run)
                                        });
                                        reported.acknowledged(run);
                                    }
                                }
                            }
                            Some("error") if !ready => {
                                lost = true;
                                break;
                            }
                            _ => {}
                        }
                    }
                    Message::Close(_) => {
                        lost = true;
                        break;
                    }
                    Message::Ping(_) | Message::Pong(_) => {}
                    _ => {}
                }
            }
            if !ready && last_core.elapsed() > Duration::from_secs(5) {
                lost = true;
            }
            // Ping detects half-open links without equating heartbeat writes with receipt.
            if ready
                && last_core.elapsed() > Duration::from_secs(5)
                && ws.send(Message::Ping(vec![1].into())).is_err()
            {
                lost = true;
            }
            if last_core.elapsed() > Duration::from_secs(10) {
                lost = true;
            }
            if ws.flush().is_err_and(
                |e| !matches!(e,tungstenite::Error::Io(ref io)if io.kind()==ErrorKind::WouldBlock),
            ) {
                lost = true;
            }
        }
        if lost {
            pipeline::stop(&sessions);
            socket = None;
            ready = false;
            reported.reset();
            if let Some(a) = &mut active {
                a.termination.get_or_insert("CONNECTION_LOST");
                a.cancel.store(true, Ordering::SeqCst);
            }
            retry_at = Instant::now()
                + reliability::retry_delay(
                    backoff,
                    config.reconnect_max_ms,
                    retry_seed.elapsed().as_nanos() as u64,
                );
            backoff = backoff.saturating_mul(2).min(config.reconnect_max_ms);
        }
        thread::sleep(Duration::from_millis(15));
    }
    if let Some(mut ws) = socket {
        let _ = ws.close(None);
    }
    pipeline::close(&sessions)?;
    Ok(())
}
fn main() {
    let args: Vec<String> = std::env::args().collect();
    let result = (|| -> Result<()> {
        if args.len() != 3 || args[1] != "--config" {
            return Err("Usage: tastedev-agent --config <config.json>".into());
        }
        let text = fs::read_to_string(PathBuf::from(&args[2])).map_err(|_| "Config unavailable")?;
        let config: Config = serde_json::from_str(&text).map_err(|_| "Invalid config JSON")?;
        run(config)
    })();
    if let Err(error) = result {
        eprintln!("Agent stopped: {error}");
        std::process::exit(1);
    }
}
#[cfg(test)]
mod tests;
