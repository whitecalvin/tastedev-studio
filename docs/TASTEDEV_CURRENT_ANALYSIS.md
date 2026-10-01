# TASTEDEV Studio 현재 분석

## 고도화 2단계 — 2026-10-01

Core Service Runtime 애플리케이션 기능과 실제 Windows foreground 검증 완료. strict 설정/OS별 절대 데이터·로그 경로, legacy DB 명시적 선택, 마스킹 JSON 로그/회전, liveness/readiness/version, 정상 종료/한계시간, start/health/stop CLI와 configured backup을 구현했다. 실제 Rust Agent 작업 PASS 및 정상 종료 후 cancelled Run 복원, Studio 연결과 Core 수명 분리, port/config/DB 실패 nonzero, 반복 restart/orphan0을 확인했다.

고유 Node440건 유효 PASS(첫430/431 + 실패1 재개 + 기존 Native8 보존·검증 + 신규 legacy1), 전체/변경 범위 lint·typecheck PASS. Web/Rust/Tauri 입력은 이번 작업에서 바뀌지 않아 재빌드하지 않았다. 실제 서비스 설치·제한 계정·Linux runtime은 미검증이며 단계 전체는 PARTIAL이다. 이전 NOT_STARTED 또는 memory-only 기록은 역사적 상태다.

[운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-service-runtime-20261001/README.md) · [검증 결과](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-2/RESULT.md)

고도화 2단계 PARTIAL — 실제 서비스 및 제한 계정 검증 대기

## 고도화 1단계 — 2026-10-01

Core 영속화·장애 복구를 완료했다. Remote Core 기본 저장소는 Node 24 내장 SQLite이며 Queue/Job/Run/Step, logs/sequence, Schedule/Protocol/trigger history, AI Analysis/FixAttempt/Approval, Issue Candidate/Link를 복원한다. Evidence body는 기존 파일 저장소, DB는 참조·체크섬을 유지한다. 결과 커밋 후 ACK, crash gap의 idempotent Job identity, unknown Agent claim 격리, DPAPI 저장 키, offline backup/restore를 구현했다. 아래의 memory-only/session-only 설명은 이전 단계의 역사적 상태다. 미연결 local foundation은 여전히 메모리 모드다.

검증: 고유 Node 426건 PASS(전체 421/422 + 실패1 재검증 + 신규4; 관련20 재검증), lint/typecheck/Web production build PASS, 실제 Rust Agent 복구4개 PASS, Core+Studio 재시작 GUI/Monaco Diff PASS. 실제 Source 변경0/동일 execution 중복0/이력 유실0/소유 orphan0. Windows DEV-01만 실제 확인했으며 서비스 설치·Linux 런타임·제품 패키징 결과를 뜻하지 않는다.

[저장·복구 운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


## Multilingual UI — 2026-09-30

Implemented the same 10 languages as tastedev-web: Korean, English, German, Spanish, French, Italian, Brazilian Portuguese, Japanese, Simplified Chinese and Traditional Chinese. Default follows the system/browser language; unavailable or unsupported languages fall back to English. Manual selection persists, supports cross-tab synchronization and can return to System language.

Application-owned Project Manager, Workspace, Explorer/editor guidance, Process, Git, Core, Protocol, AI, Issues and Scheduler UI use shared catalogs. Language changes preserve project data, form values and dirty Monaco models. Source, user data, terminal/test logs and AI output keep their original content.

Verification: Node393/393 PASS once; after subsequent catalog/UI changes, affected i18n8/8 PASS and unchanged385 reused. Full lint, typecheck and production build PASS; final build GnpI9Lv0-aYxoPUb7tMNb includes TypeScript validation. Production GUI27 checks plus final10 locale cases PASS; unexpected frontend errors0, controlled source writes0. No duplicate unaffected build/test gates. Native/Rust inputs unchanged; native installed/OS-language QA was not run.

Remaining limits: Monaco built-in third-party menus remain English; unknown external diagnostics fall back to their original English; native-speaker editorial review is pending. These do not change prior phase acceptance.

[Result and evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/i18n-20260930/RESULT.md) · [I18N guide](../../../../resources/guides/dev-01/tastedev-studio/i18n-20260930/I18N.md)


## STEP15 final acceptance — 2026-09-30

**STEP 15 PASS — TASTEDEV Studio Phase 1 목표 시스템 완료**. Schedule/Trigger/TriggerEvent/ScheduleRun Domain, Core ScheduleService and replaceable repository, cron-parser5.10.1, explicit timezone, Manual/Cron/Interval/one-time Trigger, existing Protocol TestPlan/Queue/Matcher/Rust Agent reuse, overlap/dedup/missed/capacity safeguards, notification events and Scheduler GUI are implemented.

Actual production GUI created/edited/enabled/disabled schedules and exercised Run Now. Real Rust Agent completed manual PASS and wall-clock one-time PASS, plus controlled FAIL. Failed Run/Step/log evidence produced an Issue Candidate; automatic AI/Patch/GitHub/commit/push counts0. Time-trigger lateness 473ms. Core restart restored3 disabled definitions; session history is not persisted. Verification schedules disabled, test processes stopped, owned orphans0.

Node385/385 (Scheduler23 included), lint/typecheck/production build PASS. An actual GUI save exposed an optional-ID serialization issue; UI-only correction was validated with scoped lint, typecheck and updated production build. Unaffected385 tests reused, no duplicate full run. Unchanged native input/binary hashes verified; no Rust/Tauri rebuild or installed/Unix retest. Light/Dark GUI errors0.

Limits: Core must stay alive; definitions are file-backed, Run/history and registered saved Protocol are memory-only. After Core restart explicit saved-Protocol sync is required before enabled definitions execute. Missed times skip; no backlog. Same Project/Test queued/active overlap skips. Cron/interval minimum60s; global active Job cap16; at most100 schedules. Git/external/dependency/OS event adapters are foundation only. No auto analysis or external writes. Current contract: [Scheduler](TASTEDEV_SCHEDULER.md). Parent workspace evidence: resources/verification/dev-01/tasks/tastedev-studio/step-15-20260930/RESULT.md and EVIDENCE-INDEX.md. Earlier status statements are historical.


## STEP14 final acceptance — 2026-09-30

**STEP 14 PASS — STEP 15 착수 가능**. STEP15 NOT_STARTED. Independent Issue Domain/IssueService/IssueProvider, authoritative Run/Log Candidate Builder, optional AI/FixAttempt mapping, secret/local-path masking, Core-only GitHub authentication, repository validation, duplicate search, editable review, scoped explicit approval, guarded creation/reconciliation, existing Issue link and Issues GUI are implemented.

Actual GitHub E2E created exactly one explicitly approved TEST Issue: [whitecalvin/tastedev-studio #1](https://github.com/whitecalvin/tastedev-studio/issues/1). Exact approved body readback, actual duplicate search and existing link passed; repeated create and existing link performed no additional POST. Close/comment/automatic labels/commit/push were not performed. The TEST Issue remains open with the agreed title marker.

Node362/362 (Issue33 included), lint/typecheck/Web production build PASS. Production GUI Light/Dark verifies edit/masking/plain-text rendering, Cancel with zero writes, explicit fixture create, linked state, existing link and dismissal; page errors0. GUI uses TEST ONLY FakeIssueProvider and is distinct from actual GitHub provider evidence. Successful gates were reused without duplicate builds/tests. Unchanged Agent/Tauri input hashes and Agent binary were verified against STEP13; no native rebuild, installed QA or Unix retest claimed.

Limits: memory-only candidates/links/approvals/search cache; no restart durability. Uncertain POST blocks retries and supports marker reconciliation in the current session; reconciliation examines the newest100 Issues. Duplicate suggestions use bounded keyword search and may miss semantic matches. Core uses existing gh managed keyring or a Core-only token; remoteCore requires its own login. Evidence links are internal references, not public downloads. No automatic close/comment, PR, scheduler or cloud sync.

Current contract: [Issue Integration](TASTEDEV_ISSUE_INTEGRATION.md). Final result and index: parent workspace resources/verification/dev-01/tasks/tastedev-studio/step-14-20260930/RESULT.md and EVIDENCE-INDEX.md. Earlier NOT_STARTED statements are historical.


## STEP13 final acceptance — 2026-09-30

**STEP 13 PASS — STEP 14 착수 가능**. STEP14 NOT_STARTED. Approval-bound structured Patch, dirty/base/user-change protection, compensating multi-file rollback, Protocol validation, secret-filtered Workspace Snapshot, existing Core/Rust Agent retest and session FixAttempt/history/retry cap are implemented. Actual managed ChatGPT Pro gpt-6.1-sol generated the disposable service.cjs fix; explicit human approval preceded the real disk patch. Local assertion and real release Rust Agent retest PASSED, then exact source restoration preserved prior user changes. A separate synthetic wrong proposal used a real Agent FAIL to qualify failure-history/recovery; GUI Provider fixture is not counted as actual AI.

Final Node329/329, Rust Debug21/Release21, lint/typecheck/fmt/Clippy/Agent release/Web production build PASS. Production GUI validates Cancel/Apply/Diff/Protocol retest/History/Revert/Reject in Light/Dark; current unexpected page errors0. Multi-file actual disk failure/concurrent protection, masking/path/scope/retry/integrity regressions and owned-process cleanup PASS. Native local-validation/Git button manual checks, installed QA and Unix were not rerun; no Native source changed. Node has no meaningful separate optimized unit configuration; production GUI/build is the distinct production gate.

Limits: session-only attempts/Core state, text Snapshot100 files/24KiB/60KB serialized RPC; no Secret Injection; redacted file proposals rejected rather than overwriting secret placeholders. No automatic commit/push, packaging/install/deploy or STEP14 work. Actual patch approval covers the reviewed disposable file only, not future proposals. Final report distinguishes implementation, automated tests, actual Provider/Agent and unverified Native paths.

Final evidence: `resources/verification/dev-01/tasks/tastedev-studio/step-13-20260930/RESULT.md`, `EVIDENCE-INDEX.md`, `manifest.json`, `source-inputs.json` under the parent TASTEDEV workspace. [AI Fix Loop](TASTEDEV_AI_FIX_LOOP.md) specifies the current contract. Earlier STEP12/13 NOT_STARTED and no-write statements below are historical snapshots superseded by this section. The model-facing AIService remains read-only; approved write/validation actions are application-mediated.


## STEP12 final acceptance — 2026-09-30

STEP 12 PASS — STEP 13 착수 가능. STEP13 NOT_STARTED.

Read-only AI Development, Failure Analysis, grounded candidates/source links, proposals and Monaco Diff are implemented. Explicit user approval preceded STEP12B actual Codex Pro transmission. Actual gpt-6.1-sol failure analysis completed with 11 unique read-only calls; masking/injection/grounding checks, unchanged source readback and production GUI passed. Actual Development evidence reused. No application source changes in STEP12B; existing Node306, scoped50/44, lint/typecheck/production build evidence retained. Session history and screenshot metadata limitations remain; no patch/apply/test/dispatch authority. No native packaging, deployment, commit or push.

Final evidence: parent workspace resources/verification/dev-01/tasks/tastedev-studio/step-12b-20260930/RESULT.md and EVIDENCE-INDEX.md. Earlier STEP11/STEP12 status paragraphs below are historical snapshots superseded by this entry.

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

## STEP 9 TASTEDEV Protocol v1 — 2026-09-30 (current)

.tastedev/project.yml 진입점과 optional environments/tasks/tests.yml을 기존 FileSystemHost로 읽어 strict YAML/schema validation 후 Protocol Domain으로 변환한다. js-yaml4.3.2는 기존 transitive dependency를 직접 의존성으로 재사용했다. Unknown field·잘못된 version/type/reference/command/args/cwd/env/timeout/requirements를 거부하고 file/path/message를 표시한다.

Project→Task→Test requirement override와 base→profile→Task environment merge를 적용해 기존 CreateJob/Queue/Matcher를 재사용한다. Agent에 Project별 로직은 없다. Task/Test는 단일 executable+args 명령이며 timeout은1–3600초다. 정확한 스키마와 false/internal-null 해제 규칙은 [Protocol 문서](TASTEDEV_PROTOCOL.md)를 따른다.

Run/Tests의 작은 패널과 status bar에 Not Configured/Valid/Invalid를 표시한다. Initialize는 안전한 project.yml만 생성하며 명령을 만들지 않는다. Monaco 저장 후 자동 재검증, 수동 Reload 및 queue 직전 fresh load를 수행한다. Dirty Protocol은 queue를 막고 실행은 Queue/Assign 사용자 동작으로만 진행한다. .tastedev 없는 프로젝트의 일반 IDE 사용은 독립적이다.

Protocol80 + 기존139 =219개 적용 테스트 근거가 있으며, 최종 lint/typecheck/Web/Desktop no-bundle build와 production actual Agent GUI E2E가 PASS다. Agent Debug12/Release12/fmt/Clippy/release는 입력·도구체인·binary·기존 증거 hash 검증 후 재사용했다. 독립 UI review는 production8개 화면에서 ship이다. **STEP9 PASS — STEP10 착수 가능, NOT_STARTED**. [STEP9 evidence](../../../../resources/design/tastedev-studio-step9/EVIDENCE.md) 및 root task RESULT/checkpoint가 최종 판정 기준이다. 새로운 Native UI·설치본 QA·Unix·배포 검증을 의미하지 않는다. STEP10은 NOT_STARTED다.

Agent의 fresh run directory는 source checkout/copy를 제공하지 않으며 OS sandbox도 아니다. DB/Redis, pipeline/DAG, test engines, artifact store, Secret Manager, AI와 Scheduler는 제외한다.

## Historical STEP8 implementation record

아래 STEP8의 STEP9 미구현/미착수 표현은 당시 기록이며 현재 상태는 위 설명이 우선한다.

## STEP 8 Agent Runtime — 2026-09-30 (current)

Standalone Rust Agent와 인증된 WebSocket Core를 연결했다. Agents / Queue / Runs의 승인안 B를 유지하며 실제 Agent 등록·heartbeat·capability, 수동 배정, 단일 명령 실행, stdout/stderr, 성공·실패·timeout·취소와 재접속 결과 반영을 제공한다. production fake 기본 데이터는 없다.

Remote 모드의 Agent·Job·Run·event는 **Core 서버 메모리**에 있다. 브라우저 새로고침 후 Core에 다시 연결하면 서버 상태를 읽으며, Core 재시작 시 기록과 queue가 사라진다. 연결 endpoint/token은 브라우저에 영속 저장하지 않는다. 미연결 local foundation 모드만 기존 브라우저 세션 메모리를 사용한다. Agent의 identity/claim/terminal acknowledgement 파일은 별도로 남지만 Core DB 복구를 대신하지 않는다.

[Core architecture](TASTEDEV_CORE_ARCHITECTURE.md), [Agent architecture and setup](TASTEDEV_AGENT_ARCHITECTURE.md), [STEP8 evidence](../../../../resources/design/tastedev-studio-step8/EVIDENCE.md)를 따른다. 실제 Windows Agent E2E와 production Web GUI 검증은 PASS, 독립 시각 검토는 log 재촬영 후 ship이다. 최종 소스의 Web·Agent Release·Desktop no-bundle 빌드와 production smoke까지 PASS다. task RESULT/checkpoint/manifest에 증거와 산출물 해시를 기록했다. STEP 8 PASS이며 STEP9는 준비 완료, NOT_STARTED다.

DB/Redis·durable queue·revision/source 배포·artifact upload/download·DAG·Scheduler·AI와 STEP9은 미구현이다. Windows Agent 검증과 Web GUI 증거를 설치 패키지/Native UI 재검증으로 해석하지 않는다. STEP6 역사적 오류1건은 unresolved/non-blocking, 125% DPI는 untested/non-blocking으로 보존한다.

## Historical STEP 7 Core Foundation

아래 STEP7 기록의 session-only/reload reset 및 STEP8 NOT_STARTED는 당시 상태다. 현재 Remote 모드는 위 STEP8 설명이 우선한다.

## STEP 7 Core Foundation — 2026-09-30

Core Foundation 구현을 추가했다. 현재 저장소는 **세션 전용 InMemoryCoreRepository**이며 새로고침하면 Agent·Job·Run·Artifact·event 기록이 초기화된다. 기존 ProjectService의 Project를 비동기 Registry로 조회하고, Project별 Job/Run을 분리한다. 이는 사용자 인증이나 서버 권한 검증이 아니다.

Agents / Queue / Runs를 독립 Activity 아이콘으로 제공하는 승인안 B를 적용했다. 기존 로컬 RunService, Explorer, Monaco, Terminal, Git과 패널 구조는 유지한다. Agent 등록은 offline metadata이며 실제 연결·heartbeat가 아니다. Dispatch는 호환 Agent 예약과 pending Run 생성까지만 수행하고 명령을 실행하지 않는다.

**STEP7 PASS — STEP8 ready but NOT_STARTED.** Core31 and existing102 are nonoverlapping shards (133 passed). Final lint/typecheck and local Web production build passed; build ID `wwU_45M-WAkEKjRNimJi8`. Production Headless Chromium verified actual OPFS handle restore, Explorer/Monaco editing, dirty-buffer preservation across Agents/Queue/Runs, Save with independent OPFS readback, offline registration/no fake defaults, existing Project-backed Job creation/cancellation, project B isolation/global Agent retention, reload session reset and `/verification/core` 404. `pageErrors: []`. This is isolated OPFS browser storage, not Native/OS folder evidence. Harness selector/EditContext/render timing corrections required no app changes or rebuild. Thirteen Native/Rust input hashes match STEP6E; no new native/package QA was performed. [Core architecture](TASTEDEV_CORE_ARCHITECTURE.md)와 [STEP7 evidence](../../../../resources/design/tastedev-studio-step7/EVIDENCE.md)를 따른다.

원격 Agent, 네트워크 API/transport, heartbeat, DB/Redis, 영속 복구, AI, Scheduler 및 STEP8은 미구현·미착수다. Rust/native 입력은 변경하지 않았고 새 native 실행 증거도 없다. 기존 STEP6E의 역사적 오류1건 Non-blocking 및 125% DPI 미검증 범위는 아래 원문대로 보존한다.

## Historical STEP 6 / 6E acceptance — 2026-09-30

**STEP 6 PASS** under the user's STEP6E acceptance criteria. STEP 7 is **NOT_STARTED**. Historical event `1790699936279 frontend error` remains **HISTORICAL_UNRESOLVED / NOT_REPRODUCED / Root Cause UNKNOWN / Non-blocking**. It is not deleted, normalised or falsely marked resolved. Its original message, stack, component, route, precise runtime context and triggering action remain unknown; a coarse production-session association is not a recovered exception context.

- STEP6E repairs the diagnostic information gap, not a speculative cause of the historical event. Next instrumentation-client installs before hydration; window.error, unhandledrejection, console Error objects, route/root React error boundaries and Tauri frontend invoke/event failures share a bounded local recorder.
- Records include timestamp, level, source, sanitized message, available stack frames, safe route category, Web/Tauri runtime, application version and platform. Console arguments, arbitrary IPC objects, file contents, environment and credential objects are never serialized; recognized secrets/quoted values/paths/URLs are redacted. Project identity and user action payloads are omitted.
- Real controlled browser throw and Promise rejection, actual Next/React boundary → diagnostic capture → recovery UI → Retry **PASS**. Controlled records use a separate key and `TEST/CONTROLLED` category; they are excluded from product audits. See [controlled evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/controlled-browser.json).
- Current STEP6E production Web manager smoke: unexpected frontend **0**. Last actual Native STEP6D observation: unexpected frontend/native/panic/cleanup **0/0/0/0**. These are separate observations, not a newly repeated Native gate. Historical unresolved frontend events remain **1**, current product blockers **0**. [Audit](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/error-audit.json).
- This change ran **Node102/102, lint, typecheck, Web production build**, controlled browser tests and the new-build Web smoke. JS has no separate Debug/Release test configuration. Rust source/dependencies/config did not change; prior Debug9/Release9/Clippy and actual Native functionality evidence remain scoped to those unchanged components.
- Native filesystem/Monaco/PTY/process/Git/restart, actual 1920/1440/1366 clients, Light/Dark, Windows100%/150%, Missing Project recovery and corrected Native copy retain PASS evidence. **125% DPI remains untested and non-blocking**.
- No Rust/Tauri rebuild or reinstall was requested for this frontend-only diagnostic closeout. Existing STEP6C EXE/installer **do not contain STEP6E diagnostic changes**. A future desktop package must regenerate its frontend export and embedded application; old desktop-export hashes are not current-source build proof. Prior STEP6B installation evidence remains tied to that older artifact.

[Final result](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/RESULT.md) · [STEP6–6E evidence index](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/EVIDENCE-INDEX.md) · [diagnostic gap and storage](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/DIAGNOSTICS.md). No STEP7, CI, QA-01, deployment, source commit or push.

## Historical STEP 1–5 baseline

The following sections record the state at their original STEP completion. Statements about native hosts being absent or STEP 6 not started are historical, superseded by the current status above and [Desktop Runtime](TASTEDEV_DESKTOP_RUNTIME.md).


## 기준

2026-09-29, STEP 5 Web Git/Source Control foundation 구현·검증 기준. STEP 1/2 기반을 확장했다. 실제 소스가 문서보다 우선한다. 일반 Chrome에서 사용자가 직접 폴더를 연결한 뒤 실제 Monaco 편집·저장과 디스크 재읽기를 확인했다. 운영 배포나 QA-01 합격을 의미하지 않는다.

## 구조

```text
src/app/                         Next App Router, Manager and project route
src/components/ui/              Manager AppShell, shared theme, native dialog
src/features/projects/          Project model/service/repository, Manager/forms
src/features/workspace/         Workspace Shell, activity registry, UI reducer/Context
src/features/filesystem/
  contracts.ts                  FileSystemHost, independent entry/connection types
  paths.ts                      relative path/name validation, ignore policy
  web-host.ts                   File System Access API adapter
  handle-store.ts               IndexedDB runtime-handle storage
  file-service.ts               WorkspaceFileService and folder/project orchestration
  browser.ts                    browser host composition
  explorer.tsx                  lazy tree and file actions
src/features/editor/
  documents.ts                  document store and dirty/save/close contracts
  policy.ts                     language, UTF-8/binary/size rules
  session.tsx                   filesystem/document session, dialogs, guards, shortcuts
  editor-area.tsx               tabs and editor controls
  monaco-editor.tsx             client-only Monaco and model lifecycle
src/styles/                     shared theme, workspace and filesystem/editor styles
scripts/prepare-monaco.mjs       pinned package's same-origin worker assets
```

Filesystem execution: **UI → WorkspaceFileService → FileSystemHost → Browser File System Access API**. UI components do not use browser handle APIs. Runtime handles stay inside the adapter/store. No shell fallback, server filesystem endpoint, Tauri, Rust or Core was added.

Project metadata remains **UI → ProjectService → ProjectRepository → localStorage**. A browser-folder project has `workspacePath: null` and `browserFolder: true`; no absolute path is fabricated. Existing absolute-path metadata remains readable. Handles are associated with project ID in IndexedDB and compared with `isSameEntry` when opening an already-known folder. A browser cannot infer equivalence to an arbitrary previously typed absolute path.

## Stack and scripts

Existing Node 24.11.1 / pnpm 11.19.0 / Next 16.3.7 / React 19.3.0 / TypeScript 5.9.3 / Tailwind 4.3.3 / HeroUI 3.2.6 / Lucide 1.48.0 retained. Added **monaco-editor 0.57.0**, exact-pinned; no React Monaco wrapper, editor alternatives, state library or filesystem library added.

Monaco uses one ESM integration, loaded only when documents are open through a client-only dynamic component. The package's matching prebuilt workers are copied to ignored `public/monaco/<version>` by the dev/build script, then loaded from the same origin. No CDN or deprecated AMD loader is used. `getWorker` and the pinned release's worker-ready handshake are configured explicitly. Version upgrades must revalidate the worker bundle naming/handshake.

Scripts: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm start`. Dev/build prepare Monaco worker assets first. The authoritative dependency versions are package.json and pnpm-lock.yaml.

## Explorer and file operations

- Connect Folder / Open Project invokes the native Directory Picker under user activation. Supported secure Chromium contexts request read/write access.
- Permission states: granted, prompt, denied, unavailable. UI distinguishes Connected / Access Required / Permission Denied / Unsupported and offers reconnect/request access.
- Root and expanded directories load lazily; files are read only when opened. No whole-repository preload.
- Default hidden display names: node_modules, .next, .git, dist, build. A checkbox reveals them; the display filter does not modify disk.
- Tree supports selection, expand/collapse, keyboard arrows/Home/End/Enter, root/expanded/selected-directory refresh, names truncated visually with full path titles.
- File/folder create validates a single name, relative containment and destination conflicts. Root rename/delete and traversal/absolute injection are rejected at service and host layers.
- Rename is a bounded browser fallback: copy, compare bytes, revalidate original listing/content, then remove source. Limit: 1,000 entries / 50 MiB. It is not an atomic OS rename. On failure, original plus possible destination copy remain and the UI reports partial completion. External concurrent writes cannot be locked by this API and must be avoided during rename.
- Delete always requires explicit confirmation including open/dirty document counts. Success updates editor and explorer state. This is permanent deletion, not a recycle bin.
- Async action locking and visible loading/error messages prevent duplicate UI actions. Browser APIs do not provide atomic exclusive creation across unrelated applications; external races are a runtime limitation.

## Editor

Document fields: id/path/name/content/savedContent/language. Opened documents are separate from layout preferences and runtime handles. Normalized duplicate paths activate the existing tab. Monaco models and view states survive ordinary tab switching; removed models are disposed.

Dirty is content versus savedContent; reverting content clears it. Ctrl+S and Save save the active document. Save All reports each failure and retains failed documents. A save updates savedContent only after the host stream closes successfully. Before writing, disk content is compared with savedContent to reject external changes; this is a conflict check, not a cross-process atomic lock.

Clean close is immediate. Dirty close offers Save / Don't Save / Cancel. Session guards protect Manager/project links, connection changes/disconnect, same-document history navigation and browser unload as far as browser behavior permits. Delete reports discarded edits. Reload from disk never silently replaces a dirty document and requires explicit discard confirmation. No watcher or automatic source-content persistence exists.

Text policy: UTF-8 only, preserve BOM in document content, 2 MiB maximum, listed binary extensions plus NUL/invalid UTF-8 rejected before editing. Contents are never truncated to fit. Language mapping covers all requested extensions; unknown uses plaintext. Light/Dark follows the shared theme via a root attribute observer. Defaults: 13px Consolas, line numbers, minimap off, wrap off, tab size 2, automatic layout and bracket pairs on.

## State and prior functionality

Workspace UI remains useReducer/Context with project-specific versioned layout preferences. Theme remains application-wide. Filesystem session uses WorkspaceFileService plus connection/error/busy state. Editor documents use a typed observable store consumed through useSyncExternalStore; no new state dependency. File content is not stored in localStorage, IndexedDB, a server or DB.

Manager metadata create/search/recent/open and unsupported Git clone remain. Nine activities, three panels, six bottom tabs, resize, keyboard toggles and layout persistence remain. Search, AI, Agent, Issues and test orchestration remain placeholders/unsupported. Git/Source Control gains the STEP5 foundation described below. STEP4 adds xterm Terminal and Run configuration GUI with an unavailable Web process host.

## Verification status

- Final static/native gates: lint PASS, typecheck PASS, **42/42 tests PASS**, production build PASS. 마지막 UI 수정은 활성 탭 표시 범위이며, 테스트 대상 도메인/host 입력 불변으로 42개 성공 결과를 재사용했다.
- Tests retain the 22 STEP 1/2 cases, add file/editor integration using FakeFileSystemHost, and production Web adapter tests using browser-handle doubles. They do not touch user files and are not real disk/browser evidence.
- Native Node tests have no meaningful Debug/Release split. Optimized Next browser verification is a separate gate.
- Browser: ordinary Chrome manual picker/permission succeeded. Automation picker interception produced AbortError, so selection was handed to the user; the app now preserves browser error detail instead of assuming user cancellation.
- Production browser: actual tree, deep folders, Monaco TypeScript/plaintext, dirty state, Ctrl+S, Save All, all three dirty-close choices, file/folder create/rename/delete, refresh, dirty reload, navigation/disconnect cancellation guards, binary/large-file rejection, ignore toggle, light/dark, reload handle restoration, tab overflow verified.
- Disk readback: saved hello.ts and Save All/Save-on-close content match; renamed source absent/destination content retained; temporary file/folder deletion confirmed. External fixture modification causes save conflict while edits remain dirty. Shell reads provide independent evidence; application operations used the browser host only.
- Three desktop widths 1920/1440/1366: no page overflow; active tab and close remain visible through narrowing after ResizeObserver fix. Independent reviewer scored its one P2 finding resolved (ship for that fix). Final captured console warnings/errors: 0.
- Browser STEP2 regression: all nine activities, six tabs, panel toggles, keyboard resize and primary-sidebar shortcut verified on the production build. Disconnected UI screenshot at 1440x900 saved.
- Evidence: `TASTEDEV/resources/verification/dev-01/tasks/tastedev-studio/step-3-20260929`. STEP1/2 evidence remains historical.
- No CI/deployment, QA-01, native package, commit or push performed. STEP4 foundation is implemented; STEP5 foundation is described below.

## Verification limits

Browser/disk gate is complete for the disposable workspace. Permission revocation, quota/locked-write failures and partial rename failures were covered with test doubles rather than forced on the live OS. No cross-browser/OS certification, watcher, atomic rename or cross-process locking is claimed. Browser-reserved shortcuts and native dialogs remain browser-dependent. Native process/PTY remains STEP6 Tauri work; STEP4 only provides the runtime-independent foundation.

## STEP 4 — Terminal + Run foundation

Run UI → RunService → ProcessHost. Production uses WebUnavailableProcessHost; FakeProcessHost exists only in tests. Runtime capabilities show filesystem availability and process/PTY/Git unavailability. No OS process, PTY, shell/server fallback, Git, Tauri, Core or Agent was implemented.

Project-scoped Run Configuration repository/service supports list/add/edit/delete/select, versioned localStorage persistence and corruption/quota errors. Commands and arguments remain separate; cwd is relative to the workspace; environment is not automatically logged. Dirty Run reuses STEP3 Save All with Save All and Run / Run Without Saving / Cancel.

Client-only @xterm/xterm 6.0.0 + @xterm/addon-fit 0.11.0 supplies ANSI/multiline/scroll/Clear/Focus/resize/shared-theme rendering. TerminalSession and streaming input/resize contracts are independent of React layout. Terminal and task Output are distinct. Store limits: 200,000 characters/1,000 chunks; xterm scrollback 2,000 lines. Clear/reset respects queued writes.

Current gates: lint, typecheck, 61/61 tests (42 retained + 19 new), production build PASS. Real production browser config CRUD/persistence/project isolation, unsupported Run, dirty choices with disk readback, existing Explorer/Monaco/Manager, panel resize and three resolutions verified. Development-only terminal fixture verifies ANSI/stderr/2,500 lines/input/geometry; production route returns 404. Native start/stream/exit/Stop/failure are FakeHost tests, NOT actual OS execution.

Details: [Process Runtime Architecture](PROCESS_RUNTIME_ARCHITECTURE.md). STEP4 evidence: resources/verification/dev-01/tasks/tastedev-studio/step-4-20260929 (TASTEDEV root). STEP3 verification above remains historical. This STEP4 record is historical; STEP5 follows below.
## STEP 5 — Git / Source Control foundation

GitHost/GitService/WebUnavailableGitHost and test-only FakeGitHost implemented. Feature-local state separates repository/status/diff/history from Editor/Workspace. Source Control GUI supports Changes/Staged/Conflicts, Stage/Unstage file/all, validated Commit, Refresh and history. Monaco read-only Diff reuses the existing loader, preserves mounted normal editor and excludes unsaved buffers. Binary protection, bounded text/history, operation locking, stale mutation guards, uncertain commit refresh handling and project cleanup are present. Explorer decoration is an optional injected boundary; Web shows no fake decoration or branch.

Gates: lint/typecheck, 90/90 tests (61 retained + 29 new), production build PASS. Native Git is intentionally unavailable; no real commit/remote operation occurred. Static development fixture validates actual Diff rendering and returns 404 in production. Details and evidence boundary: [Git Runtime Architecture](GIT_RUNTIME_ARCHITECTURE.md). STEP6 not started.



## Advancement3 checkpoint — 2026-10-01

Windows Agent reliability implementation DEV_VERIFIED; phase PARTIAL pending Linux actual Agent/SIGTERM and live GUI qualification. Actual Core/Agent14 and actual Agent boundary8 groups PASS; Debug31/Release31, Node444 distinct valid (translation-only failed gate resumed), static/build PASS. Bounded ACK retry/tool PATH recheck/classification/partial logs/Snapshot cancellation implemented. No byte-offset artifact resume or durable live-log replay. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-3/RESULT.md and checkpoint.json. User requested feature focus; stage4 functional work continues while operational/installed QA and serialized deployment remain separate.


## Advancement4 write-ahead recovery — 2026-10-01

Implementation in progress, not phase PASS. Core encrypted CAS history is reused. Before Apply/Revert can write any file, an open journal containing operation/time and reviewed file/base/result hashes is durably saved. On recovery, all files must match known before/after hashes and have clean editors. A complete Apply is recognized without writing; a partial Apply compensates exact AI results to the pre-AI user baseline; interrupted Revert completes that same restoration. Unknown content or dirty editors preserves all user content and leaves recovery-required for review/retry. Failed journal persistence allows no Source writes. History validates journal paths and hashes against the immutable approved proposal. Connection history recovery performs reconciliation before enabling Source actions.

Controlled real process exit/disk/SQLite reopen tests cover partial/full Apply, interrupted Revert, later user edits, dirty editors and persistence failure; current scoped tests77 distinct PASS, lint/typecheck/Web build PASS. These are synthetic reviewed proposals and real filesystem crash tests; they are not actual Provider/Agent workflow acceptance. Execution approval/snapshot identity audit and actual approved full E2E remain pending. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-4/checkpoint.json. No unrelated Rust/Native rebuild or deployment.


### Advancement4 actual Provider approval checkpoint — 2026-10-01

Explicit minimal transmission approval received for service.cjs/test.cjs plus actual failed Run/Step metadata and sanitized failed logs. Actual managed ChatGPT Pro gpt-6.1-sol completed two Provider requests and five read-only tool calls (step1/log1/search1/file2), with Run context read by Context Builder. Grounded correction changes only a-b to a+b in service.cjs. Source changes during analysis0; excluded payload data0. Proposal 11588eda-5b98-4c88-bd42-b3f27ac37341 remains unapproved/unapplied; exact patch/local arithmetic validation/actual Rust Snapshot retest/final Revert review awaits separate human approval. Actual Core/SQLite/Rust controlled restart/cancel/FAIL/PASS/restore/retry3 checks have separately passed with synthetic proposals. Phase4 remains PARTIAL; no full final gate, GUI PASS or release is inferred. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-4/RESULT.md, EVIDENCE-INDEX.md and checkpoint.json.


### Advancement4 approved actual-model final — 2026-10-01

Stage4 PASS: exact human-approved model Proposal 11588eda-5b98-4c88-bd42-b3f27ac37341, service.cjs-only patch, existing local arithmetic PASS, checksummed secret-excluding Snapshot, actual release Rust Agent Run 89396382-c6e6-4045-96b9-76154253b21f PASS, Revert and original four hashes restored. Controlled actual Core restart/failed/passed/cancelled attempts and persisted retry3 remain independently verified. Node456/456 PASS, valid static/build/Rust gates reused. Agent errors0; awaited exit and process-name audit remaining0. New GUI recovery action not separately browser-qualified; combined stage5 GUI qualification pending. No stage3 Linux/SIGTERM or installed Windows QA PASS inferred, no release/commit/push. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-4/RESULT.md and EVIDENCE-INDEX.md.

고도화 4단계 PASS — 5단계 착수 가능
## Advancement5 implementation checkpoint — 2026-10-01

PARTIAL: connection/readiness/recovery UX, noncredential session drafts, actual-state request reconciliation, persisted observed Fix events and localized timeline implemented. Actual Core lost-response reconciliation created exactly one Job; authentication/protocol/manual reconnect and source integrity regressions passed. Effective final Node468/468 (initial467+1 translation failure, only affected i18n8 resumed), lint/typecheck/Web production build PASS. Browser CLI CDP/session failure and unavailable in-app kernel prevented actual GUI acceptance; last blank screenshot rejected. Ten-language/theme/resolution/keyboard/dirty-editor/live recovery GUI still unverified. Monaco0.57 ESM internal menus remain English; app-owned ARIA/UI translated without model recreation. Token is memory-only and must be entered again after reload. Stage6 NOT_STARTED; no parallel release, no commit/push. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-5/RESULT.md and CHECKS.json.

## Advancement5 Web verification final — 2026-10-01

Supersedes the prior browser-tool-blocked entry: isolated external Chrome/CDP restored actual Web verification. Functional/Web DEV_VERIFIED; phase remains PARTIAL because new UI has no actual Native-window qualification. Connection/readiness and recovery timeline80 language/theme/viewport cases, actual Core restart/reconnect, real Rust readiness, retained actual FAIL/PASS Run navigation, OPFS Dirty/language/reconnect/cancel preservation and controlled review/conflict/recovery verified. Effective Node470 PASS (460 unchanged + current i18n9 + recovery feedback1), changed-file lint and final build TypeScript/Web build PASS. No new Provider request or approved AI Apply; synthetic GUI copies explicitly labelled. Final tracked processes/listeners0. Monaco internal menus English. Stage6 NOT_STARTED; no concurrent release, commit or push. See resources/verification/dev-01/tasks/tastedev-studio/advancement-5/RESULT.md, GUI-FINAL.json, CHECKS.json.

### 2026-10-01 고도화5 Native 재개 (PARTIAL, supersedes tool-only blocker)
지원 Native 자동화가 복구됐다. 실제 Core HTTP 이력 요청의 Native CSP 결함을 수정하고 actual Native history/recovery로 확인했다. 실제 Cancel/Reject의 지속 이력 및 disk 변경0, 10언어 Light 기본 창/10언어 Dark1000x650, Monaco Dirty 언어 변경·Core reconnect·close Cancel 보존을 확인했다. 미적용 제안의 Changed files 표시를 Proposed files로 수정하고 actual Native Diff에서 확인했다. 관련 i18n9/CSP1/ESLint/TypeScript/desktop export/Native no-bundle build PASS; 유효471 결과는 기존460+feedback1+현재i18n9+CSP1을 조합한 것으로 전체 재실행이 아니다. 정확한 Native1920x1080, 추가 Light/기존 actual Run 이력 탐색 및 최종 정리는 진행 중이다. 현재 관측1707x1019를1920x1080으로 간주하지 않는다. 합성 승인 복구 fixture는 인간 승인/실제 Provider 호출이 아니다. 추가 Provider/AI Apply0. 상세 evidence: resources/verification/dev-01/tasks/tastedev-studio/advancement-5/RESULT.md 및 native/. 6단계 NOT_STARTED; 설치/공용 배포/commit/push 없음. Windows 서비스 검증은 설치 패키지 QA로 유지.

현재 마지막 게이트는 검증용 tastestudio-1920.exe에 대한 Computer Use 앱 접근 승인 시간 초과다. 검증 창 PID51760 및 Core/Agent는 재개용으로 실행 중이며 정리 완료를 주장하지 않는다. NATIVE-RECORD-AUDIT.json에 로그·입력 hash 및 최소 Dark10 캡처 존재를 확인했다. UI 접근 승인 전 추가 Native 입력 없음. 같은 빌드/테스트를 반복하지 않는다.


### 고도화5 최종 DEV 검증 (2026-10-01)
PASS / DEV_VERIFIED. Native 승인 대기 해소; 실제 Core/Agent readiness·복구·Dirty·Cancel/Reject·기존 실제 PASS/FAIL 상세 탐색 확인. Web80 조합과 Native10 Light/default·10 Dark/minimum·configured1920 대표 좌/우/하단 캡처를 구분한다. Native 캡처는 monitor-clipped이며 독립 full-frame 픽셀 측정/전체Native80 결과를 주장하지 않는다. Source baseline 동일, 신규 Provider/AI Patch0, owned orphan0. 유효 Node471 및 해당 문구의 Web production build PASS. 설치/원격 TLS/DPI QA 제한은 남는다. resources/verification/dev-01/tasks/tastedev-studio/advancement-5/RESULT.md 및 NATIVE-FINAL.json 참조. 고도화 5단계 PASS — 6단계 착수 가능. 배포는 다른 제품과 직렬 실행 조건 유지.


### 고도화6 팀 운영 — 기능/실제 Agent 검증 진행 (2026-10-01)
IN_PROGRESS / PARTIAL. 서버가 현재 사용자/session/role/project Action을 검증하고 team credential은 hash만 저장한다. role/project 권한 변경과 revoke는 live HTTP/WS 및 새 배정에 적용되며, 진행 중 Agent 결과/cleanup은 보존한다. Scheduler 권한 회수는 대기 취소/새 실행 중단, Agent token 교체는 기존 연결의 새 배정 차단으로 처리한다. project/user quota 및 기존 Agent active1, 승인된 Queue 재배정과 공정 선택을 기존 Core/Matcher에서 재사용한다. AI/GitHub Provider 장애와 팀 권한 거부 오류를 구분하고 기존10언어에 사용자/역할/허용 작업 안내를 추가했다.
실제 두 사용자·두 Project·두 release Rust Agent에서 Run4건 PASS, project group 라우팅 및 active1 일치, Queue 초과/Viewer 실행/교차 Project subscribe 차단, live role downgrade 차단, restart 후 role/Run/audit 보존. Provider 호출0, owned Agent orphan0. 현재 전체 Node500/500·lint·typecheck·Web production build PASS. 변경되지 않은 Rust Agent는 실행파일 hash 확인 후 재사용했다. 최종 실제 GUI/Owner CLI/승인·세션 경계 보완과 문서 마감은 남아있다. 단계 PASS/전체 목표 완료로 보고하지 않는다. 상세 evidence와 current-input checkpoint: resources/verification/dev-01/tasks/tastedev-studio/advancement-6/RESULT.md, checkpoint.json. 운영 정책: resources/guides/dev-01/tastedev-studio/advancement/TEAM_CORE_OPERATIONS.md. 공용 배포 동시 실행 금지, Windows 설치 서비스 QA와 단계3 Linux QA 제한 유지.

### 고도화6 최종 DEV 검증 (2026-10-01)
PASS / DEV_VERIFIED. 고도화 6단계 PASS — 팀 운영 기반 고도화 완료. 실제 두 사용자/두 Project/두 release Rust Agent Run4건 PASS, role/group/quota/fairness 및 restart 권한/Run/감사 확인. 실제 production Web Owner11작업/Viewer read1과 한국어403 안내 확인, 유효 승인 record/actor header 위조 거부와 만료 HTTP/WS reconnect 확인, Viewer CLI stop403/Owner stop202 후 actual drain exit0. Node500/lint/typecheck/Web production build 입력/로그/BUILD_ID 유효 재확인, 재실행하지 않음. GUI는 Web 증거이며 새로운 Native/설치/원격 TLS 검증으로 보고하지 않는다. 추가 Provider0, owned Agent orphan0. 최종 결과/Acceptance/Evidence는 resources/verification/dev-01/tasks/tastedev-studio/advancement-6/RESULT.md, 운영 정책은 resources/guides/dev-01/tastedev-studio/advancement/TEAM_CORE_OPERATIONS.md. 전체 목표는 ACTIVE: 단계3 Linux actual Agent/SIGTERM과 승인된 직렬 공용 배포/설치 QA 경계를 계속 처리한다. 공용 Plan PASS(후보v0.1.3/Linux102), 게시/버전/태그/commit/push 아직 없음.

## Advancement3–6 final functional verification — 2026-10-01

All four phases are DEV_VERIFIED/PASS. Phase3 final evidence now includes explicitly approved Linux102 real Rust Agent Debug31/Release31, boundary8, SIGTERM process-tree cleanup and durable restart result, plus production Web controlled partial-output notice. Phase4 actual Provider/approved source patch/real Rust retest/revert evidence is unchanged; phase5 Native/Web recovery evidence and phase6 actual two-user/two-project/two-Rust-Agent team evidence are retained. No extra Provider requests or duplicate source-unchanged Node500/static/Web build gates were run. Current common deployment waits for a busy mail release; no Studio publication is claimed. Installer service/TLS/DPI QA remains separate. See resources/verification/dev-01/tasks/tastedev-studio/advancement-3/RESULT.md and advancement-6/RESULT.md.

## 2026-10-01 final Linux integration correction
The final Linux Core + actual Rust Agent audit exposed Java runtime `25.0.4.1` registration rejection. Core now accepts bounded four-component Java runtime metadata while preserving the three-component requirement contract and all other runtime validation. Regression: 501/501 Node tests, lint, production Web build including TypeScript PASS. Rust source unchanged; prior Rust gates remain valid. Actual Linux integration: 14/14 scenarios PASS (execution, failure, startup error, timeout, cancellation, reconnect, restart, bounded partial output, Dummy masking, process cleanup). Evidence: resources/verification/dev-01/tasks/tastedev-studio/advancement-3/linux-core-evidence/actual-agent-e2e.json. Historical v0.1.3 publication remains recorded, but the Java fix requires a new common release before final delivery. No provider calls or unrelated regression reruns. Installed Windows service/TLS/physical DPI remain explicit package QA handoff.

## Automatic updates implemented — 2026-10-01
Studio uses the unchanged shared TASTEDEV updater engine via crates/tastedev-update. Native fixed public-release discovery, bounded TLS transport/redirects, cancellable verified download, install-time revalidation, hidden Windows helper with explicit job breakaway, persistent startup-check preference and restart handoff are implemented. User selects installation; Dirty/files/Git/AI/local process safety gates remain. Ten-language GUI and Project Manager/Settings access added. Core/Agent automatic upgrade is excluded. Existing public0.1.4 lacks this feature; first feature-bearing package requires manual installation.
Development verification: Node506 distinct (original501 + resumed update5); Rust Debug48/Release48 distinct (Desktop15 + shared33, affected update6 refreshed after preference/handoff changes); separate public Rust metadata request1 PASS; Clippy and current desktop production export/TypeScript/native Release build PASS. Full Web build and controlled GUI6 PASS preceded final release-page/Git-protection changes. A subsequent GUI replay timed out waiting for the Korean Updates button; final GUI/actual installer, download/install/restart/UAC behavior is not claimed PASS. Expanded actual-download gate was compiled but not executed. User explicitly took over automatic-update testing; no further tests/actual installation/publication were performed after this handoff. Source commit7816e51 was committed/pushed by another session; this implementation session did not commit/push. Current test binary and manual steps are in resources/verification/dev-01/tasks/tastedev-studio/auto-update-20261001/USER-TEST.md; exact artifact hash in manual-test/artifact.json.


## Announcements — 2026-10-01
IMPLEMENTED / DEV_VERIFIED. Shared canonical parser reused byte-identically; Studio list/detail/unread/read/dismiss/daily snooze, urgent priority, independent receive preference, ten languages and bounded Native HTTPS transport added. Public API product=tastestudio returns HTTP200 with CORS *, currently0 items. Node announcements18 + i18n9 distinct PASS; Native Debug2/Release2; website6; controlled production GUI5/errors0; ESLint/Clippy/fmt/Desktop export-TypeScript/Native Release PASS. Only invalidated translation gates repeated; updater actual testing remains user-owned. No announcement publication, installer or public release by this task. Native installed GUI/external browser remain QA. Evidence: resources/verification/dev-01/tasks/tastedev-studio/announcements-20261001/RESULT.md. Guide: resources/guides/dev-01/tastedev-studio/ANNOUNCEMENTS.md.

## Second advancement phase1 — 2026-10-01
Project start experience implementation: separate register/create, exclusive empty/Node starter generation, Native HTTPS Clone/cancellation and local tool check. Source-less Protocol tests use approved saved workspace snapshots through existing Core/Rust Agent. Node529 PASS, applicable Native Debug15/Release15 plus direct UNC display regression, actual public Clone, actual starter smoke Run585e136b-1c70-4c3c-bd29-b8d07fadd70f PASS, controlled GUI4/errors0. Common serialized deployment pending; phase2 not started. No updater installation test. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-1/RESULT.md.

## Second advancement — phase 2 (2026-10-01)
DEV_VERIFIED, deployment pending. Task/Test/Pipeline GUI authoring, preflight validation/preview, stale/dirty protection and existing Agent/Queue navigation implemented. Actual Agent pass/failure/active cancellation and controlled Light/Dark GUI verified. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-2/RESULT.md. Phase 1 public release is 0.1.6; phase 3 is not started.

## Second advancement — phase 3 (2026-10-01)
DEV_VERIFIED, deployment pending. Bounded dirty-aware workspace search and project TypeScript/JavaScript language features implemented. Actual bundled worker definitions/references/diagnostics/completion/format and controlled GUI save/reload verified; remaining owned workers 0. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-3/RESULT.md. Phases 1/2 deployed as 0.1.6/0.1.7. Phase 4 not started.

## Second advancement phase4 — 2026-10-01
DEV_VERIFIED, common serialized deployment pending. Credential-free profiles/TLS guard, Owner Agent grant/revoke and session expiry implemented. Actual approved102 TLS/auth/restart/backup/restore PASS; controlled production GUI with actual local Core RPC PASS. Full Node540 + final scope12, lint and production export/TypeScript PASS. Native Rust unchanged. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-4/RESULT.md. Guide: resources/guides/dev-01/tastedev-studio/SECOND_ADVANCEMENT_REMOTE_OPERATIONS.md. Phases1–3 deployed as0.1.6/0.1.7/0.1.8. Phase5 not started. Installed service/trust store/updater QA remains separate.

## Second advancement phase5 — 2026-10-01
DEV_VERIFIED, common deployment pending. Paged metadata/search/filter/detail and bounded live history; reviewed retention/tombstones, local JSON export, checksum range retry and retained log gaps implemented. Actual2,000 synthetic Run/500 analysis/100 Evidence scale: page p95=48.36ms, page5030bytes, live115116bytes, peak heap delta36133280bytes. Actual Core/HTTP/restart/restore and controlled GUI PASS. Full547 had one cancelled-Job regression, repaired scope9PASS + final security13PASS;548 current cases covered. Lint/production export-TypeScript PASS. Phases1–4 deployed0.1.6–0.1.9. Phase6 not started. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-5/RESULT.md. Existing Core scans/full encrypted snapshot remain; no unlimited-scale or installed QA claim.

## Second advancement phase6 — 2026-10-01
DEV_VERIFIED / functional PASS; final common deployment pending. Phases1–5 already DEPLOYED0.1.6–0.1.10 (phase5 source376843eb605e20b9a333512ed4b84ad4fddf44e5). Project-local analysis requests/time/reported token budgets and attempt limit, current retest Step/log/Evidence priority, readonly attempt/current Dirty editor comparisons, actual historical Run navigation, existing Git review and exact prior-analysis/retest Issue draft linkage implemented. Actual ChatGPT Pro gpt-6.1-sol proposal2 → scoped standing user approval → service.cjs patch → local arithmetic PASS → checksummed real Rust Agent Runf7a44d46-932b-4150-88f6-9cc8614ac3e6 PASS. Controlled proposal1 failed actual Run and retained history; model output not claimed for it. Source restored/unauthorized files0/secrets0/orphans0. Full555 cases with2 narrow repairs plus added issue identity test =556 current cases covered; lint/production export-TypeScript/controlled Light-Dark GUI PASS. No monetary-cost estimate, automatic commit/push/Issue publication, new runner or unrestricted shell. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-6/RESULT.md. Guide: resources/guides/dev-01/tastedev-studio/SECOND_ADVANCEMENT_AI_REVIEW.md. Installed service/DPI/updater QA remain separate; updater user-owned.
