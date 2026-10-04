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

[STEP9 evidence](../../../../resources/design/tastedev-studio-step9/EVIDENCE.md) records production Protocol→Core→actual Windows Agent→stdout/stderr→passed execution and mismatch/invalid blocking. Agent Debug12/Release12/fmt/Clippy/release were reused only after42 unchanged Agent/Native input hashes, the toolchain, actual release binary and five previous gate hashes were verified. Independent production visual review returned ship. STEP9 PASS; STEP10 ready but NOT_STARTED. This is new Protocol-flow evidence plus verified reuse, not a new Native UI, Unix or installed-package qualification.

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

[Actual Agent E2E](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-8-20260930/actual-agent-e2e.json) records real Windows registration, capability, live two-stream output, token exclusion, passed/nonzero/invalid executable, timeout/cancel child cleanup, malformed input, duplicate protection and restart/reconnect behavior.

[STEP8 evidence](../../../../resources/design/tastedev-studio-step8/EVIDENCE.md) records source gates, Web UI and review separately. No Unix certification, installer deployment, QA-01 acceptance, new native UI regression, artifact store, source checkout, DAG, Scheduler, AI or STEP10 completion is claimed. This paragraph describes STEP8 evidence; STEP9 acceptance is separate above.
