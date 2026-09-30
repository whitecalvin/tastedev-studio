# TASTEDEV AI Fix Loop — STEP13

## 고도화 1단계 — 2026-10-01

FixAttempt와 proposal-scoped approval은 Core의 Project-scoped encrypted SQLite record로 보존한다. 패치/base/result/hash/승인 scope는 재시작 후에도 유지하고 버전 비교로 stale writer를 차단한다. 모델의 write 권한을 새로 넓히지 않았다. Approval 저장 실패는 Source write 전에 차단하고 applied/reverted 상태 저장 실패는 가능한 범위에서 Source와 clean Editor를 보상 복구한다.

Local validation은 중단 시 failed로 기록하고 자동 실행하지 않는다. Remote retest는 Job identity·Run status로 다시 연결한다. 이력 조회 자체는 Patch/Validate/Commit/Push 승인이 아니다. Patch 도중 프로세스 종료에 대한 durable write-ahead journal, 복구 화면, 자동 resume는 고도화 4단계 범위로 남긴다.

[저장·복구 운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


Status: PASS. **STEP 13 PASS — STEP 14 착수 가능**. STEP14 NOT_STARTED.

## Authority and architecture

Failure → AIService read-only analysis → grounded Proposal/Diff → explicit Approval → FixService structured Patch → existing Documents/Filesystem/Git → Protocol validation → Workspace Snapshot → existing Core Job/Queue/Matcher/TestPlan → existing Rust Agent Pipeline → actual Result. No separate AI runner.

The registry classifies read tools and approval-bound apply_patch/validation_task/remote_retest actions. Model-facing tools remain search_code, read_file, git_diff, get_run, get_run_step, get_logs, get_evidence. Model path/command text alone cannot write or execute. The application applies the reviewed immutable proposal with projectId/attemptId after user approval. No unrestricted shell, commit/push or arbitrary delete.

## Approval and patch

Approval records proposalId, exact files, patch SHA256 and timestamp. Each new Proposal needs new approval. Apply/Reject/Cancel are separate from generation; saved Protocol execution has a separate approval dialog. Cancel/reject consumes one conservative attempt and performs no write.

Structured edits retain common prefix/suffix and contain start/remove/insert, exact base/result and hashes. Every target passes boundary/path/base/dirty checks before writes. Existing expected-content save protects against stale state and readback verifies results. PATCH_CONFLICT preserves user edits; DIRTY_EDITOR leaves unsaved content untouched. Redacted sources/proposals are rejected to avoid copying secret placeholders over real source. GUI currently applies one selected proposal file at a time; FixService supports atomic-like multi-file proposals.

## Multi-file recovery and Revert

Preflight all → preserve before/after → expected writes → verify → reload clean editors. Later failure compensates already written files only while their disk matches the AI result and their editor is clean. Concurrent changes remain intact with recovery-required. This is compensating rollback, not an OS atomic transaction. Revert AI Changes restores the pre-AI user baseline, not Git HEAD. Post-AI user changes produce PATCH_CONFLICT. Cancellation of a retest does not prevent restoring its patch. Clean Documents refresh; dirty buffers are never automatically overwritten.

## Validation and actual Diff

Saved Disk Diff reads disk; Native Actual Git Diff calls existing GitService. The suggested test list is descriptive; execution resolves saved Protocol Task/Test definitions into structured executable/args/cwd/env. AI cannot supply arbitrary shell strings. Local desktop validation reuses RunService/ProcessHost, guards dirty/active processes and honors task timeout. Web uses approved remote Protocol Tests. Validation is recorded in the attempt; failure remains recoverable.

## Snapshot and source identity

Workspace Snapshot contains provider, snapshotId, projectId, proposalId, attempt, baseRevision, changedFiles, sorted text files/per-file SHA256 and manifest SHA256. Manifest serializes identity/changedFiles/path+hash. Transfer uses the authenticated existing Core JSON transport, maximum100 files/24KiB source content. Serialized RPC above60KB rejects before send; no silent truncation. Required changed file exclusion fails the snapshot.

Excluded: .git/dependencies/build/cache/binary files, credential/secret paths, configured patterns and text containing recognized or known secret values. No secret injection. Core verifies snapshot/project identity; Rust independently validates manifest/files/path traversal/case aliases and stages into a fresh isolated Run directory, verifies readback, then renames staging to source. Archive extraction is not used. Existing pipeline task cwd is rooted under source. Run records snapshot/proposal/attempt/checksum; GUI labels it Manifest checksum rather than Git SHA.

## Attempt history and retry

FixAttempt tracks original Run lineage, analysisId/proposalId, approval, patch, validation, retest job/run and result. States: proposed/approved/applied/validating/retesting/passed/failed/reverted/cancelled/rejected/recovery-required. Terminal results originate in Core/Agent tests. Each attempt has independent history. Maximum3 by default; configurable1–10 at service boundary. Retest re-analysis preserves original/current Run distinction and the same cumulative retry cap. No automatic unlimited loop. No-agent retest remains queued with Cancel; timeout/cancel/provider/transfer failures retain source and history for recovery.

## Verified example

Real Rust arithmetic FAIL → actual managed Pro gpt-6.1-sol reads Run/step/log/search/service/test source → proposes a-b to a+b in service.cjs → human approval → real patch/Git Diff → local assertion PASS → Snapshot → real release Agent assertion PASS → exact Revert. Existing user.txt change survives. A synthetic a*b proposal separately verifies real Agent FAIL/history/Revert. GUI uses a labelled fixture Provider and actual Rust Agent; actual-model acceptance comes from the first scenario only.

## Security and evidence

Scope/hash tamper, foreign project/path escape, stale/dirty source, repeated attempts, snapshot secret/traversal/checksum/size and unavailable shell are covered by automated regressions. Actual disk multi-file failure and concurrent user edits preserve recoverability. Dummy .env absent in Agent source; unauthorized modifications0; owned orphan processes0. Node329/329; Rust Debug21/Release21; static checks and production/release builds PASS. See parent workspace resources/verification/dev-01/tasks/tastedev-studio/step-13-20260930/RESULT.md and EVIDENCE-INDEX.md for all40 reporting items and exact evidence.

## Known limitations

Session-only attempt/Core state, bounded small text snapshots, no Secret Injection, redacted file proposals require another safe workflow. Native local validation/Git button and installed QA/Unix manual qualification were not rerun. Actual second-model re-analysis after the controlled failed fix was not run; context lineage is regression-tested. Native source is unchanged; no deployment/packaging/automatic commit/push or STEP14 implementation.
