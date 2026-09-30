use crate::{executor, model::*};
use serde_json::{json, Value};
use std::{
    fs,
    io::{Read, Write},
    net::{TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, SyncSender},
        Arc, Mutex,
    },
    thread,
    time::{Duration, Instant},
};

pub struct Service {
    cancel: Arc<AtomicBool>,
    thread: thread::JoinHandle<Value>,
}
pub struct Session {
    pub run_id: String,
    services: Vec<Service>,
}
pub type Sessions = Arc<Mutex<Option<Session>>>;
pub fn stop(sessions: &Sessions) {
    if let Ok(guard) = sessions.lock() {
        if let Some(session) = guard.as_ref() {
            for service in &session.services {
                service.cancel.store(true, Ordering::SeqCst);
            }
        }
    }
}
pub fn close(sessions: &Sessions) -> Result<()> {
    let session = sessions.lock().map_err(|_| "Session lock failed")?.take();
    if let Some(session) = session {
        let unexpected = session
            .services
            .iter()
            .any(|service| service.thread.is_finished() && !service.cancel.load(Ordering::SeqCst));
        for service in &session.services {
            service.cancel.store(true, Ordering::SeqCst);
        }
        let mut failed = unexpected;
        for service in session.services {
            match service.thread.join() {
                Ok(result) => failed |= result["status"] == "failed",
                Err(_) => failed = true,
            }
        }
        if failed {
            return Err("Service exited unexpectedly or cleanup failed".into());
        }
    }
    Ok(())
}
pub fn cwd(root: &Path, run: &str, relative_cwd: &str) -> Result<PathBuf> {
    relative(relative_cwd)?;
    let run = root.join("runs").join(run);
    let target = run.join(relative_cwd);
    no_links(&target)?;
    fs::create_dir_all(&target).map_err(|_| "Working directory unavailable")?;
    let canonical = target
        .canonicalize()
        .map_err(|_| "Working directory unavailable")?;
    if !canonical.starts_with(
        run.canonicalize()
            .map_err(|_| "Run workspace unavailable")?,
    ) {
        return Err("Workspace escape".into());
    }
    Ok(canonical)
}
pub fn validate_source(source: &Source) -> Result<()> {
    if source.provider == "snapshot" {
        return crate::snapshot::validate(source);
    }
    if source.snapshot.is_some() {
        return Err("Invalid Git snapshot".into());
    }
    let uri: tungstenite::http::Uri = source
        .repository
        .parse()
        .map_err(|_| "Invalid source URL")?;
    if source.provider != "git"
        || !matches!(uri.scheme_str(), Some("https" | "git"))
        || uri.host().is_none()
        || uri.authority().is_some_and(|a| a.as_str().contains('@'))
        || uri.query().is_some()
        || source.repository.contains('#')
        || source.repository.len() > 1024
        || source.repository.chars().any(char::is_whitespace)
        || source.revision.is_empty()
        || source.revision.len() > 200
        || !source.revision.as_bytes()[0].is_ascii_alphanumeric()
        || !source
            .revision
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"._/-".contains(&b))
        || source.revision.contains("..")
        || source.revision.contains("//")
    {
        return Err("Invalid source URL or revision".into());
    }
    Ok(())
}
pub fn validate_health(health: &Health) -> Result<tungstenite::http::Uri> {
    let uri: tungstenite::http::Uri = health.url.parse().map_err(|_| "Invalid health URL")?;
    if uri.scheme_str() != Some("http")
        || !matches!(uri.host(), Some("127.0.0.1" | "localhost" | "[::1]"))
        || uri.authority().is_some_and(|a| a.as_str().contains('@'))
        || uri.query().is_some()
        || health.url.contains('#')
        || health.url.len() > 1024
        || health.url.chars().any(char::is_whitespace)
        || !(100..=599).contains(&health.expected_status)
        || !(100..=10000).contains(&health.retry_interval_ms)
    {
        return Err("Invalid loopback health check".into());
    }
    Ok(uri)
}
fn result(request: &Request, status: &str, error: Option<&str>, started: &str) -> Value {
    json!({"type":"result","protocolVersion":VERSION,"runId":request.run_id,"runStepId":request.run_step_id,"jobId":request.job_id,"status":status,"exitCode":if status=="passed"{Some(0)}else{None},"startedAt":started,"finishedAt":chrono::Utc::now().to_rfc3339(),"error":error})
}
fn health(request: &Request, flag: Arc<AtomicBool>, events: SyncSender<Value>) -> Value {
    let started = chrono::Utc::now().to_rfc3339();
    let h = request.healthcheck.as_ref().expect("validated health");
    let uri = match validate_health(h) {
        Ok(uri) => uri,
        Err(_) => return result(request, "failed", Some("Invalid health URL"), &started),
    };
    let began = Instant::now();
    let mut attempt = 0;
    while began.elapsed() < Duration::from_millis(request.timeout_ms) {
        if flag.load(Ordering::SeqCst) {
            return result(request, "cancelled", None, &started);
        }
        attempt += 1;
        let probe = (|| -> std::io::Result<bool> {
            let host = uri.host().unwrap().trim_matches(['[', ']']);
            let address = (host, uri.port_u16().unwrap_or(80))
                .to_socket_addrs()?
                .next()
                .ok_or(std::io::ErrorKind::AddrNotAvailable)?;
            let remaining = Duration::from_millis(request.timeout_ms)
                .saturating_sub(began.elapsed())
                .min(Duration::from_millis(200));
            if remaining.is_zero() {
                return Ok(false);
            }
            let mut stream = TcpStream::connect_timeout(&address, remaining)?;
            stream.set_read_timeout(Some(remaining))?;
            stream.set_write_timeout(Some(remaining))?;
            write!(
                stream,
                "GET {} HTTP/1.1\r\nHost: {}\r\nConnection: close\r\n\r\n",
                uri.path(),
                uri.authority().unwrap()
            )?;
            let mut line = Vec::new();
            let mut byte = [0];
            while line.len() < 1024
                && began.elapsed() < Duration::from_millis(request.timeout_ms)
                && !flag.load(Ordering::SeqCst)
                && stream.read(&mut byte)? == 1
            {
                line.push(byte[0]);
                if byte[0] == b'\n' {
                    break;
                }
            }
            let line = String::from_utf8_lossy(&line);
            let mut words = line.split_whitespace();
            Ok(matches!(words.next(), Some("HTTP/1.0" | "HTTP/1.1"))
                && words.next().and_then(|v| v.parse::<u16>().ok()) == Some(h.expected_status))
        })()
        .unwrap_or(false);
        let _=events.try_send(json!({"type":"output","runId":request.run_id,"runStepId":request.run_step_id,"jobId":request.job_id,"sequence":attempt,"stream":"stdout","text":if probe{"Health check healthy\n"}else{"Health check pending; retrying\n"}}));
        if probe {
            return result(request, "passed", None, &started);
        }
        let retry = Instant::now();
        while retry.elapsed() < Duration::from_millis(h.retry_interval_ms)
            && began.elapsed() < Duration::from_millis(request.timeout_ms)
            && !flag.load(Ordering::SeqCst)
        {
            thread::sleep(Duration::from_millis(10));
        }
    }
    result(request, "timeout", Some("Health check timed out"), &started)
}
trait SourcePreparation {
    fn prepare(&self, request: &Request, root: &Path, cancel: Arc<AtomicBool>) -> Value;
}
struct GitProvider;
impl SourcePreparation for GitProvider {
    fn prepare(&self, request: &Request, root: &Path, cancel: Arc<AtomicBool>) -> Value {
        let started = chrono::Utc::now().to_rfc3339();
        let start = Instant::now();
        let source = request.source.as_ref().expect("validated source");
        let commands = vec![
            vec![
                "-c",
                "credential.helper=",
                "-c",
                "core.hooksPath=",
                "clone",
                "--no-checkout",
                "--",
                source.repository.as_str(),
                "source",
            ],
            vec![
                "-c",
                "credential.helper=",
                "-C",
                "source",
                "fetch",
                "--no-tags",
                "origin",
                source.revision.as_str(),
            ],
            vec![
                "-c",
                "core.hooksPath=",
                "-C",
                "source",
                "checkout",
                "--detach",
                "FETCH_HEAD",
                "--",
            ],
            vec!["-C", "source", "rev-parse", "--verify", "HEAD"],
        ];
        let mut sha = String::new();
        for args in commands {
            let remaining = request
                .timeout_ms
                .saturating_sub(start.elapsed().as_millis() as u64);
            if remaining < 100 {
                return result(
                    request,
                    "timeout",
                    Some("Source preparation timed out"),
                    &started,
                );
            }
            let mut command = request.clone();
            command.executable = "git".into();
            command.args = args.iter().map(|v| (*v).into()).collect();
            command.timeout_ms = remaining;
            command.env.insert("GIT_TERMINAL_PROMPT".into(), "0".into());
            command.env.insert("GIT_CONFIG_NOSYSTEM".into(), "1".into());
            command.env.insert(
                "GIT_CONFIG_GLOBAL".into(),
                if cfg!(windows) { "NUL" } else { "/dev/null" }.into(),
            );
            let (tx, rx) = mpsc::sync_channel(64);
            // Never relay Git diagnostics (remote helpers may print credentials). Retain only bounded SHA output.
            let reader = thread::spawn(move || {
                let mut text = String::new();
                for e in rx {
                    let e: Value = e;
                    if e["stream"] == "stdout" && text.len() < 4096 {
                        text.push_str(e["text"].as_str().unwrap_or(""));
                    }
                }
                text
            });
            let r = executor::command(command, root, cancel.clone(), tx, None);
            sha = reader.join().unwrap_or_default();
            if r["status"] != "passed" {
                return result(
                    request,
                    r["status"].as_str().unwrap_or("failed"),
                    Some("Git source preparation failed"),
                    &started,
                );
            }
        }
        let sha = sha.trim();
        if ![40, 64].contains(&sha.len()) || !sha.bytes().all(|b| b.is_ascii_hexdigit()) {
            return result(
                request,
                "failed",
                Some("Git did not report a commit SHA"),
                &started,
            );
        }
        let mut r = result(request, "passed", None, &started);
        r["revision"] =
            json!({"repository":source.repository,"branch":source.revision,"commit":sha});
        r
    }
}
pub fn execute(
    request: Request,
    root: &Path,
    cancel: Arc<AtomicBool>,
    events: SyncSender<Value>,
    sessions: Sessions,
) -> Value {
    let started = chrono::Utc::now().to_rfc3339();
    let operation = (|| -> Result<Value> {
        {
            let mut guard = sessions.lock().map_err(|_| "Session unavailable")?;
            if let Some(session) = guard.as_ref() {
                if session.run_id != request.run_id {
                    return Err("Another Run owns the workspace".into());
                }
            } else {
                workspace(root, &request.run_id, ".")?;
                *guard = Some(Session {
                    run_id: request.run_id.clone(),
                    services: Vec::new(),
                });
            }
        }
        match request.stage.as_deref() {
            Some("test") if request.browser.is_some() => Ok(crate::browser::execute(
                request.clone(),
                root,
                cancel,
                events,
            )),
            Some("source")
                if request
                    .source
                    .as_ref()
                    .is_some_and(|s| s.provider == "snapshot") =>
            {
                crate::snapshot::prepare(&request, root, cancel)
            }
            Some("source") => Ok(GitProvider.prepare(&request, root, cancel)),
            Some("healthcheck") => Ok(health(&request, cancel, events)),
            Some("start") => {
                let service_cancel = Arc::new(AtomicBool::new(false));
                let flag = service_cancel.clone();
                let r = request.clone();
                let path = root.to_owned();
                let (tx, rx) = mpsc::sync_channel(1);
                let worker =
                    thread::spawn(move || executor::command(r, &path, flag, events, Some(tx)));
                match rx.recv_timeout(Duration::from_millis(request.timeout_ms)) {
                    Ok(pid) => {
                        sessions
                            .lock()
                            .map_err(|_| "Session unavailable")?
                            .as_mut()
                            .ok_or("Session unavailable")?
                            .services
                            .push(Service {
                                cancel: service_cancel,
                                thread: worker,
                            });
                        let mut r = result(&request, "passed", None, &started);
                        r["serviceId"] = json!(pid.to_string());
                        Ok(r)
                    }
                    Err(_) => {
                        service_cancel.store(true, Ordering::SeqCst);
                        let _ = worker.join();
                        Err("Service did not start".into())
                    }
                }
            }
            Some("cleanup") => {
                // Stop services first, but retain the workspace until the project cleanup command ends.
                let stopped = close(&sessions);
                let outcome = if request.executable == "internal-stop-services" {
                    result(&request, "passed", None, &started)
                } else {
                    executor::command(request.clone(), root, cancel, events, None)
                };
                Ok(if let Err(error) = stopped {
                    result(&request, "failed", Some(&error), &started)
                } else {
                    outcome
                })
            }
            _ => Ok(executor::command(
                request.clone(),
                root,
                cancel,
                events,
                None,
            )),
        }
    })();
    operation.unwrap_or_else(|error| result(&request, "failed", Some(&error), &started))
}
