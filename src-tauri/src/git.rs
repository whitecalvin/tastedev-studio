use crate::filesystem::{error, resolve, Result, Workspaces};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{
    path::Path,
    process::{Command, Stdio},
};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Request {
    pub operation: String,
    pub workspace_id: Option<String>,
    pub path: Option<String>,
    pub side: Option<String>,
    pub paths: Option<Vec<String>>,
    pub message: Option<String>,
    pub limit: Option<usize>,
}
fn git(root: &Path, args: &[&str]) -> Result<Vec<u8>> {
    let mut command = Command::new("git");
    command
        .current_dir(root)
        .args([
            "--no-pager",
            "--literal-pathspecs",
            "-c",
            "core.quotepath=false",
        ])
        .args(args)
        .env("GIT_TERMINAL_PROMPT", "0")
        .stdin(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    use std::os::windows::io::AsRawHandle;
    use std::{
        io::Read,
        sync::{
            atomic::{AtomicBool, Ordering},
            Arc,
        },
        time::{Duration, Instant},
    };
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            error(if e.kind() == std::io::ErrorKind::NotFound {
                "git-not-found"
            } else {
                "git"
            })
        })?;
    let job = match crate::job::ProcessJob::attach(child.as_raw_handle()) {
        Ok(job) => job,
        Err(e) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(e);
        }
    };
    let exceeded = Arc::new(AtomicBool::new(false));
    let capture = |reader: Box<dyn Read + Send>, limit: u64| {
        let exceeded = exceeded.clone();
        std::thread::spawn(move || {
            let mut data = Vec::new();
            let result = reader.take(limit + 1).read_to_end(&mut data);
            if data.len() > limit as usize {
                exceeded.store(true, Ordering::SeqCst);
            }
            result.map(|_| data)
        })
    };
    let stdout = capture(
        Box::new(child.stdout.take().ok_or_else(|| error("git"))?),
        4 * 1024 * 1024,
    );
    let stderr = capture(
        Box::new(child.stderr.take().ok_or_else(|| error("git"))?),
        32768,
    );
    let deadline = Instant::now() + Duration::from_secs(30);
    let status = loop {
        if let Some(status) = child.try_wait()? {
            break status;
        }
        if exceeded.load(Ordering::SeqCst) || Instant::now() > deadline {
            job.terminate();
            let _ = child.wait();
            let _ = stdout.join();
            let _ = stderr.join();
            return Err(error("git-limit"));
        }
        std::thread::sleep(Duration::from_millis(10));
    };
    job.terminate();
    let stdout = stdout.join().map_err(|_| error("git"))??;
    let stderr = stderr.join().map_err(|_| error("git"))??;
    if exceeded.load(Ordering::SeqCst) {
        return Err(error("large"));
    }
    if !status.success() {
        return Err(error(
            if String::from_utf8_lossy(&stderr).contains("not a git repository") {
                "not-repository"
            } else if String::from_utf8_lossy(&stderr).contains("Needed a single revision") {
                "missing-revision"
            } else {
                "git"
            },
        ));
    }
    Ok(stdout)
}
fn text(root: &Path, args: &[&str]) -> Result<String> {
    String::from_utf8(git(root, args)?).map_err(|_| error("binary"))
}
fn kind(c: u8) -> Value {
    match c {
        b'?' => json!("untracked"),
        b'A' => json!("added"),
        b'M' | b'T' => json!("modified"),
        b'D' => json!("deleted"),
        b'R' | b'C' => json!("renamed"),
        b'U' => json!("conflicted"),
        _ => Value::Null,
    }
}
pub fn parse_status(bytes: &[u8]) -> Result<Vec<Value>> {
    let mut records = bytes.split(|b| *b == 0);
    let mut files = Vec::new();
    while let Some(record) = records.next() {
        if record.is_empty() {
            continue;
        }
        if record.len() < 4 {
            return Err(error("git"));
        }
        let path = String::from_utf8(record[3..].to_vec()).map_err(|_| error("binary"))?;
        let conflict = record[0] == b'U'
            || record[1] == b'U'
            || &record[..2] == b"AA"
            || &record[..2] == b"DD";
        let mut value = json!({"path":path,"index":if conflict {json!("conflicted")} else if record[0]==b'?' {Value::Null} else {kind(record[0])},"workingTree":if conflict {json!("conflicted")} else {kind(record[1])}});
        if matches!(record[0], b'R' | b'C') || matches!(record[1], b'R' | b'C') {
            value["originalPath"] = json!(String::from_utf8(
                records.next().ok_or_else(|| error("git"))?.to_vec()
            )
            .map_err(|_| error("binary"))?);
        }
        files.push(value);
    }
    Ok(files)
}
fn blob(root: &Path, path: &str, head: bool) -> Result<Vec<u8>> {
    let listing = if head {
        match git(root, &["rev-parse", "--verify", "HEAD"]) {
            Ok(_) => {}
            Err(e) if e.code == "missing-revision" => return Ok(Vec::new()),
            Err(e) => return Err(e),
        }
        git(root, &["ls-tree", "-z", "HEAD", "--", path])?
    } else {
        git(root, &["ls-files", "--stage", "-z", "--", path])?
    };
    for entry in listing.split(|b| *b == 0).filter(|r| !r.is_empty()) {
        let (meta, name) = entry.split_at(
            entry
                .iter()
                .position(|b| *b == b'\t')
                .ok_or_else(|| error("git"))?,
        );
        if &name[1..] != path.as_bytes() {
            continue;
        }
        let fields: Vec<_> = std::str::from_utf8(meta)
            .map_err(|_| error("git"))?
            .split_whitespace()
            .collect();
        if fields.len() != 3 || (head && fields[1] != "blob") || (!head && fields[2] != "0") {
            return Err(error("conflict"));
        }
        return git(
            root,
            &["cat-file", "blob", fields[if head { 2 } else { 1 }]],
        );
    }
    Ok(Vec::new())
}
fn history(root: &Path, limit: usize) -> Result<Value> {
    if git(root, &["rev-parse", "--verify", "HEAD"]).is_err() {
        return Ok(json!([]));
    }
    let format = "--format=%H%x00%h%x00%s%x00%an%x00%aI%x00";
    let data = text(root, &["log", &format!("-{}", limit.clamp(1, 50)), format])?;
    let fields: Vec<_> = data.split('\0').collect();
    let mut commits = Vec::new();
    for record in fields.chunks(5) {
        if record.len() == 5 {
            commits.push(json!({"hash":record[0].trim(),"shortHash":record[1],"message":record[2],"author":record[3],"date":record[4]}));
        }
    }
    Ok(json!(commits))
}
pub fn execute(state: &Workspaces, request: Request) -> Result<Value> {
    let root = state.root(
        request
            .workspace_id
            .as_deref()
            .ok_or_else(|| error("access"))?,
    )?;
    // A parent repository is never silently authorized by selecting one of its subfolders.
    let detected = match text(&root, &["rev-parse", "--show-toplevel"]) {
        Ok(path) => std::path::PathBuf::from(path.trim()).canonicalize()?,
        Err(e) if request.operation == "detect" && e.code == "not-repository" => {
            return Ok(Value::Null)
        }
        Err(e) => return Err(e),
    };
    if detected != root {
        return Err(error("repository-root"));
    }
    match request.operation.as_str() {
        "detect" => {
            let branch = text(&root, &["symbolic-ref", "--quiet", "--short", "HEAD"])
                .ok()
                .map(|s| s.trim().to_owned());
            Ok(
                json!({"id":request.workspace_id,"root":crate::filesystem::display_path(&root),"currentBranch":branch,"detached":branch.is_none(),"hasRemote":!text(&root,&["remote"])?.trim().is_empty()}),
            )
        }
        "status" => Ok(json!(parse_status(&git(
            &root,
            &["status", "--porcelain=v1", "-z", "--untracked-files=all"]
        )?)?)),
        "branches" => {
            let value = text(
                &root,
                &[
                    "for-each-ref",
                    "--format=%(refname)%00%(HEAD)",
                    "refs/heads",
                    "refs/remotes",
                ],
            )?;
            Ok(json!(value.lines().filter_map(|line| line.split_once('\0')).map(|(name,current)|json!({"name":name.strip_prefix("refs/heads/").or_else(||name.strip_prefix("refs/remotes/")).unwrap_or(name),"current":current=="*","remote":name.starts_with("refs/remotes/")})).collect::<Vec<_>>()))
        }
        "log" => history(&root, request.limit.unwrap_or(50)),
        "stage" | "unstage" => {
            let paths = request.paths.ok_or_else(|| error("path"))?;
            if paths.is_empty() || paths.len() > 10000 {
                return Err(error("path"));
            }
            for path in &paths {
                resolve(&root, path, false)?;
            }
            if !git(&root, &["ls-files", "-u"])?.is_empty() {
                return Err(error("conflict"));
            }
            let has_head = git(&root, &["rev-parse", "--verify", "HEAD"]).is_ok();
            let mut args = if request.operation == "stage" {
                vec!["add", "--"]
            } else if has_head {
                vec!["reset", "-q", "HEAD", "--"]
            } else {
                vec!["rm", "--cached", "--"]
            };
            args.extend(paths.iter().map(String::as_str));
            git(&root, &args)?;
            Ok(Value::Null)
        }
        "commit" => {
            let message = request.message.ok_or_else(|| error("message"))?;
            if message.trim().is_empty() || message.chars().count() > 4096 || message.contains('\0')
            {
                return Err(error("message"));
            }
            if !git(&root, &["ls-files", "-u"])?.is_empty() {
                return Err(error("conflict"));
            }
            if git(&root, &["diff", "--cached", "--name-only", "-z"])?.is_empty() {
                return Err(error("empty-index"));
            }
            git(&root, &["commit", "-m", &message])?;
            Ok(history(&root, 1)?[0].clone())
        }
        "diff" => {
            let path = request.path.ok_or_else(|| error("path"))?;
            let disk_path = resolve(&root, &path, false)?;
            let side = request.side.ok_or_else(|| error("invalid"))?;
            if side != "working" && side != "staged" {
                return Err(error("invalid"));
            }
            let index = blob(&root, &path, false)?;
            let original_path = if side == "staged" {
                parse_status(&git(
                    &root,
                    &["status", "--porcelain=v1", "-z", "--untracked-files=no"],
                )?)?
                .into_iter()
                .find(|file| file["path"] == path)
                .and_then(|file| file["originalPath"].as_str().map(str::to_owned))
                .unwrap_or_else(|| path.clone())
            } else {
                path.clone()
            };
            resolve(&root, &original_path, false)?;
            let (original, modified) = if side == "staged" {
                (blob(&root, &original_path, true)?, index)
            } else {
                (
                    index,
                    if disk_path.exists() {
                        let meta = std::fs::metadata(&disk_path)?;
                        if meta.len() > 2 * 1024 * 1024 {
                            return Err(error("large"));
                        }
                        {
                            use std::io::Read;
                            let mut bytes = Vec::new();
                            std::fs::File::open(disk_path)?
                                .take(2 * 1024 * 1024 + 1)
                                .read_to_end(&mut bytes)?;
                            bytes
                        }
                    } else {
                        Vec::new()
                    },
                )
            };
            if original.len() + modified.len() > 2 * 1024 * 1024 {
                return Err(error("large"));
            }
            let binary = original.contains(&0)
                || modified.contains(&0)
                || std::str::from_utf8(&original).is_err()
                || std::str::from_utf8(&modified).is_err();
            Ok(
                json!({"path":path,"side":side,"binary":binary,"original":if binary {String::new()} else {String::from_utf8_lossy(&original).into_owned()},"modified":if binary {String::new()} else {String::from_utf8_lossy(&modified).into_owned()}}),
            )
        }
        _ => Err(error("invalid")),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn status_handles_spaces_rename_and_conflict() {
        let result =
            parse_status(b" M a b.txt\0R  new.txt\0old.txt\0UU conflict.txt\0?? fresh\0").unwrap();
        assert_eq!(result[0]["path"], "a b.txt");
        assert_eq!(result[1]["originalPath"], "old.txt");
        assert_eq!(result[2]["index"], "conflicted");
        assert_eq!(result[3]["workingTree"], "untracked");
    }
    #[test]
    fn real_git_workflow_keeps_literal_paths_and_messages() {
        let temp = tempfile::tempdir().unwrap();
        let root = temp.path();
        git(root, &["init", "-b", "main"]).unwrap();
        git(root, &["config", "user.name", "Studio Test"]).unwrap();
        git(root, &["config", "user.email", "studio@example.invalid"]).unwrap();
        let state = Workspaces::default();
        state
            .roots
            .lock()
            .unwrap()
            .insert("test".into(), root.canonicalize().unwrap());
        let call = |operation: &str, paths: Option<Vec<String>>, message: Option<String>| {
            execute(
                &state,
                Request {
                    operation: operation.into(),
                    workspace_id: Some("test".into()),
                    path: Some("a [1].txt".into()),
                    side: Some("working".into()),
                    paths,
                    message,
                    limit: Some(50),
                },
            )
        };
        std::fs::write(root.join("a [1].txt"), "baseline").unwrap();
        assert_eq!(call("detect", None, None).unwrap()["currentBranch"], "main");
        call("stage", Some(vec!["a [1].txt".into()]), None).unwrap();
        call("unstage", Some(vec!["a [1].txt".into()]), None).unwrap();
        call("stage", Some(vec!["a [1].txt".into()]), None).unwrap();
        let commit = call("commit", None, Some("literal & message \"safe\"".into())).unwrap();
        assert_eq!(commit["message"], "literal & message \"safe\"");
        assert_eq!(
            call("status", None, None)
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            0
        );
        std::fs::write(root.join("a [1].txt"), "modified").unwrap();
        let diff = call("diff", None, None).unwrap();
        assert_eq!(diff["original"], "baseline");
        assert_eq!(diff["modified"], "modified");
        assert_eq!(
            call("log", None, None).unwrap().as_array().unwrap().len(),
            1
        );
        std::fs::rename(root.join("a [1].txt"), root.join("renamed.txt")).unwrap();
        git(root, &["add", "--all"]).unwrap();
        let renamed = execute(&state, serde_json::from_value(json!({"operation":"diff", "workspaceId":"test", "path":"renamed.txt", "side":"staged"})).unwrap()).unwrap();
        // Git may classify a wholly rewritten file as add/delete; a true rename is checked below.
        assert_eq!(renamed["modified"], "modified");
        std::fs::write(root.join("renamed.txt"), "baseline").unwrap();
        git(root, &["add", "--all"]).unwrap();
        let renamed = execute(&state, serde_json::from_value(json!({"operation":"diff", "workspaceId":"test", "path":"renamed.txt", "side":"staged"})).unwrap()).unwrap();
        assert_eq!(renamed["original"], "baseline");
        assert_eq!(renamed["modified"], "baseline");
        git(root, &["update-ref", "refs/remotes/upstream/main", "HEAD"]).unwrap();
        let branches = call("branches", None, None).unwrap();
        assert!(branches
            .as_array()
            .unwrap()
            .iter()
            .any(|b| b["name"] == "upstream/main" && b["remote"] == true));
    }
}
