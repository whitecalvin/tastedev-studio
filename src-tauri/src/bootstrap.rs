use crate::filesystem::{error, relative, resolve, Connection, Result, Workspaces};
use serde::Deserialize;
use std::{
    collections::HashMap,
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};

#[derive(Default)]
pub struct Operations(Mutex<HashMap<String, Arc<AtomicBool>>>);
impl Operations {
    pub fn begin(&self, id: &str) -> Result<()> {
        if uuid::Uuid::parse_str(id).is_err() {
            return Err(error("invalid"));
        }
        let mut pending = self.0.lock().map_err(|_| error("internal"))?;
        if pending.len() >= 16 || pending.contains_key(id) {
            return Err(error("workspace-busy"));
        }
        pending.insert(id.into(), Arc::new(AtomicBool::new(false)));
        Ok(())
    }
    pub fn cancel(&self, id: &str) -> Result<()> {
        if let Some(value) = self.0.lock().map_err(|_| error("internal"))?.get(id) {
            value.store(true, Ordering::SeqCst);
        }
        Ok(())
    }
    pub fn execute(&self, request: Request, workspaces: &Workspaces) -> Result<Connection> {
        let cancelled = self
            .0
            .lock()
            .map_err(|_| error("internal"))?
            .get(&request.id)
            .cloned()
            .ok_or_else(|| error("access"))?;
        let result = prepare(&request, workspaces, &cancelled);
        self.0
            .lock()
            .map_err(|_| error("internal"))?
            .remove(&request.id);
        result
    }
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub id: String,
    pub operation: String,
    pub target: String,
    pub repository: Option<String>,
    pub branch: Option<String>,
    pub files: Vec<NewFile>,
}
#[derive(Deserialize)]
pub struct NewFile {
    pub path: String,
    pub content: String,
}
pub fn environment() -> serde_json::Value {
    let root = std::env::temp_dir();
    let version = |name: &str| {
        crate::git::run_program(&root, name, &["--version"], None)
            .ok()
            .and_then(|v| String::from_utf8(v).ok())
            .map(|v| v.trim().to_string())
    };
    serde_json::json!({"git":version("git"),"node":version("node"),"python":version("python"),"cargo":version("cargo"),"rust":version("rustc")})
}
fn destination(target: &str) -> Result<(PathBuf, PathBuf)> {
    if target.len() > 4096
        || target.contains(['\0', '\n', '\r'])
        || !Path::new(target).is_absolute()
    {
        return Err(error("path"));
    }
    let path = PathBuf::from(target);
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| error("path"))?;
    relative(name, false)?;
    let parent = path.parent().ok_or_else(|| error("path"))?;
    if !parent.is_dir() || fs::symlink_metadata(parent)?.file_type().is_symlink() {
        return Err(error("path"));
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if fs::symlink_metadata(parent)?.file_attributes() & 0x400 != 0 {
            return Err(error("path"));
        }
    }
    let parent = parent.canonicalize()?;
    let target = parent.join(name);
    if fs::symlink_metadata(&target).is_ok() {
        return Err(error("duplicate"));
    }
    Ok((parent, target))
}
fn repository(value: &str) -> Result<()> {
    let url = reqwest::Url::parse(value).map_err(|_| error("invalid"))?;
    if value.len() > 2048
        || url.scheme() != "https"
        || !url.username().is_empty()
        || url.password().is_some()
        || url.host_str().is_none()
        || url.path() == "/"
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(error("invalid"));
    }
    Ok(())
}
fn prepare(
    request: &Request,
    workspaces: &Workspaces,
    cancelled: &AtomicBool,
) -> Result<Connection> {
    if !["create", "clone"].contains(&request.operation.as_str()) || request.files.len() > 32 {
        return Err(error("invalid"));
    }
    let mut bytes = 0;
    let mut paths = std::collections::HashSet::new();
    for file in &request.files {
        relative(&file.path, false)?;
        bytes += file.content.len();
        if !paths.insert(file.path.to_lowercase())
            || file.content.contains('\0')
            || bytes > 1024 * 1024
        {
            return Err(error("invalid"));
        }
    }
    if request.operation == "clone" {
        repository(
            request
                .repository
                .as_deref()
                .ok_or_else(|| error("invalid"))?,
        )?;
        if !request.files.is_empty() {
            return Err(error("invalid"));
        }
    }
    let branch = request.branch.as_deref().unwrap_or("");
    if branch.len() > 200
        || branch.starts_with('-')
        || branch.contains("..")
        || branch
            .chars()
            .any(|c| c.is_whitespace() || "~^:?*[\\".contains(c))
        || branch.contains("@{")
        || branch.ends_with(".lock")
    {
        return Err(error("invalid"));
    }
    let (parent, target) = destination(&request.target)?;
    let stage = parent.join(format!(".tastestudio-create-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&stage)?;
    let result = (|| {
        if cancelled.load(Ordering::SeqCst) {
            return Err(error("cancelled"));
        }
        if request.operation == "clone" {
            let target_arg = crate::filesystem::display_path(&stage);
            let hooks = format!(
                "core.hooksPath={}",
                crate::filesystem::display_path(&stage.join(".git/studio-disabled-hooks"))
            );
            let mut args = vec![
                "-c",
                &hooks,
                "-c",
                "init.templateDir=",
                "clone",
                "--no-recurse-submodules",
                "--quiet",
            ];
            if !branch.is_empty() {
                args.extend(["--branch", branch]);
            }
            args.extend([
                "--",
                request.repository.as_deref().unwrap_or(""),
                &target_arg,
            ]);
            crate::git::run(&parent, &args, Some(cancelled))?;
        } else {
            for file in &request.files {
                if cancelled.load(Ordering::SeqCst) {
                    return Err(error("cancelled"));
                }
                let path = resolve(&stage, &file.path, false)?;
                fs::create_dir_all(path.parent().ok_or_else(|| error("path"))?)?;
                let mut output = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(path)?;
                output.write_all(file.content.as_bytes())?;
                output.sync_all()?;
            }
        }
        if cancelled.load(Ordering::SeqCst) {
            return Err(error("cancelled"));
        }
        if fs::symlink_metadata(&target).is_ok() {
            return Err(error("duplicate"));
        }
        // Windows rename fails rather than replacing an existing destination.
        fs::rename(&stage, &target)?;
        workspaces.register(target)
    })();
    // Only the uniquely named staging directory created by this operation is removed.
    if stage.exists()
        && stage.parent() == Some(parent.as_path())
        && stage
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with(".tastestudio-create-"))
    {
        fs::remove_dir_all(&stage)?;
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    fn request(target: &Path) -> Request {
        Request {
            id: uuid::Uuid::new_v4().to_string(),
            operation: "create".into(),
            target: target.to_string_lossy().into(),
            repository: None,
            branch: None,
            files: vec![NewFile {
                path: "src/main.js".into(),
                content: "console.log('hello');".into(),
            }],
        }
    }
    #[test]
    fn creates_atomically_without_overwriting() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("new");
        let r = request(&target);
        let state = Workspaces::default();
        prepare(&r, &state, &AtomicBool::new(false)).unwrap();
        assert_eq!(
            fs::read_to_string(target.join("src/main.js")).unwrap(),
            r.files[0].content
        );
        assert_eq!(
            prepare(&r, &state, &AtomicBool::new(false))
                .unwrap_err()
                .code,
            "duplicate"
        );
    }
    #[test]
    fn cancelled_creation_leaves_no_source_or_staging() {
        let dir = tempfile::tempdir().unwrap();
        assert!(prepare(
            &request(&dir.path().join("new")),
            &Workspaces::default(),
            &AtomicBool::new(true)
        )
        .is_err());
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 0);
    }
    #[test]
    fn traversal_and_credentials_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let mut r = request(&dir.path().join("new"));
        r.files[0].path = "../escape".into();
        assert!(prepare(&r, &Workspaces::default(), &AtomicBool::new(false)).is_err());
        for url in [
            "https://user:secret@host/repo",
            "file:///repo",
            "https://host/",
            "https://host/repo?token=value",
            "ext::shell",
        ] {
            assert!(repository(url).is_err());
        }
    }
    #[test]
    fn concurrent_path_and_invalid_manifest_leave_existing_files_intact() {
        let dir = tempfile::tempdir().unwrap();
        let target = dir.path().join("new");
        fs::create_dir(&target).unwrap();
        fs::write(target.join("user.txt"), "keep").unwrap();
        assert!(prepare(
            &request(&target),
            &Workspaces::default(),
            &AtomicBool::new(false)
        )
        .is_err());
        assert_eq!(fs::read_to_string(target.join("user.txt")).unwrap(), "keep");
    }
    #[test]
    fn operations_are_scoped_and_removed_after_cancel() {
        let dir = tempfile::tempdir().unwrap();
        let r = request(&dir.path().join("new"));
        let ops = Operations::default();
        ops.begin(&r.id).unwrap();
        ops.cancel(&r.id).unwrap();
        assert_eq!(
            ops.execute(r, &Workspaces::default()).unwrap_err().code,
            "cancelled"
        );
        assert!(ops.0.lock().unwrap().is_empty());
    }
    #[test]
    fn managed_process_cancellation_reaps_child() {
        let cancelled = Arc::new(AtomicBool::new(false));
        let signal = cancelled.clone();
        let thread = std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(100));
            signal.store(true, Ordering::SeqCst);
        });
        let result = crate::git::run_program(
            &std::env::temp_dir(),
            "node",
            &["-e", "setInterval(()=>{},1000)"],
            Some(&cancelled),
        );
        thread.join().unwrap();
        assert_eq!(result.unwrap_err().code, "cancelled");
    }
    #[test]
    fn git_paths_preserve_drive_and_network_identity() {
        assert_eq!(
            crate::filesystem::display_path(Path::new(r"\\?\D:\Projects\app")),
            r"D:\Projects\app"
        );
        assert_eq!(
            crate::filesystem::display_path(Path::new(r"\\?\UNC\server\share\app")),
            r"\\server\share\app"
        );
    }
    #[test]
    #[ignore = "Explicit public read-only Clone integration; no credentials or updater installation"]
    fn actual_public_clone() {
        let root = PathBuf::from(
            std::env::var("STUDIO_VERIFY_CLONE_ROOT").expect("disposable evidence root required"),
        );
        fs::create_dir_all(&root).unwrap();
        let target = root.join(format!("public-clone-{}", uuid::Uuid::new_v4()));
        let mut r = request(&target);
        r.operation = "clone".into();
        r.files.clear();
        r.repository = Some("https://github.com/octocat/Hello-World.git".into());
        let state = Workspaces::default();
        prepare(&r, &state, &AtomicBool::new(false)).unwrap();
        assert!(target.join(".git").is_dir());
        assert!(target.join("README").is_file());
        assert_eq!(
            fs::read_to_string(target.join("README")).unwrap().trim(),
            "Hello World!"
        );
        assert!(!root.read_dir().unwrap().any(|e| e
            .unwrap()
            .file_name()
            .to_string_lossy()
            .starts_with(".tastestudio-create-")));
    }
}
