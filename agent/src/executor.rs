use crate::{model::*, tree::Tree};
use serde_json::{json, Value};
use std::{
    io::Read,
    path::Path,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, SyncSender},
        Arc,
    },
    thread,
    time::{Duration, Instant},
};
pub struct Redactor {
    pending: String,
    values: Vec<String>,
}
#[derive(Default, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct OutputSummary {
    total_chunks: u64,
    dropped_chunks: u64,
    dropped_bytes: u64,
    forwarded_bytes: u64,
    partial: bool,
}
impl OutputSummary {
    fn forward(&mut self, events: &SyncSender<Value>, event: Value, bytes: usize) -> bool {
        self.total_chunks = self.total_chunks.saturating_add(1);
        // Consume pipes privately after the bounded per-step live-output budget.
        let outcome = if self.forwarded_bytes.saturating_add(bytes as u64) > 1024 * 1024 {
            Err(mpsc::TrySendError::Full(event))
        } else {
            events.try_send(event)
        };
        match outcome {
            Ok(()) => {
                self.forwarded_bytes += bytes as u64;
                true
            }
            Err(error) => {
                self.dropped_chunks = self.dropped_chunks.saturating_add(1);
                self.dropped_bytes = self.dropped_bytes.saturating_add(bytes as u64);
                self.partial = true;
                !matches!(error, mpsc::TrySendError::Disconnected(_))
            }
        }
    }
}
fn output_chunks(mut text: &str) -> Vec<&str> {
    let mut chunks = Vec::new();
    while !text.is_empty() {
        let mut end = text.len().min(4096);
        while !text.is_char_boundary(end) {
            end -= 1;
        }
        chunks.push(&text[..end]);
        text = &text[end..];
    }
    chunks
}
impl Redactor {
    pub fn new(mut values: Vec<String>) -> Self {
        values.retain(|v| !v.is_empty());
        values.sort_by_key(|v| std::cmp::Reverse(v.len()));
        Self {
            pending: String::new(),
            values,
        }
    }
    pub fn feed(&mut self, text: &str, eof: bool) -> String {
        self.pending.push_str(text);
        let mut output = String::new();
        while !self.pending.is_empty() {
            if let Some(value) = self
                .values
                .iter()
                .find(|v| self.pending.starts_with(v.as_str()))
            {
                self.pending.drain(..value.len());
                output.push_str("[redacted]");
            } else if !eof && self.values.iter().any(|v| v.starts_with(&self.pending)) {
                break;
            } else {
                let ch = self.pending.chars().next().unwrap();
                self.pending.drain(..ch.len_utf8());
                output.push(ch);
            }
        }
        output
    }
}
/// Preserves incomplete UTF-8 suffixes between bounded pipe reads.
pub fn decode_chunk(pending: &mut Vec<u8>, bytes: &[u8], eof: bool) -> String {
    pending.extend_from_slice(bytes);
    let mut output = String::new();
    loop {
        match std::str::from_utf8(pending) {
            Ok(text) => {
                output.push_str(text);
                pending.clear();
                break;
            }
            Err(error) => {
                let valid = error.valid_up_to();
                output.push_str(&String::from_utf8_lossy(&pending[..valid]));
                pending.drain(..valid);
                if let Some(length) = error.error_len() {
                    output.push('�');
                    pending.drain(..length);
                } else {
                    if eof {
                        output.push_str(&String::from_utf8_lossy(pending));
                        pending.clear();
                    }
                    break;
                }
            }
        }
    }
    output
}

/// Native compiler include/library paths are needed for approved Rust tasks on Windows.
/// Other parent variables, including Agent/provider credentials, remain unavailable.
pub fn inherited_environment(executable: &str) -> Vec<&'static str> {
    let mut keys = vec![
        "PATH",
        "SystemRoot",
        "WINDIR",
        "TEMP",
        "TMP",
        "HOME",
        "USERPROFILE",
        "PATHEXT",
    ];
    let compiler = Path::new(executable)
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| matches!(name.trim_end_matches(".exe"), "cargo" | "rustc"));
    if cfg!(windows) && compiler {
        keys.extend(["LIB", "LIBPATH", "INCLUDE"]);
    }
    keys
}

pub fn execute(
    request: Request,
    root: &Path,
    cancel: Arc<AtomicBool>,
    events: SyncSender<Value>,
) -> Value {
    command(request, root, cancel, events, None)
}
pub fn command(
    request: Request,
    root: &Path,
    cancel: Arc<AtomicBool>,
    events: SyncSender<Value>,
    ready: Option<SyncSender<u32>>,
) -> Value {
    let started = chrono::Utc::now().to_rfc3339();
    let mut exit = None;
    let mut status = "failed";
    let mut output = OutputSummary::default();
    let operation = (|| -> Result<()> {
        let cwd = if request.run_step_id.is_some() {
            crate::pipeline::cwd(root, &request.run_id, &request.cwd)?
        } else {
            workspace(root, &request.run_id, &request.cwd)?
        };
        let mut command = Command::new(&request.executable);
        command
            .args(&request.args)
            .current_dir(cwd)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());
        // Credential-bearing Agent environment is never inherited by executed jobs.
        let inherited = inherited_environment(&request.executable);
        command.env_clear();
        for key in inherited {
            if let Some(value) = std::env::var_os(key) {
                command.env(key, value);
            }
        }
        command.envs(&request.env);
        if cancel.load(Ordering::SeqCst) {
            status = "cancelled";
            return Ok(());
        }
        let (mut child, tree) = Tree::spawn(&mut command)?;
        if let Some(sender) = &ready {
            let _ = sender.send(child.id());
        }
        let (tx, rx) = mpsc::sync_channel::<(&'static str, String)>(32);
        // Source output is consumed privately by GitProvider; only its validated SHA is published.
        let secrets: Vec<String> = if request.stage.as_deref() == Some("source") {
            Vec::new()
        } else {
            request.env.values().cloned().collect()
        };
        let reader = |mut pipe: Box<dyn Read + Send>, stream, tx: SyncSender<_>| {
            let secrets = secrets.clone();
            thread::spawn(move || {
                let mut buf = [0u8; 2048];
                let mut pending = Vec::new();
                let mut redactor = Redactor::new(secrets);
                loop {
                    match pipe.read(&mut buf) {
                        Ok(0) | Err(_) => {
                            let text = redactor.feed(&decode_chunk(&mut pending, &[], true), true);
                            for chunk in output_chunks(&text) {
                                if tx.send((stream, chunk.to_owned())).is_err() {
                                    break;
                                }
                            }
                            break;
                        }
                        Ok(n) => {
                            let text =
                                redactor.feed(&decode_chunk(&mut pending, &buf[..n], false), false);
                            for chunk in output_chunks(&text) {
                                if tx.send((stream, chunk.to_owned())).is_err() {
                                    return;
                                }
                            }
                        }
                    }
                }
            })
        };
        let out = reader(
            Box::new(child.stdout.take().ok_or("Missing stdout")?),
            "stdout",
            tx.clone(),
        );
        let err = reader(
            Box::new(child.stderr.take().ok_or("Missing stderr")?),
            "stderr",
            tx.clone(),
        );
        drop(tx);
        let start = Instant::now();
        let mut sequence = 0u64;
        let mut disconnected = false;
        loop {
            for _ in 0..32 {
                let Ok((stream, bytes)) = rx.try_recv() else {
                    break;
                };
                sequence += 1;
                let length = bytes.len();
                if !output.forward(&events, json!({"type":"output","jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"sequence":sequence,"stream":stream,"text":bytes}), length) { disconnected=true;break; }
            }
            if cancel.load(Ordering::SeqCst) || disconnected {
                status = "cancelled";
                tree.terminate()?;
                break;
            }
            if ready.is_none() && start.elapsed() >= Duration::from_millis(request.timeout_ms) {
                status = "timeout";
                tree.terminate()?;
                break;
            }
            match child.try_wait() {
                Ok(Some(code)) => {
                    exit = code.code();
                    status = if code.success() { "passed" } else { "failed" };
                    tree.terminate()?;
                    break;
                }
                Ok(None) => {}
                Err(_) => {
                    tree.terminate()?;
                    break;
                }
            }
            thread::sleep(Duration::from_millis(10));
        }
        let _ = child.wait();
        // Drain only after descendants are dead, so inherited pipe handles cannot hang cleanup.
        for (stream, bytes) in rx {
            sequence += 1;
            let length = bytes.len();
            output.forward(&events,json!({"type":"output","jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"sequence":sequence,"stream":stream,"text":bytes}),length);
        }
        let _ = out.join();
        let _ = err.join();
        Ok(())
    })();
    if operation.is_err() {
        status = "failed";
        exit = None;
    }
    let classification = if operation.is_err() {
        "EXECUTION_ERROR"
    } else {
        match status {
            "passed" => "PASSED",
            "timeout" => "TIMEOUT",
            "cancelled" => "CANCELLED",
            _ => "TEST_FAILED",
        }
    };
    json!({"type":"result","protocolVersion":VERSION,"jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"status":status,"exitCode":exit,"startedAt":started,"finishedAt":chrono::Utc::now().to_rfc3339(),"error":operation.err(),"classification":classification,"outputSummary":output})
}
pub fn probe(executable: &str, args: &[&str]) -> Option<String> {
    probe_with_path(executable, args, None)
}
fn probe_with_path(executable: &str, args: &[&str], path: Option<&String>) -> Option<String> {
    // Windows process lookup can use the parent PATH even after Command::env.
    // Resolve an explicit task PATH ourselves so a missing tool cannot be hidden
    // by an unrelated executable installed in the Agent's environment.
    let resolved = if !Path::new(executable).is_absolute() && path.is_some() {
        std::env::split_paths(path?)
            .filter(|dir| dir.is_absolute())
            .find_map(|dir| {
                let candidate = dir.join(executable);
                if candidate.is_file() {
                    Some(candidate)
                } else if cfg!(windows) && Path::new(executable).extension().is_none() {
                    let candidate = candidate.with_extension("exe");
                    candidate.is_file().then_some(candidate)
                } else {
                    None
                }
            })?
    } else {
        executable.into()
    };
    let mut cmd = Command::new(resolved);
    // Tool detection must not inherit provider tokens or task preload options.
    cmd.env_clear();
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
            cmd.env(key, value);
        }
    }
    if let Some(value) = path {
        cmd.env("PATH", value);
    }
    cmd.args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let (mut child, tree) = Tree::spawn(&mut cmd).ok()?;
    let out = child.stdout.take()?;
    let err = child.stderr.take()?;
    let read = |p: Box<dyn Read + Send>| {
        thread::spawn(move || {
            let mut text = String::new();
            let _ = p.take(8192).read_to_string(&mut text);
            text
        })
    };
    let a = read(Box::new(out));
    let b = read(Box::new(err));
    let start = Instant::now();
    let mut success = false;
    while start.elapsed()
        < Duration::from_secs(if args.iter().any(|a| a.ends_with("probe.cjs")) {
            8
        } else {
            2
        })
    {
        if let Ok(Some(code)) = child.try_wait() {
            success = code.success();
            break;
        }
        thread::sleep(Duration::from_millis(20));
    }
    let _ = tree.terminate();
    let _ = child.wait();
    let text = a.join().ok()? + &b.join().ok()?;
    success.then_some(text)
}
fn runtime_version(name: &str, request: &Request) -> Option<String> {
    let (executable, args): (&str, &[&str]) = match name {
        "node" => ("node", &["--version"]),
        "java" => ("java", &["-version"]),
        "python" => ("python", &["--version"]),
        "rust" => ("rustc", &["--version"]),
        "git" => ("git", &["--version"]),
        _ => return None,
    };
    let target = if Path::new(&request.executable)
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| {
            name.trim_end_matches(".exe")
                .eq_ignore_ascii_case(executable)
        }) {
        request.executable.as_str()
    } else {
        executable
    };
    probe_with_path(target, args, request.env.get("PATH"))?
        .split(|c: char| !c.is_ascii_digit() && c != '.')
        .map(|s| s.trim_matches('.'))
        .find(|s| s.contains('.') && s.split('.').all(|p| !p.is_empty() && p.len() <= 4))
        .map(str::to_owned)
}
/// Recheck requested tools on the worker so probes do not block heartbeats.
pub fn verify_capabilities(
    request: &Request,
    mut current: Capabilities,
    cancel: &AtomicBool,
) -> Result<()> {
    if let Some(required) = &request.requirements.runtimes {
        for name in required.keys().filter(|name| name.as_str() != "playwright") {
            if cancel.load(Ordering::SeqCst) {
                return Err("Capability check cancelled".into());
            }
            current.runtimes.remove(name);
            if let Some(version) = runtime_version(name, request) {
                current.runtimes.insert(name.clone(), version);
            }
        }
    }
    if request.requirements.docker.as_deref() == Some("required") {
        current.docker = probe_with_path(
            "docker",
            &["version", "--format", "{{.Server.Version}}"],
            request.env.get("PATH"),
        )
        .is_some();
    }
    if request.requirements.browser.is_some()
        || request
            .requirements
            .runtimes
            .as_ref()
            .is_some_and(|r| r.contains_key("playwright"))
    {
        current.browsers.clear();
        current.runtimes.remove("playwright");
        if let Some(report) = crate::browser::runner().and_then(|script| {
            probe_with_path(
                "node",
                &[script.with_file_name("probe.cjs").to_str()?],
                request.env.get("PATH"),
            )
            .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        }) {
            if let Some(version) = report["playwright"].as_str() {
                current.runtimes.insert("playwright".into(), version.into());
                current.browsers.push("chromium".into());
            }
        }
    }
    if cancel.load(Ordering::SeqCst) {
        return Err("Capability check cancelled".into());
    }
    if !request.matches(&current) {
        return Err("Capability changed or required runtime unavailable".into());
    }
    Ok(())
}
pub fn detect() -> Capabilities {
    let mut system = sysinfo::System::new();
    system.refresh_memory();
    let mut runtimes = std::collections::BTreeMap::new();
    for (name, args) in [
        ("node", vec!["--version"]),
        ("java", vec!["-version"]),
        ("python", vec!["--version"]),
        ("rustc", vec!["--version"]),
        ("git", vec!["--version"]),
    ] {
        if let Some(output) = probe(name, &args) {
            if let Some(version) = output
                .split(|c: char| !c.is_ascii_digit() && c != '.')
                .map(|s| s.trim_matches('.'))
                .find(|s| s.contains('.') && s.split('.').all(|p| !p.is_empty() && p.len() <= 4))
            {
                runtimes.insert(
                    if name == "rustc" { "rust" } else { name }.into(),
                    version.into(),
                );
            }
        }
    }
    let browser = crate::browser::runner().and_then(|script| {
        let probe_script = script.with_file_name("probe.cjs");
        probe("node", &[probe_script.to_str()?])
            .and_then(|s| serde_json::from_str::<Value>(&s).ok())
    });
    if let Some(version) = browser.as_ref().and_then(|b| b["playwright"].as_str()) {
        runtimes.insert("playwright".into(), version.into());
    }
    Capabilities {
        source_snapshot: Some(2),
        cpu_cores: thread::available_parallelism().map_or(0, |n| n.get() as u64),
        memory_mi_b: system.total_memory() / 1024 / 1024,
        docker: probe("docker", &["version", "--format", "{{.Server.Version}}"]).is_some(),
        gpu: probe("nvidia-smi", &["--query-gpu=name", "--format=csv,noheader"]).is_some(),
        pty: false,
        runtimes,
        browsers: if browser.is_some() {
            vec!["chromium".into()]
        } else {
            vec![]
        },
    }
}
#[cfg(test)]
mod output_tests {
    #[test]
    fn backpressure_reports_partial_output_and_disconnected_receiver() {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        let mut report = super::OutputSummary::default();
        assert!(report.forward(&tx, serde_json::json!({"text":"first"}), 5));
        assert!(report.forward(&tx, serde_json::json!({"text":"second"}), 6));
        assert_eq!(report.forwarded_bytes, 5);
        assert_eq!(report.dropped_bytes, 6);
        assert_eq!(report.dropped_chunks, 1);
        assert!(report.partial);
        drop(rx);
        assert!(!report.forward(&tx, serde_json::json!({}), 3));
    }
    #[test]
    fn live_log_budget_remains_bounded_with_an_available_receiver() {
        let (tx, rx) = std::sync::mpsc::sync_channel(1);
        let mut report = super::OutputSummary {
            forwarded_bytes: 1024 * 1024,
            ..Default::default()
        };
        assert!(report.forward(&tx, serde_json::json!({}), 1));
        assert!(rx.try_recv().is_err());
        assert_eq!(report.dropped_chunks, 1);
        assert_eq!(report.forwarded_bytes, 1024 * 1024);
    }
    #[test]
    fn masking_expansion_stays_bounded_without_breaking_utf8() {
        let mut redactor = super::Redactor::new(vec!["a".into()]);
        let output = redactor.feed(&format!("{}한글", "a".repeat(2048)), true);
        let chunks = super::output_chunks(&output);
        assert!(chunks.iter().all(|s| s.len() <= 4096));
        assert_eq!(chunks.concat(), output);
        assert!(!output.contains("aaaa"));
    }
}
