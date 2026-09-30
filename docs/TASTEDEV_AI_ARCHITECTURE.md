# TASTEDEV AI Architecture — STEP 12

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

