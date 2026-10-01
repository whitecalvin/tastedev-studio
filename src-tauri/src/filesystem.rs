use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};

#[derive(Debug, Serialize)]
pub struct NativeError {
    pub code: String,
}
pub type Result<T> = std::result::Result<T, NativeError>;
pub fn error(code: &str) -> NativeError {
    crate::diagnostics::record("native-error", code);
    NativeError { code: code.into() }
}
impl From<std::io::Error> for NativeError {
    fn from(value: std::io::Error) -> Self {
        error(match value.kind() {
            std::io::ErrorKind::NotFound => "not-found",
            std::io::ErrorKind::PermissionDenied => "permission",
            std::io::ErrorKind::AlreadyExists => "duplicate",
            _ => "filesystem",
        })
    }
}
#[derive(Default)]
pub struct Workspaces {
    operations: Mutex<()>,
    pub roots: Mutex<HashMap<String, PathBuf>>,
    pub projects: Mutex<HashMap<String, PathBuf>>,
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    id: String,
    name: String,
    permission: String,
    persistent: bool,
    workspace_path: String,
}
impl Workspaces {
    pub fn root(&self, id: &str) -> Result<PathBuf> {
        let root = self
            .roots
            .lock()
            .map_err(|_| error("internal"))?
            .get(id)
            .cloned()
            .ok_or_else(|| error("access"))?;
        if root.canonicalize()? != root || !root.is_dir() {
            return Err(error("path"));
        }
        Ok(root)
    }
    pub fn register(&self, root: PathBuf) -> Result<Connection> {
        let root = root.canonicalize()?;
        if !root.is_dir() {
            return Err(error("not-found"));
        }
        let mut roots = self.roots.lock().map_err(|_| error("internal"))?;
        let id = roots
            .iter()
            .find(|(_, path)| *path == &root)
            .map(|(id, _)| id.clone())
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        roots.insert(id.clone(), root.clone());
        Ok(Connection {
            id,
            name: root
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .into(),
            permission: "granted".into(),
            persistent: true,
            workspace_path: display_path(&root),
        })
    }
}
pub fn display_path(path: &Path) -> String {
    let text = path.to_string_lossy();
    if let Some(network) = text.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{}", network)
    } else {
        text.trim_start_matches(r"\\?\").to_string()
    }
}
pub fn relative(path: &str, allow_root: bool) -> Result<()> {
    if path.is_empty() && allow_root {
        return Ok(());
    }
    if path.is_empty()
        || path.len() > 4096
        || path.contains('\\')
        || path.split('/').any(|p| {
            p.is_empty()
                || p == "."
                || p == ".."
                || p.ends_with(['.', ' '])
                || p.chars().any(|c| c < ' ' || "<>:\"|?*".contains(c))
        })
    {
        return Err(error("path"));
    }
    for part in path.split('/') {
        let stem = part
            .split('.')
            .next()
            .unwrap_or_default()
            .to_ascii_uppercase();
        if ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
            || (stem.len() == 4
                && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && stem.as_bytes()[3].is_ascii_digit())
        {
            return Err(error("path"));
        }
    }
    Ok(())
}
// Refuse every reparse point, including Windows junctions. Each existing ancestor is
// checked, so an absent destination cannot bypass the workspace boundary.
pub fn resolve(root: &Path, path: &str, allow_root: bool) -> Result<PathBuf> {
    relative(path, allow_root)?;
    let mut result = root.to_path_buf();
    for part in path.split('/').filter(|p| !p.is_empty()) {
        result.push(part);
        match fs::symlink_metadata(&result) {
            Ok(meta) => {
                #[cfg(windows)]
                {
                    use std::os::windows::fs::MetadataExt;
                    if meta.file_attributes() & 0x400 != 0 {
                        return Err(error("path"));
                    }
                }
                if meta.file_type().is_symlink() || !result.canonicalize()?.starts_with(root) {
                    return Err(error("path"));
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
    }
    Ok(result)
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRequest {
    pub connection_id: String,
    pub operation: String,
    #[serde(default)]
    pub path: String,
    pub destination: Option<String>,
    pub content: Option<String>,
    pub expected: Option<String>,
}
pub fn execute(state: &Workspaces, r: FileRequest) -> Result<serde_json::Value> {
    use std::io::Write;
    let _operation = state.operations.lock().map_err(|_| error("internal"))?;
    let root = state.root(&r.connection_id)?;
    let path = resolve(
        &root,
        &r.path,
        r.operation == "list" || r.operation == "exists",
    )?;
    match r.operation.as_str() {
        "list" => {
            let mut entries = Vec::new();
            for entry in fs::read_dir(path)? {
                let entry = entry?;
                let name = entry.file_name().to_string_lossy().to_string();
                let relative = if r.path.is_empty() {
                    name.clone()
                } else {
                    format!("{}/{name}", r.path)
                };
                if resolve(&root, &relative, false).is_err() {
                    continue;
                }
                entries.push(serde_json::json!({"name":name,"path":relative,"kind":if entry.file_type()?.is_dir(){"directory"}else{"file"}}));
            }
            Ok(serde_json::json!(entries))
        }
        "read" => {
            let m = fs::metadata(&path)?;
            if m.len() > 2 * 1024 * 1024 {
                return Err(error("large"));
            }
            let bytes = read_bounded(&path)?;
            if bytes.contains(&0) {
                return Err(error("binary"));
            }
            let content = String::from_utf8(bytes).map_err(|_| error("binary"))?;
            Ok(
                serde_json::json!({"content":content,"size":m.len(),"modified":m.modified()?.duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis()}),
            )
        }
        "write" => {
            let content = r.content.ok_or_else(|| error("invalid"))?;
            if content.len() > 2 * 1024 * 1024 {
                return Err(error("large"));
            }
            let expected = r.expected.ok_or_else(|| error("invalid"))?;
            if read_bounded(&path)? != expected.as_bytes() {
                return Err(error("conflict"));
            }
            let temporary =
                path.with_file_name(format!(".studio-save-{}.tmp", uuid::Uuid::new_v4()));
            let result = (|| -> Result<()> {
                let mut file = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&temporary)?;
                file.write_all(content.as_bytes())?;
                file.sync_all()?;
                drop(file);
                resolve(&root, &r.path, false)?;
                if read_bounded(&path)? != expected.as_bytes() {
                    return Err(error("conflict"));
                }
                fs::rename(&temporary, &path)?;
                Ok(())
            })();
            if result.is_err() {
                let _ = fs::remove_file(&temporary);
            }
            result?;
            Ok(serde_json::Value::Null)
        }
        "createFile" => {
            fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)?;
            Ok(serde_json::Value::Null)
        }
        "createDirectory" => {
            fs::create_dir(path)?;
            Ok(serde_json::Value::Null)
        }
        "rename" => {
            let target = resolve(
                &root,
                &r.destination.ok_or_else(|| error("invalid"))?,
                false,
            )?;
            if target.exists() {
                return Err(error("duplicate"));
            }
            fs::rename(path, target)?;
            Ok(serde_json::Value::Null)
        }
        "delete" => {
            reject_tree_links(&path)?;
            if path.is_dir() {
                fs::remove_dir_all(path)?;
            } else {
                fs::remove_file(path)?;
            }
            Ok(serde_json::Value::Null)
        }
        "exists" => Ok(serde_json::json!(path.exists())),
        _ => Err(error("invalid")),
    }
}
fn reject_tree_links(path: &Path) -> Result<()> {
    let meta = fs::symlink_metadata(path)?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return Err(error("path"));
        }
    }
    if meta.file_type().is_symlink() {
        return Err(error("path"));
    }
    if meta.is_dir() {
        for entry in fs::read_dir(path)? {
            reject_tree_links(&entry?.path())?;
        }
    }
    Ok(())
}
fn read_bounded(path: &Path) -> Result<Vec<u8>> {
    use std::io::Read;
    let mut bytes = Vec::new();
    fs::File::open(path)?
        .take(2 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)?;
    if bytes.len() > 2 * 1024 * 1024 {
        return Err(error("large"));
    }
    Ok(bytes)
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_escape_and_windows_aliases() {
        for p in [
            "../a", "/a", "C:/a", "a/../b", "a\\b", "a:stream", "NUL.txt", "x/CON", "a.", "a//b",
        ] {
            assert!(relative(p, false).is_err(), "{p}");
        }
    }
    #[test]
    fn disk_crud_and_conflict() {
        let temp = tempfile::tempdir().unwrap();
        let state = Workspaces::default();
        let c = state.register(temp.path().into()).unwrap();
        let call = |op: &str, path: &str, content: Option<&str>, expected: Option<&str>| {
            execute(
                &state,
                FileRequest {
                    connection_id: c.id.clone(),
                    operation: op.into(),
                    path: path.into(),
                    destination: None,
                    content: content.map(Into::into),
                    expected: expected.map(Into::into),
                },
            )
        };
        call("createFile", "test.txt", None, None).unwrap();
        call("write", "test.txt", Some("saved"), Some("")).unwrap();
        assert_eq!(
            fs::read_to_string(temp.path().join("test.txt")).unwrap(),
            "saved"
        );
        assert!(call("write", "test.txt", Some("lost"), Some("")).is_err());
        call("delete", "test.txt", None, None).unwrap();
        assert!(!temp.path().join("test.txt").exists());
    }
    #[test]
    fn rejects_unknown_workspace_root_mutation_and_junction_escape() {
        let temp = tempfile::tempdir().unwrap();
        let outside = tempfile::tempdir().unwrap();
        let state = Workspaces::default();
        let connection = state.register(temp.path().into()).unwrap();
        assert!(state.root("unknown").is_err());
        assert!(resolve(temp.path(), "", false).is_err());
        let junction = temp.path().join("escape");
        let status = std::process::Command::new("cmd.exe")
            .args(["/D", "/C", "mklink", "/J"])
            .arg(&junction)
            .arg(outside.path())
            .output()
            .unwrap();
        assert!(status.status.success());
        assert!(resolve(
            &temp.path().canonicalize().unwrap(),
            "escape/file.txt",
            false
        )
        .is_err());
        assert!(execute(
            &state,
            FileRequest {
                connection_id: connection.id,
                operation: "delete".into(),
                path: "escape".into(),
                destination: None,
                content: None,
                expected: None
            }
        )
        .is_err());
        std::fs::remove_dir(junction).unwrap();
        assert!(outside.path().exists());
    }
}
