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
        fs::write(&input,json!({"browser":request.browser,"transfer":request.artifact_transfer,"runId":request.run_id,"runStepId":request.run_step_id,"maskValues":request.env.values().collect::<Vec<_>>()}).to_string()).map_err(|_|"Evidence input failed")?;
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
