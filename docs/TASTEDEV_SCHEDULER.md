# TASTEDEV Scheduler + Continuous Testing

## 고도화 1단계 — 2026-10-01

저장된 Protocol, Schedule definition, history/notification, trigger identity와 pending Job intent를 encrypted SQLite scheduler unit으로 복원한다. 이전 FileScheduleRepository는 최초 migration 입력으로만 사용하고 원본 파일을 보존한다. durable mode에서는 별도 정의 파일에 중복 저장하지 않는다.

trigger intent를 Job 전에 커밋하고 해당 history ID를 Core Job idempotencyKey로 사용한다. Job 생성 직후 crash가 나도 동일 Job을 다시 찾는다. trigger 완료와 nextRunAt 사이 crash는 duplicate identity를 소비하고 다음 시각으로 진행한다. 기존 missed-skip/no-backlog/overlap/global-capacity 정책을 유지한다. 메모리 test/local repository 모드는 기존 resync-only 계약을 유지한다.

[저장·복구 운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


Status: **STEP 15 PASS — TASTEDEV Studio Phase 1 목표 시스템 완료**.

## Architecture and domains

Scheduler UI → ScheduleService in Core → validated saved Protocol → resolveTestPlan → existing CoreService.createJob → Queue/Matcher/dispatch → existing Rust Agent/TestOrchestrator → Run/Step/log/artifact paths → ScheduleRun history. No separate Test Runner, queue, matcher or Agent executor was introduced. Schedule, Trigger, TriggerEvent, ScheduleRun and ScheduleStatus are independent of Run. Existing Project metadata remains authoritative. Notifications emit schedule.triggered/failed/completed for future subscribers; no Email/Slack provider.

## Trigger types and timezone

Manual Run Now, five-field cron, interval (60–31,536,000 seconds), one-time ISO timestamp with explicit offset/Z are implemented. Cron uses [cron-parser](https://github.com/harrisiirak/cron-parser), version5.10.1, with currentDate and tz; no custom parser. Schedule stores explicit IANA timezone, defaulting to the Studio user's current timezone in the form. UI shows timezone/last Trigger/next Run/status. For example 0 3 * * * with Asia/Seoul means03:00 Seoul, not implicit host time. One-time timestamps represent an instant; timezone labels/display policy remain explicit. Cron seconds fields are rejected to enforce minute resolution. Git/external/dependency/OS event trigger union types are adapter foundations only; autonomous event ingestion is unavailable. Run Now may exercise an event definition's Protocol test as a human action.

## Validation, security and approval

Save validates existing registered Project, valid parsed Protocol/Test, exact allowed Schedule fields, trigger and timezone. Command/shell/env fields are not accepted in Schedule input. Only Protocol references are stored; each execution uses existing parser/resolver and validates Test existence. Protocol sync comes from saved files via existing WorkspaceFileService; dirty Protocol must be saved first. Authorized Studio RPC register parses the raw source text again on Core, so malformed/unknown YAML is blocked. This is a deliberately registered Protocol snapshot, not a filesystem watcher. External changes require resync. Protocol executable+args retains existing validated-command restrictions.

Scheduler actions use existing authenticated project-scoped WebSocket RPC and request-size bounds. A shared Studio role-token holder is a trusted operator, consistent with existing Core. Project Open does not enable execution. New UI Schedule defaults disabled; checking Enabled plus Save enables approved Protocol testing. Auto AI analysis is always OFF in this v1 implementation. Scheduled failures do not call AI, apply patches, create/close/comment GitHub Issues, commit or push. Existing read-only analysis and explicit Fix/Issue approval workflows remain separate.

## Runtime, missed runs and concurrency

The engine runs in Core with500ms tick, outside React. UI may close while Core continues. Core shutdown stops its timer. Missed runs are skipped; after restored Protocol sync the next future occurrence is computed. A live timer delayed more than10s skips that occurrence and records missed. It never builds catch-up backlog. A completed one-time schedule has nextRunAt null, no repeated firing.

An identical trigger identity/schedule/occurrence is suppressed; Run Now identity is independent of wall-clock seconds. The engine serializes tick and submission paths. Same Project/Test already queued/assigned/running causes a skipped history entry. Global queued/assigned/running Job cap16 prevents pressure from many definitions; no automatic retry. No compatible Agent leaves a queued ScheduleRun and the existing queue intact, rather than reporting Schedule failure. Later compatible Agent arrival is handled by retrying existing dispatch for that queued Job, not by creating another Job. Disable prevents future firing but does not cancel already queued/active work; use existing Queue/Run cancellation.

## Repository and persistence

ScheduleRepository is replaceable; MemoryScheduleRepository is used for isolated embedded/tests, FileScheduleRepository by production transport/main.ts. Default file: parent TASTEDEV resources/runtime/tastedev-studio/schedules.json; CORE_SCHEDULE_PATH is an operator path override. Atomic temp-write/rename persists only Schedule definition/identity/timestamps. No Protocol YAML/commands/env/account token/source/evidence is persisted there. Corrupt version/schema inputs abort load with the original file preserved. Max100 definitions, size200KB.

Core restart restores definitions as awaiting-protocol when enabled, disabled otherwise. Registered Project and saved Protocol must be resubscribed/resynced before automatic execution; no cached secret-bearing YAML restored. History/queue/Run/notification/dedup state remain memory-only. History max1000, notifications max1000 and trigger identities max3000; oldest records evict. Deleting a definition retains its session history. No PostgreSQL, daemon install, cloud scheduler or background OS service. Core runtime/storage failures are exposed in scheduler policy; timer errors do not crash Core.

## GUI and failure flow

Scheduler activity list → New/Edit Name/Project/Test/Trigger/timezone/Enabled → Save → Run Now/Enable/Disable/Delete Disabled. Sync saved Protocol obtains Test choices. List/detail exposes status, last/next Trigger and History with Run status, Agent ID, duration and Open Run. History uses actual Core results. Failed Run Detail retains existing logs/evidence, Analyze Failure path and Create Issue Candidate path. AI use still needs its normal context-transmission consent; GitHub create still needs STEP14 review/search/approval.

## Verified example

Production UI Manual pass-test → real Rust Agent PASS (188ms). One-time trigger scheduled 2026-09-30T10:28:42.529Z → fired 2026-09-30T10:28:43.002Z, 473ms lateness → real Rust Agent PASS (162ms). Controlled fail-test → actual Run FAIL (173ms) → preserved step/log evidence → Issue Candidate in production GUI. No actual GitHub/model invocation in this STEP. All three verification definitions disabled; actual Core restart restores all3 and empty session history. Source code/native binary qualification and screenshots are indexed in STEP15 evidence.

## Known limitations

Memory-only execution history, dedup and Protocol registration; explicit sync after restart; single Core process/single file writer, no multi-host leader election;10s lateness skip policy; bounded histories/definitions/capacity; snapshot source freshness follows existing Protocol/Git semantics; one-time timestamp uses ISO offset/Z text entry rather than a date picker; no automatic AI, notifications delivery, webhook/package/OS monitoring or native installed/Unix GUI requalification. These are documented Phase1 boundaries, not implemented future features.
