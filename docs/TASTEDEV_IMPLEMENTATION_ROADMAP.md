# TASTEDEV Studio 구현 로드맵

## 순차 고도화 계획 (2026-10-05)

1. 배포 구성: Linux GUI 및 독립 Studio/Core/Agent 패키지 — PARTIAL. 준비·패키지 구성 코드, Core runtime ZIP, Windows Core SCM operator ZIP, 기존 signed release binary를 재사용한 Agent foreground ZIP을 제공했다. Linux 빌드·패키징은 기존 공용 도구를 사용하며 로컬 WSL 준비를 요구하지 않는다. 실제 Linux 산출물 검증, Windows SCM 실제 설치·host 릴리스 서명·Agent Windows 서비스는 미검증/미구현으로 구분한다.
2. 장비 등록·Agent 연결·역할 배정 — 진행 중. 명시적 장비 소속 선택/이동/해제, Agent 상태 표시, 저장/Undo/Redo, 실제 로컬 Core/Rust Agent의 역할 배정·승인 경계 검증 완료. 실제 GUI/운영 장비 qualification과 물리 신원 인증은 구분한다. 증거: `resources/verification/dev-01/tasks/tastedev-studio/device-membership-20261005/checkpoint.json`.
3. 노드 관계 실행·준비/차단 이유 — 구현 및 로컬 검증. Immutable 정의·승인·History, ready/queued 대기 진단과 동일 Job 재연결 구현. Node922/922·lint·production build PASS. 실제 GUI/설치는 미실행.
4. Artifact 기반 배포·동일 산출물 테스트 — 다음 기능 공백 확정. 현재 Source/Evidence 전송 및 같은 PC 복사는 후속 Agent 산출물 전달 근거가 아니다. Producer/Core/consumer identity·보관·checksum·workspace 전달 구현 필요.
5. 장애 복구·업데이트/재시작 안정화 — 기존 Core pause/승인 재검토·History·Scheduler·업데이트 토스트 구현 재사용. 최신 실제 서비스/설치/업데이트 QA 미완료.
6. tastedev-files 전체 오케스트레이션 검증 — 미완료. 실제 제품의 구현→빌드→승인→분리된 Agent workspace 전달→동일 산출물 테스트 필요. 102/운영 배포 금지 유지.

기능 구현 단계를 순서대로 수행하고 실제 장비 배포·설치 검증은 별도 상태로 기록한다. 사용자 담당 외부 검증 대기를 전체 기능 구현의 차단 사유로 취급하지 않는다. 102 전송/배포는 자동 실행하지 않는다. 세부 계획과 최초 실패 gate 재개 조건은 `resources/guides/dev-01/tastestudio-advancement-next/PLAN.md`에 기록했다. 패키징·문서 변경은 관련 구성/문법 검증만 실행하며 변경 없는 애플리케이션 전체 테스트/Windows 재컴파일은 반복하지 않는다.

## 4차 고도화 로컬 패키지 마감 (2026-10-02)

1~6단계0.1.18–0.1.23 COMPLETE_LOCAL_PACKAGES. 사용자 최신 범위에 따라 배포·설치 테스트는 사용자 담당입니다. Windows signed installer/ZIP12개와 Core runtime ZIP4개를 resources/packages/tastestudio/fourth-advancement에 보관했습니다. 총16개 artifact SHA-256, installer/payload signature, Core archive manifest/file hash를 확인했습니다. 102 전송/실행, 서비스 설치, GitHub/홈페이지 게시를 수행하지 않았습니다.

4단계: 기존 새 실패 Evidence/Attempt 비교/Protocol validation/승인 경계를 재사용하고 모델·설정 단가 기반 비용 추정과 실패 요청 metrics를 추가했습니다. 사용량/모델 미확인과 추정 한도 초과 시 후속 호출을 중단합니다. 실제 Provider 청구 상한은 아니며 단가를 임의 지정하지 않습니다.
5단계: 실제 source revision/snapshot checksum, 저장된 검증 정의/환경, dispatch 당시 보고된 Agent 환경에 기반한 Run/Step/Evidence 비교. 시간은 startedAt→finishedAt이며 Source/환경 미기록을 비교 가능으로 추측하지 않습니다. slowdown/flaky는 후보일 뿐 확정 결함이 아닙니다.
6단계: project/live/run 선택 후 clone, collection별 read, 전체 SQL aggregate, 전체 Evidence usage/retention, schema3 projection migration/atomic rollback/reopen, 최근100개 종료 Run의 Agent 실행 문제 조회. source/Job body 없이 전체 통계를 계산합니다. full detached write transaction/startup load는 유지됩니다.

최종 Node629 distinct effective PASS(614 unchanged full +15 scoped final), failure/skip0. 전체 lint+최종 관련 lint, desktop production export/TypeScript PASS. Native source/dependencies/config/toolchain fingerprint와 로그를 검증해 phase3 Debug/Release106각 PASS·fmt/Clippy를 재사용했고, 버전/정적 자산 변경에 필요한 Release executable만 재빌드했습니다. Node에는 별도 Debug/Release 테스트 설정이 없어 가짜 중복 환경을 만들지 않았습니다.

로컬 SQLite1500건 전체 집계·active Evidence 보호·동일 transaction rollback·v2 migration/reopen 및 실제 Core bundle start/ready/stop/exit0 확인. 10000 Run8회 synthetic read 측정은 full254.32ms→selected17.03ms; 운영 성능 보장이 아닙니다. Native GUI/실제 Provider/GitHub/실제 장비 Agent/서비스/장기 운영/업데이트 설치는 사용자 QA이며 미실행입니다. package 준비를 해당 외부 QA PASS로 기록하지 않습니다.

증거: resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/checkpoint.json, DELIVERY-INDEX.json, phase-4~6/RESULT.md. 배포·사용법: resources/packages/tastestudio/fourth-advancement/README.md 및 resources/guides/dev-01/tastestudio-fourth-advancement/*.md. 이 작업으로 새 commit/push/tag를 만들지 않았습니다.


## 4차 고도화 3단계 — Git 협업 (2026-10-02)

승인 기반 hunk Stage, Dirty conflict editor, Core의 scoped PR 생성·상태·SHA 기반 CI 조회를 추가했다. 기존 Git/Files/Documents, Core GitHub 인증·masking·encrypted persistence·team 권한을 재사용한다. 임의 patch/shell을 받지 않고 preview fingerprint/일회용 approval/Source 경계를 검증한다. existing user changes를 보존하고 uncertain create/reconcile를 지원한다.

실제 local Git/native, actual local Core HTTP(controlled GitHub), production Monaco GUI(controlled Git IPC/GitHub), effective Node610 PASS, Native Debug/Release each106 PASS(4 ignored), lint/fmt/Clippy/export/build 완료. Windows0.1.20 signed installer/ZIP과 별도 Core Runtime ZIP을 로컬에 제공한다. Core manifest288파일과 실제 bundle CLI 시작·종료 검증 완료. resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/phase-3/RESULT.md와 package checkpoint가 근거다.

실제 외부 GitHub PR/CI·설치·서비스/배포 QA는 사용자 미실행이다. 102 전송/실행·자동 GitHub/웹 게시를 하지 않았다. hunk는 저장된 tracked regular text만, PR은 동일 repo branch만, bounded100개 조회. approved SHA와 actual current PR SHA가 달라지면 안내한다. 4~6단계는 아직 미완료다.

## 4차 고도화 2단계 — 로컬 디버깅 확대 (2026-10-02)

프로젝트별 이름 있는 실행 설정(Node/TypeScript/Python)을 저장·선택·삭제한다. 자동 실행하지 않으며 Source·환경 비밀값을 설정 저장소에 넣지 않는다. Dirty editor가 있으면 실행을 차단하고 saved disk hash를 Native에서 다시 확인한다.

Node Inspector의 조건부 중단점과 멈추지 않는 로그 포인트를 지원한다. 로컬 v3 source map으로 생성 JavaScript 위치와 원본 TypeScript 위치를 연결한다. 원격/inline/indexed/중첩 source map은 지원하지 않는 bounded subset이며 map 파일과 원본은 프로젝트 경계를 벗어날 수 없다. 원본 TS를 실행하기 위해 필요한 컴파일은 기존 Protocol Task로 사용자가 수행한다.

Python은 사용자가 선택한 trusted absolute python.exe/python3.exe에 설치된 debugpy의 stdio DAP를 사용한다. Start/Stop/Continue/Pause/Step/Locals/조건부 breakpoint/logpoint를 제공한다. 임의 shell/RunInTerminal/evaluate/write 도구는 제공하지 않는다. 요청16개·30초 timeout·최대30분 session·100개 breakpoint·bounded output을 적용하고 종료 시 owned Windows job을 정리한다. 거부된 breakpoint 요청은 committed state로 저장하지 않으며 같은 source에 대한 변경을 직렬화한다.

실제 Native Node source map/conditional/logpoint 및 실제 Python debugpy/locals/종료 정리를 확인했다. Production export + actual Monaco GUI에서 설정 저장/선택/삭제, Dirty 보호, condition 전달, Light/Dark, source unchanged를 확인했다(화면의 Native IPC는 controlled fixture; 실제 Native host는 별도 검증). 전체 Node602건 중601건 통과 후 신규 Runtime 번역 누락1건만 수정하여 해당 검사 통과. lint와 production export 통과. 최종 Native 검사·서명 패키지 결과는 phase-2/local-package-checkpoint.json에서 확인한다.

실제 설치·배포·업데이트/QA는 사용자 담당이며 실행하지 않았다. 원격102 전송·실행 및 자동 GitHub/웹 게시를 하지 않는다. 단계별 signed installer/ZIP/SHA만 resources/packages/tastestudio/fourth-advancement에 제공한다. 3~6단계는 아직 미완료다.

## 4차 고도화 1단계 — Python/Rust 언어 서비스 (2026-10-02)

Python(Pyright)·Rust(rust-analyzer)의 local stdio LSP를 기존 Native workspace/Monaco에 연결했다. 사용자 선택 absolute trusted tool만 명시적 Start로 실행하며 shell/executeCommand/workspace.applyEdit를 제공하지 않는다. 프로젝트 경로·파일 종류·secret path·base/version 검증, 4MiB frame/16 pending request/2 sessions/256 indexed sources, timeout cancellation 및 owned job 종료를 적용한다. TypeScript lib/types 설정도 기존 worker에 반영한다.

정의·참조·이름 변경은 다중 파일을 지원한다. Rename은 실제 Disk를 직접 쓰지 않고 기존 Documents의 Dirty 상태로 반영하며 기존 Save/Save All conflict 보호를 재사용한다. 닫은 dirty editor는 서버에서 saved base로 복원한다. 업데이트/폴더 해제/앱 종료 시 server sessions를 종료한다.

실제 Windows Native host + 실제 공개 Pyright1.1.414/rust-analyzer2026-09-28에서 정의·참조·rename·진단·source unchanged·owned session0 검증 완료. Rust의 자동 cargo check/build scripts/proc macros는 꺼져 있으므로 native syntax diagnostics와 컴파일러 validation을 구분한다. Linux native desktop/설치 QA는 확인하지 않았다. Production Monaco GUI와 공용 배포 결과는 resources/verification/dev-01/tasks/tastedev-studio/fourth-advancement/phase-1 및 checkpoint가 최종 상태다. 2~6단계는 아직 미완료다.

## 3차 고도화 6단계 — 팀 운영·종합 실제 검증 (2026-10-02)

Owner 사용자 생성/역할/프로젝트 권한/비활성화, bounded 세션 발급·해지와 stale etag 보호를 구현했다. 관리 응답에는 저장된 token hash를 넣지 않고 새 토큰은 password input에서 발급 직후만 표시하며 브라우저 저장소에 저장하지 않는다. 기존 TeamAccess/암호화 CoreStore/Protocol/Queue/Matcher/Rust Agent를 재사용하며 세션 해지·권한 강등은 해당 승인으로 실행 중인 작업의 취소도 요청한다. 최근168시간 Run의 최신1000건 표본과 표본 한도, UTC 일별 추이/통과율/생성→종료 평균 경과 시간, 현재 Agent/Queue, 최신25개 FixAttempt 승인과100개 Run→Issue/PR 링크를 제공한다. 링크는 프로젝트 GitHub 저장소와 실제 Run/snapshot identity로 제한하고 검토 후 저장한다. 링크의 GitHub 존재 확인/직접 PR 생성은 지원하지 않는다.

실제 서명된 Rust Agent2대에서 Owner/Developer 동시 Run2건의 PASS/의도된FAIL을 확인했고 Viewer 쓰기·Developer 관리 차단, 실행 중 세션 해지 취소, Core 재시작 후 Run3건/해지 상태를 확인했다. Source Snapshot은 Dummy .env 제외, 단일 테스트 실행 유지. GUI는 production export+실제 Core SQLite/WebSocket 및 controlled native filesystem IPC를 사용한다. Node592 유효 cases(full591+번역 실패 scope 복구), lint/production export-TypeScript 통과. 최종 GUI/공용 Rust 게이트/배포 증거는 phase-6와 checkpoint.json이 최종 상태다. 기존1~5단계 유효 증거를 재사용하고 설치 updater/Native DPI/Unix GUI 검증은 사용자/QA 영역으로 유지한다.

운영 보고는 전체 Run을 무제한 집계하지 않으며 Core transaction/snapshot과 HistoryStore 메모리 비용이 전체 기록에 비례할 수 있다. 보고/권한은 server authority이며 외부 LDAP/SSO/법적 audit 시스템은 도입하지 않았다. Guide: resources/guides/dev-01/tastedev-studio/THIRD_ADVANCEMENT_TEAM_OPERATIONS.md.


## 고도화 2단계 — 2026-10-01

고도화 2단계 Core Service Runtime: PARTIAL. 애플리케이션 기능·foreground/actual Agent/CLI·static 검증 완료, 공용 서비스 도구·제한 계정·실제 OS 서비스 검증 대기. 성공한 gate를 반복하지 않고 미검증 service gate부터 재개한다. 고도화 3단계는 NOT_STARTED.

고유 Node440건 유효 PASS(첫430/431 + 실패1 재개 + 기존 Native8 보존·검증 + 신규 legacy1), 전체/변경 범위 lint·typecheck PASS. Web/Rust/Tauri 입력은 이번 작업에서 바뀌지 않아 재빌드하지 않았다. 실제 서비스 설치·제한 계정·Linux runtime은 미검증이며 단계 전체는 PARTIAL이다. 이전 NOT_STARTED 또는 memory-only 기록은 역사적 상태다.

[운영 계약](../resources/guides/dev-01/tastedev-studio/core-service-runtime-20261001/README.md) · [검증 결과](../resources/verification/dev-01/tasks/tastedev-studio/advancement-2/RESULT.md)

고도화 2단계 PARTIAL — 실제 서비스 및 제한 계정 검증 대기

## 고도화 1단계 — 2026-10-01

고도화 1단계 Core Persistence and Recovery: PASS. SQLite/migration/backup/restore, 실제 Core restart+Rust Agent reconnect, 결과 ACK 유실·중복 기록 방지, 이력 조회, write failure와 Source integrity를 검증했다.

고도화 2단계 Core Service Runtime: NOT_STARTED. 이번 작업에서 서비스 설치·운영 계정·readiness·공용 서비스 래퍼를 시작하지 않았다. 단계별 범위는 부모 resources/guides/dev-01/tastedev-studio/advancement/TASTESTUDIO_ADVANCEMENT_PROMPTS.md를 따른다.

[저장·복구 운영 계약](../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


## Multilingual UI — 2026-09-30

Implemented the same 10 languages as tastedev-web: Korean, English, German, Spanish, French, Italian, Brazilian Portuguese, Japanese, Simplified Chinese and Traditional Chinese. Default follows the system/browser language; unavailable or unsupported languages fall back to English. Manual selection persists, supports cross-tab synchronization and can return to System language.

Application-owned Project Manager, Workspace, Explorer/editor guidance, Process, Git, Core, Protocol, AI, Issues and Scheduler UI use shared catalogs. Language changes preserve project data, form values and dirty Monaco models. Source, user data, terminal/test logs and AI output keep their original content.

Verification: Node393/393 PASS once; after subsequent catalog/UI changes, affected i18n8/8 PASS and unchanged385 reused. Full lint, typecheck and production build PASS; final build GnpI9Lv0-aYxoPUb7tMNb includes TypeScript validation. Production GUI27 checks plus final10 locale cases PASS; unexpected frontend errors0, controlled source writes0. No duplicate unaffected build/test gates. Native/Rust inputs unchanged; native installed/OS-language QA was not run.

Remaining limits: Monaco built-in third-party menus remain English; unknown external diagnostics fall back to their original English; native-speaker editorial review is pending. These do not change prior phase acceptance.

[Result and evidence](../resources/verification/dev-01/tasks/tastedev-studio/i18n-20260930/RESULT.md) · [I18N guide](../resources/guides/dev-01/tastedev-studio/i18n-20260930/I18N.md)


## STEP15 final acceptance — 2026-09-30

**STEP 15 PASS — TASTEDEV Studio Phase 1 목표 시스템 완료**. Schedule/Trigger/TriggerEvent/ScheduleRun Domain, Core ScheduleService and replaceable repository, cron-parser5.10.1, explicit timezone, Manual/Cron/Interval/one-time Trigger, existing Protocol TestPlan/Queue/Matcher/Rust Agent reuse, overlap/dedup/missed/capacity safeguards, notification events and Scheduler GUI are implemented.

Actual production GUI created/edited/enabled/disabled schedules and exercised Run Now. Real Rust Agent completed manual PASS and wall-clock one-time PASS, plus controlled FAIL. Failed Run/Step/log evidence produced an Issue Candidate; automatic AI/Patch/GitHub/commit/push counts0. Time-trigger lateness 473ms. Core restart restored3 disabled definitions; session history is not persisted. Verification schedules disabled, test processes stopped, owned orphans0.

Node385/385 (Scheduler23 included), lint/typecheck/production build PASS. An actual GUI save exposed an optional-ID serialization issue; UI-only correction was validated with scoped lint, typecheck and updated production build. Unaffected385 tests reused, no duplicate full run. Unchanged native input/binary hashes verified; no Rust/Tauri rebuild or installed/Unix retest. Light/Dark GUI errors0.

Limits: Core must stay alive; definitions are file-backed, Run/history and registered saved Protocol are memory-only. After Core restart explicit saved-Protocol sync is required before enabled definitions execute. Missed times skip; no backlog. Same Project/Test queued/active overlap skips. Cron/interval minimum60s; global active Job cap16; at most100 schedules. Git/external/dependency/OS event adapters are foundation only. No auto analysis or external writes. Current contract: [Scheduler](TASTEDEV_SCHEDULER.md). Parent workspace evidence: resources/verification/dev-01/tasks/tastedev-studio/step-15-20260930/RESULT.md and EVIDENCE-INDEX.md. Earlier status statements are historical.


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

## 현재 단계와 다음 단계

STEP9 TASTEDEV Protocol v1을 구현했다. 네 YAML 파일의 domain/strict validation, requirement/environment resolution, task/test→기존 Core Job, compact Run/Tests와 status bar, initialize/Monaco 저장 재검증이 범위다. Protocol80+기존139=219 테스트 근거가 있으며 final lint/typecheck/Web/Desktop no-bundle builds와 production actual Agent GUI E2E가 PASS다. Rust Agent Debug12/Release12/fmt/Clippy/release는 유효성 확인 후 재사용했다. 독립 UI review는 production8개 화면에서 ship이다. **STEP9 PASS — STEP10 착수 가능, NOT_STARTED**. [Protocol](TASTEDEV_PROTOCOL.md), [STEP9 evidence](../resources/design/tastedev-studio-step9/EVIDENCE.md) 및 task RESULT/checkpoint가 최종 수락 기준이다.

STEP8 Core/Agent 단일 명령 경로를 재사용하며 Project별 Agent 코드는 없다. Agent workspace에 source checkout/copy는 추가하지 않았다. .tastedev load와 실제 Queue/Assign은 분리한다. STEP10 Test Orchestration은 NOT_STARTED이며 자동 착수하지 않는다. 이전 순서 계획과 당시 미구현 표현은 역사적 기록이다.

## Historical STEP6E handoff

2026-09-30 STEP6E: **STEP 6 PASS — STEP 7 착수 가능**. STEP7은 시작하지 않았다. 과거 이벤트 `1790699936279`는 HISTORICAL_UNRESOLVED / NOT_REPRODUCED / Root Cause UNKNOWN / Non-blocking으로 보존한다. 진단 보강 및 controlled browser tests, Node102, lint/typecheck/Web build와 새 production Web smoke PASS. Rust 및 전체 Desktop 검증은 반복하지 않았다. 기존 EXE/installer에는 STEP6E 변경이 아직 포함되지 않으며 다음 패키징에서 frontend export/embedded app 재생성이 필요하다.

[최종 증거 목록](../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/EVIDENCE-INDEX.md). 기존 Native PASS 및 실제100%/150%DPI 유지,125% 미검증은 비차단이다.

## 과거 STEP 5 시점의 범위와 순서 결정

이 절의 실행 순서와 native 미착수 표현은 역사적 계획이다. 현재 상태와 다음 단계는 위 최신 기록이 우선한다.

2026-09-29 STEP 5 구현·검증 완료 기준으로 갱신했다. STEP 0 당시 신규 빈 저장소였으며, 사용자 STEP 1 지시로 Application Foundation + Project Manager의 Web 범위를 구현·검증했다. STEP 2 Shell을 구현·검증했다. STEP 3은 사용자 새 지시에 따라 Web Filesystem Host와 Monaco를 구현했으며 실제 Chrome Browser/Disk gate를 완료했다. STEP4 Terminal/Run foundation은 구현했다. Native Process/PTY는 사용자 STEP4 지시에 따라 STEP6 Tauri에서 연결한다. STEP5 Git foundation은 WebUnavailable/FakeHost 경계로 구현했으며 실제 Native Git은 STEP6에서 연결한다. 목표와 경계는 [비전](TASTEDEV_STUDIO_VISION.md), 현재 상태는 [현재 분석](TASTEDEV_CURRENT_ANALYSIS.md), 기능별 미구현 항목은 [GAP](TASTEDEV_GAP_ANALYSIS.md)을 따른다.

기본 STEP 번호는 유지하되 다음 의존성 때문에 실행 순서를 조정한다.

`0 → 1 → 2 → 3(Web host) → 4(Web foundation) → 5 → 6(Native host) → 9 → 7 → 8 → 10 → 11 → 12 → 13 → 14 → 15`

- **STEP 3 host 결정 갱신**: 사용자 STEP3 지시가 기존 Tauri 선행 계획을 대체했다. File System Access API 기반 Web host만 이번 단계에 구현한다. Tauri는 구현하지 않는다. STEP4는 WebUnavailable 기반 foundation으로 완료하며 실제 PTY/process는 사용자 지시에 따라 STEP6 Tauri에 배정한다.
- **STEP 9를 STEP 7/8 앞으로**: Core·Agent가 독자적인 task schema를 만들지 않도록 Protocol 계약과 validation을 먼저 확정한다. 로컬 command adapter도 이 단계에서 계약에 맞춘다.
- STEP 1 시작 시 정확한 dependency 버전, package manager, frontend/desktop 호환성, 물리적 패키지 구조와 metadata 저장 방식을 결정하는 기반 작업을 포함한다. STEP 0에는 이를 설치·검증한 것으로 기록하지 않는다.

## 단계별 범위와 완료 조건

### STEP 0 — 현재 분석 및 기준 아키텍처

- 목적: 신규 프로젝트의 사실과 목표를 분리하고 개발 기준 수립.
- 선행조건: 사용자 신규 프로젝트 확인, 실제 디렉터리·Git·지침 조사.
- 구현 범위: 비전·현재 분석·GAP·로드맵 문서 4개, 문서 검증과 DEV-01 기록.
- 제외 범위: 앱 scaffold, 패키지 설치, UI/Agent/Protocol 구현, DB 변경, 다음 STEP.
- 검증 방법: 작성 전후 inventory 대조, 모든 요청 항목 coverage·링크·상태 표현 확인, whitespace 검사.
- 완료 조건: 네 문서가 존재하고 실제 빈 저장소 사실·UNKNOWN·설계 후보를 구분하며 후속 각 단계에 여섯 항목이 정의됨.

### STEP 1 — Project Manager 및 신규 기반 (Web 범위 완료)

- 목적: Project를 최상위 도메인으로 만들고 최소 앱 기반 확정.
- 선행조건: STEP 0, 단계 착수 지시, 기술·호스트·metadata 저장 결정. 선택한 버전의 공식 문서로 호환성 확인.
- 구현 범위: 최소 scaffold, Project metadata·목록·최근 열기·생성/열기/복제 의도, filesystem/Git adapter 인터페이스와 명시적 미연결 UI 상태. source 본문 DB 저장 금지.
- 제외 범위: 실제 clone 완료 보장, Editor·Terminal, 원격 Agent, Core 전체, AI.
- 검증 방법: metadata validation·영속화·중복 경로·Project 전환을 unit/integration으로 검증하고 실제 adapter와 mock 증거를 구분.
- 완료 조건: 재시작 후 metadata·최근 목록 유지, 잘못된 경로 처리, adapter 경계 명확화. Create/Open/Clone의 미연결 범위가 UI·기록에 표시됨.

### STEP 2 — IDE Workspace Shell (Shell 범위 완료)

- 목적: Project를 여는 GUI의 일관된 작업 구조 제공.
- 선행조건: STEP 1의 Project context와 UI 기반.
- 구현 범위: Activity Bar, Sidebar, Editor 자리, AI Panel, Bottom Panel, Status Bar, 패널 전환·크기·키보드 탐색·상태 보존.
- 제외 범위: 실제 Monaco·PTY·AI 연동, 기능 없는 영역을 동작 완료로 표시하는 UI.
- 검증 방법: Project 전환·패널 복원·좁은 창·키보드·접근성 및 실제 화면 검증.
- 완료 조건: 지정한 활동·Bottom Panel 진입점과 빈 상태가 일관되고 Project 간 상태가 혼합되지 않음.

### STEP 3 — File Explorer + Monaco Editor + Web Filesystem Host (Web 범위 완료)

- 목적: workspace 파일 탐색·편집·저장 제공.
- 선행조건: STEP 2, 사용자 STEP3 지시, FileSystemHost와 browser permission 경계 계약.
- 구현 범위: filesystem adapter, tree·파일 CRUD·본문 검색, Monaco 모델·탭·dirty·save, 외부 변경·encoding·충돌 처리, 실제 Project Create/Open 연결.
- 제외 범위: Terminal, Git push, AI 수정, 모든 언어 LSP 완비.
- 검증 방법: 임시 workspace의 생성/열기/수정/저장/재열기, symlink 경계·동시 외부 변경·실패 시 원본 보존.
- 완료 조건: 디스크와 편집 상태 일치, workspace 탈출 차단, 저장 실패·충돌에서 데이터 보존. STEP3 종료 시 42개 Node 테스트와 정적/빌드 및 실제 Browser/Disk gate를 완료했다.

### STEP 4 — Terminal + Run Foundation

- 목적: Terminal UI와 교체 가능한 Process 실행 architecture 제공.
- 선행조건: STEP3와 사용자 STEP4 지시, ProcessHost 계약.
- 구현 범위: xterm Terminal, ProcessHost/RunService/Session/Event, WebUnavailable host, test-only FakeHost, Run Configuration CRUD와 project별 persistence, dirty/save/run 보호, Output 분리와 출력 제한.
- 제외 범위: 실제 OS Process/PTY, Tauri, Git, 원격 dispatch, Scheduler, Problems 해석.
- 검증 방법: host double의 상태·stream·stop·오류·cleanup, 실제 Web GUI와 xterm rendering fixture, 기존 regression 및 production build.
- 완료 조건: 61개 테스트와 lint/typecheck/build, GUI CRUD/격리/dirty run/세 해상도/console gate 완료. 실제 Native containment·process tree 종료·PTY는 STEP6에서 별도 검증한다.
### STEP 5 — Git / Source Control Foundation

- 목적: GitHost 경계와 Source Control GUI, Git 상태·Diff·index·commit workflow 기반 제공.
- 선행조건: STEP1~4 PASS와 사용자 STEP5 지시. 기존 Native 선행조건은 이번 Web foundation 범위로 대체.
- 구현 범위: GitHost/GitService/WebUnavailableGitHost, test-only FakeGitHost, Repository/Branch/FileStatus/Diff/Commit models, Changes/Staged/Conflicts, Stage/Unstage file/all, validated Commit, bounded History/Refresh, Monaco Diff, Explorer decoration extension.
- 제외 범위: 실제 Git CLI·Clone·checkout·fetch/pull/push·인증·Tauri·Core. Web shell/server 우회 없음.
- 검증 방법: FakeHost status/diff/index/commit/history integration과 failure/isolation, 실제 WebUnsupported 및 Diff renderer, STEP1~4 regression.
- 완료 조건: 90 tests, lint/typecheck/build PASS; 실제 Source Control, dirty preservation/disk save/기존 기능, 세 해상도/theme/console 검증. Native OS Git 보장은 STEP6에서 별도 검증.

### STEP 6 — Tauri Desktop Runtime (STEP6E 수락 PASS)

- 목적: 로컬 filesystem·프로세스를 제공하는 desktop host 확립.
- 선행조건: STEP 1 기술 결정과 STEP 2 Shell. Next.js의 서버 의존·정적 산출물 경계 확정.
- 구현 범위: Tauri 2.12.0 / Rust 1.98.1, 중앙 runtime factory, static frontend bundle, 최소 command capability, native filesystem/Process/ConPTY/Git adapters, 개발·NSIS 패키징. 모두 구현됨.
- 제외 범위: Rust 원격 Agent, 자동 업데이트·서명·공식 배포, 전체 OS 지원 주장.
- 검증 방법: 선정한 개발 OS에서 실제 desktop launch·host 호출·허용되지 않은 접근 거부·패키지 실행.
- 완료 조건: native 기능, restart, Web 회귀, 설치/제거 및 정적/빌드 게이트는 통과. native1920×1080, Windows100%·150%, Missing Project 복구와 수정 안내 화면 증거도 통과. 과거 frontend 오류1은 원인 UNKNOWN을 보존하되 진단 보강/controlled test PASS 후 Non-blocking으로 수락. 125%는 비차단 미검증이며 Windows 외 OS는 미검증.

### STEP 7 — TASTESTUDIO Core Foundation (PASS)

- 목적: 기존 Project에 연결되는 실행 metadata와 교체 가능한 Core repository/service 경계 제공.
- 선행조건: STEP6E PASS와 사용자 STEP7 승인. 기존 DB·Protocol 전체 선행 제안은 이번 in-memory foundation 범위로 대체한다.
- 구현 범위: Agent Registry, 구조화 capability/requirement 매칭, Job Queue/수동 Dispatcher, Run/ordered RunStep 상태, 수동 retry/cancel, Artifact metadata, bounded events, Agents/Queue/Runs GUI. 기존 local RunService 독립 유지.
- 제외 범위: 실제 remote Agent·네트워크·heartbeat·DB/Redis·영속 복구·AI·Scheduler·STEP8. Dispatch는 busy 예약/pending Run 생성이며 실행이 아니다.
- 검증 방법: atomic rollback/배정 충돌/상태 전이/매칭/우선순위·동률/프로젝트 경계/실패 전파/retry와 취소 테스트, 개발 전용 fixture UI, 정적 검사와 Web production build·실제 Web IDE 회귀. Rust/native 입력 불변으로 새 native 빌드는 요구하지 않는다.
- 완료 조건: foundation 계약과 정직한 empty/unavailable/session-only UI, 필수 로컬 검증 및 production fixture 차단 근거. Core31/기존102(총133), 개발 GUI/review, 최종 lint/typecheck/Web build, production OPFS/Monaco·Project 격리·fixture404 모두 PASS. STEP8은 ready / NOT_STARTED다.
- 후속 GAP: DB·인증·lease·분산 dedupe·restart·네트워크 실행·artifact 전송은 후속 별도 승인 범위이며 이 단계 구현 완료로 계산하지 않는다.

### STEP 8 — Rust Agent Runtime Foundation (implemented; final gates in task record)

- 목적: Project 이름별 분기 없는 독립 실행 Agent 제공.
- 선행조건: STEP7 domain/Core; 이번 단계의 version 1 wire contract와 configured Agent/Studio tokens.
- 구현 범위: register/heartbeat/capability, single structured executable/args/cwd/env/timeout, fresh run directories, Windows process-tree cleanup, UTF-8 stdout/stderr, result ack/reconnect and persistent run claims.
- 제외 범위: revision/source checkout, artifact upload/download/hash store, multi-step/DAG, durable Core recovery, production deployment, Unix qualification and STEP9.
- 검증: actual Windows binary registration/execution/exit7/invalid executable/timeout/cancel/network-loss/restart/dedup, production Web real Agent logs/results/status and OPFS editor regression, source gates and scoped visual review.
- 완료 조건: 해당 범위의 tests/lint/optimized builds 및 실동작 증거 일치. 최종 게이트는 STEP8 RESULT/checkpoint를 기준으로 하며 설치·QA-01·Native UI 재검증과 구분한다.

### STEP 9 — TASTEDEV Protocol v1 (PASS; STEP10 ready but NOT_STARTED)

- 목적: Project가 WHAT을 선언하고 기존 Core/Agent가 배정·실행하도록 연결.
- 선행조건: STEP8 foundation, 기존 filesystem/Monaco/Project/Core domain.
- 구현 범위: .tastedev/project.yml 및 optional environments/tasks/tests.yml, strict YAML/schema, v1 domain, requirements/env merge, task/test resolution, existing Job conversion, Run/Tests/status UI, safe initialize, saved-file reload.
- 제외 범위: Project-specific Agent, source checkout/copy, DB/Redis, DAG/pipeline/test engines, artifact transfer, Secret Manager, AI/Scheduler 및 STEP10.
- 검증: parser/schema/security/merge/refs/isolation, existing Node regression, lint/typecheck/Web build, Agent gates의 유효한 재사용/실행 근거, 실제 Agent match→passed/logs, mismatch→queued/no execution, invalid→no Job, GUI/Monaco save 재검증.
- 완료 조건: 모든 필수 소스·실행·GUI gate와 문서 완료 후에만 PASS. 최종 STEP9 PASS 근거는 root task RESULT/checkpoint에 기록한다. STEP10은 미착수.

### STEP 10 — Test Orchestration

- 목적: Project 자체 도구와 browser 테스트를 공통 결과로 연결.
- 선행조건: STEP 7/8/9, RunStep·result 계약.
- 구현 범위: 테스트 task 의존성·선택·취소·관련 재실행, native runner adapters, Playwright browser runner와 evidence 수집.
- 제외 범위: AI 판정, 모든 테스트 도구 지원, native GUI 전체 검증 대체.
- 검증 방법: 성공·의도적 실패·timeout·부분 실패·중단·재시도, 원본 exit code와 정규화 결과 대조.
- 완료 조건: 실패가 누락되지 않고 test case·RunStep·revision·환경 및 원본 결과가 연결됨.

### STEP 11 — Evidence + Test GUI

- 목적: 결과에서 재현 가능한 증거까지 탐색.
- 선행조건: STEP 10 결과·artifact index.
- 구현 범위: Tests/Agent/Logs 화면, timeline·실패 step·trace·screenshot·report, artifact 접근 권한·hash·보존 정책.
- 제외 범위: AI 원인 확정, 무제한 로그 보관, 운영 QA 합격 선언.
- 검증 방법: 실패 case에서 원본 증거 열기·다운로드 hash·삭제/누락·접근 거부·대용량 로그.
- 완료 조건: 결과와 해당 시도의 증거가 정확히 연결되고 누락·업로드 실패가 명시됨.

### STEP 12 — AI Development

- 목적: provider 독립 Assistant와 검토 가능한 코드 변경 제공.
- 선행조건: STEP 3 저장 충돌 처리, STEP 11 증거 조회, 모델·context·자격증명 계약.
- 구현 범위: provider interface, context 선택, streaming·취소, 설명·diff 제안·명시적 적용·복구, 파일 경계와 동시 편집 보호.
- 제외 범위: 무인 수정·commit/push·Issue 게시, 특정 provider 강결합.
- 검증 방법: provider 교체 contract 및 fake adapter, 실패·취소·경계 밖 수정·stale diff·실제 연동 별도 검증.
- 완료 조건: 공급자 타입이 핵심 도메인에 노출되지 않고 적용 전 diff와 사용자 변경이 보호됨. 실제 provider 검증 여부를 구분함.

### STEP 13 — AI Analyze / Fix / Retest

- 목적: 증거에 근거한 분석과 제한된 수정·재검증 흐름.
- 선행조건: STEP 10/11/12, 적용 및 반복 실행 정책.
- 구현 범위: evidence 기반 분석·추정 표시, 수정 승인/적용, 관련 테스트 선택·재실행, 이전/새 결과 비교, 횟수·비용·취소 제한.
- 제외 범위: 실패 은폐, 테스트 기준 자동 완화, 무제한 자동 루프.
- 검증 방법: 재현 fixture의 분석→diff→적용→재테스트, 잘못된 수정·여전한 실패·취소·rollback.
- 완료 조건: 성공 판정이 실제 테스트 결과와 연결되고 해결되지 않은 실패 및 변경 이력이 남음.

### STEP 14 — GitHub Issue

- 목적: 실패·증거·수정 이력을 공유 가능한 Issue로 연결.
- 선행조건: STEP 11/13, repository 매핑과 사용자 인증·게시 동작.
- 구현 범위: Issue 초안·근거 링크·중복 조회·명시적 게시, idempotency·오류·rate limit 처리.
- 제외 범위: 승인 없는 외부 메시지, 자동 Issue 종료·무제한 중복 생성.
- 검증 방법: mock API 실패·재시도·중복 검증, 명시 승인된 sandbox repository에서 실제 게시 별도 확인.
- 완료 조건: 단일 사용자 요청의 중복 게시를 방지하고 Issue와 원본 Run이 연결됨. mock 성공과 실제 게시 검증을 분리함.

### STEP 15 — Scheduler / Continuous Testing

- 목적: 사용자 설정에 따른 반복 검증.
- 선행조건: STEP 7~14 실행·복구, schedule/timezone/권한·알림 정책.
- 구현 범위: schedule 활성화·중지, 중복 억제·missed run 정책·동시성 한도·실패 알림·이력.
- 제외 범위: 암묵적 예약 활성화, 무인 무제한 코드 수정·배포.
- 검증 방법: 제어 clock, 시간대·재시작·중복 tick·Agent 부재·수동 중지·의미 있는 상태 변경 알림.
- 완료 조건: 지정 시간·정책에서만 실행되고 중지·복구가 검증되며 실행과 알림이 추적 가능함.

## 공통 검증·실패 재개 규칙

각 단계는 변경 파일→영향 경계→필수 게이트를 먼저 매핑한다. 일반 구현은 해당 컴포넌트 전체 development 테스트, 해당 lint/static analysis, production build를 각 1회 수행한다. 단계 완료 게이트에서는 development/production 테스트를 모두 수행하며, 별도 구성이 없는 도구는 가장 강한 native 검증을 사용하고 의미 없는 이중 실행을 만들지 않는다. 저장·동시성·프로토콜 등 고위험 변경은 직접 관련 production 테스트를 포함한다.

문서만 변경하는 STEP 0은 문서 검사만 수행한다. 앱을 설치하거나 무관한 테스트·빌드를 실행하지 않는다. 동일 입력의 성공 결과는 실제 산출물·hash·환경을 확인해 재사용한다. 실패 시 마지막 성공, 정확한 실패, 변경 입력, 다음 게이트를 기록하고 최초 실패/무효화 지점부터 재개한다. 필수 게이트가 실패한 상태로 다음 STEP에 진입하지 않는다.

DEV 로컬 검증, CI, desktop 수동 검증, 설치·서명·배포, 외부 API, QA-01은 서로 다른 증거다. 각 단계 결과는 수행한 범위만 보고한다. commit/push, PR 게시, 릴리스·운영 배포는 별도 사용자 지시 범위다.

## Historical STEP 1–5 handoffs

아래 각 단계의 “다음 단계 미착수”는 당시 기록이며 현재 STEP6 상태나 STEP7 방향을 대체하지 않는다.

## STEP 1 인계

STEP 1은 Next.js 16.3.7 기반 앱, Project metadata CRUD 중 create/read/open, local persistence, 중복 방지, Open/Clone abstraction, Overview 왕복으로 완료했다. 실제 native Open/Clone·filesystem은 미연결이다. 다음 단계는 승인 후 STEP 2 Workspace Shell이며 자동 착수하지 않는다. STEP 1 테스트 15/15, lint/typecheck/build 및 production browser flow를 검증했다. 정확한 기록은 resources/verification/dev-01/tasks/tastedev-studio/step-1-20260929에 있다.

## STEP 2 종료 기록

Activity 9개, 독립 패널, 하단 6탭, 프로젝트별 reducer 상태와 localStorage, 패널 토글·resize·키보드, 공유 theme를 구현했다. lint → typecheck → 22 tests → production build가 통과했다. 세 desktop 해상도와 탐색·복원·오류 화면을 실제 browser에서 확인했다. Shell completion은 실제 파일/Monaco/PTY/AI 완료가 아니다. STEP 3용 editor 타입과 UI 경계만 준비했고 여기서 작업을 종료한다. 후속 파일 접근은 위 host 의존성 결정을 먼저 충족해야 한다.


## STEP 3 종료 기록

Filesystem/Explorer/Monaco 구현과 42/42 native tests, lint/typecheck/build 완료. 사용자가 일반 Chrome에서 직접 폴더를 선택한 뒤 browser 편집·저장·CRUD·dirty guards·재연결 복원·실제 disk readback 검증을 완료했다. 세 해상도 및 활성 탭 resize 수정 확인, 콘솔 오류/경고 0건. STEP3 Web 범위 PASS이며 외부 OS 오류는 테스트 더블 검증으로 구분한다. 테스트용 폴더는 resources/verification/dev-01/tasks/tastedev-studio/step-3-20260929/disposable-workspace. 사용자 승인 범위는 이 폴더의 테스트 파일 생성·수정·rename·삭제로 한정된다. STEP4는 시작하지 않는다.


## STEP 4 종료 기록

사용자 STEP4 지시가 실제 실행 host 선정 선행조건을 이번 Web foundation 범위에 한해 대체한다. ProcessHost/RunService/terminal session/event 및 Run Configuration CRUD, xterm UI, WebUnavailable 안내, test-only FakeHost를 구현·검증했다. 61 native tests와 lint/typecheck/production build, production GUI/dirty+run/세 해상도 및 development-only ANSI·긴 출력 fixture 검증을 완료했다.

STEP5 Git/Source Control은 별도 사용자 지시 후 착수할 수 있다. Web의 Git capability는 unavailable이다. Native Process/PTY와 native containment/process-tree cancellation은 STEP6 Tauri의 완료 조건이다. Web에서 shell 우회 실행하지 않는다. STEP4 종료 당시 STEP5·STEP6은 미착수였다. 현재 STEP5 결과는 다음 기록을 따른다.
## STEP 5 종료 기록

Git + Source Control Foundation 구현과 90/90 테스트, lint/typecheck/production build 완료. Production WebUnavailable 및 실제 Chrome 회귀 검증, 별도 개발 전용 정적 Diff fixture와 production404 검증을 구분해 기록했다. 실제 Native Git과 remote/authentication은 구현하지 않았다.

STEP6 Tauri 2 Desktop Runtime + Native Filesystem + Process/PTY + Git은 다음 단계 착수 가능한 계약이 준비되었다. Next.js frontend packaging, native 권한/경로/취소/오류 및 실제 OS 통합 검증은 STEP6 시작 시 확정한다. STEP6은 현재 시작하지 않았다.



## Advancement3 checkpoint — 2026-10-01

Windows Agent reliability implementation DEV_VERIFIED; phase PARTIAL pending Linux actual Agent/SIGTERM and live GUI qualification. Actual Core/Agent14 and actual Agent boundary8 groups PASS; Debug31/Release31, Node444 distinct valid (translation-only failed gate resumed), static/build PASS. Bounded ACK retry/tool PATH recheck/classification/partial logs/Snapshot cancellation implemented. No byte-offset artifact resume or durable live-log replay. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-3/RESULT.md and checkpoint.json. User requested feature focus; stage4 functional work continues while operational/installed QA and serialized deployment remain separate.


## Advancement4 write-ahead recovery — 2026-10-01

Implementation in progress, not phase PASS. Core encrypted CAS history is reused. Before Apply/Revert can write any file, an open journal containing operation/time and reviewed file/base/result hashes is durably saved. On recovery, all files must match known before/after hashes and have clean editors. A complete Apply is recognized without writing; a partial Apply compensates exact AI results to the pre-AI user baseline; interrupted Revert completes that same restoration. Unknown content or dirty editors preserves all user content and leaves recovery-required for review/retry. Failed journal persistence allows no Source writes. History validates journal paths and hashes against the immutable approved proposal. Connection history recovery performs reconciliation before enabling Source actions.

Controlled real process exit/disk/SQLite reopen tests cover partial/full Apply, interrupted Revert, later user edits, dirty editors and persistence failure; current scoped tests77 distinct PASS, lint/typecheck/Web build PASS. These are synthetic reviewed proposals and real filesystem crash tests; they are not actual Provider/Agent workflow acceptance. Execution approval/snapshot identity audit and actual approved full E2E remain pending. Evidence: parent resources/verification/dev-01/tasks/tastedev-studio/advancement-4/checkpoint.json. No unrelated Rust/Native rebuild or deployment.


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

## Automatic updates implemented — 2026-10-01
Studio uses the unchanged shared TASTEDEV updater engine via crates/tastedev-update. Native fixed public-release discovery, bounded TLS transport/redirects, cancellable verified download, install-time revalidation, hidden Windows helper with explicit job breakaway, persistent startup-check preference and restart handoff are implemented. User selects installation; Dirty/files/Git/AI/local process safety gates remain. Ten-language GUI and Project Manager/Settings access added. Core/Agent automatic upgrade is excluded. Existing public0.1.4 lacks this feature; first feature-bearing package requires manual installation.
Development verification: Node506 distinct (original501 + resumed update5); Rust Debug48/Release48 distinct (Desktop15 + shared33, affected update6 refreshed after preference/handoff changes); separate public Rust metadata request1 PASS; Clippy and current desktop production export/TypeScript/native Release build PASS. Full Web build and controlled GUI6 PASS preceded final release-page/Git-protection changes. A subsequent GUI replay timed out waiting for the Korean Updates button; final GUI/actual installer, download/install/restart/UAC behavior is not claimed PASS. Expanded actual-download gate was compiled but not executed. User explicitly took over automatic-update testing; no further tests/actual installation/publication were performed after this handoff. Source commit7816e51 was committed/pushed by another session; this implementation session did not commit/push. Current test binary and manual steps are in resources/verification/dev-01/tasks/tastedev-studio/auto-update-20261001/USER-TEST.md; exact artifact hash in manual-test/artifact.json.


## Announcements — 2026-10-01
IMPLEMENTED / DEV_VERIFIED. Shared canonical parser reused byte-identically; Studio list/detail/unread/read/dismiss/daily snooze, urgent priority, independent receive preference, ten languages and bounded Native HTTPS transport added. Public API product=tastestudio returns HTTP200 with CORS *, currently0 items. Node announcements18 + i18n9 distinct PASS; Native Debug2/Release2; website6; controlled production GUI5/errors0; ESLint/Clippy/fmt/Desktop export-TypeScript/Native Release PASS. Only invalidated translation gates repeated; updater actual testing remains user-owned. No announcement publication, installer or public release by this task. Native installed GUI/external browser remain QA. Evidence: resources/verification/dev-01/tasks/tastedev-studio/announcements-20261001/RESULT.md. Guide: resources/guides/dev-01/tastedev-studio/ANNOUNCEMENTS.md.

## Second advancement phase1 — 2026-10-01
Project start experience implementation: separate register/create, exclusive empty/Node starter generation, Native HTTPS Clone/cancellation and local tool check. Source-less Protocol tests use approved saved workspace snapshots through existing Core/Rust Agent. Node529 PASS, applicable Native Debug15/Release15 plus direct UNC display regression, actual public Clone, actual starter smoke Run585e136b-1c70-4c3c-bd29-b8d07fadd70f PASS, controlled GUI4/errors0. Common serialized deployment pending; phase2 not started. No updater installation test. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-1/RESULT.md.

## Second advancement — phase 2 (2026-10-01)
DEV_VERIFIED, deployment pending. Task/Test/Pipeline GUI authoring, preflight validation/preview, stale/dirty protection and existing Agent/Queue navigation implemented. Actual Agent pass/failure/active cancellation and controlled Light/Dark GUI verified. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-2/RESULT.md. Phase 1 public release is 0.1.6; phase 3 is not started.

## Second advancement — phase 3 (2026-10-01)
DEV_VERIFIED, deployment pending. Bounded dirty-aware workspace search and project TypeScript/JavaScript language features implemented. Actual bundled worker definitions/references/diagnostics/completion/format and controlled GUI save/reload verified; remaining owned workers 0. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-3/RESULT.md. Phases 1/2 deployed as 0.1.6/0.1.7. Phase 4 not started.

## Second advancement phase4 — 2026-10-01
DEV_VERIFIED, common serialized deployment pending. Credential-free profiles/TLS guard, Owner Agent grant/revoke and session expiry implemented. Actual approved102 TLS/auth/restart/backup/restore PASS; controlled production GUI with actual local Core RPC PASS. Full Node540 + final scope12, lint and production export/TypeScript PASS. Native Rust unchanged. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-4/RESULT.md. Guide: resources/guides/dev-01/tastedev-studio/SECOND_ADVANCEMENT_REMOTE_OPERATIONS.md. Phases1–3 deployed as0.1.6/0.1.7/0.1.8. Phase5 not started. Installed service/trust store/updater QA remains separate.

## Second advancement phase5 — 2026-10-01
DEV_VERIFIED, common deployment pending. Paged metadata/search/filter/detail and bounded live history; reviewed retention/tombstones, local JSON export, checksum range retry and retained log gaps implemented. Actual2,000 synthetic Run/500 analysis/100 Evidence scale: page p95=48.36ms, page5030bytes, live115116bytes, peak heap delta36133280bytes. Actual Core/HTTP/restart/restore and controlled GUI PASS. Full547 had one cancelled-Job regression, repaired scope9PASS + final security13PASS;548 current cases covered. Lint/production export-TypeScript PASS. Phases1–4 deployed0.1.6–0.1.9. Phase6 not started. Evidence: resources/verification/dev-01/tasks/tastedev-studio/second-advancement/phase-5/RESULT.md. Existing Core scans/full encrypted snapshot remain; no unlimited-scale or installed QA claim.

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


## 3차 고도화 4단계 — 로컬 Node / TypeScript 디버거 (2026-10-01)

Owned Node Inspector native host, project/saved-hash validation, breakpoints/continue/pause/step-over/into/out, scoped read-only locals/call stack/bounded console, Monaco breakpoint/paused decorations, Dirty protection 및 disconnect/exit/update cleanup를 구현했다. 실제 .cjs/.ts native host 중단점·step·local value5·source integrity를 확인했다. Rust Debug/Release와 GUI 최종 결과 및 배포 상태는 resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-4와 checkpoint.json에 기록한다. Remote Attach/arbitrary CDP/evaluate/setter는 제공하지 않으며 Node native stripping 지원만 제공한다. 실행 프로그램의 OS sandbox, transpiled source maps, Python/Rust debugger 및 Unix 실제 GUI 검증은 미지원/미검증이다. Guide: resources/guides/dev-01/tastedev-studio/THIRD_ADVANCEMENT_DEBUGGER.md.


## 3차 고도화 5단계 — Git 협업 (2026-10-01)

Branch create/switch, approved fetch/fast-forward-only pull/non-force push/commit, one-shot60s Workspace approval/fingerprint, Dirty protection 및 Filesystem/Git 직렬화를 추가했다. 실제 disposable native Git/local bare remote branch/commit/push identity/fetch/peer pull과 stale/cancel/path/injection/conflict3-way 읽기·직접 해결 Stage를 확인했다. GUI는 controlled IPC로 검증한다. GitHub credential 없는 remote의 비교 URL로 사용자 PR 검토/생성 화면에 연결하며 Studio 직접 PR 생성 API 및 실제 public PR 생성은 범위 밖이다. Detached/unborn 협업, automatic remote tracking/merge/rebase/stash/force는 제공하지 않는다. 품질·공용 배포 결과: resources/verification/dev-01/tasks/tastedev-studio/third-advancement/phase-5 및 checkpoint.json. Guide: resources/guides/dev-01/tastedev-studio/THIRD_ADVANCEMENT_GIT_COLLABORATION.md.

## 5차 고도화 1단계 — Core 저장/지연 조회 (2026-10-02)

0.1.24 개발: SQLite repository는 encrypted relation index에서 필요한 Run/Job/Step/Evidence를 선택하고 body를 지연 조회한다. transaction은 노출된 row만 draft로 읽고 변경된 body만 기록한다. entity/revision/index/history/usage는 한 transaction으로 commit한다. InMemory는 immutable baseline과 copy-on-read로 전체 Source 복제를 줄이며 실패/중첩/비동기 동작의 원자성을 보존한다. Core runtime/orchestrator의 active/detail 조회와 Artifact startup audit는 해당 범위만 읽는다.

전체 Node637 및 마지막 immutable 보완42관련 PASS(최종638 effective), lint/static/export 증거는 resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/phase-1 및 상위 logs 참조. 기존 Native gates는 입력 해시를 검증해 재사용하고 버전/정적 자산 binary만 rebuild한다. 패키지·Core smoke 완료 상태는 각 checkpoint가 authority다.

제한: CoreStore의 DB 무결성/암호 인증 전체 audit, Artifact 파일 audit, 메타데이터 manifest/index 전체 기록, 요청된 scheduling/export collection 조회, 단일 writer 정책 유지. 실제 장기간 운영·설치·서비스/업데이트 QA는 사용자 담당이다. 5차2~6단계는 아직 구현 전이며 순차 진행한다. 102 배포/자동 게시/서비스 설치/commit/push 없음.

## 5차 고도화 2단계 — Project Snapshot v2 (2026-10-02)

0.1.25: 원래 바이트 기반 binary/UTF-8 BOM/empty file Snapshot과 인증된 HTTP manifest·256KiB 재개 전송, 프로젝트별 checksum reuse, Run/Step/Agent 범위 다운로드를 추가했다. WebSocket에는 작은 Source reference만 전달한다. sourceSnapshot:2 capability가 없는 Agent는 v2 작업에서 제외된다. Protocol과 AI Retest에 연결하고 기존 승인/Dirty 보호/Queue/Pipeline을 재사용한다.

실제 localhost Core + Rust Agent에서203files/700436bytes 두 Run PASS, 두 번째202files reuse, Dummy .env 제외, 실제 HTTP interruption/prefix recovery와 권한/무결성 검사 PASS. Node650 full PASS, lint/export-TypeScript PASS. Native 최종 gate와 패키지 상태는 fifth-advancement/phase-2/local-package-checkpoint.json이 authority다. 사용자 설치/원격/GUI QA는 미실시. 102 배포·게시·설치 없음.

한도:100MiB total/8MiB file/10000files/2MiB manifest, Agent cache256entries/512MiB, Core blob512MiB/project128manifests. 자동 manifest retention, 외부 blob storage와 매우 느린 전송의 grant 자동갱신은 미지원. 상세: resources/guides/dev-01/tastestudio-fifth-advancement/PROJECT-SNAPSHOT.md. 3~6단계는 아직 순차 진행 대상이다.

## 5차 고도화 3단계 — 재현 조건 비교 (2026-10-02)

0.1.26: Core가 검증된 Snapshot manifest에서 launch identity를 제외한 contentChecksum을 계산한다. Agent의 임의 contentChecksum은 보존하지 않는다. 기존 fixed runtime recheck 결과와 Agent version을 결과 metadata로 기록하고 승인된 요구사항을 확인한다. Run comparison은 content identity/definition/observed runtime·Agent version 차이를 표시하며 unknown과 legacy registration을 구분한다.

실제 Core/Rust Agent0.1.26 두 Snapshot203files: 다른 transport checksums/같은 contentChecksum, Node24.11.1 observed, 같은 환경 comparable, 실제 test2PASS. 민감 environment values/credential은 metadata에 없다. 테스트·패키지 완료 gate는 fifth-advancement/phase-3 및 DELIVERY-INDEX/checkpoint authority. OS build/kernel/container/package 설치·binary hash attestation은 미지원이며 관측값은 연결 Agent의 보고다. 상세 guide: resources/guides/dev-01/tastestudio-fifth-advancement/REPRODUCIBILITY.md. 102 배포·설치·게시 없음. 4~6단계는 순차 진행한다.

## Fifth advancement phase4 — 0.1.27
Affected-file Protocol validation plans, immutable history, current Retest evidence and v2 AI Snapshot history implemented. Actual ChatGPT Pro+Rust Agent failure→fix→PASS, rollback/source hashes/secret0/orphan0 verified. Node658 effective, lint/export PASS; unchanged native gates reused by hashes. Local packages only; installed QA user-owned. Evidence: resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/phase-4/RESULT.md.

## Fifth advancement phase5 — 0.1.28
Completed Snapshot bodies/manifests are included in offline v2 backup, restored only into a new directory after references/checksums validate. Read-only doctor validates DB/key/schema/Evidence/Source without generating keys or migrating original data. GUI separates authentication and connection recovery. Node663/663, lint/export PASS. External config/credentials/service registration remain outside backup; Windows DPAPI recovery requires original user. Evidence phase-5/RESULT.md; local packages only.

## Fifth advancement phase6 — 0.1.29 / local deliverables complete
History search/keyset navigation/cancel and stale session/project/permission response protection implemented. Analysis/Attempt navigation reuses restored AI review; no automatic approval/write/provider call. Source transfer progress is separate from actual Run/Agent/Step verification. History HTTP request/response bounds align with v2 metadata. Node667/667 PASS; full lint had one cleanup-ref warning, repaired with scoped lint PASS; final production export including TypeScript PASS. Native Debug/Release111 PASS+4 existing ignored reused from phase5 after source/toolchain/log hash verification, version/frontend Release build refreshed. Actual controlled Core GUI31 records paging/search/empty verified, browser errors0; packaged Core ready/stop PASS. Installed Native/Light-Dark/service/update/user-machine QA not run. Phase4 actual Provider+Rust Agent FAIL→fix→PASS evidence retained without duplicate calls. All six stages have local Windows installer/portable ZIP/Core runtime ZIP; user deploys/tests. No102/remote publication/install/commit/push. Evidence: resources/verification/dev-01/tasks/tastedev-studio/fifth-advancement/FINAL-DELIVERY.md and DELIVERY-INDEX.json. User guide: resources/guides/dev-01/tastestudio-fifth-advancement/WORKFLOW.md.

## Sixth advancement phase1 — 0.1.30
Existing Rust/Python LSP diagnostics/definition/references/rename are reused. Monaco completion, bounded safe LSP item conversion, current dirty editor sync and stale source/session/model result rejection added; hover current-buffer sync added. Actual local Pyright/rust-analyzer completion plus production adapter PASS; source0/orphan0/exit0. Node670/670, lint/typecheck/production export PASS. Native gates reused by source/toolchain/log hashes, Release binary refreshed for frontend/version. Local installer/ZIP/Core signed manifest verified. Native installed completion GUI/user QA not run. Commands/hidden additional completion edits and unsupported defaults are blocked; auto-import and full TS project reference semantics not supported. Evidence: resources/verification/dev-01/tasks/tastedev-studio/sixth-advancement/phase-1/RESULT.md. Phases2–6 remain active; no102/publish/install/commit/push.


## Sixth advancement — implementation and local package completion (2026-10-02)

| Phase | Delivered behavior | Local version | Verification |
|---|---|---|---|
| 1 | Rust/Python LSP completion and stale/dirty guards | 0.1.30 | Actual Pyright/rust-analyzer completion; Node670 |
| 2 | Rust CodeLLDB and shared safe DAP lifecycle | 0.1.31 | Actual Rust/Python breakpoint/step/locals; native112 Debug and112 Release |
| 3 | Protocol execution profiles with requested/observed identity | 0.1.32 | Actual local Rust Agent mismatch blocking + compatible install/test; Node675 |
| 4 | Offline snapshot usage/preview/prune and bounded transfer renewal | 0.1.33 | Reference/hash safety; HTTP grant expiry; actual203-file Agent test; Node677 |
| 5 | Grounded language context and Protocol language validation recommendations | 0.1.34 | Actual ChatGPT Pro fix + approved source patch + local validation + actual Rust Agent PASS; source restored; Node680 |
| 6 | Manual workflow navigation and identifier-only explicit restart restore | 0.1.35 | Node683; actual persisted Provider analysis/attempt + matching Rust Run restored after SQLite reopen |

Lint and production export/typecheck passed per changed phase. Native inputs unchanged after phase2: later phases reuse verified Debug/Release/fmt/Clippy by input, toolchain and log hashes; version/frontend release binaries are rebuilt for packaging. No duplicate full tests merely for packaging. Node has no meaningful Debug/Release test distinction.

Delivery scope: signed local Windows installer/portable and Core runtime ZIP per phase. Node24 runtime is separately required for Core. No102 deployment, remote installation, publication, tags, commits or push. Installed GUI, updater, Linux/macOS and service-install QA remain user-owned, not claimed PASS.

Evidence: resources/verification/dev-01/tasks/tastedev-studio/sixth-advancement/DELIVERY-INDEX.json and per-phase RESULT.md/logs; guides: resources/guides/dev-01/tastestudio-sixth-advancement.

Final sixth-advancement delivery: all6 phases and18 current local artifacts verified; final0.1.35 frontend diagnostic identity matches version. Earlier phase archives may retain preceding frontend diagnostic metadata; use0.1.35. Installed/cross-platform QA remains user-owned. FINAL-DELIVERY.md and DELIVERY-INDEX.json record exact evidence and limitations.

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

## Canvas navigation — 2026-10-04

Implemented Fit flow to view / Reset canvas view as compact right-side toolbar actions. Fit measures rendered node heights and SVG edge/label bounds, computes bounded zoom and scroll, and applies scroll after React layout. Reset restores100% and origin. Custom fitted percentage remains selected;25% manual zoom added. Existing graph coordinates, layers, persistence, selected node, approvals and execution untouched. Fit/reset disabled during drag; read-only locked graphs remain viewable. Both labels translated across all supported catalogs.

Verification: viewport3 and i18n9 tests PASS (12 unique); full lint PASS plus changed-file repair lint PASS; final production build/TypeScript PASS; diff-check PASS. Initial build compiled but failed readonly catalog assignment, repaired with existing Object.assign registration. Source changed after failure, so compilation gate invalidated and rerun; no entire test suite rerun. Original failed build retained. Node has no separate meaningful optimized test mode. Prior checkpoint input hashes differ only views.tsx, orchestration.css, orchestration.ts, plus new viewport helper/test. Unrelated Core/Agent/AI tests not run.

GUI/native remains unverified due to prior browser security rejection, no bypass. Manual check: with distant nodes and failure feedback links, use Fit flow; verify all nodes/links visible, positions/unsaved state unchanged; use Reset; check long labels, narrow window and light/dark. Fit is explicit, not automatic on resize. Version0.1.40 unchanged; production4318 ready. No package/deploy/commit/push. Evidence canvas-viewport/{RESULT.md,checkpoint.json}; guide CANVAS-VIEWPORT.md.

## Project canvas view persistence — 2026-10-04

Presentation-only versioned localStorage keyed by project now stores zoom/scroll offsets separately from graph topology/layers and review bookmarks. Manual zoom/Fit/Reset and scroll feed150ms debounce; pending scroll writes flush on component/project cleanup. Restore waits for the matching graph and a visible canvas using ResizeObserver; hidden zero-size panels cannot overwrite records. Bounds, version/project mismatch/malformed data and stale-window baseline checks protect existing records. Errors show guidance and disable subsequent persistence while canvas navigation remains available. No Core/Agent/Provider/source/execution changes.

Verification: canvas storage3 + fit3 + i18n9 =15 unique tests PASS. Full lint initially failed render-time ref write; moved ref synchronization into layout effect and repaired-file lint PASS. Initial build PASS but hook repair invalidated compiled inputs, final production/TypeScript build PASS. Test inputs unchanged after hook repair so successful pure tests retained; no full suite repeat. Node has no meaningful separate Release-mode tests. Related persistence/bounds/project isolation/concurrency/storage-denial tests executed; GUI/native unverified due prior browser policy.

Manual acceptance pending: move scroll/zoom, leave/reopen project and reload; switch between projects; hide/show canvas; reset to100%; inspect corrupt or stale-window records and storage denial. These are not GUI PASS claims. Cleanup flush verified by source inspection only. A hard browser/process termination during debounce may lose the most recent150ms; no guarantee for abrupt termination. Core not needed, records are local to this browser/profile. Graph arrangement/coordinates and review location are independent.

Production4318 ready, version0.1.40 unchanged. No package/deploy/commit/push. Evidence canvas-view-persistence/{RESULT.md,checkpoint.json}; guide CANVAS-VIEW-PERSISTENCE.md.

## Node search / reveal — 2026-10-04

Added Find node and Show selected node icon actions on the right toolbar. Existing accessible Dialog searches current graph name/kind/reference, including localized labels, normalized compatibility characters and case-insensitive multiple literal terms. Duplicate names keep independent node IDs and graph order. Result buttons display node kind/reference/icon; Enter selects only a unique match, Escape closes through existing Dialog. Search/reveal disabled during drag. Result selection sets existing selected node and moves the presentation camera to its center at the current zoom; guarded RAF focuses that node without extra scrolling. This updates independent persisted canvas view, not graph coordinates, dirty state, relationships, Protocol or execution. No Provider/approval/source-write/Agent call.

Verification: search3 + i18n9 =12/12 PASS; full lint PASS; one production build including TypeScript PASS; diff-check PASS. Prior input hashes differ only views.tsx, orchestration.css and orchestration.ts; new node-search.ts/dialog/test added. Unchanged canvas persistence/fit tests not repeated. Node has no meaningful separate optimized test mode. GUI/native remains unverified due prior browser policy rejection, no workaround attempted.

Manual check: Search icon -> names/kinds/references; duplicate titles and no results; keyboard Tab/Enter/Escape; result selection/Show selected node -> visible highlighted node/inspector context; locked graph browsing; no coordinate/dirty-state mutation; small viewport/light-dark. Nodes near canvas boundaries are clamped to existing scroll limits. No multi-selection or source ownership mapping introduced. New copy has Korean translation and existing English fallback in other locales.

Production4318 ready, version0.1.40 unchanged. No package/deploy/commit/push. Evidence node-search/{RESULT.md,checkpoint.json}; guide NODE-SEARCH.md.

## Selected node relationship trace — 2026-10-04

Added a pressed-state toolbar toggle emphasizing selected node direct neighbours/edges while fading unrelated content. Failure feedback remains dashed; trace does not recursively follow cycles or execute work. Existing inspector relationship list is now grouped Incoming/Outgoing with counts, relative node labels/kinds/relationship, empty states and explicit navigation guidance. Target click reuses node reveal/context selection. Existing relationship deletion retained via separate labelled trash button and readiness/lock/drag guard. Same-project/missing-selection/dangling-endpoint checks prevent fallback navigation. No graph schema/Core/Agent/Provider/source changes; browsing does not alter graph coordinates/dirty state. Trace itself is ephemeral and does not change saved topology/layer order.

Verification: direct-neighbour/project-boundary/dangling-endpoint tests3 + i18n9 =12/12 PASS. Full lint found one views.tsx parse error; repair-file lint finally PASS. Initial build parse failure retained; first repair script could not launch system Python and made no changes, accidentally followed by a failed same-input build retry. Corrected with existing Node runtime and final production build/TypeScript PASS. Only UI class expressions changed in repair; successful pure/domain/catalog tests retained without repeated full suite. All actual attempts retained in logs. Final diff-check PASS. Node has no meaningful separate optimized test mode.

GUI/native remains unverified due prior browser URL policy; not bypassed. Manual: toggle trace with device/role/task/approval, verify direct incoming/outgoing only and feedback dash, select neighbour to continue, turn toggle off, check disconnected/locked graph read-only browsing, no selection/unrelated content and labels in narrow/light-dark. No new Provider/Agent/remote run or deletion executed during verification. New text uses Korean translations and existing English fallback for other locales.

Production4318 ready, version0.1.40 unchanged. No package/deploy/commit/push. Evidence relationship-trace/{RESULT.md,checkpoint.json}; guide RELATIONSHIP-TRACE.md.

## Canvas edit undo/redo — 2026-10-04

Added compact Undo/Redo toolbar actions for local graph drafts. Node movement/name/settings/add/remove, relationship changes and arrange flow use the existing validated change path. A drag pointer sequence coalesces into one undo baseline; no-op edits do not consume history; new edit after undo clears redo. Up to50 detached validated snapshots per direction, current-project checks, lock/readiness/drag guards. Undo/redo revalidates snapshots, corrects missing selected node and clears pending relationship/menu selection. Dirty state compares canonical graph with existing saved baseline; replay never writes localStorage automatically or bypasses its save conflict check. Project graph reload resets edit history. Existing Core configuration matching and captured execution history stay independent.

Verification: history4 + orchestration graph9 + i18n9 =22/22 PASS; full lint PASS; one production build/TypeScript PASS; diff-check PASS. Tests cover node/edge deletion restoration, undo/redo, grouped drag, redo invalidation, bounds, detached snapshots, invalid/cross-project edits, no-op and canonical saved/dirty state. Previous input hashes differ only views.tsx/orchestration.ts plus new edit-history helper/test. Unrelated Agent/Core/Provider suites not repeated. Node has no separate meaningful optimized test mode.

Actual GUI/native unverified due prior browser policy rejection, no bypass. Manual: drag then Undo/Redo; edit settings/relations; remove node and restore it; arrange then undo; edit after undo and confirm redo disabled; save/undo back to saved baseline; locked/dragging guards; narrow viewport/light-dark. No actual task/Agent/Provider call or project Source write was performed by this verification. History is memory-only and resets on project reopen/reload, no graph keyboard shortcuts yet, typing uses per-change entries. Layer order, AI configuration, canvas zoom/scroll, Source edits, approvals and running work are outside graph undo/redo. Restored graph remains a draft until explicitly saved.

Production4318 ready, version0.1.40 unchanged. No package/deploy/commit/push. Evidence graph-edit-history/{RESULT.md,checkpoint.json}; guide GRAPH-EDIT-HISTORY.md.

## Scoped canvas keyboard shortcuts — 2026-10-04

Canvas/toolbar focus supports Ctrl/Meta+Z Undo, Ctrl/Meta+Shift+Z or Ctrl/Meta+Y Redo, Ctrl/Meta+F Find node. Existing travel/search actions reused. No document/global listener. DOM scope excludes inputs, textareas, native select, editable content, textbox/combobox, Monaco, dialogs/menus/listboxes. Already handled events, IME composition, key repeat, Alt and ambiguous/no modifiers are ignored. Readiness/current-project/drag guards retained, locked or empty history cannot dispatch graph edits; locked read-only node search remains available. Action tooltips and aria-keyshortcuts identify commands; canvas accessible description explains them. No save/run/approval/source edit bound to these keys.

Verification: shortcut routing/protection3 + i18n9 =12/12 PASS; full lint PASS; one production build/TypeScript PASS; diff-check PASS. Tested Ctrl/Meta mapping, uppercase key, input/outside scope, IME/repeat/handled modifiers, locked/empty history and unrelated keys. Previous hashes changed only views.tsx/orchestration.ts, plus new shortcut helper/test. Unchanged history/search/domain tests not rerun. Node has no separate meaningful optimized test mode.

Actual GUI/native and OS interception are unverified due prior browser URL policy rejection; not bypassed. Manual check: focus canvas/node/tool buttons and exercise Undo/Redo/Find; confirm input/Monaco native commands remain intact, dialog/menu keys do not affect underlying graph, IME/held keys and locked graph protections. Browser/system shortcuts remain native outside canvas/toolbar. No actual Provider/Agent/run/project Source writes performed. New explanation has Korean copy and established English fallback elsewhere.

Production4318 ready, version0.1.40 unchanged. No package/deploy/commit/push. Evidence canvas-shortcuts/{RESULT.md,checkpoint.json}; guide CANVAS-SHORTCUTS.md.

## Selected node duplication — 2026-10-04

Added Duplicate node to context menu with Copy icon and node Inspector. Copies only kind/role/taskType and a localized, Unicode-safe bounded label into a new validated UUID node near original. All references cleared, relationships not copied; AI profiles/bindings and execution identities are not assigned to the new node. Original nodes/edges stay unchanged. New draft uses existing graph change/history/save path, selects/reveals/focuses copy, can undo/redo and respects lock/ready/drag/project/60-node limits. No actual Agent registration, Protocol execution, external AI or Source mutation is triggered.

Verification: duplication4 (Agent/Protocol isolation, Unicode/bounds, missing/collision/project/path/capacity, undo/redo) + graph9 + i18n9 =22/22 PASS; full lint PASS; one production build/TypeScript PASS. Diff-check initially failed EOF blank line only, repaired and final diff-check PASS. Installed Next PostCSS parsed semantic trees before/after formatting are identical; CSS input/semantic hashes recorded in css-format-reuse.json. Production output retained without redundant compilation for trailing whitespace; artifact hashes recorded. Other source/dependencies unchanged after build. Unrelated tests not repeated; Node has no separate meaningful optimized test mode.

GUI/native unverified due prior browser URL policy rejection, no bypass. Manual: duplicate device/task/Agent from menu and Inspector, check selection/new ID/reference empty/no relationships/no AI binding/original unchanged; assign new references explicitly; Undo/Redo; locked/dragging/capacity controls; long label/narrow/light-dark. Copy does not clone task source files, Agent processes, schedules or remote resources. May overlap original slightly by design; new node starts at top of derived layer order and can be moved. Korean copy with established English fallback elsewhere.

Production4318 ready, version0.1.40 unchanged. No package/deploy/commit/push. Evidence duplicate-node/{RESULT.md,checkpoint.json}; guide DUPLICATE-NODE.md.


## Goal closure 1 — 2026-10-04

History approval/resume now reuse scoped GraphNodeControls review instead of raw action buttons. Current Core overview is checked against connection/session/definition and execution project boundaries; previous session history cannot control work pending refresh. Existing dirty/version/input-checksum/review guards and Core authority remain. Session3 + control6 + monitor4 =13/13 PASS, full lint PASS, one production/TypeScript build PASS. Prior checkpoint input comparison: only runtime-view plus new session helper/test changed. Artifact/log/input hashes recorded; unrelated suites not repeated, Node has no meaningful optimized test configuration. GUI remains unverified due browser policy rejection; no bypass. Version0.1.40 unchanged, original localhost4318 ready. No package/deploy/102 transfer/commit/push. Overall goal remains PARTIAL/active. Next: readiness, artifact/deployment contract, actual integration/recovery and manual GUI qualification. Plan resources/guides/dev-01/tastestudio-node-orchestration/GOAL-CLOSURE.md; evidence goal-closure-1/{RESULT.md,checkpoint.json}.


## Goal closure 2 — 2026-10-04

Graph setup checklist reports node-specific missing Protocol Task/Test, responsible role, declared-device/Agent assignment, immediate deployment approval, unsupported multi-parent success joins, project-owned unique Schedule root binding and AI route/profile requirements. Unknown/loading/disconnected/offline references are waiting rather than fabricated missing objects. AI tasks skip normal Protocol/Agent requirements while retaining role/deployment-approval checks. Bound AI task card identifies AI configuration instead of claiming a missing Protocol reference. Checklist navigation reuses reveal and guarded node-settings focus; no graph/source mutation or execution. Informational only: no issues is not an execution/authorization PASS; Core validates actual saved inputs/capabilities/permissions. Schedule activation remains explicit and separate.

Readiness7 + i18n9 =16/16 PASS, full lint PASS, one production build/TypeScript PASS, diff-check PASS. Tests cover immutable inputs, declared/direct assignment, loading/offline/missing references, role, deployment failure branch approval, foreign Schedule/root checks, AI waiting/invalid route and project boundaries/joins. Input/output/log hashes recorded in goal-closure-2/checkpoint.json. Unrelated tests not repeated; Node has no meaningful optimized test mode; Rust unchanged. Actual GUI/native remains unverified due browser policy rejection; no workaround. New Korean copy plus established English fallback for other locales. Version0.1.40 unchanged; no package/remote deploy/102/Provider/Agent job/commit/push. Goal remains active/PARTIAL. Next: Source versus deployment artifact contract and real safe integration verification.


## Goal closure 3 / final local regression — 2026-10-04

Existing controlled verifier executed on current original Core source with installed actual Rust Agent. Local implementation/shared-tool-integrity -> approval -> disposable local copy -> actual test PASS; intentional failure independent history; cancellation cleanup; all12 Run Snapshot bytes and identity match; Dummy .env excluded; Agent stderr0. Existing Scheduler resumed same SQLite/Source/Agent: disabled save no execution, one-time trigger pinned graph, fresh approval retained, cancellation/historyconsistent, four new Runs. Post-test owned processes0. Evidence goal-closure-3/actual-1791078100311/{RESULT.json,SCHEDULE-RESULT.json}, process-cleanup.json. Full final Node regression890/890 PASS with0 fail/skip, performed once in goal-closure-4/node-tests.log.

Verifier report text incorrectly asserted an old credential blocker without probing it during this run. Raw result preserved, scope-audit.json corrects claim, verifier text changed only. Scoped script syntax/lint PASS; product build/lint retained by input/output hashes; no unchanged application recompilation. Source/deployment contract documented in SOURCE-DEPLOYMENT-CONTRACT.md. Source Snapshot and Evidence upload are not a deployment-package transfer claim. Actual release planning, packaging, signing, publication, remote-device transfer and installed GUI qualification NOT_PERFORMED. Browser GUI remains blocked by prior policy; not bypassed. No current authentication failure inferred, no remote102 operation. Version0.1.40 unchanged, goal remains PARTIAL/active pending completion audit and external evidence.


## Goal closure 5 — Scheduler session isolation / 2026-10-04

Found remaining stale Scheduler cache after Core/project changes. UI Scheduler records, selection and feedback are scoped by project/connection key/generation/connection status. Mixed-project schedules/history hidden. Failed current list clears cache. Late/mismatched requests cannot write current state; context change between mutation and list stops follow-up RPC. Protocol sync verifies current context/folder/permission/dirty Protocol after async reads. Existing server Scheduler, permissions, trigger logic and Agent remain unchanged.

13 unique scoped tests PASS (readiness7 retained; scheduler-session6 final). Initial3 async tests failed missing import; repaired import, reran affected six only. Full lint PASS, repair-test-file lint PASS, one production build/TypeScript PASS. No repeated full890/actual Agent/Scheduler backend runs because their inputs unchanged; hashes compared to prior checkpoint. Node has no meaningful separate optimized test mode. GUI/native still unverified due browser policy rejection. Version0.1.40 unchanged; no package/deploy/102/Provider/commit/push. Overall goal remains PARTIAL. Manual: switch project/Core, reconnect, delayed old response, failed list, trigger mutation during switch and Protocol sync during folder/dirty changes; no foreign schedules/history or follow-up RPC on new context. Evidence goal-closure-5/{RESULT.md,checkpoint.json}.


## Final blocked audit — 2026-10-04

Current goal-closure-5 source/build hashes and goal-closure-3 actual evidence/full890 log hashes verified. Production session12927 confirmed live. Prior work made implementation/test progress; remaining actual GUI and shared device deployment/install qualification gap persists across goal-closure2,3/4,5 and this audit. No newly confirmed safe code change remains. Target PARTIAL, goal BLOCKED_EXTERNAL_VERIFICATION, not complete. Browser policy not bypassed,102 operations forbidden, deployment/install testing user-managed. No duplicate test/build/deploy performed. Handoff resources/guides/dev-01/tastestudio-node-orchestration/FINAL-VERIFICATION-HANDOFF.md; evidence completion-audit/RESULT.json. Resume on actual user verification result or relevant external state change, preserving valid gates.

## Core 실행 대기 사유 — 2026-10-05

배정된 Agent가 실행 조건을 만족하지 않을 때 GraphActivation.waitingReasons에 Core matcher의 실제 상태·환경 불일치 사유를 저장한다. 게시된 immutable Agent 배정만 검사하며 다른 Agent로 우회하지 않는다. 사유는 중복 제거·정렬 후 최대 12개로 제한한다. 동일 사유의 tick은 상태 저장을 반복하지 않는다. 실행 가능 시 시작/Job 복구, 취소 시 대기 사유를 제거한다. 재시작은 기존 정책대로 paused이며 사용자 resume 전 자동 실행하지 않는다.

실행 기록과 현재 그래프에 호환되는 선택 노드에 대기 사유를 표시하고, activation 종료 사유도 표시한다. ready 상태의 실행 전 대기를 대상으로 하며, 이미 생성된 queued Job의 상세 대기 진단은 이번 범위에 포함하지 않는다. 한국어 사유 및 다른 언어의 영어 fallback을 제공한다.

전체 Node 920개 중 919 PASS/1 fixture FAIL(누락된 Protocol runtime 조건). fixture만 수정 후 영향받는 graph-execution 13/13 PASS; 나머지 907개 성공 결과는 코드 입력이 동일하여 반복하지 않았다. 전체 lint와 수정 테스트 lint PASS. production build/TypeScript 결과는 resources/verification/dev-01/tasks/tastedev-studio/graph-waiting-20261005/checkpoint.json 참조. Node에는 별도 Debug/Release test 구성이 없다. GUI·설치·실제 Rust Agent 재실행·원격/102 전송 없음. 전체 목표 완료를 주장하지 않는다.
## Queued Job의 실행 대기 사유 — 2026-10-05

앞 단계의 ready activation 진단을 생성된 queued Job까지 확장했다. 기존 dispatch를 먼저 시도한 뒤 최신 Core Job/Run 상태를 읽어 표시한다. 고정 배정 Agent가 오프라인/환경 불일치면 실제 matcher 사유를 표시하고, 실행 조건이 맞지만 Core가 아직 배정하지 않은 경우에는 내부 정책을 추측하지 않고 Core dispatch 대기로 표시한다. 새 Agent로 우회하거나 새 Job을 생성하지 않는다. 연결 복구 후 같은 Job/Agent로 Run을 생성하며 대기 사유를 제거한다. queued 취소는 Run을 생성하지 않고 사유를 정리한다.

전체 Node 922/922 PASS, fail/skip 0. 전체 lint와 production build/TypeScript 결과는 resources/verification/dev-01/tasks/tastedev-studio/queued-waiting-20261005/checkpoint.json에 기록한다. Node 별도 Debug/Release test 설정 없음. Rust Agent 소스·런타임 인터페이스 변경 없음; 실제 Agent E2E 및 Rust 빌드를 반복하지 않았다. GUI/설치/102 전송/원격 배포 미실행. 전체 목표 완료를 주장하지 않는다.
## 빌드 산출물 전달 기반 — 2026-10-05 / IMPLEMENTATION_IN_PROGRESS

BuildArtifact producer/consumer identity와 별도 스트리밍 파일 저장 계층을 추가했다. Project/execution/revision/activation/Run/Step/Snapshot/checksum 경계, 상대 경로/credential 파일 차단, configured secret의 청크 경계 검사, checksum/size, 동일 identity 충돌/변조/동시 저장 overwrite 방지를 검증했다. HTTP 권한·Protocol 선언·Core graph 실행 binding·Rust Agent 수집/수신·GUI는 아직 연결되지 않았다. 이 기반만으로 실제 Agent 전달/4단계 PASS를 주장하지 않는다.

전체 Node928/928 PASS 후 create-if-absent 저장 보강 및 동시 저장 test 추가; 영향받는 build-artifact7/7 PASS, 입력 불변의 기존922 성공은 반복하지 않았다. 전체 lint·production build/TypeScript PASS. Node 별도 Release test 설정 없음. Rust 변경·실제 Agent·GUI·설치·102 전송 없음. 증거 resources/verification/dev-01/tasks/tastedev-studio/build-artifact-foundation-20261005/{RESULT.md,checkpoint.json}, 계약 resources/guides/dev-01/tastestudio-advancement-next/BUILD-ARTIFACT-CONTRACT.md.
## Build Artifact Protocol/Core 식별 계약 — 2026-10-05

Task outputs/inputs 선언·참조/중복/경로 검증, Task/TestPlan/payload 보존, version1 capability 조건, immutable success-ancestor/최신 성공 activation과 실제 Core Run/Step 식별 조회를 추가했다. 이전 성공 producer를 최신 실패 attempt에 재사용하지 않는다. environment/Agent metadata로 identity를 위조하지 않으며 게시된 선언과 실제 payload가 달라도 거부한다. 현재 production runtime은 미활성화 상태로 산출물 작업 게시/실행을 차단한다. HTTP grant와 Rust Agent 수집/수신은 미연결이며 전체 기능 PASS가 아니다.

전체 Node936 중932 PASS/4 신규 fixture FAIL. Source resolver/완료 identity fixture 수정 후 graph-artifacts4 PASS, 나머지932 성공 재사용. TypeScript 실패(권한 조회 narrowing/fixture 필드 누락) 수정, 관련 lint/production build 최종 PASS. Next 실패 당시 BUILD_ID/재개용 bundle 부재를 확인하여 export를 재생성했다. Node 별도 Release test 없음. Core 상태 전이 모델 검증이며 실제 Agent/HTTP/GUI/설치/102/원격 배포/Git 작업 없음. 증거 resources/verification/dev-01/tasks/tastedev-studio/build-artifact-protocol-20261005/{RESULT.md,checkpoint.json}.
## Build Artifact HTTP gateway — 2026-10-05

Scoped ephemeral HTTP upload/download grants and streaming authority checks are implemented. Actual localhost HTTP/Core controlled-state tests verify producer success, explicit approval, checksum download, revoked/expired rights, dummy-secret rejection and tamper protection. Node940/940, lint and production TypeScript build PASS. Production server/Rust Agent wiring remains pending; runtime stays disabled. Evidence: resources/verification/dev-01/tasks/tastedev-studio/build-artifact-http-20261005/RESULT.md. No102/remote/installer/GUI/Git actions.

## Core build-artifact server wiring — 2026-10-05

HTTP routing, asynchronous per-Run grant preparation, connected Agent/team authority, terminal revocation and declared-output proof before successful completion are connected. Whole Node941/941, lint and production TypeScript build PASS. Actual Core HTTP router tested; actual WebSocket graph artifact/Rust producer-consumer flow remains unverified. Production runtime defaults disabled. Evidence: resources/verification/dev-01/tasks/tastedev-studio/build-artifact-server-20261005/RESULT.md. No102/remote/install/GUI/Git.

## Rust Build Artifact contract — 2026-10-05

Agent accepts versioned transfer contracts only with pipeline identity and explicit buildArtifacts v1 requirements. Target/source paths reject traversal, reserved names, credential paths and duplicate targets. Endpoint origin must match locally configured Core (not a received trustedCore value); input metadata must match project, graph execution/revision and Snapshot checksum. Transfer Debug output excludes token values. Actual upload/download execution is not yet integrated, and Agent detection continues to omit buildArtifacts capability. Evidence pending at resources/verification/dev-01/tasks/tastedev-studio/build-artifact-agent-contract-20261005.

Rust artifact contract local gates: Debug42/42, related Release2/2, Clippy/fmt/Release build PASS. Node server inputs SHA unchanged; Node/Web gates not repeated. Actual Rust byte transfer execution remains pending. Evidence: resources/verification/dev-01/tasks/tastedev-studio/build-artifact-agent-contract-20261005/RESULT.md.

## Rust artifact HTTP executor — 2026-10-05

Input staging/checksum/create-if-absent installation and bounded cancellable producer upload are integrated with the existing pipeline. Actual Rust localhost HTTP bytes and command→upload→success tests PASS; Debug retained40+affected7, related Release7/7, Clippy/fmt/Release build PASS. Full Core–Rust Agent two-workspace E2E and multi-input failure/race validation remain pending. Capability and production runtime remain disabled. Evidence: resources/verification/dev-01/tasks/tastedev-studio/build-artifact-agent-transfer-20261005/RESULT.md. No102/remote/GUI/install/Git.

## Actual Build Artifact transfer — 2026-10-05

Real Core and two local Rust Agents in isolated workspaces verified producer→explicit controlled approval→HTTP binary transfer→consumer PASS and intentional FAIL, with exact checksum and Snapshot identity. Multi-file rollback preserves later changes; live HTTP cancellation removes staging. Agent advertises buildArtifacts1 and Core server defaults enabled after actual backend qualification. Node941/lint/production build and Rust scoped Debug/Release/Clippy/fmt/build PASS. Evidence: resources/verification/dev-01/tasks/tastedev-studio/build-artifact-agent-safety-20261005/RESULT.md. Prior disabled-runtime records are historical. GUI artifact metadata, Unix executable-mode handling and installer/GUI qualification remain gaps; no102/remote/Git.

## Captured artifact plan GUI — 2026-10-05

Execution history/selected activation now display captured artifact inputs, outputs, source task and relative paths; whole-plan preview is available before approval. Public projection excludes command/environment/grant data and retains historical definitions. Declaration explicitly does not imply transfer completion. Node945/lint/production build PASS. Actual GUI verification and verified-result receipt display remain pending. Evidence: resources/verification/dev-01/tasks/tastedev-studio/build-artifact-plan-gui-20261005/RESULT.md. No102/remote/install/Git.

## Verified output receipts — 2026-10-05

Core-verified stored outputs now persist per activation and appear separately from declarations with checksum/size/producer/Snapshot identity. Scope and restore validation reject foreign or malformed receipts; save failures preserve prior state. Historical receipt explicitly does not prove full Run success/current blob availability/consumer install. Node947/lint/production build PASS. Actual two Rust Agents PASS+FAIL and actual SQLite restart restored2 receipts. Rust binary SHA unchanged, no repeated compile/tests. GUI visual/overall goal acceptance and Unix mode handling remain gaps. Evidence: resources/verification/dev-01/tasks/tastedev-studio/build-artifact-receipts-20261005/RESULT.md. No102/remote/install/Git.

## Consumer installation receipts — 2026-10-05

Rust emission → authenticated Core transfer/scope/hash validation → durable producer/consumer history → GUI implemented. Actual two local Rust Agents PASS and intentional FAIL both retain installation identity; actual SQLite restart restores2 receipts. Node951 plus final affected guards PASS, Rust Debug52/related Release12/Clippy/fmt/build and final lint/production build PASS. Optional legacy report absence is not proof of installation. Visual/native GUI, Unix executable policy and actual tastedev-files product qualification remain pending. Evidence: resources/verification/dev-01/tasks/tastedev-studio/artifact-installation-runtime-20261005/RESULT.md. No102/remote deployment.

## Artifact executable policy v2 — 2026-10-05

Declare `executable: true|false` on every input/output of a v2 artifact step; producer and consumer must agree. Requirements/capability2 negotiated; v1 remains supported for declarations without this field. Core rejects downgrade, mismatched upload policy or receipt. Unix staging explicitly uses owner-only0700/0600, no privileged mode propagation; Windows retains metadata only. Actual local two-Agent v2 PASS/FAIL/SQLite receipt restore verified, Node955 plus final11, Rust Debug53 plus final13/related Release13/Clippy/fmt/build, final lint/production build PASS. Unix-specific tests not run here; no Linux or GUI qualification claimed. Existing relative executable restriction retained; configured Protocol test/harness required. Evidence: resources/verification/dev-01/tasks/tastedev-studio/artifact-executable-v2-20261005/RESULT.md.

## Rust Source Snapshot false-positive correction — 2026-10-05

The earlier real-product preflight blocker is resolved. Source transfer now distinguishes Rust typed fields and public URL examples from credential literals while retaining known-secret, credential URL, comment, filename and non-Rust conservative checks. Builder, verifier and Core chunk/cache/reopen use the same path-aware policy; a cached Rust blob cannot bypass a stricter data-file policy. External AI display masking remains unchanged. This pattern policy is not a full Rust parser or comprehensive Secret Manager.

Actual read-only TASTEFILES selection: 219 entries, 218 source files retained and stored/reopened byte-for-byte, zero Rust file exclusions. The existing excluded license issuer src/bin directory remains outside this qualification. Snapshot checksum: 68148d313eec559f8105f06780a525a2f53160760af69dddba0489d1605b3039. No actual product compilation or Agent product run is proven by this preflight.

Initial Node/build failures were repaired and logs preserved. Node resume812 PASS plus148 completed unaffected tests retained; final changed-policy scope21/21 PASS, lint and production export/build PASS. No separate Node Release configuration exists. Rust unchanged, no duplicate Rust gates. Evidence: resources/verification/dev-01/tasks/tastedev-studio/snapshot-rust-source-20261005/{PREFLIGHT-FINAL.json,RESULT.md,checkpoint.json}. Remaining: real product CLI Snapshot -> actual Agent build -> artifact -> consumer test qualification; GUI/native/Unix qualification remains separate. No102 transfer, remote deployment, signing, publication, commit or push.

## Rust src/bin Snapshot path compatibility — 2026-10-05

The first actual TASTEFILES Agent build exposed a further path-policy defect: Cargo requires the src/bin/licensegen.rs path while loading manifests even though issuer remains disabled. General bin directories were incorrectly excluded alongside build output. Studio and Rust Agent now preserve source src/bin directories while continuing to reject normal bin output, credential paths and traversal. No issuer feature/private-key operation was enabled, and product source was not edited.

Node961/961, Rust Debug53/53, related Release Snapshot5/5, Clippy, fmt, Agent Release build, lint and production build PASS. Actual prior run failed at Cargo manifest loading before compilation; preserved evidence actual-1791199555438/FAILURE.json. New Agent SHA256 aeca941dc019be77a2617e89633aabd492fc052d67210b3f132bb45d567eb417. Actual product Snapshot/build/approval/consumer validation is running and is not yet a PASS claim. Evidence resources/verification/dev-01/tasks/tastedev-studio/tastefiles-actual-agent-20261005. No102, remote deployment, signing, publication, Git or GUI action.

## Actual TASTEFILES CLI orchestration qualification — 2026-10-05

Actual source Snapshot -> local Core -> producer Rust Agent offline Release build -> controlled explicit approval -> HTTP artifact transfer -> separate consumer Rust Agent CLI test PASS. Producer Run 9aae70c5-a805-45e3-8892-bd1b625bc265 and consumer Run 13d135ff-b847-4ddc-8272-a59733d3775f both passed. Tests exercise find hit/missing exit code, search, listing and copy content. Proposed build uses existing Cargo product/package/bin contract; no separate test runner or release/signing pipeline was introduced. Producer and consumer bytes/hash, v2 executable policy, source Snapshot identity and Core output/installation receipts match. Approval uses the controlled verification client; it does not prove installed GUI user interaction.

Snapshot 0de806e5-94e2-4535-b7f9-7a2f75818c7a. Original selected219 product source hashes unchanged after workflow. Unexpected Core errors0, Agent stderr0, observed owned Core/two-Agent process residual0. Failed precondition/manifest/SDK attempts remain recorded, not relabeled PASS. Windows SDK environment repair applied only to verification Agent processes.

Node961 PASS, Rust Debug53 PASS, Release5 previously checked Snapshot tests plus48 remaining tests (no repeats) PASS; fmt/Clippy/Agent Release build/lint/production export PASS. Script-only environment repair lint/typecheck PASS; no unrelated recompilation. Evidence: resources/verification/dev-01/tasks/tastedev-studio/tastefiles-actual-agent-20261005/{actual-1791200239625/RESULT.json,SOURCE-INTEGRITY-FINAL.json,PRODUCT-OUTPUT-RECEIPT.json,process-cleanup.json,checkpoint.json}.

This verifies local actual CLI build and isolated workspaces, not remote-device deployment or GUI application packaging. GUI TASTEFILES product build/runtime, installed Studio visual interaction, Unix executable behavior and fresh installer/update/operator-package QA remain unverified or user-owned. No102/remote deployment, signature, publication, Git action. Overall orchestration goal remains active pending requirement-by-requirement audit.

## Branding compiler input Snapshot policy — 2026-10-05

Desktop TASTEFILES build reads resources/branding image files, but the former blanket resources exclusion prevented source Snapshot compilation. Studio/Core and Rust Agent now preserve that branding subtree while keeping resources/verification, guides, other operational resources, credential paths and traversal excluded. Existing size/checksum/binary secret policy remains in force; no arbitrary resources allow-list override was added.

Actual read-only GUI compile inputs (5 PNG/ICO images plus UI icon LICENSE) passed byte-preserving v2 Snapshot build/verification with zero exclusions. This is input qualification only, not a GUI compile, installed visual test or remote deployment. Evidence resources/verification/dev-01/tasks/tastedev-studio/branding-snapshot-20261005/ASSET-PREFLIGHT.json. Node962/full, Rust Debug53/related Release Snapshot5, fmt/Clippy/Agent Release build/lint/production build PASS. Previous actual CLI E2E is historical evidence for its recorded policy/Agent inputs, not proof of the changed branding Agent binary.

Next: real desktop product compile/immutable output qualification, using existing Cargo package/bin contract and required assets. Preserve CLI build/test evidence and avoid recompiling unaffected Studio/Agent source. GUI visual/native/Linux/install/user QA remain separately unverified. No102/remote/sign/publication/Git action.

## Actual TASTEFILES desktop build and delivery — 2026-10-05

Current branding-capable Core/Rust Agent verified actual desktop source Snapshot -> offline Cargo Release build -> controlled explicit approval -> HTTP executable transfer -> separate consumer Agent byte/hash and Windows x64 PE structure verification. Producer Run2cbc6bf0-c44d-4179-b83e-2d9966190c0b and consumer Run2d51ba3f-9cac-40eb-b788-8a82c4eced68 both PASS. The GUI executable was not launched; PE integrity is not a functional UI test or installer qualification. Controlled verification approval is not proof of installed GUI interaction.

The earlier long-path RC failure and missing THIRD_PARTY.md input are preserved. Short-path RC probe succeeded; the current Snapshot includes source, actual branding/icon LICENSE and THIRD_PARTY.md. Cache preconditions verified225 unchanged inputs; cache audit verified234 compiled rlib byte hashes and copied timestamps (1ms tolerance for Node timestamp precision),6 changed/missing libraries. Cargo fingerprints decided rebuilds; no unqualified old desktop executable was reused. The fixed trusted Protocol task invokes the same existing Cargo package/bin/locked/offline/release contract without an unrestricted shell or release/signing runner.

Original selected226 file hashes unchanged after verification. Core unexpected errors0, Agent stderr0. Recorded Core and verification Agent process residual0; verifier awaited owned child exits. No102/remote deployment, native GUI launch, installer, signing, publication or Git action.

Evidence resources/verification/dev-01/tasks/tastedev-studio/tastefiles-desktop-agent-20261005/{actual-1791202013367/RESULT.json,OUTPUT-RECEIPT.json,SOURCE-INTEGRITY-FINAL.json,CACHE-OUTPUT-AUDIT.json,PROCESS-CLEANUP.json,PATH-PROBE.json,checkpoint.json}. Script lint/typecheck PASS, existing Node962/Rust Debug53/related Release5/lint/Clippy/Agent build/production Web gates retained for unchanged application inputs. Remaining overall audit must distinguish implemented relationships/execution/approval/scheduler/recovery from native visual, Unix, latest packaging and user installation/update evidence.

## Current Core runtime packaging audit — 2026-10-05

A fresh current Core bundle failed the packaging credential/secret filename guard on the public snapshot-secrets.ts policy module. Renamed to snapshot-content-policy.ts with byte-identical contents, updating builder/transport/test imports; the safety guard remains unchanged. Current455 source and actual resolved dependency hashes match the standalone bundle. Actual bundled localhost Core readiness PASS, unexpected errors0. Full Node963 (package6 plus remaining957 without duplicate execution), lint and production build/export PASS. Rust unchanged and not recompiled. Evidence: resources/verification/dev-01/tasks/tastedev-studio/completion-audit-20261005/{RESULT.md,INPUT-INTEGRITY.json,BUNDLED-CORE-READINESS.json,checkpoint.json}. This proves current runtime integrity, not a fresh operator ZIP, signed release, service installation, GUI or Linux QA. Overall requirement audit remains active; no102/remote/Git action.

## Relationship orchestration local implementation closure — 2026-10-05

The six node kinds and explicit device/Agent/role/task/approval/schedule relationships, Core publication/execution/queue/approval/recovery, build artifact producer/consumer lineage, receipts, retry/failure safety and current Core packaging are DEV_VERIFIED. The final requirement mapping and actual verification limits are recorded in completion-audit-20261005/ACCEPTANCE.md and EVIDENCE-INDEX.md under resources/verification/dev-01/tasks/tastedev-studio. Current Node964 coverage combines unchanged completed963 with the new packaging host-reuse test1; script-only follow-up used scoped lint/PowerShell syntax, no Studio or Agent rebuild. Rust Release53 combines unchanged completed Snapshot5 with remaining48, without repeated tests or compilation. Actual TASTEFILES CLI and desktop qualification retain their precise recorded scopes; desktop PE/byte validation is not GUI execution.

Current Windows Core operator ZIP contains463 verified manifest files and reuses a source/tool/compiler/executable hash-verified shared service host. Legacy host compiler provenance was absent, so one controlled shared host compilation established the new record; actual package creation reused it. The ZIP is unsigned, requires external Node24 and performs no service installation. OPERATOR-PACKAGE.json records archive SHA. Installed GUI/updater/SCM/Linux/physical remote-device QA remains unperformed and user-owned. Current uncommitted source is not READY_FOR_QA or a published release. No102 transfer, remote deployment, signature, release, commit or push.

## 운영 고도화 6단계 — 2026-10-07

DEV 구현 완료: 연결 마법사, 명시적 장비·Agent·역할 운영판, 점검의 노드/관계 표시, 최신 시도 진행 관제, 검토 기반 복구 및 Core 입력/기한 차단, 스케줄 운영판/동일 계산기 미리보기. 기존 실행/승인/Source/History와 skip 정책을 재사용한다. 종료된 failed 실행의 임의 재개는 지원하지 않으며 변경 입력은 새 검토/실행이 필요하다.

자동 검증: 전체 Node 981건 중 979 PASS, 발견된 2건 수정 후 관련 테스트 PASS, 추가 복구 테스트 1 PASS. 최종 목록 982건의 유효 결과를 합산하여 재사용하며 전체 982건을 다시 실행했다고 주장하지 않는다. ESLint 전체의 유일한 실패 파일을 수정 후 관련 정적 검사 PASS. 운영용 Desktop Web export 및 포함 TypeScript 검사 PASS. Rust/설치/실장비/GUI/패키징/배포 검증은 별도이며 실행하지 않았다.

사용법: resources/guides/dev-01/tastestudio-operations-advancement-20261007/OPERATIONS.md. 검증과 입력 체크포인트: resources/verification/dev-01/tasks/tastedev-studio/operations-advancement-20261007. 출시/버전/commit/push 변경 없음.


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

## 제품 오케스트레이션 6단계 — 2026-10-31 DEV_VERIFIED

후속 실제 AI 작업 완료/GUI, 명시적 장비 준비 진단, Source가 고정된 실제 산출물 흐름, missed/Protocol bounded retry, Source까지 확인하는 재시작 복구·수동 실패 재시도, TASTEFILES Protocol/전달 초안을 구현했다. 실제 gpt-6.1-sol4회와 Rust Agent 후속 Test를 완료했다. 실제 Core 재시작에서 producer Run을 보존해 duplicate Job0으로 consumer를 완료했다.

실제 TASTEFILES0.2.34 CLI Snapshot758개를3개 로컬 Rust Agent로 컴파일·실제 copy Test·전달·승인된 private staging까지 검증했다.5분 고정 artifact grant 만료 결함을 승인 step/Graph 기한으로 수정했고, 완료된 컴파일은 hash/recipe/Source를 확인해 전송부터 재사용했다. Snapshot758×3 파일과 산출물 checksum이 일치했다. 원본 ui-kit/settings.rs의 별도 변경1건은 보존했으므로 결과는 고정 Snapshot에만 유효하다. Desktop GUI/여러 물리 PC/운영 설치를 검증했다고 표현하지 않는다.

Node 유효1,134 PASS(전체1,132 실행에서 번역1실패를 수정하고 i18n9·Factory23·artifact15로 재확인; 단일 전체1,134 녹색 실행 아님), Agent Debug61 유효 PASS/Release61 PASS, lint/typecheck/fmt/Clippy, 최종 Web production/Native Release 컴파일 PASS. Native 기존 Debug/Release49 PASS/5ignored는 Source21개와 Cargo/toolchain hash가 같아 재사용했다. 실제 DB 사본·synthetic IPC GUI의 밝게/어둡게, 영수증·장비 진단·스케줄 저장·32px 폼 정렬을 확인했다. 설치본 GUI·패키징·서명·출시·102 배포·commit/push 없음.

자세한 사용법: `docs/TASTEDEV_PRODUCT_ORCHESTRATION.md`. 결과/실패 원인/정확한 재개 경계/제한: `resources/verification/dev-01/product-orchestration-20261031/RESULT.ko.md`, `EVIDENCE-INDEX.md`, `checkpoint.json`.


## 2026-11-01 — Claude-Code-Game-Studios / Godot 연동 검증

고정 commit `05ad7c8a5b8aa2aa86bbd3439ae7cf7295cac418`의 파일439개·역할49개·스킬74개를 원문/checksum과 함께 보존했다. 프로젝트의 플랫폼/엔진 분리, 선택 팀 노드, 전체 프롬프트, 원본 설정 출처·파생 값·rigor/automation 편집을 연결했다. `frameworkRuntime:1` opt-in Agent, 공식 SDK0.3.316/Claude2.1.296의 고정 실행기와 영속 FrameworkSession을 기존 Core/Queue/Protocol 경로에 통합했다.

실제 Claude `/dev-story` → Godot4.7.2 조작·렌더링 → 별도 원본 Diff 승인/반영 → 실제 Rust Agent 재시험 → 새 Snapshot 승인 → 후속 테스트 PASS를 확인했다. 실제 Core 재시작 후 같은 native session/격리 폴더 재개와 잘못된 ID 거부도 통과했다. 별도 Studio Provider(gpt-6.1-sol)의 기획·수정 제안·독립 검토를 확인했고, 원본 변경0과 기존 사용자 변경 보존·실제 rollback을 검증했다. GUI는 production 웹과 실제 DB 사본/IPC 모사로 밝게·어둡게 확인했다.

지원 완료 범위는 제한된 Godot 원본 실행과 Studio 역할 연동이다. 전체74스킬·무제한 원본 Shell 호환을 주장하지 않는다. Unity/Unreal은 정의/설정 준비까지이며 실제 Linux/설치본 GUI/설치·업데이트 시험과 패키징·배포는 수행하지 않았다. 버전0.2.8 유지. 사용법·지원 경계: `docs/TASTEDEV_GAME_STUDIOS.md`; 정본 결과/근거: `resources/verification/dev-01/ccgs-20261031/{RESULT.ko.md,EVIDENCE-INDEX.md,checkpoint.json}`.


CCGS 후속 보안 경계: 모델 완료 후 실제 Diff·봉인 Source checksum·Godot 버전·고정 Protocol 인자에 대한 별도 검증 승인을 요구한다. 원본 Apply 승인과 분리하며, 거절·취소·만료·stale Source는 실행을 차단한다. 이 실행기는 OS sandbox가 아니며 Agent 계정 권한으로 승인된 게임 코드를 실행한다.

## 2026-11-01 — 실사용 오케스트레이션 완성 / 1단계

프로젝트 technology/engine 독립 metadata·생성 파일 미리보기·실제 Agent/Protocol 기반 준비 점검·검토된 첫 테스트 노드 초안을 연결했다. Node1169PASS와 GUI 문구 후속i18n9/lint/최종Web compile PASS, 실제Godot 템플릿 이동·렌더링 및 Core DB사본/읽기전용IPC/실제Agent 연결 GUI를 확인했다. 실제Native GUI는4단계이며 설치/패키징/배포를 수행하지 않았다. 전체7단계는 진행 중이고 다음은OS 실행격리다. 사용법/정본: docs/TASTEDEV_ORCHESTRATION_COMPLETION.md, resources/verification/dev-01/orchestration-completion-20261101/STAGE-1-RESULT.ko.md 및 checkpoint.json.

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

### Stage2 private artifact inputs — 2026-11-01

Declared artifact inputs now use the existing authenticated/checksummed transfer broker with a parent-owned private destination. Original Source is not an installation destination. The private installation is checked for size/hash/single-link/path identity before child launch; collision, outside-owner cwd, hard-link and corrupt-payload cases fail closed. Installation metadata is recorded after actual installation, and durable result manifests retain explicit input lineage without grant tokens/URLs. Full Agent Debug117 PASS, related Release57 PASS, test-target source Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Eleven default ignored tests were not rerun; historical administrator2-test success is pinned mechanism evidence, not current production/Core/Godot E2E. Isolated capability remains None. Registered runtime/version and bounded child/runtime-bundle contracts, positive current production integration, Native GUI and stages3-7 remain incomplete. See checkpoint gate `stage2PrivateArtifactInputs` and its immutable input/binary/log hashes. No packaging or unchanged Node/Web/Tauri gates ran. No new user-facing feature is advertised by this internal plumbing; existing25-language release notes are preserved.

### Stage2 registered runtime version facts — 2026-11-01

Operator catalogs can optionally pin a runtime name, exact numeric-triplet version, probeArgs and timeoutMs. After live OS-boundary qualification, the trusted broker copies registered SHA-pinned programs into separate locked private directories and invokes only the registered version command in an empty private cwd. No Source args/config, parent PATH version or prior receipt supplies a version fact. Probes use an empty application environment, at most10s each/30s total and16KiB captured output; overflow/loss/error/mismatch/cancel/timeout reject qualification. Process-local facts are keyed by executable ID. Executable Steps may satisfy runtime requirements only with their selected program; data-only Snapshot preparation checks actual registered facts.

Full Agent Debug121 PASS, related Release61 PASS, source test-target Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Two explicit actual Release checks pass: multiple private runtime copies retain file/directory locks and clean their profile, and two production Agent starts requalify in distinct contexts rather than trust a previous result. Both actual ordinary-context starts remain unqualified with exact cleanup; this is negative admission evidence, not successful private version execution. Nine remaining default-ignored actual tests were not rerun. Positive private runtime version/production/Core/Godot E2E, approved dependency bundles and bounded confined children remain incomplete; capability stays None. Packaging and unchanged Node/Web/Tauri gates were not run. This is internal unqualified plumbing, so existing25-language release notes are preserved without a new user-facing completion claim. Immutable hashes and logs: checkpoint `stage2RegisteredRuntimeVersions`.

### Stage2 runtime dependency bundles — 2026-11-01

Operator catalogs now support explicit local dependency files with relative destination, declared size and exact SHA256. No recursive runtime-directory copy is performed. Limits are256 files,128MiB per dependency,512MiB aggregate dependency bytes and256KiB catalog. Project Source, secret/credential paths, path escape, case/parent collisions, stale bytes and existing destinations are rejected. Bundled programs retain the native executable filename. Main/dependency files and nested directories are locked for execution; original files/ACLs are not changed. Chunk copying and private lock preparation use cancellation/deadline checks, and version probes use the budget remaining after copying. Optional bundleChecksum binds the dependency manifest and executable filename in journal/result identity; old records without it remain readable and unchanged on serialization. Child-process denial remains unchanged.

Final full Agent Debug127 PASS, related Release67 PASS, source test-target Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Three explicit actual Release checks pass: controlled dependency copies/file-directory locks/profile cleanup, production negative live requalification on two starts, and startup recovery without work replay. These controlled dependency bytes do not prove Python DLL loading or a successful private version/command/Core/Godot run. Eight other default-ignored actual tests were not rerun. The initial full Debug126/1FAIL found a normal/verbatim Windows path boundary comparison; both sides are now canonicalized and the final corrected candidate passes. Earlier compile/test failures are preserved. Capability remains None; bounded confined children, positive production integration and stages3-7 remain incomplete. No packaging or unchanged Node/Web/Tauri gates ran. Internal unqualified plumbing adds no user-facing release claim; existing25-language notes are preserved. Exact evidence: checkpoint `stage2RuntimeDependencyBundle`.

### Stage2 owned process-tree completion — 2026-11-01

Private execution now uses the validated isolated Tree API with count1, unchanged child denial, UI restrictions and no breakaway. Normal/cancel/timeout/observation-error paths explicitly terminate owned work, observe root exit, close owned process/thread handles and require Job active count0 before output/profile completion. Failure to observe zero remains an error. The kernel primitive accepts only1..4 root-inclusive processes; this is not a public child-execution approval contract. Legacy normal execution keeps its existing semantics.

Actual Node Job tests verify a child enters, an additional child is rejected without executing its marker, configured limit2 and absent breakaway flags, then whole-tree termination and accounting0 after handle closure. This is kernel lifecycle evidence, not private AppContainer descendant confinement or approved-child executable allowlisting. Initial Debug128/1FAIL exposed an immediate-count assumption: a rejected/terminated association can remain counted while handles exist. The exact reference holder was not independently traced; original failure is preserved. The final test checks configured enforcement and actual child denial, then requires zero after termination/closure. Windows private cleanup order was corrected accordingly. [Microsoft active-process accounting rules](https://learn.microsoft.com/en-us/windows/win32/api/winnt/ns-winnt-jobobject_basic_limit_information) explain the distinction.

Final Agent Debug129 PASS, related Release71 PASS, explicit actual Release3 PASS (preparation/locks/cleanup, negative live requalification and startup recovery), source test-target Clippy PASS; production Release compiled with4 existing diagnostic-helper warnings. Eight other default-ignored tests including administrator private execution were not rerun. Capability remains None. Reviewed bounded-child Protocol/Core/Agent policy, positive private runtime/version/command/Core/Godot, Native GUI and stages3-7 remain incomplete. No packaging or unchanged Node/Web/Tauri gates ran; existing25-language release notes are preserved because this internal unqualified work introduces no new public child support. Exact current input/binary/log hashes: checkpoint `stage2OwnedTreeCompletion`.

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

Stages1-3 retain their audited scopes. Stage4 Native foundation and11-command registration defect fix are verified; full stage4 remains IN_PROGRESS. Resume existing pinned live Core/Agent candidate and disposable Native project after user login/admin environment/screen resume, not the old completed Stage2 standalone tests. Verify actual Provider→approval→Patch→validation→integration→actual Agent retest→revert/history/successor Source through the real product. Then proceed sequentially to actual six-skill CCGS/Godot rendered gameplay, fault recovery and real TASTEFILES work. Packaging/install/release remain user-owned.

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


## 오케스트레이션 완성 7단계 — 실제 TASTEFILES 작업 완료

상태 **DEV_VERIFIED_REAL_PRODUCT**. 승인된 두 파일의 실제 ChatGPT/OpenAI 분석·독립 검토, 격리 Patch와 실제 Rust Agent 회귀, 별도 원본 반영 승인, 원본 재시험, 게시 Graph 후속 Source 검증까지 완료했다. 초기 Run cc549603은 잘못된 크기 단위를 실제로 재현했고, 원본 Run29fa7bba 및 최종 Agent Run **d5910ae3-d5c2-48b0-900c-a04ec2662436 PASS**에서 회귀2건이 통과했다. 최종 Agent SHA는 **e5c6dcc23196f45762054b2ef4a9f923169a38ce71ba8a71a6099482808bb9c0**다. 두 Source 파일과 지원 언어별 변경 원고만 원본에 반영했으며 무승인 변경0이다.

승인 전 원본 target hash를 확인했다. 분석 기준 e86ab92 이후 다른 세션의 UI-kit 커밋032e114가 생겨 최초 반영을 중단했다. 승인 대상 파일이 동일하고 관련 없는 UI 변경임을 확인한 별도 preflight를 기록한 뒤 같은 파일 내용 승인으로 반영했다. 승인/제안 이력을 다시 쓰지 않았으며 실제 Snapshot 기준은032e114, 분석 기준은e86ab92로 구분한다. 후속 Source913개 파일의 바이트/SHA와 checksum f9569c073e061be412bc3b397e1fe4369b721c06038967217119e4f59675ce8e을 실제 Agent 작업 공간에서 확인했다. 일반 작업 트리 격리이며 이 실행을 OS sandbox로 표현하지 않는다.

실제 검사에서 v2 vendor 경로의 History 저장 오류와 대량 출력 연결 손실을 수정했다. Core/Agent의 선택적32개 output receipt,64개 채널+1개 대기 프레임, 정확한 Run/Job/Step/sequence 검사와 결과 전 출력 drain을 적용한다. 제어 이벤트는 출력 창을 소비하지 않는다. timeout을 늘리거나 출력/실패를 숨기지 않았다. cargo/rustc에만 공개 CARGO_TARGET_DIR을 전달해 기존 컴파일 캐시를 재사용한다. 모델 도구·자동 승인·Shell 권한은 확장하지 않았다.

품질: Node 고유1227건 PASS는 전체1226 PASS/heartbeat fixture1 FAIL 후 해당1건 수정·재검증한 **합성 결과**다. 단일 전체 green run은 아니다. Rust Agent Debug/Release 각각140 PASS·13 ignored, strict Clippy·Release build·변경 파일 format PASS. TASTEFILES 영향 라이브러리는 Debug/Release 각각327 PASS·5 ignored, 크기 단위 회귀2 PASS, Core all-target Clippy·최적화 library build PASS다. 넓은 Debug package 검사는 기존 extraction_names의 빈 한글 디렉터리 복원 실패가 있었고 수정 전 원본에서도 동일하게 재현했다. 해당 Run은 FAILED로 보존하며 전체 TASTEFILES suite PASS를 주장하지 않는다.

55개 Native 입력과 기존 실제 EXE,217개 최적화 Web 산출물의 SHA를 확인했다. 프런트엔드 입력은 같아 기존 Native/HTML export 근거를 재사용하고 불필요한 재빌드·화면 반복 검사는 하지 않았다. 7단계 실행은 production Core/API/Agent 검증이며 실제 Native GUI 수명주기는4단계 근거로 구분한다. 소유 검증 Core/Agent는 종료했고 잔류0, 사용자 Native 창은 보존했다. 패키징·설치·배포·버전/태그 변경·commit/push는 수행하지 않았다.

마감 중 다른 세션이0.2.35 출시 준비 커밋에 수정·테스트를 포함하고 원고를 docs/releases/v0.2.35.md로 옮겼다. 해당 변경은 보존했다. 이번 actual Run은 저장된0.2.34 Snapshot에 대한 근거이며 새 버전/패키지 검증으로 재사용하지 않는다. 이 세션은 버전 변경·commit/push를 수행하지 않았다.

현재 정본: `resources/verification/dev-01/orchestration-completion-20261101/{stage-7-final-audit.json,stage-7-qualification-inputs.json,STAGE-7-RESULT.ko.md,FINAL-RESULT.ko.md,EVIDENCE-INDEX.md}`. 이전 승인 대기·실패·후보 기록은 보존하며 현재 상태와 혼합하지 않는다.


## 다중 장비 오케스트레이션 — 2026-11-03

1단계 실행 준비 진단 DEV_VERIFIED. 실제 게시 요구사항과 지정 Agent matcher, 인증 확인의 세션 범위, 미검증 Source/구버전 capability 표시를 추가했다. 전체 Node1232 및 변경 테스트 타입 재검증, lint/tsc, production HTML export 확인. 브라우저 밝게/어둡게의 연결 끊김 진단과 설정 이동을 검증했다. 실제 다중 장비 실행은7단계에서 별도로 검증하며 현재는 주장하지 않는다. 2단계 장비별 작업 공간 진행 중. 103 접근 금지; 102/109는 Linux이며 109 임시 경로 권한 부족. 정본 resources/verification/multi-device-orchestration-20261103/checkpoint.json 및 STAGE-1-RESULT.ko.md. 패키징·설치·배포는 사용자 담당.


### 다중 장비 2·3단계 완료

2단계 장비별 workspace Source/OS/Agent 바인딩과 실제 배정 차단, 3단계 의존 순서 미리보기·정확한 실행 검토 신원 DEV_VERIFIED. 전체 Node1236→1240 PASS 및 각 단계 lint/tsc/production Web export 확인. 실제 브라우저/Core/Windows Agent에서 정책 취소·승인·Source 없는 Job 차단, 새 Snapshot 게시 후 검토 해제·시간 변경 후 재검토를 확인했다. 4단계 진행 중, Linux 실제 실행은7단계 예정. 103 접근 금지, 설치/배포/패키징 없음. 정본 resources/verification/multi-device-orchestration-20261103/checkpoint.json.


### 다중 장비 4·5단계 완료 — 2026-11-03

4단계 저장된 Run/Job/Source 복구 무결성과 실제 SQLite Core 재시작·중간 승인 후 Windows Run2 PASS를 확인했다. 5단계는 기존 통합함의 기준/검토 신원 및 파일 중복 가능성 안내다. 전체 Node1249 PASS, 타입·린트 실패 단계 수정 재검증과 production Web export PASS. 실제 중복 데이터는 자동 테스트 범위이며 새 Provider/Native 반영 완료를 주장하지 않는다. 6단계 진행 중; 실제 Linux102는7단계에서 별도 확인한다. 103 사용 금지. 정본 resources/verification/multi-device-orchestration-20261103/checkpoint.json. 패키징·설치·배포 없음.


### 다중 장비 1~7단계 최종 완료 — 2026-11-03

1~7단계 DEV_VERIFIED. 기존 Core/Agent/Graph/통합/Scheduler 경로를 재사용했고 실행 준비·장비 workspace binding·정확한 실행 검토·저장 Run 복구 무결성·통합 중복 안내·예약 대상 진단을 추가했다. 마지막으로 Team Viewer의 복구 읽기 전용 RPC 분류를 바로잡았다. 최종 전체 Node1253/1253 PASS, 타입·린트 PASS. 최종 Web compile/generate/export의 source/HTML SHA를 확인해 backend-only 변경 뒤 재사용했다.

실제 Windows DEV01 Run→Web 별도 승인→Linux102 Run 모두 PASS이며 동일 Snapshot의 Source6개 디스크 hash 일치, .env 제외, Scheduler PASS를 확인했다. 소유 Core/Agent/SSH/Web/브라우저 종료, orphan0. 103은 접근하지 않았다. 109는 임시 경로 권한 부족으로 제외했다. Linux Node22는 합성 Protocol >=22 검증으로 Studio Core Node24 패키지 검증을 대신하지 않는다. 기존 binary를 사용했고 설치·배포·패키징·버전/태그 변경·커밋/푸시 없음. 새 실제 Provider 호출·Native 설치 GUI·실제 겹치는 사용자 Proposal UI는 이번 검증으로 주장하지 않는다.

정본 resources/verification/multi-device-orchestration-20261103/FINAL-RESULT.ko.md 및 EVIDENCE-INDEX.md. 안내 docs/TASTESTUDIO_MULTI_DEVICE_ORCHESTRATION.md. 다음 고도화나 패키징을 자동 시작하지 않는다.


## 빌드·패키지 하위 그룹 — 2026-11-06

최신 사용자 정정에 따라 공용 스크립트 래퍼 대신 build-package 부모 노드와 단계별 자식 노드 그룹을 구현했다. 부모/자식 모델, 분리된 표시 접기/CAS, 그룹 이동·복제·제거·배치·겹침, 책임 역할 상속, 실행 경계 확장과 승인·실패·재개를 기존 Core/Queue/Agent에 연결했다. 부모는 집계만 하고 자식별 Job/Run을 기록한다. 기존 평면 그래프는 유지하며 부모 포함60개 제한과1단계 깊이를 적용한다.

Node1265/1265, lint/typecheck, 최종 Web export PASS. 실제 Web 밝게·어둡게·접기 복원·배치와 실제 Rust Agent의 합성8개 Run PASS를 확인했다. 원래 공용 도구 기능 전체의 직접 이식이나 실제 빌드·서명·패키징·게시 완료로 주장하지 않는다. 하위 실행은 선택한 Protocol 작업에 연결하며 빈 참조는 게시를 차단한다. 실제 제품 패키징·설치·외부 게시·버전/태그·커푸 없음,103 미접근. 소유 runtime 종료·Core unexpected errors0·Agent 잔류0. 안내 docs/TASTESTUDIO_BUILD_PACKAGE_GROUP.md, 정본 resources/verification/native-build-engine-20261106/RESULT.ko.md 및 qualification.json.


## 2026-11-06 — 빌드·패키지 하위 노드 직접 실행

- `build-package` 부모에 recipe를 저장하고 source → dependencies → build → test → stage → sign → package → verify를 기존 Core/Queue/Matcher/Graph와 실제 Rust Agent에 연결했다. 공용 릴리스 PowerShell 호출이나 구버전 Agent의 일반 Shell 우회는 없다.
- 저장된 Working Tree 복사, 원본/사본 해시, 도구 SHA-256, Windows 컴파일러 LIB/LIBPATH/INCLUDE의 좁은 전달과 환경 변경 검사, OS 파일 잠금, 원자 ledger, 같은 Agent 배정, 실제 산출물/서명/형식/해시 확인을 구현했다.
- 실제 Windows Rust Agent에서 disposable Cargo와 Node 각각 8개 단계가 통과했다. Cargo 빌드 실패는 Source/dependencies를 재실행하지 않고 해당 빌드부터 재개했다. Node 자동 lifecycle hook과 Agent 인증 환경 비상속, Dummy .env 제외, 원본 소스 보존을 확인했다.
- 설정·하위 단계·실제 Run 영수증/Source/설정/카탈로그/전체 manifest hash를 GUI에 표시한다. 밝게/어둡게 DOM 검사에서 상세 패널 scrollWidth=clientWidth=278, 컨트롤 32px를 확인했다. 스크린샷은 상단 viewport이며 전체 상세 내용은 DOM 기록을 함께 본다. 설치된 Native 앱 화면 검증과는 구분한다.
- Node 유효 전체 결과+실패한 번역 검사 재개+추가 회귀를 합산해 1273개 검사를 확인했다. Agent 최종 전체 Debug/Release는 각각 150 PASS / 13 ignored이며, 마지막 인증 JSON/DB 파일 경계 보강 후 관련 10개 Debug/Release와 Clippy/Release 실행 파일도 다시 통과했다. lint/typecheck/Web production compile·generate·export PASS.
- 실제 인증서 서명 및 제품 MSI/NSIS/DEB/RPM/AppImage/DMG 생성·설치·업그레이드, Linux/macOS 실전 실행은 미검증이다. 공용 CLI의 제품별 설치 hook·게시까지 완전 동등하다고 주장하지 않는다. 실제 제품 패키징은 사용자 담당이며 103은 사용하지 않았다.

상세: [네이티브 하위 단계](TASTESTUDIO_NATIVE_BUILD_STEPS.md). 근거: `resources/verification/native-build-steps-20261106/RESULT.ko.md`, `EVIDENCE_INDEX.md`, `qualification.json`.
