use crate::model::*;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Runtime {
    node: PathBuf,
    runner: PathBuf,
    runner_hash: String,
    claude: PathBuf,
    python: PathBuf,
    bash: PathBuf,
    godot: PathBuf,
}
fn runtime() -> Result<(Runtime, PathBuf)> {
    let configured = std::env::var_os("TASTESTUDIO_FRAMEWORK_RUNTIME")
        .ok_or("Framework runtime is not configured")?;
    let file = PathBuf::from(configured);
    if !file.is_absolute() {
        return Err("Absolute framework runtime config required".into());
    }
    no_links(&file)?;
    let bytes = fs::read(&file).map_err(|_| "Framework runtime config unavailable")?;
    if bytes.len() > 16384 {
        return Err("Framework runtime config too large".into());
    }
    let runtime: Runtime =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid framework runtime config")?;
    for value in [
        &runtime.node,
        &runtime.runner,
        &runtime.claude,
        &runtime.python,
        &runtime.bash,
        &runtime.godot,
    ] {
        if !value.is_absolute() || !value.is_file() {
            return Err("Framework runtime executable unavailable".into());
        }
        no_links(value)?;
        let text = value.to_string_lossy().to_lowercase();
        if text.contains("windowsapps") || text.ends_with("system32\\bash.exe") {
            return Err("Runtime alias rejected".into());
        }
    }
    if runtime.runner.file_name().and_then(|n| n.to_str()) != Some("framework-agent-cli.ts") {
        return Err("Fixed framework runner required".into());
    }
    let script = fs::read(&runtime.runner).map_err(|_| "Framework runner unavailable")?;
    if runtime.runner_hash != format!("{:x}", Sha256::digest(script)) {
        return Err("Framework runner hash mismatch".into());
    }
    Ok((runtime, file))
}
pub fn available() -> bool {
    runtime().is_ok()
}
pub fn configure(request: &mut Request, cwd: &Path) -> Result<()> {
    if !request.executable.starts_with("internal-framework-") {
        return Ok(());
    }
    if request.requirements.framework_runtime != Some(1) || request.run_step_id.is_none() {
        return Err("Native framework capability required".into());
    }
    let (runtime, file) = runtime()?;
    if request.executable == "internal-framework-runner" {
        if !request.args.is_empty() || request.env.keys().any(|k| k != "TASTESTUDIO_FRAMEWORK_RUN")
        {
            return Err("Invalid native framework launcher".into());
        }
        let operation = request
            .env
            .get("TASTESTUDIO_FRAMEWORK_RUN")
            .ok_or("Missing framework operation")?;
        if operation.len() > 4096 {
            return Err("Framework operation too large".into());
        }
        let value: serde_json::Value =
            serde_json::from_str(operation).map_err(|_| "Invalid framework operation")?;
        if value["projectId"] != request.project_id || value["runId"] != request.run_id {
            return Err("Framework operation scope mismatch".into());
        }
        for key in ["APPDATA", "LOCALAPPDATA"] {
            if let Ok(value) = std::env::var(key) {
                request.env.insert(key.into(), value);
            }
        }
        request.executable = runtime.node.to_string_lossy().into_owned();
        request.args = vec![
            "--experimental-strip-types".into(),
            runtime.runner.to_string_lossy().into_owned(),
        ];
        request.env.insert(
            "TASTESTUDIO_FRAMEWORK_RUNTIME".into(),
            file.to_string_lossy().into_owned(),
        );
    } else if request.executable == "internal-framework-godot" {
        if request.env.keys().any(|k| {
            k != "TASTESTUDIO_FRAMEWORK_VERIFIED_SOURCE" && k != "TASTESTUDIO_FRAMEWORK_RUN"
        }) || request
            .args
            .iter()
            .any(|a| a == "--editor" || a == "--export-release" || a == "--export-debug")
        {
            return Err("Unapproved engine operation".into());
        }
        if let Some(expected) = request.env.get("TASTESTUDIO_FRAMEWORK_VERIFIED_SOURCE") {
            verify_output(cwd, expected)?;
        }
        let grant = request
            .env
            .get("TASTESTUDIO_FRAMEWORK_RUN")
            .cloned()
            .ok_or("Scoped Godot evidence grant required")?;
        request.env.clear();
        request
            .env
            .insert("TASTESTUDIO_FRAMEWORK_RUN".into(), grant);
        request.env.insert(
            "TASTESTUDIO_FRAMEWORK_RUNTIME".into(),
            file.to_string_lossy().into_owned(),
        );
        request.executable = runtime.node.to_string_lossy().into_owned();
        request.args = vec![
            "--experimental-strip-types".into(),
            runtime.runner.to_string_lossy().into_owned(),
        ];
    } else {
        return Err("Unknown native framework operation".into());
    }
    Ok(())
}
fn verify_output(root: &Path, expected: &str) -> Result<()> {
    let marker = root.join(".tastedev/framework-output.json");
    no_links(&marker)?;
    let bytes = fs::read(&marker).map_err(|_| "Verified framework Source marker required")?;
    if bytes.len() > 1024 * 1024 {
        return Err("Source marker too large".into());
    }
    let value: serde_json::Value =
        serde_json::from_slice(&bytes).map_err(|_| "Invalid Source marker")?;
    if value["checksum"] != expected {
        return Err("Native working tree identity mismatch".into());
    }
    let files = value["files"].as_array().ok_or("Invalid Source files")?;
    if files.len() > 20000 {
        return Err("Source file limit".into());
    }
    for file in files {
        let name = file["path"].as_str().ok_or("Invalid Source path")?;
        relative(name)?;
        let target = root.join(name);
        no_links(&target)?;
        if file["checksum"].is_null() {
            if target.exists() {
                return Err("Deleted Source file changed".into());
            }
            continue;
        }
        let mut input = fs::File::open(&target).map_err(|_| "Verified Source file unavailable")?;
        let mut digest = Sha256::new();
        let mut buffer = [0; 65536];
        loop {
            let n = input
                .read(&mut buffer)
                .map_err(|_| "Source verification failed")?;
            if n == 0 {
                break;
            }
            digest.update(&buffer[..n]);
        }
        if file["checksum"] != format!("{:x}", digest.finalize()) {
            return Err("Source changed before Godot validation".into());
        }
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn request(executable: &str) -> Request {
        serde_json::from_value(serde_json::json!({"protocolVersion":1,"type":"execute","agentId":"agent","jobId":"job","runId":"11111111-1111-4111-8111-111111111111","projectId":"project","requirements":{},"executable":executable,"args":[],"cwd":".","env":{},"timeoutMs":1000})).unwrap()
    }
    #[test]
    fn unnegotiated_native_operation_is_rejected_before_runtime_lookup() {
        let mut operation = request("internal-framework-runner");
        assert!(configure(&mut operation, Path::new("."))
            .unwrap_err()
            .contains("capability"));
        assert_eq!(operation.executable, "internal-framework-runner");
    }
    #[test]
    fn ordinary_commands_are_not_rewritten_into_native_framework_operations() {
        let mut operation = request("node");
        operation.args.push("--version".into());
        configure(&mut operation, Path::new(".")).unwrap();
        assert_eq!(operation.executable, "node");
        assert_eq!(operation.args, vec!["--version"]);
        assert!(operation.env.is_empty());
    }
}
