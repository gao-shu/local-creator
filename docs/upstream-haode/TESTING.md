# 测试与质量门禁

> **更新日期**：2026-09-02  
> 本仓库**无** Jest/Vitest 单元测试套件；质量依赖编译 + 脚本化 verify + 可选安全扫描。

**全量回归（发版勾选）**：[`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) · **本文档**：改某模块时的命令百科（E2E 矩阵）  
**分册**：[`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md) · [`TESTING_PRICING.md`](./TESTING_PRICING.md) · [`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md)

---

## 0. 30 秒入口

**发版 / 全量回归只看** [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md)（**§1.5 发版签字**、baseline §0.5、排障 §5）。**baseline 已于 2026-09-02 全绿**，见 CHECKLIST §0.5。

| 目的 | 命令 |
|------|------|
| P0 Mock 主线 | `npm run verify:full` |
| P1 专项 | `npm run verify:p1` |
| **发版推荐** | `npm run verify:all` |
| 仅 E2E | `npm run verify:e2e` |
| 浏览器 UI（需 dev） | `npm run verify` |

- **发版签字**：CHECKLIST **§1.5**（baseline 见 §0.5，2026-09-02 应全绿）
- **跳过 env / P1 避免重复 E2E**：CHECKLIST §1–2  
- **未进 verify:all 的脚本**：CHECKLIST §6  
- **计价去重**：见 [`TESTING_PRICING.md`](./TESTING_PRICING.md) §1

---

## 1. 日常开发

| 命令 | 何时跑 | 说明 |
|------|--------|------|
| `npm run compile` | **每次改代码后** | electron-vite 生产模式编译，Tier 1 最低门槛 |
| `npm run lint` | 提交前（建议） | ESLint |
| `npm run dev` | 本地调试 | 记下终端 `Local:` 端口（被占用时会变） |
| 抽音 / FFmpeg / `ipc-media` | 改相关代码后 | 见 [`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md) |

---

## 2. UI 冒烟（`verify:ui`）

```bash
# 终端 A
npm run dev

# 终端 B（PowerShell 示例）
$env:UI_BASE_URL="http://localhost:<端口>"
npm run verify:ui
```

- 脚本：`scripts/verify-ui.mjs`（Playwright）
- 覆盖：`#/login`、`#/dashboard`、`#/workshop`、`#/canvas`（含 dev preview）、`#/settings`、`#/materials`、工坊 step 1~4 预览路由
- 默认 `UI_BASE_URL=http://localhost:15173`
- 本地模式（未设 `VITE_LOGIN_REQUIRED=true`）时 `#/login` 可接受重定向到 dashboard（「欢迎回来」）

聚合命令：`npm run verify` = `compile` + `verify:ui`。

**Tier 3 / Phase 交付**：必须 compile + dev + verify:ui 通过（见 `CURSOR_REPLICATION_GUIDE.md` §0.4）。

---

## 3. Electron E2E（推荐 · 真环境自动化）

**主入口**：`scripts/e2e/run.mjs`（Playwright `_electron` + 隔离数据目录 + mock AI）

**套件数**：`npm run test:e2e:list` 当前 **46** 个（含 P1 列表三件套；以 `register-suites.mjs` 为准）。

**偶发失败 / 超时**：见 CHECKLIST §5（上述套件已于 2026-09-02 加固；仍红则单套件重跑）。

### 3.1 日常怎么用

| 你改了什么 | 跑什么 |
|-----------|--------|
| 任意 TS/业务逻辑 | `npm run compile` |
| 路由 / 壳层 / 侧栏 | `npm run verify:e2e:smoke` 或 dev + `verify:ui`（§2） |
| 工坊主流程 Step1–4 | `npm run verify:e2e:workshop` |
| 项目新建 / 编辑 / 删除 / 列表 | `test:e2e:project`、`test:e2e:lifecycle`、`test:e2e:p1` |
| Step4 工作台 / 分镜编辑 | `test:e2e:step4-workbench`、`test:e2e:phase4-c` |
| 剪映导出（工坊 / 画布） | `test:e2e:phase6-a` 或单批 `phase6-a-a`~`d` |
| 画布（19 套件子集） | `verify:e2e:canvas-full` 或 `test:e2e:canvas-phase1`~`phase4` |
| 全局素材库 / 音色库 | `npm run verify:global-libraries` |
| P0 三件套（重启 / 任务 / mock 失败） | `npm run test:e2e:p0` |
| 发版前 / 大改后 | CHECKLIST：`verify:full` / `verify:all`；仅 E2E：`verify:e2e` |

> `verify:e2e:workshop` = `workshop-flow` + `workshop-from-scratch`，**不等于**全量 46 套件。  
> 历史 Phase 别名见 **§3.6**；**46 套件速查**见 [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md)。

```bash
npm run test:e2e:list       # 列出 46 套件
npm run verify:e2e          # compile + 全部 E2E
node scripts/e2e/run.mjs <套件名>   # 单套件（需已 compile）
# 失败排障：CHECKLIST §5 / E2E_INDEX §3
```

**Mock 模式**：Electron 启动时注入 `HAODE_E2E_MOCK_AI=1`，走 mock 生图/生视频/LLM，**不调用真实 API**。适合主流程与状态/落盘回归，**不能**替代真实模型、上传、扣费、失败码验证。

### 3.2 工坊覆盖矩阵

| 能力 | 套件 | 状态 |
|------|------|------|
| **壳层与项目** | | |
| Electron 启动 / 路由 / IPC | `smoke` | ✅ |
| 新建项目 + 进入 Step1 | `workshop-project-create` | ✅ |
| 编辑项目标题 + 落盘 | `workshop-project-lifecycle` | ✅ |
| 删除项目 + `projects.json` | `workshop-project-lifecycle` | ✅ |
| 项目列表搜索 / 分页 | `workshop-project-list-search` | ✅ E2E |
| 空数据根 / 便携存储路径 | `workshop-missing-data-root` | ✅ E2E |
| 组织项目创建模式 | — | ⏳ 客户端已弱化；E2E 暂不覆盖 |
| **Step1~2** | | |
| 编辑剧本 / 手动保存 / 下一步 | `workshop-flow` | ✅ |
| Step1 导入文件 | `workshop-step1-import` | ✅ E2E |
| Step2 AI 分集（mock） | `workshop-from-scratch` | ✅ |
| Step2 提取资产 | `workshop-flow` | ✅ |
| Step2 dirty 未保存 →「保存并继续」→ 提取 | `workshop-step2-episode-plan` | ✅ |
| Step2 单集编辑后提取 content 不丢失 | `workshop-step2-episode-plan` | ✅ |
| Step2 全文预览 Tab（与本集脚本分离） | `workshop-step2-episode-plan` | ✅ |
| 多集 Tab 切换 + 预览 | `workshop-multi-episode` | ✅ |
| 手动多集提取后仍为多集 | `workshop-multi-episode` | ✅ |
| Step2 AI 分集重建资产确认 | `workshop-flow` / `workshop-from-scratch` | ✅ |
| **Step3** | | |
| 批量生图 | `workshop-flow` / `from-scratch` | ✅ |
| 批量重新生成 | `workshop-step3-regenerate` | ✅ |
| 单资产编辑 / 删除 | `workshop-step3-asset-crud` | ✅ E2E |
| 从全局素材库导入 | `workshop-step3-material-import` | ✅ |
| 保存/更新到全局素材库 | `workshop-step3-material-save` | ✅ |
| 导入 picker「已在项目」防重复 | `workshop-step3-material-save` | ✅ |
| **Step4** | | |
| 推理分镜（mock） | `workshop-from-scratch` | ✅ |
| 已有分镜时推理覆盖确认 | `workshop-step4-workbench` | ✅ |
| 分集剧本编辑落盘（与 Step2 同步） | `workshop-step4-workbench` | ✅ |
| 文案放大编辑窗 / 切镜 | `workshop-step4-workbench` | ✅ |
| 从素材库选择分镜参考图 | `workshop-step4-material-reference` | ✅ |
| 分镜生图 / 生视频（mock） | `workshop-flow` / `from-scratch` | ✅ |
| 停止生图 / 生视频 | `workshop-generation-stop` | ✅ |
| 关闭 Electron 再打开同一项目 | `workshop-restart-persistence` | ✅ |
| 步骤往返 + 剧本持久化 | `workshop-flow` | ✅ |
| 分镜增删 / 改 prompt | `workshop-shot-edit` | ✅ E2E |
| 插入分镜 / 删镜滚动等增强 | — | ⏳ P2 |
| 批量生视频 | `workshop-step4-batch-video` | ✅ E2E |
| 视频参考图规则 | — | ⏳ P1（**微视开白路径弱化，不优先补测**） |
| 剪映导出（工坊 / 画布） | `workshop-capcut-export` + `canvas-capcut-export` + 无成片拦截套件 | ✅ E2E |
| **任务与持久化** | | |
| 任务面板「已完成」筛选 | `workshop-flow` / `from-scratch` | ✅ |
| 任务面板「进行中」+ 终止 | `workshop-task-panel-actions` | ✅ |
| 任务面板删除历史任务 | `workshop-task-panel-actions` | ✅ |
| 读 `data.json` / `tasks.json` 落盘 | 多个套件 | ✅ |
| **失败与真实集成** | | |
| Mock 注入失败（429 + UI 恢复） | `workshop-mock-failure`（`HAODE_E2E_MOCK_FAIL`） | ✅ |
| Mock 部分成功 / 超时 / 资产生图失败 | — | ⏳ P1 |
| 生成中切 Step / 快速连点 | `workshop-step-nav-during-generation` | ✅ E2E |
| 真实 API 最小图+短视频（`LIVE`） | — | ⏳ P2（不进 CI，发版前人工） |

**图例**：✅ 已有套件覆盖 · ⏳ 待补（P0 优先 · P1 增强 · P2 真实集成）

### 3.3 全局素材库 / 音色库覆盖矩阵

> 数据根级 `materials.json` + `voice-library/`；**索引模式**仅存项目相对路径，不复制全局 `materials/assets/` 副本。

| 能力 | 套件 / 脚本 | 状态 |
|------|-------------|------|
| 路径解析 / 索引读写 remap | `test:global-libraries`（`scripts/test-global-libraries.ts`） | ✅ |
| 无效条目判定 / 同步按钮文案 | `test:global-libraries` | ✅ |
| `materials:read` / `voice-library:list` IPC | `global-libraries-smoke` | ✅ |
| 遗留 `materials/assets/` 路径迁移 | `global-libraries-smoke` | ✅ |
| 软删来源项目过滤 | `global-libraries-smoke` | ✅ |
| `#/materials` 无效条目清理 UI | `global-libraries-smoke` | ✅ |
| Step3 picker 导入到当前项目 | `workshop-step3-material-import` | ✅ |
| Step3 保存/更新到素材库 | `workshop-step3-material-save` | ✅ |
| Step3 导入「已在项目」防重复 | `workshop-step3-material-save` | ✅ |
| Step4 分镜参考图从素材库落盘 | `workshop-step4-material-reference` | ✅ |
| 画布图片节点保存/更新（索引路径） | `canvas-image-material-save` | ✅ |
| 画布保存不写全局副本目录 | `canvas-image-material-save` | ✅ |

**日常入口**：

```bash
npm run verify:global-libraries   # compile + 纯逻辑 15 项 + E2E 五件套
npm run test:e2e:global-libraries-all   # 仅 E2E（需已 compile）
```

**单套件调试**（需已 `npm run compile`）：

```bash
npm run test:e2e:global-libraries
npm run test:e2e:step3-material-import
npm run test:e2e:step3-material-save
npm run test:e2e:step4-material-reference
npm run test:e2e:canvas-material-save
node scripts/debug-canvas-material-save-e2e.mjs   # 画布保存 E2E 逐步诊断
```

**改画布图片节点顶栏 / 保存素材库后回归**：`test:e2e:canvas-material-save` + `test:global-libraries`（`isCanvasImageNodeSyncedToMaterialLibrary` 等纯逻辑）。

### 3.4 Step4 主闭环 — 手动清单（约 10 分钟）

> 对应用户主路径：**填写剧本 → 推理分镜 → 改文案 → 生图 → 审核 → 生视频 → 导出**  
> 自动化：`npm run test:e2e:step4-workbench` + `npm run test:e2e:phase4-b` + `npm run test:e2e:workshop`

**前置**：E2E mock 或 dev 模式；预置/新建项目并完成 Step2 分集与 Step3 资产（至少 1 角色图）。

| # | 步骤 | 预期 |
|---|------|------|
| 1 | Step4 左栏「剧本参考」→ 编辑分集剧本 → 保存 | 写入 `episode.content`，与 Step2 同步 |
| 2 | 已有分镜时点 **推理分镜** | 弹出「重新推理分镜？」；取消后镜头保留 |
| 3 | 点镜头 **展开** → 改 prompt → 上一镜/下一镜 | 放大窗编辑落盘；Esc 关闭 |
| 4 | **生成分镜图** → 中栏预览 | 生成中 busy 态；完成后预览更新 |
| 5 | **审核分镜图**（非微视模型时可跳过；微视开白**不纳入**发版必测） | 可选：通过后参考图写入 |
| 6 | **生成视频** → 右栏视频 Tab | 参数生效；任务面板可见进度 |
| 7 | **导出至剪映** | 有成片可导出；无成片 toast 拦截 |
| 8 | 切 Step2 再回 Step4 | 分镜、剧本、生成图/视频仍在 |

**改 Step4 编辑/推理/参考区后回归**：

```bash
npm run compile
npm run test:e2e:step4-workbench
npm run test:e2e:phase4-c
```

### 3.5 画布覆盖矩阵

| 能力 | 套件 | 状态 |
|------|------|------|
| **壳层与项目** | | |
| 画布列表搜索 + 进入编辑器 | `canvas-list-smoke` | ✅ E2E |
| 新建画布 + 落盘 + 进编辑器 | `canvas-project-create` | ✅ |
| 编辑标题 + 删除画布项目 | — | ⏳ 工坊有 `workshop-project-lifecycle`；画布暂无 |
| **编辑器** | | |
| 浮动工具栏添加节点 + 自动保存 | `canvas-editor-flow` | ✅ |
| 重启后节点持久化 | `canvas-restart-persistence` | ✅ |
| mock 图片节点生图 + 落盘 | `canvas-image-generate` | ✅ |
| 停止 mock 生图 | `canvas-generation-stop` | ✅ |
| 画布助手侧栏 smoke | `canvas-agent-smoke` | ✅ |
| mock 视频节点生视频 + 落盘 | `canvas-video-generate` | ✅ |
| mock 生图失败 + UI 恢复 | `canvas-mock-failure` | ✅ |
| 画布助手 mock 对话 | `canvas-agent-chat` | ✅ |
| 图片节点保存/更新到全局素材库 | `canvas-image-material-save` | ✅ |
| 剪映导出 / 无成片拦截 | `canvas-capcut-export` / `canvas-capcut-no-clips` | ✅ |
| **UI** | | |
| 列表 + 编辑器布局 / 圆角 / 侧栏 | `verify:canvas-ui`（dev + Playwright） | ✅ |
| **P0 逻辑** | | |
| projectId 校验 / normalize / merge | `test:canvas-p0` | ✅ |
| 智能分镜 shot utils 纯函数 | `test:canvas-shot-utils` | ✅ |
| 三列布局 | `test:canvas-prompt-layout` | ✅ |
| Mock 生图/生视频 / Agent 深度 | `canvas-video-generate` / `canvas-mock-failure` / `canvas-agent-chat` | ✅ |

**画布日常入口**：`npm run verify:e2e:canvas`（Phase 1）+ 改编辑器时加 `test:e2e:canvas-phase2`；改生图/Agent 时加 `test:e2e:canvas-phase3`；改生视频/mock 失败/Agent 对话时加 `test:e2e:canvas-phase4`；画布 E2E 子集 `verify:e2e:canvas-full`（**19** 套件，为 `test:e2e` 的真子集）；UI 改动后 `npm run verify:canvas-ui`；改智能分镜/批量生成/镜号逻辑时加 `npm run test:canvas-shot-utils`；改三列布局时加 `npm run test:canvas-prompt-layout`；改队列/拖放时加 `test:canvas-logic-extra`。

### 画布智能分镜 P0 — 手动清单（约 7 分钟）

> 自动化：`npm run test:canvas-shot-utils` + `npm run test:canvas-prompt-layout` + `npm run test:canvas-p0`（聚合）。  
> 以下需在 **dev 模式** 下人工走一遍，验收分镜端到端行为。

**前置**：配置可用 LLM；本地模式可跳过登录（`VITE_LOGIN_REQUIRED` 未设或为 false）。

| # | 步骤 | 预期 |
|---|------|------|
| 1 | 画布新建项目 → 添加文本节点 → 粘贴短剧本 | 文本节点可编辑 |
| 2 | 底部 AI 栏 → **提取资产** → **智能分镜** | 左列角色、中列场景、右列分镜视频 **三列不重叠**；文本→资产、文本→分镜有连线；**无**自动资产→分镜连线 |
| 2a | 不删节点，再点 **智能分镜** | 新分镜节点排在第 3 列**已有镜下方**，不压住旧镜 |
| 2a2 | 不删节点，再点 **提取资产** | 新角色/场景排在对应列**已有资产下方**，不重叠 |
| 2d | 文本节点控制台 / 右键 → **智能分镜**（非 AI 栏入口） | 与 AI 栏行为一致：三列布局、无自动资产→分镜连线 |
| 3 | 点击镜节点 → **编辑本镜描述** | 弹窗可改 prompt / 台词；已有成片时保存后出现「待更新」 |
| 4 | 手动 **+ 视频** 添加 1 个无镜号节点 | 标题为「视频 N」，底部 **全部生成 (M)** 的 M **不含**该节点 |
| 5 | **全部生成** → 确认弹窗（镜数 + 好豆预估）→ 确认 | 仅带镜号且待处理镜进入队列；成功节点 `needsRegen` 清除 |
| 5b | 底部 AI 栏 → **提取资产**（单独） | 独立创建角色/场景节点；智能分镜**不**自动触发 |
| 6 | 删除「镜 2」 | Toast：`已删除镜 2`；其余镜号**不**自动重编号 |
| 7 | 为若干镜 mock/生成成功后 → **导出至剪映** 或复制成片清单 | 顺序为镜 1、2、3…；无镜号自由节点排在末尾 |

**回归命令（改代码后）**：

```bash
npm run compile
npm run test:canvas-p0          # 含 P0 + shot utils + 三列布局
npm run test:canvas-prompt-layout # 仅三列布局
```

### 3.6 附录 A：Phase 2–6 与 npm 别名

> 用于缩小 E2E 范围；**发版以 CHECKLIST P0/P1 为准**。规划缺口见 CHECKLIST §7。

| npm 命令 | 主要套件 |
|----------|----------|
| `test:e2e:p0` | mock-failure → restart-persistence → task-panel-actions |
| `test:e2e:p1` | project-list-search、project-lifecycle、canvas-list-smoke |
| `test:e2e:phase2` | project-create、step3-regenerate、generation-stop、multi-episode、step2-episode-plan |
| `test:e2e:phase3-a` / `phase3-b` | step1-import / step3-asset-crud |
| `test:e2e:phase4-a` / `phase4-b` / `phase4-c` | step-nav-during-generation / step4-batch-video / step4-workbench+shot-edit |
| `test:e2e:phase5-a` / `phase5-b` / `phase5` | list-search / missing-data-root / 列表三件套+空数据根 |
| `test:e2e:phase6-a`（a~d） | 工坊/画布剪映导出 + 无成片拦截（4 套件） |
| `test:e2e:phase6-b` | canvas-list-smoke |
| `test:e2e:canvas-phase1`~`4` | 画布新建 / 编辑器 / 生图 / 生视频 |
| `test:e2e:canvas-full` | 画布 19 套件子集 |
| `verify:e2e:workshop` | workshop-flow + from-scratch |

| 优先级 | 目标 | 状态 |
|--------|------|------|
| P0 | 重启 / 任务浮层 / mock 失败 / 分镜编辑 | ✅ E2E |
| P1 | 列表 / 生命周期 / 画布列表 / 空数据根 | ✅ E2E |
| P2 | `workshop-live` 真实 API | ⏳ 未实现 |

### 3.7 E2E 开发参考

**新增套件**：复制 `scripts/e2e/suites/_suite.template.mjs` → 在 `register-suites.mjs` 注册 → `node scripts/e2e/run.mjs <name>`。  
**代码入口**：`scripts/e2e/run.mjs`、`runner.mjs`、`register-suites.mjs`、`suites/`。  
**`data-testid`**：写/改 E2E 时在源码查 `rg 'data-testid=' src/components src/pages`（勿维护文档内大表）。

失败产物：`.tmp-e2e/` 截图 + JSON 诊断。排障详见 CHECKLIST §5 / [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md) §3。

**若 E2E 卡住（Windows）**：`taskkill /F /IM electron.exe` 后重跑单个套件。

**Mock 环境变量**（`launchEnv` / `electron-launcher`）：

| 变量 | 作用 |
|------|------|
| `HAODE_E2E_MOCK_DELAY_MS` | 拉长 mock 生图/生视频，便于测停止与任务浮层 |
| `HAODE_E2E_MOCK_FAIL` | `shot-image` / `shot-video` / `asset-image` / `all` 注入 429 失败 |

---

## 4. 专项 verify

| 命令 | 用途 |
|------|------|
| `npm run verify:workshop-e2e` | 同 `verify:e2e:workshop`（兼容） |
| `npm run verify:auth` | 认证 API + UI |
| `npm run verify:auth:api` | 仅认证 API 流 |
| `npm run verify:canvas-e1` | 画布 E1 专项 |
| `npm run verify:canvas-e1-1` | 画布持久化测试 + UI |
| `npm run test:canvas-e1-1` | 仅持久化脚本 |
| `npm run verify:canvas-e1-1:ui` | 仅 E1-1 UI |
| `npm run verify:canvas-ui` | 画布列表 + 编辑器 UI（computed style，需 dev） |
| `npm run test:canvas-p0` | 画布 P0 纯函数（路径 / normalize / merge + shot utils） |
| `npm run test:canvas-shot-utils` | 画布智能分镜 shot utils 纯函数 |
| `npm run verify:e2e:canvas` | compile + 画布 Phase 1 E2E |
| `npm run test:e2e:canvas-full` | 全部画布 E2E 套件 |
| `npm run test:step2-tasks` | Step2 任务同步脚本 |
| `npm run test:global-libraries` | 全局素材库/音色库纯逻辑（路径、迁移、无效条目、同步文案） |
| `npm run test:e2e:global-libraries` | 全局库 Electron E2E smoke |
| `npm run test:e2e:step3-material-import` | Step3 素材库导入 E2E |
| `npm run test:e2e:step3-material-save` | Step3 保存/更新素材库 + 防重复 E2E |
| `npm run test:e2e:step4-material-reference` | Step4 分镜参考图从素材库 E2E |
| `npm run test:e2e:canvas-material-save` | 画布 → 全局素材库保存/更新 E2E |
| `npm run test:e2e:global-libraries-all` | 全局库相关 5 个 E2E 一次跑完 |
| `npm run verify:global-libraries` | compile + 纯逻辑 + `test:e2e:global-libraries-all` |

运行前阅读对应 `scripts/*.mjs` 头部注释（环境变量、前置条件）。

---

## 5. 安全扫描

| 命令 | 说明 |
|------|------|
| `npm run scan:security` | **聚合**：依次跑下面子项 |
| `npm run scan:semgrep` | 静态规则（Semgrep） |
| `npm run scan:secrets` | 密钥/敏感信息扫描 |
| `npm run scan:electron` | Electron 安全相关检查 |
| `npm run audit:deps` | 依赖审计 |

**建议时机**：发版前、大改 IPC/上传/认证后、引入新依赖后。  
失败处理：修复泄露或违规后再发版；勿 `--no-verify` 跳过（无 git hook 绑定时亦应人工遵守）。  
详见根目录 [`SECURITY.md`](../SECURITY.md)。

---

## 6. CI 现状

本仓库**未配置**远端 CI。日常 `npm run compile`；发版与勾选见 [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md)；人类发版流程见 [`RELEASE.md`](./RELEASE.md)。

---

## 7. 相关文档

| 文档 | 用途 |
|------|------|
| [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) | **发版首选**：P0/P1、baseline、排障、按需脚本 |
| [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md) | 46 套件速查 + 聚合别名 |
| [`TESTING_PRICING.md`](./TESTING_PRICING.md) | 图片/视频分档计价 Layer A–C + 手工 |
| [`TESTING_FFMPEG.md`](./TESTING_FFMPEG.md) | 抽音 Layer A–C + 手工 |
| [`AGENTS.md`](../AGENTS.md) | Agent Tier |
| [`README.md`](./README.md) | 文档索引 |

---

## 8. 历史别名与未入门禁脚本

### 8.1 命令别名（兼容旧文档）

| 别名 | 等价 | 说明 |
|------|------|------|
| `verify:release` | `verify:full` | 仅 P0 |
| `verify:release:all` | `verify:all` | P0 + P1 |
| `verify:workshop-e2e` | `verify:e2e:workshop` | 仅 workshop-flow + from-scratch |
| `test:workshop-e2e` | `test:e2e:workshop` | 单套件 workshop-flow |
| `test:e2e:lifecycle` | `workshop-project-lifecycle` | 工坊项目编辑/删除 |
| `test:e2e:canvas-lifecycle` | `canvas-list-smoke` | 画布列表搜索 + 进编辑器（非 project-create） |

Phase 2–6 编号（`test:e2e:phase4-a` 等）为历史分批索引；**新发版以 P0/P1 + 勾选表为准**。详见 [`TESTING_E2E_INDEX.md`](./TESTING_E2E_INDEX.md) §2。

### 8.2 未进 verify:full / verify:all 的脚本

完整列表见 [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md) §6。
