<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## TASTESTUDIO product resources

- 생성 자료의 기준은 이 제품 루트의 `resources`이다. 브랜드는 `resources/branding`, 시안은 `resources/design`, 검증은 `resources/verification`, 안내는 `resources/guides`, 패키지는 `resources/packages`, 로컬 검증 런타임은 `resources/runtime`에 저장한다.
- 이전 workspace resources의 Studio 전용 경로는 제품 resources로 이관한다. 공용 릴리스 도구, 전역 UI 학습 자료, 통합 DEV/QA 인덱스, 사용자 작업 공간은 상위 workspace에 유지한다.
- 이동·충돌·해시는 `resources/verification/resource-location-20261014`에 기록한다. 기존 체크포인트/로그/회귀 fixture/서명 패키지 내용을 임의로 삭제하거나 덮어쓰지 않는다.
- DEV 절차는 `../../../agents/dev-01/{AGENTS.md,PROJECT_GOALS.md,WORKFLOW.md,TASKS.md}`를 읽는다. 제품 전용 실행 근거는 제품 resources, 공용 통합 인덱스는 workspace agents에 둔다.
## Product resources policy

- TASTESTUDIO product-owned generated resources belong under this product root `resources`, including branding, design, verification and guides. New outputs must not use workspace-level product folders.
- Shared tools, global UI learning material and integrated cross-product records stay in workspace `resources`.
- Preserve originals, license text, fixtures, release artifacts and checkpoints. Verify absolute paths and SHA-256 before moving existing files; do not overwrite destination conflicts.
- STUDIO fork sessions must not move shared existing STUDIO folders concurrently with the primary STUDIO session. Record source paths, proposed destinations, hashes and pending references in their own product-local verification directory.
