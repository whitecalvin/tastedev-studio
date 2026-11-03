# TASTESTUDIO Agent Architecture — STEP8

## STEP11 acceptance — 2026-09-30

STEP 11 PASS — STEP 12 착수 가능. Node264 distinct + Runner2; Rust Debug18/Release18; actual Chromium/Agent Browser6 groups, legacy Agent11 and Pipeline14 distinct groups; artifact integrity/sanitization and production GUI PASS. Final Web build OHcgxvcH8WgtoEaRSzBQv; Agent/Web/Desktop no-bundle builds PASS. UI reviewer resolved its one spacing finding and returned ship. Exact scope, gate reuse and limitations: workspace resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930/RESULT.md. STEP12 NOT_STARTED.

## STEP11 current implementation — 2026-09-30

Browser/e2e TestPlan steps now execute official Playwright Test on the separate Rust Agent. Real Chromium capability probing, isolated contexts, failure screenshots/traces, Console/Page Error/Network/Test Report evidence, bounded authenticated binary transfer, LocalArtifactStore, SHA-256 verification and Studio Evidence Viewer are implemented. [Browser Evidence](TASTEDEV_BROWSER_EVIDENCE.md) is the current contract. The STEP11 task evidence under resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930 determines final acceptance. Core history remains memory-only; binary artifacts persist separately. STEP12 NOT_STARTED. Earlier STEP11-unimplemented statements below are historical.

## STEP10 acceptance — 2026-09-30

STEP 10 PASS — STEP 11 착수 가능. Node253 distinct, Agent Debug17/Release17, real pipeline14 groups and legacy Agent11 groups PASS. Final production GUI4 groups PASS (errors0); Agent/Web/Desktop no-bundle builds PASS. Final evidence: resources/verification/dev-01/tasks/tastedev-studio/step-10-20260930/RESULT.md in the workspace. STEP11 NOT_STARTED. Native GUI/installed QA were not rerun.

## STEP 10 current implementation — 2026-09-30

STEP10 adds TestDefinition → separate TestPlan → existing Job/Queue/Matcher/Run/RunStep → same-Agent sequential execution. Optional Git source, install/build/start/HTTP health/test/cleanup, primary failure and dependent skip, cleanup after failure/cancel/timeout, per-step logs, source SHA and Studio Tests/Run detail are implemented. [Test Orchestration](TASTEDEV_TEST_ORCHESTRATION.md) is the current contract.

The STEP10 task directory under resources/verification/dev-01/tasks/tastedev-studio/step-10-20260930 records exact final acceptance and evidence. STEP11 is NOT_STARTED. Core remains server-memory only. Git uses credential-free HTTPS/git URLs and a detached checkout of an explicitly fetched revision; local dirty/uncommitted files are not transferred. Health v1 is bounded loopback HTTP. Browser engine/evidence upload, AI and Scheduler are excluded.

Tests now use TestPlan: test timeout is the overall main-pipeline budget (default600s), task timeouts still bound individual steps, and cleanup has its own bounded allowance. Optional Test environment/profile overrides reuse STEP9 resolution; resolved per-step constraints are intersected for one Agent. Legacy single-command Tasks retain their existing behavior.

The historical sections below describe earlier STEP8/9 contracts and do not override STEP10 multi-step execution, source provisioning or current Tests UI. Earlier NOT_STARTED/source-copy-absent/single-command-only statements are retained as history.

## Historical baseline

Independent Rust executable: agent/src/main.rs (connection, identity and claims), model.rs (validation and filesystem boundary), executor.rs (capability/process/output) and tree.rs (platform process lifecycle). It is not embedded in Tauri. Node runs Core; Agent runs independently.

## STEP9 Protocol boundary

[TASTEDEV Protocol v1](TASTEDEV_PROTOCOL.md) is loaded and resolved by Studio into the existing Core Job. Agent does not read YAML, inspect the Project name, infer framework commands or select a test engine. Protocol Task/Test still yields one executable plus argument array, cwd, resolved environment and timeoutMs. Existing Agent validation and runtime matching remain authoritative at execution.

Protocol timeout is1–3600 seconds and becomes milliseconds; a test can override its referenced task's timeout/requirements. YAML requirement merging and environment resolution happen before dispatch. The safe example uses PATH-resolvable node, including Windows, rather than a batch-file shim or absolute machine path.

The declared project-relative cwd is applied under the fresh Agent Run directory. No project checkout/source copy or dependency installation was added. Agent filesystem checks are not an OS sandbox. Protocol detection/open/save never executes; Queue and Assign remain explicit user actions. STEP10 engines/orchestration are not started.

[STEP9 evidence](../resources/design/tastedev-studio-step9/EVIDENCE.md) records production Protocol→Core→actual Windows Agent→stdout/stderr→passed execution and mismatch/invalid blocking. Agent Debug12/Release12/fmt/Clippy/release were reused only after42 unchanged Agent/Native input hashes, the toolchain, actual release binary and five previous gate hashes were verified. Independent production visual review returned ship. STEP9 PASS; STEP10 ready but NOT_STARTED. This is new Protocol-flow evidence plus verified reuse, not a new Native UI, Unix or installed-package qualification.

## Start Core and Studio

From the Studio repository, install the pinned dependencies once with pnpm install --frozen-lockfile. Provide CORE_AGENT_TOKEN and CORE_STUDIO_TOKEN through the launching process environment, each at least 16 characters. Use different configured values; no token value belongs in a committed sample. Then run:

    pnpm core:start

Defaults: CORE_HOST=127.0.0.1, CORE_PORT=4340, CORE_HEARTBEAT_TIMEOUT_MS=15000. Non-loopback binding requires CORE_ALLOW_LAN=1. CORE_ORIGINS is an optional comma-separated exact browser-origin allowlist. Defaults allow the development 4320, Web 4330/4317 and Tauri origins defined in transport/server.ts. Set the exact origin if using another Web port.

Run pnpm dev --hostname 127.0.0.1 --port 4320, or start an already built Web output with pnpm start --hostname 127.0.0.1 --port 4330. In a Project's Agents activity, enter ws://127.0.0.1:4340/studio and the configured Studio token, then connect. Endpoint/token are memory-only; reload requires re-entry. Core records persist through this reload while the Core process survives.

Core supplies plain WebSocket locally. Remote TLS requires a configured TLS endpoint/proxy; no TLS listener or certificate provisioning is included. Agent supports wss and rejects plaintext non-loopback URLs unless allowInsecureLan is explicitly true. Desktop CSP currently permits the default loopback4340 only; Web remote configuration is subject to origin/mixed-content policy.

## Configure and start Agent

Build only when relevant inputs changed:

    cargo build --manifest-path agent/Cargo.toml --release --locked

Run an existing valid binary with:

    .\agent\target\release\tastedev-agent.exe --config D:\works\projects\GXSOFT\TASTEDEV\resources\guides\studio-agent\agent.json

Create that config under the resources/guides directory, with a dedicated workspace root under resources/verification (the following JSON contains no credentials):

    {
      "endpoint": "ws://127.0.0.1:4340/agent",
      "name": "DEV-01 Agent",
      "workspaceRoot": "D:\\works\\projects\\GXSOFT\\TASTEDEV\\resources\\verification\\studio-agent-workspace",
      "heartbeatMs": 2000,
      "reconnectMaxMs": 10000,
      "tokenEnv": "TASTEDEV_AGENT_TOKEN",
      "logLevel": "info",
      "allowInsecureLan": false
    }

Set TASTEDEV_AGENT_TOKEN in the Agent process environment to the same configured value as Core's CORE_AGENT_TOKEN. The config stores its variable name, not the value. Run the binary in a separate terminal/process from Core. Ctrl+C requests active-job cancellation and shutdown. The workspace must be absolute; symlink/junction paths are rejected.

## Execution and containment

Studio creates a single command with executable, argument array, relative cwd, explicit environment and timeout (100–3,600,000 ms at the protocol boundary; default dispatch 60 seconds). Core and Agent validate the envelope and requirements. No automatic shell string concatenation occurs; a shell can still be an explicitly selected executable.

Agent creates a fresh per-Run directory. It does not check out a revision, copy the Studio project, install dependencies or populate source files. Commands must use available executables and deliberately prepared inputs; browser workspace handles are not remote files.

The child environment is cleared, then only PATH, SystemRoot, WINDIR, TEMP, TMP, HOME, USERPROFILE and PATHEXT are inherited before adding validated request environment. Agent authentication environment is not inherited. Explicit job environment is not a secret vault.

Windows starts suspended, attaches the process to a Job Object and then resumes it, so cancellation, timeout, disconnect and Agent exit can clean the tree. Actual Windows binary E2E checks descendant cleanup. Unix process-group code exists but has not been qualified here.

Fresh cwd and symlink/junction checks protect workspace preparation; **they are not an OS sandbox**. The command runs with the Agent user's OS permissions and can access resources outside cwd under those permissions.

## Capabilities and delivery semantics

Agent probes real CPU/memory and selected installed runtimes/tools, including the Git version in capabilities.runtimes.git. Unknown CPU/memory fails startup; optional Docker/GPU/browser/PTY capabilities remain conservative and do not become true merely because a field exists. Agent rechecks command requirements before executing. Runtime comparisons support numeric >= minimums only.

Persistent identity and atomic per-Run claim files prevent duplicate execution while the workspace and markers remain intact. A terminal result is stored pending acknowledgement; ack markers prevent later replay from rerunning the command. This is at-most-once execution under retained local markers, not globally exactly-once execution or durable distributed scheduling.

After link loss the active tree is cancelled and its result retained. Reconnection uses bounded exponential backoff. Pending terminal results are replayed until acknowledged; dropped offline log chunks are not replayed. Agent restart preserves identity and reports claimed-but-unfinished Runs failed instead of reexecuting them. An offline active Run can await Agent reconciliation indefinitely. Core restart loses its in-memory Run/queue and does not restore it from claims.

## Verification boundaries

[Actual Agent E2E](../resources/verification/dev-01/tasks/tastedev-studio/step-8-20260930/actual-agent-e2e.json) records real Windows registration, capability, live two-stream output, token exclusion, passed/nonzero/invalid executable, timeout/cancel child cleanup, malformed input, duplicate protection and restart/reconnect behavior.

[STEP8 evidence](../resources/design/tastedev-studio-step8/EVIDENCE.md) records source gates, Web UI and review separately. No Unix certification, installer deployment, QA-01 acceptance, new native UI regression, artifact store, source checkout, DAG, Scheduler, AI or STEP10 completion is claimed. This paragraph describes STEP8 evidence; STEP9 acceptance is separate above.


## Optional execution-isolation startup diagnostics (implementation in progress)

Agent Config accepts an optional absolute `isolationCatalog`, for example `D:/TASTESTUDIO/operator/runtimes.json`, outside `workspaceRoot`. Existing configurations omit it and retain their behavior. The schema and safety boundaries are described in [Execution isolation](TASTEDEV_EXECUTION_ISOLATION.md).

This source-level opt-in runs the actual live Agent self-check before Core jobs. An older administrator result or a catalog setting cannot qualify a new process. The ordinary Windows user context currently reports private-station permission failure and retains no qualified runtime; old IDE/Agent functionality remains available. Isolated-job capability stays disabled until the command/output/result broker and supported runtime policies are integrated. This is not a newly released isolated-execution feature or a request to change installation/service privileges.

### Stage2 private artifact inputs — 2026-11-01

Declared artifact inputs now use the existing authenticated/checksummed transfer broker with a parent-owned private destination. Original Source is not an installation destination. The private installation is checked for size/hash/single-link/path identity before child launch; collision, outside-owner cwd, hard-link and corrupt-payload cases fail closed. Installation metadata is recorded after actual installation, and durable result manifests retain explicit input lineage without grant tokens/URLs. Full Agent Debug117 PASS, related Release57 PASS, test-target source Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Eleven default ignored tests were not rerun; historical administrator2-test success is pinned mechanism evidence, not current production/Core/Godot E2E. Isolated capability remains None. Registered runtime/version and bounded child/runtime-bundle contracts, positive current production integration, Native GUI and stages3-7 remain incomplete. See checkpoint gate `stage2PrivateArtifactInputs` and its immutable input/binary/log hashes. No packaging or unchanged Node/Web/Tauri gates ran. No new user-facing feature is advertised by this internal plumbing; existing25-language release notes are preserved.

### Stage2 registered runtime version facts — 2026-11-01

Operator catalogs can optionally pin a runtime name, exact numeric-triplet version, probeArgs and timeoutMs. After live OS-boundary qualification, the trusted broker copies registered SHA-pinned programs into separate locked private directories and invokes only the registered version command in an empty private cwd. No Source args/config, parent PATH version or prior receipt supplies a version fact. Probes use an empty application environment, at most10s each/30s total and16KiB captured output; overflow/loss/error/mismatch/cancel/timeout reject qualification. Process-local facts are keyed by executable ID. Executable Steps may satisfy runtime requirements only with their selected program; data-only Snapshot preparation checks actual registered facts.

Full Agent Debug121 PASS, related Release61 PASS, source test-target Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Two explicit actual Release checks pass: multiple private runtime copies retain file/directory locks and clean their profile, and two production Agent starts requalify in distinct contexts rather than trust a previous result. Both actual ordinary-context starts remain unqualified with exact cleanup; this is negative admission evidence, not successful private version execution. Nine remaining default-ignored actual tests were not rerun. Positive private runtime version/production/Core/Godot E2E, approved dependency bundles and bounded confined children remain incomplete; capability stays None. Packaging and unchanged Node/Web/Tauri gates were not run. This is internal unqualified plumbing, so existing25-language release notes are preserved without a new user-facing completion claim. Immutable hashes and logs: checkpoint `stage2RegisteredRuntimeVersions`.

### Stage2 runtime dependency bundles — 2026-11-01

Operator catalogs now support explicit local dependency files with relative destination, declared size and exact SHA256. No recursive runtime-directory copy is performed. Limits are256 files,128MiB per dependency,512MiB aggregate dependency bytes and256KiB catalog. Project Source, secret/credential paths, path escape, case/parent collisions, stale bytes and existing destinations are rejected. Bundled programs retain the native executable filename. Main/dependency files and nested directories are locked for execution; original files/ACLs are not changed. Chunk copying and private lock preparation use cancellation/deadline checks, and version probes use the budget remaining after copying. Optional bundleChecksum binds the dependency manifest and executable filename in journal/result identity; old records without it remain readable and unchanged on serialization. Child-process denial remains unchanged.

Final full Agent Debug127 PASS, related Release67 PASS, source test-target Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Three explicit actual Release checks pass: controlled dependency copies/file-directory locks/profile cleanup, production negative live requalification on two starts, and startup recovery without work replay. These controlled dependency bytes do not prove Python DLL loading or a successful private version/command/Core/Godot run. Eight other default-ignored actual tests were not rerun. The initial full Debug126/1FAIL found a normal/verbatim Windows path boundary comparison; both sides are now canonicalized and the final corrected candidate passes. Earlier compile/test failures are preserved. Capability remains None; bounded confined children, positive production integration and stages3-7 remain incomplete. No packaging or unchanged Node/Web/Tauri gates ran. Internal unqualified plumbing adds no user-facing release claim; existing25-language notes are preserved. Exact evidence: checkpoint `stage2RuntimeDependencyBundle`.

### Stage2 owned process-tree completion — 2026-11-01

Private execution now uses the validated isolated Tree API with count1, unchanged child denial, UI restrictions and no breakaway. Normal/cancel/timeout/observation-error paths explicitly terminate owned work, observe root exit, close owned process/thread handles and require Job active count0 before output/profile completion. Failure to observe zero remains an error. The kernel primitive accepts only1..4 root-inclusive processes; this is not a public child-execution approval contract. Legacy normal execution keeps its existing semantics.

Actual Node Job tests verify a child enters, an additional child is rejected without executing its marker, configured limit2 and absent breakaway flags, then whole-tree termination and accounting0 after handle closure. This is kernel lifecycle evidence, not private AppContainer descendant confinement or approved-child executable allowlisting. Initial Debug128/1FAIL exposed an immediate-count assumption: a rejected/terminated association can remain counted while handles exist. The exact reference holder was not independently traced; original failure is preserved. The final test checks configured enforcement and actual child denial, then requires zero after termination/closure. Windows private cleanup order was corrected accordingly. [Microsoft active-process accounting rules](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) explain the distinction.

Final Agent Debug129 PASS, related Release71 PASS, explicit actual Release3 PASS (preparation/locks/cleanup, negative live requalification and startup recovery), source test-target Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Eight other default-ignored tests including administrator private execution were not rerun. Capability remains None. Reviewed bounded-child Protocol/Core/Agent policy, positive private runtime/version/command/Core/Godot, Native GUI and stages3-7 remain incomplete. No packaging or unchanged Node/Web/Tauri gates ran; existing25-language release notes are preserved because this internal unqualified work introduces no new public child support. Exact current input/binary/log hashes: checkpoint `stage2OwnedTreeCompletion`.

## Stage2 reviewed descendants and actual private runtimes — 2026-11-01

Protocol/Core/Agent now preserve a separately reviewed root-inclusive process bound2..4. The default remains one process and child denial. Task/profile/project intersection keeps the strictest bound; the operator catalog must separately allow the selected program's bound. Published execution review displays the exact policy before start. Live qualification probes same-AppContainer-SID descendant chains, outside files/network/UI/credentials, registered runtime hashes/versions and exact cleanup. Only the current process's live Runtime lease can activate capability; catalogs and historical receipts cannot. Unsupported OS/workflow combinations still fail closed.

Actual administrator evidence is separated by immutable image: `4ba129fc` passed private root, same-SID chains2..4 and ready-before-timeout/cancel (3 tests); `54e677bc` passed actual Node24.22.1 entry/local-module and Godot4.7.2 headless saved-Snapshot commands (1 test), unchanged Source/result hashes and profile removal. The first command failure is retained: Node realpath attempted lstat C:\ outside its allowed private tree. Registered Node now uses preserve-symlinks and preserve-symlinks-main, both bound into runtime identity, without changing host ACLs. This does not claim arbitrary Node IPC/native-module/ESM compatibility. Private screen DC acquisition was possible; host screen-pixel reading was not performed or claimed.

Latest production candidate `c986f6c8745ff15ca03d054621f39a84970487c96adf987587396d313503945b` adds live capability activation and an exact data-only cleanup exception. Agent Debug135 PASS/13 ignored, directly related Release55 PASS/13 ignored/80 filtered, test-target Clippy PASS (cache hardlink fallback warning), production Release compile PASS with4 diagnostic-helper warnings. Earlier Node1181/typecheck/lint remain scoped prior results; the only subsequent application TypeScript change explicitly types a default string identifier without changing emitted behavior. Full Release phase completion has not run.

A dedicated harness uses production Core/Graph/Queue/Matcher/Agent/Snapshot/artifact services; it is not a replacement test runner. Dummy saved Snapshot creation, secret-file exclusion, authenticated Source upload/checksum and harness typecheck passed. Actual qualified production Core flow is WAITING_FOR_ADMIN_EXECUTION through `Verify-IsolatedCore.ps1`, with310 pinned inputs and fixed production/Node/Godot images. Passing standalone native components does not pass this integration gate. Existing Web build PID197640 remains observed in compile wait; no successful Web build or duplicate restart is claimed. Stage2 and stages3-7 remain incomplete. No packaging/install/deployment/version/tag/commit/push.

Detailed evidence and current gates: `resources/verification/dev-01/orchestration-completion-20261101/STAGE-2-APPROVED-EXECUTION.ko.md` and `checkpoint.json`; older sections above are historical candidate-specific results.

## Actual production Core gate — 2026-11-01

The administrator run at08:54UTC completed both real production jobs: Node6e9d98ae-9197-4b25-96e3-31535f97710e and Godot65433355-569d-45eb-8a7d-8b1f26bb7fec. Agentc986f6c8 performed current-context live qualification, advertised isolation1/child2 and executed saved Snapshot88089d6a-ce31-45e1-85bd-26ad934ad200 through existing Core/Graph/Queue/Matcher/Source/artifact services. All six Source/test/cleanup steps passed. Authenticated artifact receipts match independently re-read bytes, graph/run/step/Agent/Source identities and checksums. Original saved files, excluded Dummy .env and outside canary remain unchanged; owned Agent exited.

The reported FAILED was the harness's final read-only assertion using `artifacts` instead of Core's `artifacts-builds` store. The original failing verifier/result/log are preserved. Corrected only that resource script, then resumed final assertions against existing real outputs via `verify-isolated-core-existing.mjs`; no Administrator/native/Core/Agent rerun or product source change was needed. Original310-pin candidate is immutable, its old verifier bytes are retained, and remaining309 pins match. The recovery receipt includes original evidence hashes. This is successful actual production execution, not a fake Agent; it remains distinct from Provider/Native GUI/rendered game and later stages.

Full Agent Release coverage is135 PASS composed of unchanged disjoint55 isolation and80 remaining tests; default13 ignored actual tests retain their individually recorded scope. Debug135, Clippy and production Agent compile remain valid. Existing Web build input was invalidated by resolver.ts changing after its start; only its confirmed owned PID197640 was stopped, no caches/logs removed. Latest-input Web compilation, TypeScript and9-page generation passed; exit gate was still pending at this record. No package/install/deploy/version/tag/commit/push.

Authoritative result: `resources/verification/dev-01/orchestration-completion-20261101/core-runs/30e53f2e-f4b5-40f3-b9b1-ec26ec741945/verification-resume-1793523426972.json`.

## Stage3 node-centered observability — 2026-11-01

DEV_VERIFIED: selected-node read-only Agent/work/Run/step/Source/wait/history/AI route/approval/schedule projection is wired to existing production GUI and services. Cross-project/Agent/context/source mismatches and dirty/disconnected/stale graph state cannot become current verified Run states. A Run retains its own captured Snapshot after later Source adoption. Graph schedules show a readonly entry node instead of an empty Protocol Test selector.

Actual historical production Core records were served from an independent copy; original DB hash and two real Run identities stayed unchanged. Browser light/dark, exact Run/Source navigation, pending approval protection, dirty-state hiding, disabled schedule navigation and readonly entry were checked. No new Agent/Provider run or Source write; controlled approval cancelled, schedules disabled, owned browser/Core closed. This is separate from actual Native lifecycle stage4.

Node1192 PASS composed of disjoint retained/resumed gates, lint/typecheck PASS, Web compile plus corrected test-type gate and official generate resume exit0. Exact compiler Build ID recovered from its emitted manifest;348 app JS hashes unchanged, one expected SSG manifest checked against actual prerender routes. Not a clean default build claim. Rust unchanged and reused. Failures/tooling/fixture limitations remain explicit in `resources/verification/dev-01/orchestration-completion-20261101/STAGE-3-RESULT.ko.md` and `stage-3-final-gates.json`. Existing25-language notes preserved/updated. Stage4 actual Native GUI is next; stages5-7 retained. No packaging/install/deploy/version/tag/commit/push.

## Bounded live-output receipts

An updated Agent registers with optional `outputAck: 1`. Core advertises `outputWindow: 32` only for that connection. After authenticated output is validated and stored, Core returns `output_ack` with the exact Run, Job, optional Step and sequence. Agent keeps at most 32 receipts outstanding, alongside its existing 64-event channel and one unsent WebSocket event. A receipt for another scope, an invented future sequence or a duplicate cannot release unrelated output. Reconnection clears only this volatile transport window; durable execution claims/results retain their existing authority.

This limits data backlog without increasing message size, write-buffer size, heartbeat or execution deadlines. WouldBlock and a full write buffer are temporary pressure, not evidence of a lost connection. Live output remains bounded and may be marked partial under pressure; it is not an unbounded artifact archive. Existing non-negotiating Core/Agent versions retain the legacy path, so the new bounded receipt behavior requires both updated components. No write, shell, authentication or approval permission is granted by this negotiation.

Final execution results wait for the live-output channel and receipt window to drain, so a result cannot overtake its remaining output. For an already terminal owned Run, Core may return an exact receipt with `discarded: true`; that closes transport bookkeeping without storing late text or changing the Run result.
