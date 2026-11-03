//! Operator-selected version commands, executed only in a qualified private
//! profile. Declarations never count as observations, and Source supplies no args.
use crate::model::Result;
use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct RuntimeSpec {
    pub name: String,
    pub version: String,
    pub probe_args: Vec<String>,
    pub timeout_ms: u32,
}
impl RuntimeSpec {
    pub fn validate(&self) -> Result<()> {
        if self.name.is_empty()
            || self.name.len() > 32
            || !self
                .name
                .bytes()
                .all(|v| v.is_ascii_lowercase() || v.is_ascii_digit() || v == b'-')
            || numeric(&self.version).is_none()
            || self.probe_args.is_empty()
            || self.probe_args.len() > 8
            || self
                .probe_args
                .iter()
                .any(|v| v.len() > 256 || v.contains('\0'))
            || !(100..=10000).contains(&self.timeout_ms)
        {
            return Err("Invalid registered runtime probe policy".into());
        }
        Ok(())
    }
    pub fn observed(&self, text: &str) -> Result<String> {
        self.validate()?;
        if text.len() > 16384 {
            return Err("Runtime probe output limit".into());
        }
        let mut found = None;
        for word in text.split_whitespace() {
            let token =
                word.trim_matches(|c: char| matches!(c, '"' | '\'' | '(' | ')' | ',' | ';'));
            let token = token.strip_prefix('v').unwrap_or(token);
            let parts = token.split('.').collect::<Vec<_>>();
            if parts.len() < 3 {
                continue;
            }
            let value = parts[..3].join(".");
            if numeric(&value).is_none() {
                continue;
            }
            // Godot appends .stable.official.<hash>; numeric fourth components
            // are ambiguous versions, not a numeric-triplet observation.
            if parts
                .get(3)
                .is_some_and(|part| part.bytes().all(|b| b.is_ascii_digit()))
            {
                return Err("Ambiguous runtime version output".into());
            }
            if found.as_ref().is_some_and(|old| old != &value) {
                return Err("Ambiguous runtime version output".into());
            }
            found = Some(value);
        }
        match found {
            Some(value) if value == self.version => Ok(value),
            _ => Err("Registered runtime version mismatch or missing observation".into()),
        }
    }
}
fn numeric(value: &str) -> Option<[u32; 3]> {
    let parts = value.split('.').collect::<Vec<_>>();
    if parts.len() != 3 {
        return None;
    }
    let mut result = [0; 3];
    for (index, part) in parts.iter().enumerate() {
        if part.is_empty()
            || !part.bytes().all(|b| b.is_ascii_digit())
            || (part.len() > 1 && part.starts_with('0'))
        {
            return None;
        }
        result[index] = part.parse().ok()?;
    }
    Some(result)
}
#[cfg(windows)]
pub(super) fn probe(
    catalog: &super::catalog::Catalog,
    profile: &super::windows::Profile,
    cancel: &std::sync::atomic::AtomicBool,
) -> Result<BTreeMap<String, String>> {
    use super::windows::{LeafCommand, LeafExit};
    use std::{
        sync::atomic::Ordering,
        time::{Duration, Instant},
    };
    let deadline = Instant::now() + Duration::from_secs(30);
    let mut facts = BTreeMap::new();
    for program in catalog.programs() {
        let Some(spec) = program.runtime() else {
            continue;
        };
        if cancel.load(Ordering::SeqCst) {
            return Err("Runtime qualification cancelled".into());
        }
        let remaining = deadline
            .saturating_duration_since(Instant::now())
            .as_millis();
        if remaining == 0 {
            return Err("Runtime qualification budget exhausted".into());
        }
        let image = profile.prepare_program_controlled(program, cancel, deadline)?;
        let directory = profile.root.join(format!("version-probe-{}", program.id()));
        std::fs::create_dir(&directory).map_err(|_| "New private version probe cwd required")?;
        profile.permit(&directory, true)?;
        let mut text = String::new();
        let mut overflow = false;
        let mut receive = |_stream: &str, chunk: &str| {
            if text.len() + chunk.len() > 16384 {
                overflow = true;
                return false;
            }
            text.push_str(chunk);
            true
        };
        let mut observer = super::OutputObserver {
            secrets: vec![],
            receive: &mut receive,
            dropped_chunks: 0,
            dropped_bytes: 0,
            artifact_installation: None,
        };
        let exit = profile.execute_observed(
            LeafCommand {
                max_processes: 1,
                program: &image.path,
                args: &spec.probe_args,
                cwd: &directory,
                environment: &BTreeMap::new(),
                timeout_ms: spec.timeout_ms.min(
                    deadline
                        .saturating_duration_since(Instant::now())
                        .as_millis()
                        .min(u32::MAX as u128) as u32,
                ),
                cancel: Some(cancel),
            },
            &mut observer,
        )?;
        let loss = observer.dropped_chunks != 0 || observer.dropped_bytes != 0;
        if exit != LeafExit::Completed(0) || loss || overflow {
            return Err("Private runtime version probe did not complete".into());
        }
        facts.insert(program.id().into(), spec.observed(&text)?);
    }
    Ok(facts)
}
/// Facts are keyed by executable ID, so another program with the same logical
/// runtime name cannot qualify the selected executable's requirements.
pub(super) fn select(
    requirements: Option<&BTreeMap<String, String>>,
    candidates: impl Iterator<Item = (String, String)>,
) -> Result<BTreeMap<String, String>> {
    let mut result = BTreeMap::new();
    if let Some(requirements) = requirements {
        let candidates = candidates.collect::<Vec<_>>();
        for (name, minimum) in requirements {
            let minimum = minimum
                .strip_prefix(">=")
                .and_then(crate::model::version)
                .ok_or("Invalid isolated runtime version requirement")?;
            let actual = candidates
                .iter()
                .filter(|(key, value)| key == name && numeric(value).is_some_and(|v| v >= minimum))
                .map(|(_, value)| value)
                .max_by_key(|value| numeric(value))
                .ok_or("Required registered runtime version unavailable")?;
            result.insert(name.clone(), actual.clone());
        }
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn spec(version: &str) -> RuntimeSpec {
        RuntimeSpec {
            name: "engine".into(),
            version: version.into(),
            probe_args: vec!["--version".into()],
            timeout_ms: 2000,
        }
    }
    #[test]
    fn actual_text_must_match_one_unambiguous_pinned_triplet() {
        assert_eq!(spec("24.22.1").observed("v24.22.1\n").unwrap(), "24.22.1");
        assert_eq!(
            spec("4.7.2")
                .observed("4.7.2.stable.official.hash\n")
                .unwrap(),
            "4.7.2"
        );
        for value in [
            "",
            "success",
            "v24.22.2",
            "24.22.1 24.22.2",
            "24.22.1.2",
            "024.22.1",
        ] {
            assert!(spec("24.22.1").observed(value).is_err());
        }
        assert!(spec("24.22.1").observed(&"x".repeat(16385)).is_err());
    }
    #[test]
    fn probe_policy_is_bounded_and_never_supplied_by_source() {
        for value in ["4.7", "4.7.2.1", "4.07.2", "4.7.2-stable"] {
            assert!(spec(value).validate().is_err());
        }
        let mut value = spec("4.7.2");
        value.probe_args.push("bad\0arg".into());
        assert!(value.validate().is_err());
        value = spec("4.7.2");
        value.timeout_ms = 10001;
        assert!(value.validate().is_err());
    }
    #[test]
    fn only_actual_selected_program_facts_satisfy_requirements() {
        let required = BTreeMap::from([("godot".into(), ">=4.7.1".into())]);
        assert!(select(Some(&required), std::iter::empty()).is_err());
        assert!(select(
            Some(&required),
            [("node".into(), "24.22.1".into())].into_iter()
        )
        .is_err());
        assert!(select(
            Some(&required),
            [("godot".into(), "4.7.0".into())].into_iter()
        )
        .is_err());
        assert_eq!(
            select(
                Some(&required),
                [("godot".into(), "4.7.2".into())].into_iter()
            )
            .unwrap()["godot"],
            "4.7.2"
        );
    }
}
