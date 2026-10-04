# TASTESTUDIO Core Architecture — STEP9 integration

## 4차 고도화 로컬 패키지 마감 (2026-10-02)

1~6단계0.1.18–0.1.23 COMPLETE_LOCAL_PACKAGES. 사용자 최신 범위에 따라 배포·설치 테스트는 사용자 담당입니다. Windows signed installer/ZIP12개와 Core runtime ZIP4개를 resources/packages/tastestudio/fourth-advancement에 보관했습니다. 총16개 artifact SHA-256, installer/payload signature, Core archive manifest/file hash를 확인했습니다. 102 전송/실행, 서비스 설치, GitHub/홈페이지 게시를 수행하지 않았습니다.

4단계: 기존 새 실패 Evidence/Attempt 비교/Protocol validation/승인 경계를 재사용하고 모델·설정 단가 기반 비용 추정과 실패 요청 metrics를 추가했습니다. 사용량/모델 미확인과 추정 한도 초과 시 후속 호출을 중단합니다. 실제 Provider 청구 상한은 아니며 단가를 임의 지정하지 않습니다.
5단계: 실제 source revision/snapshot checksum, 저장된 검증 정의/환경, dispatch 당시 보고된 Agent 환경에 기반한 Run/Step/Evidence 비교. 시간은 startedAt→finishedAt이며 Source/환경 미기록을 비교 가능으로 추측하지 않습니다. slowdown/flaky는 후보일 뿐 확정 결함이 아닙니다.
6단계: project/live/run 선택 후 clone, collection별 read, 전체 SQL aggregate, 전체 Evidence usage/retention, schema3 projection migration/atomic rollback/reopen, 최근100개 종료 Run의 Agent 실행 문제 조회. source/Job body 없이 전체 통계를 계산합니다. full detached write transaction/startup load는 유지됩니다.

최종 Node629 distinct effective PASS(614 unchanged full +15 scoped final), failure/skip0. 전체 lint+최종 관련 lint, desktop production export/TypeScript PASS. Native source/dependencies/config/toolchain fingerprint와 로그를 검증해 phase3 Debug/Release106각 PASS·fmt/Clippy를 재사용했고, 버전/정적 자산 변경에 필요한 Release executable만 재빌드했습니다. Node에는 별도 Debug/Release 테스트 설정이 없어 가짜 중복 환경을 만들지 않았습니다.

로컬 SQLite1500건 전체 집계·active Evidence 보호·동일 transaction rollback·v2 migration/reopen 및 실제 Core bundle start/ready/stop/exit0 확인. 10000 Run8회 synthetic read 측정은 full254.32ms→selected17.03ms; 운영 성능 보장이 아닙니다. Native GUI/실제 Provider/GitHub/실제 장비 Agent/서비스/장기 운영/업데이트 설치는 사용자 QA이며 미실행입니다. package 준비를 해당 외부 QA PASS로 기록하지 않습니다.

증거: resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/checkpoint.json, DELIVERY-INDEX.json, phase-4~6/RESULT.md. 배포·사용법: resources/packages/tastestudio/fourth-advancement/README.md 및 resources/guides/dev-01/tastestudio-fourth-advancement/*.md. 이 작업으로 새 commit/push/tag를 만들지 않았습니다.


## 고도화 2단계 — 2026-10-01

Standalone foreground Core는 Studio가 연결을 닫아도 살아 있다. migration·state/artifact recovery가 끝난 후 listener/ready를 제공한다. 정상 종료 시 신규 배정/mutation/scheduler 중지 → durable cancellation intent → Agent cancel/result/ACK → final repository commit → timer/socket/listener/DB close. 제한 초과 unresolved claim은 보존하여 기존 reconciliation으로 조정하며 자동 replay하지 않는다. 인증된 로컬 stop과 POSIX signal handler는 기존 server/repository/orchestrator를 재사용한다.

고유 Node440건 유효 PASS(첫430/431 + 실패1 재개 + 기존 Native8 보존·검증 + 신규 legacy1), 전체/변경 범위 lint·typecheck PASS. Web/Rust/Tauri 입력은 이번 작업에서 바뀌지 않아 재빌드하지 않았다. 실제 서비스 설치·제한 계정·Linux runtime은 미검증이며 단계 전체는 PARTIAL이다. 이전 NOT_STARTED 또는 memory-only 기록은 역사적 상태다.

[운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-service-runtime-20261001/README.md) · [검증 결과](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-2/RESULT.md)

고도화 2단계 PARTIAL — 실제 서비스 및 제한 계정 검증 대기

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

## 5차 고도화 1단계 — Core 저장/지연 조회 (2026-10-02)

0.1.24 개발: SQLite repository는 encrypted relation index에서 필요한 Run/Job/Step/Evidence를 선택하고 body를 지연 조회한다. transaction은 노출된 row만 draft로 읽고 변경된 body만 기록한다. entity/revision/index/history/usage는 한 transaction으로 commit한다. InMemory는 immutable baseline과 copy-on-read로 전체 Source 복제를 줄이며 실패/중첩/비동기 동작의 원자성을 보존한다. Core runtime/orchestrator의 active/detail 조회와 Artifact startup audit는 해당 범위만 읽는다.

전체 Node637 및 마지막 immutable 보완42관련 PASS(최종638 effective), lint/static/export 증거는 resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/phase-1 및 상위 logs 참조. 기존 Native gates는 입력 해시를 검증해 재사용하고 버전/정적 자산 binary만 rebuild한다. 패키지·Core smoke 완료 상태는 각 checkpoint가 authority다.

제한: CoreStore의 DB 무결성/암호 인증 전체 audit, Artifact 파일 audit, 메타데이터 manifest/index 전체 기록, 요청된 scheduling/export collection 조회, 단일 writer 정책 유지. 실제 장기간 운영·설치·서비스/업데이트 QA는 사용자 담당이다. 5차2~6단계는 아직 구현 전이며 순차 진행한다. 102 배포/자동 게시/서비스 설치/commit/push 없음.

## 5차 고도화 3단계 — 재현 조건 비교 (2026-10-02)

0.1.26: Core가 검증된 Snapshot manifest에서 launch identity를 제외한 contentChecksum을 계산한다. Agent의 임의 contentChecksum은 보존하지 않는다. 기존 fixed runtime recheck 결과와 Agent version을 결과 metadata로 기록하고 승인된 요구사항을 확인한다. Run comparison은 content identity/definition/observed runtime·Agent version 차이를 표시하며 unknown과 legacy registration을 구분한다.

실제 Core/Rust Agent0.1.26 두 Snapshot203files: 다른 transport checksums/같은 contentChecksum, Node24.11.1 observed, 같은 환경 comparable, 실제 test2PASS. 민감 environment values/credential은 metadata에 없다. 테스트·패키지 완료 gate는 fifth-advancement/phase-3 및 DELIVERY-INDEX/checkpoint authority. OS build/kernel/container/package 설치·binary hash attestation은 미지원이며 관측값은 연결 Agent의 보고다. 상세 guide: resources/guides/dev-01/tastestudio-fifth-advancement/REPRODUCIBILITY.md. 102 배포·설치·게시 없음. 4~6단계는 순차 진행한다.

## Fifth advancement phase5 — 0.1.28
Completed Snapshot bodies/manifests are included in offline v2 backup, restored only into a new directory after references/checksums validate. Read-only doctor validates DB/key/schema/Evidence/Source without generating keys or migrating original data. GUI separates authentication and connection recovery. Node663/663, lint/export PASS. External config/credentials/service registration remain outside backup; Windows DPAPI recovery requires original user. Evidence phase-5/RESULT.md; local packages only.

## Fifth advancement phase6 — 0.1.29 / local deliverables complete
History search/keyset navigation/cancel and stale session/project/permission response protection implemented. Analysis/Attempt navigation reuses restored AI review; no automatic approval/write/provider call. Source transfer progress is separate from actual Run/Agent/Step verification. History HTTP request/response bounds align with v2 metadata. Node667/667 PASS; full lint had one cleanup-ref warning, repaired with scoped lint PASS; final production export including TypeScript PASS. Native Debug/Release111 PASS+4 existing ignored reused from phase5 after source/toolchain/log hash verification, version/frontend Release build refreshed. Actual controlled Core GUI31 records paging/search/empty verified, browser errors0; packaged Core ready/stop PASS. Installed Native/Light-Dark/service/update/user-machine QA not run. Phase4 actual Provider+Rust Agent FAIL→fix→PASS evidence retained without duplicate calls. All six stages have local Windows installer/portable ZIP/Core runtime ZIP; user deploys/tests. No102/remote publication/install/commit/push. Evidence: resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/FINAL-DELIVERY.md and DELIVERY-INDEX.json. User guide: resources/guides/dev-01/tastestudio-fifth-advancement/WORKFLOW.md.
