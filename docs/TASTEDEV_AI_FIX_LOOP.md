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

## Second advancement phase6 — 2026-10-01
DEV_VERIFIED / functional PASS; final common deployment pending. Phases1–5 already DEPLOYED0.1.6–0.1.10 (phase5 source376843eb605e20b9a333512ed4b84ad4fddf44e5). Project-local analysis requests/time/reported token budgets and attempt limit, current retest Step/log/Evidence priority, readonly attempt/current Dirty editor comparisons, actual historical Run navigation, existing Git review and exact prior-analysis/retest Issue draft linkage implemented. Actual ChatGPT Pro gpt-6.1-sol proposal2 → scoped standing user approval → service.cjs patch → local arithmetic PASS → checksummed real Rust Agent Runf7a44d46-932b-4150-88f6-9cc8614ac3e6 PASS. Controlled proposal1 failed actual Run and retained history; model output not claimed for it. Source restored/unauthorized files0/secrets0/orphans0. Full555 cases with2 narrow repairs plus added issue identity test =556 current cases covered; lint/production export-TypeScript/controlled Light-Dark GUI PASS. No monetary-cost estimate, automatic commit/push/Issue publication, new runner or unrestricted shell. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-6/RESULT.md. Guide: resources/guides/dev-01/tastedev-studio/SECOND_ADVANCEMENT_AI_REVIEW.md. Installed service/DPI/updater QA remain separate; updater user-owned.

### Second advancement final delivery — 2026-10-01
All six approved phases implemented/verified and sequentially deployed:0.1.6,0.1.7,0.1.8,0.1.9,0.1.10,0.1.11. Final common pipeline exit0; release source/tag/origin at publication d644ec0e095b8f32cafac17c23b282b32e66c283. Public Windows ZIP/NSIS and Linux Agent/signature4 SHA-256 digests match local artifacts; NSIS signature Valid. DEB built/signed but not configured for publication; Core service component deferred. Actual public https://tastedev.net/en/products/studio HTTP200 includes0.1.11 and studio-v0.1.11 at2026-10-01T10:41:49Z. This final status supersedes prior pending records. Goal summary/evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/FINAL-DELIVERY.md and checkpoint.json. Installed service/DPI and user-owned updater tests remain QA; no such validation claimed. This documentation closure does not change tested application inputs and does not require another package/build.
