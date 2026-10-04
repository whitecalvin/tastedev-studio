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
