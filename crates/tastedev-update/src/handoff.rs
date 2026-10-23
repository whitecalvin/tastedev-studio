//! Cooperative update consent. A helper never kills a process or closes an
//! unacknowledged window. Old instances without this protocol remain blockers.
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub(crate) struct Request {
    pub token: String,
    pub path: PathBuf,
    pub version: crate::Version,
    pub commit: bool,
    pub start: String,
}

impl Request {
    pub fn answer(&self, accept: bool) -> std::io::Result<()> {
        let suffix = if accept {
            format!(".{}.ack", std::process::id())
        } else {
            ".cancel".into()
        };
        let path = PathBuf::from(format!("{}{suffix}", self.path.display()));
        std::fs::write(path, format!("{}:{}", self.token, self.start))
    }

    pub fn release(&self) -> crate::Release {
        crate::Release {
            version: self.version,
            tag: String::new(),
            page: String::new(),
            notes: String::new(),
            published: String::new(),
            assets: Vec::new(),
        }
    }
}

pub(crate) fn read(work: &Path, exe: &Path) -> Option<Request> {
    let lease = std::fs::OpenOptions::new()
        .read(true)
        .write(true)
        .open(work.join(".update-install.lock"))
        .ok()?;
    if lease.try_lock().is_ok() {
        return None; // No live installer owns this request.
    }
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    std::fs::read_dir(work).ok()?.flatten().find_map(|entry| {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.starts_with("progress-") || !name.ends_with(".close-request.json") {
            return None;
        }
        let bytes = std::fs::read(entry.path()).ok()?;
        if bytes.len() > 64 * 1024 {
            return None;
        }
        let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
        let expires = value["expires"].as_u64()?;
        if expires < now || expires > now + 610 {
            return None;
        }
        let requested_exe = value["exe"].as_str()?;
        if !requested_exe.eq_ignore_ascii_case(&exe.to_string_lossy()) {
            return None;
        }
        let token = value["token"].as_str()?;
        if token.len() != 32 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
            return None;
        }
        let pid = std::process::id().to_string();
        let start = value["targets"][&pid].as_str()?.to_owned();
        Some(Request {
            token: token.into(),
            path: entry.path(),
            version: crate::Version::parse(value["version"].as_str()?)?,
            commit: value["commit"].as_bool()?,
            start,
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stale_or_other_install_requests_never_authorize_exit() {
        let temp = crate::testing::Temp::new("close-consent");
        let lock = std::fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(temp.0.join(".update-install.lock"))
            .unwrap();
        lock.try_lock().unwrap();
        let exe = Path::new("C:/Apps/tastessh.exe");
        let path = temp.0.join("progress-1.2.3.json.close-request.json");
        let pid = std::process::id().to_string();
        let expires = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + 60;
        let mut value = serde_json::json!({"token":"0123456789abcdef0123456789abcdef", "version":"1.2.3", "exe":exe, "expires":expires,"commit":false,"targets":{}});
        value["targets"][&pid] = "start-ticks".into();
        std::fs::write(&path, value.to_string()).unwrap();
        let request = read(&temp.0, exe).unwrap();
        assert!(!request.commit);
        request.answer(true).unwrap();
        assert_eq!(
            std::fs::read_to_string(format!("{}.{}.ack", path.display(), pid)).unwrap(),
            "0123456789abcdef0123456789abcdef:start-ticks"
        );
        assert!(read(&temp.0, Path::new("C:/Other/tastessh.exe")).is_none());
        value["expires"] = 0.into();
        std::fs::write(&path, value.to_string()).unwrap();
        assert!(read(&temp.0, exe).is_none());
        value["expires"] = expires.into();
        std::fs::write(&path, value.to_string()).unwrap();
        drop(lock);
        assert!(read(&temp.0, exe).is_none());
    }
}
