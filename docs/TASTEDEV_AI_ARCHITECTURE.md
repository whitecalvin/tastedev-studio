# TASTEDEV AI Architecture — STEP 12

## 고도화 1단계 — 2026-10-01

AI 분석과 FixAttempt/승인 이력은 인증된 Core /history/request를 통해 Project/kind/id별 암호화 SQLite record로 저장한다. optimistic version 비교와 proposal/patch/approval 불변 조건으로 오래된 덮어쓰기를 거부한다. GUI는 Core 이력 조회가 끝나기 전에 새 source write를 진행하지 않는다. 승인 저장 완료 후에만 apply를 허용하며 apply/revert 결과 저장 실패는 Source와 clean Editor를 함께 보상 복구한다. 새 Proposal은 새 승인, read-only Provider tools, Protocol task 승인은 기존 계약이다.

Core와 Studio 재시작 후 Analysis/Approval/Attempt History와 read-only Monaco Diff 표시를 production GUI에서 검증했다. 여기서 Provider 또는 GitHub를 새로 호출하지 않았다. Local validation 중단은 자동 재실행하지 않으며 remote retest의 persisted Job/Run은 다시 연결한다. Native Patch 도중 전원 장애를 위한 write-ahead journal과 자동 resume는 후속 4단계다.

[저장·복구 운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


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

Status: PASS after explicit approval and actual STEP12B verification. STEP13 NOT_STARTED.

## Data flow

The workspace AI panel calls AIService through a project-scoped context. AIService builds bounded context, controls the tool loop, validates grounded structured output and keeps session-only conversations and analysis history. RemoteAIProvider sends normalized requests to the authenticated Core HTTP gateway. Core selects a provider adapter; provider SDK details and credentials never enter React or the browser bundle.

`Workspace → AIService → RemoteAIProvider → Core /ai/request → AIProvider`

The tool registry exposes only `search_code`, `read_file`, `git_diff`, `get_run`, `get_run_step`, `get_logs`, and `get_evidence`. Tools reuse WorkspaceFileService, GitService and the existing Core snapshot/log/artifact paths. Models cannot apply patches, write/delete files, execute a shell, queue work, run tests, dispatch agents, commit or push.

## ChatGPT subscription connection (default)

Core defaults to `TASTEDEV_AI_PROVIDER=codex`. CodexProvider uses the official Codex app-server stdio protocol. The verified local protocol version is Codex CLI 0.151.0. A compatible CLI must be installed on the Core host. Windows resolves the standard global npm native executable, or the operator can set `TASTEDEV_CODEX_EXECUTABLE` to a native executable. No shell command string is constructed.

Run `pnpm ai:login` from the Studio source directory on the Core host. Open the official URL printed by the command and sign in with the ChatGPT subscription account. This uses managed Codex OAuth; Studio does not copy tokens from the desktop app, accept tokens in chat, or convert subscription credentials into API keys. Login expires after ten minutes. The provider rejects API-key accounts and never falls back to paid API calls. Subscription availability and usage limits remain account-controlled.

Codex stores its managed login in a dedicated `resources/runtime/tastedev-studio/codex` directory. `TASTEDEV_CODEX_HOME` can select a dedicated operator-managed directory. Treat that directory as account state, not verification evidence; do not export it in evidence manifests. The child inherits only required OS path/home/temp settings, never the Core API key or token environment. It receives no project working directory. Features for native shell, execution, apps, plugins, hooks, delegation, browser and computer use are disabled, and `environments: []` disables model environment access. Threads are ephemeral and use read-only sandbox / never-approve policy.

Codex returns a strict envelope containing either read-only tool requests or a final analysis. These requests are data; AIService validates and executes them via existing project services. Any app-server request for native tools or approvals is rejected and the session closes. Every provider request has its own bounded process/session, with termination on completion, cancellation, protocol error or timeout. Full model response text is validated again by AIService before presentation.

`TASTEDEV_CODEX_MODEL` optionally selects a model; when absent the app-server chooses its available default and returns the actual model name. No model entitlement is assumed.

## Optional direct API adapter

Only explicit `TASTEDEV_AI_PROVIDER=openai` enables OpenAI Responses API. `OPENAI_API_KEY` stays on Core, loaded from the existing environment or `.env.local`; it is never a `NEXT_PUBLIC_*` setting. `TASTEDEV_AI_MODEL` defaults to `gpt-4.1-mini` for this adapter. It uses SSE, strict function schemas and the analysis JSON schema. API billing is separate from ChatGPT/Codex subscriptions. No automatic purchase, refill, subscription reset or provider fallback is implemented.

The initial real API authentication check succeeded, but inference returned `credit_balance_exhausted`. That is not a development-license failure and is not a reason to require an API purchase. The user selected continuation with the Pro/Codex route; the API key remains unchanged and unused by default.

## Context, grounding and proposals

Initial context includes project identity, resolved Protocol metadata, bounded open-editor paths, optional current editor/selection and optional failed Run. Additional source/evidence is retrieved through tools. Each item gets a citation ID and an explicit truncation indicator. Search returns bounded file-name/text/symbol occurrences, not semantic indexing.

Limits: 32 KiB small source file, 8 file reads, 12 KiB log context, 24 KiB text evidence, 80,000 context characters, 12 tool calls, 120 seconds per analysis, 48,000 final response characters. Repeated identical tool requests stop the loop. Limits intentionally reject oversized work rather than silently expanding context.

`TASTEDEV_AI_TIMEOUT_MS` configures the Core request timeout between 1,000 and 120,000 milliseconds (default 120,000). Invalid values are rejected at startup. The client still caps the complete multi-request analysis at 120 seconds. `/ai/config` reports the provider capabilities and effective request policy to authenticated clients.

Analysis has summary, observed failure, evidence-backed candidates with uncertainty, related source ranges, proposed replacement content/rationale/impact/tests, and overall uncertainty. References must point to supplied citation IDs. Related files require an actual complete source read with valid line ranges. Proposals require the same read source and a related-file reference. The UI opens related files in Monaco and renders a read-only diff against the content at analysis time. Apply is disabled and reserved for STEP 13.

Current editor buffers may be dirty and may differ from the recorded Run revision; prompts and evidence make this distinction. Text evidence uses the existing authenticated, checksum-verified artifact path. Screenshot and trace currently provide metadata only; neither adapter advertises image analysis, and no OCR or unsupported image interpretation is claimed.

## Isolation and error handling

Project identity is checked on the Core connection, gateway and Run/tool lookup. Absolute/traversal/secret paths, `.env`, key/credential files, dependency/build folders and binary/oversized files are excluded. Environment values and common secret patterns are masked in context, tools and final structured output. Project content, logs and prior conversation are untrusted data, not instructions. No raw provider exception, account token or stack is displayed to users.

Errors distinguish unavailable provider, authentication, usage limits, API quota, timeout, oversized context, tool failure, malformed/ungrounded output and cancellation. The existing IDE remains usable without provider authentication. Gateway enforces bearer auth, allowed origins, registered project identity, bounded input, two concurrent requests, cancellation and no-store responses.

Conversations (maximum 20), message history and analyses (maximum 100) are session-only and scoped to the mounted workspace. Reload does not promise cloud conversation sync or durable AI history. Every analysis has a distinct ID; retry does not overwrite an earlier result.

## Verification boundaries

Test-only FakeAIProvider and stdio protocol peers are under `tests/`; there is no production fake-provider selector. Tests cover tool allowlists, containment, secret masking, project isolation, grounding, limits, timeout/cancellation, gateway auth, SSE errors, ChatGPT-only auth and native-tool refusal. Real model Development and actual STEP 11 failure-evidence flows remain separate mandatory acceptance gates.

STEP 12 does not include AI file writes, patch apply, shell, automatic tests, commit/push, agent dispatch, fix/retest loops, GitHub automation, scheduling or cloud conversation synchronization. Shared tooling owns packaging and deployment.

## Official reference

[Codex app-server](https://learn.chatgpt.com/docs/app-server) defines managed ChatGPT login, account inspection, ephemeral threads, structured outputs and streamed events. The local generated 0.151.0 protocol schema supplies the explicit empty-environment contract used here.

## Current verification checkpoint

URL masking preserves string/code delimiters; source citations disclose redaction. The provider policy states the 12-call/8-file budget and requires reuse of existing context. These limits remain enforced by AIService. Current evidence and resume instructions: resources/verification/dev-01/tasks/tastedev-studio/step-12-20260930/checkpoint.json in the parent workspace.



## Advancement4 write-ahead recovery — 2026-10-01

Implementation in progress, not phase PASS. Core encrypted CAS history is reused. Before Apply/Revert can write any file, an open journal containing operation/time and reviewed file/base/result hashes is durably saved. On recovery, all files must match known before/after hashes and have clean editors. A complete Apply is recognized without writing; a partial Apply compensates exact AI results to the pre-AI user baseline; interrupted Revert completes that same restoration. Unknown content or dirty editors preserves all user content and leaves recovery-required for review/retry. Failed journal persistence allows no Source writes. History validates journal paths and hashes against the immutable approved proposal. Connection history recovery performs reconciliation before enabling Source actions.

Controlled real process exit/disk/SQLite reopen tests cover partial/full Apply, interrupted Revert, later user edits, dirty editors and persistence failure; current scoped tests77 distinct PASS, lint/typecheck/Web build PASS. These are synthetic reviewed proposals and real filesystem crash tests; they are not actual Provider/Agent workflow acceptance. Execution approval/snapshot identity audit and actual approved full E2E remain pending. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-4/checkpoint.json. No unrelated Rust/Native rebuild or deployment.


### Advancement4 execution audit milestone

The GUI now persists separate local-task/remote-test approvals with proposalId, task/test name, timestamp and SHA256 of the exact resolved definition before execution. Approved entry points reject changed definitions or an approval from another Proposal. Snapshot identity and file checksums are stored on FixAttempt without Source content or environment values. Snapshot hashes for changed files must match the reviewed applied patch; user edits yield PATCH_CONFLICT. History CAS prohibits rewriting previous approvals or Snapshot identity. Approval/Snapshot persistence tests10 PASS; changed lint/typecheck and production build PASS. Full actual Provider/Rust retest and final phase qualification remain pending. Prior write-ahead recovery checks remain scoped evidence, not full phase PASS.


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
