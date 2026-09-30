# TASTEDEV Core Architecture — STEP9 integration

## 고도화 1단계 — 2026-10-01

기본 remote Core repository는 SqliteCoreRepository이다. InMemoryCoreRepository의 transaction/observer 계약을 유지하고 SQLite commit이 성공한 뒤에만 메모리와 구독자를 갱신한다. core snapshot의 ID/Run/Step/Evidence 참조를 검증한다. 배정과 실행 ID를 먼저 저장하며 legacy acceptance·Step/Run/Job result는 원자적으로 저장한다. Pipeline browser result도 Step transaction에 포함한다.

재시작 시 Agent presence는 offline, 실행 reservation은 유지한다. 동일 claim의 결과는 조정하고, claim 없는 실행은 interrupted/failed 처리한다. Unknown claim은 ACK 없이 Agent error로 격리한다. 기존 Rust Agent claim/pending/ack 파일과 execute protocol v1을 재사용한다. 동일 execution을 재전송해 임의로 실행하지 않는다. schema1/SQLite FULL sync/exclusive single writer/AES-GCM/DPAPI 키 계약을 사용한다.

[저장·복구 운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


## STEP15 final acceptance — 2026-09-30

**STEP 15 PASS — TASTEDEV Studio Phase 1 목표 시스템 완료**. Schedule/Trigger/TriggerEvent/ScheduleRun Domain, Core ScheduleService and replaceable repository, cron-parser5.10.1, explicit timezone, Manual/Cron/Interval/one-time Trigger, existing Protocol TestPlan/Queue/Matcher/Rust Agent reuse, overlap/dedup/missed/capacity safeguards, notification events and Scheduler GUI are implemented.

Actual production GUI created/edited/enabled/disabled schedules and exercised Run Now. Real Rust Agent completed manual PASS and wall-clock one-time PASS, plus controlled FAIL. Failed Run/Step/log evidence produced an Issue Candidate; automatic AI/Patch/GitHub/commit/push counts0. Time-trigger lateness 473ms. Core restart restored3 disabled definitions; session history is not persisted. Verification schedules disabled, test processes stopped, owned orphans0.

Node385/385 (Scheduler23 included), lint/typecheck/production build PASS. An actual GUI save exposed an optional-ID serialization issue; UI-only correction was validated with scoped lint, typecheck and updated production build. Unaffected385 tests reused, no duplicate full run. Unchanged native input/binary hashes verified; no Rust/Tauri rebuild or installed/Unix retest. Light/Dark GUI errors0.

Limits: Core must stay alive; definitions are file-backed, Run/history and registered saved Protocol are memory-only. After Core restart explicit saved-Protocol sync is required before enabled definitions execute. Missed times skip; no backlog. Same Project/Test queued/active overlap skips. Cron/interval minimum60s; global active Job cap16; at most100 schedules. Git/external/dependency/OS event adapters are foundation only. No auto analysis or external writes. Current contract: [Scheduler](TASTEDEV_SCHEDULER.md). Parent workspace evidence: resources/verification/dev-01/tasks/tastedev-studio/step-15-20260930/RESULT.md and EVIDENCE-INDEX.md. Earlier status statements are historical.


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

2026-09-30 source-derived contract. STEP8 extends STEP7 foundation with an independent Agent transport. STEP9 adds the Protocol adapter described below; STEP9 PASS is supported by Node219, source/build gates, verified Rust gate reuse, actual production Agent GUI and independent ship review; final inputs are recorded in its task RESULT/checkpoint. STEP10 is ready but not started.

## STEP9 Protocol adapter

.tastedev saved files → loader/parser/schema → validated Protocol Domain → pure resolver → existing CreateJob → CoreService → Queue/Matcher/Dispatcher. See [TASTEDEV Protocol v1](TASTEDEV_PROTOCOL.md) for the exact YAML contract. Protocol YAML version1 and WebSocket protocolVersion1 are separate versioned contracts.

Project→Task→Test merges requirements, with later explicit constraints overriding and runtime maps merging by key. False Git/Docker/browser declarations normalize to internal removal markers; raw YAML null is not an accepted clearing syntax. Base→selected profile→Task env merges string variables. Test timeout overrides task timeout and seconds become timeoutMs.

The current Studio Project ID remains authoritative; the declaration's display name does not create a second Project. Task selection creates one existing Job with one structured command, and test selection resolves its referenced task rather than invoking a test engine. Core's existing Matcher supplies incompatibility reasons and leaves an incompatible Job queued.

Loading and resolving do not submit or execute. The UI requires saved Protocol files and a connected remote Core, freshly loads/validates before Queue and requires separate Assign to execute. Agent remains a generic command executor with no YAML or project-specific branches. Server-memory persistence, role-token trust and output retention are unchanged. Fresh run cwd does not receive Studio source files. Production STEP9 evidence confirms the existing Matcher keeps an incompatible Job queued without execution and invalid definitions create no Job/Run; successful resolution reaches the real Windows Agent and streamed terminal result. See [STEP9 evidence](../../../../resources/design/tastedev-studio-step9/EVIDENCE.md).

## Composition and state ownership

Studio Agents / Queue / Runs → RemoteCoreClient → authenticated WebSocket /studio → CoreService → InMemoryCoreRepository.
Core /agent → independent Rust Agent → native process tree.

Sources: src/features/core/domain.ts, repository.ts, matcher.ts, service.ts, context.tsx, remote-client.ts and views.tsx; transport/server.ts, protocol.ts and main.ts. Domain contracts have no React dependency. Existing Project metadata is referenced through ProjectRegistry; no duplicate Project domain model is introduced. The Studio supplies its current Project reference when subscribing.

Remote Agent, Job, Run, steps, artifact metadata and events live in the Core process. Browser reload or client disconnect does not erase that server state; the user reconnects with endpoint/token and receives a fresh snapshot. Core restart loses queue/history and does not reconstruct them from Agent claims. Unconnected local foundation mode still uses its browser-session repository. Project metadata retains its existing persistence separately. Source contents are not persisted in Core.

Transactions mutate a detached draft synchronously and publish only after success; asynchronous callbacks are rejected. Reads and returns are detached; observer errors cannot roll back a committed transaction. This is in-process atomicity, not a durable distributed transaction.

Local RunService/ProcessHost/Terminal remain independent. Core Runs display remote history, while local Run configurations retain their existing host behavior.

## Transport and identity

Core defaults to 127.0.0.1:4340, with /studio and /agent WebSocket endpoints. Configured separate role tokens authenticate the first subscribe/register message. A configured origin allowlist rejects unlisted browser origins. JSON messages have protocolVersion 1, schema/domain validation, bounded size and queued processing. This wire contract is distinct from the STEP9 YAML Project Protocol.

Project-scoped RPC and snapshots guard domain ownership, and an Agent result must match its reserved Run/Job. Agent IDs cannot be connected twice concurrently. Shared role tokens are not individual user accounts or tenant/Project authorization: a holder of the Studio token is a trusted operator. Core serves no general REST API or durable database.

See [standalone configuration](TASTEDEV_AGENT_ARCHITECTURE.md). Studio credentials remain in client memory and are not localStorage metadata. The Tauri CSP adds only ws://127.0.0.1:4340 for the default Core endpoint; other desktop endpoints require an explicit future CSP change.

## Queue, matching and execution

Priority descending then oldest queuedAt determines queue order; ties retain insertion order. Matching reports OS, architecture, CPU, memory, Docker/GPU/PTY, runtime and browser mismatch. Runtime requirements accept numeric minimums such as >=24.0.0, not general semver expressions. Optional capabilities do not imply availability.

Manual dispatch atomically reserves an eligible unreserved idle/online Agent, assigns Job and creates pending Run/steps, then delivers one structured command. STEP8 remote creation and dispatch reject multi-step payloads; the broader foundation domain does not imply a pipeline executor. There is no autonomous scheduler, automatic retry or lease-based reassignment.

An accepted execution becomes running/busy. Terminal passed/failed/cancelled/timeout result records exit code, timestamps and summary, updates Job/step and releases the reservation. Run success requires exit 0. Invalid executable and nonzero exit remain failures. Queued cancellation completes immediately; active cancellation requests Agent process-tree termination and awaits its terminal report.

Heartbeat timeout or socket loss marks the Agent offline. An active Run may remain awaiting reconciliation; it is not silently reassigned. The Agent cancels its process tree on link loss, retains the terminal result and reports it after reconnecting. Restarted interrupted executions report failure. Core restart may acknowledge an unknown retained result without restoring its old Run/queue.

## Logs and retention

Live logs preserve UTF-8 boundaries and distinguish stdout/stderr with sequence numbers. Core drops repeated/out-of-order retained sequences and keeps at most 500 chunks / 128 KiB UTF-8 text per Run, at most 100 retained Run log entries and 512 KiB globally. Old entries are evicted; this is bounded live output, not an artifact store. Logs dropped while disconnected are not replayed. Terminal results are retained by the Agent until acknowledged.

Core events retain the latest 1,000 entries. Run/Artifact metadata is not uploaded evidence and does not supply file hashes, storage, permissions or downloads.

## GUI and evidence

The existing [STEP2 PRODUCT](../../../../resources/design/tastedev-studio-step2/PRODUCT.md) and [DESIGN](../../../../resources/design/tastedev-studio-step2/DESIGN.md) remain authoritative. Approved B keeps separate Agents / Queue / Runs. STEP8 adds Core connection controls, timeout and bounded remote log details, preserving the editor and local panels.

[STEP8 evidence](../../../../resources/design/tastedev-studio-step8/EVIDENCE.md) separates actual Windows Agent E2E, production Web/OPFS interactions, final source gates and independent visual review. Production starts without fake records; development fixtures are unavailable in production. Installed QA and native UI are not newly qualified. Historical STEP6 unresolved error1 and untested125% DPI remain non-blocking.
