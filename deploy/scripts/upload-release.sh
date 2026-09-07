#!/usr/bin/env bash
# 备用：bash + scp 上传（推荐用 npm run upload → scripts/upload-release.mjs）
# 依赖：DEPLOY_HOST DEPLOY_USER DEPLOY_SSH_KEY
# 可选：DEPLOY_UPDATE_PATH（默认 /opt/haode-client/download）
set -euo pipefail

PLATFORM="${1:?用法: upload-release.sh win|mac}"
DEPLOY_HOST="${DEPLOY_HOST:?}"
DEPLOY_USER="${DEPLOY_USER:?}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:?}"
RELEASE_DIR="${RELEASE_DIR:-release}"

UPDATE_PATH="${DEPLOY_UPDATE_PATH:-/opt/haode-client/download}"
[[ -n "$UPDATE_PATH" ]] || UPDATE_PATH="/opt/haode-client/download"

KEY_FILE="$(mktemp)"
trap 'rm -f "$KEY_FILE"' EXIT
printf '%s\n' "$DEPLOY_SSH_KEY" > "$KEY_FILE"
chmod 600 "$KEY_FILE"
SSH_OPTS=(-i "$KEY_FILE" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null)

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

ssh_cmd() {
  ssh "${SSH_OPTS[@]}" "$REMOTE" "$@"
}

scp_cmd() {
  scp "${SSH_OPTS[@]}" "$@"
}

ensure_remote_dirs() {
  local dir
  for dir in "$@"; do
    ssh_cmd "mkdir -p '${dir}'"
  done
  echo "[upload] 远程目录已就绪: $*"
}

if [[ "$PLATFORM" == "win" ]]; then
  ensure_remote_dirs "${UPDATE_PATH}"
  scp_cmd "${RELEASE_DIR}/latest.yml" "${REMOTE}:${UPDATE_PATH}/"
  for f in "${RELEASE_DIR}"/*.exe; do
    [[ -f "$f" ]] || continue
    scp_cmd "$f" "${REMOTE}:${UPDATE_PATH}/"
  done
  echo "[upload] Windows 包已上传到 ${UPDATE_PATH}"
elif [[ "$PLATFORM" == "mac" ]]; then
  ensure_remote_dirs "${UPDATE_PATH}"
  scp_cmd "${RELEASE_DIR}/latest-mac.yml" "${REMOTE}:${UPDATE_PATH}/"
  for f in "${RELEASE_DIR}"/*.dmg "${RELEASE_DIR}"/*.zip; do
    [[ -f "$f" ]] || continue
    scp_cmd "$f" "${REMOTE}:${UPDATE_PATH}/"
  done
  echo "[upload] macOS 包已上传到 ${UPDATE_PATH}"
else
  echo "未知平台: $PLATFORM" >&2
  exit 1
fi
