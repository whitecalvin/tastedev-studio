#!/usr/bin/env bash
# 공용 Linux 준비 훅: Agent의 공용 Cargo 빌드 후, 화면을 준비하고 GUI/Core를 추가한다.
set -Eeuo pipefail
version=""; payload_dir=""
while (($#)); do
  case "$1" in
    --version) version="${2:?}"; shift 2 ;;
    --payload-dir) payload_dir="${2:?}"; shift 2 ;;
    *) echo "Unknown preparation argument: $1" >&2; exit 2 ;;
  esac
done
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && "$payload_dir" == /* ]] || exit 2
[[ -f Cargo.toml && -f scripts/prepare-monaco.mjs ]] || { echo 'Run in the shared release Cargo source directory' >&2; exit 2; }
node -e 'if(Number(process.versions.node.split(".")[0])!==24)throw Error("Node 24 is required")'
for module in gtk+-3.0 webkit2gtk-4.1; do
  pkg-config --exists "$module" || { echo "Missing Linux GUI build dependency: $module" >&2; exit 1; }
done
corepack pnpm install --frozen-lockfile
node scripts/prepare-monaco.mjs
STUDIO_DESKTOP_EXPORT=1 node node_modules/next/dist/bin/next build
[[ -f .next-desktop/index.html ]] || exit 1
cargo_executable="${TASTESTUDIO_CARGO:-$HOME/.cargo/bin/cargo}"
[[ -x "$cargo_executable" ]] || cargo_executable="$(command -v cargo)"
"$cargo_executable" build --locked --release --all-features -p tastedev-studio --bin tastedev-studio
install -d -m 0755 "$payload_dir"
install -m 0755 "${CARGO_TARGET_DIR:-target}/release/tastedev-studio" "$payload_dir/tastestudio"
node scripts/prepare-core-runtime.mjs "$payload_dir/core"
