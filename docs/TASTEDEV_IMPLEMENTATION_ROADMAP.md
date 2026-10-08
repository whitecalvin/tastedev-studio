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

[운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-service-runtime-20261001/README.md) · [검증 결과](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-2/RESULT.md)

고도화 2단계 PARTIAL — 실제 서비스 및 제한 계정 검증 대기

## 고도화 1단계 — 2026-10-01

고도화 1단계 Core Persistence and Recovery: PASS. SQLite/migration/backup/restore, 실제 Core restart+Rust Agent reconnect, 결과 ACK 유실·중복 기록 방지, 이력 조회, write failure와 Source integrity를 검증했다.

고도화 2단계 Core Service Runtime: NOT_STARTED. 이번 작업에서 서비스 설치·운영 계정·readiness·공용 서비스 래퍼를 시작하지 않았다. 단계별 범위는 부모 resources/guides/dev-01/tastedev-studio/advancement/TASTESTUDIO_ADVANCEMENT_PROMPTS.md를 따른다.

[저장·복구 운영 계약](../../../../resources/guides/dev-01/tastedev-studio/core-persistence-20261001/README.md) · [최종 결과/Evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/advancement-1/RESULT.md)

고도화 1단계 PASS — 2단계 착수 가능


## Multilingual UI — 2026-09-30

Implemented the same 10 languages as tastedev-web: Korean, English, German, Spanish, French, Italian, Brazilian Portuguese, Japanese, Simplified Chinese and Traditional Chinese. Default follows the system/browser language; unavailable or unsupported languages fall back to English. Manual selection persists, supports cross-tab synchronization and can return to System language.

Application-owned Project Manager, Workspace, Explorer/editor guidance, Process, Git, Core, Protocol, AI, Issues and Scheduler UI use shared catalogs. Language changes preserve project data, form values and dirty Monaco models. Source, user data, terminal/test logs and AI output keep their original content.

Verification: Node393/393 PASS once; after subsequent catalog/UI changes, affected i18n8/8 PASS and unchanged385 reused. Full lint, typecheck and production build PASS; final build GnpI9Lv0-aYxoPUb7tMNb includes TypeScript validation. Production GUI27 checks plus final10 locale cases PASS; unexpected frontend errors0, controlled source writes0. No duplicate unaffected build/test gates. Native/Rust inputs unchanged; native installed/OS-language QA was not run.

Remaining limits: Monaco built-in third-party menus remain English; unknown external diagnostics fall back to their original English; native-speaker editorial review is pending. These do not change prior phase acceptance.

[Result and evidence](../../../../resources/verification/dev-01/tasks/tastedev-studio/i18n-20260930/RESULT.md) · [I18N guide](../../../../resources/guides/dev-01/tastedev-studio/i18n-20260930/I18N.md)


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

STEP9 TASTEDEV Protocol v1을 구현했다. 네 YAML 파일의 domain/strict validation, requirement/environment resolution, task/test→기존 Core Job, compact Run/Tests와 status bar, initialize/Monaco 저장 재검증이 범위다. Protocol80+기존139=219 테스트 근거가 있으며 final lint/typecheck/Web/Desktop no-bundle builds와 production actual Agent GUI E2E가 PASS다. Rust Agent Debug12/Release12/fmt/Clippy/release는 유효성 확인 후 재사용했다. 독립 UI review는 production8개 화면에서 ship이다. **STEP9 PASS — STEP10 착수 가능, NOT_STARTED**. [Protocol](TASTEDEV_PROTOCOL.md), [STEP9 evidence](../../../../resources/design/tastedev-studio-step9/EVIDENCE.md) 및 task RESULT/checkpoint가 최종 수락 기준이다.

STEP8 Core/Agent 단일 명령 경로를 재사용하며 Project별 Agent 코드는 없다. Agent workspace에 source checkout/copy는 추가하지 않았다. .tastedev load와 실제 Queue/Assign은 분리한다. STEP10 Test Orchestration은 NOT_STARTED이며 자동 착수하지 않는다. 이전 순서 계획과 당시 미구현 표현은 역사적 기록이다.

## Historical STEP6E handoff

2026-09-30 STEP6E: **STEP 6 PASS — STEP 7 착수 가능**. STEP7은 시작하지 않았다. 과거 이벤트 `1790699936279`는 HISTORICAL_UNRESOLVED / NOT_REPRODUCED / Root Cause UNKNOWN / Non-blocking으로 보존한다. 진단 보강 및 controlled browser tests, Node102, lint/typecheck/Web build와 새 production Web smoke PASS. Rust 및 전체 Desktop 검증은 반복하지 않았다. 기존 EXE/installer에는 STEP6E 변경이 아직 포함되지 않으며 다음 패키징에서 frontend export/embedded app 재생성이 필요하다.

[최종 증거 목록](../../../../resources/verification/dev-01/tasks/tastedev-studio/step-6e-20260930/EVIDENCE-INDEX.md). 기존 Native PASS 및 실제100%/150%DPI 유지,125% 미검증은 비차단이다.

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
