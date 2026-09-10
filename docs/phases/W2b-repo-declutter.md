# W2b — 试用仓减负（repo declutter）

**日期**：2026-09-10  
**目标**：私有试用仓库去掉公司发版 / 官网 / 计费探针等杂项，保留可 `npm i && npm run dev` 的最小有用树。

## 已删除（目录）

- `deploy/` — 服务器 nginx / 上传脚本
- `website/` — 官网静态页
- `openspec/` — 规格脚手架
- `docs/upstream-haode/` — 上游对照文档拷贝
- `docs/appendix-commercial.md`

## 已删除（其它）

- `pnpm-lock.yaml` / `pnpm-workspace.yaml`（统一 npm + `package-lock.json`）
- `skills-lock.json`、`.gitleaks.toml`、`.semgrepignore`
- 计费 / 好豆 / TOS / 豆包探针 / 微信登录校验 / scan-* 等死脚本（见本次 commit）
- `devDependencies`：`@volcengine/tos-sdk`、`ssh2-sftp-client`

## 脚本适配

- `verify-full` / `verify-image-pricing` / `verify-video-pricing`：不再调用 `smoke:billing`
- `verify-p1`：去掉 `verify:auth`
- `package.json` scripts：去掉 billing / upload:tos / scan / auth 相关入口

## 仍保留（有意）

- `scripts/e2e/`、FFmpeg / 画布 / 分镜测试、本地 `build` / `release`（本机打 Windows 包）
- `docs/phases/*`、决策与 quickstart
- `AGENTS.md` / `CONTRIBUTING.md` / `SECURITY.md`（可再精简）
