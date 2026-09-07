# 贡献指南

> **更新日期**：2026-07-06

---

## 1. 开发环境

```bash
npm install
npm run dev
```

环境要求：Node.js >= 18，npm >= 9。详见根目录 [`README.md`](./README.md)。

---

## 2. 分支与提交

- 默认在 `main` 上开发；大功能可用 feature 分支，合并前自测通过
- Commit 使用 [Conventional Commits](https://www.conventionalcommits.org/)：`feat:`、`fix:`、`docs:`、`refactor:`、`chore:` 等
- **不要**提交 `.env`、`.env.production`、API Key、TOS 密钥
- 发版流程见 [`docs/RELEASE.md`](./docs/RELEASE.md)，Agent 细节见 `.cursor/skills/release-ship/SKILL.md`

---

## 3. 改代码前

1. 先 `rg` / 搜索现有实现，扩展而非重复造轮子  
2. 类型放 `src/types/` 或对应 store/lib  
3. Renderer **不得**直接访问 Node API；文件 IO 走 IPC（见 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)）  
4. 改 IPC 时同步更新 `electron/preload.ts` 与 `docs/ARCHITECTURE.md` §3  

---

## 4. 自测（按改动范围）

| 改动类型 | 最低要求 |
|----------|----------|
| 小 fix / 文案 | `npm run compile` |
| 路由 / 壳 / 新页面 | `compile` + `verify:ui` |
| UI 复刻 Phase | 见 `docs/CURSOR_REPLICATION_GUIDE.md` §0.4 |

完整说明：[`docs/TESTING.md`](./docs/TESTING.md)。

---

## 5. 文档（读 vs 写）

| | 规则 |
|---|------|
| **读** | 索引 [`docs/README.md`](./docs/README.md)；Tier 1 **不读**大文档；Tier 2 business **最多 1 篇** |
| **写** | 行为/API 变更 → 改 **1 篇** [`../docs/business/`](../docs/business/README.md#agent-文档维护读-vs-写) 对应模块；IPC → `ARCHITECTURE.md` §3 |
| **禁止** | 每次小改都通读/批量改 20 篇 business；擅自新建大段 Spec |

Cursor Agent 细则：[`AGENTS.md`](./AGENTS.md)、[`.cursor/rules/agent-context-budget.mdc`](./.cursor/rules/agent-context-budget.mdc)。

---

## 6. 安全

发版或大改认证/上传前运行 `npm run scan:security`。见 [`SECURITY.md`](./SECURITY.md)。
