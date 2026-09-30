# TASTEDEV Studio 구현 로드맵

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

## 현재 단계와 다음 단계

STEP9 TASTEDEV Protocol v1을 구현했다. 네 YAML 파일의 domain/strict validation, requirement/environment resolution, task/test→기존 Core Job, compact Run/Tests와 status bar, initialize/Monaco 저장 재검증이 범위다. Protocol80+기존139=219 테스트 근거가 있으며 final lint/typecheck/Web/Desktop no-bundle builds와 production actual Agent GUI E2E가 PASS다. Rust Agent Debug12/Release12/fmt/Clippy/release는 유효성 확인 후 재사용했다. 독립 UI review는 production8개 화면에서 ship이다. **STEP9 PASS — STEP10 착수 가능, NOT_STARTED**. [Protocol](TASTEDEV_PROTOCOL.md), [STEP9 evidence](../../../../resources/design/tastedev-studio-step9/EVIDENCE.md) 및 task RESULT/checkpoint가 최종 수락 기준이다.

STEP8 Core/Agent 단일 명령 경로를 재사용하며 Project별 Agent 코드는 없다. Agent workspace에 source checkout/copy는 추가하지 않았다. .tastedev load와 실제 Queue/Assign은 분리한다. STEP10 Test Orchestration은 NOT_STARTED이며 자동 착수하지 않는다. 이전 순서 계획과 당시 미구현 표현은 역사적 기록이다.

## Historical STEP6E handoff

2026-09-30 STEP6E: **STEP 6 PASS — STEP 7 착수 가능**. STEP7은 시작하지 않았다. 과거 이벤트 `1790699936279`는 HISTORICAL_UNRESOLVED / NOT_REPRODUCED / Root Cause UNKNOWN / Non-blocking으로 보존한다. 진단 보강 및 controlled browser tests, Node102, lint/typecheck/Web build와 새 production Web smoke PASS. Rust 및 전체 Desktop 검증은 반복하지 않았다. 기존 EXE/installer에는 STEP6E 변경이 아직 포함되지 않으며 다음 패키징에서 frontend export/embedded app 재생성이 필요하다.

[최종 증거 목록](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/EVIDENCE-INDEX.md). 기존 Native PASS 및 실제100%/150%DPI 유지,125% 미검증은 비차단이다.

## 과거 STEP 5 시점의 범위와 순서 결정

이 절의 실행 순서와 native 미착수 표현은 역사적 계획이다. 현재 상태와 다음 단계는 위 최신 기록이 우선한다.

2026-09-29 STEP 5 구현·검증 완료 기준으로 갱신했다. STEP 0 당시 신규 빈 저장소였으며, 사용자 STEP 1 지시로 Application Foundation + Project Manager의 Web 범위를 구현·검증했다. STEP 2 Shell을 구현·검증했다. STEP 3은 사용자 새 지시에 따라 Web Filesystem Host와 Monaco를 구현했으며 실제 Chrome Browser/Disk gate를 완료했다. STEP4 Terminal/Run foundation은 구현했다. Native Process/PTY는 사용자 STEP4 지시에 따라 STEP6 Tauri에서 연결한다. STEP5 Git foundation은 WebUnavailable/FakeHost 경계로 구현했으며 실제 Native Git은 STEP6에서 연결한다. 목표와 경계는 [비전](TASTEDEV_STUDIO_VISION.md), 현재 상태는 [현재 분석](TASTEDEV_CURRENT_ANALYSIS.md), 기능별 미구현 항목은 [GAP](TASTEDEV_GAP_ANALYSIS.md)을 따른다.

기본 STEP 번호는 유지하되 다음 의존성 때문에 실행 순서를 조정한다.

`0 → 1 → 2 → 3(Web host) → 4(Web foundation) → 5 → 6(Native host) → 9 → 7 → 8 → 10 → 11 → 12 → 13 → 14 → 15`

- **STEP 3 host 결정 갱신**: 사용자 STEP3 지시가 기존 Tauri 선행 계획을 대체했다. File System Access API 기반 Web host만 이번 단계에 구현한다. Tauri는 구현하지 않는다. STEP4는 WebUnavailable 기반 foundation으로 완료하며 실제 PTY/process는 사용자 지시에 따라 STEP6 Tauri에 배정한다.
- **STEP 9를 STEP 7/8 앞으로**: Core·Agent가 독자적인 task schema를 만들지 않도록 Protocol 계약과 validation을 먼저 확정한다. 로컬 command adapter도 이 단계에서 계약에 맞춘다.
- STEP 1 시작 시 정확한 dependency 버전, package manager, frontend/desktop 호환성, 물리적 패키지 구조와 metadata 저장 방식을 결정하는 기반 작업을 포함한다. STEP 0에는 이를 설치·검증한 것으로 기록하지 않는다.

## 단계별 범위와 완료 조건

### STEP 0 — 현재 분석 및 기준 아키텍처

- 목적: 신규 프로젝트의 사실과 목표를 분리하고 개발 기준 수립.
- 선행조건: 사용자 신규 프로젝트 확인, 실제 디렉터리·Git·지침 조사.
- 구현 범위: 비전·현재 분석·GAP·로드맵 문서 4개, 문서 검증과 DEV-01 기록.
- 제외 범위: 앱 scaffold, 패키지 설치, UI/Agent/Protocol 구현, DB 변경, 다음 STEP.
- 검증 방법: 작성 전후 inventory 대조, 모든 요청 항목 coverage·링크·상태 표현 확인, whitespace 검사.
- 완료 조건: 네 문서가 존재하고 실제 빈 저장소 사실·UNKNOWN·설계 후보를 구분하며 후속 각 단계에 여섯 항목이 정의됨.

### STEP 1 — Project Manager 및 신규 기반 (Web 범위 완료)

- 목적: Project를 최상위 도메인으로 만들고 최소 앱 기반 확정.
- 선행조건: STEP 0, 단계 착수 지시, 기술·호스트·metadata 저장 결정. 선택한 버전의 공식 문서로 호환성 확인.
- 구현 범위: 최소 scaffold, Project metadata·목록·최근 열기·생성/열기/복제 의도, filesystem/Git adapter 인터페이스와 명시적 미연결 UI 상태. source 본문 DB 저장 금지.
- 제외 범위: 실제 clone 완료 보장, Editor·Terminal, 원격 Agent, Core 전체, AI.
- 검증 방법: metadata validation·영속화·중복 경로·Project 전환을 unit/integration으로 검증하고 실제 adapter와 mock 증거를 구분.
- 완료 조건: 재시작 후 metadata·최근 목록 유지, 잘못된 경로 처리, adapter 경계 명확화. Create/Open/Clone의 미연결 범위가 UI·기록에 표시됨.

### STEP 2 — IDE Workspace Shell (Shell 범위 완료)

- 목적: Project를 여는 GUI의 일관된 작업 구조 제공.
- 선행조건: STEP 1의 Project context와 UI 기반.
- 구현 범위: Activity Bar, Sidebar, Editor 자리, AI Panel, Bottom Panel, Status Bar, 패널 전환·크기·키보드 탐색·상태 보존.
- 제외 범위: 실제 Monaco·PTY·AI 연동, 기능 없는 영역을 동작 완료로 표시하는 UI.
- 검증 방법: Project 전환·패널 복원·좁은 창·키보드·접근성 및 실제 화면 검증.
- 완료 조건: 지정한 활동·Bottom Panel 진입점과 빈 상태가 일관되고 Project 간 상태가 혼합되지 않음.

### STEP 3 — File Explorer + Monaco Editor + Web Filesystem Host (Web 범위 완료)

- 목적: workspace 파일 탐색·편집·저장 제공.
- 선행조건: STEP 2, 사용자 STEP3 지시, FileSystemHost와 browser permission 경계 계약.
- 구현 범위: filesystem adapter, tree·파일 CRUD·본문 검색, Monaco 모델·탭·dirty·save, 외부 변경·encoding·충돌 처리, 실제 Project Create/Open 연결.
- 제외 범위: Terminal, Git push, AI 수정, 모든 언어 LSP 완비.
- 검증 방법: 임시 workspace의 생성/열기/수정/저장/재열기, symlink 경계·동시 외부 변경·실패 시 원본 보존.
- 완료 조건: 디스크와 편집 상태 일치, workspace 탈출 차단, 저장 실패·충돌에서 데이터 보존. STEP3 종료 시 42개 Node 테스트와 정적/빌드 및 실제 Browser/Disk gate를 완료했다.

### STEP 4 — Terminal + Run Foundation

- 목적: Terminal UI와 교체 가능한 Process 실행 architecture 제공.
- 선행조건: STEP3와 사용자 STEP4 지시, ProcessHost 계약.
- 구현 범위: xterm Terminal, ProcessHost/RunService/Session/Event, WebUnavailable host, test-only FakeHost, Run Configuration CRUD와 project별 persistence, dirty/save/run 보호, Output 분리와 출력 제한.
- 제외 범위: 실제 OS Process/PTY, Tauri, Git, 원격 dispatch, Scheduler, Problems 해석.
- 검증 방법: host double의 상태·stream·stop·오류·cleanup, 실제 Web GUI와 xterm rendering fixture, 기존 regression 및 production build.
- 완료 조건: 61개 테스트와 lint/typecheck/build, GUI CRUD/격리/dirty run/세 해상도/console gate 완료. 실제 Native containment·process tree 종료·PTY는 STEP6에서 별도 검증한다.
### STEP 5 — Git / Source Control Foundation

- 목적: GitHost 경계와 Source Control GUI, Git 상태·Diff·index·commit workflow 기반 제공.
- 선행조건: STEP1~4 PASS와 사용자 STEP5 지시. 기존 Native 선행조건은 이번 Web foundation 범위로 대체.
- 구현 범위: GitHost/GitService/WebUnavailableGitHost, test-only FakeGitHost, Repository/Branch/FileStatus/Diff/Commit models, Changes/Staged/Conflicts, Stage/Unstage file/all, validated Commit, bounded History/Refresh, Monaco Diff, Explorer decoration extension.
- 제외 범위: 실제 Git CLI·Clone·checkout·fetch/pull/push·인증·Tauri·Core. Web shell/server 우회 없음.
- 검증 방법: FakeHost status/diff/index/commit/history integration과 failure/isolation, 실제 WebUnsupported 및 Diff renderer, STEP1~4 regression.
- 완료 조건: 90 tests, lint/typecheck/build PASS; 실제 Source Control, dirty preservation/disk save/기존 기능, 세 해상도/theme/console 검증. Native OS Git 보장은 STEP6에서 별도 검증.

### STEP 6 — Tauri Desktop Runtime (STEP6E 수락 PASS)

- 목적: 로컬 filesystem·프로세스를 제공하는 desktop host 확립.
- 선행조건: STEP 1 기술 결정과 STEP 2 Shell. Next.js의 서버 의존·정적 산출물 경계 확정.
- 구현 범위: Tauri 2.12.0 / Rust 1.98.1, 중앙 runtime factory, static frontend bundle, 최소 command capability, native filesystem/Process/ConPTY/Git adapters, 개발·NSIS 패키징. 모두 구현됨.
- 제외 범위: Rust 원격 Agent, 자동 업데이트·서명·공식 배포, 전체 OS 지원 주장.
- 검증 방법: 선정한 개발 OS에서 실제 desktop launch·host 호출·허용되지 않은 접근 거부·패키지 실행.
- 완료 조건: native 기능, restart, Web 회귀, 설치/제거 및 정적/빌드 게이트는 통과. native1920×1080, Windows100%·150%, Missing Project 복구와 수정 안내 화면 증거도 통과. 과거 frontend 오류1은 원인 UNKNOWN을 보존하되 진단 보강/controlled test PASS 후 Non-blocking으로 수락. 125%는 비차단 미검증이며 Windows 외 OS는 미검증.

### STEP 7 — TASTEDEV Core Foundation (PASS)

- 목적: 기존 Project에 연결되는 실행 metadata와 교체 가능한 Core repository/service 경계 제공.
- 선행조건: STEP6E PASS와 사용자 STEP7 승인. 기존 DB·Protocol 전체 선행 제안은 이번 in-memory foundation 범위로 대체한다.
- 구현 범위: Agent Registry, 구조화 capability/requirement 매칭, Job Queue/수동 Dispatcher, Run/ordered RunStep 상태, 수동 retry/cancel, Artifact metadata, bounded events, Agents/Queue/Runs GUI. 기존 local RunService 독립 유지.
- 제외 범위: 실제 remote Agent·네트워크·heartbeat·DB/Redis·영속 복구·AI·Scheduler·STEP8. Dispatch는 busy 예약/pending Run 생성이며 실행이 아니다.
- 검증 방법: atomic rollback/배정 충돌/상태 전이/매칭/우선순위·동률/프로젝트 경계/실패 전파/retry와 취소 테스트, 개발 전용 fixture UI, 정적 검사와 Web production build·실제 Web IDE 회귀. Rust/native 입력 불변으로 새 native 빌드는 요구하지 않는다.
- 완료 조건: foundation 계약과 정직한 empty/unavailable/session-only UI, 필수 로컬 검증 및 production fixture 차단 근거. Core31/기존102(총133), 개발 GUI/review, 최종 lint/typecheck/Web build, production OPFS/Monaco·Project 격리·fixture404 모두 PASS. STEP8은 ready / NOT_STARTED다.
- 후속 GAP: DB·인증·lease·분산 dedupe·restart·네트워크 실행·artifact 전송은 후속 별도 승인 범위이며 이 단계 구현 완료로 계산하지 않는다.

### STEP 8 — Rust Agent Runtime Foundation (implemented; final gates in task record)

- 목적: Project 이름별 분기 없는 독립 실행 Agent 제공.
- 선행조건: STEP7 domain/Core; 이번 단계의 version 1 wire contract와 configured Agent/Studio tokens.
- 구현 범위: register/heartbeat/capability, single structured executable/args/cwd/env/timeout, fresh run directories, Windows process-tree cleanup, UTF-8 stdout/stderr, result ack/reconnect and persistent run claims.
- 제외 범위: revision/source checkout, artifact upload/download/hash store, multi-step/DAG, durable Core recovery, production deployment, Unix qualification and STEP9.
- 검증: actual Windows binary registration/execution/exit7/invalid executable/timeout/cancel/network-loss/restart/dedup, production Web real Agent logs/results/status and OPFS editor regression, source gates and scoped visual review.
- 완료 조건: 해당 범위의 tests/lint/optimized builds 및 실동작 증거 일치. 최종 게이트는 STEP8 RESULT/checkpoint를 기준으로 하며 설치·QA-01·Native UI 재검증과 구분한다.

### STEP 9 — TASTEDEV Protocol v1 (PASS; STEP10 ready but NOT_STARTED)

- 목적: Project가 WHAT을 선언하고 기존 Core/Agent가 배정·실행하도록 연결.
- 선행조건: STEP8 foundation, 기존 filesystem/Monaco/Project/Core domain.
- 구현 범위: .tastedev/project.yml 및 optional environments/tasks/tests.yml, strict YAML/schema, v1 domain, requirements/env merge, task/test resolution, existing Job conversion, Run/Tests/status UI, safe initialize, saved-file reload.
- 제외 범위: Project-specific Agent, source checkout/copy, DB/Redis, DAG/pipeline/test engines, artifact transfer, Secret Manager, AI/Scheduler 및 STEP10.
- 검증: parser/schema/security/merge/refs/isolation, existing Node regression, lint/typecheck/Web build, Agent gates의 유효한 재사용/실행 근거, 실제 Agent match→passed/logs, mismatch→queued/no execution, invalid→no Job, GUI/Monaco save 재검증.
- 완료 조건: 모든 필수 소스·실행·GUI gate와 문서 완료 후에만 PASS. 최종 STEP9 PASS 근거는 root task RESULT/checkpoint에 기록한다. STEP10은 미착수.

### STEP 10 — Test Orchestration

- 목적: Project 자체 도구와 browser 테스트를 공통 결과로 연결.
- 선행조건: STEP 7/8/9, RunStep·result 계약.
- 구현 범위: 테스트 task 의존성·선택·취소·관련 재실행, native runner adapters, Playwright browser runner와 evidence 수집.
- 제외 범위: AI 판정, 모든 테스트 도구 지원, native GUI 전체 검증 대체.
- 검증 방법: 성공·의도적 실패·timeout·부분 실패·중단·재시도, 원본 exit code와 정규화 결과 대조.
- 완료 조건: 실패가 누락되지 않고 test case·RunStep·revision·환경 및 원본 결과가 연결됨.

### STEP 11 — Evidence + Test GUI

- 목적: 결과에서 재현 가능한 증거까지 탐색.
- 선행조건: STEP 10 결과·artifact index.
- 구현 범위: Tests/Agent/Logs 화면, timeline·실패 step·trace·screenshot·report, artifact 접근 권한·hash·보존 정책.
- 제외 범위: AI 원인 확정, 무제한 로그 보관, 운영 QA 합격 선언.
- 검증 방법: 실패 case에서 원본 증거 열기·다운로드 hash·삭제/누락·접근 거부·대용량 로그.
- 완료 조건: 결과와 해당 시도의 증거가 정확히 연결되고 누락·업로드 실패가 명시됨.

### STEP 12 — AI Development

- 목적: provider 독립 Assistant와 검토 가능한 코드 변경 제공.
- 선행조건: STEP 3 저장 충돌 처리, STEP 11 증거 조회, 모델·context·자격증명 계약.
- 구현 범위: provider interface, context 선택, streaming·취소, 설명·diff 제안·명시적 적용·복구, 파일 경계와 동시 편집 보호.
- 제외 범위: 무인 수정·commit/push·Issue 게시, 특정 provider 강결합.
- 검증 방법: provider 교체 contract 및 fake adapter, 실패·취소·경계 밖 수정·stale diff·실제 연동 별도 검증.
- 완료 조건: 공급자 타입이 핵심 도메인에 노출되지 않고 적용 전 diff와 사용자 변경이 보호됨. 실제 provider 검증 여부를 구분함.

### STEP 13 — AI Analyze / Fix / Retest

- 목적: 증거에 근거한 분석과 제한된 수정·재검증 흐름.
- 선행조건: STEP 10/11/12, 적용 및 반복 실행 정책.
- 구현 범위: evidence 기반 분석·추정 표시, 수정 승인/적용, 관련 테스트 선택·재실행, 이전/새 결과 비교, 횟수·비용·취소 제한.
- 제외 범위: 실패 은폐, 테스트 기준 자동 완화, 무제한 자동 루프.
- 검증 방법: 재현 fixture의 분석→diff→적용→재테스트, 잘못된 수정·여전한 실패·취소·rollback.
- 완료 조건: 성공 판정이 실제 테스트 결과와 연결되고 해결되지 않은 실패 및 변경 이력이 남음.

### STEP 14 — GitHub Issue

- 목적: 실패·증거·수정 이력을 공유 가능한 Issue로 연결.
- 선행조건: STEP 11/13, repository 매핑과 사용자 인증·게시 동작.
- 구현 범위: Issue 초안·근거 링크·중복 조회·명시적 게시, idempotency·오류·rate limit 처리.
- 제외 범위: 승인 없는 외부 메시지, 자동 Issue 종료·무제한 중복 생성.
- 검증 방법: mock API 실패·재시도·중복 검증, 명시 승인된 sandbox repository에서 실제 게시 별도 확인.
- 완료 조건: 단일 사용자 요청의 중복 게시를 방지하고 Issue와 원본 Run이 연결됨. mock 성공과 실제 게시 검증을 분리함.

### STEP 15 — Scheduler / Continuous Testing

- 목적: 사용자 설정에 따른 반복 검증.
- 선행조건: STEP 7~14 실행·복구, schedule/timezone/권한·알림 정책.
- 구현 범위: schedule 활성화·중지, 중복 억제·missed run 정책·동시성 한도·실패 알림·이력.
- 제외 범위: 암묵적 예약 활성화, 무인 무제한 코드 수정·배포.
- 검증 방법: 제어 clock, 시간대·재시작·중복 tick·Agent 부재·수동 중지·의미 있는 상태 변경 알림.
- 완료 조건: 지정 시간·정책에서만 실행되고 중지·복구가 검증되며 실행과 알림이 추적 가능함.

## 공통 검증·실패 재개 규칙

각 단계는 변경 파일→영향 경계→필수 게이트를 먼저 매핑한다. 일반 구현은 해당 컴포넌트 전체 development 테스트, 해당 lint/static analysis, production build를 각 1회 수행한다. 단계 완료 게이트에서는 development/production 테스트를 모두 수행하며, 별도 구성이 없는 도구는 가장 강한 native 검증을 사용하고 의미 없는 이중 실행을 만들지 않는다. 저장·동시성·프로토콜 등 고위험 변경은 직접 관련 production 테스트를 포함한다.

문서만 변경하는 STEP 0은 문서 검사만 수행한다. 앱을 설치하거나 무관한 테스트·빌드를 실행하지 않는다. 동일 입력의 성공 결과는 실제 산출물·hash·환경을 확인해 재사용한다. 실패 시 마지막 성공, 정확한 실패, 변경 입력, 다음 게이트를 기록하고 최초 실패/무효화 지점부터 재개한다. 필수 게이트가 실패한 상태로 다음 STEP에 진입하지 않는다.

DEV 로컬 검증, CI, desktop 수동 검증, 설치·서명·배포, 외부 API, QA-01은 서로 다른 증거다. 각 단계 결과는 수행한 범위만 보고한다. commit/push, PR 게시, 릴리스·운영 배포는 별도 사용자 지시 범위다.

## Historical STEP 1–5 handoffs

아래 각 단계의 “다음 단계 미착수”는 당시 기록이며 현재 STEP6 상태나 STEP7 방향을 대체하지 않는다.

## STEP 1 인계

STEP 1은 Next.js 16.3.7 기반 앱, Project metadata CRUD 중 create/read/open, local persistence, 중복 방지, Open/Clone abstraction, Overview 왕복으로 완료했다. 실제 native Open/Clone·filesystem은 미연결이다. 다음 단계는 승인 후 STEP 2 Workspace Shell이며 자동 착수하지 않는다. STEP 1 테스트 15/15, lint/typecheck/build 및 production browser flow를 검증했다. 정확한 기록은 resources/verification/dev-01/tasks/tastedev-studio/step-1-20260929에 있다.

## STEP 2 종료 기록

Activity 9개, 독립 패널, 하단 6탭, 프로젝트별 reducer 상태와 localStorage, 패널 토글·resize·키보드, 공유 theme를 구현했다. lint → typecheck → 22 tests → production build가 통과했다. 세 desktop 해상도와 탐색·복원·오류 화면을 실제 browser에서 확인했다. Shell completion은 실제 파일/Monaco/PTY/AI 완료가 아니다. STEP 3용 editor 타입과 UI 경계만 준비했고 여기서 작업을 종료한다. 후속 파일 접근은 위 host 의존성 결정을 먼저 충족해야 한다.


## STEP 3 종료 기록

Filesystem/Explorer/Monaco 구현과 42/42 native tests, lint/typecheck/build 완료. 사용자가 일반 Chrome에서 직접 폴더를 선택한 뒤 browser 편집·저장·CRUD·dirty guards·재연결 복원·실제 disk readback 검증을 완료했다. 세 해상도 및 활성 탭 resize 수정 확인, 콘솔 오류/경고 0건. STEP3 Web 범위 PASS이며 외부 OS 오류는 테스트 더블 검증으로 구분한다. 테스트용 폴더는 resources/verification/dev-01/tasks/tastedev-studio/step-3-20260929/disposable-workspace. 사용자 승인 범위는 이 폴더의 테스트 파일 생성·수정·rename·삭제로 한정된다. STEP4는 시작하지 않는다.


## STEP 4 종료 기록

사용자 STEP4 지시가 실제 실행 host 선정 선행조건을 이번 Web foundation 범위에 한해 대체한다. ProcessHost/RunService/terminal session/event 및 Run Configuration CRUD, xterm UI, WebUnavailable 안내, test-only FakeHost를 구현·검증했다. 61 native tests와 lint/typecheck/production build, production GUI/dirty+run/세 해상도 및 development-only ANSI·긴 출력 fixture 검증을 완료했다.

STEP5 Git/Source Control은 별도 사용자 지시 후 착수할 수 있다. Web의 Git capability는 unavailable이다. Native Process/PTY와 native containment/process-tree cancellation은 STEP6 Tauri의 완료 조건이다. Web에서 shell 우회 실행하지 않는다. STEP4 종료 당시 STEP5·STEP6은 미착수였다. 현재 STEP5 결과는 다음 기록을 따른다.
## STEP 5 종료 기록

Git + Source Control Foundation 구현과 90/90 테스트, lint/typecheck/production build 완료. Production WebUnavailable 및 실제 Chrome 회귀 검증, 별도 개발 전용 정적 Diff fixture와 production404 검증을 구분해 기록했다. 실제 Native Git과 remote/authentication은 구현하지 않았다.

STEP6 Tauri 2 Desktop Runtime + Native Filesystem + Process/PTY + Git은 다음 단계 착수 가능한 계약이 준비되었다. Next.js frontend packaging, native 권한/경로/취소/오류 및 실제 OS 통합 검증은 STEP6 시작 시 확정한다. STEP6은 현재 시작하지 않았다.

