use crate::filesystem::{display_path, error, relative, Result, Workspaces};
use crate::git;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub operation: String,
    pub workspace_id: String,
    pub project_id: String,
    pub task_id: Option<String>,
    pub expected_head: Option<String>,
    pub acknowledge_committed_base: Option<bool>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Record {
    version: u32,
    project_id: String,
    task_id: String,
    repository: PathBuf,
    base_revision: String,
    state: String,
}
pub struct TaskWorktrees {
    base: PathBuf,
    operation: Mutex<()>,
}
fn id(value: &str) -> Result<()> {
    uuid::Uuid::parse_str(value).map_err(|_| error("worktree-identity"))?;
    if value != value.to_ascii_lowercase() {
        return Err(error("worktree-identity"));
    }
    Ok(())
}
fn sha(value: &str) -> bool {
    [40, 64].contains(&value.len())
        && value
            .bytes()
            .all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase())
}
fn ordinary(path: &Path, directory: bool) -> Result<()> {
    let meta = fs::symlink_metadata(path)?;
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if meta.file_attributes() & 0x400 != 0 {
            return Err(error("path"));
        }
    }
    if meta.file_type().is_symlink() || meta.is_dir() != directory {
        return Err(error("path"));
    }
    Ok(())
}
fn directory(parent: &Path, name: &str) -> Result<PathBuf> {
    let parent = parent.canonicalize()?;
    ordinary(&parent, true)?;
    let path = parent.join(name);
    match fs::create_dir(&path) {
        Ok(()) => {}
        Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {}
        Err(e) => return Err(e.into()),
    }
    ordinary(&path, true)?;
    if path.canonicalize()?.parent() != Some(parent.as_path()) {
        return Err(error("path"));
    }
    Ok(path.canonicalize()?)
}
fn text(root: &Path, args: &[&str]) -> Result<String> {
    String::from_utf8(git::run(root, args, None)?).map_err(|_| error("binary"))
}
fn head(root: &Path) -> Result<String> {
    let value = text(root, &["rev-parse", "--verify", "HEAD^{commit}"])?;
    let value = value.trim();
    if !sha(value) {
        return Err(error("repository"));
    }
    Ok(value.into())
}
fn repository(state: &Workspaces, request: &Request) -> Result<PathBuf> {
    id(&request.project_id)?;
    let root = state.root(&request.workspace_id)?;
    if state
        .projects
        .lock()
        .map_err(|_| error("internal"))?
        .get(&request.project_id)
        != Some(&root)
    {
        return Err(error("access"));
    }
    let detected =
        PathBuf::from(text(&root, &["rev-parse", "--show-toplevel"])?.trim()).canonicalize()?;
    if detected != root {
        return Err(error("repository-root"));
    }
    Ok(root)
}
fn save(path: &Path, record: &Record) -> Result<()> {
    if path.exists() {
        ordinary(path, false)?;
    }
    let bytes = serde_json::to_vec(record).map_err(|_| error("internal"))?;
    let temporary = path.with_extension(format!("{}.pending", uuid::Uuid::new_v4()));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)?;
    file.write_all(&bytes)?;
    file.sync_all()?;
    drop(file);
    fs::rename(temporary, path)?;
    Ok(())
}
fn load(path: &Path, project: &str, task: &str, root: &Path) -> Result<Record> {
    ordinary(path, false)?;
    if fs::metadata(path)?.len() > 16384 {
        return Err(error("worktree-state"));
    }
    let r: Record =
        serde_json::from_slice(&fs::read(path)?).map_err(|_| error("worktree-state"))?;
    if r.version != 1
        || r.project_id != project
        || r.task_id != task
        || r.repository != root
        || !sha(&r.base_revision)
        || !["creating", "ready", "archived"].contains(&r.state.as_str())
    {
        return Err(error("worktree-state"));
    }
    Ok(r)
}

fn read_text_file(root: &Path, name: &str) -> Result<Option<String>> {
    let path = crate::filesystem::resolve(root, name, false)?;
    if !path.exists() {
        return Ok(None);
    }
    ordinary(&path, false)?;
    if fs::metadata(&path)?.len() > 2 * 1024 * 1024 {
        return Err(error("large"));
    }
    let bytes = fs::read(path)?;
    if bytes.len() > 2 * 1024 * 1024 || bytes.contains(&0) {
        return Err(error("binary"));
    }
    Ok(Some(String::from_utf8(bytes).map_err(|_| error("binary"))?))
}

fn comparison(root: &Path, source: &Path, record: &Record) -> Result<Value> {
    use sha2::{Digest, Sha256};
    let changed = git::run(
        source,
        &[
            "-c",
            "core.fsmonitor=false",
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--name-only",
            "-z",
            "--no-renames",
            &record.base_revision,
            "--",
        ],
        None,
    )?;
    let untracked = git::run(
        source,
        &[
            "-c",
            "core.fsmonitor=false",
            "ls-files",
            "--others",
            "--exclude-standard",
            "-z",
        ],
        None,
    )?;
    let names = changed
        .split(|v| *v == 0)
        .chain(untracked.split(|v| *v == 0))
        .filter(|v| !v.is_empty())
        .map(|v| {
            std::str::from_utf8(v)
                .map(str::to_owned)
                .map_err(|_| error("path"))
        })
        .collect::<Result<std::collections::BTreeSet<_>>>()?;
    if names.len() > 8 {
        return Err(error("worktree-change-limit"));
    }
    let mut files = Vec::new();
    let mut size = 0;
    for name in names {
        relative(&name, false)?;
        if name.split('/').any(|v| v.eq_ignore_ascii_case(".git")) {
            return Err(error("path"));
        }
        let exists = !git::run(
            root,
            &["ls-tree", "-z", &record.base_revision, "--", &name],
            None,
        )?
        .is_empty();
        let base = if exists {
            let data = git::run(
                root,
                &["show", &format!("{}:{}", record.base_revision, name)],
                None,
            )?;
            if data.contains(&0) {
                return Err(error("binary"));
            }
            Some(String::from_utf8(data).map_err(|_| error("binary"))?)
        } else {
            None
        };
        let parent = read_text_file(root, &name)?;
        let modified = read_text_file(source, &name)?;
        if modified == base {
            continue;
        }
        size += base.as_ref().map_or(0, String::len)
            + parent.as_ref().map_or(0, String::len)
            + modified.as_ref().map_or(0, String::len);
        if size > 2 * 1024 * 1024 {
            return Err(error("large"));
        }
        let conflict = parent != base && parent != modified;
        let supported = parent.is_some() || modified.is_some();
        files.push(json!({"path":name,"base":base,"parent":parent,"modified":modified,"conflict":conflict,"supported":supported}));
    }
    let mut value = json!({"projectId":record.project_id,"taskId":record.task_id,"baseRevision":record.base_revision,"parentHead":head(root)?,"files":files});
    let fingerprint = format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(&value).map_err(|_| error("internal"))?)
    );
    value["fingerprint"] = json!(fingerprint);
    Ok(value)
}
impl TaskWorktrees {
    pub fn new(app_data: &Path) -> Self {
        Self {
            base: app_data.join("task-workspaces"),
            operation: Mutex::new(()),
        }
    }
    fn project_directory(&self, project: &str) -> Result<PathBuf> {
        let base = directory(
            self.base.parent().ok_or_else(|| error("path"))?,
            "task-workspaces",
        )?;
        directory(&base, project)
    }
    fn view(&self, state: &Workspaces, project_dir: &Path, r: &Record) -> Result<Value> {
        let task = project_dir.join(&r.task_id);
        ordinary(&task, true)?;
        let source = task.join("source");
        if !source.exists() {
            return Ok(
                json!({"taskId":r.task_id,"projectId":r.project_id,"baseRevision":r.base_revision,"state":"incomplete","baseMode":"committed-head"}),
            );
        }
        ordinary(&source, true)?;
        if r.state == "archived" {
            return Ok(
                json!({"taskId":r.task_id,"projectId":r.project_id,"baseRevision":r.base_revision,"state":"archived","baseMode":"committed-head"}),
            );
        }
        if r.state != "ready" {
            return Ok(
                json!({"taskId":r.task_id,"projectId":r.project_id,"baseRevision":r.base_revision,"state":"incomplete","baseMode":"committed-head"}),
            );
        }
        let source = source.canonicalize()?;
        if source.parent() != Some(task.as_path()) {
            return Err(error("path"));
        }
        let expected_common = PathBuf::from(
            text(
                &r.repository,
                &["rev-parse", "--path-format=absolute", "--git-common-dir"],
            )?
            .trim(),
        )
        .canonicalize()?;
        let actual_common = PathBuf::from(
            text(
                &source,
                &["rev-parse", "--path-format=absolute", "--git-common-dir"],
            )?
            .trim(),
        )
        .canonicalize()?;
        let task_git = PathBuf::from(
            text(
                &source,
                &["rev-parse", "--path-format=absolute", "--git-dir"],
            )?
            .trim(),
        )
        .canonicalize()?;
        let tree_root = PathBuf::from(text(&source, &["rev-parse", "--show-toplevel"])?.trim())
            .canonicalize()?;
        if task_git.parent() != Some(expected_common.join("worktrees").as_path())
            || tree_root != source
        {
            return Err(error("worktree-conflict"));
        }
        if expected_common != actual_common
            || head(&source)? != r.base_revision
            || text(&source, &["symbolic-ref", "--quiet", "--short", "HEAD"]).is_ok()
        {
            return Err(error("worktree-conflict"));
        }
        Ok(
            json!({"taskId":r.task_id,"projectId":r.project_id,"baseRevision":r.base_revision,"state":"ready","baseMode":"committed-head","path":display_path(&source),"connection":state.register(source)?}),
        )
    }
    pub fn execute(&self, state: &Workspaces, request: Request) -> Result<Value> {
        let _guard = self
            .operation
            .try_lock()
            .map_err(|_| error("workspace-busy"))?;
        let _files = state
            .operations
            .try_lock()
            .map_err(|_| error("workspace-busy"))?;
        let root = repository(state, &request)?;
        let current = head(&root)?;
        if request.operation == "baseline" {
            return Ok(
                json!({"head":current,"baseMode":"committed-head","dirty":!git::run(&root,&["-c","core.fsmonitor=false","status","--porcelain=v1","-z","--untracked-files=normal"],None)?.is_empty()}),
            );
        }
        if !["list", "create", "inspect", "compare", "archive", "restore"]
            .contains(&request.operation.as_str())
        {
            return Err(error("invalid"));
        }
        let project_dir = self.project_directory(&request.project_id)?;
        if request.operation == "list" {
            let mut rows = Vec::new();
            for entry in fs::read_dir(&project_dir)? {
                let path = entry?.path();
                if path.extension().is_none_or(|v| v != "json") {
                    continue;
                }
                let task = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .ok_or_else(|| error("worktree-state"))?;
                id(task)?;
                let r = load(&path, &request.project_id, task, &root)?;
                match self.view(state,&project_dir,&r){Ok(value)=>rows.push(value),Err(_)=>rows.push(json!({"taskId":task,"projectId":request.project_id,"baseRevision":r.base_revision,"state":"unavailable","baseMode":"committed-head"}))}
                if rows.len() > 100 {
                    return Err(error("worktree-limit"));
                }
            }
            return Ok(json!({"workspaces":rows}));
        }
        let task = request
            .task_id
            .as_deref()
            .ok_or_else(|| error("worktree-identity"))?;
        id(task)?;
        let record_path = project_dir.join(format!("{task}.json"));
        if record_path.exists() {
            let mut r = load(&record_path, &request.project_id, task, &root)?;
            if request.operation == "archive" || request.operation == "restore" {
                if request.acknowledge_committed_base != Some(true) {
                    return Err(error("access"));
                }
                if request.operation == "restore" && r.state == "archived" {
                    r.state = "ready".into();
                    self.view(state, &project_dir, &r)?;
                } else if request.operation == "archive" && r.state == "ready" {
                    self.view(state, &project_dir, &r)?;
                    r.state = "archived".into();
                } else {
                    return Err(error("worktree-state"));
                }
                save(&record_path, &r)?;
                return self.view(state, &project_dir, &r);
            }
            if request.operation == "create"
                && request.expected_head.as_deref() != Some(r.base_revision.as_str())
            {
                return Err(error("worktree-conflict"));
            }
            let value = self.view(state, &project_dir, &r)?;
            if request.operation == "compare" {
                let path = value
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or_else(|| error("worktree-state"))?;
                return comparison(&root, &PathBuf::from(path).canonicalize()?, &r);
            }
            return Ok(value);
        }
        if request.operation != "create" {
            return Err(error("not-found"));
        }
        if request.acknowledge_committed_base != Some(true)
            || request.expected_head.as_deref() != Some(current.as_str())
        {
            return Err(error("worktree-conflict"));
        }
        if fs::read_dir(&project_dir)?
            .filter_map(std::result::Result::ok)
            .filter(|e| e.path().extension().is_some_and(|v| v == "json"))
            .count()
            >= 100
        {
            return Err(error("worktree-limit"));
        }
        // Do not execute repository hooks, fsmonitor, smudge/process filters or submodule helpers.
        let tree = git::run(
            &root,
            &["ls-tree", "-r", "-z", "--full-tree", &current],
            None,
        )?;
        for entry in tree.split(|b| *b == 0).filter(|e| !e.is_empty()) {
            let entry = std::str::from_utf8(entry).map_err(|_| error("path"))?;
            let (info, name) = entry.split_once('\t').ok_or_else(|| error("repository"))?;
            if !info.starts_with("100644 blob ") && !info.starts_with("100755 blob ") {
                return Err(error("worktree-file-mode"));
            }
            relative(name, false)?;
        }
        let hooks = directory(&project_dir, "no-hooks")?;
        let mut options = vec![
            "-c".to_owned(),
            format!("core.hooksPath={}", display_path(&hooks)),
            "-c".into(),
            "core.fsmonitor=false".into(),
            "-c".into(),
            "core.autocrlf=false".into(),
            "-c".into(),
            "core.longpaths=true".into(),
        ];
        if let Ok(filters) = text(&root, &["config", "--get-regexp", "^filter\\."]) {
            let mut drivers = std::collections::BTreeSet::new();
            for line in filters.lines() {
                let key = line.split_whitespace().next().unwrap_or("");
                if let Some(suffix) = key.strip_prefix("filter.") {
                    if let Some((driver, _)) = suffix.rsplit_once('.') {
                        if driver.is_empty()
                            || !driver
                                .bytes()
                                .all(|c| c.is_ascii_alphanumeric() || b"_.-".contains(&c))
                        {
                            return Err(error("worktree-filter"));
                        }
                        drivers.insert(driver.to_owned());
                    }
                }
            }
            for driver in drivers {
                for setting in ["smudge=", "process=", "required=false"] {
                    options.push("-c".into());
                    options.push(format!("filter.{driver}.{setting}"));
                }
            }
        }
        let task_dir = directory(&project_dir, task)?;
        let source = task_dir.join("source");
        #[cfg(windows)]
        if display_path(&source).encode_utf16().count() > 230 {
            return Err(error("worktree-path-length"));
        }
        if source.exists() {
            return Err(error("duplicate"));
        }
        let mut record = Record {
            version: 1,
            project_id: request.project_id.clone(),
            task_id: task.into(),
            repository: root.clone(),
            base_revision: current.clone(),
            state: "creating".into(),
        };
        save(&record_path, &record)?;
        let destination = display_path(&source);
        let mut create = options.clone();
        create.extend([
            "worktree".into(),
            "add".into(),
            "--detach".into(),
            "--no-checkout".into(),
            destination,
            current.clone(),
        ]);
        git::run(
            &root,
            &create.iter().map(String::as_str).collect::<Vec<_>>(),
            None,
        )?;
        let mut checkout = options;
        checkout.extend([
            "read-tree".into(),
            "--reset".into(),
            "-u".into(),
            "HEAD".into(),
        ]);
        git::run(
            &source,
            &checkout.iter().map(String::as_str).collect::<Vec<_>>(),
            None,
        )?;
        record.state = "ready".into();
        save(&record_path, &record)?;
        self.view(state, &project_dir, &record)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Fixture {
        manager: TaskWorktrees,
        state: Workspaces,
        root: PathBuf,
        data: PathBuf,
        project: String,
        workspace: String,
    }
    impl Fixture {
        fn new() -> Self {
            let dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("../resources/verification/pw26")
                .join(uuid::Uuid::new_v4().to_string());
            fs::create_dir_all(dir.join("repository/src")).unwrap();
            fs::create_dir_all(dir.join("data")).unwrap();
            fs::create_dir_all(dir.join("empty-hooks")).unwrap();
            let root = dir.join("repository").canonicalize().unwrap();
            let data = dir.join("data").canonicalize().unwrap();
            git::run(&root, &["init"], None).unwrap();
            git::run(
                &root,
                &["config", "user.email", "fixture@example.invalid"],
                None,
            )
            .unwrap();
            git::run(&root, &["config", "user.name", "Fixture"], None).unwrap();
            git::run(&root, &["config", "core.autocrlf", "false"], None).unwrap();
            git::run(
                &root,
                &[
                    "config",
                    "core.hooksPath",
                    &display_path(&dir.join("empty-hooks")),
                ],
                None,
            )
            .unwrap();
            fs::write(root.join("src/input.ts"), "export const value = 1;\n").unwrap();
            fs::write(root.join("note.txt"), "Preserve user note\n").unwrap();
            git::run(&root, &["add", "--", "src/input.ts", "note.txt"], None).unwrap();
            git::run(&root, &["commit", "-m", "Disposable baseline"], None).unwrap();
            let state = Workspaces::default();
            let connection = serde_json::to_value(state.register(root.clone()).unwrap()).unwrap();
            let workspace = connection["id"].as_str().unwrap().to_owned();
            let project = uuid::Uuid::new_v4().to_string();
            state
                .projects
                .lock()
                .unwrap()
                .insert(project.clone(), root.clone());
            Self {
                manager: TaskWorktrees::new(&data),
                state,
                root,
                data,
                project,
                workspace,
            }
        }
        fn request(&self, operation: &str, task: Option<&str>) -> Request {
            Request {
                operation: operation.into(),
                workspace_id: self.workspace.clone(),
                project_id: self.project.clone(),
                task_id: task.map(str::to_owned),
                expected_head: Some(head(&self.root).unwrap()),
                acknowledge_committed_base: Some(true),
            }
        }
        fn create(&self, task: &str) -> Value {
            self.manager
                .execute(&self.state, self.request("create", Some(task)))
                .unwrap()
        }
    }
    #[test]
    fn worktree_committed_baseline_preserves_staged_dirty_untracked_and_original_head() {
        let f = Fixture::new();
        let original = head(&f.root).unwrap();
        fs::write(f.root.join("src/input.ts"), "staged user edit\n").unwrap();
        git::run(&f.root, &["add", "--", "src/input.ts"], None).unwrap();
        fs::write(f.root.join("src/input.ts"), "unsaved disk edit\n").unwrap();
        fs::write(f.root.join("untracked.txt"), "untracked user bytes\n").unwrap();
        let before = git::run(&f.root, &["status", "--porcelain=v1", "-z"], None).unwrap();
        let task = uuid::Uuid::new_v4().to_string();
        let result = f.create(&task);
        let path = PathBuf::from(result["path"].as_str().unwrap());
        assert_eq!(
            fs::read_to_string(path.join("src/input.ts")).unwrap(),
            "export const value = 1;\n"
        );
        assert!(!path.join("untracked.txt").exists());
        assert_eq!(head(&path).unwrap(), original);
        assert_eq!(head(&f.root).unwrap(), original);
        assert_eq!(
            git::run(&f.root, &["status", "--porcelain=v1", "-z"], None).unwrap(),
            before
        );
        assert_eq!(
            fs::read_to_string(f.root.join("src/input.ts")).unwrap(),
            "unsaved disk edit\n"
        );
    }
    #[test]
    fn worktree_repeated_request_and_restart_recover_same_identity_without_overwriting_task_edits()
    {
        let f = Fixture::new();
        let task = uuid::Uuid::new_v4().to_string();
        let first = f.create(&task);
        let path = PathBuf::from(first["path"].as_str().unwrap());
        fs::write(path.join("src/input.ts"), "task progress\n").unwrap();
        assert_eq!(f.create(&task)["path"], first["path"]);
        let restored = TaskWorktrees::new(&f.data)
            .execute(&f.state, f.request("inspect", Some(&task)))
            .unwrap();
        assert_eq!(restored["path"], first["path"]);
        assert_eq!(
            fs::read_to_string(path.join("src/input.ts")).unwrap(),
            "task progress\n"
        );
        assert_eq!(
            f.manager
                .execute(&f.state, f.request("list", None))
                .unwrap()["workspaces"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn worktree_stale_revision_missing_consent_and_project_escape_are_blocked() {
        let f = Fixture::new();
        let task = uuid::Uuid::new_v4().to_string();
        let mut r = f.request("create", Some(&task));
        r.expected_head = Some("0".repeat(40));
        assert!(f.manager.execute(&f.state, r).is_err());
        let mut r = f.request("create", Some(&task));
        r.acknowledge_committed_base = Some(false);
        assert!(f.manager.execute(&f.state, r).is_err());
        let mut r = f.request("create", Some(&task));
        r.project_id = uuid::Uuid::new_v4().to_string();
        assert!(f.manager.execute(&f.state, r).is_err());
        assert!(f
            .manager
            .execute(&f.state, f.request("create", Some("../escape")))
            .is_err());
        assert!(!f.data.join("escape").exists());
    }
    #[test]
    fn worktree_checkout_disables_repository_hooks_and_custom_process_filters() {
        let f = Fixture::new();
        fs::write(f.root.join(".gitattributes"), "*.ts filter=blocked\n").unwrap();
        git::run(&f.root, &["add", "--", ".gitattributes"], None).unwrap();
        git::run(&f.root, &["commit", "-m", "Disposable filter policy"], None).unwrap();
        git::run(
            &f.root,
            &[
                "config",
                "filter.blocked.process",
                "node -e \"process.exit(78)\"",
            ],
            None,
        )
        .unwrap();
        git::run(
            &f.root,
            &[
                "config",
                "filter.blocked.smudge",
                "node -e \"process.exit(77)\"",
            ],
            None,
        )
        .unwrap();
        git::run(
            &f.root,
            &["config", "filter.blocked.required", "true"],
            None,
        )
        .unwrap();
        let task = uuid::Uuid::new_v4().to_string();
        let value = f.create(&task);
        assert_eq!(value["state"], "ready");
        assert_eq!(
            fs::read_to_string(PathBuf::from(value["path"].as_str().unwrap()).join("src/input.ts"))
                .unwrap(),
            "export const value = 1;\n"
        );
    }
    #[test]
    fn worktree_corrupt_metadata_is_preserved_and_cannot_rebind_to_another_repository() {
        let f = Fixture::new();
        let task = uuid::Uuid::new_v4().to_string();
        f.create(&task);
        let record = f
            .data
            .join("task-workspaces")
            .join(&f.project)
            .join(format!("{task}.json"));
        fs::write(&record, b"broken saved state").unwrap();
        assert!(f
            .manager
            .execute(&f.state, f.request("inspect", Some(&task)))
            .is_err());
        assert_eq!(fs::read(&record).unwrap(), b"broken saved state");
    }
    #[test]
    fn comparison_tracks_three_way_conflicts_and_independent_task_workspaces() {
        let f = Fixture::new();
        let first = uuid::Uuid::new_v4().to_string();
        let second = uuid::Uuid::new_v4().to_string();
        let a = PathBuf::from(f.create(&first)["path"].as_str().unwrap());
        let b = PathBuf::from(f.create(&second)["path"].as_str().unwrap());
        fs::write(a.join("src/input.ts"), "task A\n").unwrap();
        fs::write(b.join("src/input.ts"), "task B\n").unwrap();
        let initial = f
            .manager
            .execute(&f.state, f.request("compare", Some(&first)))
            .unwrap();
        assert_eq!(initial["files"][0]["conflict"], false);
        fs::write(f.root.join("src/input.ts"), "user change\n").unwrap();
        let changed = f
            .manager
            .execute(&f.state, f.request("compare", Some(&first)))
            .unwrap();
        assert_ne!(initial["fingerprint"], changed["fingerprint"]);
        assert_eq!(changed["files"][0]["conflict"], true);
        assert_eq!(changed["files"][0]["base"], "export const value = 1;\n");
        assert_eq!(changed["files"][0]["parent"], "user change\n");
        assert_eq!(changed["files"][0]["modified"], "task A\n");
        assert_eq!(
            fs::read_to_string(b.join("src/input.ts")).unwrap(),
            "task B\n"
        );
        fs::write(a.join("new.txt"), "new\n").unwrap();
        let result = f
            .manager
            .execute(&f.state, f.request("compare", Some(&first)))
            .unwrap();
        assert!(result["files"]
            .as_array()
            .unwrap()
            .iter()
            .any(|r| r["path"] == "new.txt" && r["supported"] == true));
    }
    #[test]
    fn archive_and_restore_preserve_dirty_files_across_restart() {
        let f = Fixture::new();
        let task = uuid::Uuid::new_v4().to_string();
        let a = PathBuf::from(f.create(&task)["path"].as_str().unwrap());
        fs::write(a.join("src/input.ts"), "unfinished work\n").unwrap();
        let result = f
            .manager
            .execute(&f.state, f.request("archive", Some(&task)))
            .unwrap();
        assert_eq!(result["state"], "archived");
        assert!(result.get("connection").is_none());
        assert!(f
            .manager
            .execute(&f.state, f.request("compare", Some(&task)))
            .is_err());
        let manager = TaskWorktrees::new(&f.data);
        assert_eq!(
            manager.execute(&f.state, f.request("list", None)).unwrap()["workspaces"][0]["state"],
            "archived"
        );
        assert_eq!(
            manager
                .execute(&f.state, f.request("restore", Some(&task)))
                .unwrap()["state"],
            "ready"
        );
        assert_eq!(
            fs::read_to_string(a.join("src/input.ts")).unwrap(),
            "unfinished work\n"
        );
    }
}
