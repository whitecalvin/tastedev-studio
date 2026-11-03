# TASTESTUDIO — 실사용 오케스트레이션 완성

구현 단계는7개다. 목표 프롬프트의 나머지 절은 공통 UI·검증·문서·완료 기준이며 추가 구현 단계가 아니다.

1. 프로젝트 준비: 목적/플랫폼/기술/엔진 분리, 생성 파일 검토, 실제 준비 상태, 첫 검증 노드 초안.
2. 실행 격리: 지원 OS에서 파일/네트워크/프로그램/자식 프로세스/시간/취소 경계를 실제 Agent 실행에 적용.
3. 노드 관제: 장비/Agent/AI 역할/작업/승인/스케줄의 실제 실행·Source·대기 이유와 다음 행동.
4. Native GUI: 실제 질문/승인/Diff/Apply/Editor/Git/재시험/Revert/History. IPC 모사와 구분.
5. Godot: 원본 minimal6스킬, 실제 Claude/Agent/플레이·렌더링/독립 검토/원본 반영/재시험.
6. 복구: Core/Agent/인증/timeout/cancel/중복/만료/Source/통합/전송/후속 시작 장애의 정확한 재개.
7. 실제 제품: tastedev-files 등의 격리된 작은 실제 작업으로 개발·통합·후속 검증을 수행.

각 단계의 실제 구현/자동 검사/실제 Provider/실제 Rust Agent/실제 Native GUI/미검증 경계를 별도로 기록한다. 필수 Acceptance가 남으면 전체 PASS로 변경하지 않는다. 기존 Graph/Core/Queue/Matcher/Scheduler/AIService/Factory/FixService/Snapshot/Integration/History를 재사용한다. 패키징·설치·서명·게시·운영 배포는 사용자 담당이며 버전/태그나 자동 commit/push를 변경하지 않는다.

정본 진행 기록: `resources/verification/dev-01/orchestration-completion-20261101/checkpoint.json`.


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
