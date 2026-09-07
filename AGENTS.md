# AGENTS.md

Cursor Agent 工作指南。**Tier / 读文件预算 / business 读写的唯一细则**：`.cursor/rules/agent-context-budget.mdc`（已 alwaysApply，勿再 Read 本文件重复内容）。

人类开发者：[`docs/README.md`](docs/README.md)。

## 技术栈

Electron 30 + electron-vite · React 18 + TS · Zustand 5 · Radix + Tailwind 4 · 别名 `@/` → `src/*`

## 目录

| 路径 | 用途 |
|------|------|
| `electron/` | 主进程、preload、IPC |
| `src/pages/` | 路由页 |
| `src/components/{workshop,canvas,settings,dashboard,ui}/` | 业务 UI |
| `src/stores/` | Zustand |
| `src/lib/` | 业务逻辑 |
| `src/types/` | 共享类型 |

## 文档索引（按需，禁止通读）

| 文档 | 何时 |
|------|------|
| `docs/ARCHITECTURE.md` | IPC / 分层 |
| `docs/TESTING.md` | verify / scan 百科；发版勾选见 `FULL_REGRESSION_CHECKLIST`；套件速查 `TESTING_E2E_INDEX`；计价/FFmpeg 分册 |
| `docs/CURSOR_REPLICATION_GUIDE.md` | **Tier 3** UI 复刻（只读当前 Phase 段） |
| `docs/CANVAS_MODULE_REVIEW_AND_CHECKLIST.md` | 画布模块能力 / 风险 |
| `../docs/business/` | **Tier 2 最多 1 篇**；索引 [`README.md`](../docs/business/README.md) |

## 发版

用户说 ship / 发版 / 打包 → **只读** `.cursor/skills/release-ship/SKILL.md`。

## 代码要点

- Renderer 禁止直接 Node API；文件 IO 走 IPC
- 最小 diff；不硬编码 Key；不擅自 commit / 新建 doc / 测试
- Conventional Commits；新 TS 文件加版权头
- 参考 `E:\work\project\kaiyuan\moyin-creator`：**仅**本仓无同类实现时读 **1** 个对应文件
