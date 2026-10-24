# 팀 실행·운영 고도화

2026-10-24, DEV 구현·검증 범위. 기존 역할 팀 위에 실행 준비, 인계, 계획 승인, Source 추적, 운영 정책과 완료 판정을 연결한다. 설치 패키지와 설치·배포 시험은 사용자 담당이다.

## 단계와 사용자 흐름

| 단계 | 구현 | 검증 경계 |
| --- | --- | --- |
| 1 실행 전 점검 | 팀 운영 → 실행 전 점검에서 게시 Graph, 의도/배정, Source 무결성, Agent, AI 인증, 실행·승인 권한을 확인하고 문제 노드로 이동 | 읽기 전용 점검이다. 모델 가용량·실행 성공을 보장하거나 이후 승인을 대신하지 않는다. |
| 2 업무 인계 | 수신 확인된 인계를 준비된 수신 담당 의도와 연결한 뒤 명시적으로 승인·실행 | 실제 Graph/Factory identity와 결과를 연결한다. 수신 확인만으로 실행하지 않으며 모델·Patch 승인은 유지한다. |
| 3 실행 계획 | 기존 리더 AI/Factory 분할 계획을 초안으로 저장하고, 표시된 최대 8개 초안을 일괄 승인하여 대기열에 등록 | 전체 초안 판·정의·권한을 먼저 검사한다. 하나라도 달라지면 어떤 작업도 시작하지 않는다. 의존 작업은 수락 후 해제된다. |
| 4 작업 격리 | 계약별 기준 Source, 변경 파일의 전후 hash·승인, 시도별 Snapshot·실제 Run identity를 표시 | 같은 프로젝트의 Source 쓰기는 기존 Factory에서 직렬화한다. Agent의 재테스트는 개별 Snapshot 작업 공간을 사용한다. 서로 다른 프로젝트만 기존 자원 잠금 아래 병렬 실행한다. |
| 5 관계 관제 | 실제 최신 작업 상태를 수행 역할 → Agent → 장비 및 연결선에 전달 | 저장 Graph·revision·checksum이 다르면 상태를 숨긴다. 아직 시작하지 않은 작업이 있으면 장비 전체를 통과로 표시하지 않는다. |
| 6 장애 복구 | 인계 실행 의도를 저장한 뒤 기존 Graph/Factory를 호출하고, 응답 유실·재시작 시 동일 실행을 조회하여 재개 | 자동 재실행은 없다. 완료 결과는 완료로 유지하고 성공한 기존 단계·증거를 보존한다. |
| 7 AI 운영 정책 | 팀 운영 → AI 운영 정책에서 요청·시간·동시 실행·실행당 예산·허용 연결/모델을 승인 | 새 팀 Graph AI lease 발급 시 Core가 검사한다. 공급자·모델 자동 대체는 없다. 일반 비팀 AI 대화의 기존 정책을 변경하지 않는다. |
| 8 완료 보고 | 현재 의도 판의 계약 수락·실제 테스트 Source·다섯 품질 관문으로 완료 보고서를 만들고 JSON 내보내기 | 분석 완료만으로 구현 완료를 선언하지 않는다. 새 Graph 게시로 계약이 오래되면 현재 완료 판정을 차단한다. |

원래 요청 → 의도 준비 → 실행 전 점검 → 리더 계획 → 초안 검토/Queue 승인 → 구현/독립 검토 → 실제 Agent 시험 → 품질 근거 → 계약 수락 → 완료 보고서 순서로 사용한다. 설계·문서 역할은 인계를 받은 별도 읽기 전용 의도로 실행할 수 있다.

## 실행 전 점검

점검은 현재 게시된 입력에 대한 시점별 진단이며 시각과 Graph 판을 표시한다. Source를 다시 검증하고 동일 AI 경로의 인증 조회를 한 번 공유한다. 인증값·Source·프롬프트를 모델로 보내거나 Job을 생성하지 않는다. configured 상태는 경고로 남기며 인증 성공으로 바꾸지 않는다. 점검 도중 의도·게시 Graph가 변경되면 결과를 차단하고, 완료 시 Agent·대기 상태와 읽기 권한도 재확인한다. 실제 실행은 기존 권한·Source·승인 검사로 다시 보호한다.

완료·취소 계약의 수락 메모는 대기 사유에 포함하지 않는다. 연결되지 않은 Agent, 오래된 배정, 실행 중인 Graph 등 실제 대기 조건을 구분한다.

## 인계 계약과 영속성

`team-dispatch` RPC는 현재 구독 프로젝트에 묶인다. prepare는 acknowledged handoff, 수신 책임과 일치하는 ready intent 및 게시 assignment를 요구한다. 구현 인계는 같은 의도 판·digest·구현 노드에 연결된 Factory draft가 필요하며 읽기 전용 인계로 구현 Queue를 시작할 수 없다.

기록에는 messageId, intentId/version/digest, Graph revision/checksum/inputChecksum, 담당 node, Factory draft/version 또는 안정된 Graph executionId, 승인 시각을 고정한다. 메시지당 취소되지 않은 실행 연결은 하나다. 외부 응답이 유실되어도 같은 Graph request identity 또는 기존 Factory 상태를 조회하여 중복 실행을 막는다. 상태 변경은 Core writer에서 직렬화하며 save 실패 시 메모리 상태를 먼저 공개하지 않는다.

권한은 읽기, 인계 준비, 실행 승인, run, cancel로 구분한다. 시작·재개에는 approve와 run 둘 다 필요하다. Core 재시작은 미완료 연결을 paused로 바꾸며, 이미 끝난 실제 Graph/Factory는 새 실행이나 재개 요청 없이 종료 결과를 유지한다. Agent가 자동 수신했다고 표시하지 않는다.

저장은 기존 암호화 CoreStore의 `team-dispatch` 단위를 사용하며 version 1, 최대 500건이다. 저장소 손상은 실패로 처리하고 자동 삭제/초기화하지 않는다. 응답에서 저장 actor를 공개하지 않는다.

## 격리와 Source 통합 정책

현재 모드는 `serialized-source-isolated-retest`이다. **같은 프로젝트의 여러 AI가 별도 Git worktree에서 동시에 Source를 수정하고 자동 병합하는 기능은 제공하지 않는다.** 기존 project slot과 path/resource 충돌 보호를 유지하므로 동일 프로젝트의 쓰기는 겹치지 않는다. 파일별 proposal approval, Dirty Editor 보호, baseHash 충돌, rollback, Snapshot 비밀 제외 및 Agent 추출 경계도 기존 Fix/SourceProvider를 재사용한다.

운영 화면은 계약의 base Source와 실제 수정 후 테스트 Snapshot을 분리하고, 각 파일의 승인 및 before/after hash만 제공한다. Source 본문이나 credential-bearing 환경 정보는 운영 보고서에 넣지 않는다. 다른 프로젝트의 FixAttempt, 범위를 넘는 파일, 승인 없는 적용, Run revision과 Snapshot checksum 불일치는 정상으로 표시하지 않는다.

## AI 정책과 예산

기본값은 분석당 최대 6요청, 120초, 프로젝트당 팀 분석 동시 2개, Graph 실행당 최대 60 예약 요청이다. 설정 범위는 각각 1~12, 10~300초, 1~2개, 1~120이다. 허용 연결·모델 목록은 각 20개 이하이며 빈 목록은 기존 등록/구성 경로를 허용한다. 목록을 제한했으면 명시되지 않은 default 모델도 우회 허용하지 않는다.

새 lease마다 계획의 최대 요청 수를 **실행 전에 보수적으로 예약**한다. 예약은 실제 사용 토큰·금액 또는 실제 호출 수가 아니다. 취소·실패·응답 유실로 자동 환급하지 않아 예산을 우회할 수 없게 한다. 실제 사용량은 기존 AnalysisRecord.metrics를 따른다. 활성 분석 중 정책 변경은 차단하며 새 정책 저장에는 approve 권한과 현재 revision이 필요하다.

기존 암호화 CoreStore `team-execution-policy` 단위에 정책과 grant identity를 저장한다. 프로젝트 100개, 프로젝트별 grant 1000개 상한을 적용하고 자동 이력 삭제는 하지 않는다. 이 기능은 API 크레딧 구매, 자동 공급자 전환, 임의 shell 실행을 추가하지 않는다.

## 완료 보고서

`team-report`는 현재 프로젝트·선택한 구현 의도의 판을 기준으로 생성한다. 현재 계약이 하나 이상이고, 전부 completed이며, 현재 배정/정의 및 품질 근거와 실제 PASS 재테스트 Source가 유효해야 verified다. 다른 판의 계약은 이력 개수로 분리한다. 품질의 N/A는 기존 명시적 적용 제외 기록을 유지하며 자동 검사 통과로 표시하지 않는다.

완료 보고는 이 구현 의도 범위에 대한 판정이다. 제품 전체의 출시 준비, 네이티브 설치 QA, 배포 성공으로 확장하지 않는다. Graph가 바뀌면 이전 보고서 파일은 당시 증거로 남지만 새 현재 보고서는 재검토를 요구한다. 자동 Commit/Push/패키징/배포는 없다.

## 검증과 알려진 제한

근거: `resources/verification/dev-01/team-execution-advancement-20261024/RESULT.ko.md` 및 `EVIDENCE_INDEX.md`.

- 실제 모델은 리더 계획 1건, 구현 2건, 독립 검토 2건, 인계를 통한 설계/문서 분석 2건에 사용했다. 실제 Rust Agent로 최초 FAIL → 두 개별 PASS → 최종 통합 PASS를 확인했다.
- AI·Patch 승인은 사용자가 승인한 disposable 검증 범위를 기록한 자동 승인이다. 개별 diff의 사람 수동 검토로 주장하지 않는다.
- Node 테스트와 TypeScript/production 웹/브라우저 검수는 설치본 QA와 구분한다. Rust 코드는 바꾸지 않았으며 검증한 기존 Agent 바이너리를 재사용했다.
- 같은 프로젝트의 병렬 worktree 수정·자동 병합, 외부 메신저, 무인 Agent 수신, 자동 모델 대체, 장기 이력 아카이브는 범위 밖이다.
- sandbox에서 저장된 실패 PostCSS 평가로 빌드가 재실패하면 `STUDIO_DISABLE_BUILD_CACHE=1`로 이번 빌드의 Turbopack 디스크 캐시만 우회할 수 있다. 기본 캐시 정책은 바뀌지 않으며 캐시/검증 근거를 삭제하지 않는다.
