# 发版流程（人类可读）

> **更新日期**：2026-09-02  
> Agent 完整 checklist：`.cursor/skills/release-ship/SKILL.md`  
> 服务器与下载页：`deploy/DEPLOY.md`

---

## 1. 三种常见场景

| 场景 | 做什么 | 不看 |
|------|--------|------|
| **本地调试** | `npm run dev` | 无需 upload |
| **只打安装包** | 配置 `.env.production` → `npm run build` | 可不 commit / upload |
| **正式发版** | 下文 §2 全流程 | — |

根目录 [`README.md`](../README.md) 侧重「如何 build」；**正式发版以本节 + release-ship skill 为准**。

---

## 2. 正式发版 Checklist

```
- [ ] 0. 完整回归 `npm run verify:all` + 勾选 [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) **§1.5 发版签字**（无登录：`VERIFY_ALL_SKIP_AUTH=1`）
- [ ] 0b. 强烈建议（不挡签字）：`dev` + `npm run verify:ui`；Win 发版 `verify:ffmpeg-win-pack`
- [ ] 1. 写用户更新日志 src/constants/release-changelog.ts（数组顶部追加）
- [ ] 2. 升版本 npm version x.y.z --no-git-tag-version
- [ ] 3. 确认 .env.production 为公网 API（非 localhost）
- [ ] 3.5. Windows 发版：确认 `vendor/ffmpeg/win/ffmpeg.exe` + `ffprobe.exe` 存在（`npm run fetch:ffmpeg-win`）；可选 `npm run verify:ffmpeg-win-pack`
- [ ] 4. npm run build → 检查 release/ 产物
- [ ] 5. git commit（不含 release/、.env*）
- [ ] 6. npm run upload（TOS + 服务器/官网）
- [ ] 7. git push origin main
```

**不打 git tag**；版本以 `package.json` 与 `website/version.json` 为准。

`npm run build` 会校验 changelog 是否包含当前版本（见 `scripts/build-desktop.mjs`）。

---

## 3. 产物与更新通道

| 产物 | 位置 |
|------|------|
| Windows 安装包 | `release/*.exe` |
| macOS | 需在 Mac 上 `npm run build:mac` 或 `build:mac:ci` |
| 自动更新 feed | TOS `latest.yml`（Windows 应用内更新） |
| 官网下载 | `website/version.json` + 落地页 |

双通道细节见 `deploy/DEPLOY.md`。

---

## 4. 环境变量

打包时写入 exe 的关键项（`.env.production`）：

- `VITE_API_BASE`
- `VITE_UPLOAD_ORIGIN`
- `VITE_UPDATE_PUBLISH_URL`

完整列表见 `.env.example`。本地覆盖用 `.env.production.local`（gitignore）。

---

## 5. 回滚（简要）

1. 在 TOS / 服务器保留的旧版 exe + `latest.yml` 指回上一版本  
2. 同步改 `website/version.json` 直链  
3. 已安装用户需重新「检查更新」或从官网下旧包  

详细运维步骤见 `deploy/DEPLOY.md`，发版前确认服务器保留版本数（`DEPLOY_KEEP_INSTALLER_VERSIONS`）。

---

## 6. 相关命令

| 命令 | 说明 |
|------|------|
| `npm run release` / `release:patch` | 脚本化 patch 发版入口（读 `scripts/release.mjs`） |
| `npm run ship:win` | build + upload |
| `npm run upload:website` | 仅更新官网页 |
