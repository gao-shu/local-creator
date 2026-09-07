# 好的漫创 — 服务器部署手册

> 代码仓库：https://gitee.com/honden/haode-ai-client  
> 勿将密码写入仓库。发版配置写在本地 `.env.production`（不提交 Git）。

## 地址说明（生产环境 · 方案 A）

| 用途 | 值 |
|------|-----|
| 服务器 | `115.191.9.56` |
| 生产域名 | `duanju.haodeweishi.cn` |
| 服务器目录 | `/opt/haode-client/download/` |
| 后端 API（打包注入） | `http://duanju.haodeweishi.cn/api`（Nginx 80 `/api/` → Docker `:28080`） |
| 安装包下载 | `http://duanju.haodeweishi.cn/haode-client/download/好的漫创 Setup x.x.x.exe` |
| 自动更新 feed | `http://duanju.haodeweishi.cn/haode-client/download/latest.yml` |
| admin Docker | frontend `:28080`，backend `:28000` |

### 更新方式（双通道 · 方案 B）

| 入口 | 下载方式 | 说明 |
|------|----------|------|
| **官网下载页** | TOS/官网 exe 直链 | `version.json` → `windowsDirectUrl` |
| **客户端「检查更新」** | 读 TOS `latest.yml`，下载完整 `.exe` | **仅 Windows** |
| **macOS 更新** | 官网下载页 **.dmg** 手动安装 | 无应用内自动更新 |

服务器保留最近 **5** 个版本的 `.exe`（`DEPLOY_KEEP_INSTALLER_VERSIONS=5`），供浏览器「官网直链」补装；`latest.yml` 始终只指向最新版。

发版须上传：`latest.yml` + `.exe`（`npm run upload` 已包含）。

> **不用 8088**：API 统一走 80 端口 `/api/`。测试环境 `8.141.97.65` 已停用。

---

## 1. 服务器 Nginx 要点

主配置 `listen 80` 需包含：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:28080/api/;
    ...
}
location ^~ /haode-client/download/ {
    alias /opt/haode-client/download/;
    ...
}
```

`duanju.haodeweishi.cn` 的 server 块同理（下载目录 + 反代 28080）。

验证：

```bash
curl -X POST http://duanju.haodeweishi.cn/api/client/auth/wechat/session \
  -H 'Content-Type: application/json' -d '{}'
curl http://duanju.haodeweishi.cn/haode-client/download/latest.yml
```

---

## 2. 本地发版

`.env.production`：

```env
VITE_API_BASE=http://duanju.haodeweishi.cn/api
VITE_UPLOAD_ORIGIN=http://duanju.haodeweishi.cn
VITE_UPDATE_PUBLISH_URL=http://duanju.haodeweishi.cn/haode-client/download
DEPLOY_UPDATE_PATH=/opt/haode-client/download
DEPLOY_HOST=115.191.9.56
DEPLOY_USER=root
DEPLOY_PASSWORD=你的密码
```

```powershell
npm run ship:win
```

---

## 3. 目录结构

```text
/opt/haode-client/download/
├── latest.yml
├── index.html
├── version.json
└── 好的漫创 Setup x.x.x.exe
```
