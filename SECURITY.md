# 安全说明

> **更新日期**：2026-07-06  
> 面向开发者与发版负责人；终端用户隐私政策见应用内「用户协议」设置 Tab。

---

## 1. 敏感数据

| 类型 | 存储位置 | 注意 |
|------|----------|------|
| 用户 token | Zustand persist / localStorage | 勿打日志、勿提交截图 |
| API Key / 模型密钥 | `settings.json`（dataRoot 或 Documents） | 仅本地；不得进 Git |
| TOS / 发版密钥 | `.env.production`（gitignore） | 仅 CI/本机打包机 |
| 项目媒体 | dataRoot 下 workflow/canvas 目录 | 路径校验见 `ipc-path-security.ts` |

---

## 2. 本地扫描脚本

```bash
npm run scan:security   # 推荐：聚合以下全部
npm run scan:semgrep    # 静态规则
npm run scan:secrets    # 密钥泄露
npm run scan:electron   # Electron 相关
npm run audit:deps      # 依赖漏洞
```

**何时跑**：发版前；新增 IPC/上传/认证逻辑后；引入新 npm 依赖后。

**失败时**：修复后再发版；若误报，在对应 `scripts/scan-*.mjs` 或规则配置中登记例外（需 code review）。

---

## 3. 开发约束

- Renderer 不直接使用 `fs` / `child_process`；特权操作经 preload 暴露的 API  
- 主进程 HTTP 下载使用 `assertHttpFetchUrl`；读写路径使用 `assertPathUnderDataRoot`  
- 不在源码、注释、测试 fixture 中写入真实 Key  

配置类历史问题可登记：`.cursor/bugs/BUG-REGISTRY.md`。

---

## 4. 上报

发现漏洞或泄露风险：联系项目维护者（内部渠道），勿在公开 issue 粘贴密钥或用户数据路径。

---

## 5. 相关文档

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — IPC 与路径安全  
- [`docs/TESTING.md`](./docs/TESTING.md) — 扫描命令详情  
- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
