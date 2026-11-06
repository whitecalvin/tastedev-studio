//! Typed build stages. No release shell scripts, command strings or credential transfer.
use crate::model::{no_links, relative, Request, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

const STAGES: [&str; 8] = [
    "source",
    "dependencies",
    "build",
    "test",
    "stage",
    "sign",
    "package",
    "verify",
];
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FileMapping {
    pub source: String,
    pub path: String,
    #[serde(default)]
    pub main: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Recipe {
    pub version: u32,
    pub product_id: String,
    pub name: String,
    pub package_version: String,
    pub identifier: String,
    pub platform: String,
    pub system: String,
    pub toolchain: String,
    pub packages: Vec<String>,
    pub features: Vec<String>,
    pub all_features: bool,
    pub build_script: String,
    pub test_script: String,
    pub binaries: Vec<FileMapping>,
    pub payloads: Vec<FileMapping>,
    pub formats: Vec<String>,
    pub signing: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Operation {
    pub version: u32,
    pub stage: String,
    pub execution_id: String,
    pub group_id: String,
    pub recipe: Recipe,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Tool {
    path: PathBuf,
    sha256: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceRoot {
    root: PathBuf,
    destination: String,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Signing {
    identity: String,
    timestamp_url: Option<String>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Binding {
    sources: Vec<SourceRoot>,
    workdir: String,
    tools: BTreeMap<String, Tool>,
    signing: Option<Signing>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Catalog {
    version: u32,
    products: BTreeMap<String, Binding>,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Spec {
    operation: Operation,
    project_id: String,
    root: PathBuf,
    catalog: PathBuf,
    receipt: PathBuf,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Output {
    pub path: String,
    pub checksum: String,
    pub size: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Receipt {
    pub version: u32,
    pub stage: String,
    pub execution_id: String,
    pub group_id: String,
    pub recipe_hash: String,
    pub source_hash: String,
    pub catalog_hash: String,
    pub reused: bool,
    pub outcome: String,
    pub outputs: Vec<Output>,
    pub output_count: usize,
    pub output_manifest_hash: String,
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Ledger {
    #[serde(default)]
    compiler_environment_hash: Option<String>,
    version: u32,
    recipe_hash: String,
    catalog_hash: String,
    source_hash: String,
    stages: BTreeMap<String, Receipt>,
}
fn hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
fn digest(value: &impl Serialize) -> Result<String> {
    let v = serde_json::to_value(value).map_err(|_| "Build digest failed")?;
    Ok(hex(
        &serde_json::to_vec(&v).map_err(|_| "Build digest failed")?
    ))
}
fn identifier(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 120
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-_.".contains(&b))
}
fn sha(s: &str) -> bool {
    s.len() == 64
        && s.bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
fn safe_file(s: &str) -> Result<()> {
    relative(s)?;
    if s.is_empty()
        || s == "."
        || s.len() > 240
        || s.contains(['\\', ':'])
        || s.split('/').any(|p| {
            let n = p.to_ascii_lowercase();
            p.is_empty()
                || p.ends_with(['.', ' '])
                || p.bytes().any(|b| b <= 32 || b"<>\"|?*%".contains(&b))
                || n == ".env"
                || n.starts_with(".env.")
                || [
                    ".git",
                    ".ssh",
                    ".aws",
                    ".kube",
                    ".npmrc",
                    ".pypirc",
                    "auth.json",
                    "token.json",
                    "tokens.json",
                    "secrets.json",
                    "secrets",
                ]
                .contains(&n.as_str())
                || [".db", ".sqlite", ".sqlite3"]
                    .iter()
                    .any(|e| n.ends_with(e))
                || n.contains("credential")
                || n.starts_with("id_rsa")
                || n.starts_with("id_ed25519")
                || [".pem", ".key", ".pfx", ".p12"]
                    .iter()
                    .any(|e| n.ends_with(e))
        })
    {
        return Err("Native build file is outside approved scope".into());
    }
    Ok(())
}
impl Operation {
    pub fn validate(&self) -> Result<()> {
        let r = &self.recipe;
        if self.version != 1
            || r.version != 1
            || !STAGES.contains(&self.stage.as_str())
            || !identifier(&self.execution_id)
            || !identifier(&self.group_id)
            || !identifier(&r.product_id)
            || !identifier(&r.identifier)
            || r.name.is_empty()
            || r.name.len() > 120
            || r.name.chars().any(char::is_control)
            || !["cargo", "node", "mixed"].contains(&r.system.as_str())
            || !["windows", "linux", "macos"].contains(&r.platform.as_str())
            || !["none", "required"].contains(&r.signing.as_str())
            || !["build", "build:desktop"].contains(&r.build_script.as_str())
            || r.test_script != "test"
        {
            return Err("Invalid native build operation".into());
        }
        for v in [&r.package_version, &r.toolchain] {
            if v.split('.').count() != 3
                || v.split('.')
                    .any(|x| x.is_empty() || !x.bytes().all(|b| b.is_ascii_digit()))
            {
                return Err("Invalid native build version".into());
            }
        }
        for list in [&r.packages, &r.features] {
            if list.len() > 32 || list.iter().any(|s| !identifier(s)) {
                return Err("Invalid Cargo selection".into());
            }
        }
        if r.system != "node" && r.packages.is_empty()
            || r.binaries.is_empty()
            || r.binaries.len() + r.payloads.len() > 128
            || r.binaries.iter().filter(|f| f.main).count() != 1
        {
            return Err("Native build binary declaration required".into());
        }
        let mut seen = std::collections::BTreeSet::new();
        for f in r.binaries.iter().chain(&r.payloads) {
            safe_file(&f.source)?;
            safe_file(&f.path)?;
            if !seen.insert(f.path.to_ascii_lowercase()) {
                return Err("Duplicate staged file".into());
            }
        }
        let formats: &[&str] = match r.platform.as_str() {
            "windows" => &["zip", "msi", "nsis"],
            "linux" => &["tar.gz", "deb", "rpm", "appimage"],
            _ => &["tar.gz", "dmg"],
        };
        if r.formats.is_empty()
            || r.formats.len() > 5
            || r.formats.iter().any(|f| !formats.contains(&f.as_str()))
            || r.formats
                .iter()
                .collect::<std::collections::BTreeSet<_>>()
                .len()
                != r.formats.len()
        {
            return Err("Unsupported native package format".into());
        }
        Ok(())
    }
}
fn catalog_path() -> Result<PathBuf> {
    let p = PathBuf::from(
        std::env::var_os("TASTESTUDIO_BUILD_CATALOG")
            .ok_or("Native build catalog is not configured")?,
    );
    if !p.is_absolute() {
        return Err("Absolute native build catalog required".into());
    }
    no_links(&p)?;
    Ok(p)
}
pub fn available() -> bool {
    catalog_path().is_ok_and(|p| p.is_file())
}
fn receipt_path(root: &Path, run: &str) -> PathBuf {
    root.join("native-build-results")
        .join(format!("{run}.json"))
}
pub fn configure(request: &mut Request, root: &Path) -> Result<()> {
    if request.executable != "internal-native-build" {
        if request.native_build.is_some() {
            return Err("Native build executable mismatch".into());
        }
        return Ok(());
    }
    let operation = request
        .native_build
        .as_ref()
        .ok_or("Typed native build operation required")?;
    operation.validate()?;
    if request.requirements.native_build != Some(1)
        || request.isolation.is_some()
        || request.requirements.execution_isolation.is_some()
    {
        return Err(
            "Compatible trusted build Agent required; isolation is never downgraded".into(),
        );
    }
    let folder = root.join("native-build-results");
    no_links(&folder)?;
    fs::create_dir_all(&folder).map_err(|_| "Build report directory unavailable")?;
    let receipt = receipt_path(root, &request.run_id);
    if receipt.exists() {
        return Err("Native build result already exists".into());
    }
    let spec = Spec {
        operation: operation.clone(),
        project_id: request.project_id.clone(),
        root: root.to_owned(),
        catalog: catalog_path()?,
        receipt,
    };
    let file = folder.join(format!("{}.request.json", request.run_id));
    let text = serde_json::to_vec(&spec).map_err(|_| "Build request serialization failed")?;
    use std::io::Write;
    let mut output = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&file)
        .map_err(|_| "Build request already exists")?;
    output
        .write_all(&text)
        .map_err(|_| "Build request write failed")?;
    request.executable = std::env::current_exe()
        .map_err(|_| "Agent executable unavailable")?
        .to_string_lossy()
        .into_owned();
    request.args = vec![
        "--native-build-step".into(),
        file.to_string_lossy().into_owned(),
    ];
    Ok(())
}
pub fn result(root: &Path, request: &Request) -> Result<Receipt> {
    let op = request
        .native_build
        .as_ref()
        .ok_or("Missing native build operation")?;
    let file = receipt_path(root, &request.run_id);
    no_links(&file)?;
    let mut r: Receipt =
        serde_json::from_slice(&fs::read(file).map_err(|_| "Native build receipt missing")?)
            .map_err(|_| "Invalid native build receipt")?;
    if r.stage != op.stage
        || r.execution_id != op.execution_id
        || r.group_id != op.group_id
        || r.recipe_hash != digest(&op.recipe)?
        || !sha(&r.source_hash)
    {
        return Err("Native build receipt identity mismatch".into());
    }
    if ["source", "dependencies", "test"].contains(&r.stage.as_str()) {
        r.outputs.clear();
    }
    r.outputs.truncate(128);
    Ok(r)
}
fn read_catalog(p: &Path, product: &str) -> Result<(Binding, String)> {
    no_links(p)?;
    let bytes = fs::read(p).map_err(|_| "Build catalog unavailable")?;
    if bytes.len() > 131072 {
        return Err("Build catalog too large".into());
    }
    let c: Catalog = serde_json::from_slice(&bytes).map_err(|_| "Invalid native build catalog")?;
    if c.version != 1 {
        return Err("Unsupported native build catalog".into());
    }
    let b = c
        .products
        .get(product)
        .ok_or("Product is not registered on this build Agent")?
        .clone();
    safe_file(&b.workdir)?;
    if b.sources.is_empty() || b.sources.len() > 16 {
        return Err("Explicit source roots required".into());
    }
    for source in &b.sources {
        if !source.root.is_absolute() || !source.root.is_dir() {
            return Err("Source root unavailable".into());
        }
        no_links(&source.root)?;
        safe_file(&source.destination)?;
    }
    let mut destinations = std::collections::BTreeSet::new();
    for source in &b.sources {
        if destinations.iter().any(|v: &String| {
            source.destination == *v
                || source.destination.starts_with(&format!("{v}/"))
                || v.starts_with(&format!("{}/", source.destination))
        }) {
            return Err("Overlapping source destinations".into());
        }
        destinations.insert(source.destination.clone());
    }
    for name in b.tools.keys() {
        tool(&b, name)?;
    }
    Ok((b, hex(&bytes)))
}
fn tool(binding: &Binding, name: &str) -> Result<PathBuf> {
    let t = binding
        .tools
        .get(name)
        .ok_or_else(|| format!("Native tool is not registered: {name}"))?;
    if !t.path.is_absolute() || !t.path.is_file() || !sha(&t.sha256) {
        return Err(format!("Invalid registered tool: {name}"));
    }
    no_links(&t.path)?;
    if file_hash(&t.path)? != t.sha256 {
        return Err(format!("Registered tool changed: {name}"));
    }
    Ok(t.path.clone())
}
fn file_hash(p: &Path) -> Result<String> {
    no_links(p)?;
    let mut f = fs::File::open(p).map_err(|_| "Build file unavailable")?;
    let mut h = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = f.read(&mut buf).map_err(|_| "Build file read failed")?;
        if n == 0 {
            break;
        }
        h.update(&buf[..n]);
    }
    Ok(format!("{:x}", h.finalize()))
}
fn command(binding: &Binding, name: &str, args: &[String], cwd: &Path) -> Result<()> {
    let mut c = Command::new(tool(binding, name)?);
    c.args(args)
        .current_dir(cwd)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .env_clear();
    for k in [
        "PATH",
        "SystemRoot",
        "WINDIR",
        "TEMP",
        "TMP",
        "HOME",
        "USERPROFILE",
        "APPDATA",
        "LOCALAPPDATA",
        "ProgramFiles",
        "ProgramFiles(x86)",
        "LIB",
        "LIBPATH",
        "INCLUDE",
        "PATHEXT",
    ] {
        if let Some(v) = std::env::var_os(k) {
            c.env(k, v);
        }
    }
    if name == "cargo" {
        c.env("RUSTC", tool(binding, "rustc")?);
    }
    c.env("GIT_TERMINAL_PROMPT", "0").env("CI", "1");
    let status = c
        .status()
        .map_err(|_| format!("Native tool failed to start: {name}"))?;
    if !status.success() {
        return Err(format!(
            "Native tool failed: {name}, exit {:?}",
            status.code()
        ));
    }
    Ok(())
}
fn tree_files(root: &Path, at: &Path, out: &mut Vec<Output>) -> Result<()> {
    no_links(at)?;
    for e in fs::read_dir(at).map_err(|_| "Build directory unavailable")? {
        let e = e.map_err(|_| "Build directory read failed")?;
        let p = e.path();
        no_links(&p)?;
        if p.is_dir() {
            tree_files(root, &p, out)?;
        } else if p.is_file() {
            let name = p
                .strip_prefix(root)
                .map_err(|_| "Build path escaped")?
                .to_string_lossy()
                .replace('\\', "/");
            safe_file(&name)?;
            let size = p
                .metadata()
                .map_err(|_| "Build file metadata unavailable")?
                .len();
            out.push(Output {
                path: name,
                checksum: file_hash(&p)?,
                size,
            });
            if out.len() > 50000 {
                return Err("Build file count exceeded".into());
            }
        }
    }
    out.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(())
}
fn checked_outputs(root: &Path, outputs: &[Output]) -> bool {
    outputs.iter().all(|f| {
        safe_file(&f.path).is_ok()
            && root
                .join(&f.path)
                .metadata()
                .is_ok_and(|m| m.is_file() && m.len() == f.size)
            && file_hash(&root.join(&f.path)).is_ok_and(|h| h == f.checksum)
    })
}
fn source_copy(b: &Binding, source: &Path) -> Result<String> {
    let mut manifest = Vec::<Output>::new();
    let mut total = 0u64;
    for input in &b.sources {
        let output = Command::new(tool(b, "git")?)
            .args(["-C"])
            .arg(&input.root)
            .args([
                "ls-files",
                "-z",
                "--cached",
                "--others",
                "--exclude-standard",
            ])
            .stdin(Stdio::null())
            .output()
            .map_err(|_| "Source inventory failed")?;
        if !output.status.success() {
            return Err("Source root must be a readable Git working tree".into());
        }
        let paths =
            std::str::from_utf8(&output.stdout).map_err(|_| "Source paths must be UTF-8")?;
        for name in paths.split('\0').filter(|n| !n.is_empty()) {
            let excluded = name.split('/').any(|p| {
                [
                    "target",
                    "artifacts",
                    "node_modules",
                    ".next",
                    ".next-desktop",
                    ".git",
                    "__pycache__",
                ]
                .contains(&p)
            }) || name.starts_with("resources/verification/");
            if excluded || safe_file(name).is_err() {
                continue;
            }
            let from = input.root.join(name);
            no_links(&from)?;
            if !from.exists() {
                continue;
            }
            if !from.is_file() {
                return Err("Source inventory contains an unsupported file".into());
            }
            let dest = format!("{}/{}", input.destination, name);
            let to = source.join(&dest);
            no_links(&to)?;
            fs::create_dir_all(to.parent().ok_or("Source parent unavailable")?)
                .map_err(|_| "Source directory create failed")?;
            let before = file_hash(&from)?;
            total = total
                .checked_add(
                    from.metadata()
                        .map_err(|_| "Source metadata unavailable")?
                        .len(),
                )
                .ok_or("Source size exceeded")?;
            if total > 4 * 1024 * 1024 * 1024u64 {
                return Err("Source size exceeded".into());
            }
            fs::copy(&from, &to).map_err(|_| "Saved working tree copy failed")?;
            if file_hash(&from)? != before || file_hash(&to)? != before {
                return Err("Source changed while copying; original files preserved".into());
            }
            manifest.push(Output {
                path: dest,
                checksum: before,
                size: to
                    .metadata()
                    .map_err(|_| "Source copy metadata failed")?
                    .len(),
            });
            if manifest.len() > 50000 {
                return Err("Source file count exceeded".into());
            }
        }
    }
    if manifest.is_empty() {
        return Err("Source inventory is empty".into());
    }
    manifest.sort_by(|a, b| a.path.cmp(&b.path));
    digest(&manifest)
}
fn cargo(b: &Binding, r: &Recipe, action: &str, cwd: &Path) -> Result<()> {
    let version = Command::new(tool(b, "rustc")?)
        .arg("--version")
        .stdin(Stdio::null())
        .output()
        .map_err(|_| "Pinned Rust compiler unavailable")?;
    if !version.status.success()
        || std::str::from_utf8(&version.stdout)
            .ok()
            .and_then(|v| v.split_whitespace().nth(1))
            != Some(r.toolchain.as_str())
    {
        return Err("Registered compiler does not match the reviewed Rust toolchain".into());
    }
    let mut args = vec![
        format!("+{}", r.toolchain),
        action.into(),
        "--locked".into(),
    ];
    if action != "fetch" {
        args.push("--release".into());
        for p in &r.packages {
            args.extend(["--package".into(), p.clone()]);
        }
        if r.all_features {
            args.push("--all-features".into());
        } else if !r.features.is_empty() {
            args.extend(["--features".into(), r.features.join(",")]);
        }
    }
    command(b, "cargo", &args, cwd)
}
fn npm(b: &Binding, script: Option<&str>, cwd: &Path) -> Result<()> {
    let cli = tool(b, "npm")?;
    let mut args = vec![cli.to_string_lossy().into_owned()];
    if let Some(script) = script {
        let v: serde_json::Value = serde_json::from_slice(
            &fs::read(cwd.join("package.json")).map_err(|_| "Node manifest unavailable")?,
        )
        .map_err(|_| "Invalid Node manifest")?;
        let text = v["scripts"][script]
            .as_str()
            .ok_or("Node script missing")?
            .to_ascii_lowercase();
        if [
            ".ps1",
            "powershell",
            "pwsh",
            "cross-platform-release",
            "release:product",
        ]
        .iter()
        .any(|s| text.contains(s))
        {
            return Err(
                "Shared release scripts and shell release wrappers are not native build tasks"
                    .into(),
            );
        }
        args.extend(["--ignore-scripts".into(), "run".into(), script.into()]);
    } else {
        args.extend([
            "ci".into(),
            "--ignore-scripts".into(),
            "--no-audit".into(),
            "--no-fund".into(),
        ]);
    }
    command(b, "node", &args, cwd)
}
fn copy_payload(from: &Path, to: &Path) -> Result<()> {
    no_links(from)?;
    no_links(to)?;
    if from.is_dir() {
        fs::create_dir_all(to).map_err(|_| "Payload directory unavailable")?;
        for entry in fs::read_dir(from).map_err(|_| "Payload directory unreadable")? {
            let entry = entry.map_err(|_| "Payload entry unreadable")?;
            let name = entry
                .file_name()
                .into_string()
                .map_err(|_| "Payload name must be UTF-8")?;
            safe_file(&name)?;
            copy_payload(&entry.path(), &to.join(name))?;
        }
    } else if from.is_file() {
        fs::create_dir_all(to.parent().ok_or("Payload parent missing")?)
            .map_err(|_| "Payload parent unavailable")?;
        let before = file_hash(from)?;
        fs::copy(from, to).map_err(|_| "Payload copy failed")?;
        if before != file_hash(from)? || before != file_hash(to)? {
            return Err("Payload changed while staging".into());
        }
    } else {
        return Err("Declared build output missing".into());
    }
    Ok(())
}
fn stage_files(_b: &Binding, r: &Recipe, cwd: &Path, stage: &Path) -> Result<Vec<Output>> {
    let incoming = stage.with_extension(format!("{}.pending", uuid::Uuid::new_v4()));
    fs::create_dir(&incoming).map_err(|_| "Staging directory unavailable")?;
    for f in &r.binaries {
        let from = cwd.join(&f.source);
        if !from.is_file() {
            return Err(format!("Declared binary missing: {}", f.source));
        }
        copy_payload(&from, &incoming.join(&f.path))?;
    }
    for f in &r.payloads {
        copy_payload(&cwd.join(&f.source), &incoming.join(&f.path))?;
    }
    let mut outputs = Vec::new();
    tree_files(&incoming, &incoming, &mut outputs)?;
    if stage.exists() {
        let mut old = Vec::new();
        tree_files(stage, stage, &mut old)?;
        if digest(&old)? != digest(&outputs)? {
            return Err("Existing staging differs; explicit new execution required".into());
        }
    } else {
        fs::rename(&incoming, stage).map_err(|_| "Staging commit failed")?;
    }
    Ok(outputs)
}
fn sign_file(b: &Binding, r: &Recipe, file: &Path, verify: bool) -> Result<()> {
    let s = b
        .signing
        .as_ref()
        .ok_or("Signing identity is not configured on this Agent")?;
    if s.identity.is_empty() || s.identity.len() > 240 || s.identity.chars().any(char::is_control) {
        return Err("Invalid signing identity".into());
    }
    let file = file.to_string_lossy().into_owned();
    let cwd = Path::new(&file)
        .parent()
        .ok_or("Signing directory unavailable")?
        .to_owned();
    match r.platform.as_str() {
        "windows" => {
            let args = if verify {
                vec!["verify".into(), "/pa".into(), "/all".into(), file]
            } else {
                let url = s
                    .timestamp_url
                    .as_ref()
                    .ok_or("RFC3161 timestamp URL required")?;
                if !url.starts_with("https://") || url.contains(['\r', '\n', '@']) {
                    return Err("Invalid timestamp URL".into());
                }
                vec![
                    "sign".into(),
                    "/sha1".into(),
                    s.identity.clone(),
                    "/fd".into(),
                    "sha256".into(),
                    "/tr".into(),
                    url.clone(),
                    "/td".into(),
                    "sha256".into(),
                    file,
                ]
            };
            command(b, "signtool", &args, &cwd)
        }
        "macos" => {
            let args = if verify {
                vec!["--verify".into(), "--strict".into(), file]
            } else {
                vec![
                    "--force".into(),
                    "--sign".into(),
                    s.identity.clone(),
                    "--timestamp".into(),
                    file,
                ]
            };
            command(b, "codesign", &args, &cwd)
        }
        _ => {
            let signature = format!("{file}.asc");
            let args = if verify {
                vec!["--batch".into(), "--verify".into(), signature, file]
            } else {
                vec![
                    "--batch".into(),
                    "--yes".into(),
                    "--armor".into(),
                    "--local-user".into(),
                    s.identity.clone(),
                    "--detach-sign".into(),
                    "--output".into(),
                    signature,
                    file,
                ]
            };
            command(b, "gpg", &args, &cwd)
        }
    }
}
fn package_header(file: &Path, format: &str) -> Result<()> {
    use std::io::{Seek, SeekFrom};
    let mut f = fs::File::open(file).map_err(|_| "Package header unavailable")?;
    let mut head = [0u8; 8];
    f.read_exact(&mut head)
        .map_err(|_| "Package is too short")?;
    let valid = match format {
        "zip" => head.starts_with(b"PK\x03\x04") || head.starts_with(b"PK\x05\x06"),
        "tar.gz" => head.starts_with(&[0x1f, 0x8b]),
        "msi" => head == [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
        "nsis" => head.starts_with(b"MZ"),
        "deb" => head == *b"!<arch>\n",
        "rpm" => head.starts_with(&[0xed, 0xab, 0xee, 0xdb]),
        "appimage" => head.starts_with(b"\x7fELF"),
        "dmg" => {
            if f.seek(SeekFrom::End(-512)).is_err() {
                false
            } else {
                let mut footer = [0u8; 4];
                f.read_exact(&mut footer).is_ok() && footer == *b"koly"
            }
        }
        _ => false,
    };
    if !valid {
        return Err(format!(
            "Package content does not match requested format: {format}"
        ));
    }
    Ok(())
}
fn package(b: &Binding, r: &Recipe, stage: &Path, output: &Path) -> Result<Vec<Output>> {
    fs::create_dir_all(output).map_err(|_| "Package output unavailable")?;
    let base = format!("{}-{}-{}", r.product_id, r.package_version, r.platform);
    let mut names = Vec::new();
    for format in &r.formats {
        let ext = match format.as_str() {
            "nsis" => "exe",
            "appimage" => "AppImage",
            other => other,
        };
        let name = format!("{base}.{ext}");
        let target = output.join(&name);
        if ["zip", "tar.gz"].contains(&format.as_str()) {
            let args = if format == "zip" {
                vec![
                    "-a".into(),
                    "-cf".into(),
                    target.to_string_lossy().into_owned(),
                    "-C".into(),
                    stage.to_string_lossy().into_owned(),
                    ".".into(),
                ]
            } else {
                vec![
                    "-czf".into(),
                    target.to_string_lossy().into_owned(),
                    "-C".into(),
                    stage.to_string_lossy().into_owned(),
                    ".".into(),
                ]
            };
            command(b, "archive", &args, stage)?;
        } else if format == "rpm" {
            let root = output.join(format!("rpm-{}", uuid::Uuid::new_v4()));
            for dir in ["BUILD", "BUILDROOT", "RPMS", "SOURCES", "SPECS", "SRPMS"] {
                fs::create_dir_all(root.join(dir)).map_err(|_| "RPM workspace unavailable")?;
            }
            let payload = root.join("SOURCES/payload.tar.gz");
            command(
                b,
                "archive",
                &[
                    "-czf".into(),
                    payload.to_string_lossy().into_owned(),
                    "-C".into(),
                    stage.to_string_lossy().into_owned(),
                    ".".into(),
                ],
                stage,
            )?;
            let spec = root.join("SPECS/package.spec");
            let body=format!("Name: {}\nVersion: {}\nRelease: 1\nSummary: {}\nLicense: Proprietary\nSource0: payload.tar.gz\nAutoReqProv: no\n%description\n{}\n%prep\n%build\n%install\nmkdir -p %{{buildroot}}/opt/{}\ntar -xzf %{{SOURCE0}} -C %{{buildroot}}/opt/{}\n%files\n/opt/{}\n",r.product_id,r.package_version,r.product_id,r.product_id,r.product_id,r.product_id,r.product_id);
            fs::write(&spec, body).map_err(|_| "RPM spec write failed")?;
            let top = root.to_string_lossy();
            if top.contains(['\"', '\'', '%', '\n', '\r']) {
                return Err("RPM workspace contains unsupported macro characters".into());
            }
            command(
                b,
                "rpmbuild",
                &[
                    "--define".into(),
                    format!("_topdir {top}"),
                    "-bb".into(),
                    spec.to_string_lossy().into_owned(),
                ],
                stage,
            )?;
            let mut found = Vec::new();
            tree_files(&root.join("RPMS"), &root.join("RPMS"), &mut found)?;
            let files: Vec<_> = found.iter().filter(|f| f.path.ends_with(".rpm")).collect();
            if files.len() != 1 {
                return Err("Requested RPM missing or ambiguous".into());
            }
            fs::copy(root.join("RPMS").join(&files[0].path), &target)
                .map_err(|_| "RPM output copy failed")?;
        } else {
            let out = output.join(format);
            fs::create_dir_all(&out).map_err(|_| "Package directory unavailable")?;
            let config = output.join(format!("packager-{format}.json"));
            let v = serde_json::json!({"productName":r.name,"version":r.package_version,"identifier":r.identifier,"outDir":out,"binaries":r.binaries.iter().map(|f|serde_json::json!({"path":stage.join(if r.platform=="windows"{f.path.strip_suffix(".exe").unwrap_or(&f.path)}else{&f.path}),"main":f.main})).collect::<Vec<_>>(),"resources":r.payloads.iter().map(|f|serde_json::json!({"src":stage.join(&f.path),"target":f.path})).collect::<Vec<_>>()});
            fs::write(
                &config,
                serde_json::to_vec_pretty(&v).map_err(|_| "Package config serialization failed")?,
            )
            .map_err(|_| "Package config write failed")?;
            command(
                b,
                "packager",
                &[
                    "--config".into(),
                    config.to_string_lossy().into_owned(),
                    "--formats".into(),
                    if format == "msi" {
                        "wix".into()
                    } else {
                        format.clone()
                    },
                ],
                stage,
            )?;
            let mut found = Vec::new();
            tree_files(&out, &out, &mut found)?;
            let selected = found
                .iter()
                .filter(|f| f.path.ends_with(&format!(".{ext}")))
                .collect::<Vec<_>>();
            if selected.len() != 1 {
                return Err(format!(
                    "Requested package format missing or ambiguous: {format}"
                ));
            }
            fs::copy(out.join(&selected[0].path), &target)
                .map_err(|_| "Package normalization failed")?;
        }
        if !target.is_file()
            || target
                .metadata()
                .map_err(|_| "Package metadata failed")?
                .len()
                == 0
        {
            return Err("Empty or missing package".into());
        }
        package_header(&target, format)?;
        if r.signing == "required"
            && (!matches!(r.platform.as_str(), "windows") || ["exe", "msi"].contains(&ext))
        {
            sign_file(b, r, &target, false)?;
            sign_file(b, r, &target, true)?;
        }
        names.push(name);
    }
    let mut outputs = Vec::new();
    for name in names {
        let p = output.join(&name);
        outputs.push(Output {
            path: name.clone(),
            checksum: file_hash(&p)?,
            size: p
                .metadata()
                .map_err(|_| "Package metadata unavailable")?
                .len(),
        });
        if r.platform == "linux" && r.signing == "required" {
            let p = output.join(format!("{name}.asc"));
            outputs.push(Output {
                path: format!("{name}.asc"),
                checksum: file_hash(&p)?,
                size: p
                    .metadata()
                    .map_err(|_| "Signature metadata unavailable")?
                    .len(),
            });
        }
    }
    Ok(outputs)
}
struct Lock {
    _file: fs::File,
}
fn lock_workspace(path: &Path) -> Result<Lock> {
    no_links(path)?;
    let mut options = fs::OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(0);
    }
    let file = options
        .open(path)
        .map_err(|_| "Native build workspace is already in use")?;
    #[cfg(unix)]
    {
        use std::os::fd::AsRawFd;
        // SAFETY: a live owned File descriptor is locked nonblocking; closing releases it on exit/crash.
        if unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) } != 0 {
            return Err("Native build workspace is already in use".into());
        }
    }
    Ok(Lock { _file: file })
}
fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    use std::io::Write;
    no_links(path)?;
    let temp = path.with_extension(format!("{}.pending", uuid::Uuid::new_v4()));
    let mut f = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temp)
        .map_err(|_| "Build record staging failed")?;
    f.write_all(bytes)
        .map_err(|_| "Build record write failed")?;
    f.sync_all().map_err(|_| "Build record sync failed")?;
    drop(f);
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        use windows_sys::Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        };
        let from: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
        let to: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
        // SAFETY: both buffers are live, NUL-terminated paths owned for the duration of this atomic replacement.
        if unsafe {
            MoveFileExW(
                from.as_ptr(),
                to.as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        } == 0
        {
            return Err("Build record atomic replacement failed".into());
        }
    }
    #[cfg(not(windows))]
    fs::rename(&temp, path).map_err(|_| "Build record atomic replacement failed")?;
    Ok(())
}
pub fn run_spec(file: &Path) -> Result<()> {
    no_links(file)?;
    let bytes = fs::read(file).map_err(|_| "Native build request unavailable")?;
    if bytes.len() > 32768 {
        return Err("Native build request too large".into());
    }
    let spec: Spec = serde_json::from_slice(&bytes).map_err(|_| "Invalid native build request")?;
    spec.operation.validate()?;
    let op = &spec.operation;
    let r = &op.recipe;
    if r.platform != crate::model::platform() {
        return Err("Native build platform mismatch".into());
    }
    if !identifier(&spec.project_id) || !spec.root.is_absolute() {
        return Err("Invalid native workspace scope".into());
    }
    let reports = spec.root.join("native-build-results");
    if file.parent() != Some(reports.as_path())
        || spec.receipt.parent() != Some(reports.as_path())
        || file
            .file_name()
            .and_then(|n| n.to_str())
            .and_then(|n| n.strip_suffix(".request.json"))
            .and_then(|n| uuid::Uuid::parse_str(n).ok())
            .is_none()
        || file.file_stem().and_then(|n| n.to_str())
            != spec
                .receipt
                .file_stem()
                .and_then(|n| n.to_str())
                .map(|n| format!("{n}.request"))
                .as_deref()
    {
        return Err("Build report scope mismatch".into());
    }
    no_links(&spec.receipt)?;
    let (binding, catalog_hash) = read_catalog(&spec.catalog, &r.product_id)?;
    let recipe_hash = digest(r)?;
    let owner = spec
        .root
        .join("native-build")
        .join(&spec.project_id)
        .join(&op.execution_id)
        .join(&op.group_id);
    no_links(&owner)?;
    fs::create_dir_all(&owner).map_err(|_| "Native build workspace unavailable")?;
    let _lock = lock_workspace(&owner.join("stage.lock"))?;
    let source = owner.join("source");
    let cwd = source.join(&binding.workdir);
    let stage = owner.join("staging");
    let signed = owner.join("signed");
    let output = owner.join("artifacts").join("release");
    let ledger_path = owner.join("ledger.json");
    let mut ledger = if ledger_path.exists() {
        let l: Ledger = serde_json::from_slice(
            &fs::read(&ledger_path).map_err(|_| "Build ledger unavailable")?,
        )
        .map_err(|_| "Invalid build ledger")?;
        if l.version != 1 || l.recipe_hash != recipe_hash || l.catalog_hash != catalog_hash {
            return Err("Build recipe or Agent catalog changed; review a new execution".into());
        }
        l
    } else {
        Ledger {
            version: 1,
            compiler_environment_hash: None,
            recipe_hash: recipe_hash.clone(),
            catalog_hash: catalog_hash.clone(),
            source_hash: String::new(),
            stages: BTreeMap::new(),
        }
    };
    let index = STAGES
        .iter()
        .position(|s| *s == op.stage)
        .ok_or("Unknown build stage")?;
    if index > 0 && !ledger.stages.contains_key(STAGES[index - 1]) {
        return Err("Previous native build stage has not completed".into());
    }
    if index > 0 {
        let baseline = ledger
            .stages
            .get("source")
            .ok_or("Saved Source receipt missing")?;
        if !checked_outputs(&source, &baseline.outputs) {
            return Err("Saved Source changed; create and review a new execution".into());
        }
    }
    if index >= 2 {
        let environment_hash = digest(
            &[
                std::env::var_os("LIB"),
                std::env::var_os("LIBPATH"),
                std::env::var_os("INCLUDE"),
            ]
            .map(|v| v.map(|s| s.to_string_lossy().into_owned())),
        )?;
        if ledger
            .compiler_environment_hash
            .as_ref()
            .is_some_and(|h| h != &environment_hash)
        {
            if index != 2 {
                return Err(
                    "Compiler environment changed; resume the build stage after review".into(),
                );
            }
            for name in STAGES.iter().skip(2) {
                ledger.stages.remove(*name);
            }
        }
        ledger.compiler_environment_hash = Some(environment_hash);
    }
    if let Some(saved) = ledger.stages.get(&op.stage) {
        let root = if index >= 6 {
            &output
        } else if index == 5 {
            &signed
        } else if index == 4 {
            &stage
        } else {
            &source
        };
        if !saved.outputs.is_empty() && checked_outputs(root, &saved.outputs) {
            if index >= 6 {
                for format in &r.formats {
                    let ext = match format.as_str() {
                        "nsis" => "exe",
                        "appimage" => "AppImage",
                        v => v,
                    };
                    let artifact = output.join(format!(
                        "{}-{}-{}.{}",
                        r.product_id, r.package_version, r.platform, ext
                    ));
                    package_header(&artifact, format)?;
                    if index == 7
                        && r.signing == "required"
                        && (r.platform != "windows" || ["exe", "msi"].contains(&ext))
                    {
                        sign_file(&binding, r, &artifact, true)?;
                    }
                }
            }
            let mut reused = saved.clone();
            reused.reused = true;
            atomic_write(
                &spec.receipt,
                &serde_json::to_vec(&reused).map_err(|_| "Receipt encoding failed")?,
            )?;
            println!("Native stage {} reused verified outputs", op.stage);
            return Ok(());
        }
    }
    for name in STAGES.iter().skip(index) {
        ledger.stages.remove(*name);
    }
    let mut outputs = Vec::new();
    let mut outcome = "executed";
    match op.stage.as_str() {
        "source" => {
            let prepared = owner.join("source-prepared.json");
            if source.exists() {
                let manifest: Vec<Output> = serde_json::from_slice(
                    &fs::read(&prepared).map_err(|_| "Saved source has no recovery manifest")?,
                )
                .map_err(|_| "Invalid source recovery manifest")?;
                if !checked_outputs(&source, &manifest) {
                    return Err("Saved Source recovery hash mismatch".into());
                }
                outputs = manifest;
                ledger.source_hash = digest(&outputs)?;
            } else {
                let incoming = owner.join(format!("source-{}.pending", uuid::Uuid::new_v4()));
                fs::create_dir(&incoming).map_err(|_| "Source workspace unavailable")?;
                ledger.source_hash = source_copy(&binding, &incoming)?;
                tree_files(&incoming, &incoming, &mut outputs)?;
                if digest(&outputs)? != ledger.source_hash {
                    return Err("Source manifest collision or copy mismatch".into());
                }
                atomic_write(
                    &prepared,
                    &serde_json::to_vec(&outputs).map_err(|_| "Source manifest encoding failed")?,
                )?;
                fs::rename(&incoming, &source).map_err(|_| "Source commit failed")?;
            }
            if !cwd.is_dir() {
                return Err("Catalog workdir was not included in saved source".into());
            }
        }
        "dependencies" => {
            if r.system != "node" {
                cargo(&binding, r, "fetch", &cwd)?;
            }
            if r.system != "cargo" {
                npm(&binding, None, &cwd)?;
            }
        }
        "build" => {
            if r.system != "cargo" {
                npm(&binding, Some(&r.build_script), &cwd)?;
            }
            if r.system != "node" {
                cargo(&binding, r, "build", &cwd)?;
            }
            for b in &r.binaries {
                let p = cwd.join(&b.source);
                outputs.push(Output {
                    path: format!("{}/{}", binding.workdir, b.source),
                    checksum: file_hash(&p)?,
                    size: p
                        .metadata()
                        .map_err(|_| "Build output metadata missing")?
                        .len(),
                });
            }
        }
        "test" => {
            if r.system != "node" {
                cargo(&binding, r, "test", &cwd)?;
            }
            if r.system != "cargo" {
                npm(&binding, Some(&r.test_script), &cwd)?;
            }
        }
        "stage" => {
            outputs = stage_files(&binding, r, &cwd, &stage)?;
        }
        "sign" => {
            let prior = ledger
                .stages
                .get("stage")
                .ok_or("Staging receipt missing")?;
            if !checked_outputs(&stage, &prior.outputs) {
                return Err("Staged input changed before signing".into());
            }
            let incoming = owner.join(format!("signed-{}.pending", uuid::Uuid::new_v4()));
            fs::create_dir(&incoming).map_err(|_| "Signing staging unavailable")?;
            for f in &prior.outputs {
                let to = incoming.join(&f.path);
                fs::create_dir_all(to.parent().ok_or("Signing parent missing")?)
                    .map_err(|_| "Signing directory failed")?;
                fs::copy(stage.join(&f.path), &to).map_err(|_| "Signing baseline copy failed")?;
            }
            if r.signing == "required" {
                for b in &r.binaries {
                    sign_file(&binding, r, &incoming.join(&b.path), false)?;
                    sign_file(&binding, r, &incoming.join(&b.path), true)?;
                }
            } else {
                outcome = "not-required";
            }
            if signed.exists() {
                return Err("Signed outputs changed; explicit new execution required".into());
            }
            fs::rename(&incoming, &signed).map_err(|_| "Signed outputs commit failed")?;
            tree_files(&signed, &signed, &mut outputs)?;
        }
        "package" => {
            let prior = ledger
                .stages
                .get("sign")
                .ok_or("Signing policy receipt missing")?;
            if !checked_outputs(&signed, &prior.outputs) {
                return Err("Signed input changed before packaging".into());
            }
            outputs = package(&binding, r, &signed, &output)?;
        }
        "verify" => {
            let prior = ledger
                .stages
                .get("package")
                .ok_or("Package receipt missing")?;
            if !checked_outputs(&output, &prior.outputs) {
                return Err("Package checksum/size mismatch".into());
            }
            for format in &r.formats {
                let ext = match format.as_str() {
                    "nsis" => "exe",
                    "appimage" => "AppImage",
                    v => v,
                };
                let p = output.join(format!(
                    "{}-{}-{}.{}",
                    r.product_id, r.package_version, r.platform, ext
                ));
                package_header(&p, format)?;
                if r.signing == "required"
                    && (r.platform != "windows" || ["exe", "msi"].contains(&ext))
                {
                    sign_file(&binding, r, &p, true)?;
                }
            }
            outputs = prior.outputs.clone();
            fs::write(
                output.join("SHA256SUMS"),
                outputs
                    .iter()
                    .map(|f| format!("{}  {}\n", f.checksum, f.path))
                    .collect::<String>(),
            )
            .map_err(|_| "Checksum manifest write failed")?;
            let sums = output.join("SHA256SUMS");
            outputs.push(Output {
                path: "SHA256SUMS".into(),
                checksum: file_hash(&sums)?,
                size: sums
                    .metadata()
                    .map_err(|_| "Checksum manifest metadata unavailable")?
                    .len(),
            });
        }
        _ => return Err("Unknown native build stage".into()),
    }
    let receipt = Receipt {
        version: 1,
        stage: op.stage.clone(),
        execution_id: op.execution_id.clone(),
        group_id: op.group_id.clone(),
        recipe_hash,
        source_hash: ledger.source_hash.clone(),
        catalog_hash,
        reused: false,
        outcome: outcome.into(),
        output_count: outputs.len(),
        output_manifest_hash: digest(&outputs)?,
        outputs,
    };
    ledger.stages.insert(op.stage.clone(), receipt.clone());
    atomic_write(
        &ledger_path,
        &serde_json::to_vec_pretty(&ledger).map_err(|_| "Ledger encoding failed")?,
    )?;
    atomic_write(
        &spec.receipt,
        &serde_json::to_vec(&receipt).map_err(|_| "Receipt encoding failed")?,
    )?;
    println!(
        "Native stage {} completed; source {}",
        op.stage, receipt.source_hash
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn recipe() -> Recipe {
        serde_json::from_value(serde_json::json!({"version":1,"productId":"fixture","name":"Fixture","packageVersion":"1.0.0","identifier":"net.fixture","platform":crate::model::platform(),"system":"cargo","toolchain":"1.99.1","packages":["fixture"],"features":[],"allFeatures":false,"buildScript":"build","testScript":"test","binaries":[{"source":"target/release/fixture.exe","path":"fixture.exe","main":true}],"payloads":[],"formats":if cfg!(windows){vec!["zip"]}else{vec!["tar.gz"]},"signing":"none"})).unwrap()
    }
    #[test]
    fn rejects_paths_and_untyped_commands() {
        for p in [
            "../outside",
            "C:/outside",
            ".env",
            "data/credentials.json",
            "a.key",
            "auth.json",
            "runtime/core.sqlite",
            "x%macro",
            "a/../b",
        ] {
            assert!(safe_file(p).is_err(), "{p}");
        }
        let mut op = Operation {
            version: 1,
            stage: "build".into(),
            execution_id: "exec".into(),
            group_id: "group".into(),
            recipe: recipe(),
        };
        assert!(op.validate().is_ok());
        op.stage = "shell".into();
        assert!(op.validate().is_err());
        op.stage = "build".into();
        op.recipe.build_script = "release:product:publish".into();
        assert!(op.validate().is_err());
    }
    #[test]
    fn output_hashes_detect_changes_and_missing_files() {
        let t = tempfile::tempdir().unwrap();
        fs::write(t.path().join("a"), "before").unwrap();
        let mut outputs = Vec::new();
        tree_files(t.path(), t.path(), &mut outputs).unwrap();
        assert!(checked_outputs(t.path(), &outputs));
        fs::write(t.path().join("a"), "after").unwrap();
        assert!(!checked_outputs(t.path(), &outputs));
        fs::remove_file(t.path().join("a")).unwrap();
        assert!(!checked_outputs(t.path(), &outputs));
    }
    #[test]
    fn lock_is_exclusive_and_released_without_deleting_file() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("lock");
        let a = lock_workspace(&p).unwrap();
        assert!(lock_workspace(&p).is_err());
        drop(a);
        assert!(lock_workspace(&p).is_ok());
    }
    #[test]
    fn atomic_records_replace_previous_valid_json() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("ledger.json");
        atomic_write(&p, b"{\"version\":1}").unwrap();
        atomic_write(&p, b"{\"version\":2}").unwrap();
        assert_eq!(fs::read_to_string(p).unwrap(), "{\"version\":2}");
    }
    #[test]
    fn required_signing_never_degrades_to_unsigned() {
        let t = tempfile::tempdir().unwrap();
        let binding = Binding {
            sources: vec![],
            workdir: "fixture".into(),
            tools: BTreeMap::new(),
            signing: None,
        };
        assert!(
            sign_file(&binding, &recipe(), &t.path().join("fixture"), false)
                .unwrap_err()
                .contains("Signing identity")
        );
    }
    #[test]
    fn tool_hashes_are_checked_before_execution() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("fake-tool");
        fs::write(&p, "tool").unwrap();
        let mut b = Binding {
            sources: vec![],
            workdir: "fixture".into(),
            tools: BTreeMap::new(),
            signing: None,
        };
        b.tools.insert(
            "cargo".into(),
            Tool {
                path: p.clone(),
                sha256: file_hash(&p).unwrap(),
            },
        );
        assert_eq!(tool(&b, "cargo").unwrap(), p);
        fs::write(&p, "modified").unwrap();
        assert!(tool(&b, "cargo").unwrap_err().contains("changed"));
    }
    #[test]
    fn helper_rejects_arbitrary_result_destination() {
        let t = tempfile::tempdir().unwrap();
        let op = Operation {
            version: 1,
            stage: "source".into(),
            execution_id: "exec".into(),
            group_id: "group".into(),
            recipe: recipe(),
        };
        let spec = Spec {
            operation: op,
            project_id: "project".into(),
            root: t.path().into(),
            catalog: t.path().join("catalog"),
            receipt: t.path().join("outside"),
        };
        let p = t.path().join("bad.json");
        fs::write(&p, serde_json::to_vec(&spec).unwrap()).unwrap();
        assert!(run_spec(&p).unwrap_err().contains("scope mismatch"));
    }
    #[test]
    fn payload_directories_preserve_runtime_layout_and_block_secret_files() {
        let t = tempfile::tempdir().unwrap();
        let from = t.path().join("runtime");
        fs::create_dir_all(from.join("node_modules/lib")).unwrap();
        fs::write(from.join("node_modules/lib/index.js"), "module.exports=1").unwrap();
        let to = t.path().join("staged");
        copy_payload(&from, &to).unwrap();
        assert_eq!(
            fs::read(to.join("node_modules/lib/index.js")).unwrap(),
            b"module.exports=1"
        );
        fs::write(from.join(".env"), "DUMMY_ONLY").unwrap();
        assert!(copy_payload(&from, &t.path().join("blocked")).is_err());
    }
    #[test]
    fn missing_multifile_input_does_not_publish_partial_stage() {
        let t = tempfile::tempdir().unwrap();
        let mut r = recipe();
        r.binaries[0].source = "app.exe".into();
        r.payloads.push(FileMapping {
            source: "missing".into(),
            path: "runtime".into(),
            main: false,
        });
        fs::write(t.path().join("app.exe"), "fixture").unwrap();
        let b = Binding {
            sources: vec![],
            workdir: "product".into(),
            tools: BTreeMap::new(),
            signing: None,
        };
        let out = t.path().join("staging");
        assert!(stage_files(&b, &r, t.path(), &out).is_err());
        assert!(!out.exists());
    }
    #[test]
    fn package_extensions_cannot_disguise_malformed_outputs() {
        let t = tempfile::tempdir().unwrap();
        let p = t.path().join("output.zip");
        fs::write(&p, b"garbage binary").unwrap();
        assert!(package_header(&p, "zip").is_err());
        fs::write(&p, b"PK\x03\x04fixture").unwrap();
        assert!(package_header(&p, "zip").is_ok());
        assert!(package_header(&p, "msi").is_err());
    }
}
