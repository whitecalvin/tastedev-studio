# 다중 장비 오케스트레이션

TASTESTUDIO는 장비 → 실행 Agent → 역할 → 작업 → 승인 → 후속 작업의 관계를 구성한다. 파일 탐색기는 Source 편집 도구이며 실행 배치는 Core와 기존 Agent Pipeline이 담당한다.

## 구성 순서

1. 기존 Core와 실행 Agent를 연결한다. 장비 노드는 선언이며 실제 OS·런타임은 연결된 Agent의 보고와 matcher로 확인한다.
2. 장비에 Agent와 역할을 연결하고 역할이 수행할 Protocol 작업을 선택한다. 현재 구현은 사용자 장비에 런타임을 설치하지 않는다.
3. 장비 실행 정책에서 Agent별 OS와 Source 종류를 연결한다. 작업 공간은 각 Agent의 기존 관리 루트 아래 Run별로 생성되며 호스트 경로나 인증값을 다른 장비로 복사하지 않는다.
4. 저장한 Source를 비밀 파일 제외 정책으로 Snapshot하고 Graph와 함께 게시한다. Dirty Editor, 구버전 capability와 아직 검증되지 않은 항목을 먼저 검토한다.
5. 실행 계획에서 의존 순서·병렬 가능 단계·승인·실패 경로·Agent 요구사항·Source를 확인한다. Source, 게시 버전, 시작 노드, 시간 제한 또는 연결이 바뀌면 다시 검토한다.
6. 각 중간 승인도 별도로 검토한다. 진단의 준비 표시가 실행이나 Source 반영 승인을 대신하지 않는다.

## 복구

저장된 실행 검사는 실제 Job·Run·Agent·Graph Context·Snapshot 신원을 비교한다. 잘못되거나 없는 성공 근거는 복구를 차단하며 기록을 고치지 않는다. 재개는 기존 기한과 완료된 Run을 보존한다. 미연결 intent는 기존 멱등 조정 경로를 사용한다. 검사 결과는 프로세스 생존 보장이 아니며 Core가 재개 직전에 다시 확인한다.

Team Viewer는 복구를 조회할 수 있지만 실행 재개·승인 권한을 얻지 않는다. 프로젝트 경계도 유지한다.

## 통합 관제

기존 통합함에서 기준 버전, 자식 Run/Source, Graph 및 검토 Attempt/Patch 신원을 확인한다. 진행 중인 같은 파일 요청은 대소문자와 경로 구분자를 무시해 보수적으로 안내한다. 같은 파일이나 다른 내용이라는 안내는 실제 Patch 충돌 판정이 아니다. 실제 Diff → 별도 승인 → hash precondition → 반영 → 원본 재시험 → 독립 검토 경로를 그대로 사용한다.

## 예약

Scheduler는 기존 Core의 Protocol/Graph 예약·기록·권한·중복 방지·제한된 재시도를 사용한다. 예약 대상 검토는 저장한 Graph revision/checksum/root를 현재 게시본과 비교한다. Source snapshot/checksum과 진행·일시중지·취소 중인 실행도 표시한다.

- 연결이 끊기거나 조회에 실패하면 미검증으로 표시한다.
- 다른 게시본은 stale로 표시한다. 새 게시본을 검토해 새 대상을 저장한다.
- 활성 Graph가 있으면 중복 실행 대기를 안내한다.
- 진단은 실행을 승인하지 않는다. Core가 발화 시 권한과 대상을 다시 검사한다.

## 검증 범위

2026-11-03 개발 검증은 Windows DEV-01과 기존 Linux102 Agent에서 합성 Source를 같은 Snapshot으로 실행했다. Web GUI의 중간 승인 전 Linux 작업 생성0, 승인 후 Windows/Linux Run 모두 PASS, 물리 파일6개 SHA 일치, `.env` 양쪽 제외를 확인했다. SQLite 복구 검증은 별도의 실제 Windows Run2건을 보존한다.

Linux102 검증은 기존 Agent를 foreground로 실행하고 localhost SSH 터널과 Dummy 인증만 사용했다. 설치·배포가 아니다. Linux Node22는 합성 Protocol의 `>=22` 요구사항 검증이며 Studio Core의 Node24 패키지 요구사항 검증을 대신하지 않는다. Linux Agent의 version 옵션은 지원되지 않아 버전을 추측하지 않았다.

103은 사용자 지시에 따라 접근하지 않았다. 109는 검증 임시 경로 권한 부족으로 실행하지 않았다. 새 실제 AI 요청, 사용자 프로젝트 변경, Native 설치·업데이트·패키징·게시·커밋/푸시는 이번 검증 범위에 포함하지 않는다. 통합 중복 진단의 데이터 조합은 자동 테스트로 확인했으며 실제 겹치는 두 사용자 Proposal의 GUI 검증으로 표현하지 않는다.

정본은 `resources/verification/multi-device-orchestration-20261103/checkpoint.json`, 단계별 Result, `FINAL-RESULT.ko.md` 및 `EVIDENCE-INDEX.md`다. 과거 실패 로그와 이전 후보는 보존한다.
