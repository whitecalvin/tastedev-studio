use crate::model::Result;
use serde::{Deserialize, Serialize};
mod bundle;
mod catalog;
mod context;
#[cfg(windows)]
mod journal;
mod recovery;
pub use recovery::{recover_recorded, ClaimPhase};
mod mirror;
#[cfg(windows)]
mod outputs;
#[cfg(windows)]
mod prepared;
#[cfg(windows)]
mod runtime;
mod versions;

/// Trusted parent callbacks only. Raw bytes are decoded/masked before entering
/// the bounded transport; a disconnected consumer cancels the owned process.
pub struct OutputObserver<'a> {
    pub secrets: Vec<String>,
    pub receive: &'a mut dyn FnMut(&str, &str) -> bool,
    pub dropped_chunks: u64,
    pub dropped_bytes: u64,
    /// Set only after all private inputs have actually been installed/verified.
    /// Retained even when a later command or result upload fails.
    pub artifact_installation: Option<serde_json::Value>,
}
pub enum CommandExit {
    Completed(u32),
    TimedOut,
    Cancelled,
}
/// A catalog or stored receipt cannot activate admission. Only this process's
/// completed live OS/descendant/version qualification owns a Runtime lease.
pub fn qualify_capabilities(capabilities: &mut crate::model::Capabilities) {
    capabilities.execution_isolation = None;
    capabilities.isolated_child_processes = None;
    #[cfg(windows)]
    if let Some(limit) = runtime::qualified_process_limit() {
        capabilities.execution_isolation = Some(1);
        capabilities.isolated_child_processes = (limit > 1).then_some(limit);
    }
}
fn trusted_cleanup(request: &crate::model::Request) -> Result<bool> {
    if request.stage.as_deref() != Some("cleanup") || request.executable != "internal-stop-services"
    {
        return Ok(false);
    }
    if !request.args.is_empty()
        || request.cwd != "."
        || request.isolation.is_some()
        || request.source.is_some()
        || request.healthcheck.is_some()
        || request.browser.is_some()
        || request.artifact_transfer.is_some()
        || request.build_artifact_transfer.is_some()
    {
        return Err("Unexpected operation in fixed isolated cleanup".into());
    }
    Ok(true)
}
pub fn verify_request(request: &crate::model::Request) -> Result<()> {
    #[cfg(windows)]
    {
        runtime::verify_request(request)
    }
    #[cfg(not(windows))]
    {
        let _ = request;
        Err("Required OS execution isolation backend is not qualified".into())
    }
}
/// Only live, private-probed program facts; never the parent's PATH inventory.
pub fn observed_runtimes(
    request: &crate::model::Request,
) -> Result<std::collections::BTreeMap<String, String>> {
    #[cfg(windows)]
    {
        runtime::observed_runtimes(request)
    }
    #[cfg(not(windows))]
    {
        let _ = request;
        Err("Required OS execution isolation backend is not qualified".into())
    }
}
pub fn execute(
    request: &crate::model::Request,
    root: &std::path::Path,
    cancel: &std::sync::Arc<std::sync::atomic::AtomicBool>,
    observer: &mut OutputObserver<'_>,
) -> Result<CommandExit> {
    #[cfg(windows)]
    {
        runtime::execute(request, root, cancel, observer)
    }
    #[cfg(not(windows))]
    {
        let _ = (request, root, cancel, observer);
        Err("Required OS execution isolation backend is not qualified".into())
    }
}
#[cfg(windows)]
mod windows;

pub fn initialize(
    catalog: Option<&std::path::Path>,
    root: &std::path::Path,
    agent: &str,
    token_key: &str,
    cancel: &std::sync::atomic::AtomicBool,
) -> Result<()> {
    let Some(catalog) = catalog else {
        return Ok(());
    };
    #[cfg(windows)]
    {
        runtime::initialize(catalog, root, agent, token_key, cancel)
    }
    #[cfg(not(windows))]
    {
        let _ = (catalog, root, agent, token_key, cancel);
        Err("Configured execution isolation backend is unavailable on this platform".into())
    }
}

/// Internal fixed-function entry point. It cannot start Core, read credentials,
/// or run caller-selected commands. Windows validates the actual child token.
pub fn self_check_child() -> Result<()> {
    #[cfg(windows)]
    {
        windows::probe::run()
    }
    #[cfg(not(windows))]
    {
        Err("Isolation self-check child is unavailable on this platform".into())
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Policy {
    pub version: u32,
    pub filesystem: String,
    pub network: String,
    pub child_processes: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_processes: Option<u32>,
}

impl Policy {
    pub fn validate(&self) -> Result<()> {
        let children =
            (self.version == 1 && self.child_processes == "deny" && self.max_processes.is_none())
                || (self.version == 2
                    && self.child_processes == "bounded"
                    && self.max_processes.is_some_and(|n| (2..=4).contains(&n)));
        if !children || self.filesystem != "workspace" || self.network != "deny" {
            return Err("Unsupported execution isolation policy".into());
        }
        Ok(())
    }
    pub fn process_limit(&self) -> u32 {
        self.max_processes.unwrap_or(1)
    }
    pub fn validate_approval(&self, requirements: &crate::model::Requirements) -> Result<()> {
        self.validate()?;
        if requirements
            .isolated_child_processes
            .is_some_and(|n| !(2..=4).contains(&n))
        {
            return Err("Invalid approved child bound".into());
        }
        if requirements.execution_isolation != Some(1)
            || self.process_limit() > requirements.isolated_child_processes.unwrap_or(1)
        {
            return Err("Isolated child policy exceeds approved requirements".into());
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn fixed_cleanup_never_authorizes_source_selected_operations() {
        let mut request = crate::tests::request();
        request.stage = Some("cleanup".into());
        request.executable = "internal-stop-services".into();
        request.args.clear();
        request.cwd = ".".into();
        assert!(trusted_cleanup(&request).unwrap());
        request.args.push("source-command".into());
        assert!(trusted_cleanup(&request).is_err());
        request.args.clear();
        request.cwd = "source".into();
        assert!(trusted_cleanup(&request).is_err());
    }
    #[test]
    fn bounded_children_need_a_separate_approved_scope() {
        let policy:Policy=serde_json::from_value(serde_json::json!({"version":2,"filesystem":"workspace","network":"deny","childProcesses":"bounded","maxProcesses":2})).unwrap();
        let mut requirements = crate::model::Requirements {
            execution_isolation: Some(1),
            ..Default::default()
        };
        assert!(policy.validate_approval(&requirements).is_err());
        requirements.isolated_child_processes = Some(2);
        assert!(policy.validate_approval(&requirements).is_ok());
        requirements.isolated_child_processes = Some(5);
        assert!(policy.validate_approval(&requirements).is_err());
        for value in [0, 1, 5] {
            let mut changed = policy.clone();
            changed.max_processes = Some(value);
            assert!(changed.validate().is_err());
        }
    }
    #[test]
    fn unknown_or_weakened_policy_is_not_accepted() {
        let valid = serde_json::json!({"version":1,"filesystem":"workspace","network":"deny","childProcesses":"deny"});
        let policy: Policy = serde_json::from_value(valid.clone()).unwrap();
        assert!(policy.validate().is_ok());
        for (key, value) in [
            ("version", serde_json::json!(2)),
            ("filesystem", serde_json::json!("host")),
            ("network", serde_json::json!("allow")),
            ("childProcesses", serde_json::json!("allow")),
        ] {
            let mut changed = valid.clone();
            changed[key] = value;
            assert!(serde_json::from_value::<Policy>(changed)
                .unwrap()
                .validate()
                .is_err());
        }
        let mut unknown = valid;
        unknown["outsidePath"] = serde_json::json!("C:/Users");
        assert!(serde_json::from_value::<Policy>(unknown).is_err());
    }
}
