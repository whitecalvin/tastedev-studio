#!/usr/bin/env bash
# 공용 Linux 준비 훅: Agent의 공용 Cargo 빌드 후, 화면을 준비하고 GUI/Core를 추가한다.
set -Eeuo pipefail
version=""; payload_dir=""; check_runtime=0
while (($#)); do
  case "$1" in
    --version) version="${2:?}"; shift 2 ;;
    --payload-dir) payload_dir="${2:?}"; shift 2 ;;
    --check-runtime) check_runtime=1; shift ;;
    *) echo "Unknown preparation argument: $1" >&2; exit 2 ;;
  esac
done
# SSH 비대화형 shell은 nvm 초기화를 하지 않는다. 설치된 런타임만 찾고 설치/다운로드하지 않는다.
node_compatible() {
  "$1" -e 'const [major,minor,patch]=process.versions.node.split(".").map(Number);process.exit(major===24&&(minor>11||(minor===11&&patch>=1))?0:1)' >/dev/null 2>&1
}
node_executable=""
if [[ -n "${TASTESTUDIO_NODE:-}" ]]; then
  [[ "$TASTESTUDIO_NODE" == /* && -x "$TASTESTUDIO_NODE" ]] && node_compatible "$TASTESTUDIO_NODE" || {
    echo 'TASTESTUDIO_NODE must be an absolute executable path to Node >=24.11.1 <25.' >&2; exit 127;
  }
  node_executable="$TASTESTUDIO_NODE"
else
  path_node="$(command -v node || true)"
  if [[ -n "$path_node" ]] && node_compatible "$path_node"; then node_executable="$path_node"; fi
  if [[ -z "$node_executable" ]]; then
    shopt -s nullglob
    candidates=("${NVM_DIR:-$HOME/.nvm}"/versions/node/v24.*/bin/node "$HOME/.local/bin/node" /usr/local/bin/node /usr/bin/node)
    shopt -u nullglob
    for candidate in "${candidates[@]}"; do
      if [[ -x "$candidate" ]] && node_compatible "$candidate"; then node_executable="$candidate"; break; fi
    done
  fi
fi
[[ -n "$node_executable" ]] || {
  echo 'Linux frontend preparation requires Node >=24.11.1 <25. No compatible installed runtime was found in PATH or nvm. Set TASTESTUDIO_NODE to its absolute path; if absent, provision it using the shared build environment. Completed Cargo/Windows gates need not be repeated.' >&2
  exit 127
}
export PATH="$(dirname "$node_executable"):$PATH"
if command -v corepack >/dev/null 2>&1; then
  package_manager=(corepack pnpm)
elif command -v pnpm >/dev/null 2>&1; then
  package_manager=(pnpm)
else
  echo 'Node is available, but pnpm/Corepack is missing. Provision the packageManager version from package.json using the shared build environment; no automatic installation was performed.' >&2
  exit 127
fi
echo "Linux frontend runtime: $("$node_executable" --version); package manager: ${package_manager[*]}"
((check_runtime)) && exit 0
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ && "$payload_dir" == /* ]] || exit 2
[[ -f Cargo.toml && -f scripts/prepare-monaco.mjs ]] || { echo 'Run in the shared release Cargo source directory' >&2; exit 2; }
for module in gtk+-3.0 webkit2gtk-4.1; do
  pkg-config --exists "$module" || { echo "Missing Linux GUI build dependency: $module" >&2; exit 1; }
done
"${package_manager[@]}" install --frozen-lockfile
"$node_executable" scripts/prepare-monaco.mjs
STUDIO_DESKTOP_EXPORT=1 "$node_executable" node_modules/next/dist/bin/next build
[[ -f .next-desktop/index.html ]] || exit 1
cargo_executable="${TASTESTUDIO_CARGO:-$HOME/.cargo/bin/cargo}"
[[ -x "$cargo_executable" ]] || cargo_executable="$(command -v cargo)"
"$cargo_executable" build --locked --release --all-features -p tastedev-studio --bin tastedev-studio
install -d -m 0755 "$payload_dir"
install -m 0755 "${CARGO_TARGET_DIR:-target}/release/tastedev-studio" "$payload_dir/tastestudio"
"$node_executable" scripts/prepare-core-runtime.mjs "$payload_dir/core"
