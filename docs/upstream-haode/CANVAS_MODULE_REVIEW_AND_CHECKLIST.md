# 画布模块审查与功能清单

> 更新日期：2026-07-08  
> 范围：`/canvas`、`/canvas/:projectId`、`src/components/canvas/`、`src/lib/canvas/`、`electron/main/ipc-canvas.ts`  
> 目的：沉淀画布创作模块的问题、设计边界、完整能力清单与后续优化路线。

---

## 1. 模块定位

画布模块是**独立**创作工作区，与创作工坊并行存在，不共享项目生命周期。

当前合理定位：

- 创作工坊：剧本、资产、分镜、批量生图、生视频、剪映导出。
- 画布：从列表新建项目、节点编排、局部改图/改视频、Agent 辅助、成片/剪映导出。
- 数据语义：两模块仅共享登录、组织、模型、任务中心等基础设施；**不做**工坊→画布导出、双向 link 或回写（旧磁盘 `canvasLink`/`workflowLink` 只读忽略）。

---

## 2. 已实现能力清单

### 2.1 项目与存储

- [x] 画布项目列表、创建、编辑标题/描述、删除。
- [x] Electron IPC 持久化 `projects.json` 与 `cv_xxx/data.json`。
- [x] 无 Electron 环境下提供 dev preview/sessionStorage 镜像。
- [x] 从磁盘扫描恢复旧 `cv_` 项目。
- [x] 项目封面自动从节点输出图同步，支持手动封面开关。

### 2.2 画布编辑器

- [x] React Flow 无限画布。
- [x] 节点拖拽、框选、多选、删除。
- [x] 连线、连接尾部快速加节点、边删除。
- [x] 双击/右键添加节点。
- [x] 浮动工具栏、视口工具栏、MiniMap。
- [x] 撤销/重做、复制/粘贴。
- [x] 清空画布确认弹窗。
- [x] 全屏模式。

### 2.3 节点类型

- [x] 文本/分镜 Prompt 节点。
- [x] 参考图节点。
- [x] 图片节点。
- [x] 视频节点。
- [x] 音色节点。
- [x] 分组节点。
- [x] 导出资产只读区节点。

### 2.4 图片创作

- [x] 图片节点 AI 生图。
- [x] 引用上游参考图与 `@` 引用资产。
- [x] 角色/场景/道具资产角色。
- [x] 图片名称、资产类型标签。
- [x] 主体视角、打光等工具参数。
- [x] 宫格图拆分。
- [x] 局部擦除等图像工具入口。
- [x] 保存生成图到画布项目目录。

### 2.5 视频创作

- [x] 视频节点 AI 生视频。
- [x] 项目级视频参数面板。
- [x] 首帧/尾帧/文本生视频等参考模式。
- [x] 微视模型确认弹窗与参考素材预处理。
- [x] 远端视频任务快照。
- [x] 关软件后恢复轮询。
- [x] 本页任务抽屉与全局任务面板整合。
- [x] 成功视频可参与成片/剪映导出。

### 2.6 Agent

- [x] 画布 Agent 侧栏。
- [x] 选中节点作为对话引用。
- [x] 自然语言改图/改视频/重跑选中节点。
- [x] Agent 可引用画布节点摘要。

### 2.7 导出（画布侧）

- [x] 画布导出成片 v1。
- [x] 画布导出至剪映草稿。
- [x] 素材库可引用历史工坊资产（`importWorkflowProjectId` 等只读溯源字段，非运行时联动）。

> **2026-07-08**：已移除 Step4「导出到画布 / 更新画布 / 进入画布精修」及 `workflowLink`/`canvasLink` 双向记录；相关 E2E 套件与原联动 Spec 文档一并下线。

---

## 3. 主要问题与漏洞

> **2026-07-06 代码对照结论**：本节 P0 中约 2/3 已在当前分支落地；下文按「状态 + 落点 + 验收」重写，便于逐步改动。

### P0 总览

| ID | 主题 | 状态 | 关键落点 |
|----|------|------|----------|
| P0-1 | `videoParams` 持久化 | ✅ 已修复 | `src/lib/canvas/canvas-data-persist.ts`、`canvas-video-params-sync.ts` |
| P0-2 | IPC `projectId` 防穿越 | ✅ 已修复 | `electron/main/ipc-canvas.ts`、`storage-path-utils.ts` |
| P0-3 | 自动保存 vs 任务写盘合并 | 🟡 部分完成 | `mergeCanvasProjectDataForPersist`、`persistCanvasDataMerged` |
| P0-4 | 运行中节点删除保护 | ✅ 已修复 | `canvas-data-persist.ts`、`canvas-editor-context.tsx` |
| P0-5 | P0 回归脚本入 CI/文档 | ✅ 已接入 | `npm run test:canvas-p0`（含 `test-canvas-shot-utils.mjs`） |

---

### P0-1：项目级 `videoParams` 可能丢失 — ✅ 已修复

**原现象**：`normalizeCanvasData` 只保留 `version/nodes/edges/viewport`，丢 `videoParams`。

**当前实现**：

- 读盘/写盘统一走 `normalizeCanvasProjectDataFromDisk`（`canvas-data-persist.ts`）。
- `videoParams` 经 `sanitizeCanvasVideoProjectParamsFromDisk` 结构清洗（`canvas-video-params-sync.ts`）。
- IPC `canvas:read-data` / `canvas:write-data` 均调用上述 normalize（`ipc-canvas.ts` L134–146、L353）。
- 浏览器 dev 的 `sessionStorage` 镜像读写同样 normalize（`canvas-service.ts` L94–109）。

**验收标准**：

```bash
node scripts/test-canvas-p0-checklist.mjs
# 应通过：「normalizeCanvasData 保留 videoParams」「无 videoParams 时不注入空对象」
```

**手动冒烟**：

1. 画布参数面板改模型/比例/时长 → 等自动保存（约 1.2s）。
2. 完全退出应用再打开同一项目 → 参数面板值与改前一致。

**剩余注意**：任意直接 `writeCanvasData` 且内存快照未带 `videoParams` 的调用方，仍可能覆盖磁盘参数；新增全量写入口须自查并带上 `videoParams`。

---

### P0-2：IPC `projectId` 缺少显式路径约束 — ✅ 已修复

**原现象**：`projectDir(root, projectId)` 直接 `path.join`，删除时可 `fs.rm` 误伤。

**当前实现**：

- `isCanvasProjectDirName`：`^cv_[a-zA-Z0-9_-]+$`，拒绝 `..`、斜杠（`storage-path-utils.ts`）。
- `assertCanvasProjectId` + `resolveSafeProjectDir`：`path.resolve` 后校验必须在 canvas root 前缀内（`ipc-canvas.ts` L34–51）。
- 以下 handler 均已校验：`delete-project`、`read-data`、`write-data`、`update-project`、`get-project`、`backup-data`。
- 删除前 `resolveSafeProjectDir` 再 `fs.rm`（L300–311）。

**验收标准**：

```bash
node scripts/test-canvas-p0-checklist.mjs
# 应通过：「合法 canvas projectId」「拒绝非法 projectId」「resolveSafeCanvasProjectDir 拒绝越界路径」
```

**剩余加固（可选，P0 尾项）**：

- [ ] `dataFilePath` / `ensureProjectLayoutDirs` 内部仍用裸 `projectDir`；`create-project` 虽用 `cv_${uuid}`，建议统一改调 `resolveSafeProjectDir`（纵深防御）。
- [ ] preload 层对 `projectId` 做同样格式校验，错误尽早返回 renderer。

---

### P0-3：自动保存与后台任务写盘覆盖窗口 — 🟡 部分完成

**现象**：1200ms 自动保存与视频任务 `patchCanvasData` 并发写同一 `data.json`。

**已实现**：

- `patchCanvasData` 按 `projectId` 串行写锁（`canvas-service.ts` L145–166）。
- 自动保存走 `persistCanvasDataMerged` → `mergeCanvasProjectDataForPersist`（`canvas-editor-page.tsx` L201）。
- 合并策略：内存优先 `nodes/edges/viewport`；`videoParams` 取 `memory ?? disk`；节点运行态字段（`status/remoteJob/progressMessage/outputPath/...`）按时间戳与 active 状态从磁盘回补（`canvas-data-persist.ts` L69–84）。

**仍存在的缝隙**：

| 写盘路径 | 是否 merge | 风险 |
|----------|------------|------|
| 编辑器自动保存 | ✅ merge | 低 |
| `canvas-video-task-service` / `canvas-project-run-bridge` | ✅ `patchCanvasData` | 低 |
| IPC `canvas:write-data` 被直接调用 | ❌ 全量 normalize 写 | 低（renderer 已统一 patch） |

**建议后续步骤（你逐步改时可拆 PR）**：

1. [ ] **Step A**：`canvas:write-data` 改为 read → merge → write（与 renderer `patchCanvasData` 同策略）。
2. [ ] **Step B**：为 `data.json` 增加顶层 `updatedAt`，merge 时比较版本（可选）。
3. [ ] **Step C**：补集成测试：模拟「自动保存 + 任务进度 patch」交错，断言 `remoteJob` 不被旧快照覆盖。

**验收脚本（已有）**：

```bash
node scripts/test-canvas-p0-checklist.mjs
# 「自动保存合并保留磁盘 videoParams」
```

---

### P0-4：运行中节点删除/清空保护 — ✅ 已修复

**原现象**：清空画布有 `hasRunningNodes` 禁用，单删/多选删未检查。

**当前实现**：

- `isCanvasNodeRuntimeBusy` / `collectBusyCanvasNodeLabels`（`canvas-data-persist.ts` L110–144）。
- `requestRemoveNodeIds` 拦截运行中节点 → `pendingDelete` 二次确认（`canvas-editor-context.tsx` L733–752）。
- UI 文案区分运行中（`canvas-workflow.tsx` L453–464）：提示远端任务不会自动取消。

**验收标准（手动）**：

1. 视频节点生成中 → Delete / 多选删除 → 弹出确认，列出生成中节点名。
2. 确认后节点删除，任务抽屉仍可追踪或给出合理提示（按现有任务桥接行为）。
3. 清空画布在 `hasRunningNodes` 时按钮仍禁用。

**可选增强（P1 降级）**：

- [ ] 后端支持取消时，删除确认弹窗增加「尝试取消远端任务」。

---

### P0-5：P0 回归脚本接入工程习惯 — ✅ 已接入（fixtures 去重待做）

**现状**：

- `npm run test:canvas-p0` 已写入 `package.json`，并纳入 `npm run verify:full`。
- `docs/TESTING.md` §0 / §3、`docs/FULL_REGRESSION_CHECKLIST.md` 已索引。
- `scripts/lib/canvas-p0-fixtures.mjs` 与 `src/lib/canvas/canvas-data-persist.ts` **逻辑仍重复**，长期可能漂移（Step 3 可选）。

**验收**：`npm run test:canvas-p0` 全绿；发版前跑 `npm run verify:full`。

---

### P1（原 §3 其余项，非 P0，保留摘要）

#### P1：再导出仍是全量替换（已取消）

> 随工坊↔画布联动移除；画布 `data.json` 仅在本模块内编辑与自动保存。

#### P1：终稿主数据源提示（已取消）

> 两模块独立，不再区分「终稿源」。

#### P1：运行中节点删除

- 已提升至 P0-4 ✅；取消远端任务为增强项。

#### P2：完整功能清单入口

- 本文即索引；新 Phase 优先追加 §2 / §4。

---

## 4. 建议补齐的功能清单

### 4.1 P0 稳定性

- [x] 保留并校验 `CanvasProjectData.videoParams`（P0-1，`canvas-data-persist.ts`）
- [x] IPC `projectId` 校验与路径防穿越（P0-2，`ipc-canvas.ts`）
- [x] 删除项目路径安全保护（`resolveSafeProjectDir` + `fs.rm`）
- [x] 自动保存与任务 patch 写盘合并策略（P0-3 主体，`mergeCanvasProjectDataForPersist`）
- [x] 运行中节点删除保护（P0-4，二次确认弹窗）
- [x] P0 回归脚本接入 `npm run test:canvas-p0` + `verify:full` + `docs/TESTING.md`（P0-5）
- [ ] `canvas:write-data` read-merge-write 加固（P0-3 尾项）
- [ ] `dataFilePath` / `ensureProjectLayoutDirs` 统一走安全路径解析（P0-2 尾项）
- [ ] 视频任务恢复状态与节点状态一致性回归测试（P0-3 Step C，待补脚本）

### 4.1.1 P0 分步改动顺序（你说一步我做一步）

按风险与依赖排序，建议顺序：

| 顺序 | 你说 | 我做 | 验收 |
|------|------|------|------|
| 1 | 「做 P0-5 Step 1」 | `package.json` 加 `test:canvas-p0` | `npm run test:canvas-p0` 全绿 |
| 2 | 「做 P0-5 Step 2」 | 更新 `docs/TESTING.md` | 文档可查命令 |
| 3 | 「做 P0-2 尾项」 | `dataFilePath` 等改 `resolveSafeProjectDir` | 编译 + P0 脚本 |
| 4 | 「做 P0-3 Step A」 | IPC `write-data` read-merge-write | 手测并发保存 |
| 5 | 「做 P0-5 Step 3」 | 去掉 fixtures 重复实现 | 单源逻辑 |
| 6 | 「做 P0-3 Step C」 | 补任务/自动保存交错回归脚本 | CI 可跑 |

未列入 P0、但 Sprint 1 原计划的 **运行中删除**、**videoParams**、**路径校验** 已在代码中完成，无需重复做。

### 4.2 P1 用户心智

- [ ] 画布导出成片前展示排序、缺失视频、输出路径。

### 4.3 P1 编辑效率

- [ ] 节点搜索/定位。
- [ ] 按镜号筛选/聚焦。
- [ ] 一键折叠/展开分组。
- [ ] 节点批量改名。
- [ ] 批量替换模型/比例/视频参数前预览影响。
- [ ] 运行失败节点一键重试。
- [ ] 只重跑选中镜头的图片/视频。

### 4.4 P1 资产与媒体治理

- [ ] 未引用媒体扫描。
- [ ] 媒体体积统计。
- [ ] 清理孤儿文件。
- [ ] 导出产生的重复媒体识别。
- [ ] 文件缺失时节点明确展示「文件丢失」而不是空预览。
- [ ] 外部移动 dataRoot 后的路径修复向导。

### 4.5 P2 增量更新（已取消）

> 原「工坊再导出 merge / dirty 节点」路线随工坊↔画布联动移除而取消；画布节点仅在本模块内演进。

### 4.6 P2 回写工坊（已取消）

> 不再规划画布→工坊回写；两模块数据独立。

### 4.7 P2 Agent 能力

- [ ] Agent 操作前成本预估。
- [ ] Agent 批量改图/改视频前列出节点清单。
- [ ] Agent 修改 prompt 时提供 diff。
- [ ] Agent 生成失败后给出可操作修复建议。
- [ ] Agent 记住当前项目上下文，但不跨项目污染引用。

---

## 5. 推荐优化路线

### Sprint 1：先堵漏洞（对照 2026-07-06）

1. ~~修复 `videoParams` 持久化。~~ ✅ P0-1
2. ~~补 IPC projectId 与路径安全校验。~~ ✅ P0-2
3. ~~删除/清空运行中节点保护。~~ ✅ P0-4
4. **进行中**：P0 回归脚本接入 + P0-3 尾项加固（见 §4.1.1 分步表）。

### Sprint 2：降低误操作成本

1. 导出/写盘前 `canvas:backup-data` 备份（已有 IPC）。
2. 成片/剪映导出前做缺失项预检。（待做）

### Sprint 3：~~增量更新~~（已取消，见 §4.5）

---

## 6. 文档归属建议

画布模块的专项审查与功能清单放在本文最合适：

```
docs/CANVAS_MODULE_REVIEW_AND_CHECKLIST.md
```

原因：

- 它覆盖画布自身能力、风险、验收与路线图，适合作为后续迭代总入口。
- 工坊与画布已解耦，不再维护单独的联动 Spec 文档。

当后续某项进入实现阶段时，再按主题拆更细文档或 issue：

- 画布自身能力：继续维护本文。
- 跨模块架构/API：同步更新 `docs/ARCHITECTURE.md`。
- 验证脚本：同步更新 `docs/TESTING.md`；P0 见 `npm run test:canvas-p0`；全量见 `npm run verify:full`。
