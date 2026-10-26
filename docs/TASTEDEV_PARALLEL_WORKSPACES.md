# TASTESTUDIO — 작업별 Git 격리와 검토 통합

## 범위

2026-10-26 구현. 팀 운영의 **작업 공간 격리** 탭에서 작업별 detached Git worktree, 원본과의 비교, 승인 기반 통합, 통합 원본의 Agent 재테스트를 연결한다. 설치 패키지 생성·설치·업그레이드 검증은 사용자 담당이다.

## 실행 순서

1. Git 저장소 루트를 프로젝트 폴더로 연결하고 Core의 작업 의도와 Factory 작업 초안을 준비한다.
2. 프로젝트 오케스트레이션 → 팀 운영 → 작업 공간 격리에서 **커밋 기준 확인**을 누른다. 현재 HEAD와 미커밋 변경 유무를 확인한다.
3. 작업 계약을 선택하고 표시된 기준 커밋의 공간 생성을 승인한다. 원본의 스테이징·미추적 파일·미커밋 변경·미저장 편집 내용은 복사하거나 덮어쓰지 않는다.
4. **작업 공간 열기**로 독립 프로젝트 창을 연다. 각 창은 별도 프로젝트·파일·AI 이력을 사용한다. 필요한 Core 연결과 프로젝트 권한은 각 창에서 설정한다. 원본의 credential이나 팀 ACL을 자동 공유하지 않는다.
5. 각 작업 공간에서 기존 AI 분석 → Proposal → 승인 → Patch → Protocol 검증을 사용한다. 서로 다른 프로젝트 ID이므로 기존 프로젝트별 쓰기 직렬화와 Factory 제한을 유지하면서 독립 실행할 수 있다.
6. 원본 창에서 **작업 변경 비교·통합**을 연다. 기준 커밋, 현재 원본, 작업 소스를 비교한다. 양쪽이 바뀐 파일은 원본 유지·검토한 작업 변경 사용·수동 편집 중 하나로 해결한다. 미해결 상태에서는 통합안 준비를 막는다.
7. 통합안을 준비한 뒤 대상 파일과 비교 fingerprint를 검토하고 별도로 승인한다. 승인 직전에 다시 비교하며 어느 쪽이든 바뀌면 재검토를 요구한다. 기존 FixService가 Dirty Editor·파일별 base hash·승인 scope·부분 실패 보상·Editor 동기화를 처리한다.
8. 실제 Git Diff를 확인하고 저장된 Protocol Test를 선택해 **검증 및 원격 재테스트**를 승인한다. 통합된 원본을 secret-filtered Snapshot으로 만들고 기존 Core Queue/Matcher/실제 Rust Agent로 전달한다.
9. 관계 표시는 task → workspace → integration → result를 보여준다. 통합 성공은 모델의 판단이나 사본의 PASS만으로 표시하지 않는다. 원본 프로젝트의 실제 성공 Run과 통합 Snapshot checksum이 일치해야 검증됨으로 표시한다.
10. 실패 후에는 Attempt와 Evidence를 유지한다. **작업 통합 되돌리기**는 AI 적용 후 사용자 추가 변경이 있으면 충돌로 중단한다. 중단된 쓰기는 기존 journal 복구를 사용한다.
11. **보관**은 디스크 파일을 삭제하거나 실행 중 작업을 종료하지 않는다. 미완료 파일과 미저장 Editor도 보존한다. 보관한 worktree는 통합 목록에서 비활성화하며, 복원 시 경로·Git 관리 디렉터리·detached HEAD·기준 커밋을 재검증한다.

## 저장 및 권한

- 위치: 앱 데이터의 `task-workspaces/<parent-project UUID>/<task UUID>/source`. 목적 경로는 사용자가 임의 명령으로 지정하지 않으며 native host가 생성한다.
- metadata에는 parent/task ID, canonical repository, base revision, creating/ready/archived 상태를 기록한다. Git 쓰기 전에 creating intent를 저장하고 원자적 파일 교체를 사용한다.
- 생성 재시도는 기존 공간을 재사용한다. 생성 중단·잘못된 metadata·다른 저장소 바인딩은 자동 덮어쓰기나 삭제로 복구하지 않는다.
- 원본 workspace가 해당 parent project에 연결되어 있고 저장소 루트와 정확히 같아야 한다. 링크·junction·submodule·부적절한 Git 관리 경로는 거부한다.
- checkout 중 hooks, fsmonitor, smudge/process filter 실행을 차단한다. Windows의 과도한 경로 길이는 checkout 전에 거부한다.
- 관리 task 창은 고정된 앱 URL과 UUID만 연다. main/task 창의 IPC는 기존 명령별 native 경로/프로젝트 권한 검사를 유지한다. 원격 페이지 권한은 부여하지 않는다.
- 통합안은 AI가 생성한 AnalysisRecord로 위장하지 않는다. FixAttempt에 별도 immutable integration lineage(task/base/fingerprint)를 기록하고 기존 승인·journal·재시도 한도를 재사용한다.
- 비교 Source는 로컬 IPC/화면에만 표시한다. 비교 자체는 외부 AI 호출을 하지 않는다. Snapshot과 AI 전송은 기존 secret 제외·마스킹 정책을 따른다.

## 재테스트 계약

`통합 원본 → Snapshot → Protocol TestPlan → Core Queue → Matcher → Rust Agent → Run/Evidence`

AI 전용 Runner는 만들지 않는다. `queueApprovedFixRetest`는 기존 AI Proposal과 수동 통합 양쪽에서 같은 Source/Snapshot/approval/job 연결을 사용한다. 실제 테스트 revision의 commit 필드는 Git HEAD로 위장하지 않고 Snapshot checksum을 식별한다. base revision, snapshot ID, proposal ID, attempt가 별도로 유지된다.

## 현재 제한

- 초기 격리는 **커밋된 HEAD** 기준이다. 원본의 미커밋 상태를 작업 사본에 자동 복제하지 않는다.
- 통합은 기존 파일의 UTF-8 텍스트 수정, 최대 8파일/2MiB 비교 범위다. 파일 생성·삭제, binary, 링크·submodule은 자동 통합하지 않고 수동 처리를 안내한다.
- 보관은 비파괴 상태 전환이며 디스크 공간 회수가 아니다. dirty 작업 공간을 강제 삭제하지 않는다.
- 독립 창의 Core 연결/권한은 명시적으로 설정해야 한다. 사본의 PASS만으로 원본 완료를 결정하지 않는다. [통합 요청 흐름](TASTEDEV_INTEGRATION_HANDOFF.md)의 원본 승인·실제 재테스트·독립 검토·최종 수락을 거치면 원본 Factory 작업이 완료된다.
- 관계 화면은 현재 원본 프로젝트의 통합·재테스트 근거를 표시한다. 다른 프로젝트의 비공개 실행 이력을 parent 권한으로 조회하지 않는다.
- 자동 commit/push/merge, 무승인 적용, 무제한 재시도는 제공하지 않는다.

## 검증 기록

`resources/verification/dev-01/parallel-worktree-20261026/`의 최종 결과와 Evidence Index를 따른다. Native manager의 실제 Git 시험, synthetic native IPC를 사용하는 브라우저 화면, 실제 Provider/Agent 파이프라인, 설치본 검증은 서로 다른 gate다. 실제 설치본 검증을 통과했다고 추정하지 않는다.
