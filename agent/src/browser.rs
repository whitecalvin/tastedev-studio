use crate::{executor, model::*};
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, mpsc::SyncSender, Arc},
};
pub fn runner() -> Option<PathBuf> {
    std::env::var_os("TASTEDEV_BROWSER_RUNNER")
        .map(PathBuf::from)
        .filter(|p| p.is_absolute() && p.is_file())
}
pub fn execute(
    request: Request,
    root: &Path,
    cancel: Arc<AtomicBool>,
    events: SyncSender<Value>,
) -> Value {
    let started = chrono::Utc::now().to_rfc3339();
    let operation = (|| -> Result<Value> {
        let script = runner().ok_or("Playwright runner unavailable")?;
        let dir = crate::pipeline::cwd(
            root,
            &request.run_id,
            &format!(".evidence/{}", request.execution_id()),
        )?;
        let input = dir.join("input.json");
        no_links(&input)?;
        fs::write(&input,json!({"browser":request.browser,"transfer":request.artifact_transfer,"runId":request.run_id,"projectId":request.project_id,"runStepId":request.run_step_id,"maskValues":request.env.values().collect::<Vec<_>>()}).to_string()).map_err(|_|"Evidence input failed")?;
        let mut command = request.clone();
        command.executable = "node".into();
        command.args = vec![
            script.to_string_lossy().into_owned(),
            input.to_string_lossy().into_owned(),
        ];
        let mut value = executor::command(command, root, cancel, events, None);
        let _ = fs::remove_file(input);
        let output = dir.join("result.json");
        no_links(&output)?;
        if let Ok(meta) = fs::metadata(&output) {
            if meta.len() <= 32768 {
                if let Ok(text) = fs::read_to_string(output) {
                    if let Ok(summary) = serde_json::from_str::<Value>(&text) {
                        value["browserResult"] = summary;
                    }
                }
            }
        }
        if value.get("browserResult").is_none() {
            value["browserResult"] = json!({"total":0,"passed":0,"failed":0,"skipped":0,"duration":0,"browserVersion":"unknown","playwrightVersion":"unknown","classification":if value["status"]=="cancelled"{"CANCELLED"}else if value["status"]=="timeout"{"TIMEOUT"}else{"RUNNER_FAILED"},"failures":[],"consoleErrors":0,"pageErrors":0,"networkFailures":0,"evidenceWarnings":["Runner ended before final evidence report; partial uploads may be available."]});
        }
        Ok(value)
    })();
    operation.unwrap_or_else(|e|json!({"type":"result","protocolVersion":VERSION,"runId":request.run_id,"runStepId":request.run_step_id,"jobId":request.job_id,"status":"failed","exitCode":null,"startedAt":started,"finishedAt":chrono::Utc::now().to_rfc3339(),"error":e}))
}

/// Recover existing Evidence only; never restart a test or invent a successful Run.
pub fn resume_evidence(
    root: &Path,
    record: &Value,
    events: SyncSender<Value>,
    cancelled: Arc<AtomicBool>,
) -> Option<Value> {
    let run = record["runId"].as_str()?;
    let step = record["runStepId"].as_str()?;
    let project = record["projectId"].as_str()?;
    for value in [run, step, project] {
        uuid::Uuid::parse_str(value).ok()?;
    }
    let dir = crate::pipeline::cwd(root, run, &format!(".evidence/{step}")).ok()?;
    let input = dir.join("input.json");
    let manifest = dir.join("manifest.json");
    for file in [&input, &manifest] {
        no_links(file).ok()?;
        if fs::metadata(file).ok()?.len() > 65536 {
            return None;
        }
    }
    let saved: Value = serde_json::from_slice(&fs::read(&input).ok()?).ok()?;
    if saved["runId"] != run
        || saved["runStepId"] != step
        || saved["projectId"] != project
        || saved["transfer"]["resumable"] != true
    {
        return None;
    }
    let script = runner()?.with_file_name("resume.cjs");
    no_links(&script).ok()?;
    if !script.is_file() {
        return None;
    }
    let request:Request=serde_json::from_value(json!({"protocolVersion":VERSION,"type":"execute","agentId":"evidence-recovery","projectId":project,"runId":run,"runStepId":step,"jobId":record["jobId"],"executable":"node","args":[script,input],"cwd":format!(".evidence/{step}"),"env":{},"requirements":{},"stage":"test","timeoutMs":30000})).ok()?;
    let result = executor::command(request, root, cancelled, events, None);
    if result["status"] != "passed" {
        return None;
    }
    let output = dir.join("recovery-result.json");
    no_links(&output).ok()?;
    if fs::metadata(&output).ok()?.len() > 32768 {
        return None;
    }
    serde_json::from_slice(&fs::read(output).ok()?).ok()
}
