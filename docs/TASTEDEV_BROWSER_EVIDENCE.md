# TASTEDEV Browser Testing and Evidence — STEP11

## STEP11 acceptance — 2026-09-30

STEP 11 PASS — STEP 12 착수 가능. Node264 distinct + Runner2; Rust Debug18/Release18; actual Chromium/Agent Browser6 groups, legacy Agent11 and Pipeline14 distinct groups; artifact integrity/sanitization and production GUI PASS. Final Web build OHcgxvcH8WgtoEaRSzBQv; Agent/Web/Desktop no-bundle builds PASS. UI reviewer resolved its one spacing finding and returned ship. Exact scope, gate reuse and limitations: workspace resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930/RESULT.md. STEP12 NOT_STARTED.

## Current scope

The existing TestPlan, Queue, Matcher, Run and RunStep execute browser tests on a separate Rust Agent. Studio and Core never launch the test browser. STEP12 AI analysis/development is not implemented. The acceptance record is under `resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930` in the workspace.

## Architecture

`.tastedev/tests.yml → resolveTestPlan → existing Queue/Matcher → Rust Agent → Node Playwright Test process → Reporter → authenticated HTTP binary upload → LocalArtifactStore → existing Artifact metadata → Studio Evidence Viewer`.

`browser-runner` is a separate deployable source package. It pins **@playwright/test 1.62.1** and **fflate 0.8.2** in its own package-lock. It uses official Playwright Test CLI, project configuration and custom Reporter APIs. It does not implement another browser action DSL. Existing Playwright tests continue importing `@playwright/test` and using page/locator/assertion APIs. The runner installation must be shipped with the Agent by shared deployment tooling.

Official API references: [Reporters](https://playwright.dev/docs/test-reporters), [Test isolation and fixtures](https://playwright.dev/docs/test-fixtures), [Use options](https://playwright.dev/docs/test-use-options).

## Configuration and capability

Set `TASTEDEV_BROWSER_RUNNER` on the Agent process to the absolute path of the installed `browser-runner/run.cjs`. Install the runner's locked dependencies and its corresponding Playwright Chromium on that Agent. These are not Core/Studio browser dependencies. Ordinary Node unit tests and nonbrowser Agents do not require them.

Agent registration probes the configured runner by actually launching and closing Chromium. Only a successful probe adds `chromium` to browsers and the detected Playwright version to runtimes. A stale capability can still encounter a later execution failure; unavailable browser/runner Agents are normally filtered before assignment. The real DEV-01 probe reported Playwright **1.62.1**, Chromium **151.0.7922.34**. Versions are observations, not hard-coded capability claims.

```yaml
# .tastedev/tests.yml
login:
  type: e2e
  task: browser
  timeout: 180
  browser:
    engine: playwright
    baseUrl: http://127.0.0.1:3000
    config: playwright.config.ts
  pipeline:
    install: install
    build: build
    start: serve
  healthcheck:
    url: http://127.0.0.1:3000/health
    timeout: 30
```

`browser` is optional and valid only for `browser`/`e2e` definitions. The default configuration filename is `playwright.config.ts`; paths must be relative and traversal-free. Base URL currently uses the same credential-free loopback HTTP boundary as health checks. Project tests are executable trusted project code and can independently navigate other URLs; baseUrl validation is not network sandboxing.

The referenced Task still supplies cwd, resolved environment, requirements and timeout. When `browser` is present, the browser adapter selects the official runner/configuration instead of executing that Task's executable/args. Define test selection in the project Playwright configuration. Install/build/start/cleanup tasks remain ordinary structured commands. Without `browser`, existing STEP9/10 task/test behavior is unchanged, including legacy browser/e2e labels.

Browser plans intersect existing requirements with Node >=24, Playwright >=1.62.1 and Chromium. Project requirements cannot silently weaken these. A browser requirement does not propagate to unrelated unit tests.

## Pipeline and isolation

Source → optional Install/Build/Start/Health → Browser Test → existing Cleanup. Evidence collection and upload happen inside the Browser Test step before it returns. There is no separate browser orchestrator.

The runner creates a unique generated configuration in the run's project directory, a unique output/evidence directory, and executes the project's Playwright configuration. The adapter forces Chromium, one worker, no retries, headless mode, no restored storageState, screenshot-on-failure, tracing on during execution and video off. Playwright's default isolated test context separates cookies/localStorage/sessionStorage. Projects deliberately creating persistent contexts or shared external state remain responsible for that custom code.

Service/runner/browser processes are descendants of the existing Agent process-tree owner. Windows Job Objects bound the complete descendant tree. Context and browser close normally via Playwright; timeout/cancel/crash use the same STEP10 tree termination. Cleanup stops the service and still runs project cleanup. Temporary generated configuration is removed on normal runner exit; forced termination can leave files in that isolated run workspace. No workspace-retention daemon is claimed.

## Evidence and report

The Reporter records total/passed/failed/skipped/duration, failed test name/message/stack/location, real browser and Playwright versions, console/page/network counts and evidence warnings. Environment context is connected through existing Run → Agent OS/architecture/runtime capabilities and source revision. Full environment variables are not reported.

- Failure screenshots are real PNG attachments from Playwright Test.
- Console warnings/errors, page errors and failed/HTTP-error requests are extracted from the recorded trace. Method, sanitized URL, status and failure text are retained; response bodies are not uploaded.
- Test Report is bounded JSON, including structured failure details.
- Failure trace is retained as a sanitized ZIP. Successful traces are only used to extract text evidence and are not transferred.
- Trace sources and nonvisual network response bodies are omitted. JSON lines are sanitized while preserving collection types such as headers/cookies. Image resources can contain visual secrets; no OCR/redaction guarantee exists.
- Explicit screenshots attached as PNG by existing Playwright tests can be collected on failed tests.

Text entries are bounded (500 when serialized, 8,000 characters per string; UI shows up to 200 entries / 64 KiB text). ZIP expanded-size processing is bounded to 64 MiB. Trace event compatibility is version-sensitive and tied to the pinned Playwright version; upgrading it requires runner/evidence regression tests.

## Failure and completion policy

Execution status and evidence infrastructure warnings are separate. A failed assertion/navigation/selector retains its Playwright message and stack as the primary failure; evidence generation/transfer failures do not replace it. A runner that exits without a final report is classified `RUNNER_FAILED`; timeout/cancel have explicit fallback classifications and partial-evidence warnings. Page errors and network errors are observations; they do not automatically turn a passing project assertion into a failed test.

RunStep results arrive after the runner's bounded upload attempts. Core only publishes Artifact metadata after complete verified storage. A successful test can have incomplete evidence, shown as warnings; required report/failure screenshot policy is visible operational evidence completeness rather than a fabricated test failure. Interrupted runs can expose only artifacts already committed; they never show pending bytes as completed artifacts. Browser startup/configuration/runner failures may have no screenshot because no page existed.

STEP10 dependency skip, original primary failure, separate cleanup warning, overall timeout and bounded cleanup allowance remain authoritative. ANSI control sequences/newlines are normalized for the short Run summary, while structured report detail remains readable.

## Artifact Store and identity

`ArtifactStore` is an interface; `LocalArtifactStore` is the first implementation. An artifact has UUID identity, runId/runStepId, type, display filename, MIME, size, SHA-256, createdAt and opaque HTTP location. Project/Test associations are resolved through the existing Run/Job/TestPlan chain. Filename is not the storage key.

Default storage is workspace `resources/artifacts/tastedev-studio`; `CORE_ARTIFACT_ROOT` overrides it. Core memory metadata and binary storage are distinct. Files and sidecars persist on disk, but the current Core does not reconstruct Run history after restart. Studio history browsing is guaranteed for the current Core session; retained sidecars support controlled read/delete via known identity, not automatic historical reindexing.

Storage uses run/artifact UUID paths, rejects invalid IDs and links in existing ancestors, validates display filenames and MIME/type, writes an exclusive partial file, checks size/checksum, then commits bytes and metadata. Duplicate names are harmless; repeated identical Artifact IDs validate the bytes and reuse the saved record. Conflicting IDs fail. Interrupted transfers remove their partial file. External filesystem mutation and crash-time orphan recovery require operational cleanup; this is not an OS security sandbox or a transactional database.

Limits: **32 MiB/artifact, 40 artifacts/run, 128 MiB/run, 1 GiB/store**. Storage rejects new artifacts at capacity. No background max-age deletion exists. Authenticated `DELETE /artifacts/{runId}/{artifactId}` is the manual cleanup foundation; it validates project ownership and removes only the identified artifact. Never delete an arbitrary caller-provided path.

## Transfer and access

Core includes a short-lived, run/step-scoped upload grant in the structured browser operation. Agent-owned Runner sends each binary in an HTTP PUT; it does not put bulk base64 into the WebSocket message. Headers carry type/name/size/checksum. At most two attempts occur per artifact, each with a 10-second deadline; maximum 40 attachments are attempted. Total step/run deadlines still apply. Local generation failure, upload failure and integrity rejection remain warnings.

Upload grants require the owning step to remain running and are revoked on its result. They expire after a bounded interval. Configure `CORE_ARTIFACT_BASE_URL` for remote Agents; default is loopback with the Core port. Use HTTPS and the existing explicit LAN deployment policy for remote production operation. The runner does not follow upload redirects.

Studio fetches artifact bytes with its configured Studio bearer token and project header, verifies size and SHA-256 again, then creates a temporary Blob URL. No token is placed in a download URL, no local filesystem path is sent to the viewer, and unrelated origins are denied. Existing Studio token is a trusted Core-wide credential, not a new multi-user RBAC system.

## Sanitization

Text evidence masks explicit resolved environment values and common authorization/password/token/secret/API-key fields. URL credentials, queries and fragments are removed/redacted; headers/cookies and post bodies are excluded. Trace JSON and Console/Network/Report output use the same sanitizer. Original raw Playwright outputs can remain in the trusted Agent's isolated workspace; only sanitized output is transferred. Screenshot/visual-frame secrets are not detected automatically. Dummy credentials only were used in verification.

## Studio viewer

Run detail shows failed step/test/message, screenshot/console/page-error/network/trace counts and browser versions. Evidence table identifies stage, time and size. Selecting a screenshot loads and verifies it once, with full-image open/export. Console has error/warning filtering; page errors/report are bounded structured text; failed network requests have a table. Trace export opens the standard local Playwright `show-trace` workflow; Studio does not reimplement that viewer or upload traces to an external service.

Loading/error/retry/empty states are provided. Unselected binaries are not downloaded. Changing selection/unmount revokes temporary Blob URLs. Retry creates a new Job/Run and keeps old evidence; verified with a new Git revision changing the failed fixture to PASS.

## Verification and limitations

Real separate Windows Rust Agent + Chromium success, assertion failure, navigation failure, timeout/cancel, six artifact types, checksums, dummy secret masking and real production Studio screenshot/trace flow are recorded. Existing Node, Agent and pipeline regressions remain separate evidence categories. Native OS save/installed QA and Unix browser-process behavior were not newly qualified.

Intentional limits: Chromium only; loopback HTTP baseUrl; pinned Playwright trace format; no video; no durable Core Run history/restart pipeline resume; bounded nondurable logs; no automatic workspace/store age retention, remote object storage, screenshot secret detection, AI analysis/fix, issue automation, scheduler, PostgreSQL or Redis. STEP12 is NOT_STARTED.
