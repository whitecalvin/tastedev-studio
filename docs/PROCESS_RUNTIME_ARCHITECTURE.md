# Process Runtime Architecture — STEP 4

## Boundary

`Run / Terminal UI → RunService → ProcessHost → Runtime`

Production composition uses **WebUnavailableProcessHost** exclusively. Browsers cannot execute local processes or provide a native PTY. TauriProcessHost is a STEP 6 deliverable, not a stub that pretends to execute. FakeProcessHost lives under `tests/helpers` and never enters application composition.

Runtime capability is explicit: supported browser filesystem access, unavailable process/PTY/Git. A Web Run validates the configuration, asks about dirty files, then reports `Local process execution requires the TASTEDEV Studio desktop runtime.` It never creates a Running session or sends a command to a server.

## Configuration and request

RunConfiguration stores `id/name/command/args/cwd/env/type`, isolated under `tastedev.studio.run.v1:<projectId>`. UI uses RunConfigurationService and ConfigurationRepository; only BrowserConfigurationRepository accesses localStorage through an injected storage provider. Invalid persisted data is not silently overwritten. Maximum 100 configurations per project.

The default launch contract is an executable plus argument array. Arguments are JSON strings in the form, preserving whitespace and shell metacharacters as individual argument data. No shell command concatenation, implicit shell mode or environment dump exists. cwd is a normalized workspace-relative path (`.` becomes the root); absolute paths and traversal are rejected. ProcessStartRequest carries projectId/workspaceId so a future native host can resolve authorized native cwd without inventing paths from a browser directory handle.

Environment is explicitly stored configuration, not an encrypted vault. Validation errors do not repeat entered environment values. Host failures are mapped to actionable generic messages rather than raw host exception text. Process-generated stdout/stderr is shown as output; a future adapter remains responsible for its own secret-handling policy.

## Lifecycle and events

RunService owns a current ProcessSession and separate Terminal/Output stores. IDs are allocated before launch. The host listener is registered before invoking start. Events carry sessionId and strictly increasing sequence numbers; foreign, duplicate and post-terminal events are ignored. `started/stdout/stderr/exited/failed/stopped` drive state and streaming.

States: idle (no current process), starting, running, stopping, exited, failed. Nonzero exit remains exited with its code and a visible failure explanation. Start/CWD failure becomes failed. Stop failure restores the prior active state and allows retry. Starting/stopping reject duplicate launches. Pending cwd validation observes cancellation before invoking start.

Host terminal events mean the process and native resources have been released. A future adapter must terminate its process before reporting terminal stream failure, cancel pending starts on stop, validate native containment/permissions, and implement process-tree termination. It must not report stopped merely because a signal was sent. Those OS guarantees are intentionally not implemented or claimed by the Web host.

RunService disposes subscriptions and stores on project unmount and requests host stop for an active session. STEP 6 must additionally define durable native cleanup/error reporting if the UI disappears. The current production Web host cannot leak a native process because it never starts one.

## Terminal and Output

`@xterm/xterm 6.0.0` with `@xterm/addon-fit 0.11.0` is client-loaded. TerminalCanvas is a presentation component: it receives a TerminalStore plus input/resize callbacks, never owns ProcessHost. One xterm instance survives React rerenders and bottom-tab/panel hiding. ResizeObserver/FitAddon forwards rows/columns; theme follows the shared root theme. Disposal clears observers, subscriptions, frames and xterm resources.

Interactive/PTY streams go to Terminal; non-interactive tasks and Studio messages go to Output. stdout/stderr remain tagged; stderr gets a distinct color/label. Process output is appended as events arrive, not buffered until exit. Each store retains at most 200,000 characters and 1,000 chunks; xterm scrollback is 2,000 lines. The renderer has at most one write in flight and a bounded pending buffer. Clear queues a reset after in-flight writes so previous output cannot reappear.

TerminalSession includes id/name/processSessionId/status/createdAt. One default Terminal is exposed. New/Close multiplexer UI is intentionally omitted; service-level close/stop/cleanup is tested and available for future UI.

## Dirty files

Run validates the configuration, then offers Save All and Run / Run Without Saving / Cancel. It reuses STEP 3 Documents and Save All. Save failure or edits arriving during save prevent launch. Without Saving preserves dirty buffers; Cancel performs no launch/save. In Web, either approved run choice ends with the unsupported runtime notice.

## Verification

61 native tests include existing 42 STEP 1–3 tests and 19 STEP 4 contracts/integrations: configuration CRUD/persistence/isolation, validation, lifecycle/streaming/exit/failure/stop, cancellation/deduplication, input/resize, output bounds, cleanup and dirty decisions. Native Node has no separate Debug/Release semantics; optimized browser verification is separate.

Production browser verifies real configuration CRUD, reload/isolation, unsupported status, xterm rendering/Clear/Focus/resize/themes, dirty Run choices, Monaco disk save, Manager return and 1920/1440/1366 layouts. The development-only `/verification/terminal` fixture verifies ANSI/stderr, multiline/2,500 lines, input and geometry with explicit fixture labels. Production returns 404 for this route. It contains no process host or executable launch.

Evidence: `TASTEDEV/resources/verification/dev-01/tasks/tastedev-studio/step-4-20260929`.

References: [xterm installation](https://xtermjs.org/docs/guides/download/), [official addon integration](https://xtermjs.org/docs/guides/using-addons/). Exact installed versions are pinned in package.json and pnpm-lock.yaml.
