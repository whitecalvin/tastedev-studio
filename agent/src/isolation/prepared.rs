//! Trusted broker preparation. This does not qualify or advertise the backend.
use super::{
    catalog::Catalog,
    journal::{Binding, Journal},
    mirror::Mirror,
    windows::{LeafCommand, LeafExit, LockedProgram, Profile},
};
use crate::model::{Request, Result};
use std::{
    collections::BTreeMap,
    path::{Component, Path, PathBuf},
    sync::atomic::{AtomicBool, Ordering},
    time::{Duration, Instant},
};

struct Invocation {
    args: Vec<String>,
    environment: BTreeMap<String, String>,
    timeout_ms: u32,
    deadline: Instant,
}
impl Invocation {
    fn from_request(request: &Request) -> Result<Self> {
        // Parse before excluding the one canonical broker-only key. All other
        // reserved/case-alias keys still fail the ordinary environment policy.
        super::context::parse(request)?;
        request
            .isolation
            .as_ref()
            .ok_or("Explicit isolation policy required")?
            .validate_approval(&request.requirements)?;
        if request.requirements.execution_isolation != Some(1) {
            return Err("Required execution isolation identity missing".into());
        }
        if request.args.len() > 100
            || request
                .args
                .iter()
                .any(|v| v.len() > 1024 || v.contains('\0'))
            || !(100..=3600000).contains(&request.timeout_ms)
            || request.env.len() > 32
            || request
                .env
                .iter()
                .filter(|(key, _)| key.as_str() != "TASTEDEV_GRAPH_CONTEXT")
                .any(|(key, value)| {
                    let upper = key.to_ascii_uppercase();
                    key.is_empty()
                        || key.len() > 64
                        || !key.bytes().all(|v| v.is_ascii_alphanumeric() || v == b'_')
                        || value.len() > 4096
                        || value.contains('\0')
                        || [
                            "SYSTEMROOT",
                            "WINDIR",
                            "PATH",
                            "LOCALAPPDATA",
                            "TEMP",
                            "TMP",
                            "HOME",
                            "USERPROFILE",
                            "APPDATA",
                        ]
                        .contains(&upper.as_str())
                        || [
                            "TOKEN",
                            "SECRET",
                            "PASSWORD",
                            "CREDENTIAL",
                            "AUTH",
                            "API_KEY",
                            "TASTEDEV",
                            "TASTESTUDIO",
                        ]
                        .iter()
                        .any(|v| upper.contains(v))
                })
        {
            return Err("Isolated invocation violates the runtime/environment policy".into());
        }
        Ok(Self {
            args: request.args.clone(),
            environment: request
                .env
                .iter()
                .filter(|(key, _)| key.as_str() != "TASTEDEV_GRAPH_CONTEXT")
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect(),
            timeout_ms: request.timeout_ms as u32,
            deadline: Instant::now() + Duration::from_millis(request.timeout_ms),
        })
    }
}

pub(super) struct Prepared {
    // Rust drops fields in declaration order. Release program/directory locks
    // before Profile's fallback cleanup, including early returns or unwinding.
    pub program: LockedProgram,
    pub mirror: Mirror,
    pub cwd: PathBuf,
    invocation: Invocation,
    binding: Binding,
    graph: Option<super::context::GraphContext>,
    profile: Profile,
    journal: Journal,
}

impl Prepared {
    #[cfg(test)]
    pub fn create(request: &Request, root: &Path, catalog: &Path) -> Result<Self> {
        let catalog = Catalog::load(catalog, root)?;
        Self::using_catalog(request, root, &catalog)
    }
    #[cfg(test)]
    pub fn using_catalog(request: &Request, root: &Path, catalog: &Catalog) -> Result<Self> {
        Self::using_catalog_controlled(request, root, catalog, &AtomicBool::new(false))
    }
    pub fn using_catalog_controlled(
        request: &Request,
        root: &Path,
        catalog: &Catalog,
        cancel: &AtomicBool,
    ) -> Result<Self> {
        let mut invocation = Invocation::from_request(request)?;
        let relative = source_cwd(&request.cwd)?;
        let snapshot = crate::snapshot::sealed::load(request, root)?;
        let graph = super::context::verify(request, &snapshot)?;
        let approved = catalog.resolve(&request.executable)?;
        invocation.args = approved.isolated_arguments(&invocation.args)?;
        let process_limit = request
            .isolation
            .as_ref()
            .ok_or("Isolation policy required")?
            .process_limit();
        approved.validate_process_limit(process_limit)?;
        let run = crate::pipeline::cwd(root, &request.run_id, ".")?;
        let binding = Binding {
            snapshot_id: snapshot.snapshot_id.clone(),
            source_checksum: snapshot.checksum.clone(),
            program_id: approved.id().into(),
            program_checksum: approved.checksum().into(),
            bundle_checksum: approved.bundle_checksum(),
            process_limit: (process_limit > 1).then_some(process_limit),
        };
        let reservation = Journal::reserve(request, root, binding.clone())?;
        let profile = reservation.create_profile()?;
        let journal = reservation.claim(&profile)?;
        let mirror = profile.prepare_source(&run.join("source"), &snapshot.files)?;
        let cwd = mirror.root.join(relative);
        crate::model::no_links(&cwd)?;
        if !cwd.is_dir() {
            return Err("Isolated working directory unavailable".into());
        }
        let program = profile.prepare_program_controlled(approved, cancel, invocation.deadline)?;
        mirror.verify_original()?;
        mirror.verify_staged()?;
        Ok(Self {
            profile,
            mirror,
            cwd,
            program,
            journal,
            invocation,
            binding,
            graph,
        })
    }
    pub fn stage_outputs(
        &self,
        request: &Request,
        root: &Path,
        cancel: &AtomicBool,
        deadline: Instant,
    ) -> Result<Vec<crate::build_artifact::CapturedOutput>> {
        let Some(transfer) = &request.build_artifact_transfer else {
            return Ok(Vec::new());
        };
        let declared = output_paths(&self.mirror.root, &self.cwd, &transfer.outputs)?;
        let mut captured = self.mirror.collect_outputs(&declared)?;
        for (item, output) in captured.iter_mut().zip(&transfer.outputs) {
            item.path = output.path.clone();
        }
        super::outputs::persist(
            request,
            root,
            &self.binding,
            self.graph.as_ref(),
            &captured,
            cancel,
            deadline,
        )?;
        Ok(captured)
    }
    pub fn install_inputs(
        &self,
        request: &Request,
        cancel: &std::sync::Arc<AtomicBool>,
        deadline: Instant,
    ) -> Result<()> {
        let Some(transfer) = &request.build_artifact_transfer else {
            return Ok(());
        };
        for input in &transfer.inputs {
            scoped_artifact_path(&self.mirror.root, &self.cwd, &input.path)?;
        }
        crate::build_artifact::download_into(
            request,
            &self.cwd,
            &self.profile.root,
            cancel,
            deadline,
        )?;
        for input in &transfer.inputs {
            let file = self.cwd.join(&input.path);
            self.profile.permit(&file, false)?;
            let mut parent = file.parent();
            while let Some(directory) = parent {
                self.profile.permit(directory, false)?;
                if directory == self.mirror.root {
                    break;
                }
                parent = directory.parent();
            }
        }
        crate::build_artifact::verify_inputs_at(request, &self.cwd, cancel, deadline)
    }

    pub fn execute(
        &self,
        request: &Request,
        cancel: &AtomicBool,
        observer: &mut super::OutputObserver<'_>,
    ) -> Result<LeafExit> {
        if cancel.load(Ordering::SeqCst) {
            return Ok(LeafExit::Cancelled);
        }
        self.mirror.verify_original()?;
        self.mirror.verify_staged()?;
        crate::build_artifact::verify_inputs_at(
            request,
            &self.cwd,
            cancel,
            self.invocation.deadline,
        )?;
        let remaining = self
            .invocation
            .deadline
            .saturating_duration_since(Instant::now())
            .as_millis();
        if remaining == 0 {
            return Ok(LeafExit::TimedOut);
        }
        let result = self.profile.execute_observed(
            LeafCommand {
                max_processes: request
                    .isolation
                    .as_ref()
                    .ok_or("Isolation policy required")?
                    .process_limit(),
                program: &self.program.path,
                args: &self.invocation.args,
                cwd: &self.cwd,
                environment: &self.invocation.environment,
                timeout_ms: (remaining as u32).min(self.invocation.timeout_ms),
                cancel: Some(cancel),
            },
            observer,
        );
        // Changes by the user are detected, never copied back or overwritten.
        self.mirror.verify_original()?;
        result
    }

    #[cfg(test)]
    pub fn identity(&self) -> &str {
        self.profile.identity()
    }

    pub fn close(self) -> Result<()> {
        let Self {
            profile,
            program,
            journal,
            ..
        } = self;
        // Release executable/parent locks before deleting the exact owned profile.
        drop(program);
        profile.close()?;
        journal.closed()
    }
}

fn output_paths(
    source: &Path,
    cwd: &Path,
    outputs: &[crate::build_artifact::Output],
) -> Result<Vec<String>> {
    outputs
        .iter()
        .map(|output| scoped_artifact_path(source, cwd, &output.path))
        .collect()
}
fn scoped_artifact_path(source: &Path, cwd: &Path, path: &str) -> Result<String> {
    let relative = cwd
        .strip_prefix(source)
        .map_err(|_| "Isolated output cwd escaped Source")?;
    let prefix = relative
        .components()
        .map(|part| {
            part.as_os_str()
                .to_str()
                .ok_or_else(|| "Invalid isolated output cwd".to_string())
        })
        .collect::<Result<Vec<_>>>()?
        .join("/");
    crate::build_artifact::safe_path(path)?;
    let path = if prefix.is_empty() {
        path.into()
    } else {
        format!("{prefix}/{path}")
    };
    crate::build_artifact::safe_path(&path)?;
    Ok(path)
}

fn source_cwd(value: &str) -> Result<PathBuf> {
    crate::model::relative(value)?;
    let path = Path::new(value);
    let mut parts = path.components();
    if !matches!(parts.next(), Some(Component::Normal(part)) if part == "source") {
        return Err("Isolated commands must use the sealed Source working directory".into());
    }
    Ok(parts.collect())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use sha2::{Digest, Sha256};
    use std::{
        fs,
        sync::{atomic::AtomicBool, Arc},
    };
    #[test]
    #[ignore = "Actual registered Node/Godot versions and saved Snapshot execution; administrator private-station context required"]
    fn actual_registered_versions_and_saved_source_commands() {
        let node = std::env::var_os("TASTESTUDIO_VERIFY_NODE")
            .map(PathBuf::from)
            .expect("Select pinned actual Node");
        let godot = std::env::var_os("TASTESTUDIO_VERIFY_GODOT")
            .map(PathBuf::from)
            .expect("Select pinned native Godot executable");
        assert!(node.is_absolute() && godot.is_absolute());
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        let fixture = tempfile::tempdir_in(base).unwrap();
        let root = fixture.path().join("workspace");
        fs::create_dir(&root).unwrap();
        let definitions = json!({"version":1,"backend":"windows-private-appcontainer-v1","programs":[
            {"id":"node","executable":node,"checksum":format!("{:x}",Sha256::digest(fs::read(&node).unwrap())),"runtime":{"name":"node","version":"24.22.1","probeArgs":["--version"],"timeoutMs":10000}},
            {"id":"godot","executable":godot,"checksum":format!("{:x}",Sha256::digest(fs::read(&godot).unwrap())),"runtime":{"name":"godot","version":"4.7.2","probeArgs":["--version"],"timeoutMs":10000}}
        ]});
        let catalog_path = fixture.path().join("operator.json");
        fs::write(&catalog_path, definitions.to_string()).unwrap();
        let catalog = Catalog::load(&catalog_path, &root).unwrap();
        let profile = Profile::create().unwrap();
        let location = profile.root.clone();
        let facts =
            super::super::versions::probe(&catalog, &profile, &AtomicBool::new(false)).unwrap();
        profile.close().unwrap();
        assert!(!location.exists());
        assert_eq!(facts["node"], "24.22.1");
        assert_eq!(facts["godot"], "4.7.2");
        eprintln!("ACTUAL_PRIVATE_VERSIONS={}", json!(facts));
        for (program,files,args) in [
            ("node",vec![("verify.cjs","require('node:fs').writeFileSync('result.txt',require('./helper.cjs'));console.log('ACTUAL_RUNTIME_OK');"),("helper.cjs","module.exports='isolated-source-result';")],vec!["verify.cjs"]),
            ("godot",vec![("project.godot","config_version=5\n[application]\nconfig/name=\"Disposable isolation verification\"\n"),("verify.gd","extends SceneTree\nfunc _initialize():\n\tvar file = FileAccess.open(\"res://result.txt\", FileAccess.WRITE)\n\tif file == null:\n\t\tquit(2)\n\t\treturn\n\tfile.store_string(\"isolated-source-result\")\n\tfile.close()\n\tprint(\"ACTUAL_RUNTIME_OK\")\n\tquit(0)\n")],vec!["--headless","--path",".","--script","verify.gd"]),
        ] {
            let mut files=files;files.sort_by_key(|(path,_)|*path);
            let snapshot=uuid::Uuid::new_v4().to_string();let project=uuid::Uuid::new_v4().to_string();let proposal=uuid::Uuid::new_v4().to_string();
            let changed=files.iter().map(|(path,_)|*path).collect::<Vec<_>>();
            let entries=files.iter().map(|(path,content)|json!({"path":path,"content":content,"checksum":format!("{:x}",Sha256::digest(content.as_bytes()))})).collect::<Vec<_>>();
            let mut manifest=vec![json!(snapshot),json!(project),json!(proposal),json!(1),json!("base"),json!(changed)];
            manifest.extend(entries.iter().map(|file|json!([file["path"],file["checksum"]])));
            let checksum=format!("{:x}",Sha256::digest(json!(manifest).to_string().as_bytes()));
            let mut request:Request=serde_json::from_value(json!({"protocolVersion":1,"type":"execute","agentId":"agent","jobId":uuid::Uuid::new_v4().to_string(),"runId":uuid::Uuid::new_v4().to_string(),"runStepId":uuid::Uuid::new_v4().to_string(),"stage":"source","projectId":project,"requirements":{"executionIsolation":1},"executable":"internal-source-snapshot","args":[],"cwd":".","env":{},"timeoutMs":30000,"source":{"provider":"snapshot","repository":format!("snapshot:{snapshot}"),"revision":"base","snapshot":{"provider":"snapshot","snapshotId":snapshot,"projectId":project,"proposalId":proposal,"attempt":1,"baseRevision":"base","changedFiles":changed,"checksum":checksum,"files":entries}}})).unwrap();
            crate::snapshot::prepare(&request,&root,Arc::new(AtomicBool::new(false))).unwrap();
            request.source=None;request.run_step_id=Some(uuid::Uuid::new_v4().to_string());request.stage=Some("test".into());request.executable=program.into();request.args=args.into_iter().map(str::to_string).collect();request.cwd="source".into();request.isolation=Some(serde_json::from_value(json!({"version":1,"filesystem":"workspace","network":"deny","childProcesses":"deny"})).unwrap());
            request.validate("agent").unwrap();
            let prepared=Prepared::using_catalog(&request,&root,&catalog).unwrap();let location=prepared.profile.root.clone();
            let mut output=String::new();let mut receive=|_:&str,text:&str|{output.push_str(text);true};
            let mut observer=super::super::OutputObserver{secrets:vec![],receive:&mut receive,dropped_chunks:0,dropped_bytes:0,artifact_installation:None};
            let outcome=prepared.execute(&request,&AtomicBool::new(false),&mut observer).unwrap();
            assert_eq!(observer.dropped_chunks,0);
            let diagnostic=json!({"program":program,"outcome":format!("{outcome:?}"),"output":output});
            eprintln!("ACTUAL_PRIVATE_COMMAND_DIAGNOSTIC={diagnostic}");
            assert_eq!(outcome,LeafExit::Completed(0),"Private command failed: {diagnostic}");
            assert!(output.contains("ACTUAL_RUNTIME_OK"));
            let captured=prepared.mirror.collect_outputs(&["result.txt".into()]).unwrap();assert_eq!(captured[0].bytes,b"isolated-source-result");
            let run=crate::pipeline::cwd(&root,&request.run_id,".").unwrap();assert!(!run.join("source/result.txt").exists());
            prepared.mirror.verify_original().unwrap();prepared.close().unwrap();assert!(!location.exists());
            eprintln!("ACTUAL_PRIVATE_SOURCE_COMMAND={}",json!({"program":program,"runId":request.run_id,"snapshotId":snapshot,"sourceUnchanged":true,"profileRemoved":true,"resultChecksum":captured[0].checksum}));
        }
    }

    fn isolated_request() -> Request {
        let mut request = crate::tests::request();
        request.requirements.execution_isolation = Some(1);
        request.isolation = Some(serde_json::from_value(json!({"version":1,"filesystem":"workspace","network":"deny","childProcesses":"deny"})).unwrap());
        request
    }
    #[test]
    fn invocation_freezes_arguments_environment_and_timeout() {
        let mut request = isolated_request();
        request.args = vec!["--headless".into()];
        request.env.insert("CI".into(), "true".into());
        let invocation = Invocation::from_request(&request).unwrap();
        request.args[0] = "--different".into();
        request.env.insert("CI".into(), "changed".into());
        request.timeout_ms = 100;
        assert_eq!(invocation.args, ["--headless"]);
        assert_eq!(invocation.environment["CI"], "true");
        assert_eq!(invocation.timeout_ms, 5000);
    }
    #[test]
    fn invocation_rejects_runtime_override_credentials_and_broker_metadata() {
        for key in [
            "Path",
            "USERPROFILE",
            "APPDATA",
            "ACCESS_TOKEN",
            "OPENAI_API_KEY",
            "password",
            "TASTEDEV_GRAPH_CONTEXT",
        ] {
            let mut request = isolated_request();
            request.env.insert(key.into(), "dummy".into());
            assert!(Invocation::from_request(&request).is_err(), "{key}");
        }
        let mut request = isolated_request();
        request.timeout_ms = u64::MAX;
        assert!(Invocation::from_request(&request).is_err());
        request.timeout_ms = 5000;
        request.args = vec!["x".repeat(1025)];
        assert!(Invocation::from_request(&request).is_err());
    }

    #[test]
    fn valid_graph_metadata_stays_in_parent_and_unknown_fields_are_rejected() {
        let mut request = isolated_request();
        let context = serde_json::json!({"executionId":"execution","activationId":"activation","nodeId":"node","attempt":1,"revision":1,"snapshotId":"snapshot","sourceChecksum":"a".repeat(64)});
        request
            .env
            .insert("TASTEDEV_GRAPH_CONTEXT".into(), context.to_string());
        let invocation = Invocation::from_request(&request).unwrap();
        assert!(!invocation
            .environment
            .contains_key("TASTEDEV_GRAPH_CONTEXT"));
        let mut changed = context;
        changed["extra"] = json!("not an instruction");
        request
            .env
            .insert("TASTEDEV_GRAPH_CONTEXT".into(), changed.to_string());
        assert!(Invocation::from_request(&request).is_err());
    }
    #[test]
    fn output_collection_resolves_relative_to_private_command_cwd() {
        let source = std::env::current_dir().unwrap().join("private-source");
        let outputs = vec![crate::build_artifact::Output {
            executable: None,
            name: "frame".into(),
            path: "out/frame.png".into(),
            id: "d".repeat(64),
            url: "not-used".into(),
            token: "not-used".into(),
        }];
        assert_eq!(
            output_paths(&source, &source.join("src"), &outputs).unwrap(),
            ["src/out/frame.png"]
        );
        assert!(output_paths(&source, &source.with_file_name("outside"), &outputs).is_err());
    }

    #[test]
    fn source_working_directory_cannot_escape_or_select_broker_metadata() {
        assert_eq!(source_cwd("source").unwrap(), PathBuf::new());
        assert_eq!(source_cwd("source/src").unwrap(), PathBuf::from("src"));
        for path in [
            ".",
            "source2",
            "source/../",
            "../source",
            "C:/source",
            "source-transfer.json",
        ] {
            assert!(source_cwd(path).is_err(), "{path}");
        }
    }

    #[test]
    #[ignore = "Creates/deletes an owned AppContainer profile and copied runtime; no process launch"]
    fn actual_preparation_binds_receipt_and_locks_only_private_runtime() {
        let base = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("target/isolation-probes");
        fs::create_dir_all(&base).unwrap();
        let temp = tempfile::tempdir_in(base).unwrap();
        let root = temp.path().join("workspace");
        fs::create_dir(&root).unwrap();
        let project = uuid::Uuid::new_v4().to_string();
        let snapshot_id = uuid::Uuid::new_v4().to_string();
        let proposal = uuid::Uuid::new_v4().to_string();
        let hash = format!("{:x}", Sha256::digest(b"saved user changes"));
        let changed = vec!["player.gd"];
        let manifest = json!([
            snapshot_id,
            project,
            proposal,
            1,
            "base",
            changed,
            ["player.gd", hash]
        ]);
        let checksum = format!("{:x}", Sha256::digest(manifest.to_string().as_bytes()));
        let request: Request = serde_json::from_value(json!({
            "protocolVersion":1,"type":"execute","agentId":"agent","jobId":uuid::Uuid::new_v4().to_string(),
            "runId":uuid::Uuid::new_v4().to_string(),"projectId":project,
            "requirements":{"executionIsolation":1},
            "isolation":{"version":1,"filesystem":"workspace","network":"deny","childProcesses":"deny"},
            "executable":"engine","args":[],"env":{},"cwd":"source","timeoutMs":5000,
            "source":{"provider":"snapshot","repository":format!("snapshot:{snapshot_id}"),"revision":"base",
                "snapshot":{"provider":"snapshot","snapshotId":snapshot_id,"projectId":project,"proposalId":proposal,
                    "attempt":1,"baseRevision":"base","changedFiles":changed,"checksum":checksum,
                    "files":[{"path":"player.gd","content":"saved user changes","checksum":hash}]}}
        })).unwrap();
        crate::snapshot::prepare(&request, &root, Arc::new(AtomicBool::new(false))).unwrap();
        let runtime = temp.path().join("engine.exe");
        let bytes = b"controlled fixture, not an executable validation";
        fs::write(&runtime, bytes).unwrap();
        let library = temp.path().join("runtime.dll");
        fs::write(&library, b"controlled dependency").unwrap();
        let catalog = temp.path().join("runtime.json");
        fs::write(
            &catalog,
            json!({"version":1,"backend":"windows-private-appcontainer-v1", "programs":[{
                "id":"engine","executable":runtime,"checksum":format!("{:x}",Sha256::digest(bytes)),
                "files":[{"source":library,"path":"lib/runtime.dll","size":21,"checksum":format!("{:x}",Sha256::digest(b"controlled dependency"))}]
            }, {
                "id":"engine-secondary","executable":runtime,"checksum":format!("{:x}",Sha256::digest(bytes))
            }]})
            .to_string(),
        )
        .unwrap();
        let prepared = Prepared::create(&request, &root, &catalog).unwrap();
        let definitions = Catalog::load(&catalog, &root).unwrap();
        let secondary = prepared
            .profile
            .prepare_program(definitions.resolve("engine-secondary").unwrap())
            .unwrap();
        assert_ne!(secondary.path.parent(), prepared.program.path.parent());
        assert_eq!(fs::read(&secondary.path).unwrap(), bytes);
        drop(secondary);
        let private_library = prepared
            .program
            .path
            .parent()
            .unwrap()
            .join("lib/runtime.dll");
        assert_eq!(
            fs::read(&private_library).unwrap(),
            b"controlled dependency"
        );
        assert!(fs::write(&private_library, b"tamper").is_err());
        assert!(fs::remove_file(&private_library).is_err());
        let library_directory = private_library.parent().unwrap();
        assert!(fs::rename(
            library_directory,
            library_directory.with_file_name("renamed-lib")
        )
        .is_err());
        assert!(prepared.binding.bundle_checksum.is_some());
        assert!(prepared.identity().starts_with("TASTESTUDIO."));
        let profile = prepared.mirror.root.parent().unwrap().to_path_buf();
        assert_eq!(prepared.cwd, prepared.mirror.root);
        assert_eq!(fs::read(&prepared.program.path).unwrap(), bytes);
        assert!(fs::write(&prepared.program.path, b"tamper").is_err());
        assert!(fs::remove_file(&prepared.program.path).is_err());
        let directory = prepared.program.path.parent().unwrap();
        assert!(fs::rename(directory, directory.with_file_name("renamed-runtime")).is_err());
        prepared.mirror.verify_original().unwrap();
        prepared.mirror.verify_staged().unwrap();
        assert_eq!(fs::read(&runtime).unwrap(), bytes);
        assert!(
            Journal::recover(&request, &root).is_err(),
            "live broker handle must prevent recovery"
        );
        prepared.close().unwrap();
        assert!(!profile.exists());
        assert!(!Journal::recover(&request, &root).unwrap());
        let run = crate::pipeline::cwd(&root, &request.run_id, ".").unwrap();
        assert_eq!(
            fs::read(run.join("source/player.gd")).unwrap(),
            b"saved user changes"
        );
        let mut retry = request.clone();
        retry.job_id = uuid::Uuid::new_v4().to_string();
        let prepared = Prepared::create(&retry, &root, &catalog).unwrap();
        let location = prepared.mirror.root.parent().unwrap().to_path_buf();
        drop(prepared);
        assert!(
            !location.exists(),
            "fallback Drop must release locks before profile cleanup"
        );
        assert!(Journal::recover(&retry, &root).unwrap());
    }
}
