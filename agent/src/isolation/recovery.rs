//! Persist cleanup observations separately from immutable task results/ACKs.
use crate::model::{no_links, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{Read, Write},
    path::Path,
};

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ClaimPhase {
    Interrupted,
    PendingResult,
    Acknowledged,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Observation {
    observed_at: String,
    event: Value,
}

/// Always inspect isolation ownership, even when task delivery already finished.
/// Cleanup outcome is operational state, not a rewrite of the test's result.
pub fn recover_recorded(root: &Path, agent: &str, claim: &Value, phase: ClaimPhase) -> Result<()> {
    if claim["executionIsolation"].as_bool() != Some(true) {
        return Ok(());
    }
    let outcome = recover(root, agent, claim);
    let identity = |key: &str| {
        claim[key].as_str().filter(|v| {
            v.len() <= 120
                && v.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
        })
    };
    let event = json!({"version":1,"agentId":agent,"projectId":identity("projectId"),"runId":identity("runId"),
        "jobId":identity("jobId"),"runStepId":identity("runStepId"),"phase":phase,
        "outcome":match &outcome { Ok(true) => "recovered", Ok(false) => "already-closed", Err(_) => "blocked" },
        "error":outcome.as_ref().err()});
    record(root, claim, event)?;
    outcome.map(|_| ())
}
fn recover(root: &Path, agent: &str, claim: &Value) -> Result<bool> {
    #[cfg(windows)]
    {
        super::journal::Journal::recover_claim(agent, claim, root)
    }
    #[cfg(not(windows))]
    {
        let _ = (root, agent, claim);
        Err("Recorded isolation cleanup requires its qualified OS broker".into())
    }
}
fn record(root: &Path, claim: &Value, event: Value) -> Result<()> {
    let execution = claim["runStepId"]
        .as_str()
        .or_else(|| claim["runId"].as_str())
        .ok_or("Isolation recovery execution missing")?;
    uuid::Uuid::parse_str(execution).map_err(|_| "Invalid isolation recovery execution")?;
    let encoded = serde_json::to_vec(&event).map_err(|_| "Isolation recovery encoding failed")?;
    if encoded.len() > 8192 {
        return Err("Isolation recovery observation limit".into());
    }
    let checksum = format!("{:x}", Sha256::digest(&encoded));
    let claims = root.join("claims");
    no_links(&claims)?;
    fs::create_dir_all(&claims).map_err(|_| "Isolation recovery observations unavailable")?;
    let target = claims.join(format!("{execution}.isolation-recovery-{checksum}.json"));
    no_links(&target)?;
    let verify = || -> Result<()> {
        let mut bytes = Vec::new();
        fs::File::open(&target)
            .map_err(|_| "Isolation recovery observation unavailable")?
            .take(16385)
            .read_to_end(&mut bytes)
            .map_err(|_| "Isolation recovery observation read failed")?;
        if bytes.len() > 16384 {
            return Err("Isolation recovery observation limit".into());
        }
        let saved: Observation =
            serde_json::from_slice(&bytes).map_err(|_| "Isolation recovery observation invalid")?;
        if saved.event != event || chrono::DateTime::parse_from_rfc3339(&saved.observed_at).is_err()
        {
            return Err("Isolation recovery observation conflict".into());
        }
        Ok(())
    };
    if target.exists() {
        return verify();
    }
    let bytes = serde_json::to_vec(&Observation {
        observed_at: chrono::Utc::now().to_rfc3339(),
        event: event.clone(),
    })
    .map_err(|_| "Isolation recovery encoding failed")?;
    let staging = claims.join(format!(
        "isolation-recovery-{}.pending",
        uuid::Uuid::new_v4()
    ));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&staging)
        .map_err(|_| "Isolation recovery staging failed")?;
    let publish: Result<()> = (|| {
        file.write_all(&bytes)
            .and_then(|_| file.sync_all())
            .map_err(|_| "Isolation recovery sync failed")?;
        no_links(&target)?;
        if fs::hard_link(&staging, &target).is_err() {
            verify()?;
        }
        Ok(())
    })();
    drop(file);
    let cleanup =
        fs::remove_file(&staging).map_err(|_| "Isolation recovery staging cleanup failed");
    publish?;
    cleanup?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn immutable_observations_deduplicate_and_preserve_conflicts_and_results() {
        let root = tempfile::tempdir().unwrap();
        let execution = uuid::Uuid::new_v4().to_string();
        let claim = json!({"runId":execution});
        let event =
            json!({"outcome":"blocked","error":"controlled failure","phase":"pending-result"});
        record(root.path(), &claim, event.clone()).unwrap();
        let claims = root.path().join("claims");
        let path = fs::read_dir(&claims)
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        let original = fs::read(&path).unwrap();
        record(root.path(), &claim, event.clone()).unwrap();
        assert_eq!(fs::read(&path).unwrap(), original);
        assert_eq!(fs::read_dir(&claims).unwrap().count(), 1);
        let result = claims.join(format!("{execution}.pending"));
        fs::write(&result, b"original task result").unwrap();
        fs::write(&path, b"corrupted observation").unwrap();
        assert!(record(root.path(), &claim, event).is_err());
        assert_eq!(fs::read(path).unwrap(), b"corrupted observation");
        assert_eq!(fs::read(result).unwrap(), b"original task result");
    }
    #[test]
    fn legacy_claims_are_unchanged_and_blocked_cleanup_has_separate_evidence() {
        let root = tempfile::tempdir().unwrap();
        assert!(
            recover_recorded(root.path(), "agent", &json!({}), ClaimPhase::Acknowledged).is_ok()
        );
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
        assert!(recover_recorded(
            root.path(),
            "agent",
            &json!({"executionIsolation":true}),
            ClaimPhase::Interrupted
        )
        .is_err());
        assert_eq!(fs::read_dir(root.path()).unwrap().count(), 0);
        let claim = json!({"executionIsolation":true,"runId":uuid::Uuid::new_v4().to_string(),
            "jobId":uuid::Uuid::new_v4().to_string(),"projectId":"controlled"});
        assert!(recover_recorded(root.path(), "agent", &claim, ClaimPhase::PendingResult).is_err());
        let path = fs::read_dir(root.path().join("claims"))
            .unwrap()
            .next()
            .unwrap()
            .unwrap()
            .path();
        let saved: Value = serde_json::from_slice(&fs::read(path).unwrap()).unwrap();
        assert_eq!(saved["event"]["outcome"], "blocked");
        assert_eq!(saved["event"]["phase"], "pending-result");
        let mut malformed = claim;
        malformed["projectId"] = json!({"dummyCredential":"DUMMY_AUDIT_EXCLUDED_VALUE"});
        assert!(
            recover_recorded(root.path(), "agent", &malformed, ClaimPhase::PendingResult).is_err()
        );
        for entry in fs::read_dir(root.path().join("claims")).unwrap() {
            let bytes = fs::read(entry.unwrap().path()).unwrap();
            assert!(!String::from_utf8_lossy(&bytes).contains("DUMMY_AUDIT_EXCLUDED_VALUE"));
        }
    }
}
