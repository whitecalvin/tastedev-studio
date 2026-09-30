# TASTEDEV Studio Desktop Runtime — STEP 6

Status: STEP 6 PASS under STEP6E acceptance; historical unresolved event1 is non-blocking. STEP7 NOT_STARTED. Existing packaged artifacts predate STEP6E frontend diagnostics.

## Runtime boundary

UI → WorkspaceFileService / RunService / GitService → Host interfaces → centralized runtime factory (`src/features/runtime/hosts.ts`). Web retains WebFileSystemHost and explicit unavailable Process/Git hosts. `TauriFileSystemHost`, `TauriProcessHost` and `TauriGitHost` in `native-hosts.ts` implement the desktop adapters. Desktop adapters alone import Tauri APIs; components never call invoke. Runtime labels use an SSR-safe external-store snapshot. Adapter tests inject the IPC boundary.

Desktop uses a static Next export; `/workspace/?project=<id>` resolves client metadata and reuses WorkspaceProject. Web `/projects/<id>` links remain. Next 16's configured `distDir: .next-desktop` is also the static export output directory. Tauri embeds that folder and requires no Node server in production. Build evidence verifies input and output hashes before reusing an export.

## Versions and development

- Node 24.11.1, pnpm 11.19.0; existing Next 16.3.7 / React 19.3.0 / Monaco 0.57.0 / xterm 6.0.0 preserved.
- Tauri JS API / CLI / Rust: 2.12.0; tauri-build 2.7.0; dialog plugin 2.8.0; portable-pty 0.9.0. Cargo.lock and pnpm-lock.yaml pin resolutions.
- Rust 1.98.1 x86_64-pc-windows-msvc; Visual Studio 18 Community C++ tools and WebView2 installed on DEV-01.
- `pnpm dev`: Web development. `pnpm build` / `pnpm start`: Web production.
- `pnpm desktop:dev`: Next dev on 127.0.0.1:4320 plus Tauri dev window.
- `pnpm build:desktop`: static frontend export with verified cache reuse.
- `pnpm desktop:build`: Tauri optimized Windows executable and NSIS bundle.
- `cargo test --manifest-path src-tauri/Cargo.toml`: native Debug tests.
- `cargo test --manifest-path src-tauri/Cargo.toml --release --features custom-protocol`: native production-equivalent tests; requires the exported frontend.
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`.

Build sequentially: `pnpm desktop:build` → `pnpm build` → `pnpm start --hostname 127.0.0.1 --port 4317`. Although the export is `.next-desktop`, Next 16 also uses the shared `.next` build workspace. A fresh desktop export invalidates Web server output; restore it with `pnpm build` before Web start. An unchanged desktop export can reuse verified input/output SHA-256 evidence.

Tauri requires WebView2 and the MSVC toolchain on Windows. AppData access is required for WebView2 and local metadata. A restricted Codex sandbox can compile successfully while refusing actual GUI initialization; runtime verification must use the normal desktop user.

References: [Tauri Next integration](https://v2.tauri.app/start/frontend/nextjs/), [Windows prerequisites](https://v2.tauri.app/start/prerequisites/), [capabilities](https://v2.tauri.app/security/capabilities/). Installed Next documentation takes precedence for current export behavior.

## Filesystem and persistence

Native directory selection occurs in Rust through the OS dialog. Selection registers a canonical root under an opaque session ID. Project bindings persist in the app data `workspaces.json`; source content is never persisted there. Project metadata in WebView localStorage stores the actual absolute workspacePath. Restart restores the binding and rechecks folder existence.

Native requests revalidate root and relative path; deny traversal, unexpected absolute paths, alternate streams, Windows reserved names, trailing aliases, symlinks and junctions. Existing ancestors are checked even for new destinations. Recursive deletion preflights links. Root mutation is disallowed. Native writes serialize within the app, compare saved content, write/sync a sibling temporary file, recheck disk content and replace only after success. There remains a cross-process check/replace race; this is not a transactional lock against malicious concurrent local filesystem mutation.

UTF-8 text is limited to 2 MiB. No content truncation. Explorer remains lazy by directory. Native rename uses the OS instead of the Web copy fallback.

Watcher feasibility reviewed: a recursive watcher needs exclusions, burst coalescing, path identity after rename, reconnect disposal and dirty-document notifications. It is deferred in this phase; explicit Refresh/Reload plus save conflict checks remain. Dirty buffers are never automatically overwritten.

## Process / PTY

Windows ConPTY via portable-pty connects xterm input/output and geometry. Open Shell selects system PowerShell with NoLogo/NoProfile, falling back to cmd; explicit configurations can choose other installed .exe shells. The native host uses executable + args, validates cwd within the authorized root and validates environment without logging its values. Relative executable paths and .cmd/.bat wrappers are rejected; use an executable, or Node plus the package manager's JS entrypoint. Run can use a safe executable test process instead of pnpm.

PTY combines stdout/stderr as a real terminal. Task output uses separate stdout/stderr pipes. UTF-8 boundaries span stream chunks. Per-session ordered events drive the existing RunService lifecycle. Windows Job Objects terminate child trees; an outer app job covers descendants before the per-session job is attached. Stop waits for native cleanup. App exit, project disposal and terminal close request cleanup. A user command still executes with the user's OS permissions; cwd containment is not an OS process sandbox.

## Git

System Git CLI, no network/credential operations. Arguments are arrays with literal pathspecs and separators. Status uses NUL records, independent staged/working status and rename origins. Diff loads HEAD/index/disk on demand. Stage/Unstage/Commit recheck conflicts; Commit requires a nonempty index and a valid message. Logs are limited to 50. Output is bounded and subprocesses time out after 30 seconds; failed/uncertain commits require refresh before retry.

A selected folder must be the repository root; worktrees are supported by Git's own root resolution. A parent repository is not implicitly authorized by opening a child directory. Missing Git and repository access failures are domain errors, never a fabricated clean repository. Explicit Source Control Refresh observes saves; there is no per-keystroke Git process.

## Capabilities, CSP and logging

Only the local main window receives named application command permissions plus event listen/unlisten. There are no broad frontend filesystem/shell/plugin-dialog grants; the Rust selection command owns the dialog and authorization. Remote origins are not granted a capability. CSP restricts content to bundled resources, IPC, local styles and Monaco workers. Inline scripts/styles are required by the current Next/Monaco integration; no dangerousDisableAssetCspModification is enabled.

Native domain errors contain stable codes rather than paths, environment values, CLI stderr or credentials. Process output is user program output. A Tauri plugin initializes frontend diagnostics after IPC and before application scripts; it observes console warnings/errors, window errors and unhandled rejections using fixed codes without arguments. Rust warning/error and panic hooks, native error creation and process/job cleanup failures are recorded. This deliberately bounded capture did not preserve the original frontend exception message/stack; current-session zero counts cannot classify that historical event.

## Deliberate boundaries

Windows only in this phase; no macOS/Linux certification. No automatic watcher, Git clone/checkout/remote/authentication, multi-terminal multiplexer, automatic updates, signing or publication. Default window is 1440×900, minimum 1000×650, native titlebar. Desktop functional, viewport, theme, DPI, lifecycle and installer evidence must be reported separately from compilation. Core, agents, queues, AI and orchestration remain outside scope.

## STEP 6 / 6E current status — 2026-09-30

**STEP 6 PASS** under the user's STEP6E acceptance criteria. STEP 7 is **NOT_STARTED**. Historical event `1790699936279 frontend error` remains **HISTORICAL_UNRESOLVED / NOT_REPRODUCED / Root Cause UNKNOWN / Non-blocking**. It is not deleted, normalised or falsely marked resolved. Its original message, stack, component, route, precise runtime context and triggering action remain unknown; a coarse production-session association is not a recovered exception context.

- STEP6E repairs the diagnostic information gap, not a speculative cause of the historical event. Next instrumentation-client installs before hydration; window.error, unhandledrejection, console Error objects, route/root React error boundaries and Tauri frontend invoke/event failures share a bounded local recorder.
- Records include timestamp, level, source, sanitized message, available stack frames, safe route category, Web/Tauri runtime, application version and platform. Console arguments, arbitrary IPC objects, file contents, environment and credential objects are never serialized; recognized secrets/quoted values/paths/URLs are redacted. Project identity and user action payloads are omitted.
- Real controlled browser throw and Promise rejection, actual Next/React boundary → diagnostic capture → recovery UI → Retry **PASS**. Controlled records use a separate key and `TEST/CONTROLLED` category; they are excluded from product audits. See [controlled evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/controlled-browser.json).
- Current STEP6E production Web manager smoke: unexpected frontend **0**. Last actual Native STEP6D observation: unexpected frontend/native/panic/cleanup **0/0/0/0**. These are separate observations, not a newly repeated Native gate. Historical unresolved frontend events remain **1**, current product blockers **0**. [Audit](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/error-audit.json).
- This change ran **Node102/102, lint, typecheck, Web production build**, controlled browser tests and the new-build Web smoke. JS has no separate Debug/Release test configuration. Rust source/dependencies/config did not change; prior Debug9/Release9/Clippy and actual Native functionality evidence remain scoped to those unchanged components.
- Native filesystem/Monaco/PTY/process/Git/restart, actual 1920/1440/1366 clients, Light/Dark, Windows100%/150%, Missing Project recovery and corrected Native copy retain PASS evidence. **125% DPI remains untested and non-blocking**.
- No Rust/Tauri rebuild or reinstall was requested for this frontend-only diagnostic closeout. Existing STEP6C EXE/installer **do not contain STEP6E diagnostic changes**. A future desktop package must regenerate its frontend export and embedded application; old desktop-export hashes are not current-source build proof. Prior STEP6B installation evidence remains tied to that older artifact.

[Final result](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/RESULT.md) · [STEP6–6E evidence index](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/EVIDENCE-INDEX.md) · [diagnostic gap and storage](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/DIAGNOSTICS.md). No STEP7, CI, QA-01, deployment, source commit or push.

