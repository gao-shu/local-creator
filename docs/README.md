# 本地漫创 · 文档索引

面向：**人**（勾选执行）与 **AI**（按阶段改代码）。  
工作区约定：Cursor 可继续打开 `haode-ai-client`，**只往本仓 `local-creator` 写文件**；读参考时用相对路径 `../haode-ai-client`。

## 阅读顺序

| 顺序 | 文档 | 用途 |
|------|------|------|
| 1 | [00-decisions.md](00-decisions.md) | 已拍板事项，改范围先改这里 |
| 2 | [01-vision.md](01-vision.md) | 产品愿景：开源版 / 商业版 / 与公司脱离 |
| 3 | [02-phases-overview.md](02-phases-overview.md) | L2 阶段总览与依赖 |
| 3b | [03-oss-gtm-overview.md](03-oss-gtm-overview.md) | **开源产品化 / 引流 / 商业化**（OA→OC）总览 |
| 3c | [oss-gtm-decisions.md](oss-gtm-decisions.md) | GTM 人拍板门禁（许可证/品牌/托管等） |
| 3d | [oss-gtm-review-rubric.md](oss-gtm-review-rubric.md) | GTM 横切审核标准与证据级别 |
| 4 | [AGENT.md](AGENT.md) | AI 执行规范（禁止事项、验收、对照只读） |
| 5 | [delete-inventory.md](delete-inventory.md) | 须删除的公司耦合清单（开源前必清） |
| 5b | [weishi-delete-inventory.md](weishi-delete-inventory.md) | **微视整域删除**清单（W0～W5；废止「微视可保留」） |
| 6 | [brand-placeholder.md](brand-placeholder.md) | 占位品牌与正式改名检查表 |
| 7 | [phases/](phases/) | **分阶段细操作步骤**（L2 主战场 + OA/OB/OC） |
| — | [user-quickstart.md](user-quickstart.md) | 熟人私发：安装与填 Key 一页 |
| — | [release-private.md](release-private.md) | 私有发版：升版 / 打包 / 网盘 / 更新预留 |
| 8 | [appendix-open-source.md](appendix-open-source.md) | 开源发布前清单（由 OA 消化「必须完成」） |
| 8b | [appendix-commercial-boundary.md](appendix-commercial-boundary.md) | 开源核 / 商业壳边界（MIT · D2） |
| — | [phases/W2b-repo-declutter.md](phases/W2b-repo-declutter.md) | 试用仓减负：去掉 deploy/website/计费探针等 |

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
| W1 | [phases/W1-weishi-product-surface.md](phases/W1-weishi-product-surface.md) | 去微视产品面（已完成） |
| W1+ | 见 [weishi-delete-inventory.md](weishi-delete-inventory.md) §5 | W2 删运行时 → W3～W5 |
| OA | [phases/OA-phase-a.md](phases/OA-phase-a.md) | 开源 GTM A：许可证/清残留/README/向导/Win 包 |
| OB | [phases/OB-phase-b.md](phases/OB-phase-b.md) | 开源 GTM B：示例/剪映/官网回流/发版节奏 |
| OC | [phases/OC-phase-c.md](phases/OC-phase-c.md) | 开源 GTM C：商业边界/扩展面/CI/第一切口 |

**不在 L2 范围**：即梦本地桥、完全离线大模型当主卖点。  
**对外公开开源**：走 OA→OC 线；勿与「L2 熟人私发」混为一谈。

## 指挥方式（给负责人）

每轮只说：`执行 P2` / `执行 OA1` / `OA1 验收` / `OA 阶段验收`。  
AI 必须先读 `AGENT.md` + 对应阶段档，再改**本仓**代码。  
开源 GTM 开工前须锁定 [oss-gtm-decisions.md](oss-gtm-decisions.md)。
