use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
};
use uuid::Uuid;
pub type Result<T> = std::result::Result<T, String>;
pub const VERSION: u32 = 1;
pub const MAX_MESSAGE: usize = 65536;
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Config {
    pub endpoint: String,
    pub name: String,
    pub workspace_root: PathBuf,
    #[serde(default = "heartbeat")]
    pub heartbeat_ms: u64,
    #[serde(default = "reconnect")]
    pub reconnect_max_ms: u64,
    #[serde(default = "token_env")]
    pub token_env: String,
    #[serde(default = "log_level")]
    pub log_level: String,
    #[serde(default)]
    pub allow_insecure_lan: bool,
}
fn heartbeat() -> u64 {
    2000
}
fn reconnect() -> u64 {
    10000
}
fn token_env() -> String {
    "TASTEDEV_AGENT_TOKEN".into()
}
fn log_level() -> String {
    "info".into()
}
impl Config {
    pub fn validate(&self) -> Result<()> {
        let uri = self
            .endpoint
            .parse::<tungstenite::http::Uri>()
            .map_err(|_| "Invalid endpoint")?;
        if ![Some("ws"), Some("wss")].contains(&uri.scheme_str())
            || uri.path() != "/agent"
            || uri.query().is_some()
            || uri.authority().is_some_and(|a| a.as_str().contains('@'))
        {
            return Err("Use a WebSocket /agent endpoint without credentials or query".into());
        }
        if uri.scheme_str() == Some("ws")
            && !matches!(uri.host(), Some("127.0.0.1" | "localhost" | "[::1]"))
            && !self.allow_insecure_lan
        {
            return Err("Plaintext LAN requires explicit allowInsecureLan".into());
        }
        if self.name.trim().is_empty()
            || self.name.len() > 120
            || !self.workspace_root.is_absolute()
            || !(200..=10000).contains(&self.heartbeat_ms)
            || !(500..=60000).contains(&self.reconnect_max_ms)
            || !matches!(self.log_level.as_str(), "error" | "info")
        {
            return Err("Invalid configuration".into());
        }
        Ok(())
    }
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Capabilities {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_snapshot: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub build_artifacts: Option<u32>,
    pub cpu_cores: u64,
    pub memory_mi_b: u64,
    pub docker: bool,
    pub gpu: bool,
    pub pty: bool,
    pub runtimes: BTreeMap<String, String>,
    pub browsers: Vec<String>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Requirements {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_snapshot: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub build_artifacts: Option<u32>,
    pub platform: Option<String>,
    pub architecture: Option<String>,
    pub cpu_cores: Option<u64>,
    pub memory_mi_b: Option<u64>,
    pub docker: Option<String>,
    pub gpu: Option<String>,
    pub pty: Option<String>,
    pub runtimes: Option<BTreeMap<String, String>>,
    pub browser: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub protocol_version: u32,
    #[serde(rename = "type")]
    pub kind: String,
    pub agent_id: String,
    pub job_id: String,
    pub run_id: String,
    pub project_id: String,
    pub requirements: Requirements,
    pub executable: String,
    pub args: Vec<String>,
    pub cwd: String,
    pub env: BTreeMap<String, String>,
    pub timeout_ms: u64,
    #[serde(default)]
    pub run_step_id: Option<String>,
    #[serde(default)]
    pub stage: Option<String>,
    #[serde(default)]
    pub source: Option<Source>,
    #[serde(default)]
    pub healthcheck: Option<Health>,
    #[serde(default)]
    pub browser: Option<BrowserTest>,
    #[serde(default)]
    pub artifact_transfer: Option<ArtifactTransfer>,
    #[serde(default)]
    pub build_artifact_transfer: Option<crate::build_artifact::Transfer>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BrowserTest {
    pub engine: String,
    pub base_url: String,
    pub config: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct ArtifactTransfer {
    pub url: String,
    pub token: String,
    #[serde(default)]
    pub resumable: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Source {
    #[serde(skip)]
    pub trusted_core: Option<String>,
    pub provider: String,
    pub repository: String,
    pub revision: String,
    #[serde(default)]
    pub snapshot: Option<crate::snapshot::Snapshot>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Health {
    pub url: String,
    pub expected_status: u16,
    pub retry_interval_ms: u64,
}
fn id(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 100
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}
pub fn relative(path: &str) -> Result<()> {
    if path.is_empty()
        || path.len() > 240
        || path.contains(['\0', ':'])
        || Path::new(path).is_absolute()
        || path.starts_with(['\\', '/'])
        || path
            .split(['\\', '/'])
            .any(|p| p == ".." || p.ends_with(' ') || p.ends_with('.') && p != ".")
    {
        return Err("Unsafe working directory".into());
    }
    Ok(())
}
impl Request {
    pub fn execution_id(&self) -> &str {
        self.run_step_id.as_deref().unwrap_or(&self.run_id)
    }
    pub fn validate(&self, agent: &str) -> Result<()> {
        if let Some(step) = &self.run_step_id {
            Uuid::parse_str(step).map_err(|_| "Invalid step ID")?;
            if !matches!(
                self.stage.as_deref(),
                Some("source" | "install" | "build" | "start" | "healthcheck" | "test" | "cleanup")
            ) {
                return Err("Invalid pipeline stage".into());
            }
        } else if self.stage.is_some() || self.source.is_some() || self.healthcheck.is_some() {
            return Err("Step identity required".into());
        }
        if let Some(source) = &self.source {
            if source
                .snapshot
                .as_ref()
                .is_some_and(|s| s.schema_version == Some(2))
                && self.requirements.source_snapshot != Some(2)
            {
                return Err("Source capability required".into());
            }
            crate::pipeline::validate_source(source)?;
        }
        if let Some(health) = &self.healthcheck {
            crate::pipeline::validate_health(health)?;
        }
        if (self.stage.as_deref() == Some("source")) != self.source.is_some()
            || (self.stage.as_deref() == Some("healthcheck")) != self.healthcheck.is_some()
        {
            return Err("Invalid step operation".into());
        }
        if self.protocol_version != VERSION
            || self.kind != "execute"
            || self.agent_id != agent
            || !id(&self.job_id)
            || !id(&self.project_id)
            || Uuid::parse_str(&self.run_id).is_err()
        {
            return Err("Invalid execution identity or protocol".into());
        }
        relative(&self.cwd)?;
        if let Some(browser) = &self.browser {
            if self.stage.as_deref() != Some("test")
                || browser.engine != "playwright"
                || self.requirements.browser.as_deref() != Some("chromium")
                || !self
                    .requirements
                    .runtimes
                    .as_ref()
                    .is_some_and(|r| r.contains_key("playwright"))
            {
                return Err("Invalid browser operation".into());
            }
            relative(&browser.config)?;
            crate::pipeline::validate_health(&Health {
                url: browser.base_url.clone(),
                expected_status: 200,
                retry_interval_ms: 100,
            })?;
            let transfer = self
                .artifact_transfer
                .as_ref()
                .ok_or("Missing artifact transfer")?;
            let uri: tungstenite::http::Uri =
                transfer.url.parse().map_err(|_| "Invalid transfer URL")?;
            if !matches!(uri.scheme_str(), Some("http" | "https"))
                || uri.authority().is_some_and(|a| a.as_str().contains('@'))
                || uri.query().is_some()
                || transfer.token.len() < 32
                || transfer.token.len() > 128
            {
                return Err("Invalid transfer contract".into());
            }
        } else if self.artifact_transfer.is_some() {
            return Err("Browser required for transfer".into());
        }
        if let Some(transfer) = &self.build_artifact_transfer {
            transfer.validate(self)?;
        }
        // Bare executable name or explicit absolute binary; no relative executable path / shell wrapper.
        let exe = &self.executable;
        if exe.is_empty()
            || exe.len() > 240
            || exe.contains(['\0', '\n', '\r'])
            || (!Path::new(exe).is_absolute() && exe.contains(['\\', '/']))
            || exe.to_lowercase().ends_with(".cmd")
            || exe.to_lowercase().ends_with(".bat")
            || self.args.len() > 100
            || self.args.iter().any(|a| a.len() > 1024 || a.contains('\0'))
            || !(100..=3600000).contains(&self.timeout_ms)
            || self.env.len() > 32
            || self.env.iter().any(|(k, v)| {
                k.is_empty()
                    || k.len() > 64
                    || !k.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
                    || v.len() > 4096
                    || v.contains('\0')
            })
        {
            return Err("Invalid structured command".into());
        }
        Ok(())
    }
    pub fn matches(&self, c: &Capabilities) -> bool {
        let r = &self.requirements;
        r.source_snapshot
            .is_none_or(|v| v == 2 && c.source_snapshot == Some(2))
            && r.build_artifacts.is_none_or(|v| {
                matches!(v, 1 | 2) && c.build_artifacts.is_some_and(|cap| cap >= v && cap <= 2)
            })
            && r.platform.as_ref().is_none_or(|v| v == platform())
            && r.architecture.as_ref().is_none_or(|v| v == architecture())
            && r.cpu_cores.is_none_or(|v| c.cpu_cores >= v)
            && r.memory_mi_b.is_none_or(|v| c.memory_mi_b >= v)
            && r.docker
                .as_ref()
                .is_none_or(|v| v == "required" && c.docker)
            && r.gpu
                .as_ref()
                .is_none_or(|v| v == "optional" || v == "required" && c.gpu)
            && r.pty.as_ref().is_none_or(|v| v == "required" && c.pty)
            && r.browser.as_ref().is_none_or(|v| c.browsers.contains(v))
            && r.runtimes.as_ref().is_none_or(|rs| {
                rs.iter().all(|(k, v)| {
                    v.strip_prefix(">=").is_some_and(|min| {
                        c.runtimes.get(k).is_some_and(|actual| {
                            version(actual) >= version(min) && version(min).is_some()
                        })
                    })
                })
            })
    }
}
fn version(s: &str) -> Option<[u32; 3]> {
    let mut v = [0; 3];
    let parts: Vec<_> = s.split('.').collect();
    if parts.is_empty() || parts.len() > 3 {
        return None;
    }
    for (i, p) in parts.iter().enumerate() {
        v[i] = p.parse().ok()?;
    }
    Some(v)
}
pub fn platform() -> &'static str {
    if cfg!(windows) {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}
pub fn architecture() -> &'static str {
    if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x86_64"
    }
}
pub fn no_links(path: &Path) -> Result<()> {
    for ancestor in path.ancestors() {
        if let Ok(meta) = fs::symlink_metadata(ancestor) {
            if meta.file_type().is_symlink() {
                return Err("Symlink workspace rejected".into());
            }
            #[cfg(windows)]
            {
                use std::os::windows::fs::MetadataExt;
                if meta.file_attributes() & 0x400 != 0 {
                    return Err("Reparse workspace rejected".into());
                }
            }
        }
    }
    Ok(())
}
pub fn prepare_root(root: &Path) -> Result<PathBuf> {
    no_links(root)?;
    fs::create_dir_all(root).map_err(|_| "Cannot create workspace root")?;
    no_links(root)?;
    root.canonicalize()
        .map_err(|_| "Cannot resolve workspace root".into())
}
pub fn identity(root: &Path) -> Result<String> {
    let p = root.join("agent-id.json");
    no_links(&p)?;
    if p.exists() {
        let id = fs::read_to_string(p).map_err(|_| "Identity read failed")?;
        Uuid::parse_str(id.trim()).map_err(|_| "Invalid persisted identity")?;
        return Ok(id.trim().into());
    }
    let id = Uuid::new_v4().to_string();
    use std::io::Write;
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(p)
        .map_err(|_| "Identity creation failed")?;
    f.write_all(id.as_bytes())
        .and_then(|_| f.sync_all())
        .map_err(|_| "Identity write failed")?;
    Ok(id)
}
pub fn workspace(root: &Path, run: &str, cwd: &str) -> Result<PathBuf> {
    Uuid::parse_str(run).map_err(|_| "Invalid run ID")?;
    relative(cwd)?;
    let runs = root.join("runs");
    no_links(&runs)?;
    fs::create_dir_all(&runs).map_err(|_| "Workspace create failed")?;
    let dir = runs.join(run);
    fs::create_dir(&dir).map_err(|_| "Run workspace already exists or is unavailable")?;
    let target = dir.join(cwd);
    no_links(&target)?;
    fs::create_dir_all(&target).map_err(|_| "Working directory create failed")?;
    let canonical = target
        .canonicalize()
        .map_err(|_| "Workspace resolve failed")?;
    if !canonical.starts_with(dir.canonicalize().map_err(|_| "Workspace resolve failed")?) {
        return Err("Workspace escape".into());
    }
    Ok(canonical)
}
