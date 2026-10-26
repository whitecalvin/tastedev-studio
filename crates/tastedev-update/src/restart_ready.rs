//! One-shot response from the new app's UI loop, not a timer-based guess.
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) const TOKEN_ENV: &str = "TASTEDEV_UPDATE_RESTART_TOKEN";

pub(crate) fn publish(work: &Path, exe: &Path, version: &str) -> bool {
    let Ok(token) = std::env::var(TOKEN_ENV) else {
        return true;
    };
    publish_token(work, exe, version, &token).unwrap_or(false)
}

fn publish_token(work: &Path, exe: &Path, version: &str, token: &str) -> Option<bool> {
    if token.len() != 32 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Some(true); // An environment value must never supply a path.
    }
    let request = work.join(format!("progress-restart-{token}.request.json"));
    if std::fs::symlink_metadata(&request)
        .ok()?
        .file_type()
        .is_symlink()
    {
        return None;
    }
    let bytes = std::fs::read(&request).ok()?;
    if bytes.len() > 8192 {
        return None;
    }
    let value: serde_json::Value = serde_json::from_slice(&bytes).ok()?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).ok()?.as_secs();
    let expires = value["expires"].as_u64()?;
    if value["token"].as_str()? != token
        || !value["exe"]
            .as_str()?
            .eq_ignore_ascii_case(&exe.to_string_lossy())
        || expires < now
        || expires > now + 120
        || value["version"]
            .as_str()
            .is_none_or(|v| !v.is_empty() && v != version)
    {
        return None;
    }
    let reply = work.join(format!(
        "progress-restart-{token}.{}.ready.json",
        std::process::id()
    ));
    if std::fs::symlink_metadata(&reply).is_ok_and(|m| m.file_type().is_symlink()) {
        return None;
    }
    let body = serde_json::json!({
        "token": token, "pid": std::process::id(),
        "exe": exe.to_string_lossy(), "version": version,
    });
    // The helper retries incomplete JSON; it never treats file existence as readiness.
    std::fs::write(reply, serde_json::to_vec(&body).ok()?).ok()?;
    Some(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ready_reply_is_bound_to_nonce_path_version_and_expiry() {
        let dir = crate::testing::Temp::new("restart-ready");
        let token = "0123456789abcdef0123456789abcdef";
        let exe = Path::new("C:/Apps/TASTESSH/tastessh.exe");
        let request = dir.0.join(format!("progress-restart-{token}.request.json"));
        let expires = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            + 60;
        let valid =
            serde_json::json!({"token":token,"exe":exe,"version":"1.2.3","expires":expires});
        assert!(publish_token(&dir.0, exe, "1.2.3", token).is_none());
        for (key, bad) in [
            ("token", serde_json::json!("old")),
            ("exe", serde_json::json!("C:/Other/tastessh.exe")),
            ("version", serde_json::json!("1.2.2")),
            ("expires", serde_json::json!(0)),
            ("expires", serde_json::json!(expires + 600)),
        ] {
            let mut value = valid.clone();
            value[key] = bad;
            std::fs::write(&request, value.to_string()).unwrap();
            assert!(publish_token(&dir.0, exe, "1.2.3", token).is_none());
        }
        std::fs::write(&request, valid.to_string()).unwrap();
        assert_eq!(publish_token(&dir.0, exe, "1.2.3", token), Some(true));
        let reply: serde_json::Value = serde_json::from_slice(
            &std::fs::read(dir.0.join(format!(
                "progress-restart-{token}.{}.ready.json",
                std::process::id()
            )))
            .unwrap(),
        )
        .unwrap();
        assert_eq!(reply["pid"], std::process::id());
        assert_eq!(reply["token"], token);
        assert_eq!(reply["version"], "1.2.3");
        crate::clean_work_dir(&dir.0);
        assert!(request.exists());
        assert!(
            dir.0
                .join(format!(
                    "progress-restart-{token}.{}.ready.json",
                    std::process::id()
                ))
                .exists()
        );
        assert_eq!(publish_token(&dir.0, exe, "1.2.3", "../escape"), Some(true));
    }
}
