# 02 · 阶段总览

```mermaid
flowchart LR
  P0[P0 文档就位] --> P1[P1 导入代码]
  P1 --> P2[P2 删除公司耦]
  P2 --> P3[P3 本地运行时]
  P3 --> P4[P4 占位品牌壳]
  P4 --> P5[P5 打包冒烟]
  P5 --> P6[P6 私有 Git 与更新预留]
  P6 --> W0[W0 微视删除盘点]
  W0 --> W1[W1 去微视产品面]
  W1 --> W2[W2 删微视运行时]
  W2 --> W5[W5 验证]
  W5 --> D[GTM 门禁 D]
  D --> OA[OA 合法公开准备]
  OA --> OB[OB 传播与回流]
  OB --> OC[OC 商业挂钩]
```

> W0～W5 细则：[weishi-delete-inventory.md](weishi-delete-inventory.md)。P0～P6 为 L2 主线；微视为开源前追加删除域。  
> **开源产品化 / 引流 / 商业化**细档见 [03-oss-gtm-overview.md](03-oss-gtm-overview.md)（OA / OB / OC），勿与 L2 阶段号混淆。

## 阶段依赖

| 阶段 | 依赖 | 产出 | 负责人验收 |
|------|------|------|------------|
| P0 | — | 本 docs 齐套 | 决策表无歧义 |
| P1 | P0 | 本仓有可编译的应用树 | `npm install` + `npm run compile` 通过 |
| P2 | P1 | 无公司计费/系统模型/云登录主路径 | `rg` 无关键禁词 + compile |
| P3 | P2 | 本地模式为唯一默认路径 | 免登录进首页，自定义模型可调 |
| P4 | P3 | 占位品牌替换完成 | 窗口标题/安装名/闪屏为本地漫创 |
| P5 | P4 | Setup 安装包 | 本机安装能完成一条生成 |
| P6 | P5 | 私有远端说明 | 推送说明就绪；更新可先禁用 |
| W0 | P2+ | 微视删除清单 | 决策锁定；清单可勾选 |
| W1 | W0 | 无微视产品入口 | 设置无「微视」+ compile |
| W2 | W1 | 无 weishi 运行时 | `rg` 清零 + compile |
| W3～W4 | W2 | 本机默认 Agnes+拾光 | settings 无 weishi 项 |
| W5 | W4 | mock e2e + 手测 | smoke 绿；Agnes/拾光手测过 |
| 门禁 D | W5+ / L2 可用 | [oss-gtm-decisions.md](oss-gtm-decisions.md) 锁定 | D1～D5 已填 |
| OA | 门禁 D | 许可证/清残留/向导/Win 包 | [phases/OA-phase-a.md](phases/OA-phase-a.md) 阶段验收 |
| OB | OA | 示例/剪映/官网回流 | [phases/OB-phase-b.md](phases/OB-phase-b.md) 阶段验收 |
| OC | OB | 商业边界/扩展/CI/切口 | [phases/OC-phase-c.md](phases/OC-phase-c.md) 阶段验收 |

## 工作量粗估（有 AI 协助）

| 阶段 | 日历 |
|------|------|
| P0 | 已完成骨架 |
| P1 | 0.5～1 天 |
| P2 | 3～7 天（删除面最大） |
| P3 | 1～3 天 |
| P4 | 1～2 天 |
| P5 | 1～3 天（含真机坑） |
| P6 | 0.5～1 天 |

合计约 **2～3 周**量级（熟手 + AI + 你每日验收）；卡点通常在 P2 编译清理与 P5 真机。

## 并行注意

- **不要** P1 未 compile 就大幅删代码。
- **不要** P2 未完成就公开仓库。
- P4 图标可后补，先改字符串与 builder 名。
