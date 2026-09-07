# AI 执行红线（Agent Playbook）

在 `local-creator` 执行任务时遵守。人指挥「做 Phase N」时，只读对应 `phase-N-*.md`。

## 红线

1. **不要修改** `E:\work\project\cangku\haode-ai-client` 的业务代码（除非人明确说「改公司仓」）。
2. **参考**公司仓时：只读；路径写作 `../haode-ai-client/...`。
3. **一次只做一个 Phase**；不要顺手做下一阶段。
4. 公司相关能力：**删除实现与引用**，禁止只 `if (false)` / 藏 UI 却留死代码（开源要求）。
5. **禁止**提交 `.env`、API Key、真实 SESSION、客户数据。
6. 暂不 `git push` 到公开远程，除非人明确要求且 Phase 7 已勾选。
7. 改 TS/TSX 后默认跑：`npm run compile`（迁入代码并安装依赖之后）。
8. 不擅自扩大范围（即梦本地、商业授权、重写架构）到未点名的 Phase。

## 每阶段标准流程

1. 打开该阶段 md，复述「本阶段目标」一句话给用户确认（若用户已说「执行 Phase N」可直接干）。
2. 按「操作步骤」顺序执行；每完成一大步可更新该文件中的 checkbox（若用户允许改文档）。
3. 跑「验收」命令/清单。
4. 用 Conventional Commits 在 **local-creator** 提交（仅当用户要求提交时）。
5. 汇报：做了什么、验收结果、是否可进下一阶段。

## 上下文预算

- 禁止为迁入/删除任务通读公司仓全部 docs。
- 删除类任务：用 Grep 定位符号 → 读命中文件 → 删 → compile。
- 品牌替换：维护单一 `src/constants/brand.ts`（Phase 2 建立），禁止全仓魔法字符串扩散。
