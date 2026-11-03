//! Broker metadata never becomes an untrusted process environment variable.
use crate::model::{Request, Result};
use serde::{Deserialize, Serialize};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct GraphContext {
    execution_id: String,
    activation_id: String,
    node_id: String,
    attempt: u32,
    revision: u64,
    snapshot_id: String,
    source_checksum: String,
}
pub(super) fn parse(request: &Request) -> Result<Option<GraphContext>> {
    let Some(text) = request.env.get("TASTEDEV_GRAPH_CONTEXT") else {
        if request.build_artifact_transfer.is_some() {
            return Err("Isolated artifact graph identity required".into());
        }
        return Ok(None);
    };
    if text.len() > 4096 {
        return Err("Isolated graph identity limit".into());
    }
    let context: GraphContext =
        serde_json::from_str(text).map_err(|_| "Invalid isolated graph identity")?;
    if [
        &context.execution_id,
        &context.activation_id,
        &context.node_id,
        &context.snapshot_id,
    ]
    .iter()
    .any(|value| {
        value.is_empty()
            || value.len() > 120
            || !value
                .bytes()
                .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    }) || context.attempt == 0
        || context.revision == 0
        || context.source_checksum.len() != 64
        || !context
            .source_checksum
            .bytes()
            .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
    {
        return Err("Invalid isolated graph identity".into());
    }
    Ok(Some(context))
}
pub(super) fn verify(
    request: &Request,
    snapshot: &crate::snapshot::Snapshot,
) -> Result<Option<GraphContext>> {
    let context = parse(request)?;
    if snapshot.project_id != request.project_id
        || context.as_ref().is_some_and(|value| {
            value.snapshot_id != snapshot.snapshot_id || value.source_checksum != snapshot.checksum
        })
    {
        return Err("Isolated graph Source identity mismatch".into());
    }
    Ok(context)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn graph_metadata_requires_matching_snapshot_and_project() {
        let snapshot = crate::snapshot::Snapshot {
            schema_version: None,
            provider: "snapshot".into(),
            snapshot_id: uuid::Uuid::new_v4().to_string(),
            project_id: uuid::Uuid::new_v4().to_string(),
            proposal_id: uuid::Uuid::new_v4().to_string(),
            attempt: 1,
            base_revision: "base".into(),
            changed_files: Vec::new(),
            files: Vec::new(),
            checksum: "a".repeat(64),
            transfer: None,
        };
        let mut request = crate::tests::request();
        request.project_id = snapshot.project_id.clone();
        let mut context = serde_json::json!({"executionId":"execution","activationId":"activation","nodeId":"node","attempt":1,"revision":1,"snapshotId":snapshot.snapshot_id,"sourceChecksum":snapshot.checksum});
        request
            .env
            .insert("TASTEDEV_GRAPH_CONTEXT".into(), context.to_string());
        assert!(verify(&request, &snapshot).is_ok());
        context["snapshotId"] = serde_json::json!("another-snapshot");
        request
            .env
            .insert("TASTEDEV_GRAPH_CONTEXT".into(), context.to_string());
        assert!(verify(&request, &snapshot).is_err());
        request.project_id = "another-project".into();
        assert!(verify(&request, &snapshot).is_err());
    }
}
