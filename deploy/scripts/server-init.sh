#!/usr/bin/env bash
# 在部署服务器上执行一次，初始化自动更新/下载目录
set -euo pipefail

UPDATE_PATH="${DEPLOY_UPDATE_PATH:-/opt/haode-client/download}"
mkdir -p "${UPDATE_PATH}"

echo "目录已创建：${UPDATE_PATH}"
echo "Nginx 示例：deploy/nginx/haode-client.example.conf"
