# TASTESTUDIO 상표 (2026-10-02)

제품군 소프트 타입 꼴(남색 + 파랑, 굵고 둥근 선)로 그린 TASTESTUDIO 마크 · 워드마크 · 아이콘. 사용자 요청 "다른 제품과 동일한 패턴으로".
예전 큐브 그림(`tastedev-studio-desktop`)은 어두운 바탕 · 하늘색 가는 선이라 제품군 꼴이 아니어서 리눅스 메뉴 · 작업 표시줄에서 다른 제품과 달라 보였다.

- 마크: 큐브 — 예전 `tastedev-studio-desktop/studio.svg` 의 상자 그림을 1024 격자로 옮겨 제품군 꼴로 칠했다(사용자 요청 2026-10-03).
  윗면은 파랑(`#4099F0`)으로 채우고 상자 윤곽 · 안쪽 모서리 · 아래 받침은 남색(`#0E2B51`) 선(획 64/1024, 둥근 끝).
- 워드마크: `TASTE`(남색 `#102A4C`, 어두운 바탕 `#ECE8F6`) + `STUDIO`(스카이블루 `#469BEA`), 대문자 스플래시 v2 격자.
- 만든 것(TASTEGEO 의 `tastedev-geo-soft-type-20261002` 와 같은 두 단계):
  - `make-studio-brand.py` → `logo/`(mark.svg 진짜 벡터 · mark-1024 · 반전본 · 64/128 · app-icon-1024 · logo-horizontal · 반전본),
    `splash/`, `favicon/`, `pwa/`, `platform/windows/tastestudio.ico`, `platform/linux/<크기>/tastestudio.png`, `social/og-1200x630.png`, `preview.png`
  - `make-studio-family.py` → `tastedev-studio/`: 제품군 공통 `tastedev` 워드마크 + `STUDIO`, auth(google · naver · kakao · github-app) ·
    favicon · logo · platform(windows app.ico · macos app.icns · linux hicolor) · pwa · social · splash · brand-board
- 다시 만들기: `C:\Users\whitecalvin\anaconda3\python.exe make-studio-brand.py` 다음 `make-studio-family.py`(Pillow, Segoe UI · 맑은 고딕).
- 제품 저장소 적용: `sources/v1.0/tastedev-studio/resources/branding/tastedev-studio-desktop/icons/`(Tauri 번들 · 출시 설정이 함께 쓰는 자리)의
  PNG · ICO · ICNS 를 이 마크로 바꿨다(경로는 그대로). android · ios 폴더는 쓰지 않아 그대로 둔다.
