# TASTEDEV Studio

STEP9 implements [TASTEDEV Protocol v1](docs/TASTEDEV_PROTOCOL.md): saved .tastedev YAML definitions → strict validation → task/test resolution → existing Core Job/Queue/Matcher → independent Rust Agent. Run/Tests show compact definition panels and the status bar shows Protocol state. Initialize TASTEDEV creates a safe project.yml without executable tasks; edit optional files in Explorer/Monaco, save/reload, explicitly Queue, then Assign. Opening a project never executes it. Final Node219, lint/typecheck, Web and Desktop no-bundle builds passed. Actual production Web Protocol→Windows Agent execution passed on build 8Yo38H_FqufQ5R_W3tzcN; Rust Agent Debug12/Release12/fmt/Clippy/release were reused after input, toolchain, binary and evidence-hash verification. Independent UI review returned ship for eight production captures. STEP9 PASS — STEP10 ready but NOT_STARTED.


STEP 8 connects an independent Rust Agent to authenticated WebSocket Core. Agents / Queue / Runs now support real registration, heartbeat/capability, manual single-command dispatch, streamed stdout/stderr and passed/failed/timeout/cancelled results. Production has no fake defaults. Remote records live in the Core server's memory: browser reload requires reconnecting, while Core restart loses its queue and history. The unconnected local foundation remains session-only.

See [Core architecture](docs/TASTEDEV_CORE_ARCHITECTURE.md), [Agent architecture and standalone setup](docs/TASTEDEV_AGENT_ARCHITECTURE.md), and [STEP8 evidence](../../../resources/design/tastedev-studio-step8/EVIDENCE.md). Actual Windows Agent E2E and production Web GUI passed; independent visual review returned ship after visible-log recaptures. Final source/build acceptance is tracked in the task RESULT/checkpoint. Installed-package QA and Native UI were not rerun. STEP8 transport remains the execution foundation for STEP9.

STEP 6 adds a Windows Tauri desktop runtime to the existing Project Manager and compact IDE workspace. Native filesystem, Monaco disk saving, ConPTY Terminal, Run/Stop and local Git work through shared host contracts. Web filesystem editing remains available; Web process/PTY and Git stay explicitly unavailable. Final STEP 6/6E acceptance is **PASS**; see the status below.

## Run and build

Node 24.11.1 / pnpm 11.19.0; desktop uses Rust 1.98.1 MSVC, Tauri 2.12.0 and Windows WebView2.

```powershell
pnpm install --frozen-lockfile
pnpm dev
# Or Windows desktop development:
pnpm desktop:dev
```

```powershell
# Desktop static export + optimized executable + NSIS installer:
pnpm desktop:build
# Restore/build Web server output after desktop export, then start Web:
pnpm build
pnpm start --hostname 127.0.0.1 --port 4317
```

Run builds sequentially. Next 16 desktop export uses `.next-desktop` for bundled frontend output but shares the `.next` build workspace with Web. A new desktop export invalidates Web server output; run `pnpm build` before `pnpm start`. Desktop export cache reuse checks both input and output SHA-256. `pnpm build:desktop` exports only the frontend. Production desktop embeds the export and needs no Node server. Monaco workers are same-origin generated assets, not CDN dependencies.

Validation: `pnpm lint`, `pnpm typecheck`, `pnpm test`; native Debug/Release tests and Clippy commands are in [Desktop Runtime](docs/TASTEDEV_DESKTOP_RUNTIME.md). Reuse valid unchanged gates; do not run unrelated app builds for documentation-only updates.

## Folder, editor and runtime behavior

Desktop Open Project uses an OS folder picker, stores the actual workspace path as metadata and restores its authorized binding on restart. Web requires a secure Chrome/Edge context and directory permission; it stores `workspacePath: null` with IndexedDB handles because browsers do not reveal absolute paths. No server-shell fallback exists.

Explorer loads lazily; Monaco supports multiple tabs, Ctrl+S, Save All and dirty close/reload guards. UTF-8 text is limited to 2 MiB with binary/invalid text rejection and no truncation. Source content is never persisted as browser metadata. Deletion is permanent and confirmed. Native rename uses the OS; Web rename is a bounded non-atomic copy/verify/remove fallback (1,000 entries / 50 MiB). Save checks external changes, but does not provide a cross-process transaction. Automatic filesystem watching is deferred: use Refresh/Reload and save-conflict checks.

Run configurations keep executable/argument arrays, workspace-relative cwd and environment separate. Desktop ConPTY joins terminal streams; task Output keeps stdout/stderr separate. Stop and app exit clean up process trees. Commands run with the user's OS permissions; cwd containment is not an OS sandbox. Configuration environment metadata is not a secret vault.

Native Git uses system Git for status, saved-content diff, stage/unstage, commit and bounded history. Web shows Desktop runtime required. Git clone, checkout and remote/authentication, AI and scheduling are not implemented. Project Protocol v1 is implemented as documented above. Core now provides authenticated WebSocket Agent execution and heartbeat; DB/durable queue, revision checkout and artifact transfer remain deferred. New Project still registers metadata without generating a source scaffold.

[Current analysis](docs/TASTEDEV_CURRENT_ANALYSIS.md), [GAP](docs/TASTEDEV_GAP_ANALYSIS.md), [roadmap](docs/TASTEDEV_IMPLEMENTATION_ROADMAP.md), [Desktop runtime](docs/TASTEDEV_DESKTOP_RUNTIME.md).

## Historical STEP 6 / 6E acceptance — 2026-09-30

**STEP 6 PASS** under the user's STEP6E acceptance criteria. STEP 7 is **NOT_STARTED**. Historical event `1790699936279 frontend error` remains **HISTORICAL_UNRESOLVED / NOT_REPRODUCED / Root Cause UNKNOWN / Non-blocking**. It is not deleted, normalised or falsely marked resolved. Its original message, stack, component, route, precise runtime context and triggering action remain unknown; a coarse production-session association is not a recovered exception context.

- STEP6E repairs the diagnostic information gap, not a speculative cause of the historical event. Next instrumentation-client installs before hydration; window.error, unhandledrejection, console Error objects, route/root React error boundaries and Tauri frontend invoke/event failures share a bounded local recorder.
- Records include timestamp, level, source, sanitized message, available stack frames, safe route category, Web/Tauri runtime, application version and platform. Console arguments, arbitrary IPC objects, file contents, environment and credential objects are never serialized; recognized secrets/quoted values/paths/URLs are redacted. Project identity and user action payloads are omitted.
- Real controlled browser throw and Promise rejection, actual Next/React boundary → diagnostic capture → recovery UI → Retry **PASS**. Controlled records use a separate key and `TEST/CONTROLLED` category; they are excluded from product audits. See [controlled evidence](../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/controlled-browser.json).
- Current STEP6E production Web manager smoke: unexpected frontend **0**. Last actual Native STEP6D observation: unexpected frontend/native/panic/cleanup **0/0/0/0**. These are separate observations, not a newly repeated Native gate. Historical unresolved frontend events remain **1**, current product blockers **0**. [Audit](../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/error-audit.json).
- This change ran **Node102/102, lint, typecheck, Web production build**, controlled browser tests and the new-build Web smoke. JS has no separate Debug/Release test configuration. Rust source/dependencies/config did not change; prior Debug9/Release9/Clippy and actual Native functionality evidence remain scoped to those unchanged components.
- Native filesystem/Monaco/PTY/process/Git/restart, actual 1920/1440/1366 clients, Light/Dark, Windows100%/150%, Missing Project recovery and corrected Native copy retain PASS evidence. **125% DPI remains untested and non-blocking**.
- No Rust/Tauri rebuild or reinstall was requested for this frontend-only diagnostic closeout. Existing STEP6C EXE/installer **do not contain STEP6E diagnostic changes**. A future desktop package must regenerate its frontend export and embedded application; old desktop-export hashes are not current-source build proof. Prior STEP6B installation evidence remains tied to that older artifact.

[Final result](../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/RESULT.md) · [STEP6–6E evidence index](../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/EVIDENCE-INDEX.md) · [diagnostic gap and storage](../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/DIAGNOSTICS.md). No STEP7, CI, QA-01, deployment, source commit or push.



## STEP 10 — Test orchestration

See [Test Orchestration](docs/TASTEDEV_TEST_ORCHESTRATION.md) for the typed plan, Git source, same-Agent pipeline, service/health, cleanup, timeout/cancel and Studio result workflow. STEP11 is not started. Final verification is recorded under resources/verification/dev-01/tasks/tastedev-studio/step-10-20260930 in the TASTEDEV workspace.

## STEP10 acceptance — 2026-09-30

STEP 10 PASS — STEP 11 착수 가능. Node253 distinct, Agent Debug17/Release17, real pipeline14 groups and legacy Agent11 groups PASS. Final production GUI4 groups PASS (errors0); Agent/Web/Desktop no-bundle builds PASS. Final evidence: resources/verification/dev-01/tasks/tastedev-studio/step-10-20260930/RESULT.md in the workspace. STEP11 NOT_STARTED. Native GUI/installed QA were not rerun.

## STEP11 Browser Testing + Evidence

Official Playwright Test runs on the Rust Agent. Configure TASTEDEV_BROWSER_RUNNER and a project browser config; Core stores verified binary artifacts and Studio previews failure evidence. See [Browser Evidence](docs/TASTEDEV_BROWSER_EVIDENCE.md) for setup, protocol, limits and acceptance scope. STEP12 NOT_STARTED.
