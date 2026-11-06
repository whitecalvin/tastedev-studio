# 네이티브 빌드·테스트·서명·패키징 하위 노드

부모 `build-package` 노드에 네이티브 빌드 설정을 저장하면 아래 8개 하위 작업이 고정된 실행 계약을 공유한다. 설정 저장·게시·미리보기는 실행하지 않는다. 사용자가 실행 계획을 검토해 시작하며, 기존 승인 노드도 그대로 적용된다.

| 하위 단계 | 직접 구현 | 실행 도구 |
|---|---|---|
| source | Git inventory로 저장된 Working Tree 복사, 비밀 파일·캐시 제외, 원본/복사 해시 비교, 복구 manifest | Git `ls-files` + Rust 파일 API |
| dependencies | 잠금 파일 기반 의존성 준비, Node 자동 lifecycle hook 제외 | Cargo fetch / Node의 npm-cli ci |
| build | 선택한 Cargo package/features·Rust 버전, 허용된 Node build task 실행, 선언된 실행 파일 실존/해시 확인 | Cargo build --release / npm build |
| test | 같은 저장된 Source에서 실제 테스트 종료 코드 확인 | Cargo test --release / npm test |
| stage | 실행 파일·리소스 폴더를 하위 경로 그대로 수집, 일부 복사 실패 시 완료 폴더 비공개 | Rust 파일 API |
| sign | 별도 사본에서 서명 후 검증. required일 때 도구·identity가 없으면 실패. none은 not-required로 명시 | signtool / codesign / gpg |
| package | 선언 형식만 생성, MSI는 WiX 형식으로 매핑, RPM은 전용 spec 구성 | tar / cargo-packager / rpmbuild |
| verify | 요청 형식 누락, 빈 산출물, checksum·크기 변경, 서명 오류 검사와 SHA256SUMS 생성 | Rust SHA-256 + 서명 검증 도구 |

공용 PowerShell 릴리스 스크립트는 호출하지 않는다. 임의 shell command 필드는 없다. Node 작업은 프로젝트의 build/build:desktop/test만 선택하며 `pre/post` lifecycle hook은 자동 실행하지 않는다. 프로젝트의 빌드 코드와 Cargo build.rs는 신뢰된 코드 실행이므로 이 기능을 OS sandbox라고 표시하지 않는다. 기존 executionIsolation 요청을 일반 빌드 실행으로 낮추지 않고 거부한다.

## GUI

1. 빌드·패키지 부모 선택 → 네이티브 빌드 설정.
2. 제품 ID, 버전, 플랫폼, build system, Cargo package/features, Node build task, 패키지 형식과 서명 정책을 지정한다.
3. binaries/payloads에는 `source`(저장된 소스 작업 위치 기준)와 `path`(수집 폴더 기준)를 입력한다. payload는 디렉터리도 가능하다. main binary는 정확히 하나다.
4. 전체 하위 단계에 동일한 하나의 등록 Agent를 역할로 연결한다.
5. 저장·게시 → 실행 범위 검토 → 시작. 하위 노드에서 실행 결과·Run·Source/설정/카탈로그 해시·산출물 해시를 확인한다.

화면에는 산출물 최대 128개를 표시한다. 전체 파일 수와 전체 manifest hash도 함께 표시한다. 전체 목록은 Agent의 해당 실행 `ledger.json`에 보존한다. 이 제한을 전체 파일 전송·검증 생략으로 사용하지 않는다.

## 장비의 로컬 카탈로그

Agent 실행 환경의 `TASTESTUDIO_BUILD_CATALOG`에 절대 JSON 경로를 지정한다. Core나 GUI에 인증값·키를 저장하지 않는다. 각 도구의 절대 파일 경로와 SHA-256을 운영자가 등록한다. 파일 해시가 달라지면 재검토한다.

```json
{
  "version": 1,
  "products": {
    "studio": {
      "sources": [{"root": "D:/approved/tastedev-studio", "destination": "product"}],
      "workdir": "product",
      "tools": {
        "git": {"path": "C:/approved/git.exe", "sha256": "<64 lowercase hexadecimal characters>"},
        "cargo": {"path": "C:/approved/cargo.exe", "sha256": "<64 lowercase hexadecimal characters>"},
        "rustc": {"path": "C:/approved/toolchain/bin/rustc.exe", "sha256": "<64 lowercase hexadecimal characters>"},
        "node": {"path": "C:/approved/node.exe", "sha256": "<64 lowercase hexadecimal characters>"},
        "npm": {"path": "C:/approved/npm/bin/npm-cli.js", "sha256": "<64 lowercase hexadecimal characters>"},
        "archive": {"path": "C:/approved/tar.exe", "sha256": "<64 lowercase hexadecimal characters>"},
        "packager": {"path": "C:/approved/cargo-packager.exe", "sha256": "<64 lowercase hexadecimal characters>"},
        "signtool": {"path": "C:/approved/signtool.exe", "sha256": "<64 lowercase hexadecimal characters>"}
      },
      "signing": {"identity": "<certificate-store thumbprint>", "timestampUrl": "https://<approved-rfc3161-server>"}
    }
  }
}
```

`cargo`는 선택 버전을 처리하는 rustup proxy이며 `rustc`는 해당 버전의 실제 컴파일러다. 요청 버전과 실제 rustc --version이 다르면 실패한다. Linux는 archive/gpg/rpmbuild, macOS는 archive/codesign/packager를 필요에 맞게 등록한다. sources는 여러 명시적 루트를 서로 겹치지 않는 destination으로 저장할 수 있다. Git tracked 파일과 ignore되지 않은 신규 파일을 포함하며 HEAD만 복사하지 않는다. .env·인증 파일·키·.git·target·artifacts·dependency cache·검증 근거는 제외한다.

## 체크포인트·복구

작업 공간: `<Agent workspace>/native-build/<project>/<execution>/<group>/`.

- `source`: 저장된 소스. 원본에 쓰지 않는다.
- `staging`: 수집 결과. `signed`: 별도 서명 사본.
- `artifacts/release`: 패키지와 checksum.
- `ledger.json`: schema 1, recipeHash/catalogHash/sourceHash, 단계별 영수증과 전체 파일 manifest.
- 결과 전송용 영수증: `<Agent workspace>/native-build-results/<Run>.json`.

Core는 기존 Queue·Matcher·Run·SQLite와 Graph 승인/실패/재시도 흐름을 사용한다. Agent가 `nativeBuild:1`을 제공하지 않으면 배정하지 않는다. 그룹은 같은 장비의 저장된 작업 공간을 재사용한다. 도구/카탈로그/recipe가 바뀌면 기존 실행을 재사용하지 않고 새 실행을 검토한다. 완료된 Core 하위 작업은 후속 실패 때문에 다시 실행하지 않는다. Agent의 파일 산출물 재사용은 실제 해시·크기를 다시 확인한다. 산출물 없는 dependencies/test의 임의 재요청을 자동으로 성공 처리하지 않는다.

Windows 컴파일러는 Agent에 준비된 LIB/LIBPATH/INCLUDE만 좁게 전달한다. 이 경로 환경의 해시가 바뀌면 build 이후 영수증을 그대로 재사용하지 않는다. 인증값이 든 일반 환경은 상속하지 않는다.

OS 파일 잠금은 프로세스 종료 시 해제된다. ledger는 동기화한 임시 파일의 원자 교체로 저장한다. 소유 helper는 기존 Agent 프로세스 트리 관리에서 timeout/cancel된다. 서명·수집 중 실패한 사본은 원본 Source나 이전 수집 결과를 덮어쓰지 않는다. 일부 crash/tamper 상태는 명시적인 새 실행을 요구할 수 있으며 강제 덮어쓰기로 복구하지 않는다.

## 검증 경계

- disposable 프로젝트의 실제 Cargo/Node 빌드·테스트와 ZIP 검사는 제품 패키징 검증과 다르다.
- 실제 인증서 서명, 제품 MSI/NSIS/DEB/RPM/AppImage/DMG 생성·설치·업그레이드는 사용자 실행 게이트다. 자동으로 실행하지 않는다.
- Linux/macOS 실행 환경이 없으면 실제 플랫폼 실행을 완료로 표시하지 않는다. 103은 사용하지 않는다.
- 자동 commit/push, 게시, 설치 서비스 hook, GitHub Release, 공용 설정의 임의 스크립트 이식은 이번 하위 노드 실행기에 포함하지 않는다. 기존 CLI의 모든 제품별 설치 hook과 완전 동등하다고 주장하지 않는다.
- 카탈로그는 신뢰된 장비 운영자 설정이다. 기존 JSON의 임의 command/hook을 불러와 실행하지 않는다. 추가 제품은 source roots·도구·명시적 payload mapping과 제품별 실전 검증이 필요하다.

설정 확인 기준: [cargo-packager CLI/config](https://github.com/crabnebula-dev/cargo-packager/blob/main/crates/packager/src/config/mod.rs). 실제 설치된 CLI --help도 대조했으며 MSI의 CLI 형식명은 wix다.

검증 근거: `resources/verification/native-build-steps-20261106/`의 최종 결과와 qualification 파일을 확인한다.
