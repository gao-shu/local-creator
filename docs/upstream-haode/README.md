# 文档索引

> **更新日期**：2026-09-02  
> 人类开发者、Cursor Agent、运维请从本页选读，避免在 README / AGENTS / `.cursor/skills` 之间迷路。

---

## 1. 按角色阅读

| 角色 | 先读 | 再按需读 |
|------|------|----------|
| **新人开发者** | 根目录 [`README.md`](../README.md) → 本文 §2 | [`ARCHITECTURE.md`](./ARCHITECTURE.md)、[`TESTING.md`](./TESTING.md) |
| **Cursor Agent** | 已注入 `agent-context-budget.mdc`，**勿再 Read AGENTS.md** | Tier 3 才读 `CURSOR_REPLICATION_GUIDE` 当前 Phase |
| **产品 / 功能 ID** | [`PROJECT_BLUEPRINT.md`](./PROJECT_BLUEPRINT.md) | 外部 `weeek-work`（若有本地副本） |
| **分镜审核 / 微视开白** | [`STORYBOARD_IMAGE_REVIEW.md`](./STORYBOARD_IMAGE_REVIEW.md) | — |
| **正式发版** | [`RELEASE.md`](./RELEASE.md) | `.cursor/skills/release-ship/SKILL.md`（Agent 完整 checklist） |
| **服务器 / 下载页** | [`deploy/DEPLOY.md`](../deploy/DEPLOY.md) | `.env.example` |
| **跨端业务逻辑** | 本文 §3 业务文档 | `../docs/business/`（见 §3 说明） |

**原则**：`.cursor/skills` 与 `.cursor/rules` 主要服务 Agent，**不能替代**上表中的稳定开发文档。

---

## 2. 仓内文档（`docs/`）

| 文件 | 用途 |
|------|------|
| [`README.md`](./README.md) | 本索引 |
| [`PROJECT_BLUEPRINT.md`](./PROJECT_BLUEPRINT.md) | 业务范围、分期、功能 ID、实现状态 |
| [`CURSOR_REPLICATION_GUIDE.md`](./CURSOR_REPLICATION_GUIDE.md) | UI 从 ai-fusion-video 复刻（Tier 3） |
| [`CANVAS_MODULE_REVIEW_AND_CHECKLIST.md`](./CANVAS_MODULE_REVIEW_AND_CHECKLIST.md) | 画布模块审查、风险与完整功能清单 |
| [`STORYBOARD_IMAGE_REVIEW.md`](./STORYBOARD_IMAGE_REVIEW.md) | Step 4 分镜审核、微视开白 |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | 架构分层、IPC 清单、代码入口 |
| [`TESTING.md`](./TESTING.md) | 测试模块百科（E2E 矩阵、日常映射）；发版勾选见 CHECKLIST |
| [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md) | Electron E2E **46** 套件速查 + 聚合别名 |
| [`TESTING_PRICING.md`](./TESTING_PRICING.md) | 图片/视频分档计价自动化 + 手工 |
| [`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md) | 抽音 / FFmpeg Layer A–C + 手工 |
| [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) | **全量回归首选**：P0/P1、baseline、排障 |
| [`RELEASE.md`](./RELEASE.md) | 人类可读发版流程摘要 |

根目录还有：[`CONTRIBUTING.md`](../CONTRIBUTING.md)、[`SECURITY.md`](../SECURITY.md)。

### 测试文档怎么读（固定顺序）

| 顺序 | 文档 | 何时打开 |
|------|------|----------|
| 1 | [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) | 发版、全量回归、**§1.5 签字** |
| 2 | [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md) | 查 E2E 套件名 / 单跑 |
| 3 | [`TESTING_PRICING.md`](./TESTING_PRICING.md) / [`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md) | 改计价 / 改抽音 |
| 4 | [`TESTING.md`](./TESTING.md) | 改工坊/画布：看 §3 覆盖矩阵（勿通读） |

**三句话**：`compile` → 发版 `verify:all` → 偶发红了看 CHECKLIST §5（baseline §0.5 应全绿）。

---

## 3. 业务文档（仓外，README 链接依赖）

跨客户端与管理后台的流程文档位于 **与 `haode-ai-client` 同级** 的目录：

```
cangku/
├── haode-ai-client/     ← 本仓库
└── docs/business/      ← 业务流程 Markdown
```

**只 clone 客户端仓库时**，上述相对路径 `../docs/business/` 不可用。可选方案：

1. **同级 clone**：在 `haode-ai-client` 的父目录再拉取含 `docs/business` 的 monorepo / 文档仓  
2. **团队内网文档站**：将 business 目录同步到可读 URL，在 README 中替换链接  
3. **后续 submodule**：将 `docs/business` 以 git submodule 挂入本仓（需团队决策）

索引入口：[`../docs/business/README.md`](../docs/business/README.md)（同级目录存在时有效）。

Agent 涉及账户、认证、错误码时：**Tier 2 只读 1 篇** business 模块（`rg` 定位 §），禁止通读全集。读/写规则见 [business README §Agent 文档维护](../docs/business/README.md#agent-文档维护读-vs-写)。

---

## 4. 文档维护速查（人类 PR）

| 改动 | 更新 |
|------|------|
| 业务行为/API/错误码 | `docs/business/NN-*.md`（1 篇）+ 必要时 appendix 追加行 |
| IPC | `docs/ARCHITECTURE.md` §3 |
| 仅样式/内部重构 | 通常不改 doc |

---

## 5. Agent 与工程配置（`.cursor/`）

| 路径 | 用途 |
|------|------|
| `.cursor/rules/*.mdc` | 编辑时自动注入的代码规范 |
| `.cursor/skills/release-ship/` | 发版唯一 checklist（Agent） |
| `.cursor/skills/local-auth-mode/` | 本地模式 / 跳过登录 |
| `.cursor/skills/task-routing/` | 任务 Tier 判定 |
| `.cursor/bugs/BUG-REGISTRY.md` | 配置类 bug 登记 |

---

## 6. CI 说明

本仓库托管在 **Gitee**（`https://gitee.com/honden/haode-ai-client`），**未配置**远端 CI。质量门禁以本地脚本为准：

- 日常：`npm run compile`
- **发版自动化 + 签字**：[`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) §1.5 · `verify:all`
- 测试文档阅读顺序：见 [`README.md`](./README.md)「测试文档怎么读」
- UI 冒烟：`npm run verify:ui`（需 dev；Win 发版强烈建议，不挡签字）
- 正式发版：见 [`RELEASE.md`](./RELEASE.md)

详见 [`TESTING.md`](./TESTING.md)。
