#!/usr/bin/env bash
# 공용 출시 도구(release.desktop.json linux.packageScript)가 Linux 빌드 서버에서 Rust 바이너리(payload dir)가 있은 뒤에 부른다.
# TASTESTUDIO 의 리눅스 패키지를 구성 · 묶음으로 나눠 만든다(2026-10-05 사용자 결정). 빌드 · 배포 · 서명은 하지 않는다.
#
#   구성 패키지(파일을 담는다)          묶음 패키지(파일 없이 구성을 함께 깐다)
#   tastedev-studio-desktop  데스크톱 앱     tastedev-studio         전체(desktop · core · agent)
#   tastedev-studio-core     Core 서비스     tastedev-studio-server  코어 + 에이전트
#   tastedev-studio-agent    Agent 서비스
#
# 지금 리눅스에서 만들 수 있는 구성은 agent 뿐이다(데스크톱 앱은 Windows 판만, Core 리눅스 묶음은 아직 출시 빌드에 없다).
# 묶음은 이번에 만든 구성에만 기댄다. desktop · core 를 만들게 되면 payload 에 그 실행 파일 · 폴더를 넣고,
# release.desktop.json linux.extraPackages · release.product.json artifacts 에 그 이름을 더하면 된다.
# 기본 패키지(--package-name, tastedev-studio-<판>-linux-x86_64)는 "전체" 묶음이고, tar.gz 는 그 이름으로 구성 파일을 한 폴더에 담는다.
set -Eeuo pipefail
trap 'echo "package-linux-release.sh: ${LINENO} 번째 줄에서 멈췄습니다: ${BASH_COMMAND}" >&2' ERR

payload_dir=""
output_dir=""
package_name=""
version=""
packager_script=""
icon_path=""
desktop_categories_base64=""
formats="deb,rpm"
rpm_license=""

usage() {
  cat <<'EOF'
Usage: ./scripts/package-linux-release.sh --payload-dir PATH --output-dir PATH \
  --package-name NAME --version X.Y.Z --packager-script PATH --icon PATH \
  --desktop-categories-base64 BASE64 [--formats deb,rpm] [--rpm-license TEXT]
EOF
}

while (($#)); do
  case "$1" in
    --payload-dir) payload_dir="${2:?missing value for --payload-dir}"; shift 2 ;;
    --output-dir) output_dir="${2:?missing value for --output-dir}"; shift 2 ;;
    --package-name) package_name="${2:?missing value for --package-name}"; shift 2 ;;
    --version) version="${2:?missing value for --version}"; shift 2 ;;
    --packager-script) packager_script="${2:?missing value for --packager-script}"; shift 2 ;;
    --icon) icon_path="${2:?missing value for --icon}"; shift 2 ;;
    --desktop-categories-base64) desktop_categories_base64="${2:?missing value for --desktop-categories-base64}"; shift 2 ;;
    --formats) formats="${2?missing value for --formats}"; shift 2 ;;
    --rpm-license) rpm_license="${2:?missing value for --rpm-license}"; shift 2 ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo 'version must use stable three-part SemVer' >&2
  exit 2
fi
if [[ -z "$payload_dir" || -z "$output_dir" || "$payload_dir" != /* || "$output_dir" != /* ]]; then
  echo 'payload and output directories must be absolute paths' >&2
  exit 2
fi
if [[ "$package_name" != "tastedev-studio-${version}-linux-x86_64" ]]; then
  echo "unexpected package name: ${package_name}" >&2
  exit 2
fi
build_deb=false
build_rpm=false
IFS=',' read -r -a requested_formats <<< "$formats"
for format in "${requested_formats[@]}"; do
  case "$format" in
    "") ;;
    deb) build_deb=true ;;
    rpm) build_rpm=true ;;
    # AppImage 는 설치 과정이 없어 서비스(Core · Agent)를 등록할 수 없고, 리눅스 데스크톱 앱도 아직 없다.
    *) echo "unsupported TASTESTUDIO Linux package format: ${format} (deb, rpm)" >&2; exit 2 ;;
  esac
done
if [[ "$build_rpm" == true && ( -z "$rpm_license" || "$rpm_license" == *$'\n'* ) ]]; then
  echo 'RPM packaging requires a single-line --rpm-license' >&2
  exit 2
fi
if [[ "$build_rpm" == true ]] && ! command -v rpmbuild >/dev/null 2>&1; then
  echo 'RPM packaging requires rpmbuild. On Ubuntu, install it first: sudo apt install rpm' >&2
  exit 1
fi
if [[ "$(uname -m)" != x86_64 ]]; then
  echo "Linux package requires x86_64; found $(uname -m)" >&2
  exit 1
fi
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
source_dir="$(cd -- "${script_dir}/.." && pwd -P)"

agent_binary="$(readlink -f -- "${payload_dir}/tastestudio-agent")"
if [[ ! -f "$agent_binary" || ! -x "$agent_binary" ]]; then
  echo "release binary is missing: ${payload_dir}/tastestudio-agent" >&2
  exit 1
fi

install -d -m 0755 "$output_dir"
stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/tastestudio-linux-package.XXXXXX")"
cleanup() {
  if [[ "$stage_dir" == "${TMPDIR:-/tmp}"/tastestudio-linux-package.* && -d "$stage_dir" ]]; then
    rm -rf -- "$stage_dir"
  fi
}
trap cleanup EXIT

# ── Agent 구성: 실행 파일 · systemd 서비스 · 설정 본보기 ─────────────────────────────────────────────
# 서비스는 전용 계정 tastestudio 로 돈다(작업 폴더 /var/lib/tastestudio/workspace). 설정 /etc/tastestudio/agent.json 이 생기기
# 전에는 켜지지 않고(ConditionPathExists), 토큰은 /etc/tastestudio/agent.env 의 TASTEDEV_AGENT_TOKEN(Core 의 CORE_AGENT_TOKEN 과 같은 값).
agent_unit="$stage_dir/tastestudio-agent.service"
cat >"$agent_unit" <<'EOF'
[Unit]
Description=tastestudio-agent — runs build, test and deploy jobs for tastestudio-core
Documentation=https://tastedev.net/
After=network-online.target
Wants=network-online.target
ConditionPathExists=/etc/tastestudio/agent.json

[Service]
Type=simple
User=tastestudio
Group=tastestudio
WorkingDirectory=/var/lib/tastestudio
EnvironmentFile=-/etc/tastestudio/agent.env
ExecStart=/usr/bin/tastestudio-agent --config /etc/tastestudio/agent.json
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
KillMode=mixed
NoNewPrivileges=true
UMask=0077

[Install]
WantedBy=multi-user.target
EOF
agent_config_example="$stage_dir/agent.json.example"
cat >"$agent_config_example" <<'EOF'
{
  "endpoint": "ws://127.0.0.1:4340/agent",
  "name": "TASTESTUDIO Agent",
  "workspaceRoot": "/var/lib/tastestudio/workspace",
  "heartbeatMs": 2000,
  "reconnectMaxMs": 10000,
  "tokenEnv": "TASTEDEV_AGENT_TOKEN",
  "logLevel": "info",
  "allowInsecureLan": false
}
EOF
agent_env_example="$stage_dir/agent.env.example"
cat >"$agent_env_example" <<'EOF'
# Core 의 CORE_AGENT_TOKEN 과 같은 값(16~512자). 이 파일은 root:tastestudio 0640 으로 둔다.
TASTEDEV_AGENT_TOKEN=
EOF
agent_readme="$stage_dir/README-AGENT.txt"
cat >"$agent_readme" <<'EOF'
TASTESTUDIO Agent (Linux)

Core 의 지시에 따라 구현 · 빌드 · 배포 · 테스트를 하는 서비스입니다. 설치하면 systemd 서비스 tastestudio-agent 가
등록되지만, 설정 파일이 생기기 전에는 켜지지 않습니다.

1. 설정:   sudo cp /usr/share/doc/tastedev-studio-agent/agent.json.example /etc/tastestudio/agent.json
           sudo editor /etc/tastestudio/agent.json      (endpoint 는 Core 의 ws(s)://<주소>:4340/agent, name 은 장비 이름)
2. 토큰:   sudo editor /etc/tastestudio/agent.env       (TASTEDEV_AGENT_TOKEN = Core 의 CORE_AGENT_TOKEN)
3. 켜기:   sudo systemctl restart tastestudio-agent
4. 상태:   systemctl status tastestudio-agent   ·   journalctl -u tastestudio-agent

서비스는 전용 계정 tastestudio 로 돌고, 작업은 /var/lib/tastestudio/workspace 아래에서 합니다. 작업에 필요한
도구(git · node · cargo 등)는 그 계정이 쓸 수 있게 따로 준비하세요. 다른 장비의 Core 에 평문(ws://)으로 붙으려면
agent.json 의 allowInsecureLan 을 true 로 해야 합니다(가능하면 wss:// 를 쓰세요).
EOF

agent_postinst="$stage_dir/agent-postinst"
cat >"$agent_postinst" <<'EOF'
#!/bin/sh
set -e
if ! getent group tastestudio >/dev/null; then
  groupadd --system tastestudio
fi
if ! id -u tastestudio >/dev/null 2>&1; then
  useradd --system --gid tastestudio --home-dir /var/lib/tastestudio --shell /usr/sbin/nologin tastestudio
fi
install -d -m 0750 -o root -g tastestudio /etc/tastestudio
install -d -m 0750 -o tastestudio -g tastestudio /var/lib/tastestudio /var/lib/tastestudio/workspace
if [ ! -e /etc/tastestudio/agent.env ]; then
  install -m 0640 -o root -g tastestudio /usr/share/doc/tastedev-studio-agent/agent.env.example /etc/tastestudio/agent.env
fi
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload || true
  systemctl enable tastestudio-agent.service >/dev/null 2>&1 || true
  # 설정이 있으면 새 판으로 다시 켜고, 없으면 ConditionPathExists 로 건너뛴다.
  if [ -e /etc/tastestudio/agent.json ]; then
    systemctl restart tastestudio-agent.service || true
  fi
fi
exit 0
EOF
agent_preun_body='if command -v systemctl >/dev/null 2>&1; then
  systemctl disable --now tastestudio-agent.service || true
fi'
agent_postrm="$stage_dir/agent-postrm"
cat >"$agent_postrm" <<'EOF'
#!/bin/sh
set -e
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload || true
fi
exit 0
EOF

agent_root="$stage_dir/agent-root"
install -d -m 0755 "$agent_root/usr/bin" "$agent_root/lib/systemd/system" "$agent_root/usr/share/doc/tastedev-studio-agent"
install -m 0755 "$agent_binary" "$agent_root/usr/bin/tastestudio-agent"
install -m 0644 "$agent_unit" "$agent_root/lib/systemd/system/tastestudio-agent.service"
install -m 0644 "$agent_config_example" "$agent_root/usr/share/doc/tastedev-studio-agent/agent.json.example"
install -m 0644 "$agent_env_example" "$agent_root/usr/share/doc/tastedev-studio-agent/agent.env.example"
install -m 0644 "$agent_readme" "$agent_root/usr/share/doc/tastedev-studio-agent/README-AGENT.txt"
[[ -f "${source_dir}/README.md" ]] && install -m 0644 "${source_dir}/README.md" "$agent_root/usr/share/doc/tastedev-studio-agent/README.md"

# ── tar.gz: 구성 파일을 한 폴더에(설치 패키지를 쓰지 않는 장비용) ───────────────────────────────────
package_root="$stage_dir/$package_name"
install -d -m 0755 "$package_root/systemd"
install -m 0755 "$agent_binary" "$package_root/tastestudio-agent"
install -m 0644 "$agent_unit" "$package_root/systemd/tastestudio-agent.service"
install -m 0644 "$agent_config_example" "$package_root/agent.json.example"
install -m 0644 "$agent_env_example" "$package_root/agent.env.example"
install -m 0644 "$agent_readme" "$package_root/README-AGENT.txt"
printf '%s\n' "$version" >"$package_root/release-version.txt"
tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner \
  -C "$stage_dir" -cf - "$package_name" | gzip -n -9 >"$output_dir/$package_name.tar.gz.tmp"
mv -f -- "$output_dir/$package_name.tar.gz.tmp" "$output_dir/$package_name.tar.gz"

# ── 패키지 만들기 ────────────────────────────────────────────────────────────────────────────
file_name() { printf '%s-%s-linux-x86_64' "$1" "$version"; }

# build_deb NAME ROOT|"" SUMMARY DEPENDS EXTRA_CONTROL POSTINST PRERM_BODY POSTRM
build_deb() {
  local name="$1" root="$2" summary="$3" depends="$4" extra="$5" postinst="$6" prerm_body="$7" postrm="$8"
  local deb_root="$stage_dir/deb-$name"
  rm -rf -- "$deb_root"
  install -d -m 0755 "$deb_root/DEBIAN"
  if [[ -n "$root" ]]; then cp -a -- "$root/." "$deb_root/"; fi
  {
    printf 'Package: %s\nVersion: %s\nArchitecture: amd64\nMaintainer: GXSOFT <repository@tastedev.net>\n' "$name" "$version"
    printf 'Section: devel\nPriority: optional\nHomepage: https://tastedev.net/\n'
    if [[ -n "$depends" ]]; then printf 'Depends: %s\n' "$depends"; fi
    if [[ -n "$extra" ]]; then printf '%s\n' "$extra"; fi
    printf 'Description: %s\n' "$summary"
  } >"$deb_root/DEBIAN/control"
  if [[ -n "$postinst" ]]; then install -m 0755 "$postinst" "$deb_root/DEBIAN/postinst"; fi
  if [[ -n "$prerm_body" ]]; then
    printf '#!/bin/sh\nset -e\nif [ "$1" = remove ]; then\n%s\nfi\nexit 0\n' "$prerm_body" >"$deb_root/DEBIAN/prerm"
    chmod 0755 "$deb_root/DEBIAN/prerm"
  fi
  if [[ -n "$postrm" ]]; then install -m 0755 "$postrm" "$deb_root/DEBIAN/postrm"; fi
  SOURCE_DATE_EPOCH=0 dpkg-deb --root-owner-group --build "$deb_root" "$output_dir/.$(file_name "$name").deb.new" >/dev/null
  mv -f -- "$output_dir/.$(file_name "$name").deb.new" "$output_dir/$(file_name "$name").deb"
  echo "Linux DEB package: $output_dir/$(file_name "$name").deb"
}

# build_rpm NAME ROOT|"" SUMMARY REQUIRES EXTRA_TAGS POSTINST PREUN_BODY POSTRM
build_rpm() {
  local name="$1" root="$2" summary="$3" requires="$4" extra="$5" postinst="$6" preun_body="$7" postrm="$8"
  local top="$stage_dir/rpm-$name" rpm_root="$stage_dir/rpmroot-$name"
  rm -rf -- "$top" "$rpm_root"
  mkdir -p -- "$top"/{BUILD,BUILDROOT,RPMS,SOURCES,SPECS,SRPMS} "$rpm_root"
  local files_section=""
  if [[ -n "$root" ]]; then
    cp -a -- "$root/." "$rpm_root/"
    # Fedora · RHEL 은 /lib 가 /usr/lib 를 가리키므로 systemd 유닛은 /usr/lib/systemd/system 에 둔다.
    if [[ -d "$rpm_root/lib/systemd/system" ]]; then
      install -d -m 0755 "$rpm_root/usr/lib/systemd/system"
      mv -- "$rpm_root/lib/systemd/system/"* "$rpm_root/usr/lib/systemd/system/"
      rm -rf -- "$rpm_root/lib"
    fi
    files_section="$(cd -- "$rpm_root" && find . \( -type f -o -type l \) -print | sed 's|^\.||' | LC_ALL=C sort)"
    if grep -q '[[:space:]%*?[]' <<<"$files_section"; then
      echo "RPM file list contains characters that need escaping ($name)" >&2
      exit 1
    fi
  fi
  tar --sort=name --mtime='UTC 1970-01-01' --owner=0 --group=0 --numeric-owner -C "$rpm_root" -czf "$top/SOURCES/rootfs.tar.gz" .
  {
    printf 'Name: %s\nVersion: %s\nRelease: 1\nSummary: %s\nLicense: %s\nURL: https://tastedev.net/\nBuildArch: x86_64\n' \
      "$name" "$version" "$summary" "$rpm_license"
    printf 'AutoReqProv: no\nSource0: rootfs.tar.gz\n%%global debug_package %%{nil}\n%%global __os_install_post %%{nil}\n'
    if [[ -n "$requires" ]]; then printf 'Requires: %s\n' "$requires"; fi
    if [[ -n "$extra" ]]; then printf '%s\n' "$extra"; fi
    printf '\n%%description\n%s\n\n%%prep\n\n%%build\n\n%%install\nmkdir -p %%{buildroot}\ntar -xzf %%{SOURCE0} -C %%{buildroot}\n' "$summary"
    if [[ -n "$postinst" ]]; then printf '\n%%post\n'; sed 's/%/%%/g' -- "$postinst"; fi
    if [[ -n "$preun_body" ]]; then printf '\n%%preun\nif [ "$1" -eq 0 ]; then\n%s\nfi\nexit 0\n' "$(sed 's/%/%%/g' <<<"$preun_body")"; fi
    if [[ -n "$postrm" ]]; then printf '\n%%postun\n'; sed 's/%/%%/g' -- "$postrm"; fi
    printf '\n%%files\n'
    if [[ -n "$files_section" ]]; then printf '%s\n' "$files_section"; fi
  } >"$top/SPECS/$name.spec"
  rpmbuild -bb --quiet --define "_topdir $top" --define '_build_id_links none' "$top/SPECS/$name.spec"
  local built
  built="$(find "$top/RPMS" -type f -name "$name-$version-1.*.rpm" -print | head -n 1)"
  [[ -n "$built" ]] || { echo "expected one RPM for $name" >&2; exit 1; }
  mv -f -- "$built" "$output_dir/$(file_name "$name").rpm"
  echo "Linux RPM package: $output_dir/$(file_name "$name").rpm"
}

# 예전 판의 tastedev-studio(옛 이름 tastestudio)는 Agent 파일을 직접 담았다. 이제 그 파일은 tastedev-studio-agent 가 맡는다.
agent_takeover_deb="Replaces: tastedev-studio (<< ${version}), tastestudio (<< ${version})
Breaks: tastedev-studio (<< ${version}), tastestudio (<< ${version})"
agent_takeover_rpm="Conflicts: tastedev-studio < ${version}
Conflicts: tastestudio < ${version}"

# 이번에 만든 구성(묶음이 기댈 것)
built_components=(tastedev-studio-agent)
server_components=(tastedev-studio-agent)

deb_depends() { local out="" c; for c in "$@"; do out+="${out:+, }$c (= ${version})"; done; printf '%s' "$out"; }
rpm_requires() { local out="" c; for c in "$@"; do out+="${out:+, }$c = ${version}-1"; done; printf '%s' "$out"; }

if [[ "$build_deb" == true ]]; then
  build_deb tastedev-studio-agent "$agent_root" 'TASTESTUDIO Agent - runs build, test and deploy jobs for TASTESTUDIO Core' \
    'systemd' "$agent_takeover_deb" "$agent_postinst" "$agent_preun_body" "$agent_postrm"
  build_deb tastedev-studio-server '' 'TASTESTUDIO Core and Agent (server bundle)' \
    "$(deb_depends "${server_components[@]}")" '' '' '' ''
  build_deb tastedev-studio '' 'TASTESTUDIO (all components)' \
    "$(deb_depends "${built_components[@]}")" 'Provides: tastestudio
Replaces: tastestudio
Conflicts: tastestudio' '' '' ''
fi
if [[ "$build_rpm" == true ]]; then
  build_rpm tastedev-studio-agent "$agent_root" 'TASTESTUDIO Agent - runs build, test and deploy jobs for TASTESTUDIO Core' \
    'systemd' "$agent_takeover_rpm" "$agent_postinst" "$agent_preun_body" "$agent_postrm"
  build_rpm tastedev-studio-server '' 'TASTESTUDIO Core and Agent (server bundle)' \
    "$(rpm_requires "${server_components[@]}")" '' '' '' ''
  build_rpm tastedev-studio '' 'TASTESTUDIO (all components)' \
    "$(rpm_requires "${built_components[@]}")" "Provides: tastestudio = ${version}-1
Obsoletes: tastestudio < ${version}-1" '' '' ''
fi

for f in "$output_dir"/*-"${version}"-linux-x86_64.*; do
  case "$f" in *.deb|*.rpm|*.tar.gz) sha256sum "$f" ;; esac
done
