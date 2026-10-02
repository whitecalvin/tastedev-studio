# TASTEDEV Test Orchestration — STEP 10

## 4차 고도화 로컬 패키지 마감 (2026-10-02)

1~6단계0.1.18–0.1.23 COMPLETE_LOCAL_PACKAGES. 사용자 최신 범위에 따라 배포·설치 테스트는 사용자 담당입니다. Windows signed installer/ZIP12개와 Core runtime ZIP4개를 resources/packages/tastestudio/fourth-advancement에 보관했습니다. 총16개 artifact SHA-256, installer/payload signature, Core archive manifest/file hash를 확인했습니다. 102 전송/실행, 서비스 설치, GitHub/홈페이지 게시를 수행하지 않았습니다.

4단계: 기존 새 실패 Evidence/Attempt 비교/Protocol validation/승인 경계를 재사용하고 모델·설정 단가 기반 비용 추정과 실패 요청 metrics를 추가했습니다. 사용량/모델 미확인과 추정 한도 초과 시 후속 호출을 중단합니다. 실제 Provider 청구 상한은 아니며 단가를 임의 지정하지 않습니다.
5단계: 실제 source revision/snapshot checksum, 저장된 검증 정의/환경, dispatch 당시 보고된 Agent 환경에 기반한 Run/Step/Evidence 비교. 시간은 startedAt→finishedAt이며 Source/환경 미기록을 비교 가능으로 추측하지 않습니다. slowdown/flaky는 후보일 뿐 확정 결함이 아닙니다.
6단계: project/live/run 선택 후 clone, collection별 read, 전체 SQL aggregate, 전체 Evidence usage/retention, schema3 projection migration/atomic rollback/reopen, 최근100개 종료 Run의 Agent 실행 문제 조회. source/Job body 없이 전체 통계를 계산합니다. full detached write transaction/startup load는 유지됩니다.

최종 Node629 distinct effective PASS(614 unchanged full +15 scoped final), failure/skip0. 전체 lint+최종 관련 lint, desktop production export/TypeScript PASS. Native source/dependencies/config/toolchain fingerprint와 로그를 검증해 phase3 Debug/Release106각 PASS·fmt/Clippy를 재사용했고, 버전/정적 자산 변경에 필요한 Release executable만 재빌드했습니다. Node에는 별도 Debug/Release 테스트 설정이 없어 가짜 중복 환경을 만들지 않았습니다.

로컬 SQLite1500건 전체 집계·active Evidence 보호·동일 transaction rollback·v2 migration/reopen 및 실제 Core bundle start/ready/stop/exit0 확인. 10000 Run8회 synthetic read 측정은 full254.32ms→selected17.03ms; 운영 성능 보장이 아닙니다. Native GUI/실제 Provider/GitHub/실제 장비 Agent/서비스/장기 운영/업데이트 설치는 사용자 QA이며 미실행입니다. package 준비를 해당 외부 QA PASS로 기록하지 않습니다.

증거: resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/checkpoint.json, DELIVERY-INDEX.json, phase-4~6/RESULT.md. 배포·사용법: resources/packages/tastestudio/fourth-advancement/README.md 및 resources/guides/dev-01/tastestudio-fourth-advancement/*.md. 이 작업으로 새 commit/push/tag를 만들지 않았습니다.


## STEP11 acceptance — 2026-09-30

STEP 11 PASS — STEP 12 착수 가능. Node264 distinct + Runner2; Rust Debug18/Release18; actual Chromium/Agent Browser6 groups, legacy Agent11 and Pipeline14 distinct groups; artifact integrity/sanitization and production GUI PASS. Final Web build OHcgxvcH8WgtoEaRSzBQv; Agent/Web/Desktop no-bundle builds PASS. UI reviewer resolved its one spacing finding and returned ship. Exact scope, gate reuse and limitations: workspace resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930/RESULT.md. STEP12 NOT_STARTED.

## STEP11 current implementation — 2026-09-30

Browser/e2e TestPlan steps now execute official Playwright Test on the separate Rust Agent. Real Chromium capability probing, isolated contexts, failure screenshots/traces, Console/Page Error/Network/Test Report evidence, bounded authenticated binary transfer, LocalArtifactStore, SHA-256 verification and Studio Evidence Viewer are implemented. [Browser Evidence](TASTEDEV_BROWSER_EVIDENCE.md) is the current contract. The STEP11 task evidence under resources/verification/dev-01/tasks/tastedev-studio/step-11-20260930 determines final acceptance. Core history remains memory-only; binary artifacts persist separately. STEP12 NOT_STARTED. Earlier STEP11-unimplemented statements below are historical.

## STEP10 acceptance — 2026-09-30

STEP 10 PASS — STEP 11 착수 가능. Node253 distinct, Agent Debug17/Release17, real pipeline14 groups and legacy Agent11 groups PASS. Final production GUI4 groups PASS (errors0); Agent/Web/Desktop no-bundle builds PASS. Final evidence: resources/verification/dev-01/tasks/tastedev-studio/step-10-20260930/RESULT.md in the workspace. STEP11 NOT_STARTED. Native GUI/installed QA were not rerun.

Protocol declares WHAT; Core owns the plan, assignment and state; the independent Rust Agent executes each structured step; Studio displays the existing Job and Run. No project-name or framework branches are present. STEP 11 is not implemented.

## Plan and shared infrastructure

`tests.yml → TestDefinition → resolveTestPlan → TestPlan → existing Job/Queue/Matcher → Run/RunStep → Agent → result projection`.

TestPlan is a resolved, immutable submission snapshot, separate from YAML and execution state. It carries id, projectId, testName, type, effective requirements, environment, overall timeout in milliseconds and ordered structured steps. Existing RunStep is the execution record; there is no duplicate TestStep runtime. Core server memory remains the state authority, with the existing Project reference and manual Queue/Assign action. Project open/save/parse never executes.

Stage order is source → install → build → start → healthcheck → test → cleanup. Source, install, build, start and healthcheck are optional. Test is required. If no project cleanup task is declared, an internal stop-services cleanup is appended. Each declared stage is unique; arbitrary DAGs and parallel steps are excluded.

Core sends one step at a time with runId, runStepId, jobId, projectId, resolved requirements, executable, args, relative cwd, env, timeoutMs and optional typed source/health operation. Agent never chooses the next task. Single-command Task jobs retain their earlier transport path.

## Protocol example

`.tastedev/project.yml`:

```yaml
version: 1
project: {name: example, type: node}
source:
  provider: git
  repository: https://example.org/team/project.git
  revision: main
requirements:
  runtimes: {node: ">=24"}
```

The example URL is illustrative; supply the project's actual public repository. `.tastedev/tasks.yml`:

```yaml
install: {command: node, args: [scripts/install.mjs], timeout: 120}
build: {command: node, args: [scripts/build.mjs], timeout: 120}
serve: {command: node, args: [server.mjs], timeout: 10}
verify: {command: node, args: [scripts/test.mjs], timeout: 60}
cleanup: {command: node, args: [scripts/cleanup.mjs], timeout: 10}
```

`.tastedev/tests.yml`:

```yaml
integration:
  type: integration
  task: verify
  timeout: 600
  pipeline:
    install: install
    build: build
    start: serve
    cleanup: cleanup
  healthcheck:
    url: http://127.0.0.1:3000/health
    expectedStatus: 200
    timeout: 30
    retryInterval: 1
```

Test type remains unit/integration/api/browser/e2e metadata. All use ordinary task commands here; browser/e2e do not invoke a Playwright evidence engine.

## Environment and requirements

The STEP9 resolver is reused: project environment → task-selected profile → task env → test-selected profile → test env. Optional Test `environment` names an existing profile; optional Test `env` overrides values. The final mapping has at most 32 variables. UI never automatically prints it. Literal explicit environment values are masked in Agent stdout/stderr across UTF-8/chunk boundaries; empty strings have nothing to mask. Encoded/transformed secret values cannot be identified automatically. Git diagnostics are not streamed, preventing helper output from exposing credentials.

For each task, requirements resolve Project → Task → Test using STEP9 overrides. Effective constraints across the resolved steps are intersected: maximum runtime minimum, strongest required capability, matching OS/architecture/browser. Conflicting scalar constraints reject plan creation. Git source adds a Git capability independently of task overrides. One Agent is reserved for the entire Run; mismatch remains queued with existing Matcher reasons.

## SourcePreparation and revision

SourcePreparation is a provider boundary in the resolved model and Agent execution adapter. Git is the only implemented provider; Local Sync and Artifact are extension points, not implemented modes.

Agent creates a fresh `runs/<runId>` session and prepares Git under its `source` subdirectory. It clones without checkout, explicitly fetches the requested branch/tag/commit, checks out detached FETCH_HEAD and resolves actual HEAD. Normal task cwd becomes `source/<declared cwd>`; cleanup shares that workspace. Source timeout is 120 seconds, also bounded by overall cancellation. Clone/fetch/checkout use structured arguments with prompts, global/system config and credential helpers disabled. Hooks are disabled for checkout.

Run metadata records repository, requested branch/revision and actual commit SHA. For a branch the branch field is the requested branch, even though checkout is detached. For a tag/SHA it is the requested revision rather than an invented branch name. Core validates the reported repository and SHA before accepting source success. Retry fetches again and can therefore resolve a new commit while preserving the original Run.

Only credential-free HTTPS and Git URLs are accepted; userinfo/query/fragment/local-file/SSH URLs and option-like or traversal revisions are rejected. Private-repository credentials, submodules, LFS and credential management are not provided. Git source can use a local loopback Git daemon for disposable verification without accepting arbitrary local filesystem paths.

**Remote Git runs do not include unsaved or uncommitted local edits.** Studio shows this distinction, requested revision and resolved SHA. A project without source executes tasks inside an initially empty Agent workspace.

## RunStep, failure and cleanup

RunStep keeps order, taskReference, pending/running/passed/failed/skipped/cancelled/timeout, timestamps, exitCode, failureReason and optional serviceId. Core rejects unexpected or duplicate step completion. The first failed/timeout/cancelled step is primary. Later dependent steps remain visible as skipped (failure/timeout) or cancelled (user cancellation). Cleanup runs after the main pipeline regardless of its outcome.

Agent stops tracked service trees before the project cleanup command. Cleanup is bounded by its own task timeout, beyond the overall run deadline. Cleanup failure is secondary when a primary failure exists; the original step/exit/status remain intact and cleanupWarning is displayed. A cleanup-only failure fails the Run. A service that exited unexpectedly is also a cleanup failure, even if the test command exited zero. The project cleanup still runs after a service failure.

All-pass means every planned step completed successfully. Run result projection exposes testName/type, runId, Agent, revision, status, duration, primary failed step and exit code. Artifacts retain existing runId/runStepId metadata only; no binary storage or uploads are added.

## Services and HTTP health

Start launches a tracked process tree, returns a successful started result and process identity immediately, and keeps stdout/stderr associated with the start step while Core advances. Startup means the OS process was spawned, not that the service is healthy. Healthcheck supplies readiness.

Health v1 supports loopback plain HTTP only (127.0.0.1, localhost, ::1), expected status 100–599, 1–3600-second deadline, 0.1–10-second retry interval. Default status200, timeout30s, retry1s. No redirects, authentication, query, fragment, TLS or arbitrary remote network probes. Invalid HTTP/status/unavailable service retries within the deadline. Reads and response line length are bounded; cancellation interrupts retries. This is framework-independent.

Windows suspended process creation + Job Object from STEP8 owns descendants. Service handles survive individual steps and are stopped at cleanup, cancellation, disconnect and Agent exit. Agent command children retain account permissions; workspace containment is **not an OS sandbox**.

## Timeout, cancellation and delivery

Task timeout controls individual command steps. Test timeout controls the whole main pipeline (default600s); cleanup has a separate bounded allowance. A step timeout yields RunStep timeout, dependent skipped, cleanup and Run timeout. Overall timeout cancels the active operation and is recorded as timeout. User cancellation stops active/service trees, marks pending main steps cancelled, executes cleanup and finishes cancelled. Agent becomes idle only after the run finishes in Core.

Atomic persistent claims use runStepId for pipeline operations and runId for legacy tasks. Results remain pending until matching step acknowledgement; retries are new Job/Run/step IDs. Same-session workspaces are preserved between steps. Restart cannot resume an interrupted pipeline workspace automatically; interrupted work fails rather than executing twice. Core remains memory-only, and disconnected active work can await reconciliation. This is bounded local at-most-once delivery under retained markers, not globally exactly-once execution.

## Logs and Studio

Existing live log transport now carries runStepId and per-step sequence deduplication. Retention remains 500 chunks/128KiB per Run, 100 Runs/512KiB globally. Agent output queues are bounded and may drop chunks under pressure or disconnection; logs are not durable evidence. Stdout and stderr are separate. Service output belongs to Start, not whichever later step is active.

Tests show type, plan order, requirements, explicit Run Test (queues for reviewed assignment), status/latest result, current step/progress/Agent/duration. Existing Queue/Agents/Runs remain the sole infrastructure. Run detail leads with primary failure, repository/revision/SHA, ordered steps, step-selectable logs, cancellation and retry. Retry creates a new queued attempt; it does not overwrite history. Protocol dirty/invalid guards and normal IDE use without `.tastedev` remain intact.

## Verification and limitations

The STEP10 task evidence directory records exact final source/build hashes, Node/Rust gates, real separate Windows Rust Agent scenarios and production browser review. Production Web OPFS save is not a new Native disk-save, installer or QA-01 certification. Existing unchanged native-host evidence is retained separately.

STEP11 is not started: no Playwright product engine, screenshot/trace/video collection, binary artifact transfer/store, AI analysis/fix, Issue automation, Scheduler, PostgreSQL/Redis or full Secret Manager. Core restart durability, workspace quotas/retention, OS sandboxing, Unix qualification and private Git authentication remain outside this scope.
