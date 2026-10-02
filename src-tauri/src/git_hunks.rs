use crate::{
    filesystem::{error, resolve, Result},
    git,
};
use serde_json::{json, Value};
use std::path::Path;

// Only Git-generated patches for one existing regular tracked file are accepted.
// The client selects a hunk number; it never supplies patch text or arbitrary args.
pub(crate) fn hunks(root: &Path, path: &str) -> Result<Vec<Value>> {
    let file = resolve(root, path, false)?;
    if !file.is_file() || std::fs::metadata(file)?.len() > 2 * 1024 * 1024 {
        return Err(error("git-hunk"));
    }
    let entries = git::run(root, &["ls-files", "--stage", "-z", "--", path], None)?;
    let records = entries
        .split(|b| *b == 0)
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>();
    if records.len() != 1 {
        return Err(error("git-hunk"));
    }
    let row = std::str::from_utf8(records[0]).map_err(|_| error("git-hunk"))?;
    let (meta, name) = row.split_once('\t').ok_or_else(|| error("git-hunk"))?;
    let fields = meta.split_whitespace().collect::<Vec<_>>();
    if name != path
        || fields.len() != 3
        || fields[2] != "0"
        || !matches!(fields[0], "100644" | "100755")
    {
        return Err(error("git-hunk"));
    }
    let bytes = git::run(
        root,
        &[
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-renames",
            "--unified=0",
            "--",
            path,
        ],
        None,
    )?;
    if bytes.len() > 2 * 1024 * 1024 || bytes.contains(&0) {
        return Err(error("large"));
    }
    let text = String::from_utf8(bytes).map_err(|_| error("binary"))?;
    if text.lines().any(|s| {
        s.starts_with("old mode ")
            || s.starts_with("new mode ")
            || s.starts_with("new file mode ")
            || s.starts_with("deleted file mode ")
    }) {
        return Err(error("git-hunk"));
    }
    let first = text
        .find("\n@@ ")
        .map(|n| n + 1)
        .ok_or_else(|| error("git-hunk"))?;
    let header = &text[..first];
    let chunks =
        text[first..]
            .split_inclusive('\n')
            .fold(Vec::<String>::new(), |mut chunks, line| {
                if line.starts_with("@@ ") {
                    chunks.push(String::new());
                }
                if let Some(chunk) = chunks.last_mut() {
                    chunk.push_str(line);
                }
                chunks
            });
    if chunks.len() > 256 {
        return Err(error("git-limit"));
    }
    Ok(chunks.iter().enumerate().map(|(id, chunk)| json!({"id":id,"path":path,"header":chunk.lines().next(),"patch":format!("{header}{chunk}")})).collect())
}
pub(crate) fn patch(root: &Path, path: &str, index: usize) -> Result<Vec<u8>> {
    hunks(root, path)?
        .get(index)
        .and_then(|h| h["patch"].as_str())
        .map(|s| s.as_bytes().to_vec())
        .ok_or_else(|| error("git-hunk"))
}
pub(crate) fn stage(root: &Path, path: &str, index: usize) -> Result<()> {
    let patch = patch(root, path, index)?;
    git::run_input(
        root,
        &[
            "apply",
            "--cached",
            "--check",
            "--unidiff-zero",
            "--whitespace=nowarn",
            "-",
        ],
        patch.clone(),
    )?;
    git::run_input(
        root,
        &[
            "apply",
            "--cached",
            "--unidiff-zero",
            "--whitespace=nowarn",
            "-",
        ],
        patch,
    )?;
    Ok(())
}
