# 好的 AI 漫创 · 项目蓝图

> **用途**：本文件是 `haode-ai-client` 的**业务范围与分期**单一事实来源。  
> **UI 复刻**：请配合 [`CURSOR_REPLICATION_GUIDE.md`](./CURSOR_REPLICATION_GUIDE.md) 使用（Cursor 直接移植 ai-fusion-video，无需 Stitch）。  
> **文档索引**：[`README.md`](./README.md) · 架构 [`ARCHITECTURE.md`](./ARCHITECTURE.md)  
> **更新日期**：2026-07-06  
> **状态**：**持续迭代中**（Electron 客户端已上线运行；Phase 0～7 主体已实现，画布/登录/工具箱等为后续扩展）

---

## 1. 三源对照（你要什么 + 从哪抄）

| 维度 | 参考项目 | 本地路径 | 在本项目中的角色 |
|------|----------|----------|------------------|
| **UI 视觉与布局** | 融光 ai-fusion-video | `E:\work\project\kaiyuan\ai-fusion-video\ai-fusion-video-web` | **只抄 UI**：暗色玻璃拟态、顶栏 GlowMenu、侧栏卡片、大圆角、蓝紫渐变 CTA |
| **功能与交互** | 画境 / 好的 AI Client | `E:\work\project\cangku\haode-ai-client` | **功能真源**：创作工坊四步、素材库、系统设置、IPC 数据流 |
| **业务需求与验收** | 画境业务文档 | 本地 `weeek-work`（路径因机器而异） | **需求与验收 ID**：WS/S1/S2/S3/S4、设置 Tab、P0/P1 分期 |
| **工程规范** | 魔因漫创 | `E:\work\project\kaiyuan\moyin-creator` | **代码结构**：Electron + React + Zustand + ai-core 分层 |

**一句话定义**：

> 用 **ai-fusion-video 的 UI 风格**，在 **Electron 桌面**里，交付 **创作工坊 + 画布精修 + 系统设置 + 素材库 + 工具箱**，工程规范对齐 moyin-creator。

---

## 2. 产品范围与实现状态

> 版本号见 `package.json`；下表「状态」指当前代码库（2026-07），非原始 weeek-work P0 裁剪版。

### 2.1 核心模块

| 模块 | 路由 | 功能 ID / 要点 | 状态 |
|------|------|----------------|------|
| 首页 | `/dashboard` | 公告/快速入口 | ✅ 已实现 |
| **创作工坊** | `/workshop` | WS-01~07 | ✅ 已实现 |
| **四步向导** | `/workshop/:id/step/1~4` | S1~S4 | ✅ 已实现（Step4 含生视频、剪映导出等） |
| **画布** | `/canvas`、`/canvas/:id` | 节点精修、Agent、导出 | ✅ 已实现（见 `CANVAS_MODULE_REVIEW_AND_CHECKLIST.md`） |
| **素材库** | `/materials` | 本地素材 | ✅ 已实现 |
| **工具箱** | `/toolbox` | 裁剪、合并等 | ✅ 已实现 |
| **系统设置** | `/settings` | 路径、模型、模板、账户等 | ✅ 已实现 |
| **登录** | `/login` | 微信扫码；可本地模式跳过 | ✅ 已实现 |

### 2.2 持续增强（非阻塞 MVP）

| 模块 | 说明 | 状态 |
|------|------|------|
| 任务队列 / 后台恢复 | 生图生视频断点续跑 | 🔄 持续迭代 |
| 组织项目 / 账户 | 登录态、邀请码与后端联动 | 🔄 见 `../docs/business/` |
| macOS 应用内更新 | 官网手动下 dmg | ⚠️ 见 `deploy/DEPLOY.md` |

### 2.3 明确不做（产品边界）

来源：`weeek-work/02` 与本仓库策略（**不含**已实现的画布模块）：

- 管理后台 `/admin`（客户端内）
- 我的剧本独立入口（剧本数据在工作流内）
- 云项目全量同步 / 自建 OSS 替代方案
- 客户端内好豆充值页与余额 UI（注册送豆文案保留；按次扣费不在客户端）

**画布**：独立模块，与工坊并行；用户从画布列表新建与管理项目，不再从 Step4 导出 fork（旧磁盘 `canvasLink`/`workflowLink` 只读忽略）。

---

## 3. UI 设计规范（ai-fusion-video → Electron 适配）

> **Cursor 写 UI 时**：以 [`CURSOR_REPLICATION_GUIDE.md`](./CURSOR_REPLICATION_GUIDE.md) 为准（源文件映射、Tailwind 配方、逐页组件树、验收清单）。本节为摘要。

### 3.1 设计体系

| 项 | 规范 | 参考文件 |
|----|------|----------|
| 组件基座 | shadcn/ui（style: base-maia）+ Radix + CVA | `ai-fusion-video-web/components.json` |
| CSS | Tailwind CSS 4 + OKLCH CSS Variables | `ai-fusion-video-web/app/globals.css` |
| 默认主题 | **Dark** | `ai-fusion-video-web/app/layout.tsx` |
| 字体 | Inter（sans）+ Geist Mono（代码/数字） | 同上 |
| 图标 | lucide-react | — |
| 动效 | framer-motion 入场 stagger；可选 View Transition 切主题 | dashboard 各 page |
| Toast | sonner | — |

### 3.2 核心 Token（暗色主题）

从 `globals.css` 的 `.dark` 继承，关键值：

```
--background:     oklch(0.145 0 0)      /* 深灰黑底 */
--foreground:     oklch(0.985 0 0)
--card:           oklch(0.205 0 0)      /* 卡片底 */
--primary:        oklch(0.443 0.11 240.79)  /* 深蓝主色 */
--border:         oklch(1 0 0 / 14%)    /* 半透明白边 */
--radius:         0.875rem (14px)
```

**语义点缀色**（Tailwind 直接用）：`blue-400`、`purple-400`、`cyan-400`、`violet-500`

### 3.3 布局模式（Electron 全窗口）

```
┌─────────────────────────────────────────────────────────┐
│ AppHeader（浮动 GlowMenu：首页 | 创作工坊 | 画布 | 素材 | 工具箱 | 设置）│
├──────────┬──────────────────────────────────────────────┤
│ Sidebar  │  Main（max-w-7xl 或 fullWidth）              │
│ 浮卡侧栏  │  ┌────────────────────────────────────────┐ │
│ blur+圆角 │  │ 玻璃卡片 content                        │ │
│          │  └────────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────────┘
```

| 场景 | 布局 |
|------|------|
| 项目列表 | 标题 + 蓝紫渐变「新建项目」+ 搜索 + `grid 1/2/3` 卡片 |
| 四步向导 Step 1~3 | 顶栏 Stepper（1/4~4/4）+ 左主区 + 右侧参数面板 |
| Step 4 分镜 | **三栏**：左分集树 / 中分镜表 / 右详情+5 Tab（模板/生图/生视频/设置/任务） |
| 系统设置 | 左 Tab 导航 + 右表单区（8 Tab 精简为 5 Tab，见 §4.4） |
| 窄屏 | 左右栏改 Sheet 抽屉（参考 storyboards page） |

### 3.4 组件视觉规则

- **玻璃卡片**：`backdrop-blur-lg bg-card/50 border-border/30~40 rounded-xl`
- **主按钮 CTA**：`bg-linear-to-r from-blue-600 to-purple-600` 或 `from-cyan-600 to-blue-600`
- **输入框**：大圆角 `rounded-xl`，暗色 `border-white/10`
- **选中态**：`bg-violet-500/10 border-violet-500/15`（分集/场次）
- **间距**：主区 `px-5 lg:px-8 py-4`；卡片网格 `gap-5`
- **侧栏宽**：`clamp(272px, 23vw, 332px)`

### 3.5 Cursor 复刻入口

每个 Phase 的完整 Prompt、源文件路径、Tailwind 配方见 **`CURSOR_REPLICATION_GUIDE.md` §7**。

起手 Prompt：

```
请严格按 docs/CURSOR_REPLICATION_GUIDE.md 的 Phase N 执行。
UI 从 ai-fusion-video 对应源文件移植；功能对齐 haode-ai-client + weeek-work。
```

---

## 4. 功能规格（画境业务 · 按模块）

> 详细 ID 与按钮说明见 `weeek-work/01`、`weeek-work/04`。实现行为对照 `haode-ai-client` 的 legacy + runtime patch。

### 4.1 创作工坊 · 项目列表（WS）

| ID | 功能 | UI 要点 | 数据 |
|----|------|---------|------|
| WS-01 | 项目卡片 | 缩略图、标题、步骤 1/4~4/4、更新时间 | `projects.json` |
| WS-02 | 新建项目 | 渐变按钮 → 跳转 step=1 | 创建 `{id}/data.json` |
| WS-06 | 分页 | 底部分页器 | — |
| WS-07 | 本地持久化 | 自动保存 | IPC `read/write-workflow-projects` |

**参考实现**：`haode-ai-client/legacy/.../Sora2StepsProjects-BcKZzDIY.js`

### 4.2 Step 1 — 输入剧本（S1）

| ID | 功能 | 说明 |
|----|------|------|
| S1-01 | 剧本文本框 | ≤50000 字，字数统计 |
| S1-02 | 提取模板 | V2 / V3 / 标准（来自 settings 或内置 seed） |
| S1-03 | LLM 模型 | 下拉，读 settings.llmModels |
| S1-06 | 下一步 | 校验非空 → step=2 |
| S1-07 | 保存 | IPC 写 data.json |
| S1-09 | 重命名 | 项目标题可编辑 |

**布局**：左 70% 剧本区 + 右 30% 参数面板（`weeek-work/04` §2）

### 4.3 Step 2 — 分集规划（S2）

| ID | 功能 | 说明 |
|----|------|------|
| S2-01 | Agent/LLM | 分集推理模型 |
| S2-02 | 画风 | 真人写实/漫画/2D/3D/图文推文 |
| S2-04 | AI 智能分集 | 异步 LLM，5 阶段 Agent（见 §5.3） |
| S2-05 | 分集 Tab | 第 N 集 / 全文 |
| S2-06 | 元数据 | 标题、Hook、摘要、素材范围 |
| S2-07 | 脚本预览 | 可编辑 + 字数 |
| S2-08 | 实体标签 | 人物/场景/物品彩色 Tag |
| S2-09~11 | 增删清空 | 二次确认 |
| S2-12 | 进入本集制作 | → step=3 |

**Stepper 规则**：已完成 ✓ 可回退；当前 ●；未完成 ○ 不可跳过。

**参考**：`haode-ai-client/src/haode/runtime/services/haode-episode-split-fix.ts`

### 4.4 Step 3 — 角色与场景（S3）

| 子 Tab | 功能 |
|--------|------|
| 角色设定 | Prompt、参考图、布局形式（四视图等）、提取本集人物、生图 |
| 场景设定 | 同上 |
| 物品设定 | 同上 |

**布局预设**：`haode-ai-client/src/haode/runtime/data/haode-layout-presets-data.ts`  
**风格预设**：`haode-ai-client/src/haode/runtime/data/haode-style-presets-data.ts`

### 4.5 Step 4 — 分镜生成（S4，P0 可裁剪）

| ID | 功能 | P0 |
|----|------|-----|
| S4-01 | 推理分镜 | LLM + storyboard 模板 | ✅ |
| S4-02 | 二次验证 | 补全局空间锚点 | ✅ |
| S4-03 | 分镜生图 / 批量 | 图片模型 API | ✅ |
| S4-04 | 生视频 / 导出剪映 | 视频模型 + IPC export | P1 |

**右侧 5 Tab**（`weeek-work/04` §5）：模板 | 生图 | 生视频 | 设置 | 任务

**参考**：`haode-ai-client/src/haode/runtime/services/haode-storyboard-service.ts`

### 4.6 我的素材库

对齐 `haode-ai-client` `/my-characters` 精简版：

- 默认「本地素材」Tab
- 角色库 / 场景库路径读 settings
- IPC：`read-character-images`、`read-scene-images`
- 与工作流 `@角色名` 引用联动（P1）

### 4.7 系统设置（精简 5 Tab）

原版 8 Tab → 好的版保留：

| Tab | Hash | 内容 |
|-----|------|------|
| 文件路径 | `#paths` | workflowRoot、角色/场景/生图/视频目录；**禁止中文路径** |
| 模型配置 | `#models` | LLM / 图片 / 视频 子 Tab |
| 提示词模板 | `#templates` | extract / storyboard / style / layout 等 |
| 系统参数 | `#system` | 并发数、自动保存间隔 |
| 用户协议 | `#agreement` | 静态文本 |

**隐藏**：音色、ComfyUI、即梦（与 haode-ai-client `haode-settings-prune.ts` 一致）

**配置存储**：`Documents/HaodeAI/settings.json`（IPC read/write）

---

## 5. 技术架构

### 5.1 栈选型（已定）

| 层 | 技术 | 理由 |
|----|------|------|
| 桌面 | Electron 30 + electron-vite | 与 moyin-creator、蓝图一致 |
| 前端 | React 18 + TypeScript + React Router | Native 重写，弃 legacy Vue bundle |
| 状态 | Zustand 5 + persist | moyin-creator 惯例 |
| UI | Tailwind 4 + shadcn + Radix + CVA | 对齐 ai-fusion-video 视觉 |
| AI | `src/packages/ai-core` | 任务队列、Provider、Prompt 编译 |
| 后端 P0 | **无**（客户端直连第三方 API） | 对齐 haode-ai-client 离线版 |

### 5.2 目标目录结构

```
haode-ai-client/
├── electron/
│   ├── main.ts              # 窗口、IPC、文件 IO、剪映导出
│   └── preload.ts           # contextBridge
├── src/
│   ├── app/                 # 路由布局
│   ├── components/
│   │   ├── dashboard/       # 顶栏、侧栏
│   │   ├── workshop/        # 创作工坊
│   │   ├── canvas/          # 画布
│   │   ├── settings/        # 设置
│   │   ├── toolbox/         # 工具箱
│   │   ├── materials/       # 素材库 UI
│   │   └── ui/              # shadcn 基础组件
│   ├── pages/               # 路由页面
│   ├── stores/              # project、workflow、canvas、settings、task
│   ├── lib/
│   │   ├── workflow/        # 四步业务逻辑
│   │   ├── canvas/          # 画布业务
│   │   ├── models/          # LLM/图片/视频 gateway
│   │   └── storage/         # 本地 JSON 读写封装
│   └── types/
├── docs/                    # 见 docs/README.md
└── scripts/                 # seed 模板、构建
```

### 5.3 数据模型（P0 本地 JSON）

**settings.json**（全局）

```typescript
interface AppSettings {
  paths: { workflowRoot; characterLibrary; sceneLibrary; generatedImages; videoSave };
  llmModels: ModelConfig[];
  imageModels: ModelConfig[];
  videoModels: ModelConfig[];
  promptTemplates: PromptTemplate[];
  system: { maxConcurrency; autoSaveIntervalMs };
}
```

**workflow/projects.json**（项目索引）

```typescript
interface WorkflowProjectMeta {
  id: string;
  title: string;
  currentStep: 1 | 2 | 3 | 4;
  thumbnail?: string;
  updatedAt: number;
}
```

**workflow/{id}/data.json**（单项目）

```typescript
interface WorkflowProjectData {
  script: string;
  extractTemplateKey: string;
  style: string;
  episodes: Episode[];
  characters: CharacterAsset[];
  scenes: SceneAsset[];
  props: PropAsset[];
  shots: Shot[];
}
```

**workflow/{id}/tasks.json**（异步任务）

```typescript
interface WorkflowTask {
  id: string;
  type: 'episode_split' | 'extract' | 'storyboard' | 'image' | 'video';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progressMessage?: string;
  errorMessage?: string;
}
```

### 5.4 IPC 通道

**完整清单**（含 canvas、fs、voice、更新、剪映）：[`ARCHITECTURE.md`](./ARCHITECTURE.md) §3。

P0 最小集摘要：

| Channel | 用途 |
|---------|------|
| `settings:read` / `settings:write` | settings.json |
| `workflow:*` / `canvas:*` | 项目与 data.json |
| `dialog:select-directory` | 路径选择 |
| `fs:*` | 媒体读写、导入导出 |
| `capcut:export-episode` | 剪映草稿 |

实现：`electron/main/ipc-*.ts`、`electron/preload.ts`。

### 5.5 AI 调用路径（P0）

```
UI 选模型
  → lib/models/gateway.ts（读 settings 里用户 Key）
  → packages/ai-core/task-queue（并发、重试、轮询）
  → 第三方 API（OpenAI 兼容 / Gemini / Claude 等）
```

分集 Agent 5 阶段逻辑见 `weeek-work/06`：大纲 → 覆盖度 → 逐集脚本 → 一致性 → 优化。

---

## 6. 分阶段生成计划（Cursor 逐步执行）

> **历史 Phase 0～7 主体已完成**；本节保留作 Tier 3 UI 复刻与增量功能参考。  
> 新功能请先查 §2 实现状态，避免重复造轮子。

---

### Phase 0 — 工程脚手架（约 1 次对话）

**交付物**

- [ ] `package.json`、electron-vite、Tailwind 4、tsconfig paths
- [ ] `globals.css` 复制 ai-fusion-video OKLCH token
- [ ] shadcn ui 基础组件（button、input、dialog、sheet、tabs）
- [ ] 空壳 Dashboard Layout（Header + Sidebar + Outlet）
- [ ] AGENTS.md / rules 已存在

**Cursor Prompt**

```
在 haode-ai-client 初始化 Electron 30 + electron-vite + React 18 项目。
UI token 和布局参考 E:\work\project\kaiyuan\ai-fusion-video\ai-fusion-video-web\app\globals.css
和 components/dashboard/（app-header、sidebar-nav）。
工程结构对齐 E:\work\project\kaiyuan\moyin-creator。
实现暗色 Dashboard 空壳，路由：/dashboard、/workshop、/materials、/settings。
```

**验收**：`npm run dev` 可启动，四路由可切换，视觉为暗色玻璃拟态。

---

### Phase 1 — 系统设置（P0）

**交付物**

- [ ] Settings 页 5 Tab UI
- [ ] settings store + IPC 读写
- [ ] 路径选择器 + 中文路径校验
- [ ] 模型配置 CRUD（LLM/图片/视频）
- [ ] 提示词模板列表（可先内置 seed）

**Cursor Prompt**

```
按 docs/PROJECT_BLUEPRINT.md Phase 1 实现系统设置。
UI 风格 ai-fusion-video；功能对齐 haode-ai-client 设置页（隐藏音色/ComfyUI/即梦）。
数据存 Documents/HaodeAI/settings.json，走 electron IPC。
参考 haode-ai-client/electron/main/ipc-handlers.ts 的 settings 相关通道。
```

**验收**：改路径/模型后重启仍保留；中文路径有红字提示。

---

### Phase 2 — 创作工坊项目列表（WS）

**交付物**

- [ ] `/workshop` 卡片网格 + 新建 + 分页
- [ ] project store + workflow/projects.json
- [ ] 点击进入 `/workshop/:id?step=1`

**Cursor Prompt**（完整版见 CURSOR_REPLICATION_GUIDE §7 Phase 2）

```
实现 Phase 2 项目列表。卡片数据 WorkflowProjectMeta，IPC 持久化到 workflow/projects.json。
新建项目创建 uuid 目录和空 data.json。
```

---

### Phase 3 — Step 1 输入剧本（S1）

**交付物**

- [ ] Stepper 组件（1/4）
- [ ] 剧本编辑区 + 右侧参数（模板、LLM）
- [ ] 保存 / 下一步 / 重命名
- [ ] data.json 读写

**验收**：S1-01~03, S1-06~07, S1-09 通过。

---

### Phase 4 — Step 2 分集规划（S2）

**交付物**

- [ ] 分集 Tab + 元数据表单 + 脚本预览 + 实体 Tag
- [ ] 「AI 智能分集」异步任务 + tasks.json 轮询
- [ ] lib/workflow/episode-split-service.ts
- [ ] 增删清空分集（确认框）

**参考文档**：`weeek-work/03` 分集相关 prompt；`haode-ai-client/.../haode-text-service.ts`

**验收**：S2-01~12 通过；分集结果写入 data.json。

---

### Phase 5 — Step 3 角色与场景（S3）

**交付物**

- [ ] 三子 Tab UI
- [ ] 提取本集人物（LLM + extract 模板）
- [ ] 布局/风格预设下拉
- [ ] 单张/批量生图 + 保存到 generatedImagesPath

**验收**：S3 核心项通过；参考图可展示。

---

### Phase 6 — Step 4 分镜（S4 P0）

**交付物**

- [ ] 三栏分镜工作台
- [ ] 推理分镜 + 二次验证
- [ ] 分镜表：镜号、描述、Prompt、状态
- [ ] 单镜/批量生图
- [ ] 右侧「任务」Tab

UI 规格见 **CURSOR_REPLICATION_GUIDE §4.6**（三栏 + fullWidth + Sheet 抽屉）。

---

### Phase 7 — 素材库 + 首页

**交付物**

- [ ] `/materials` 本地素材浏览
- [ ] `/dashboard` 快速入口

---

### Phase 8 — P1 增强

- [ ] 批量生视频 + 任务队列完善
- [ ] 导出剪映 IPC
- [ ] 登录（可选）

---

## 7. 外部文档索引（深入细节时查阅）

| 主题 | 路径 |
|------|------|
| 功能 ID 全表 | `weeek-work/01-初步业务功能清单（Feature List）.md` |
| 按钮/Tab 对照 | `weeek-work/04-模块按键与关键词说明.md` |
| 提示词模板 | `weeek-work/03-提示词模板.md` |
| 接口样例 | `weeek-work/06-接口分析.md` |
| 存储分期 | `weeek-work/05-存储选型与分阶段建议.md` |
| 后端（P1+） | `weeek-work/08-后端技术开发手册.md` |
| UI 参考源码 | `ai-fusion-video/ai-fusion-video-web/app/(dashboard)/` |
| 功能参考实现 | `haode-ai-client/src/haode/runtime/services/` |
| 工程规范 | `haode-ai-client/AGENTS.md`、`.cursor/rules/` |

---

## 8. 已确认事项（历史）

| # | 问题 | 结论 |
|---|------|------|
| 1 | 产品对外名称 | 「好的漫创」 |
| 2 | 数据目录 | 便携 `dataRoot` + settings（见设置 · 文件路径） |
| 3 | Step 4 生视频 | 已纳入 |
| 4 | 微信登录 | 已纳入；本地模式可跳过（`VITE_LOGIN_REQUIRED`） |
| 5 | 画布模块 | 已纳入，独立于工坊 |

---

## 9. 快速命令

```bash
# 开发（Phase 0 完成后）
cd E:\work\project\cangku\haode-ai-client
npm install
npm run dev

# 对照参考项目 UI
cd E:\work\project\kaiyuan\ai-fusion-video\ai-fusion-video-web
pnpm dev
```

---

**下一步建议**：新 UI 页面对 Cursor 说：

> 「请严格按 `docs/CURSOR_REPLICATION_GUIDE.md` 的 Phase N 执行。」

日常开发与架构见 [`docs/README.md`](./README.md)。
