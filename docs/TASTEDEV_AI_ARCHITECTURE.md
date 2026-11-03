# TASTEDEV AI Architecture — STEP 12

## 4차 고도화 로컬 패키지 마감 (2026-10-02)

1~6단계0.1.18–0.1.23 COMPLETE_LOCAL_PACKAGES. 사용자 최신 범위에 따라 배포·설치 테스트는 사용자 담당입니다. Windows signed installer/ZIP12개와 Core runtime ZIP4개를 resources/packages/tastestudio/fourth-advancement에 보관했습니다. 총16개 artifact SHA-256, installer/payload signature, Core archive manifest/file hash를 확인했습니다. 102 전송/실행, 서비스 설치, GitHub/홈페이지 게시를 수행하지 않았습니다.

4단계: 기존 새 실패 Evidence/Attempt 비교/Protocol validation/승인 경계를 재사용하고 모델·설정 단가 기반 비용 추정과 실패 요청 metrics를 추가했습니다. 사용량/모델 미확인과 추정 한도 초과 시 후속 호출을 중단합니다. 실제 Provider 청구 상한은 아니며 단가를 임의 지정하지 않습니다.
5단계: 실제 source revision/snapshot checksum, 저장된 검증 정의/환경, dispatch 당시 보고된 Agent 환경에 기반한 Run/Step/Evidence 비교. 시간은 startedAt→finishedAt이며 Source/환경 미기록을 비교 가능으로 추측하지 않습니다. slowdown/flaky는 후보일 뿐 확정 결함이 아닙니다.
6단계: project/live/run 선택 후 clone, collection별 read, 전체 SQL aggregate, 전체 Evidence usage/retention, schema3 projection migration/atomic rollback/reopen, 최근100개 종료 Run의 Agent 실행 문제 조회. source/Job body 없이 전체 통계를 계산합니다. full detached write transaction/startup load는 유지됩니다.

최종 Node629 distinct effective PASS(614 unchanged full +15 scoped final), failure/skip0. 전체 lint+최종 관련 lint, desktop production export/TypeScript PASS. Native source/dependencies/config/toolchain fingerprint와 로그를 검증해 phase3 Debug/Release106각 PASS·fmt/Clippy를 재사용했고, 버전/정적 자산 변경에 필요한 Release executable만 재빌드했습니다. Node에는 별도 Debug/Release 테스트 설정이 없어 가짜 중복 환경을 만들지 않았습니다.

로컬 SQLite1500건 전체 집계·active Evidence 보호·동일 transaction rollback·v2 migration/reopen 및 실제 Core bundle start/ready/stop/exit0 확인. 10000 Run8회 synthetic read 측정은 full254.32ms→selected17.03ms; 운영 성능 보장이 아닙니다. Native GUI/실제 Provider/GitHub/실제 장비 Agent/서비스/장기 운영/업데이트 설치는 사용자 QA이며 미실행입니다. package 준비를 해당 외부 QA PASS로 기록하지 않습니다.

증거: resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/checkpoint.json, DELIVERY-INDEX.json, phase-4~6/RESULT.md. 배포·사용법: resources/packages/tastestudio/fourth-advancement/README.md 및 resources/guides/dev-01/tastestudio-fourth-advancement/*.md. 이 작업으로 새 commit/push/tag를 만들지 않았습니다.


## 고도화 1단계 — 2026-10-01

AI 분석과 FixAttempt/승인 이력은 인증된 Core /history/request를 통해 Project/kind/id별 암호화 SQLite record로 저장한다. optimistic version 비교와 proposal/patch/approval 불변 조건으로 오래된 덮어쓰기를 거부한다. GUI는 Core 이력 조회가 끝나기 전에 새 source write를 진행하지 않는다. 승인 저장 완료 후에만 apply를 허용하며 apply/revert 결과 저장 실패는 Source와 clean Editor를 함께 보상 복구한다. 새 Proposal은 새 승인, read-only Provider tools, Protocol task 승인은 기존 계약이다.

Core와 Studio 재시작 후 Analysis/Approval/Attempt History와 read-only Monaco Diff 표시를 production GUI에서 검증했다. 여기서 Provider 또는 GitHub를 새로 호출하지 않았다. Local validation 중단은 자동 재실행하지 않으며 remote retest의 persisted Job/Run은 다시 연결한다. Native Patch 도중 전원 장애를 위한 write-ahead journal과 자동 resume는 후속 4단계다.

[저장·복구 운영 계약](../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


## STEP14 final acceptance — 2026-09-30

**STEP 14 PASS — STEP 15 착수 가능**. STEP15 NOT_STARTED. Independent Issue Domain/IssueService/IssueProvider, authoritative Run/Log Candidate Builder, optional AI/FixAttempt mapping, secret/local-path masking, Core-only GitHub authentication, repository validation, duplicate search, editable review, scoped explicit approval, guarded creation/reconciliation, existing Issue link and Issues GUI are implemented.

Actual GitHub E2E created exactly one explicitly approved TEST Issue: [whitecalvin/tastedev-studio #1](https://github.com/whitecalvin/tastedev-studio/issues/1). Exact approved body readback, actual duplicate search and existing link passed; repeated create and existing link performed no additional POST. Close/comment/automatic labels/commit/push were not performed. The TEST Issue remains open with the agreed title marker.

Node362/362 (Issue33 included), lint/typecheck/Web production build PASS. Production GUI Light/Dark verifies edit/masking/plain-text rendering, Cancel with zero writes, explicit fixture create, linked state, existing link and dismissal; page errors0. GUI uses TEST ONLY FakeIssueProvider and is distinct from actual GitHub provider evidence. Successful gates were reused without duplicate builds/tests. Unchanged Agent/Tauri input hashes and Agent binary were verified against STEP13; no native rebuild, installed QA or Unix retest claimed.

Limits: memory-only candidates/links/approvals/search cache; no restart durability. Uncertain POST blocks retries and supports marker reconciliation in the current session; reconciliation examines the newest100 Issues. Duplicate suggestions use bounded keyword search and may miss semantic matches. Core uses existing gh managed keyring or a Core-only token; remoteCore requires its own login. Evidence links are internal references, not public downloads. No automatic close/comment, PR, scheduler or cloud sync.

Current contract: [Issue Integration](TASTEDEV_ISSUE_INTEGRATION.md). Final result and index: product resources/verification/dev-01/tasks/tastedev-studio/step-14-20260930/RESULT.md and EVIDENCE-INDEX.md. Earlier NOT_STARTED statements are historical.


## STEP13 final acceptance — 2026-09-30

**STEP 13 PASS — STEP 14 착수 가능**. STEP14 NOT_STARTED. Approval-bound structured Patch, dirty/base/user-change protection, compensating multi-file rollback, Protocol validation, secret-filtered Workspace Snapshot, existing Core/Rust Agent retest and session FixAttempt/history/retry cap are implemented. Actual managed ChatGPT Pro gpt-6.1-sol generated the disposable service.cjs fix; explicit human approval preceded the real disk patch. Local assertion and real release Rust Agent retest PASSED, then exact source restoration preserved prior user changes. A separate synthetic wrong proposal used a real Agent FAIL to qualify failure-history/recovery; GUI Provider fixture is not counted as actual AI.

Final Node329/329, Rust Debug21/Release21, lint/typecheck/fmt/Clippy/Agent release/Web production build PASS. Production GUI validates Cancel/Apply/Diff/Protocol retest/History/Revert/Reject in Light/Dark; current unexpected page errors0. Multi-file actual disk failure/concurrent protection, masking/path/scope/retry/integrity regressions and owned-process cleanup PASS. Native local-validation/Git button manual checks, installed QA and Unix were not rerun; no Native source changed. Node has no meaningful separate optimized unit configuration; production GUI/build is the distinct production gate.

Limits: session-only attempts/Core state, text Snapshot100 files/24KiB/60KB serialized RPC; no Secret Injection; redacted file proposals rejected rather than overwriting secret placeholders. No automatic commit/push, packaging/install/deploy or STEP14 work. Actual patch approval covers the reviewed disposable file only, not future proposals. Final report distinguishes implementation, automated tests, actual Provider/Agent and unverified Native paths.

Final evidence: `resources/verification/dev-01/tasks/tastedev-studio/step-13-20260930/RESULT.md`, `EVIDENCE-INDEX.md`, `manifest.json`, `source-inputs.json` under the TASTESTUDIO product root. [AI Fix Loop](TASTEDEV_AI_FIX_LOOP.md) specifies the current contract. Earlier STEP12/13 NOT_STARTED and no-write statements below are historical snapshots superseded by this section. The model-facing AIService remains read-only; approved write/validation actions are application-mediated.


## STEP12 final acceptance — 2026-09-30

STEP 12 PASS — STEP 13 착수 가능. STEP13 NOT_STARTED.

Read-only AI Development, Failure Analysis, grounded candidates/source links, proposals and Monaco Diff are implemented. Explicit user approval preceded STEP12B actual Codex Pro transmission. Actual gpt-6.1-sol failure analysis completed with 11 unique read-only calls; masking/injection/grounding checks, unchanged source readback and production GUI passed. Actual Development evidence reused. No application source changes in STEP12B; existing Node306, scoped50/44, lint/typecheck/production build evidence retained. Session history and screenshot metadata limitations remain; no patch/apply/test/dispatch authority. No native packaging, deployment, commit or push.

Final evidence: product resources/verification/dev-01/tasks/tastedev-studio/step-12b-20260930/RESULT.md and EVIDENCE-INDEX.md. Earlier STEP11/STEP12 status paragraphs below are historical snapshots superseded by this entry.

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

## Second advancement phase6 — 2026-10-01
DEV_VERIFIED / functional PASS; final common deployment pending. Phases1–5 already DEPLOYED0.1.6–0.1.10 (phase5 source376843eb605e20b9a333512ed4b84ad4fddf44e5). Project-local analysis requests/time/reported token budgets and attempt limit, current retest Step/log/Evidence priority, readonly attempt/current Dirty editor comparisons, actual historical Run navigation, existing Git review and exact prior-analysis/retest Issue draft linkage implemented. Actual ChatGPT Pro gpt-6.1-sol proposal2 → scoped standing user approval → service.cjs patch → local arithmetic PASS → checksummed real Rust Agent Runf7a44d46-932b-4150-88f6-9cc8614ac3e6 PASS. Controlled proposal1 failed actual Run and retained history; model output not claimed for it. Source restored/unauthorized files0/secrets0/orphans0. Full555 cases with2 narrow repairs plus added issue identity test =556 current cases covered; lint/production export-TypeScript/controlled Light-Dark GUI PASS. No monetary-cost estimate, automatic commit/push/Issue publication, new runner or unrestricted shell. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-6/RESULT.md. Guide: resources/guides/dev-01/tastedev-studio/SECOND_ADVANCEMENT_AI_REVIEW.md. Installed service/DPI/updater QA remain separate; updater user-owned.

### Second advancement final delivery — 2026-10-01
All six approved phases implemented/verified and sequentially deployed:0.1.6,0.1.7,0.1.8,0.1.9,0.1.10,0.1.11. Final common pipeline exit0; release source/tag/origin at publication d644ec0e095b8f32cafac17c23b282b32e66c283. Public Windows ZIP/NSIS and Linux Agent/signature4 SHA-256 digests match local artifacts; NSIS signature Valid. DEB built/signed but not configured for publication; Core service component deferred. Actual public https://tastedev.net/en/products/studio HTTP200 includes0.1.11 and studio-v0.1.11 at2026-10-01T10:41:49Z. This final status supersedes prior pending records. Goal summary/evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/FINAL-DELIVERY.md and checkpoint.json. Installed service/DPI and user-owned updater tests remain QA; no such validation claimed. This documentation closure does not change tested application inputs and does not require another package/build.


## 3차 고도화 1단계 — Core 조회·저장·전송 개선 (2026-10-01)

암호화 SQLite entity storage v2, atomic legacy migration, indexed direct Run paging/search, changed-row persistence 및 협상형 snapshot delta를 구현했다. 합성 10,000 Runs를 실제 SQLite로 측정해 page p95 3.32ms/search 17.45ms/query heap 92.28MiB, payload reduction 95.42%를 확인했다. Node 유효 561건 및 lint/production export 통과. 실제 Agent 10,000회 또는 설치 QA 증거는 아니다. 전체 상태의 실행 참조/transaction clone은 O(N)이며 제한을 숨기지 않는다. 공용 배포 결과는 resources/verification/dev-01/tasks/tastedev-studio/third-advancement/checkpoint.json에 기록한다.


## 3차 고도화 2단계 — Agent 전송·복구 (2026-10-01)

Project-scoped Source SHA cache, Snapshot staging checkpoint, checksum/fsync 기반1MB Evidence chunk 전송과 disk offset/journal 복구를 구현했다. 실제 Core/Rust Agent 재시작 Source reuse7/7 및 단일 변경97bytes, 실제 Core/uploader 재시작, 실제 Rust Agent/Playwright6개 Evidence checksum을 확인했다. 실제 Agent를 Screenshot 업로드1MB 지점에서 종료·재시작해 남은 전송을 복구했고 테스트1회/Source 전송1회/Run AGENT_RESTARTED 실패를 보존했다. 만료된 grant/종료된 Step의 업로드는 차단하며 무제한 재실행하지 않는다. Node 유효572건(기존 full567+변경 scope22), lint 및 최신 typecheck PASS, UI export는 src 변경 후 성공한 결과를 재사용한다. Agent Debug/Release/lint/build 최종 게이트는 공용 직렬 배포에서 수행한다. 상세: resources/guides/dev-01/tastedev-studio/THIRD_ADVANCEMENT_AGENT_TRANSFER.md. 배포 결과는 third-advancement/checkpoint.json이 최종 상태다. 설치 업데이트 검증은 사용자 담당이며 Linux 실제 브라우저 복구는 미검증이다.


## 3차 고도화 3단계 — 프로젝트·언어 지원 (2026-10-01)

Rust/Python/TypeScript smoke template과 native 도구 version 확인, 안전한 JSONC relative tsconfig inheritance/alias/주요 compiler options, bounded dependency declarations와 Project settings restore를 구현했다. Monaco supported custom worker로.mts/.cts 분류를 보존하고 언어 도구 버튼 폭을 수정했다. 실제 Agent6건 PASS/의도된FAIL, 실제 Monaco worker alias/declaration/definition/Dirty/reload/Light-Dark/cleanup0을 확인했다. Windows Rust는 trusted compiler library/include 경로만 cargo/rustc에 상속하며 credential을 상속하지 않는다. Node580 유효 cases(full578+추가 scope), lint/production export-TypeScript PASS. 전체 Rust Debug/Release/Clippy/build는 공용 배포에서 실행한다. 외부 package extends/전체 tsc project references/include-exclude semantics, Python/Rust semantic LSP, Linux 실제 프로젝트 실행 및 설치 updater QA는 미검증/미지원이다. Guide: resources/guides/dev-01/tastedev-studio/THIRD_ADVANCEMENT_LANGUAGE_SUPPORT.md. 최종 배포: third-advancement/checkpoint.json.

## 5차 고도화 2단계 — Project Snapshot v2 (2026-10-02)

0.1.25: 원래 바이트 기반 binary/UTF-8 BOM/empty file Snapshot과 인증된 HTTP manifest·256KiB 재개 전송, 프로젝트별 checksum reuse, Run/Step/Agent 범위 다운로드를 추가했다. WebSocket에는 작은 Source reference만 전달한다. sourceSnapshot:2 capability가 없는 Agent는 v2 작업에서 제외된다. Protocol과 AI Retest에 연결하고 기존 승인/Dirty 보호/Queue/Pipeline을 재사용한다.

실제 localhost Core + Rust Agent에서203files/700436bytes 두 Run PASS, 두 번째202files reuse, Dummy .env 제외, 실제 HTTP interruption/prefix recovery와 권한/무결성 검사 PASS. Node650 full PASS, lint/export-TypeScript PASS. Native 최종 gate와 패키지 상태는 fifth-advancement/phase-2/local-package-checkpoint.json이 authority다. 사용자 설치/원격/GUI QA는 미실시. 102 배포·게시·설치 없음.

한도:100MiB total/8MiB file/10000files/2MiB manifest, Agent cache256entries/512MiB, Core blob512MiB/project128manifests. 자동 manifest retention, 외부 blob storage와 매우 느린 전송의 grant 자동갱신은 미지원. 상세: resources/guides/dev-01/tastestudio-fifth-advancement/PROJECT-SNAPSHOT.md. 3~6단계는 아직 순차 진행 대상이다.

## Fifth advancement phase4 — 0.1.27
Affected-file Protocol validation plans, immutable history, current Retest evidence and v2 AI Snapshot history implemented. Actual ChatGPT Pro+Rust Agent failure→fix→PASS, rollback/source hashes/secret0/orphan0 verified. Node658 effective, lint/export PASS; unchanged native gates reused by hashes. Local packages only; installed QA user-owned. Evidence: resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/phase-4/RESULT.md.

## Fifth advancement phase6 — 0.1.29 / local deliverables complete
History search/keyset navigation/cancel and stale session/project/permission response protection implemented. Analysis/Attempt navigation reuses restored AI review; no automatic approval/write/provider call. Source transfer progress is separate from actual Run/Agent/Step verification. History HTTP request/response bounds align with v2 metadata. Node667/667 PASS; full lint had one cleanup-ref warning, repaired with scoped lint PASS; final production export including TypeScript PASS. Native Debug/Release111 PASS+4 existing ignored reused from phase5 after source/toolchain/log hash verification, version/frontend Release build refreshed. Actual controlled Core GUI31 records paging/search/empty verified, browser errors0; packaged Core ready/stop PASS. Installed Native/Light-Dark/service/update/user-machine QA not run. Phase4 actual Provider+Rust Agent FAIL→fix→PASS evidence retained without duplicate calls. All six stages have local Windows installer/portable ZIP/Core runtime ZIP; user deploys/tests. No102/remote publication/install/commit/push. Evidence: resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/FINAL-DELIVERY.md and DELIVERY-INDEX.json. User guide: resources/guides/dev-01/tastestudio-fifth-advancement/WORKFLOW.md.


## Sixth advancement language context and workflow

Read-only get_language_context requires a previously read source and actual scoped Run/Step. It reports language and bounded compiler/runtime log observations; log paths never become validated source references. Existing masking, budget, tool limits and evidence validator remain authoritative. Validation impact selects only existing language-specific Protocol tasks. Actual ChatGPT Pro + approved TypeScript fix + local validation + actual local Rust Agent retest passed; source restored.

Workspace toolbar is navigation-only. Identifier-only bookmark restore waits for Core durable history, resolves real scoped analysis/attempt and loads scoped Run; it does not restore execution authority or trigger AI/write/test. Actual history reopen verified; installed GUI QA pending user.

## Orchestration managed Anthropic connection — 2026-10-03

Core now registers an optional `anthropic-api` connection when both `ANTHROPIC_API_KEY` and `TASTEDEV_ANTHROPIC_MODEL` are configured. Provider/adapter pairing and exact registered model routing protect task selection; existing default OpenAI/Codex requests remain compatible. The Messages API adapter translates only existing application read tools and a final analysis submission into the existing AIService context/grounding/history flow. It exposes no vendor execution tools or unrestricted shell. Configuration inspection is not actual provider verification. Local Node/Core/adapter fixture verification passed; external Anthropic authentication/model and installed native GUI are unverified. Setup and evidence: `resources/guides/dev-01/tastestudio-node-orchestration/AI-ANTHROPIC-ADAPTER.md` and `resources/verification/dev-01/tasks/tastedev-studio/ai-anthropic-adapter/` at the TASTEDEV workspace root.

## Orchestration managed Google connection — 2026-10-03

Core optionally registers `google-api` when `GEMINI_API_KEY` and `TASTEDEV_GOOGLE_MODEL` are configured. GoogleProvider maps GenerateContent function calls/results to the existing read-only AIService and grounded analysis. The optional ToolCall continuation preserves bounded model Part order/thought signatures within the current analysis, without a shared cache or history persistence. Continuation grants no authority: tool names/arguments must match the existing allowed read calls. Existing project authorization, exact route matching, masking and budget limits remain authoritative; usage includes thinking tokens. No vendor code execution/search or unrestricted shell is exposed. Local Core/HTTP adapter integration uses controlled model responses; actual Google model authentication/response and installed native GUI remain unverified. Setup: `resources/guides/dev-01/tastestudio-node-orchestration/AI-GOOGLE-ADAPTER.md`; evidence: `resources/verification/dev-01/tasks/tastedev-studio/ai-google-adapter/` at the TASTEDEV workspace root.

## Orchestration managed Local AI — 2026-10-03

Core registers `ollama-local` when TASTEDEV_LOCAL_MODEL is configured. TASTEDEV_OLLAMA_URL defaults to loopback port11434. Native Ollama chat maps existing read tools and final grounded analysis through AIService. Loopback-only endpoint validation, redirect rejection, cloud-model label rejection and existing exact route/project authorization apply. Local means the Core PC, not an arbitrary Agent or Studio PC. Ollama cloud disablement is an operator requirement, not automatically verified by configuration inspection. Actual loopback HTTP integration uses controlled responses; actual Ollama inference and installed GUI remain unverified. Guide/evidence: resources/guides/dev-01/tastestudio-node-orchestration/AI-LOCAL-ADAPTER.md and resources/verification/dev-01/tasks/tastedev-studio/ai-local-adapter/ at the workspace root.

## Reviewed task-node AI execution — 2026-10-03

Task Inspector now resolves a saved AI binding into a reviewed, pinned prompt/route/budget. Review cancellation or stale node/configuration/Core connection prevents submission. Existing AIState.send starts a fresh conversation and clears inherited failure context; existing AIService and provider adapters perform read-only grounded analysis. Optional node/profile metadata persists through existing analysis history and is validated by Core; it grants no write authority. Inspector links recent node results and exposes stop. Source changes and validation/retest retain existing separate approvals. Full graph automatic AI dispatch is not implemented. Node803/lint/production-TypeScript passed; actual GUI/provider execution unverified. Guide/evidence: resources/guides/dev-01/tastestudio-node-orchestration/TASK-AI-EXECUTION.md and resources/verification/dev-01/tasks/tastedev-studio/task-ai-execution/ at the workspace root.

## Core graph AI handoff — 2026-10-03

Published task bindings now pin read-only AI plans alongside Protocol plans. Graph activations enter `ai-review`; Studio shows the exact route/prompt and live saved-workspace transmission scope. Explicit approval claims a durable, single-use `ai-running` lease. Existing AIService and managed Core Provider/read-tool/grounding/history APIs run the analysis; a matching persisted analysis then completes the activation and follows success, while failure/timeout follows recovery paths. Analysis completion does not represent test PASS. A separate Protocol test node still uses existing Core/Agent execution.

Project, revision, activation, approval actor, lease and analysis lineage are checked. Repeated claim, foreign/stale result and completion after cancellation are rejected. Restart pauses graph execution and records interrupted AI as failed; reviewed resume follows its failure branch without silently replaying Provider requests. New activations require fresh review; attempts are bounded by graph/profile limits. No AI write or shell capability was added.

Boundary: Studio must remain connected for reviewed AI handoff. AI reads the reviewed live saved workspace, not a frozen Agent Snapshot. History linkage is not independently attested Provider execution. Current Studio/Core clock ordering is required. Actual Provider and installed GUI qualification were not run in this work unit. Usage and full boundaries: resources/guides/dev-01/tastestudio-node-orchestration/GRAPH-AI-EXECUTION.md. Evidence: resources/verification/dev-01/tasks/tastedev-studio/graph-ai-execution/.

## Graph verified-fix gate — 2026-10-03

AI profiles now select analysis completion (legacy default) or verified remote fix completion. The latter persists `ai-fix-review` after grounded analysis, opens existing proposal/approval/Patch/Validation/Snapshot/Retest UI, and requires a matching approved applied FixAttempt plus actual successful Core Job/Run and exact snapshot revision to follow graph success. FixAttempt lineage is linked to the stored graph analysis and immutable; retry groups are separated by graph execution/node. Explicit rejection follows failure without silently reverting Source. Restart preserves the waiting gate; cancellation/stale/foreign completion is blocked. Studio also checks current patched-file hashes before completing. No separate runner, unrestricted shell, automatic Patch/commit/push, or unattended model replay.

Saved AI policy/prompt/route/budget changes now invalidate the displayed published scope: graph start is blocked until republished. Existing executions remain pinned. Independent Fix Retest cancellation is still handled by existing Cancel Retest; graph deadline remains10min. AI reads current reviewed workspace, not an immutable Agent Snapshot. Controlled tests cover the new gate and real FixService operations in an in-memory workspace; actual Provider/Rust Agent/native GUI qualification was not run. Node823/lint/production build-TypeScript PASS. Guide: resources/guides/dev-01/tastestudio-node-orchestration/GRAPH-FIX-WORKFLOW.md. Evidence: resources/verification/dev-01/tasks/tastedev-studio/graph-fix-workflow/.

## Reviewed graph retest re-analysis — 2026-10-03

Failed Run/Snapshot proof → fresh ai-review activation → new explicit Provider approval → current failed Step/log/evidence + separately identified original Run → new persisted analysis → separate Patch approval. History records runId/originalRunId/attemptId/previousAnalysisId and exact graph lease; Core rejects mismatched lineage. Existing FixAttempt origin/retry group remains intact. Source is not automatically reverted. Deployment direct retry is blocked pending a fresh approval branch. Existing 10-minute deadline applies. Local Node827/lint/production-TypeScript PASS; controlled fixtures only, actual Provider/Rust Agent/Disk/GUI not run. Guide: resources/guides/dev-01/tastestudio-node-orchestration/GRAPH-AI-REANALYSIS.md; evidence graph-ai-reanalysis/{RESULT.md,checkpoint.json}.

## Graph immutable failed-Run Source — 2026-10-03

Graph re-analysis now reads the failed Run's completed v2 Snapshot through authenticated project-read HTTP routes. Manifest/body hashes and exact Run/Job/source identities are validated. Current editor/selection/Protocol/Git context is excluded, no workspace fallback occurs, and every Provider/Patch approval remains separate. Analysis history persists runId/snapshotId/checksum. Existing graph proof was corrected to compare revision.commit with transport manifest checksum; contentChecksum is a separate content identity. Local Node838/lint/final production-TypeScript PASS, actual localhost HTTP and controlled Core pipeline identity verified. External Provider/Rust Agent/Disk AI/installed GUI not run. Legacy/Git-only Snapshot reread and dedicated Snapshot viewer remain unsupported. Guide resources/guides/dev-01/tastestudio-node-orchestration/GRAPH-RUN-SOURCE.md; evidence graph-run-source/{RESULT.md,checkpoint.json}. Next: qualify actual reviewed Provider+Rust Agent workflow or dedicated Snapshot source review GUI. No packaging/deploy/version/commit/push.

## Snapshot Source Review — 2026-10-03

Implemented central read-only Run Snapshot review, exact identity/readable-file selection, line reveal, separately labeled captured editor/disk comparison, and dedicated current-workspace file action. Related Source and graph FixAttempt v2 Snapshot links reuse existing bounded authenticated HTTP reads; no Provider/Source write/test call. Stale response/session/dirty comparison guards and close abort verified. Local Node846 effective unique PASS, full lint and one production-TypeScript build PASS. Initial i18n omission repaired narrowly; unchanged transport cancellation timeout passed in standalone5-test recheck, original failure retained and exact cause unconfirmed. Actual GUI/Monaco visual/Provider/Rust Agent/Disk AI/package/deploy not run. Guide resources/guides/dev-01/tastestudio-node-orchestration/SNAPSHOT-SOURCE-REVIEW.md; evidence snapshot-source-review/{RESULT.md,checkpoint.json}. Next: actual reviewed end-to-end qualification; binary/legacy Source remains unsupported. Version0.1.40 unchanged.

## Graph reviewed actual qualification — 2026-10-03

Actual immutable failed Snapshot → SourceReview controller/HTTP → actual ChatGPT Provider(gpt-6.1-sol,3 requests) → delegated scoped approval → fixture disk Patch → Protocol local unit PASS → actual Rust Agent smoke PASS → verified graph completion → Revert original hashes PASS. Initial/controlled failed Runs were retained and reused after sandbox routing discovery failure; fresh approved graph execution/lease used after restart, interrupted original graph retained FAILED. Graph service uses a qualification in-process bridge over actual persisted analysis/attempt and Core Run; production graph HTTP/managed-connection/AI gateway/GUI click integration remains unverified. GUI visual/package/deployment not run. Runtime inputs383/build artifacts3/logs6 match previous checkpoint; Node846/lint/production-TypeScript results reused without duplicate gates. Version0.1.40 unchanged. Guide resources/guides/dev-01/tastestudio-node-orchestration/GRAPH-REVIEWED-ACTUAL.md; Evidence resources/verification/dev-01/tasks/tastedev-studio/graph-reviewed-actual/{RESULT.md,checkpoint.json}. Next: qualify actual Studio GUI + managed connection workflow and address any review-return UX gaps.

## Graph review navigation — 2026-10-03

Implemented authority-free project/execution/activation/node/analysis bookmarks for graph AI analysis/proposal/Snapshot review. Shared AI return strip restores exact graph execution/node; missing/stale activation is reported without latest-execution fallback. Snapshot close restores prior Proposal/index, new analysis clears stale bookmarks. No implicit Provider/Patch/validation/retest/approval. Node849 unique/full lint/production-TypeScript1 build PASS; changed UI3 lint rechecked narrowly. Browser existing orchestration observed Core disconnected/folder permission required; new navigation/Monaco click and managed-connection whole E2E remain unverified. No Rust/Core protocol inputs changed; no external call/package/deployment/version/commit/push. Guide resources/guides/dev-01/tastestudio-node-orchestration/GRAPH-REVIEW-NAVIGATION.md; Evidence resources/verification/dev-01/tasks/tastedev-studio/graph-review-navigation/{RESULT.md,checkpoint.json}. Next: disposable Studio GUI + actual managed connection workflow qualification.

## Managed graph wire qualification — 2026-10-04

ACTUAL_MANAGED_WIRE_PASS_GUI_PENDING. Added qualification harness using actual authenticated Core WebSocket graph RPC, HTTP managed registry/chatgpt-account, HTTP AI gateway/RemoteAIProvider and persistent History; no runtime source changes. Existing original failed Snapshot reused. Actual gpt-6.1-sol (3 requests, 8 read tools) generated service.ts proposal, scoped delegated verification approvals recorded, fixture disk Patch and Protocol unit PASS, actual Rust Agent smoke Retest 977db7fc-4b16-4025-bb93-14b2b520df93 PASS, graph managed-wire PASS, Revert baseline hashes independently verified. Secret exposure/unauthorized files/owned orphan processes 0. Historical failed scenarios reused, not rerun; some read assertions remain in-process. All385 input hashes, production artifacts3 and prior logs matched: Node849/lint/production-TypeScript reused without duplicate compilation/tests. GUI approval/Snapshot/proposal return clicks and installed qualification remain unverified. No packaging/deploy/version/commit/push. Guide resources/guides/dev-01/tastestudio-node-orchestration/MANAGED-GRAPH-WIRE.md; evidence resources/verification/dev-01/tasks/tastedev-studio/managed-graph-wire/{RESULT.md,checkpoint.json}. Next: disposable actual Studio GUI managed-connection/review-return qualification.

## Analysis history graph return — 2026-10-04

Implemented authority-free graph origin restoration when selecting persistent Analysis History or Attempt Proposal/Diff. Exact project/execution/activation/node/analysis bookmark is copied without lease/approval; ordinary/incomplete analysis has no graph target, foreign-project record is rejected. Existing overview resolver never chooses a newer activation. Node851/851, full lint, one production build/TypeScript PASS. Actual browser existing project → AI → graph smoke and captured console errors0; Core disconnected/no history/folder permission required, so actual persisted history/Snapshot/proposal return clicks remain unverified. No new Provider/Agent/Patch/Retest/package/deploy/version/commit/push. Evidence resources/verification/dev-01/tasks/tastedev-studio/history-graph-return/{RESULT.md,checkpoint.json,ai-screen.png}; guide resources/guides/dev-01/tastestudio-node-orchestration/HISTORY-GRAPH-RETURN.md. Next: isolated GUI project with matching persisted Core History.

## Actual persisted Core GUI review — 2026-10-04

DEV_VERIFIED_GUI_REVIEW_PASS. Added development-only isolated review setup using existing WorkspaceShell and normal Core authentication, with no automatic approval/Provider/write/test and no existing graph overwrite. Production route404 verified. Actual SQLite/source-store copy restored real model analysis and three historical Attempts through Core HTTP History. Visible UI confirmed Proposal Monaco Diff → original failed Snapshot authenticated viewer → close restores same Proposal ID/Diff → exact managed-wire execution/repair node return → Graph Fix Review reopens same proposal. Captured browser error logs0, new analyses/attempts0, fixture Source hashes unchanged, verification process cleanup0. Prior385 inputs/test log matched, Node851 reused; new route full lint/production-TypeScript1 build PASS. No new Provider/Agent/Patch/Retest/installer/package/deploy/version/commit/push. Guide resources/guides/dev-01/tastestudio-node-orchestration/ACTUAL-GUI-REVIEW.md; evidence resources/verification/dev-01/tasks/tastedev-studio/review-gui/{RESULT.md,checkpoint.json,graph-return.png,snapshot.png}. Prior GUI history/Snapshot/proposal-return gap is now qualified in development browser; installed/native and dirty current-disk comparison remain unverified. Next: distinguish historical read-only execution review from local configuration reconciliation needed for new execution.

## Historical review / new execution readiness — 2026-10-04

DEV_VERIFIED_GUI_PASS. Separated read-only graph proposal review from dirty local graph mutation blocking; existing lineage/session checks and publish/start/AI/finish/reject/re-analysis approval guards retained. New execution readiness labels unpublished/unsaved/graph mismatch/AI mismatch/ready; explicit historical-read-only explanation. Actual persisted Core clone GUI showed AI mismatch and dirty graph block new start while same proposal opens and returns to managed-wire/repair. No new Provider/write/test/approval, source/history unchanged, captured errors0, verification processes0. Node effective853/853 after initial852 PASS+1 Korean catalog coverage FAIL repaired and affected i18n9 rechecked; full lint plus final changed-file lint PASS, final production-TypeScript PASS (initial build invalidated by catalog repair, no full test rerun). Other locales new-copy English fallback remains. Evidence resources/verification/dev-01/tasks/tastedev-studio/execution-review-readiness/{RESULT.md,checkpoint.json,gui.png}; guide resources/guides/dev-01/tastestudio-node-orchestration/EXECUTION-REVIEW-READINESS.md. No package/deploy/version/commit/push; installed/native remains unverified. Next: captured historical execution/source/revision identity presentation.

## Captured execution identity — 2026-10-04

Historical execution details show captured execution/project IDs, configuration version, graph and Protocol checksums, timestamps and optional Source identity. No latest-configuration substitution. Actual persisted Core clone GUI verified managed-wire metadata and explicit absence of graph-level Snapshot. Source-present branch was not visually verified. Node853/853, full lint and production-TypeScript build PASS. No new Provider/Patch/Agent/Retest; history3/3 and fixture Source hashes unchanged. Browser errors0. Verification processes independently absent after session cleanup. Native/installer not verified. Evidence: resources/verification/dev-01/tasks/tastedev-studio/captured-execution-identity.

## Selected node context menu — 2026-10-04

Implemented right-click selection, portal menu, existing node settings and four layer actions, kind-specific settings navigation, graph-only removal, keyboard open/navigation/dismiss/focus return. Mutation storage/lock/drag protections retained; no execution/approval/Provider access. Node853/853/full lint/production-TypeScript PASS after new UI invalidated previous build. Actual browser verification blocked by browser URL security policy; GUI/native/installer remains unverified. Production localhost4318 restarted; version0.1.40 unchanged. Evidence node-context-menu/{RESULT.md,checkpoint.json}; guide NODE-CONTEXT-MENU.md. No package/deploy/commit/push.

## Selected node workflow navigation — 2026-10-04

DEV_VERIFIED_LOCAL_CHECKS_PASS / GUI_UNVERIFIED. Replaced generic six shortcuts with task Implementation/Validation/Execution results/Failure analysis/Fix proposal stages and persistent selected node/execution context. Non-task settings variant; existing tools reused; no implicit Provider/approval/write/execution. Analysis constrained to exact project/node/execution/activation; stale/missing identity has no fallback. Four identity tests. Full Node856 PASS+1 missing translation repaired with related13 PASS, effective857 unique PASS. Full lint+changed-file lint and final production-TypeScript PASS; initial typecheck failure retained, compilation invalidated by repair. GUI/native blocked/unverified; existing workspace diagnostics and Source browsing not redefined as Run-specific data. Evidence node-workflow/{RESULT.md,checkpoint.json}; guide NODE-WORKFLOW.md. Production4318 ready, version0.1.40 unchanged; no package/deploy/commit/push.


## 2026-10-24 역할 기반 팀 오케스트레이션

역할 팀 초안, 판 관리 작업 의도/결정, 게시 그래프의 장비·Agent·책임·AI 배정, Core 권한 정책, 현재 시도별 품질 근거, 영속 수신함/중복 요청 복구, 승인된 프로젝트 규칙을 기존 Graph/Factory/Fix/AIService 위에 연결했다. 독립 검토와 실제 시험 요구를 유지하며 자동 실행·배포·외부 메시지 권한은 추가하지 않았다. 상세 계약과 제한: [팀 오케스트레이션](TASTEDEV_TEAM_ORCHESTRATION.md). 검증 현황은 `resources/verification/dev-01/role-team-orchestration-20261024/checkpoint.json`에서 구분한다. 기존 ChatGPT 인증의 `401 token_revoked`를 재로그인 경로 보강과 사용자 로그인으로 해결했다. 실제 `gpt-6.1-sol` 분석 7건, 두 수정 작업, 독립 검토, 실제 Rust Agent의 실패 재현·재시험·최종 통합 PASS, 설계/문서 역할의 읽기 전용 분석을 검증했다. 자동 검증용 범위는 사용자의 포괄 승인을 기록했으며 개별 diff의 사람 수동 검토로 주장하지 않는다. 1~8단계 구현 및 검증 결과는 동일 근거의 `RESULT.ko.md`를 따른다. 최종 대조에서 초안 카드의 기존 노드 겹침, 팀 검토 역할 선택, 수정된 작업 의도를 이전 계약으로 재시도하는 경계를 추가로 보호했다.


## 2026-10-24 팀 실행·운영 고도화

실행 전 점검, 실제 Graph/Factory 인계, 검토한 계획의 일괄 Queue 승인, 계약별 Source/재테스트 추적, 역할·Agent·장비 관계 상태, 인계 복구, Core의 팀 AI 정책 및 현재 근거 기반 완료 보고를 연결했다. 같은 프로젝트 쓰기는 기존 잠금으로 직렬화하고 Agent 재테스트 작업 공간은 Snapshot별로 분리한다. 동일 프로젝트 병렬 Git worktree 수정/자동 병합을 구현했다고 주장하지 않는다. 설계·문서 분석과 구현·실제 테스트 완료를 구분하며 설치 패키지·배포는 사용자 담당이다. 계약·한계·사용법은 [팀 실행·운영](TASTEDEV_TEAM_EXECUTION.md), 최종 근거는 `resources/verification/dev-01/team-execution-advancement-20261024/RESULT.ko.md`를 따른다.


## 2026-10-26 — 작업별 Git 격리와 검토 통합

작업별 detached worktree, 독립 프로젝트 창, 기준/원본/사본 비교, 승인 기반 통합, 충돌 해결, 기존 Fix journal/되돌리기, 통합 원본 Snapshot의 기존 Core/Rust Agent 재테스트, 비파괴 보관·복원과 Source identity 기반 관계 표시를 추가했다. 통합안은 실제 모델 분석으로 위장하지 않는 별도 immutable FixAttempt lineage를 사용한다. 모델·Agent·화면·설치 검증은 구분한다.

구조·사용법·파일 생성/삭제 등의 현재 제한은 [작업 공간 격리와 통합](TASTEDEV_PARALLEL_WORKSPACES.md), 실행 결과는 `resources/verification/dev-01/parallel-worktree-20261026/RESULT.ko.md`를 따른다. 실제 Provider → 승인된 사본 Patch → 원본 통합 → 실제 Rust Agent PASS와 별도 해결되지 않는 통합 FAIL/복원은 검증했다. 전체 Rust Debug/Release에서는 현재 작업과 무관한 기존 업데이트 테스트 2개 실패가 남아 전체 green으로 표시하지 않는다. 패키징·설치·배포는 실행하지 않았다.


## 2026-10-26 — 업데이트 회귀 마감 및 원본 작업 통합 완료

이전 기록의 업데이트 테스트 2개 실패는 현재 공용 Flow와 다른 테스트 기대값이었다. 제한 환경 밖에서는 preference 저장이 통과했고, 최종 실패는 두 테스트 모두 `workspace-busy` 기대였다. 다운로드 허용과 준비 후 종료/설치 보호, 협력 종료 commit 정책을 유지하면서 해당 테스트를 보강했다. 관련 Debug/Release는 통과했으며 production updater 동작을 바꾸지 않았다. 이전 실패 로그는 보존했다.

사본의 성공한 Source를 원본의 Core 통합 요청으로 제출하고, scoped proposal review·원본 실제 재테스트·독립 AI 검토·명시적 수락을 원본 Factory completed와 연결했다. 완료 proof와 completion intent는 복원되며, 실행하지 않은 Graph 상태를 위조하지 않는다. 같은 프로젝트 후속 작업이 통합 전 Source를 실행하는 것도 content checksum으로 차단한다.

구조·사용법·제한은 [통합 요청과 원본 완료](TASTEDEV_INTEGRATION_HANDOFF.md), 최신 근거와 결과는 `resources/verification/dev-01/integration-handoff-20261026/RESULT.ko.md`를 따른다. 패키징·설치 시험·배포·commit/push는 이 작업에 포함하지 않았다.


## 2026-10-31 — 통합 검토함과 후속 작업 소스 검토

통합 검토함의 상태 필터/검색, 보수적 3-way 충돌 합치기, 승인된 UTF-8 파일 생성/삭제/이름 변경(삭제·생성 쌍), idle 후속 계약의 새 Source 검토/기록과 재승인 흐름을 구현했다. 기존 Fix journal·Snapshot·Core·Factory를 재사용하며 자동 적용·실행 승인은 추가하지 않는다. 구조 변경은 Native만 지원하고 새 디렉터리·바이너리·submodule은 지원하지 않는다. 독립 검토는 원본 immutable Run Snapshot과 삭제 부재 citation에 근거한다.

전체 Node 1095 PASS(Node24.22.1), Native Debug 유효49 PASS/5ignored(실패10개만 환경 분리 재검증), Native Release49 PASS/5ignored, lint/typecheck/fmt/Clippy 및 웹/native optimized build PASS. 웹은 기존 STUDIO_DISABLE_BUILD_CACHE=1 옵션으로 잘못 재생된 Turbopack worker 실패를 분리했다. GUI는 실제 Core DB 사본+synthetic IPC의 검토함 검색/필터/충돌 합치기/밝게·어둡게만 확인했으며 새 실제 Provider/Agent E2E·설치본·Linux 합격을 주장하지 않는다. 상세 제한과 재현: TASTEDEV_INTEGRATION_HANDOFF.md 및 resources/verification/dev-01/integration-review-20261031/RESULT.ko.md. 패키징/서명/게시/설치/commit/push 없음.

## 오케스트레이션 운영 5단계 — 2026-10-31 DEV_VERIFIED

실제 AI/Agent 구조 통합, 겹치는 통합 대기열·명시적 우선순위, 장비 역할/OS/동시성/시간 정책, 선행 성공 스케줄, 실행 단계·이력·대기 재배정을 기존 Core/Factory/Graph/Scheduler 경로에 연결했다. 실전 검증에서 같은 관계도의 새 Source 재검토가 막히던 비교 오류를 수정했다. 승인·권한·프로젝트·불변 Source·stale 상태 경계를 유지하며 실행 중인 Run은 이동하지 않는다.

Node 전체1109 PASS 후 변경된 Factory/통합33 PASS(신규1), 역할/Graph25 PASS(신규1)로 재확인했다. 최종 유효 테스트는1111개이며 단일 전체1111 실행으로 표현하지 않는다. lint/typecheck, Web production export, Native Release 컴파일 PASS. 변경 없는 Rust Debug/Release 각49 PASS/5ignored는21개 Native 입력 해시를 확인해 재사용했다.

실제 gpt-6.1-sol 분석·수정안, 실제 Rust Agent 원본 재시험 PASS, 독립 실제 모델 검토·통합 완료, 후속 Source 재검토·별도 queue·Graph 시작을 확인했다. 후속 작업 완료·새 Native GUI 쓰기·설치/Linux 운영/패키징 검증과 구분한다. 사용 안내: `docs/TASTEDEV_ORCHESTRATION_OPERATIONS.md`. 결과와 정확한 재개/검증 경계: `resources/verification/dev-01/orchestration-operations-20261031/RESULT.ko.md` 및 Evidence Index.

## 제품 오케스트레이션 연계 — 2026-10-31

Factory 선행·후속 계약은 현재 Graph/input/Source 신원으로 재검토하고 각 queue/AI/Patch/결과 검토 권한을 유지한다. 실제 모델 구현·독립 검토4회와 후속 실제 Agent Test 완료를 확인했다. 수락된 수정본을 새 Snapshot으로 게시한 뒤 빌드/산출물 Test/전달 승인을 별도 실행한다. 아직 반영되지 않은 AI 변경을 이전 Snapshot으로 빌드하지 않는다. 기존 AI Read/Propose/scoped Write를 재사용하며 새 unrestricted shell·자동 commit/push는 없다.

Scheduler 추가 retry는 Protocol Test0–2회에 한정한다. Graph/AI/배포 승인은 재생하지 않는다. Core 재시작은 paused로 남기고 동일 Graph/input/Source 및 남은 기한을 검토해 성공 Run을 유지한다. 수동 실패 재시도는 최신 실패 activation에 새 Attempt를 만들며 배포는 새 승인으로 돌아간다. v2 vendored Source 전송은 로컬 Core/Agent용이며 전체 프로젝트를 외부 모델에 보내는 권한이 아니다. artifact grant는 승인된 step/실행 기한 내에서만 유효하다.

실제 TASTEFILES 검증은 고정된 CLI Snapshot/물리PC1대·논리Agent3개이다. 컴파일 성공 바이트 재사용·실제 copy Test·동일 checksum private staging을 확인했다. 원본 ui-kit의 별도 변경을 보존했고 desktop GUI·운영 설치·원격 장비 검증은 주장하지 않는다. 사용법과 보안/복구/정확한 근거는 `TASTEDEV_PRODUCT_ORCHESTRATION.md` 및 `resources/verification/dev-01/product-orchestration-20261031/RESULT.ko.md`를 따른다.


## 2026-11-01 — Claude-Code-Game-Studios / Godot 연동 검증

고정 commit `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418`의 파일439개·역할49개·스킬74개를 원문/checksum과 함께 보존했다. 프로젝트의 플랫폼/엔진 분리, 선택 팀 노드, 전체 프롬프트, 원본 설정 출처·파생 값·rigor/automation 편집을 연결했다. `frameworkRuntime:1` opt-in Agent, 공식 SDK0.3.316/Claude2.1.296의 고정 실행기와 영속 FrameworkSession을 기존 Core/Queue/Protocol 경로에 통합했다.

실제 Claude `/dev-story` → Godot4.7.2 조작·렌더링 → 별도 원본 Diff 승인/반영 → 실제 Rust Agent 재시험 → 새 Snapshot 승인 → 후속 테스트 PASS를 확인했다. 실제 Core 재시작 후 같은 native session/격리 폴더 재개와 잘못된 ID 거부도 통과했다. 별도 Studio Provider(gpt-6.1-sol)의 기획·수정 제안·독립 검토를 확인했고, 원본 변경0과 기존 사용자 변경 보존·실제 rollback을 검증했다. GUI는 production 웹과 실제 DB 사본/IPC 모사로 밝게·어둡게 확인했다.

지원 완료 범위는 제한된 Godot 원본 실행과 Studio 역할 연동이다. 전체74스킬·무제한 원본 Shell 호환을 주장하지 않는다. Unity/Unreal은 정의/설정 준비까지이며 실제 Linux/설치본 GUI/설치·업데이트 시험과 패키징·배포는 수행하지 않았다. 버전0.2.8 유지. 사용법·지원 경계: `docs/TASTEDEV_GAME_STUDIOS.md`; 정본 결과/근거: `resources/verification/dev-01/ccgs-20261031/{RESULT.ko.md,EVIDENCE-INDEX.md,checkpoint.json}`.


CCGS 후속 보안 경계: 모델 완료 후 실제 Diff·봉인 Source checksum·Godot 버전·고정 Protocol 인자에 대한 별도 검증 승인을 요구한다. 원본 Apply 승인과 분리하며, 거절·취소·만료·stale Source는 실행을 차단한다. 이 실행기는 OS sandbox가 아니며 Agent 계정 권한으로 승인된 게임 코드를 실행한다.

## 2026-11-01 — 2단계 실행 격리 중간 검증

Core 격리 계약과 실행 프로필 보호, bounded Source mirror, 운영자 프로그램 카탈로그·실제 복사 SHA 검증, suspended leaf Job·자식 제한·소유 프로세스 정리·typed timeout/cancel을 추가했다. 일반 Agent Debug는 기존72건 통과(실패/중단9건만 동일 이미지로 재개)와 새 카탈로그4건의 개별 근거를 보존한다. 관련 Release14 PASS/실기5ignored, 카탈로그 Release4 PASS, Agent test-target Clippy PASS다. 단일 전체 최신 녹색 실행이나 전체 production lint로 표현하지 않는다.

실제 raw AppContainer의 파일/네트워크/자식/환경 차단은 확인했지만, 공유 UI 경로의 입력 Desktop 연결 가능성을 발견하여 채택하지 않았다. 독립 private Window Station 후보의 권한 환경 검증을 요청했으며 아직 실기 결과가 없다. executionIsolation capability 광고와 실제 required-policy 실행은 계속 차단한다. 프로그램/Source/산출물 broker·journal/복구·실제 Godot/Native 연결은 미완료이며 전체7단계 목표를 유지한다. 패키징·설치·출시·102배포·commit/push 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/STAGE-2-UI-DIAGNOSIS.ko.md 및 checkpoint.json.

## 2026-11-01 — 2단계 Source manifest 실행 신원 보존

Snapshot 준비 완료 후 Source 밖에 본문·환경값·전송 credential 없는 sealed-source.json을 배타적으로 게시한다. 프로젝트/Run/Snapshot 신원과 manifest checksum, 전송 checkpoint 및 현재 Source의 누락·추가·변조를 다시 검사하는 loader를 추가했다. 이 파일은 broker 소유 로컬 기록이며 서명이나 동일 사용자 host 공격 방어라고 주장하지 않는다. Source 준비의 실제 게시 경로는 연결했고 loader의 격리 실행 broker 소비는 미완료다.

최신 Agent 전체 Debug 79 PASS/실기 전용 5 ignored, 관련 Snapshot Release 11 PASS, strict test-target Clippy PASS. Release Agent 컴파일은 성공했지만 미연결 격리 후보 코드로 42 warnings가 남는다. 첫 제한 실행의 hard-link 실패와 동일 이미지 일반 권한 재개 PASS 로그를 함께 보존했다. 실제 private UI qualification과 프로그램/산출물 broker·소유권 복구, 후속 3~7단계는 미완료이며 전체 목표를 유지한다. 패키징·설치·출시·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2SealedSource와 runtime-progress-receipts.

## 2026-11-01 — 2단계 격리 준비 broker와 선언 결과 수집

sealed Source receipt를 읽어 source 하위 cwd만 허용하고, 전체 Agent workspace 밖 운영자 카탈로그의 프로그램을 SHA 검증하여 새 소유 프로필에 복사하는 내부 준비 경로를 연결했다. 프로그램 쓰기·삭제와 runtime 상위 폴더 교체를 handle 잠금으로 막으며 Drop 순서에서 잠금을 먼저 해제한 뒤 해당 프로필만 정리한다. 실제 새 프로필의 통제된 복사본·잠금·정리는 Debug/Release 실기로 확인했지만 복사한 fixture는 실행하지 않았다.

선언된 최대16개 결과를 bounded bytes/SHA로 수집한다. 원본 Source는 전후 검사하며 원본에 자동 반영하지 않는다. 경로/secret 파일명·중복·누락·크기·활성 Windows writer·junction/reparse·hard-link 참조를 거부한다. 결과 수집은 프로세스 종료 후 호출해야 하며 실제 executor의 생명주기 및 기존 전송 소비 연결은 미완료다.

최신 Agent 전체 Debug82 PASS/6ignored, 관련 isolation Release14 PASS/6ignored, 실제 프로필 준비/잠금/정리 Release1 PASS, test-target strict Clippy PASS. Release Agent 컴파일 성공/미연결 후보 코드 경고48개. 실제 OS 프로세스/UI qualification, 실행/framework broker, 전송, 소유권 journal/복구와 3~7단계는 미완료다. 단위 검증을 실제 Provider/Agent 프로그램 실행이나 Native GUI로 보고하지 않는다. 새 capability 광고·패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2PreparedBroker.

## 2026-11-01 — 2단계 실제 Agent 시작 시 소유 자원 복구 연결

Agent/project/Run/Job/Step·Snapshot/Source checksum·등록 프로그램 checksum·정확한 AppContainer 이름/SID/OS 경로를 exclusive journal로 묶었다. 새 durable claim에 isolation 요청 여부를 기록하고 실제 Agent 시작의 미완료 claim 경로에서 소유 프로필만 복구한 뒤 AGENT_RESTARTED 실패 결과를 저장한다. 이전 작업은 다시 실행하지 않으며 legacy claim은 기존 동작을 유지한다. 복구 실패는 failed result에 명시하고 journal을 보존한다. 정리 전 깊이64/항목65536/누적 경로16MiB를 검사하고 reparse link 자체만 제거한다.

고정 SHA의 실제 Release Agent 실행 파일을 Dummy 인증·별도 workspace·연결되지 않는 localhost endpoint로 시작하여 소유 프로필 정리, 원래 claim/host canary/별도 control profile 보존과 재실행 없음을 확인했다. 만든 Agent는 소유 Job으로 종료·wait했다. 실제 격리 child 실행·Core 작업·AI·Godot·Native GUI나 전체 crash lifecycle의 증거로 확대하지 않는다.

최신 Debug85 PASS/8ignored, 관련 Release17 PASS/8ignored, 명시적 Release 실기 소유권/준비/실제 Agent startup 각1 PASS, test-target Clippy PASS. Release Agent 컴파일 성공/미연결 코드 경고45개. profile 생성/초기 header 기록 중 crash window, pending/ACK 자원 복구, qualified 실행/framework/output broker 및 private UI qualification은 미완료다. 전체7단계 목표와 2단계 진행 상태를 유지한다. 내부 미활성 경로이므로 기존 다국어 next 원고를 보존하고 새 사용자 실행 기능 완료로 쓰지 않았다. 패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2OwnedRecovery 및 agent-recovery-candidate.json.

## 2026-11-01 — 2단계 pending/ACK 정리 경계와 별도 관찰 기록

실제 Agent 시작 시 interrupted/pending-result/acknowledged 세 상태 모두에서 정확한 소유권 journal을 검사·정리하도록 연결했다. 기존 task result와 ACK는 그대로 보존하고 정리 성공/기완료/차단은 claims 아래 내용 기반 불변 observation으로 따로 남긴다. 동일 관찰은 최초 timestamp를 보존하며 중복 생성하지 않고 손상·충돌 기록은 덮어쓰지 않는다. bounded identifier만 기록하여 잘못된 객체 필드의 Dummy 민감 값이 복사되지 않음을 검사했다.

고정된 실제 Release Agent로 세 상태의 소유 프로필 정리, task result/ACK·claim·host canary·별도 control profile 보존 및 비재실행을 Debug/Release harness에서 확인했다. Release 최초 fixture가 observation만 보고 pending 결과 게시 전에 Agent를 종료한 경합은 대기 조건만 수정하고 실패 게이트부터 같은 Agent 이미지로 재개했다. 실패 로그는 보존했다. 실제 Source child/Provider/Core 테스트/Godot/Native GUI 또는 전체 crash lifecycle 증거로 확대하지 않는다.

Debug86 unique PASS/8ignored·관련 Release18 unique PASS/8ignored는 full gate 이후 변경된 regular metadata fixture만 추가 재검증한 범위 재사용이며 최신 단일 전체 실행으로 표현하지 않는다. 명시적 Release startup/소유권/준비 검사와 test-target Clippy PASS. Release Agent 컴파일 성공/미연결 경고45개, 테스트 전용 후속 변경에 앱 이미지는 재빌드하지 않았다. 초기 생성/header crash window, qualified 실행/framework/output broker와 private UI qualification 및 3~7단계는 남아 있다. 내부 미활성 경로로 기존 다국어 next 원고 보존, 패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2CompletedClaimRecovery.

## 2026-11-01 — 2단계 현재 소스 Windows 비공개 UI 메커니즘 실기 PASS

관리자 실행 결과의 requestId·고정 이미지 SHA·로그 SHA·현재 전체 입력 해시를 검증했다. 후보7c31b91b0a2c497e8294d6249a65f582의 controlled2 tests PASS: 실제 자식 진입 후 outside Dummy 읽기/쓰기·loopback·자식·부모 Dummy 환경 차단, 정확한 private station/desktop·비대화형 station·host station/input desktop 전환 차단·외부 canary window 차단을 확인했다. timeout/cancel 모두 ready=true 후 owned process exit와 profile 제거를 확인했다. screenDcDenied=false는 확인된 private station DC 획득 관찰값이며 host pixel-copy 검증으로 확대하지 않는다.

이전 관리자 후보의0xc0000142 초기화 실패는 기존 고정 이미지·로그·manifest archive에 보존했다. 명시적 station\\desktop 연결/상속 UI handle 제거, NUL·전용 anonymous pipe, bounded capture/종료, 실제 진입·종료 확인으로 수정한 조합이 통과했다. 단일 설정만 원인이라고 단정하지 않는다. 기존 객체 ACL·서비스·방화벽·설치·사용자 프로젝트를 변경하지 않았다.

초기 profile 생성 전 정확한 이름·Agent/project/Run/Job/Step·Source/program 신원을 durable reservation으로 기록하고, 소유권 미확인 상태는 자동 삭제 대신 정확한 이름의 review로 보존한다. 완전한 owner와 예약이 다르면 정리를 거부한다. 실프로필/실제 Agent 시작의 review 경로도 검증했다. OS 메커니즘의 관리자 context PASS와 production runtime self-check/실행/framework/output/Core/Godot/Native GUI 미통합을 분리한다. Agent executionIsolation 광고는 계속 비활성이고 결과 파일로 capability를 켜지 않는다.

새 binding/stdio 단위 Debug/Release PASS, source -Dwarnings test-target Clippy PASS(cache hardlink fallback warning 별도), 관련 reservation/preparation Release 실기 PASS. 현재 Release Agent 컴파일 성공/미통합 경고55개. 기존 Agent87/9ignored·관련 Release19/9ignored는 UI 수정 이전 근거이며 최신 단일 전체 실행으로 보고하지 않는다. 전체7단계 목표는 유지, 2단계 진행 중/3~7 대기, 패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2PrivateUiVerified 및 runtime-progress-receipts.

## 2026-11-01 — 2단계 production 자체 검사 자식 진입점

실제 Agent의 내부 `--isolation-self-check-child` 경로를 Config/Core/인증 환경 읽기보다 앞에 연결하고 controlled test와 공통 probe를 사용하도록 분리했다. 호출자가 지정한 경로를 읽기 전에 실제 AppContainer token·정확한 owned private station/desktop·비대화형 UI를 요구한다. 보고서는 private cwd의 새 파일로만 생성하며 기존 파일을 덮어쓰지 않는다. loopback canary만 허용하고 외부 쓰기 검사는 내용을 변경하지 않는 write-access open으로 확인한다. 자식 차단이 실패해도 재귀 실행되지 않도록 검증용 자식은 유효하지 않은 내부 명령으로 즉시 종료한다.

고정한 실제 Release Agent를 일반 호스트 token에서 실행한 3조건(sleep/boundary/invalid)이 모두 파일 접근·대기 전에 exit1로 거부되었다. Dummy 원본 보존·report/ready 미생성·Dummy credential 미출력·자식 종료 wait를 확인했다. 제한 도구 환경 자체가 AppContainer인 첫 실행은 일반 token 전용 오류 문구 기대와 달라 실패했으며, 동일 이미지의 일반 호스트 실행에서 PASS했다. 이 차이를 보호 경계 실패나 양성 격리 실행 PASS로 바꾸지 않는다.

동일 후보 Debug 전체 inventory101개 중 79개 제한 환경 PASS, HTTP/junction 실패·미완료12개만 동일 SHA 이미지로 일반 환경에서 재개하여 PASS(합계91 PASS, 기본10 ignored). 관련 Release는 21 PASS/2 junction 실패/10 ignored 후 같은 이미지의 실패2개만 재개 PASS(합계23). 기본 ignored 중 실제 Agent 호스트 거부1개는 별도 실행 PASS다. 단일 환경 전체 suite 또는 모든 ignored 실행 완료로 보고하지 않는다. test-target source Clippy -Dwarnings PASS(cache hardlink fallback warning 별도), Release Agent 컴파일 성공/미통합 경고53개. 초기 test-only 메서드명 컴파일 실패와 제한 환경 실패 로그는 보존했다.

앞선 관리자 후보7c31b91b0a2c497e8294d6249a65f582의2/2 PASS는 그 당시 입력 해시에 대한 실기 근거로 유지한다. 이번 probe 분리로 입력이 달라졌으므로 새 production 자체 검사의 양성 격리 실행·parent qualification이 통과했다고 간주하지 않는다. capability는 계속 비활성이다. parent live self-check·catalog admission·실제 command/structured output/결과 전달·Core/framework/Godot 연결은 남아 있다. 2단계 진행 중/3~7 대기, 사용자 기능으로 아직 제공하지 않는 내부 경로이므로 기존 다국어 next 원고를 보존했다. 패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2ProductionChildProbe 및 runtime-progress-receipts.

## 2026-11-01 — 2단계 실제 Agent 시작 경로의 live qualification

선택적 operator `isolationCatalog`를 Config에 추가하고 실제 Agent 시작에서 취소 처리 준비 후/Core 작업 수락 전에 live 자체 검사를 실행한다. catalog는 Agent 작업 영역 밖에 있어야 한다. 현재 Agent 이미지를 해시 고정·복사·잠금하고 새 owned AppContainer에서 고정 자식 진입점을 실행한다. 부모의 Dummy 파일·loopback·숨긴 자체 canary window 기준선을 먼저 확인하며 인증값은 전송하지 않고 환경 변수 이름의 자식 부재만 검사한다. 필수12개 보호 결과와 명시적 profile/journal 정리가 모두 성공해야 현재 프로세스의 자격 객체와 배타 handle을 보관한다. 저장된 보고서로 자격을 복원하지 않는다.

자체 검사는 Core 프로젝트 Run이 아닌 분리된 내부 namespace를 사용한다. context 공개→durable 예약→OS 생성 순서를 유지하고 재시작 시 정확한 owner/예약을 복구한 뒤 새 신원으로 진행한다. context만 있고 owner/예약이 모두 없으면 생성 미시작으로 처리한다. 기존 예약의 불명확한 소유권·다른 Agent·기록 충돌은 자동 진행하지 않는다. 기존 context는 보존한다.

실제 Release Agent를 동일 disposable workspace에서 두 번 시작한 실기가 PASS했다. 현재 일반 사용자 context에서는 private station 생성이 Win32 5로 거부되어 두 번 모두 qualified=false였다. 매번 정확한 profile 정리·Agent 종료 wait·기존 Source canary 보존·Core claim0·서로 다른 새 검사 신원·Dummy credential 미출력을 확인했다. 양성 자격/성공한 격리 명령/Provider/Godot 검증으로 확대하지 않는다.

전체 Agent Debug95 PASS/11 기본 ignored, 관련 Release27 PASS/11 기본 ignored, 기본 ignored 중 위 실제 시작·재시작1개 별도 PASS. source test-target Clippy -Dwarnings PASS(cache hardlink fallback warning 별도), Release Agent 컴파일 성공/미통합 경고16개. 최초 bootstrap 재시작 단위 실패는 context 공개 후 예약 전의 생성 미시작 분기를 수정한 근거로 보존했다. 이번 후보의 단계 완료 full Release/전체 E2E는 미실행이다.

격리 명령의 frozen invocation·구조화 출력·선언 결과 전달·runtime/child policy 조합과 양성 production Agent/Godot/Native GUI는 아직 미통합이며 capability는 계속 비활성이다. 2단계 진행 중/3~7 대기. 사용자에게 아직 제공되지 않는 내부 startup 진단이므로 기존 다국어 next 원고를 보존한다. 패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2LiveAgentQualification 및 runtime-progress-receipts.

## 2026-11-01 — 2단계 기존 executor의 격리 명령·출력 연결

기존 executor의 격리 분기를 process-local 자격 객체·고정 catalog·sealed Source 준비와 연결했다. Agent/root 일치, 프로그램 복사 hash/lock, private cwd, args/env/timeout 고정, 준비 시간을 포함하는 실행 예산, Original Source 전후 검사와 명시적 profile/journal 정리를 적용한다. Source를 원본으로 자동 반영하지 않는다.

실제 native anonymous pipe reader에서 UTF-8 복원·기존 Redactor 적용 후32개×최대4096-byte의 bounded 큐에 넣고, 부모가 기존 job/run/step/sequence output event·OutputSummary로 전달한다. Core live 출력1MiB 예산을 재사용한다. 느린 소비자는 손실/partial을 기록하고, 연결 해제는 소유 프로세스 취소로 연결한다. capture 오류는 성공으로 숨기지 않으며 reader 종료는 bounded다. 관측 경로는 raw 진단 tail을 보관·출력하지 않는다.

정책 또는 executionIsolation 요구사항 중 하나라도 있으면 격리 게이트를 거친다. 정책 누락으로 일반 실행에 빠지지 않으며, capability 재검사도 Source 지정 PATH/runtime을 호스트에서 조회하기 전에 자격 확인을 한다. 자격이 없는 요청은 workspace 생성·marker 실행·출력 없이 실패한다. credentials·runtime override·broker metadata 환경 변수는 private 명령에 주입하지 않는다.

최종 Agent Debug103 PASS/11 기본 ignored, 관련 Release39 PASS/11 기본 ignored, 실제 준비/profile/program lock/Source 보존 및 새 실제 Agent 시작·재시작2개 별도 PASS(기본 ignored 중2개 실행,9개 미실행). 실제 anonymous pipe·split UTF8/secret·손실 집계·held writer·disconnected consumer를 검증했다. 양성 private child→Core 출력 E2E로 확대하지 않는다. 정책 누락 방어를 추가해 초기103 PASS 후보가 무효화되어 최종 후보로 재검증했으며 초기 로그는 보존했다. final test-target source Clippy -Dwarnings PASS(cache hardlink fallback 별도), Release Agent 컴파일 성공/미통합·진단 경고6개.

capability는 계속 비활성이다. 현재 framework/browser/service/artifact transfer 및 미구현 runtime-version 조합은 거부한다. 이 거부를 지원 완료로 간주하지 않는다. 전용 trusted Source 준비, 선언 산출물 전달, runtime/version/child policy 계약과 성공한 production 격리 명령/Core/Godot/Native GUI 검증은 남아 있다. 2단계 진행 중/3~7 대기, 기존 다국어 next 원고 보존(미공개 내부 경로 보호·연결이며 신규 사용 가능 기능으로 광고하지 않음), 패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2CommandOutputBroker.

## 2026-11-01 — 2단계 선언 산출물 전달·Step 소유권

private 자식 종료 후 명령 cwd 기준 선언 파일만 단일-link/no-reparse·바이트/hash·민감값·모든 전송 grant token 검사를 거쳐 수집한다. 모든 파일의 검사가 끝나기 전 HTTP 요청이나 복구 staging을 시작하지 않는다. Source8MiB/file·100MiB 전체 제한은 유지하고, 빌드 결과는 기존 Artifact128MiB/file 기준과 captured batch128MiB resident-byte 제한으로 분리했다. 원본 Source를 결과 경로로 다시 읽거나 덮어쓰지 않는다.

부모 전용 Job/Step별 디렉터리에 번호 binary와 immutable manifest를 sync·공개한다. project/run/job/step/cwd·입력 Snapshot/Source/program identity·Graph identity·선언 artifact ID/name/mode/size/hash를 보관하고 credential/URL은 기록하지 않는다. 불완전 staging은 성공이 아니며 기존 자료를 덮거나 자동 실행 재개하지 않는다. private profile/journal 정리 후 기존 인증/no-proxy/no-redirect 업로더를 재사용한다. 격리 pipeline은 host input 설치와 원본 output 재읽기를 건너뛰며, 자격 확인 전 session/workspace/network 동작을 막는다. input 전달은 아직 거부한다.

Graph metadata를 실제 sealed Snapshot/project와 대조하고 child env에서 제외한다. Snapshot Source 준비는 live-context의 고정 data-only broker로 분리해 Source executable/args 권한과 혼동하지 않는다. 미구현 Git/다른 실행·runtime-version/child-policy 조합은 완료로 간주하지 않는다.

Job-only owner/reservation 파일명이 후속 Step과 충돌하는 문제를 Step별 경로로 수정했다. 기존 Job-only closed 기록은 보존·읽기 지원하고 같은 Step replay를 거부한다. 복구는 header의 정확한 Step identity까지 비교하며, 불명확한 이전 예약을 자동 삭제하지 않는다.

최종 전체 Agent Debug114 PASS/11 기본 ignored, 관련 Release54 PASS/11 기본 ignored, 실제 준비·새 Agent 시작/재시작·중단/결과대기/ACK/생성검토 복구3개 별도 PASS(기본 ignored 중3 실행,8 미실행). 실제 loopback HTTP captured-byte 인증 전송·뒤 파일의 다른 grant token 발견 시 전 요청 차단·Source보다 큰 Artifact 허용/Source 제한 유지·cwd mapping·Step 충돌/legacy/replay·credential 없는 manifest·Source 보존을 확인했다. 이는 컴포넌트 전송 근거이며 private 자식→실제 Core/Godot 성공 E2E로 확대하지 않는다. 초기 Debug의 기존 Node 검사1건5s timeout은 같은 이미지 단독 재개에서 통과했고 원인은 미확정이다. timeout 변경 없이 로그를 보존했다. Artifact 제한 수정으로 이전 후보를 무효화한 뒤 최종 전체114/관련54가 통과했다. 최초 타입/fixture 접근/모듈 배치 검사 실패도 보존했다.

최종 test-target source Clippy -Dwarnings PASS(cache hardlink fallback 별도), Release Agent 컴파일 성공/진단 경고4개. 기존 일반 산출물에도 적용되는 민감값 검사·검사 중 취소/시간 제한 확인만25개 언어 next 원고에 추가했다. 격리 기능 전체를 출시 완료로 광고하지 않는다. capability는 계속 비활성이고 양성 production private command/Source/result/Core/Godot·runtime/child/input 계약·전송 복구 UI·Native GUI가 남아 있다. 2단계 진행 중/3~7 대기, 패키징·설치·배포·커푸 없음. 정본: resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json의 stage2DeclaredResultTransfer.

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

## Stage4 actual Native foundation and command registration — 2026-11-01

Native lifecycle verification uses the existing production Core/AI/approval/patch/integration/Agent services and an owned disposable workspace; no alternative AI runner or fake bridge was added. Corrected Native app-manifest/capability registration for11 existing project/Git/language/debug handlers. Managed windows remain main/task-* with no remote or unrestricted-shell grant; handler workspace/hash/approval checks remain authoritative. Real UI note save/Git diff/restart restore are foundation evidence only. Existing Studio ChatGPT account currently requires user login; actual Provider/Agent patch-loop verification is not yet complete. Auto-review rejected direct empty Native Git IPC probes; they were not executed or bypassed. Existing GUI readonly queries supplied the narrower runtime proof.

Evidence: `resources/verification/dev-01/orchestration-completion-20261101/STAGE-4-RESULT.ko.md` and `stage-4-native-foundation.json` pin55 Native inputs, both executables, logs and5 actual GUI images. Version0.2.8 unchanged;25-language next-release draft updated. No package/install/sign/deploy/product commit/push.


## 2026-11-02 — 실제 Native 재시험 진행 기록

4단계는 PARTIAL이다. 실제 ChatGPT Pro 분석(9e7dfdb2, gpt-6.1-sol)의 제안을 Native GUI에서 별도 범위 승인으로 적용·Git Diff 확인·되돌리기했다. 제출이 거부된 시도의 in-flight 상태는 실제 Core queue 확인과 durable admission 폐쇄 후 실패로 복구하며, 알 수 없는 네트워크 결과는 기존 job을 찾아 중복 생성하지 않는다. 승인된 Fix 재시험의 산출물 전송은 저장된 Proposal/실행 승인 hash/Snapshot을 확인하는 서버 권한 경로를 사용한다. Graph 전용 prefix 위조나 일반 job의 권한 완화는 하지 않는다.

실제 Rust Agent의 재시험 aed19568,887c2ac7는 Snapshot·구문 Build·Cleanup 통과 후 Test 단계에서 각각 신원 필드 누락/엄격한 격리 context 해석 문제로 실패했다. 최종 수정은 기존 7필드 TASTEDEV_GRAPH_CONTEXT wire 계약에 실제 FixAttempt ID·Protocol Test·attempt·Snapshot 신원을 담으며, 원본 Graph 실행 승인으로 간주하지 않는다. Agent/격리 정책은 변경하지 않았다. 최종 compile/generate 정상 종료, 직접 영향 검사4건 통과. 이전 전체 Node1200건 결과는 후속 UI/wire 변경 전 기록이며 현재 전체 PASS로 재포장하지 않는다. 이전 기본 Web build의 마지막 memory-allocation 실패도 보존했다.

필수 격리를 수행할 수 없는 Native 로컬 검증은 실행 전 차단된다. 사용자 메모 hash 보존과 원본 Source hash 복원을 확인했다. 기본3회 RETRY_LIMIT은 Native 화면에서 실제 차단했다. 검증 프로젝트4회 설정 변경은 자동 승인 검토가 안전 통제 완화로 거부해 적용하지 않았으며, 구체적1회 추가 승인을 기다린다. Source/Patch 승인과 테스트 실행 승인은 계속 별개다. 실제 Test PASS·산출물·원본 반영·후속 Source·Native 전체 오류 검증은 남아 있다. 한 차례 Native 창 종료 원인은 아직 확정하지 않았다. 5~7단계 및 패키징은 시작하지 않는다.

정본: resources/verification/dev-01/orchestration-completion-20261101/stage-4-native-retest-progress-20261102.json 및 stage4-runs/efb23c54-c997-48ef-9e96-69a95b6d99ff/native-*.json. Native Rust 입력55개는 이전 manifest와 차이0으로 확인해 기존 Native 테스트/Clippy/빌드 근거를 재사용한다. 검증용 Core51658/Agent는 소유 세션이며 운영 배포·버전·패키징·커밋·푸시를 수행하지 않았다.


## 2026-11-02 — 승인된 4번째 실제 재시험 PASS 및 Native 보호 검증

앞선3→4회 설정 변경은 사용자가 구체적으로 승인한 뒤 GUI에서 적용했다. 기존3개 시도 이력은 보존했다. 실제 Provider 분석9e7dfdb2의 제안을 새 Proposal28302b1f로 별도 승인·적용하고, remote-test 실행도 별도 승인했다. 실제 Rust Agent d432e2ea의 Run731673e4가 Snapshot/Build/Test/Cleanup4단계 모두 종료0으로 PASS했다. Test 로그 MOVEMENT_PASS, Snapshot d115b41d, manifest7c2eadaf와 실제 산출물 checksum6d0fe094를 대조했다. 원래 실패 Snapshot의 Source/Test와 실제 AI originals hash가 같고, 재시험 Snapshot에는 승인된 Source2와 기존 사용자 메모가 포함됨을14회 blob hash 검사로 확인했다. .env/.git은 제외됐다. 정본 stage-4-native-fix-pass-audit.json.

Native 미저장 편집에 대한 Revert 거부는 디스크·버퍼를 보존했지만 불필요한 recovery-required 상태로 바꾸는 결함을 실제 GUI에서 발견했다. preflight 거부 전에는 상태·완료 journal을 변경하지 않도록 수정했다. 관련29건, 이를 포함한 AI/Fix/Snapshot/통합/프레임워크217건 통과, 관련 lint 및 공식 Web compile/generate exit0. 같은 입력의 Rust/Agent 검사·빌드는 반복하지 않았다. 수정 후 실제 Native에서 DIRTY_EDITOR 거부와 저장된 사용자 변경의 PATCH_CONFLICT 거부가 applied 상태·내용을 보존함을 확인했다. 검증용 추가 편집을 제거하고 Revert하면 Source는 원래 b6f26b42 hash로 복원되며 열린 Editor도 return1/dirty0으로 동기화됐다. 사용자 메모 aa3a4390 hash와 과거 실제 PASS Run은 보존했다. 이는 되돌린 현재 Source의 테스트 PASS를 주장하는 것이 아니다.

4단계 전체는 여전히 PARTIAL이다. 별도 Native 격리 작업공간·원본 반영·후속 Source 흐름은 아직 완료하지 않았다. 기존 Git worktree 경로는 명시된 committed-head 계약을 사용하며 현재 disposable fixture에 HEAD가 없어 실제 GUI 기준 검사가 보존된 오류로 종료됐다. staged7개 파일의 검증용 초기 기준 커밋 미리보기를 native-integration-baseline-preview.json에 준비했으며 제품 자동 Commit 금지와 구분해 별도 승인 대기 중이다. 커밋/푸시를 실행하지 않았다. 이 기존 worktree 경로를 CCGS의 saved-Working-Tree Snapshot 실행 완료로 대신 기록하지 않는다. 5~7단계는 시작하지 않았다. 현재 세션 stage4-runtime.json의 Core/Agent 만료 시각을 따른다.


### 2026-11-02 — Native 격리 작업 공간·원본 통합 검증 진행

사용자가 승인한 검증용 초기 커밋 `28c480d258310a5e73adc969b61933f0b44803e1`을 disposable 프로젝트에만 생성했다. 기존 원본 메모 변경은 보존했다. 별도 Native 작업 창에서 수정한 Source의 실제 Rust Agent Run `3672f453-80f6-4a83-a0ac-bc2c74636583`은 PASS다. 부모 원본 반영 완료를 의미하지 않는다. 실제 검수에서 독립 작업 계약 선택 누락과 입력 없는 제출 확인창의 무응답을 수정했고, 자식 Snapshot에 부모 기준 커밋을 보존하도록 보강했다. 관련 workspace 7건·통합 계약 23건, 변경 범위 lint 및 typecheck는 통과했다. 웹 compile/generate는 실패 단계 재개 후 exit 0이다. 실제 Native 확인창 응답과 stale Source 거부를 확인했고, child Graph v2에 올바른 부모 기준 커밋 Snapshot을 게시했다. Turbopack IPC 오류·Webpack EPERM과 기존 import 경고는 보존했다. 기존 2시간 세션은 정상 종료됐고 동일 DB의 새 Core를 준비했으며 관리자 Agent 재실행을 기다린다. 올바른 기준 신원의 자식 재시험·원본 반영·원본 재시험·독립 검토·후속 Source 확인이 남아 4단계는 PARTIAL이다. 초기 Git 승인 대기는 해소됐다. 패키징·제품 커밋/푸시는 하지 않았다. 정본: `resources/verification/dev-01/orchestration-completion-20261101/stage-4-native-integration-progress-20261102.json`.


### 2026-11-02 — 원본 통합 및 실제 Agent 재시험 PASS

올바른 부모 기준 커밋을 보존한 child Graph v2의 실제 Run `88105d8b-fb66-4157-91e5-a1b90349b162`이 PASS해 통합 요청을 제출했다. Native Diff 검토와 별도 승인으로 `src/service.cjs`만 원본에 적용했다. 원본 Run `71445a7d-a596-4884-b71a-a3201abc02e2`는 실제 Rust Agent의 Snapshot/Build/Test/Cleanup 모두 exit 0이다. 원본 Snapshot `f30d94bb-753d-41dd-b314-c7272d80b1f6` checksum `69775936458a7956d340fe277373e5f84f57caa20b60de590986bd1b57cfa12c` 및 Source/산출물 해시를 검증했다. Source는 승인된 result hash, 기존 사용자 메모는 aa3a4390 hash를 유지한다. child/parent 14개 blob과 결과 산출물 actual=2/expected=2를 대조했다. 실제 Native Editor return2/dirty0 및 밝은/어두운 실제 Git Diff를 확인했다. 정본 `stage-4-parent-integration-audit.json`, `stage-4-parent-actual-git-diff.patch`, `stage-4-native-integrated-*.jpg`.

4단계 전체는 PARTIAL이다. 독립 실제 AI 검토는 자동 승인 검토가 새 전송 범위의 명시적 승인 부족으로 거부해 **WAITING_FOR_USER_APPROVAL**이며 전송하지 않았다. 최소 범위 미리보기는 `INTEGRATION-REVIEW-TRANSMISSION-PREVIEW.json`이다. 독립 검토·통합 완료·후속 Source 검증을 마치기 전 다음 단계로 넘어가지 않는다. 기존 2시간 Core/Agent는 정상 종료했고 같은 DB의 새 Core를 준비했다. 관리자 Agent 재실행 요청은 권한 재승인이 아닌 실행 환경 확보다. 이번 추가 작업은 검증·문서뿐이며 현재 6개 품질 입력 해시가 이전과 같아 기존 검사를 재사용했다. 앱 재컴파일·패키징·제품 커밋/푸시는 하지 않았다.


### 2026-11-02 — 4단계 실제 Native 라이프사이클 완료

결과: **DEV_VERIFIED_NATIVE_LIFECYCLE**. 실제 Provider `gpt-6.1-sol`의 독립 검토 `36a9f23c-10ef-495e-bff1-dfda328108b7`는 승인된 두 파일과 실제 원본 PASS Run을 읽었고, 제외한 사용자 메모 내용·Dummy secret 전송 0을 확인했다. Provider 4회·도구 9회, 완료 조건과 실제 파일/Run 근거가 일치한다. 통합 요청 `e7c30c53-5093-4d6c-a322-4285eadec2a5`를 Native에서 별도 확인해 completed 처리했다. 후속 계약은 이전 Source에서 새 Source로 명시적으로 재검토했고 draft로 유지해 자동 AI 실행을 만들지 않았다. Graph v3의 기존 Protocol/Queue/실제 Rust Agent 후속 Run `63361daa-e3ea-49a1-8cbf-21dc342428d2`가 PASS했다. 후속 Snapshot과 수락한 원본 Snapshot은 신원은 다르지만 실제 contentChecksum `97deedc837b1471f40a899564e2c052a2b8533e4483dfc1a2b3e4a684f25742a` 및 7개 파일 신원이 같다. 실제 렌더링 게임 검증은 5단계 범위이며 이 Node 테스트로 대신하지 않는다.

마감 Node 1,205건 중 1,196건 통과 후 PowerShell PATH가 없어 실패한 DPAPI 9건만 같은 소스·정상 경로로 재개해 9건 모두 통과했다. **1,205 unique PASS**이며 단일 전체 green 실행이라고 기록하지 않는다. 전체 lint exit0, Native 입력55개·Agent Rust 입력은 해시 일치로 기존 Debug/Release/Clippy/빌드를 재사용했다. JS에 별도의 Debug/Release 테스트 모드가 없어 중복 구성을 만들지 않았고, 최적화 웹 compile/generate는 별도 근거로 유지했다. 후속 실행의 owner journal2개 CLOSED, 작업 자식 orphan0을 확인했고 실행 중 Agent의 conhost1개는 정상 수명으로 보존했다. 정리 경고는 과거 Run887c2ac7의 prelaunch CAPABILITY_MISMATCH로 owner/reservation을 만들기 전에 거부된 기록이며 현재 PASS Run과 분리했다. 과거 불명 Native 종료 기록은 보존하되 현재 재시작/연결/실행 성공과 섞지 않는다.

정본: `stage-4-final-audit.json`, `stage-4-native-follow-on-run-passed.jpg`. 5단계를 시작한다. 패키징·설치·서명·운영 배포·제품 커밋/푸시 없음.

## 오케스트레이션 완성 5단계 마감 — 2026-11-02

상태: **DEV_VERIFIED_NATIVE_GODOT_MINIMAL**. 원본 minimal 여섯 스킬을 실제 Claude Code 2.1.296와 실제 framework Rust Agent에서 실행했다. 부족했던 화면 증거·행동 검증은 강화된 실제 테스트와 보관된 게임 PNG로 보완한 뒤 원본 story-done이 스토리를 Complete로 변경했다. 엔진 설정은 실제 Agent Run 및 원본 coherence 5항목 일치/차이0/미검사0, 기존 Godot 역할5개의 Version Awareness로 추가 확인했다. 수출 preset·gdUnit4 설치는 이 최소 경로의 범위가 아니다.

프레임워크 Source 준비는 빠졌던 공개 엔진 참조46개를 고정 commit에서 별도 package로 가져온다. 원본439개 정의 bundle과156개 카탈로그 항목은 바꾸지 않았다. 기존 프로젝트 문서는 보존하고 없는 문서만 검토 Snapshot에 보충한다. 원본 바이트/SHA는 보존하며 Snapshot의 표시 사본은 공개 URL query/fragment를 명시적으로 생략한다. 비밀 제외 정책을 완화하지 않았고 사용자 문서의 비밀 값은 공용 문서로 바꿔치기하지 않는다. 이 데이터도 desktop compile cache 입력에 포함했다.

엔진 설정4개와 게임·기획·검증8개 파일은 다른 task/proposal의 별도 Diff/승인으로 반영했다. 각 제안의 기존8파일 제한을 유지했다. 원본 재시험 **62788538-0176-40e0-96fb-1fbad0994113 PASS**, 후속 실제 Graph **5e6f1c54-4b73-47f0-b752-b568c5d89e39 PASS**이며 수락한 Source 바이트 내용 해시가 같다. 실제 Agent에 전달된64개 파일의 크기/SHA를 검증했고 Dummy .env는 원본에서 보존/전송에서 제외했다. PNG는 실제 Core/검증 근거로 보관하고 원본 바이너리 자동 병합은 하지 않았다.

Studio Provider는 별도로 실제 OpenAI의 producer·godot-specialist·qa-lead3개 역할을 실행했다. 승인된 두 파일/선택 Run·로그/공개 역할만 읽었으며 이미지 본문은 전송하지 않았다. QA가 접근하지 못한 초기 Run·장면 파일과 미검증 행동을 불확실성으로 남긴 점도 원문에 보존했다. 실제 추가 행동 검증과 Source 비교는 별도 운영자/Agent 근거이며 AI가 수행했다고 쓰지 않는다.

품질: 최종 Node1215/1215·lint·typecheck·운영 webpack compile/generate PASS. JS에는 별도 Debug/Release 테스트 구성이 없어 중복 구성을 만들지 않았다. 불변 Rust입력33개와 고정 Agent SHA를 확인해 기존 범위의 native 근거만 재사용했다. 물리 held-key 검증은 미판정이며 엔진 action 주입 PASS를 물리 키보드 PASS로 대체하지 않는다. 정제된 Agent 환경의 shader cache 경고, 미지원 Unix/Unity/Unreal 실전 검증과 전체 원본 Shell/rigor 호환은 제한으로 남는다.

정본: `resources/verification/dev-01/orchestration-completion-20261101/{stage-5-final-audit.json,stage-5-qualification-inputs.json,STAGE-5-RESULT.ko.md,EVIDENCE-INDEX.md}`. 단계6 장애 복구를 이어간다. 패키징/설치/배포/버전·태그/커밋·푸시는 수행하지 않았다.



## 오케스트레이션 완성 6단계 — 장애 복구·반복 실행

상태 **DEV_VERIFIED_RECOVERY**. 완료된 모델 작업과 검증 실패를 분리했다. Core/GUI는 완료된 턴의 resume을 거부하고 저장된 정확한 중단 세션만 재개한다. 전체 이벤트를 축약해도 완료 여부가 유지된다. 봉인된 변경과 기존 Protocol Godot 계획만 사용해 검증을 재시도하며 새 모델/Shell을 실행하지 않는다. 원본 검증1회+최대2회 재시험, 요청 ID별 승인·Source·Job·Run 이력을 영속화한다. Job 생성/연결 사이 중단 복구와 Core 정규화 후 중복 요청도 같은 Job을 재사용한다.

실제 Claude /start가 완료되고 봉인 Source 검증 승인을 기다릴 때 소유 Core/Agent를 종료한 뒤 동일 DB로 재시작했다. 기존 승인 만료·세션/Source 보존·모델 재실행 거부를 확인했고 실제 Agent Godot Run **05cede37-7d35-4222-bb1a-f43aa5b0d69e PASS**, 렌더링 증거1개와64개 Source 바이트/SHA를 검증했다. 원본12개 반영 파일과 Dummy .env는 그대로이고 비밀 전송0이다. 보존된 실패 fixture의 검증 전용 Run2818d69c는 예상대로 FAIL, Source/cleanup은 PASS이며 과거 모델/실패 이력은 유지된다. 실제 Node timeout/cancel·소유 프로세스 종료, Source 전송 응답 유실 후 재개, 중복 요청·만료 승인·다른 Source·잘못된 Dummy Core 인증 차단도 확인했다. 실제 Provider credential을 폐기하거나 auth 장애를 유도하지 않았다.

실제 Native 검증 창에서 완료 턴의 재개 버튼 부재, 별도 재시험 PASS 이력, 밝게/어둡게 화면과 Diff 기반 재시험 승인 범위를 확인했다. 승인 대화상자 취소가 새 시도를 예약하지 않는다. 실행 자체의 실제 검증은 production RPC/Agent로 별도 수행했으며 GUI 클릭 실행으로 바꿔 쓰지 않는다. 검증 프로필의 프로젝트 메타데이터만 seed했고 새 프로젝트 생성/폴더 연결 완료를 주장하지 않는다.

품질: 전체 Node1225 중1224 PASS/번역1 FAIL 후 해당 i18n9 PASS, 변경 retry7 PASS(신규1), 최종 UI 키 검사1 PASS로 **고유1226건 PASS**다. 단일 전체 green run으로 표현하지 않는다. 전체 lint/typecheck 및 변경 파일 후속 검사 PASS. 최종 웹 compile/generate 후 실제 index/workspace/404 HTML까지 확인했다. split generate의 성공0만으로는 HTML 내보내기를 보장하지 않는 문제가 발견돼 고정 Next 자체 export를 새 프로세스/App Router 모드로 재개했다. 이전5단계 export 로그/해시는 보존하되 그 기록만으로 완전한 HTML export를 주장하지 않는다. Rust입력33개는 고정 후보와 일치해 기존 범위 근거만 재사용했다. 패키징/설치/배포/버전·태그/제품 커밋·푸시는 없다.

정본: `resources/verification/dev-01/orchestration-completion-20261101/{stage-6-final-audit.json,stage-6-qualification-inputs.json,STAGE-6-RESULT.ko.md}`. 다음은7단계 실제 제품의 작은 격리 작업이다.


## 실제 제품 원본 반영 검증 — 2026-11-02

상태 **DEV_VERIFIED_REAL_PRODUCT**. 승인된 두 파일의 실제 ChatGPT/OpenAI 분석·독립 검토, 격리 Patch와 실제 Rust Agent 회귀, 별도 원본 반영 승인, 원본 재시험, 게시 Graph 후속 Source 검증까지 완료했다. 초기 Run cc549603은 잘못된 크기 단위를 실제로 재현했고, 원본 Run29fa7bba 및 최종 Agent Run **d5910ae3-d5c2-48b0-900c-a04ec2662436 PASS**에서 회귀2건이 통과했다. 최종 Agent SHA는 **e5c6dcc23196f45762054b2ef4a9f923169a38ce71ba8a71a6099482808bb9c0**다. 두 Source 파일과 지원 언어별 변경 원고만 원본에 반영했으며 무승인 변경0이다.

승인 전 원본 target hash를 확인했다. 분석 기준 e86ab92 이후 다른 세션의 UI-kit 커밋032e114가 생겨 최초 반영을 중단했다. 승인 대상 파일이 동일하고 관련 없는 UI 변경임을 확인한 별도 preflight를 기록한 뒤 같은 파일 내용 승인으로 반영했다. 승인/제안 이력을 다시 쓰지 않았으며 실제 Snapshot 기준은032e114, 분석 기준은e86ab92로 구분한다. 후속 Source913개 파일의 바이트/SHA와 checksum f9569c073e061be412bc3b397e1fe4369b721c06038967217119e4f59675ce8e을 실제 Agent 작업 공간에서 확인했다. 일반 작업 트리 격리이며 이 실행을 OS sandbox로 표현하지 않는다.

실제 검사에서 v2 vendor 경로의 History 저장 오류와 대량 출력 연결 손실을 수정했다. Core/Agent의 선택적32개 output receipt,64개 채널+1개 대기 프레임, 정확한 Run/Job/Step/sequence 검사와 결과 전 출력 drain을 적용한다. 제어 이벤트는 출력 창을 소비하지 않는다. timeout을 늘리거나 출력/실패를 숨기지 않았다. cargo/rustc에만 공개 CARGO_TARGET_DIR을 전달해 기존 컴파일 캐시를 재사용한다. 모델 도구·자동 승인·Shell 권한은 확장하지 않았다.

품질: Node 고유1227건 PASS는 전체1226 PASS/heartbeat fixture1 FAIL 후 해당1건 수정·재검증한 **합성 결과**다. 단일 전체 green run은 아니다. Rust Agent Debug/Release 각각140 PASS·13 ignored, strict Clippy·Release build·변경 파일 format PASS. TASTEFILES 영향 라이브러리는 Debug/Release 각각327 PASS·5 ignored, 크기 단위 회귀2 PASS, Core all-target Clippy·최적화 library build PASS다. 넓은 Debug package 검사는 기존 extraction_names의 빈 한글 디렉터리 복원 실패가 있었고 수정 전 원본에서도 동일하게 재현했다. 해당 Run은 FAILED로 보존하며 전체 TASTEFILES suite PASS를 주장하지 않는다.

55개 Native 입력과 기존 실제 EXE,217개 최적화 Web 산출물의 SHA를 확인했다. 프런트엔드 입력은 같아 기존 Native/HTML export 근거를 재사용하고 불필요한 재빌드·화면 반복 검사는 하지 않았다. 7단계 실행은 production Core/API/Agent 검증이며 실제 Native GUI 수명주기는4단계 근거로 구분한다. 소유 검증 Core/Agent는 종료했고 잔류0, 사용자 Native 창은 보존했다. 패키징·설치·배포·버전/태그 변경·commit/push는 수행하지 않았다.

마감 중 다른 세션이0.2.35 출시 준비 커밋에 수정·테스트를 포함하고 원고를 docs/releases/v0.2.35.md로 옮겼다. 해당 변경은 보존했다. 이번 actual Run은 저장된0.2.34 Snapshot에 대한 근거이며 새 버전/패키지 검증으로 재사용하지 않는다. 이 세션은 버전 변경·commit/push를 수행하지 않았다.

현재 정본: `resources/verification/dev-01/orchestration-completion-20261101/{stage-7-final-audit.json,stage-7-qualification-inputs.json,STAGE-7-RESULT.ko.md,FINAL-RESULT.ko.md,EVIDENCE-INDEX.md}`. 이전 승인 대기·실패·후보 기록은 보존하며 현재 상태와 혼합하지 않는다.
