use super::*;
use crate::executor::execute;
pub(crate) fn request() -> Request {
    Request {
        protocol_version: 1,
        kind: "execute".into(),
        agent_id: "test-agent".into(),
        job_id: "job-1".into(),
        run_id: uuid::Uuid::new_v4().to_string(),
        project_id: "project-1".into(),
        requirements: Requirements::default(),
        executable: "node".into(),
        args: vec![
            "-e".into(),
            "process.stdout.write('hello');process.stderr.write('error');".into(),
        ],
        cwd: ".".into(),
        env: Default::default(),
        timeout_ms: 5000,
        run_step_id: None,
        stage: None,
        source: None,
        healthcheck: None,
        browser: None,
        artifact_transfer: None,
        build_artifact_transfer: None,
    }
}
#[test]
fn build_artifact_capability_does_not_require_transfer_on_cleanup() {
    let mut r = request();
    r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
    r.stage = Some("cleanup".into());
    r.requirements.build_artifacts = Some(1);
    assert!(r.validate("test-agent").is_ok());
}
#[test]
fn browser_request_requires_capabilities_and_safe_config() {
    let mut r = request();
    r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
    r.stage = Some("test".into());
    r.browser = Some(BrowserTest {
        engine: "playwright".into(),
        base_url: "http://127.0.0.1:3000".into(),
        config: "playwright.config.ts".into(),
    });
    assert!(r.validate("test-agent").is_err());
    r.requirements.browser = Some("chromium".into());
    r.requirements.runtimes = Some([("playwright".into(), ">=1.62.1".into())].into());
    r.artifact_transfer = Some(ArtifactTransfer {
        url: "http://127.0.0.1:4340/artifacts/run/step".into(),
        token: "a".repeat(64),
        resumable: false,
    });
    assert!(r.validate("test-agent").is_ok());
    r.browser.as_mut().unwrap().config = "../escape.ts".into();
    assert!(r.validate("test-agent").is_err());
    r.browser.as_mut().unwrap().config = "playwright.config.ts".into();
    r.browser.as_mut().unwrap().base_url = "http://external.test".into();
    assert!(r.validate("test-agent").is_err());
}
#[test]
fn streaming_redaction_preserves_utf8_and_split_secrets() {
    let mut r = executor::Redactor::new(vec!["long-secret".into(), "yes".into()]);
    assert_eq!(r.feed("한글 long-", false), "한글 ");
    assert_eq!(r.feed("secret yes!", false), "[redacted] [redacted]!");
    assert_eq!(r.feed("lon", true), "lon");
}
#[test]
fn capability_recheck_rejects_a_stale_advertised_runtime_before_execution() {
    let mut request = request();
    request.requirements.runtimes = Some([("node".into(), ">=999".into())].into());
    let advertised = Capabilities {
        source_snapshot: Some(2),
        build_artifacts: None,
        cpu_cores: 2,
        memory_mi_b: 1024,
        docker: false,
        gpu: false,
        pty: false,
        runtimes: [("node".into(), "999.0.0".into())].into(),
        browsers: vec![],
    };
    assert!(request.matches(&advertised));
    assert!(executor::verify_capabilities(&request, advertised, &AtomicBool::new(false)).is_err());
}
#[test]
fn execution_observation_omits_unrequested_stale_runtime_inventory() {
    let request = request();
    let advertised = Capabilities {
        source_snapshot: Some(2),
        build_artifacts: None,
        cpu_cores: 2,
        memory_mi_b: 2048,
        docker: false,
        gpu: false,
        pty: false,
        runtimes: [("node".into(), "999.0.0".into())].into(),
        browsers: vec!["chromium".into()],
    };
    let observed =
        executor::verify_capabilities(&request, advertised, &AtomicBool::new(false)).unwrap();
    assert!(observed.runtimes.is_empty());
    assert!(observed.browsers.is_empty());
}
#[test]
fn capability_check_observes_cancellation_before_starting_a_tool_probe() {
    let mut request = request();
    request.requirements.runtimes = Some([("node".into(), ">=24".into())].into());
    let advertised = Capabilities {
        source_snapshot: Some(2),
        build_artifacts: None,
        cpu_cores: 2,
        memory_mi_b: 1024,
        docker: false,
        gpu: false,
        pty: false,
        runtimes: [("node".into(), "24.11.1".into())].into(),
        browsers: vec![],
    };
    assert_eq!(
        executor::verify_capabilities(&request, advertised, &AtomicBool::new(true)).unwrap_err(),
        "Capability check cancelled"
    );
}
#[test]
fn capability_probe_does_not_inherit_agent_credentials() {
    let output = executor::probe(
        "node",
        &[
            "-e",
            "process.stdout.write(String(process.env.TASTEDEV_AGENT_TOKEN))",
        ],
    );
    // Never print the captured output: if isolation regresses it could be sensitive.
    assert!(output.as_deref().is_some_and(|text| text == "undefined"));
}
#[test]
fn capability_probe_respects_task_path_instead_of_agent_path() {
    let empty = tempfile::tempdir().unwrap();
    let mut request = request();
    request
        .env
        .insert("PATH".into(), empty.path().to_string_lossy().into());
    request.requirements.runtimes = Some([("git".into(), ">=1".into())].into());
    let advertised = Capabilities {
        source_snapshot: Some(2),
        build_artifacts: None,
        cpu_cores: 2,
        memory_mi_b: 1024,
        docker: false,
        gpu: false,
        pty: false,
        runtimes: [("git".into(), "2.0.0".into())].into(),
        browsers: vec![],
    };
    assert!(request.matches(&advertised));
    assert!(executor::verify_capabilities(&request, advertised, &AtomicBool::new(false)).is_err());
}
#[test]
fn source_and_health_validation() {
    let source = Source {
        trusted_core: None,
        provider: "git".into(),
        repository: "https://example.org/project.git".into(),
        revision: "main".into(),
        snapshot: None,
    };
    assert!(pipeline::validate_source(&source).is_ok());
    for repository in [
        "file:///C:/outside",
        "https://user:secret@example.org/repo",
        "https://example.org/repo?secret=x",
        "ssh://example.org/repo",
    ] {
        assert!(pipeline::validate_source(&Source {
            repository: repository.into(),
            ..source.clone()
        })
        .is_err());
    }
    let health = Health {
        url: "http://127.0.0.1:4321/health".into(),
        expected_status: 200,
        retry_interval_ms: 100,
    };
    assert!(pipeline::validate_health(&health).is_ok());
    for url in [
        "http://example.org/",
        "https://127.0.0.1/",
        "http://a@127.0.0.1/",
        "http://127.0.0.1/?token=a",
    ] {
        assert!(pipeline::validate_health(&Health {
            url: url.into(),
            ..health.clone()
        })
        .is_err());
    }
}
#[test]
fn pipeline_reuses_isolated_workspace_and_cleans_up() {
    let root = tempfile::tempdir().unwrap();
    let sessions: pipeline::Sessions = Arc::new(std::sync::Mutex::new(None));
    let (tx, rx) = mpsc::sync_channel(64);
    let reader = thread::spawn(move || rx.into_iter().collect::<Vec<_>>());
    let mut r = request();
    r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
    r.stage = Some("install".into());
    r.args = vec![
        "-e".into(),
        "require('fs').writeFileSync('prepared','yes')".into(),
    ];
    let flag = Arc::new(AtomicBool::new(false));
    assert_eq!(
        pipeline::execute(
            r.clone(),
            root.path(),
            flag.clone(),
            tx.clone(),
            sessions.clone()
        )["status"],
        "passed"
    );
    r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
    r.stage = Some("test".into());
    r.args = vec![
        "-e".into(),
        "if(require('fs').readFileSync('prepared','utf8')!=='yes')process.exit(8)".into(),
    ];
    assert_eq!(
        pipeline::execute(
            r.clone(),
            root.path(),
            flag.clone(),
            tx.clone(),
            sessions.clone()
        )["status"],
        "passed"
    );
    r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
    r.stage = Some("cleanup".into());
    r.executable = "internal-stop-services".into();
    assert_eq!(
        pipeline::execute(r, root.path(), flag, tx, sessions.clone())["status"],
        "passed"
    );
    assert!(sessions.lock().unwrap().is_none());
    reader.join().unwrap();
}
#[test]
fn health_immediate_retry_invalid_response_timeout_and_cancel() {
    use std::io::{Read, Write};
    use std::net::TcpListener;
    for failures in [0, 2] {
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = server.local_addr().unwrap().port();
        let thread = thread::spawn(move || {
            for i in 0..=failures {
                let (mut s, _) = server.accept().unwrap();
                let mut b = [0; 1];
                let mut headers = Vec::new();
                while headers.len() < 4096
                    && !headers.ends_with(b"\r\n\r\n")
                    && s.read(&mut b).unwrap_or(0) == 1
                {
                    headers.push(b[0]);
                }
                let response = if i < failures {
                    "INVALID\r\n\r\n"
                } else {
                    "HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n"
                };
                let _ = s.write_all(response.as_bytes());
            }
        });
        let root = tempfile::tempdir().unwrap();
        let (tx, rx) = mpsc::sync_channel(64);
        let mut r = request();
        r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
        r.stage = Some("healthcheck".into());
        r.healthcheck = Some(Health {
            url: format!("http://127.0.0.1:{port}/health"),
            expected_status: 200,
            retry_interval_ms: 100,
        });
        let sessions = Arc::new(std::sync::Mutex::new(None));
        assert_eq!(
            pipeline::execute(
                r,
                root.path(),
                Arc::new(AtomicBool::new(false)),
                tx,
                sessions
            )["status"],
            "passed"
        );
        assert_eq!(rx.into_iter().count(), failures + 1);
        thread.join().unwrap();
    }
    for (cancel, status) in [(false, "timeout"), (true, "cancelled")] {
        let server = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = server.local_addr().unwrap().port();
        drop(server);
        let root = tempfile::tempdir().unwrap();
        let (tx, _rx) = mpsc::sync_channel(64);
        let mut r = request();
        r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
        r.stage = Some("healthcheck".into());
        r.timeout_ms = 150;
        r.healthcheck = Some(Health {
            url: format!("http://127.0.0.1:{port}/"),
            expected_status: 200,
            retry_interval_ms: 100,
        });
        assert_eq!(
            pipeline::execute(
                r,
                root.path(),
                Arc::new(AtomicBool::new(cancel)),
                tx,
                Arc::new(std::sync::Mutex::new(None))
            )["status"],
            status
        );
    }
}
#[test]
fn persistent_identity() {
    let root = tempfile::tempdir().unwrap();
    assert_eq!(
        identity(root.path()).unwrap(),
        identity(root.path()).unwrap()
    );
}
#[test]
fn config_validation() {
    let c:Config=serde_json::from_value(json!({"endpoint":"ws://127.0.0.1:4340/agent","name":"test","workspaceRoot":std::env::temp_dir()})).unwrap();
    assert!(c.validate().is_ok());
    let mut c = c;
    c.endpoint = "ws://example.com/agent".into();
    assert!(c.validate().is_err());
}
#[test]
fn command_and_protocol_validation() {
    let r = request();
    assert!(r.validate("test-agent").is_ok());
    let mut r = r;
    r.protocol_version = 2;
    assert!(r.validate("test-agent").is_err());
    r.protocol_version = 1;
    r.executable = "../bad.exe".into();
    assert!(r.validate("test-agent").is_err());
}
#[test]
fn workspace_boundary_and_duplicate() {
    let root = tempfile::tempdir().unwrap();
    let r = request();
    for p in ["../x", "C:\\outside", "/etc", "a/../../b"] {
        assert!(workspace(root.path(), &r.run_id, p).is_err());
    }
    assert!(workspace(root.path(), &r.run_id, ".").is_ok());
    assert!(workspace(root.path(), &r.run_id, ".").is_err());
}
#[test]
fn capability_matching() {
    let r = request();
    let c = Capabilities {
        source_snapshot: Some(2),
        build_artifacts: None,
        cpu_cores: 2,
        memory_mi_b: 4096,
        docker: false,
        gpu: false,
        pty: false,
        runtimes: Default::default(),
        browsers: vec![],
    };
    assert!(r.matches(&c));
    let mut r = r;
    r.requirements.docker = Some("required".into());
    assert!(!r.matches(&c));
}
fn execution(mut r: Request, cancel: bool) -> Value {
    let root = tempfile::tempdir().unwrap();
    let (tx, rx) = mpsc::sync_channel(64);
    let reader = thread::spawn(move || rx.into_iter().collect::<Vec<_>>());
    let flag = Arc::new(AtomicBool::new(cancel));
    r.agent_id = "test-agent".into();
    let result = execute(r, root.path(), flag, tx);
    let events = reader.join().unwrap();
    if result["status"] == "passed" {
        assert!(events.iter().any(|e| e["stream"] == "stdout"));
        assert!(events.iter().any(|e| e["stream"] == "stderr"));
    }
    result
}
#[test]
fn process_success_streams() {
    assert_eq!(execution(request(), false)["status"], "passed");
}
#[test]
fn process_failure() {
    let mut r = request();
    r.args = vec!["-e".into(), "process.exit(7)".into()];
    let result = execution(r, false);
    assert_eq!(result["status"], "failed");
    assert_eq!(result["exitCode"], 7);
}
#[test]
fn process_timeout() {
    let mut r = request();
    r.args = vec!["-e".into(), "setInterval(()=>{},1000)".into()];
    r.timeout_ms = 150;
    assert_eq!(execution(r, false)["status"], "timeout");
}
#[test]
fn process_cancel() {
    assert_eq!(execution(request(), true)["status"], "cancelled");
}
#[test]
fn process_start_failure() {
    let mut r = request();
    r.executable = "tastedev-not-a-real-executable".into();
    assert_eq!(execution(r, false)["status"], "failed");
}
#[test]
fn utf8_chunks_preserve_split_characters() {
    let mut pending = Vec::new();
    let bytes = "한글🦀".as_bytes();
    let mut text = String::new();
    for byte in bytes {
        text.push_str(&crate::executor::decode_chunk(
            &mut pending,
            &[*byte],
            false,
        ));
    }
    assert_eq!(text, "한글🦀");
    assert!(pending.is_empty());
}
#[cfg(unix)]
#[test]
fn symlink_escape_rejected() {
    use std::os::unix::fs::symlink;
    let root = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    symlink(outside.path(), root.path().join("runs")).unwrap();
    assert!(workspace(root.path(), &uuid::Uuid::new_v4().to_string(), ".").is_err());
}
#[cfg(windows)]
#[test]
fn junction_escape_rejected() {
    let root = tempfile::tempdir().unwrap();
    let outside = tempfile::tempdir().unwrap();
    let junction = root.path().join("runs");
    let status = std::process::Command::new("cmd")
        .args(["/c", "mklink", "/J"])
        .arg(&junction)
        .arg(outside.path())
        .output()
        .unwrap();
    assert!(status.status.success());
    assert!(workspace(root.path(), &uuid::Uuid::new_v4().to_string(), ".").is_err());
    std::fs::remove_dir(junction).unwrap();
}

#[test]
fn compiler_environment_is_narrow_and_never_inherits_credentials() {
    for executable in ["node", "python", "git", "cargo-other", "shell"] {
        let keys = executor::inherited_environment(executable);
        assert!(!keys.contains(&"LIB"));
        assert!(!keys.contains(&"TASTEDEV_AGENT_TOKEN"));
        assert!(!keys.contains(&"OPENAI_API_KEY"));
    }
    for executable in ["cargo", "rustc"] {
        let keys = executor::inherited_environment(executable);
        assert_eq!(keys.contains(&"LIB"), cfg!(windows));
        assert!(!keys.contains(&"TASTEDEV_AGENT_TOKEN"));
        assert!(!keys.contains(&"OPENAI_API_KEY"));
    }
}

#[test]
fn build_artifact_paths_and_contract_fail_closed() {
    for path in [
        "../app.exe",
        "/tmp/app",
        "out\\app.exe",
        "out/con.exe",
        ".env",
        "a/credentials.json",
        "out/app:p",
        "out//app",
        "out/app.",
    ] {
        assert!(crate::build_artifact::safe_path(path).is_err(), "{path}");
    }
    assert!(crate::build_artifact::safe_path("out/app.exe").is_ok());
    let mut r = request();
    r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
    r.stage = Some("build".into());
    r.requirements.build_artifacts = Some(1);
    r.env.insert("TASTEDEV_GRAPH_CONTEXT".into(),serde_json::json!({"executionId":"execution-1","revision":1,"snapshotId":"snapshot-1","sourceChecksum":"a".repeat(64)}).to_string());
    let value = serde_json::json!({"version":1,"outputs":[{"name":"desktop","path":"out/app.exe","id":"a".repeat(64),"url":format!("http://127.0.0.1:4340/build-artifacts/upload/{}","a".repeat(64)),"token":"b".repeat(64)}],"inputs":[]});
    let mut transfer: crate::build_artifact::Transfer = serde_json::from_value(value).unwrap();
    assert!(transfer.validate(&r).is_err());
    transfer.trusted_core = Some("ws://127.0.0.1:4340/agent".into());
    assert!(transfer.validate(&r).is_ok());
    assert!(!format!("{transfer:?}").contains(&"b".repeat(64)));
    transfer.outputs[0].url = format!(
        "http://example.invalid/build-artifacts/upload/{}",
        "a".repeat(64)
    );
    assert!(transfer.validate(&r).is_err());
    transfer.outputs[0].url = format!(
        "http://127.0.0.1:4340/build-artifacts/upload/{}",
        "a".repeat(64)
    );
    transfer.outputs[0].path = "../escape.exe".into();
    assert!(transfer.validate(&r).is_err());
}
#[test]
fn build_artifact_input_project_and_snapshot_lineage_are_required() {
    let mut r = request();
    r.run_step_id = Some(uuid::Uuid::new_v4().to_string());
    r.stage = Some("test".into());
    r.requirements.build_artifacts = Some(1);
    r.env.insert("TASTEDEV_GRAPH_CONTEXT".into(),serde_json::json!({"executionId":"execution-1","revision":1,"snapshotId":"snapshot-1","sourceChecksum":"a".repeat(64)}).to_string());
    let value = serde_json::json!({"version":1,"outputs":[],"inputs":[{"name":"desktop","path":"received/app.exe","url":format!("http://127.0.0.1:4340/build-artifacts/download/{}","a".repeat(64)),"token":"b".repeat(64),"artifact":{"version":1,"id":"a".repeat(64),"projectId":r.project_id,"executionId":"execution-1","graphRevision":1,"producerActivationId":"producer-1","producerNodeId":"build","producerRunId":"run-1","producerStepId":"step-1","snapshotId":"snapshot-1","sourceChecksum":"a".repeat(64),"name":"desktop","path":"out/app.exe","size":5,"checksum":"c".repeat(64)}}]});
    let mut transfer: crate::build_artifact::Transfer = serde_json::from_value(value).unwrap();
    transfer.trusted_core = Some("ws://127.0.0.1:4340/agent".into());
    assert!(transfer.validate(&r).is_ok());
    transfer.inputs[0].artifact.project_id = "other".into();
    assert!(transfer.validate(&r).is_err());
    transfer.inputs[0].artifact.project_id = r.project_id.clone();
    transfer.inputs[0].artifact.snapshot_id = "other".into();
    assert!(transfer.validate(&r).is_err());
}
