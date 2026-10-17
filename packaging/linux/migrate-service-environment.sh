#!/bin/sh
# 환경 값은 해석하거나 출력하지 않고 보존한다. 새 경로에 있는 설정이 우선한다.
set -eu
group=${1:?service group is required}
shift
copy_option=--no-clobber
# 신형 coreutils의 -n 경고를 피하고, 구형 배포판에서는 지원되는 옵션을 유지한다.
if cp --update=none --version >/dev/null 2>&1; then
  copy_option=--update=none
fi
migrate_file() {
  old=$1
  new=$2
  if [ -L "$new" ]; then
    echo "Environment migration refused a destination symlink: $new" >&2
    exit 1
  fi
  if [ -e "$new" ]; then
    [ -f "$new" ] || { echo "Environment destination is not a file: $new" >&2; exit 1; }
    return 0
  fi
  if [ -e "$old" ]; then
    [ -f "$old" ] || { echo "Legacy environment is not a file: $old" >&2; exit 1; }
    install -d -m 0755 -g "$group" "$(dirname "$new")"
    # 패키지 관리자 잠금 아래 실행한다. 원본은 복구용으로 남긴다.
    cp -p "$copy_option" -- "$old" "$new"
    chmod 0640 "$new"
    chgrp "$group" "$new"
  fi
}
if [ "${1:-}" = --directory ]; then
  [ "$#" -ge 3 ] || exit 2
  old_directory=$2
  new_directory=$3
  shift 3
  [ ! -L "$new_directory" ] || { echo "Configuration directory is a symlink: $new_directory" >&2; exit 1; }
  install -d -m 0755 -g "$group" "$new_directory"
  chgrp "$group" "$new_directory"
  if [ -d "$old_directory" ]; then
    # 서비스가 쓰는 JSON 등도 기존 값을 보존하며 새 설정을 덮어쓰지 않는다.
    cp -a "$copy_option" -- "$old_directory/." "$new_directory/"
  fi
  # cp -a가 옛 디렉터리의 권한까지 복사하므로 서비스 그룹의 접근 권한을 다시 보장한다.
  chmod 0755 "$new_directory"
  chgrp "$group" "$new_directory"
fi
[ "$(( $# % 2 ))" -eq 0 ] || exit 2
while [ "$#" -gt 0 ]; do
  migrate_file "$1" "$2"
  shift 2
done
