# TASTESTUDIO — 검증된 사본의 원본 작업 통합

2026-10-26 구현. 작업별 격리 공간에서 수행한 변경을 기존 원본 작업의 검토·통합·테스트·완료 흐름에 연결한다. 실제 소스 쓰기는 기존 FixService, 테스트는 기존 Protocol/Core/Agent를 사용한다.

```mermaid
flowchart LR
  A[원본 Factory 작업 계약] --> B[격리 작업 공간]
  B --> C[실제 사본 Run PASS]
  C --> D[통합 요청 제출]
  D --> E[원본 변경 비교와 승인]
  E --> F[기존 Patch 적용]
  F --> G[원본 Snapshot / Rust Agent 재테스트]
  G --> H[독립 AI 검토]
  H --> I[명시적 최종 수락]
  I --> J[원본 Factory 작업 완료]
  J --> K[후속 작업 Source 일치 검사]
```

## 사용하는 순서

1. 원본 프로젝트의 게시된 Graph와 Factory 작업 초안을 준비하고 그 작업 ID로 독립 Git worktree를 연다.
2. 사본에서 Source를 수정·저장하고 기존 Protocol Test를 실제 Agent로 실행한다. 성공 Run은 Snapshot revision을 포함해야 한다.
3. 사본의 프로젝트 오케스트레이션 → 팀 운영에서 **통합 요청 제출**을 선택한다. 성공 Run을 선택하고 제출할 파일 목록을 승인한다. Native host가 원본 저장소의 기준/원본/사본을 비교하며, 현재 사본 파일 해시가 그 성공 Run의 검증된 manifest와 같아야 한다.
4. 원본의 팀 운영 → 작업 공간 격리에서 **통합 요청**을 확인한다. 작업 버튼은 해당 원본 노드를 선택한다. 파일 비교·충돌 해결·통합안 준비는 기존 격리 작업 화면에서 수행한다.
5. 통합 승인 시 Core가 parent/child 권한, 현재 Factory 계약/Graph revision, 실제 child Run/Source, parent proposal scope를 검사한다. Local FixService는 다시 native fingerprint와 Dirty/base hash를 검사한다. Core 검토 성공만으로 파일이 변경되지는 않는다.
6. 적용 후 Protocol Test를 선택해 원본을 Snapshot으로 재테스트한다. Source 파일 해시·proposal·attempt·Run revision이 일치하는 실제 PASS가 있어야 `verified`가 된다.
7. **독립 검토 실행**은 원본 계약의 별도 review node/profile을 사용한다. 현재 통합 Source와 실제 원본 Run을 읽어 분석하고 Core history에 보관한다. 검토 요약을 확인한다. 실제 읽은 변경 파일의 해시와 해당 Run citation이 없는 기록으로는 완료할 수 없다.
8. **통합 작업 완료**를 명시적으로 수락한다. 화면에서 현재 디스크와 Dirty 상태를 재검사하고 Core가 테스트·독립 검토·승인된 Patch를 다시 확인한다. 원본 Factory task는 `workspace-integration` 완료 receipt와 함께 completed가 된다. 실행하지 않은 Graph execution/activation을 PASS로 만들지 않는다.
9. 완료 후 **Open Run**으로 실제 테스트 결과를 열 수 있다. 노드의 `Integration · completed`는 이 통합 완료 기록이며, 별도의 Graph execution 상태와 구분한다.
10. 원본/사본에서 적용 전 요청을 취소하거나 원본에서 거절할 수 있다. 이미 적용한 변경은 기존 Revert/복구 동작으로 처리해야 하며 요청 닫기로 파일을 삭제하거나 되돌리지 않는다.

## Core 계약

`integration` RPC는 submit/list/review/complete/reject/cancel을 제공한다. 호출은 현재 연결 프로젝트와 인증된 actor에 바인딩된다. 다른 프로젝트 ID를 넣어 권한을 넓히지 않는다.

- 제출: 사본 history-write와 원본 history-write, actual child Run PASS, child origin의 parent/task/base, 현재 parent Factory 초안과 게시 Graph, 허용 경로 및 manifest file checksum을 확인한다.
- 검토/완료: 원본 approve와 사본 read가 필요하다. 권한이 사라지면 새로운 승인을 진행할 수 없다.
- 취소: 요청의 소속 프로젝트 cancel 권한과 parent/child read를 확인한다. 적용된 Source를 취소 요청만으로 없애지 않는다.
- 요청은 Source 본문이나 credential 대신 project/task/node/run ID, base revision, Source checksum, 파일별 hash와 immutable proposal/review 참조를 기록한다.
- Snapshot v2는 빈 files 배열의 reference일 수 있다. 소스 전달 저장소에서 소유권과 checksum을 검증한 실제 manifest를 읽는다. 폴링은 bounded metadata cache를 재사용하고 Source 본문을 cache에 남기지 않는다.
- 같은 성공 Run·파일 후보를 재제출하면 기존 요청을 재사용한다. revision 충돌은 재조회 후 다시 검토한다.
- 새 parent proposal은 새 review를 받아야 하며 request별 최대3 review를 유지한다. 무한 자동 수정이나 무승인 Patch를 추가하지 않았다.

## 원본 작업 완료와 복구

Factory의 기존 Graph 실행 완료 경로는 그대로 유지된다. 새 `completeIntegration` 내부 경로는 Core의 IntegrationRequests 검증기를 통과한 실제 Source/Run/독립 검토 proof만 받는다. 일반 `factory` RPC에 임의 완료 메서드를 추가하지 않는다.

완료 proof는 request/attempt/proposal/run/review ID, tested Snapshot checksum, Core가 검증한 Source content checksum, Graph revision/checksum, 수락 시각을 포함한다. 실행 중인 원본 작업은 통합으로 강제 완료하지 않는다.

최종 수락은 먼저 completion intent를 기록하고 Factory 완료 receipt를 기록한 다음 요청을 마감한다. 마지막 기록이 실패해도 Source 작업을 재실행하지 않는다. 같은 immutable receipt로 상태를 확인·재시도할 수 있고, 복원된 Factory 완료를 읽어 pending 요청의 실제 완료를 표시한다.

## 후속 작업의 소스 보호

원본 작업이 완료됐다는 이유만으로 후속 작업이 통합 전 Graph Source를 실행해서는 안 된다. 같은 프로젝트의 통합 의존 작업은 게시 Source의 **파일 바이트 content checksum**이 수락된 통합 결과와 같아야 실행할 수 있다. Snapshot ID가 달라도 동일한 Source 내용은 구분해 확인한다.

다르면 대기 이유를 표시한다. 수락된 원본 Snapshot을 게시하고 새 revision에 맞는 후속 계약을 검토해야 한다. 기존 초안/계약의 Source를 자동으로 바꾸거나 자동 실행 승인으로 간주하지 않는다. 다른 프로젝트의 의존 관계는 그 프로젝트의 별도 Source 계약을 유지한다.

## 개발 검증

정본: `resources/verification/dev-01/integration-handoff-20261026/`.

실제 Core RPC와 실제 Rust Agent로 child PASS → submit → scoped review → parent Patch → parent PASS → 실제 gpt-6.1-sol 독립 검토 → explicit acceptance → 원본 Factory completed를 검증했다. 이전에 검증한 실제 AI 수정안은 파일 내용과 근거를 확인해 재사용했고 수정 제안을 다시 생성하지 않았다. Core 재시작 후 완료 receipt 복원과 정확한 accepted Snapshot 게시도 검증했다.

이 검증은 설치 패키지 시험이 아니다. GUI는 실제 증거 DB의 별도 사본과 synthetic native IPC를 사용한다. 실제 OS 폴더와 설치본 UI, Linux 설치/업데이트는 이 범위에서 검증했다고 주장하지 않는다.

## 현재 제한

UTF-8 파일 변경(최대8개), 명시적 사용자 승인, 저장된 Source를 기준으로 한다. 2026-10-31부터 기존 디렉터리 안의 파일 생성·삭제 및 이름 변경(삭제/생성 쌍)을 지원한다. binary·submodule·새 디렉터리 자동 생성과 대소문자만 다른 이름 변경은 지원하지 않는다. 프로젝트별 Core 연결/권한은 직접 설정한다. 후속 계약의 자동 repin, 자동 commit/push/배포/설치, 무제한 재시도는 제공하지 않는다.


## 통합 검토함과 후속 소스 검토 — 2026-10-31

팀 운영의 통합 검토함에서 진행 중·조치 필요·종료·전체를 고르고 작업/노드/파일 경로로 검색한다. 현재 권한과 상태에 맞는 비교·재테스트·독립 검토·수락을 사용한다. 과거 기록도 종료 필터로 다시 볼 수 있다.

충돌은 파일별 기준/원본/사본을 비교한 뒤 원본 유지, 사본 사용, 직접 편집으로 해결한다. 겹치지 않는 변경 합치기는 겹치지 않는 한 구간씩만 보수적으로 합친다. 겹치거나 인접한 변경은 직접 검토해야 한다. 비교 fingerprint가 바뀌면 새 비교/새 제안을 요구한다.

새 파일은 원본의 부재를, 삭제는 기존 원본 바이트를 precondition으로 검사한다. 이름 변경은 두 경로가 모두 표시된 삭제/생성 제안으로 검토하고 전체 묶음을 승인한다. 빈 파일과 파일 부재는 다르게 취급한다. Native에서는 기존 workspace 경계와 단일 작업 잠금 아래 create_new/expected text 검사로 적용한다. 브라우저 host는 구조 변경 기능이 없어 안전하게 거부한다. 기존 폴더 안의 일반 텍스트 파일만 대상이며 모든 경로는 기존 AI 경로 정책을 따른다.

적용/되돌리기 journal은 기존 FixService를 사용한다. 중간 실패는 정확히 일치하는 자기 변경만 보상하고, 외부 변경이 있으면 recovery-required로 보존한다. Native 파일 시스템 외부 writer와의 전역 트랜잭션은 제공하지 않는다. 삭제된 열린 clean 문서는 닫고 Dirty 문서는 적용을 차단한다.

전체 Snapshot에서 삭제된 경로는 존재하지 않아야 한다. changedFiles에는 현재 존재하는 변경 경로만 넣으며 삭제는 immutable proposal과 전체 manifest의 부재로 검증한다. Snapshot/Agent 프로토콜을 변경하거나 별도 runner를 추가하지 않았다. 독립 검토는 실제 원본 Run의 immutable Snapshot을 읽으며, 삭제 경로 read_file은 verified manifest에만 근거한 source-absence citation을 제공한다. Core 완료 검사도 같은 Run/Source와 부재 근거를 요구한다.

수락한 Source를 기존 그래프 게시 동작으로 게시한 뒤 Software factory의 현재 소스 재검토를 누른다. 이전/새 Source 해시를 확인하면 기존 idle 후속 계약을 새 Graph revision으로 검토하고 이전 계약을 기록한다(최대3회). 자동 실행하지 않으며 다시 대기열 승인이 필요하다. 실행 이력이 있는 작업·이미 완료한 작업·다른 소스·변경된 version·권한 부족은 거부한다. 팀 의도 등 상위 계약도 일치해야 한다. 서로 다른 수락 Source를 한 번에 자동 결합하거나 의존 조건을 우회하지 않는다.

이번 구현 근거: resources/verification/dev-01/integration-review-20261031. 설치본·외부 Provider 신규 E2E·Linux는 별도이며 이전 단계의 실제 모델/Agent 결과를 이번 새 기능의 실행 근거로 바꾸지 않는다.
