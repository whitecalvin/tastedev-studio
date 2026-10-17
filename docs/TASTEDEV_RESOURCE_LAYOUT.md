# TASTESTUDIO 생성 자료 경로

제품 루트 `resources`를 사용합니다. [디렉터리 설명](../resources/README.md)과 [이동 검증](../resources/verification/resource-location-20261014/RESULT.md)을 참조하세요.

생성 스크립트·Node 회귀 테스트·Rust opt-in 검증 경로·개발 Core artifact/legacy 데이터 경로를 제품 resources로 갱신했습니다. `release.desktop.json`의 `artifactDirectory`는 `resources/packages/release-tool`이며 공용 도구의 설정 없는 제품은 기존 `artifacts` 기본값을 유지합니다. 공용 도구 자체는 이동하지 않습니다.

현재 Tauri/릴리스 아이콘은 기존 제품 branding을 유지합니다. 이전 workspace 아이콘과 충돌한 53개 원본은 별도 legacy 폴더에 저장했고 어느 쪽도 덮어쓰거나 삭제하지 않았습니다.

원본 로그·이미지·패키지·회귀 source snapshot은 보존합니다. 경로를 변경한 문서·스크립트·운영 메타데이터의 수정 전 사본은 이관 검증의 `reference-originals`에 보존하며 `OLD-PATH-MAP.json`으로 이전 절대 경로를 추적합니다. 이 경로 변경은 과거 앱/QA/배포 결과를 새로 통과한 것으로 바꾸지 않습니다.

역사적 체크포인트·JSON 기록은 원본 bytes를 유지합니다. 재개/전달 경로를 갱신한 JSON은 `.relocated.json` 파생본으로 분리하며 해당 운영 reader는 파생본을 우선 선택합니다. exporter 캐시는 실제 변경 전 입력 digest와 출력 digest가 모두 일치할 때만 경로 변경에 따른 입력 체크포인트를 재색인합니다. 이번 기존 기록은 변경 전 입력부터 불일치하여 재사용을 주장하거나 앱 빌드를 실행하지 않았습니다.
