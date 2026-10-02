use crate::filesystem::{error, Result, Workspaces};
use crate::git;
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{Duration, Instant},
};
#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Proposal {
    pub workspace_id: String,
    pub operation: String,
    pub branch: Option<String>,
    pub remote: Option<String>,
    pub message: Option<String>,
    pub path: Option<String>,
    pub hunk: Option<usize>,
}
struct Approval {
    proposal: Proposal,
    root: PathBuf,
    fingerprint: String,
    created: Instant,
}
#[derive(Default)]
pub struct Collaboration {
    approvals: Mutex<HashMap<String, Approval>>,
    operation: Mutex<()>,
}
fn text(root: &Path, args: &[&str]) -> Result<String> {
    String::from_utf8(git::run(root, args, None)?).map_err(|_| error("binary"))
}
fn root(state: &Workspaces, workspace: &str) -> Result<PathBuf> {
    let root = state.root(workspace)?;
    let detected =
        PathBuf::from(text(&root, &["rev-parse", "--show-toplevel"])?.trim()).canonicalize()?;
    if detected != root {
        return Err(error("repository-root"));
    }
    Ok(root)
}
fn branch(root: &Path, value: &str) -> Result<()> {
    if value.is_empty()
        || value.len() > 200
        || value.starts_with('-')
        || !value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_./-".contains(c))
        || value.contains("..")
    {
        return Err(error("git-branch"));
    }
    git::run(root, &["check-ref-format", "--branch", value], None)?;
    Ok(())
}
fn remote(root: &Path, value: &str) -> Result<()> {
    if value.is_empty()
        || value.len() > 100
        || value.starts_with('-')
        || !value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c))
        || !text(root, &["remote"])?.lines().any(|r| r == value)
    {
        return Err(error("git-remote"));
    }
    Ok(())
}
fn fingerprint(root: &Path, proposal: &Proposal) -> Result<String> {
    let mut hash = Sha256::new();
    for args in [
        vec!["rev-parse", "--verify", "HEAD"],
        vec!["symbolic-ref", "--quiet", "HEAD"],
        vec!["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        vec!["ls-files", "--stage", "-z"],
        vec!["diff", "--binary", "--no-ext-diff", "--no-textconv"],
        vec!["for-each-ref", "--format=%(refname) %(objectname)"],
    ] {
        let bytes = git::run(root, &args, None)?;
        hash.update((bytes.len() as u64).to_le_bytes());
        hash.update(bytes);
    }
    if let Some(remote) = &proposal.remote {
        let value = git::run(root, &["remote", "get-url", remote], None)?;
        hash.update(value);
    }
    Ok(format!("{:x}", hash.finalize()))
}
fn preflight(root: &Path, proposal: &Proposal) -> Result<()> {
    if !matches!(
        proposal.operation.as_str(),
        "create-branch"
            | "switch-branch"
            | "fetch"
            | "pull"
            | "push"
            | "commit"
            | "resolve-conflict"
            | "stage-hunk"
    ) {
        return Err(error("git-permission"));
    }
    if matches!(
        proposal.operation.as_str(),
        "create-branch" | "switch-branch" | "pull" | "push"
    ) {
        branch(
            root,
            proposal
                .branch
                .as_deref()
                .ok_or_else(|| error("git-branch"))?,
        )?;
    }
    if matches!(proposal.operation.as_str(), "fetch" | "pull" | "push") {
        remote(
            root,
            proposal
                .remote
                .as_deref()
                .ok_or_else(|| error("git-remote"))?,
        )?;
    }
    if matches!(
        proposal.operation.as_str(),
        "create-branch" | "switch-branch" | "pull"
    ) && !git::run(
        root,
        &["status", "--porcelain=v1", "-z", "--untracked-files=all"],
        None,
    )?
    .is_empty()
    {
        return Err(error("git-dirty"));
    }
    if matches!(proposal.operation.as_str(), "pull" | "push")
        && text(root, &["symbolic-ref", "--quiet", "--short", "HEAD"])?.trim()
            != proposal.branch.as_deref().unwrap_or("")
    {
        return Err(error("git-branch"));
    }
    if let Some(value) = &proposal.remote {
        remote(root, value)?;
    }
    if proposal.operation == "stage-hunk" {
        crate::git_hunks::patch(
            root,
            proposal.path.as_deref().ok_or_else(|| error("path"))?,
            proposal.hunk.ok_or_else(|| error("git-hunk"))?,
        )?;
    }
    if proposal.operation == "resolve-conflict" {
        let path = proposal.path.as_deref().ok_or_else(|| error("path"))?;
        let file = crate::filesystem::resolve(root, path, false)?;
        if git::run(root, &["ls-files", "--unmerged", "-z", "--", path], None)?.is_empty() {
            return Err(error("conflict"));
        }
        if std::fs::metadata(&file)?.len() > 2 * 1024 * 1024 {
            return Err(error("large"));
        }
        let content = std::fs::read_to_string(file)?;
        if content.lines().any(|line| {
            line.starts_with("<<<<<<<")
                || line.starts_with("=======")
                || line.starts_with(">>>>>>>")
        }) {
            return Err(error("conflict"));
        }
    }
    if proposal.operation == "commit" {
        let message = proposal
            .message
            .as_deref()
            .ok_or_else(|| error("message"))?;
        if message.trim().is_empty() || message.len() > 4096 || message.contains('\0') {
            return Err(error("message"));
        }
        if !git::run(root, &["ls-files", "-u"], None)?.is_empty() {
            return Err(error("conflict"));
        }
        if git::run(root, &["diff", "--cached", "--name-only", "-z"], None)?.is_empty() {
            return Err(error("empty-index"));
        }
    }
    Ok(())
}
impl Collaboration {
    pub fn prepare(&self, state: &Workspaces, proposal: Proposal) -> Result<Value> {
        let _guard = self.operation.lock().map_err(|_| error("internal"))?;
        let _files = state.operations.lock().map_err(|_| error("internal"))?;
        let root = root(state, &proposal.workspace_id)?;
        preflight(&root, &proposal)?;
        let fingerprint = fingerprint(&root, &proposal)?;
        let branch = text(&root, &["symbolic-ref", "--quiet", "--short", "HEAD"])?
            .trim()
            .to_owned();
        let head = text(&root, &["rev-parse", "--verify", "HEAD"])?
            .trim()
            .to_owned();
        let files = text(&root, &["diff", "--cached", "--name-only"])?;
        let id = uuid::Uuid::new_v4().to_string();
        let mut approvals = self.approvals.lock().map_err(|_| error("internal"))?;
        approvals.retain(|_, row| row.created.elapsed() < Duration::from_secs(60));
        if approvals.len() >= 16 {
            return Err(error("git-limit"));
        }
        let preview_patch = if proposal.operation == "stage-hunk" {
            Some(
                String::from_utf8(crate::git_hunks::patch(
                    &root,
                    proposal.path.as_deref().unwrap_or(""),
                    proposal.hunk.unwrap_or(usize::MAX),
                )?)
                .map_err(|_| error("binary"))?,
            )
        } else {
            None
        };
        let result = json!({"approvalId":id,"operation":proposal.operation,"branch":proposal.branch.as_deref().unwrap_or(&branch),"remote":proposal.remote,"message":proposal.message,"head":head,"files":if matches!(proposal.operation.as_str(),"resolve-conflict"|"stage-hunk"){vec![proposal.path.as_deref().unwrap_or("")]}else{files.lines().collect::<Vec<_>>() },"patch":preview_patch,"expiresInSeconds":60});
        approvals.insert(
            id,
            Approval {
                proposal,
                root,
                fingerprint,
                created: Instant::now(),
            },
        );
        Ok(result)
    }
    pub fn cancel(&self, workspace: &str, id: &str) -> Result<()> {
        let mut approvals = self.approvals.lock().map_err(|_| error("internal"))?;
        if approvals
            .get(id)
            .is_some_and(|row| row.proposal.workspace_id != workspace)
        {
            return Err(error("git-approval"));
        }
        approvals.remove(id);
        Ok(())
    }
    pub fn apply(&self, state: &Workspaces, workspace: &str, id: &str) -> Result<Value> {
        let _guard = self.operation.lock().map_err(|_| error("internal"))?;
        let approval = {
            let mut approvals = self.approvals.lock().map_err(|_| error("internal"))?;
            if approvals
                .get(id)
                .is_none_or(|row| row.proposal.workspace_id != workspace)
            {
                return Err(error("git-approval"));
            }
            approvals.remove(id).ok_or_else(|| error("git-approval"))?
        };
        let _files = state.operations.lock().map_err(|_| error("internal"))?;
        let root = root(state, workspace)?;
        if approval.created.elapsed() > Duration::from_secs(60) || root != approval.root {
            return Err(error("git-approval"));
        }
        if fingerprint(&root, &approval.proposal)? != approval.fingerprint {
            return Err(error("git-conflict"));
        }
        let proposal = approval.proposal;
        preflight(&root, &proposal)?;
        if proposal.operation == "stage-hunk" {
            crate::git_hunks::stage(
                &root,
                proposal.path.as_deref().unwrap_or(""),
                proposal.hunk.unwrap_or(usize::MAX),
            )?;
            return Ok(json!({"operation":"stage-hunk","result":"completed"}));
        }
        let branch = proposal.branch.as_deref().unwrap_or("");
        let remote = proposal.remote.as_deref().unwrap_or("");
        let target = format!("HEAD:refs/heads/{branch}");
        let args = match proposal.operation.as_str() {
            "create-branch" => vec!["switch", "-c", branch],
            "switch-branch" => vec!["switch", "--", branch],
            "fetch" => vec!["fetch", "--no-recurse-submodules", "--", remote],
            "pull" => vec![
                "pull",
                "--ff-only",
                "--no-rebase",
                "--no-autostash",
                "--no-recurse-submodules",
                "--",
                remote,
                branch,
            ],
            "push" => vec!["push", "--", remote, &target],
            "resolve-conflict" => vec!["add", "--", proposal.path.as_deref().unwrap_or("")],
            "commit" => vec!["commit", "-m", proposal.message.as_deref().unwrap_or("")],
            _ => return Err(error("git-permission")),
        };
        git::run(&root, &args, None)?;
        Ok(
            json!({"operation":proposal.operation,"result":"completed","head":text(&root,&["rev-parse","--verify","HEAD"])?.trim()}),
        )
    }
    pub fn overview(&self, state: &Workspaces, workspace: &str) -> Result<Value> {
        let root = root(state, workspace)?;
        let remote_names = text(&root, &["remote"])?;
        let branch = text(&root, &["symbolic-ref", "--quiet", "--short", "HEAD"])
            .ok()
            .map(|s| s.trim().to_owned());
        let counts=text(&root,&["rev-list","--left-right","--count","HEAD...@{upstream}"]).ok().and_then(|s|{let values=s.split_whitespace().collect::<Vec<_>>();Some(json!({"ahead":values.first()?.parse::<u32>().ok()?,"behind":values.get(1)?.parse::<u32>().ok()?}))});
        Ok(
            json!({"remotes":remote_names.lines().take(100).collect::<Vec<_>>(),"branch":branch,"head":text(&root,&["rev-parse","--verify","HEAD"]).ok().map(|s|s.trim().to_owned()),"divergence":counts}),
        )
    }
    pub fn conflict(&self, state: &Workspaces, workspace: &str, path: &str) -> Result<Value> {
        let root = root(state, workspace)?;
        crate::filesystem::resolve(&root, path, false)?;
        let entries = git::run(&root, &["ls-files", "--unmerged", "-z", "--", path], None)?;
        if entries.is_empty() {
            return Err(error("conflict"));
        }
        let mut result = json!({"path":path});
        for (stage, key) in [("1", "base"), ("2", "ours"), ("3", "theirs")] {
            let entry = entries
                .split(|b| *b == 0)
                .filter_map(|line| std::str::from_utf8(line).ok())
                .find_map(|line| {
                    let (meta, name) = line.split_once('\t')?;
                    let fields = meta.split_whitespace().collect::<Vec<_>>();
                    (name == path && fields.len() == 3 && fields[2] == stage)
                        .then(|| fields[1].to_owned())
                });
            result[key] = if let Some(hash) = entry {
                let bytes = git::run(&root, &["cat-file", "blob", &hash], None)?;
                if bytes.len() > 2 * 1024 * 1024 {
                    return Err(error("large"));
                }
                json!(String::from_utf8(bytes).map_err(|_| error("binary"))?)
            } else {
                json!("")
            };
        }
        Ok(result)
    }
    pub fn compare_url(
        &self,
        state: &Workspaces,
        workspace: &str,
        remote_name: &str,
        base: &str,
        head: &str,
    ) -> Result<Value> {
        let root = root(state, workspace)?;
        remote(&root, remote_name)?;
        branch(&root, base)?;
        branch(&root, head)?;
        let url = text(&root, &["remote", "get-url", remote_name])?;
        let url = url.trim();
        let repo = if let Some(value) = url.strip_prefix("git@github.com:") {
            value
        } else if let Some(value) = url.strip_prefix("https://github.com/") {
            value
        } else {
            return Err(error("git-remote"));
        };
        let repo = repo.trim_end_matches(".git");
        let parts = repo.split('/').collect::<Vec<_>>();
        if parts.len() != 2
            || parts.iter().any(|part| {
                part.is_empty()
                    || !part
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || "_.-".contains(c))
            })
        {
            return Err(error("git-remote"));
        }
        let encoded = |value: &str| {
            reqwest::Url::parse("https://github.com")
                .unwrap()
                .query_pairs_mut()
                .append_pair("value", value)
                .finish()
                .query()
                .unwrap()
                .trim_start_matches("value=")
                .to_owned()
        };
        Ok(
            json!({"url":format!("https://github.com/{repo}/compare/{}...{}?expand=1",encoded(base),encoded(head)),"repository":repo,"base":base,"head":head}),
        )
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Request {
    pub action: String,
    pub workspace_id: String,
    pub proposal: Option<Proposal>,
    pub approval_id: Option<String>,
    pub path: Option<String>,
    pub remote: Option<String>,
    pub base: Option<String>,
    pub head: Option<String>,
}
impl Collaboration {
    pub fn execute(&self, state: &Workspaces, request: Request) -> Result<Value> {
        let id = request.workspace_id;
        let value = request.approval_id.as_deref().unwrap_or("");
        match request.action.as_str() {
            "prepare" => {
                let proposal = request.proposal.ok_or_else(|| error("invalid"))?;
                if proposal.workspace_id != id {
                    return Err(error("git-approval"));
                }
                self.prepare(state, proposal)
            }
            "apply" => self.apply(state, &id, value),
            "cancel" => {
                self.cancel(&id, value)?;
                Ok(Value::Null)
            }
            "overview" => self.overview(state, &id),
            "hunks" => Ok(json!(crate::git_hunks::hunks(
                &root(state, &id)?,
                request.path.as_deref().ok_or_else(|| error("path"))?
            )?)),
            "conflict" => self.conflict(
                state,
                &id,
                request.path.as_deref().ok_or_else(|| error("path"))?,
            ),
            "compare" => self.compare_url(
                state,
                &id,
                request.remote.as_deref().unwrap_or(""),
                request.base.as_deref().unwrap_or(""),
                request.head.as_deref().unwrap_or(""),
            ),
            _ => Err(error("git-permission")),
        }
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    fn fixture() -> (tempfile::TempDir, Workspaces, String, PathBuf, PathBuf) {
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-5/native");
        fs::create_dir_all(base.clone()).unwrap();
        let dir = tempfile::tempdir_in(base).unwrap();
        let project = dir.path().join("project");
        let remote = dir.path().join("remote.git");
        fs::create_dir(&project).unwrap();
        fs::create_dir(&remote).unwrap();
        git::run(&remote, &["init", "--bare", "--initial-branch=main"], None).unwrap();
        git::run(&project, &["init", "--initial-branch=main"], None).unwrap();
        for (key, value) in [
            ("core.autocrlf", "false"),
            ("user.name", "Controlled Verification"),
            ("user.email", "verification@example.invalid"),
        ] {
            git::run(&project, &["config", key, value], None).unwrap();
        }
        fs::write(project.join("main.txt"), "baseline\n").unwrap();
        git::run(&project, &["add", "--", "main.txt"], None).unwrap();
        git::run(&project, &["commit", "-m", "Controlled baseline"], None).unwrap();
        git::run(
            &project,
            &[
                "remote",
                "add",
                "origin",
                &crate::filesystem::display_path(&remote),
            ],
            None,
        )
        .unwrap();
        git::run(&project, &["push", "-u", "origin", "main"], None).unwrap();
        let workspaces = Workspaces::default();
        let value = serde_json::to_value(workspaces.register(project.clone()).unwrap()).unwrap();
        let workspace = value["id"].as_str().unwrap().to_owned();
        (dir, workspaces, workspace, project, remote)
    }
    fn proposal(workspace: &str, operation: &str, branch: &str) -> Proposal {
        Proposal {
            workspace_id: workspace.into(),
            operation: operation.into(),
            branch: Some(branch.into()),
            remote: Some("origin".into()),
            message: Some("Approved controlled change".into()),
            path: None,
            hunk: None,
        }
    }
    fn approved(c: &Collaboration, w: &Workspaces, proposal: Proposal) -> Value {
        let workspace = proposal.workspace_id.clone();
        let preview = c.prepare(w, proposal).unwrap();
        c.apply(w, &workspace, preview["approvalId"].as_str().unwrap())
            .unwrap()
    }
    #[test]
    fn actual_branches_commit_push_fetch_pull_and_approval() {
        let (_dir, w, id, project, remote) = fixture();
        let c = Collaboration::default();
        approved(&c, &w, proposal(&id, "create-branch", "feature/verified"));
        fs::write(project.join("main.txt"), "approved\n").unwrap();
        git::run(&project, &["add", "--", "main.txt"], None).unwrap();
        let preview = c
            .prepare(&w, proposal(&id, "commit", "feature/verified"))
            .unwrap();
        assert_eq!(preview["files"][0], "main.txt");
        let before = text(&project, &["rev-parse", "HEAD"]).unwrap();
        assert_eq!(text(&project, &["rev-parse", "HEAD"]).unwrap(), before);
        c.apply(&w, &id, preview["approvalId"].as_str().unwrap())
            .unwrap();
        assert!(c
            .apply(&w, &id, preview["approvalId"].as_str().unwrap())
            .is_err());
        approved(&c, &w, proposal(&id, "push", "feature/verified"));
        assert_eq!(
            text(&project, &["rev-parse", "HEAD"]).unwrap(),
            text(&remote, &["rev-parse", "refs/heads/feature/verified"]).unwrap()
        );
        approved(&c, &w, proposal(&id, "switch-branch", "main"));
        assert_eq!(
            fs::read_to_string(project.join("main.txt")).unwrap(),
            "baseline\n"
        );
        approved(&c, &w, proposal(&id, "fetch", "main"));
        // A second local clone simulates another developer; no public remote mutation.
        let peer = _dir.path().join("peer");
        git::run(
            _dir.path(),
            &[
                "clone",
                &crate::filesystem::display_path(&remote),
                &crate::filesystem::display_path(&peer),
            ],
            None,
        )
        .unwrap();
        git::run(&peer, &["config", "core.autocrlf", "false"], None).unwrap();
        git::run(&peer, &["config", "user.name", "Controlled Peer"], None).unwrap();
        git::run(
            &peer,
            &["config", "user.email", "peer@example.invalid"],
            None,
        )
        .unwrap();
        fs::write(peer.join("peer.txt"), "peer change\n").unwrap();
        git::run(&peer, &["add", "--", "peer.txt"], None).unwrap();
        git::run(&peer, &["commit", "-m", "Peer change"], None).unwrap();
        git::run(&peer, &["push", "origin", "main"], None).unwrap();
        approved(&c, &w, proposal(&id, "pull", "main"));
        assert_eq!(
            fs::read_to_string(project.join("peer.txt")).unwrap(),
            "peer change\n"
        );
        let overview = c.overview(&w, &id).unwrap();
        assert_eq!(overview["branch"], "main");
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-5");
        let name = if cfg!(debug_assertions) {
            "ACTUAL-GIT-DEV.json"
        } else {
            "ACTUAL-GIT-PROD.json"
        };
        fs::write(base.join(name),serde_json::to_vec_pretty(&json!({"result":"PASS","actualGit":true,"actualNativeHost":true,"remote":"controlled local bare remote","checks":["branch create/switch","approval before commit","one-shot approval","push remote revision identity","fetch","peer fast-forward pull","overview"],"head":text(&project,&["rev-parse","HEAD"]).unwrap().trim()})).unwrap()).unwrap();
    }
    #[test]
    fn stale_scope_cancel_dirty_and_option_injection_blocked() {
        let (_dir, w, id, project, _remote) = fixture();
        let c = Collaboration::default();
        let p = c
            .prepare(&w, proposal(&id, "create-branch", "approved"))
            .unwrap();
        assert!(c
            .apply(&w, "foreign", p["approvalId"].as_str().unwrap())
            .is_err());
        fs::write(project.join("main.txt"), "user changed\n").unwrap();
        assert_eq!(
            c.apply(&w, &id, p["approvalId"].as_str().unwrap())
                .unwrap_err()
                .code,
            "git-conflict"
        );
        assert_eq!(
            fs::read_to_string(project.join("main.txt")).unwrap(),
            "user changed\n"
        );
        assert_eq!(
            c.prepare(&w, proposal(&id, "switch-branch", "main"))
                .unwrap_err()
                .code,
            "git-dirty"
        );
        for name in ["--force", "../escape", "@{-1}", "main:other", "main;cmd"] {
            assert!(c.prepare(&w, proposal(&id, "push", name)).is_err());
        }
        let mut p = proposal(&id, "fetch", "main");
        p.remote = Some("--all".into());
        assert!(c.prepare(&w, p).is_err());
        let preview = c.prepare(&w, proposal(&id, "fetch", "main")).unwrap();
        let approval = preview["approvalId"].as_str().unwrap();
        c.cancel(&id, approval).unwrap();
        assert!(c.apply(&w, &id, approval).is_err());
    }
    #[test]
    fn actual_conflict_three_way_review_preserves_working_tree() {
        let (_dir, w, id, project, _remote) = fixture();
        let c = Collaboration::default();
        approved(&c, &w, proposal(&id, "create-branch", "side"));
        fs::write(project.join("main.txt"), "side\n").unwrap();
        git::run(&project, &["add", "--", "main.txt"], None).unwrap();
        approved(&c, &w, proposal(&id, "commit", "side"));
        approved(&c, &w, proposal(&id, "switch-branch", "main"));
        fs::write(project.join("main.txt"), "main\n").unwrap();
        git::run(&project, &["add", "--", "main.txt"], None).unwrap();
        approved(&c, &w, proposal(&id, "commit", "main"));
        assert!(git::run(&project, &["merge", "side"], None).is_err());
        let before = fs::read(project.join("main.txt")).unwrap();
        let review = c.conflict(&w, &id, "main.txt").unwrap();
        assert_eq!(review["base"], "baseline\n");
        assert_eq!(review["ours"], "main\n");
        assert_eq!(review["theirs"], "side\n");
        assert_eq!(fs::read(project.join("main.txt")).unwrap(), before);
        assert!(c.conflict(&w, &id, "../escape").is_err());
        assert!(c.prepare(&w, proposal(&id, "commit", "main")).is_err());
        let mut resolved = proposal(&id, "resolve-conflict", "main");
        resolved.path = Some("main.txt".into());
        assert!(c.prepare(&w, resolved.clone()).is_err());
        fs::write(project.join("main.txt"), "Manual resolution\n").unwrap();
        approved(&c, &w, resolved);
        assert!(git::run(&project, &["ls-files", "-u"], None)
            .unwrap()
            .is_empty());
        assert_eq!(
            fs::read_to_string(project.join("main.txt")).unwrap(),
            "Manual resolution\n"
        );
    }
    #[test]
    fn github_compare_validates_repository_and_encodes_branches() {
        let (_dir, w, id, project, _remote) = fixture();
        let c = Collaboration::default();
        git::run(
            &project,
            &[
                "remote",
                "set-url",
                "origin",
                "https://github.com/controlled/example.git",
            ],
            None,
        )
        .unwrap();
        assert_eq!(
            c.compare_url(&w, &id, "origin", "main", "feature/review")
                .unwrap()["url"],
            "https://github.com/controlled/example/compare/main...feature%2Freview?expand=1"
        );
        git::run(
            &project,
            &[
                "remote",
                "set-url",
                "origin",
                "https://user:dummy@github.com/controlled/example",
            ],
            None,
        )
        .unwrap();
        assert!(c.compare_url(&w, &id, "origin", "main", "feature").is_err());
    }
    #[test]
    fn actual_hunk_stage_preserves_other_changes_and_rejects_stale_approval() {
        let (_dir, w, id, project, _remote) = fixture();
        let c = Collaboration::default();
        let file = project.join("main.txt");
        fs::write(&file, "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n").unwrap();
        git::run(&project, &["add", "--", "main.txt"], None).unwrap();
        git::run(
            &project,
            &["commit", "-m", "Controlled hunk baseline"],
            None,
        )
        .unwrap();
        fs::write(
            &file,
            "USER_STAGED\ntwo\nthree\nfour\nfive\nsix\nseven\neight\n",
        )
        .unwrap();
        git::run(&project, &["add", "--", "main.txt"], None).unwrap();
        let working = "USER_STAGED\nCHANGE_A\nthree\nfour\nfive\nsix\nseven\nCHANGE_B\n";
        fs::write(&file, working).unwrap();
        let before = text(&project, &["show", ":main.txt"]).unwrap();
        let hunks = crate::git_hunks::hunks(&project.canonicalize().unwrap(), "main.txt").unwrap();
        assert_eq!(hunks.len(), 2);
        let mut p = proposal(&id, "stage-hunk", "main");
        p.path = Some("main.txt".into());
        p.hunk = Some(0);
        let preview = c.prepare(&w, p.clone()).unwrap();
        assert_eq!(text(&project, &["show", ":main.txt"]).unwrap(), before);
        assert!(preview["patch"].as_str().unwrap().contains("+CHANGE_A"));
        c.apply(&w, &id, preview["approvalId"].as_str().unwrap())
            .unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), working);
        let staged = text(&project, &["show", ":main.txt"]).unwrap();
        assert!(staged.contains("USER_STAGED\nCHANGE_A\n"));
        assert!(staged.ends_with("eight\n"));
        let stale = c.prepare(&w, p.clone()).unwrap();
        fs::write(&file, working.replace("CHANGE_B", "USER_LATER")).unwrap();
        assert_eq!(
            c.apply(&w, &id, stale["approvalId"].as_str().unwrap())
                .unwrap_err()
                .code,
            "git-conflict"
        );
        assert_eq!(text(&project, &["show", ":main.txt"]).unwrap(), staged);
        let cancelled = c.prepare(&w, p.clone()).unwrap();
        c.cancel(&id, cancelled["approvalId"].as_str().unwrap())
            .unwrap();
        assert!(c
            .apply(&w, &id, cancelled["approvalId"].as_str().unwrap())
            .is_err());
        p.path = Some("../outside.txt".into());
        assert!(c.prepare(&w, p.clone()).is_err());
        p.path = Some("main.txt".into());
        p.hunk = Some(999);
        assert!(c.prepare(&w, p).is_err());
        let base=Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../../resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/phase-3");
        fs::create_dir_all(&base).unwrap();
        fs::write(base.join(if cfg!(debug_assertions){"ACTUAL-HUNK-DEV.json"}else{"ACTUAL-HUNK-PROD.json"}),serde_json::to_vec_pretty(&json!({"result":"PASS","actualGit":true,"actualNativeHost":true,"checks":["approval before index mutation","one selected hunk only","existing staged change preserved","unselected working change preserved","source unchanged","stale approval blocked","cancel blocked","project escape blocked","invalid hunk blocked"]})).unwrap()).unwrap();
    }
}
