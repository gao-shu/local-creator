# 本地漫创 · 文档索引

面向：**人**（勾选执行）与 **AI**（按阶段改代码）。  
工作区约定：Cursor 可继续打开 `haode-ai-client`，**只往本仓 `local-creator` 写文件**；读参考时用相对路径 `../haode-ai-client`。

## 阅读顺序

| 顺序 | 文档 | 用途 |
|------|------|------|
| 1 | [00-decisions.md](00-decisions.md) | 已拍板事项，改范围先改这里 |
| 2 | [01-vision.md](01-vision.md) | 产品愿景：开源版 / 商业版 / 与公司脱离 |
| 3 | [02-phases-overview.md](02-phases-overview.md) | 阶段总览与依赖 |
| 4 | [AGENT.md](AGENT.md) | AI 执行规范（禁止事项、验收、对照只读） |
| 5 | [delete-inventory.md](delete-inventory.md) | 须删除的公司耦合清单（开源前必清） |
| 6 | [brand-placeholder.md](brand-placeholder.md) | 占位品牌与正式改名检查表 |
| 7 | [phases/](phases/) | **分阶段细操作步骤**（主战场） |
| — | [user-quickstart.md](user-quickstart.md) | 熟人私发：安装与填 Key 一页 |
| — | [release-private.md](release-private.md) | 私有发版：升版 / 打包 / 网盘 / 更新预留 |
| 8 | [appendix-open-source.md](appendix-open-source.md) | 开源发布前清单（后期） |
| 9 | [appendix-commercial.md](appendix-commercial.md) | 商业版备注（后期，另仓或分支策略） |

## 阶段文件

| 阶段 | 文件 | 一句话 |
|------|------|--------|
| P0 | [phases/P0-docs-ready.md](phases/P0-docs-ready.md) | 文档与仓库规矩就位（当前） |
| P1 | [phases/P1-import-code.md](phases/P1-import-code.md) | 从 haode-ai-client 导入代码 |
| P2 | [phases/P2-delete-company.md](phases/P2-delete-company.md) | **删除**公司后台/好豆/系统模型等 |
| P3 | [phases/P3-local-runtime.md](phases/P3-local-runtime.md) | 纯本地运行时（模型自配、无云登录） |
| P4 | [phases/P4-brand-shell.md](phases/P4-brand-shell.md) | 占位换名/图标/壳（不对外） |
| P5 | [phases/P5-package-smoke.md](phases/P5-package-smoke.md) | 打包与自测 / 熟人私发 |
| P6 | [phases/P6-private-git.md](phases/P6-private-git.md) | 私有 Gitee + 日后网盘更新预留 |

**不在 L2 范围（二期）**：即梦本地桥、完全离线大模型、对外公开开源上线（见附录）。

## 指挥方式（给负责人）

每轮只说：`执行 P2` 或 `执行 P2 第 3 节`。  
AI 必须先读 `AGENT.md` + 对应 `phases/P*.md`，再改**本仓**代码。
