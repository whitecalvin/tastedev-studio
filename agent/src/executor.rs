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
        let inherited: [&str; 8] = [
            "PATH",
            "SystemRoot",
            "WINDIR",
            "TEMP",
            "TMP",
            "HOME",
            "USERPROFILE",
            "PATHEXT",
        ];
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
                if matches!(events.try_send(json!({"type":"output","jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"sequence":sequence,"stream":stream,"text":bytes})),Err(mpsc::TrySendError::Disconnected(_))){disconnected=true;break;}
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
            let _=events.try_send(json!({"type":"output","jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"sequence":sequence,"stream":stream,"text":bytes}));
        }
        let _ = out.join();
        let _ = err.join();
        Ok(())
    })();
    if operation.is_err() {
        status = "failed";
        exit = None;
    }
    json!({"type":"result","protocolVersion":VERSION,"jobId":request.job_id,"runId":request.run_id,"runStepId":request.run_step_id,"status":status,"exitCode":exit,"startedAt":started,"finishedAt":chrono::Utc::now().to_rfc3339(),"error":operation.err()})
}
pub fn probe(executable: &str, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new(executable);
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
    fn masking_expansion_stays_bounded_without_breaking_utf8() {
        let mut redactor = super::Redactor::new(vec!["a".into()]);
        let output = redactor.feed(&format!("{}한글", "a".repeat(2048)), true);
        let chunks = super::output_chunks(&output);
        assert!(chunks.iter().all(|s| s.len() <= 4096));
        assert_eq!(chunks.concat(), output);
        assert!(!output.contains("aaaa"));
    }
}
