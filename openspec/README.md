# OpenSpec

本目录采用 [OpenSpec](https://github.com/Fission-AI/OpenSpec) 规格驱动约定，用于记录**当前真源规格**与**进行中的变更**。

## 结构

```text
openspec/
├── config.yaml                 # 项目上下文与写作规则
├── specs/                      # 已落地能力的规格真源
│   └── toolbox/spec.md
└── changes/                    # 进行中的变更
    └── add-toolbox-script-create/
        ├── proposal.md         # Why / What / 指标
        ├── design.md           # 技术决策 + **Product UX 交互说明**
        ├── tasks.md            # Phase 0/1 勾选任务
        └── specs/
            ├── toolbox/spec.md
            └── toolbox-script-create/spec.md
```

## 当前变更

| Change ID | 标题 | 状态 |
|-----------|------|------|
| `add-toolbox-script-create` | 工具箱 · 剧本创作 | 提案+UX 已就绪，待实现 |

**阅读顺序**：`proposal.md` → `design.md`（含状态机与文案）→ `tasks.md` → `specs/**`。

### 产品要点（剧本创作）

- 一句话：用一句话生成能拍的短剧剧本，满意就送进创作工坊接着做
- 默认空态单栏 + 条件芯片折叠；结果只读摘要 + 全文真源
- 主 CTA：送入创作工坊；不做剧本库 / 不做第二个工坊

## 与产品文档关系

| 文档 | 职责 |
|------|------|
| `docs/PROJECT_BLUEPRINT.md` | 产品范围与模块地图 |
| `docs/ARCHITECTURE.md` | IPC / 分层 |
| `openspec/specs/*` | 可验收行为规格 |
| `openspec/changes/*` | 单次变更 Why/What/How/UX/Tasks |

实现完成后：将 delta 合并进 `openspec/specs/`，并归档对应 change（按团队流程）。

## 命令（可选）

```bash
openspec list
openspec validate add-toolbox-script-create
openspec show add-toolbox-script-create
```

未安装 CLI 时，直接以 Markdown 作为实现与评审依据即可。
