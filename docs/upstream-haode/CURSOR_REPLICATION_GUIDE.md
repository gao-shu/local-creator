# Cursor 完美复刻指南（无需 Stitch）

> **配套文档**：`PROJECT_BLUEPRINT.md`（业务范围与分期）  
> **本文件职责**：告诉 Cursor **先读什么、抄什么、写到哪、怎样验收**  
> **原则**：UI 100% 对齐 ai-fusion-video；功能 100% 对齐画境/haode-ai-client；工程对齐 moyin-creator

---

## 0. Cursor 复刻协议

> **适用范围**：**Tier 3** — UI 复刻、新页面、Phase 交付（见 `.cursor/rules/agent-context-budget.mdc`）。  
> **非 Tier 3**（修 bug、改文案、登录、IPC、小 UI 调整）：**不要**读本文档全文；只 `npm run compile`，按 task-routing 执行。

### 0.1 三源分工（Tier 3 专用，不可混淆）

| 源 | 只负责 | 绝不负责 |
|----|--------|----------|
| **ai-fusion-video** | 颜色、间距、圆角、动效、布局壳、卡片样式 | 业务字段、IPC、画境四步逻辑 |
| **haode-ai-client** | 功能行为、IPC 通道、settings 结构、工作流 data.json | UI 视觉（legacy 是 Ant Design） |
| **weeek-work** | 功能 ID 验收、按钮文案、Tab 结构 | UI 视觉 |

### 0.2 强制工作流（**Tier 3 / Phase 交付** 逐步执行）

```
Step A  读 CURSOR_REPLICATION_GUIDE 当前 Phase 章节（Grep 定位，禁止通读全文）
Step B  读 ai-fusion-video 对应源文件（见 §1 移植映射表）
Step C  读 haode-ai-client / weeek-work 对应功能说明
Step D  在 haode-ai-client 创建目标文件（见 §2 目标路径）
Step E  移植 UI 壳 + 接入业务 Store/IPC
Step F  对照 §6 视觉验收清单 + PROJECT_BLUEPRINT 功能 ID 自测
Step G  **自行测试验证（必做，不可跳过）** — 见 §0.4
```

### 0.4 每 Phase 完成后必须自测（**Tier 3**，Agent 强制执行）

**不通过则不得宣称 Phase 完成。**

```bash
# 1. 编译
npm run compile

# 2. 启动（另开终端或后台）
npm run dev
# 记下终端输出的 Local 端口，如 http://localhost:5175/

# 3. UI 冒烟（指定实际端口）
set UI_BASE_URL=http://localhost:5175   # Windows CMD
# $env:UI_BASE_URL="http://localhost:5175"  # PowerShell
npm run verify:ui
```

**Electron 窗口目测**：应看到暗色顶栏「好的漫创」、GlowMenu 四菜单、首页「欢迎回来」。

**常见白屏原因**：
- React 18 误用 React 19 语法：`<Context value>` → 必须 `<Context.Provider value>`
- dev 端口被占用，Electron 连错端口
- renderer 控制台有红色报错（DevTools F12）

**交付时必须汇报**：compile 结果、verify:ui 结果、目测要点。

### 0.3 对话起手 Prompt（**Tier 3** 复制即用）

```
请严格按 docs/CURSOR_REPLICATION_GUIDE.md 的 Phase N 执行。
UI 必须从 E:\work\project\kaiyuan\ai-fusion-video\ai-fusion-video-web 对应文件移植/adapt。
功能必须对齐 E:\work\project\cangku\haode-ai-client 与 weeek-work 功能 ID。
工程结构对齐 moyin-creator。完成后逐项勾选该 Phase 验收清单，并执行 §0.4 自测（npm run compile + npm run verify:ui）。
```

---

## 1. UI 源文件 → 目标文件移植映射

> Cursor 写每个模块前，**必须先打开左侧源文件**，右侧写目标文件。

### 1.1 全局壳（Phase 0，最高优先级）

| 源（ai-fusion-video） | 目标（haode-ai-client） | 说明 |
|----------------------|------------------------|------|
| `app/globals.css` | `src/index.css` | **整文件复制** OKLCH token + dark 默认 |
| `app/layout.tsx` | `src/main.tsx` + `src/app/root-layout.tsx` | ThemeProvider dark、Toaster、字体 |
| `app/(dashboard)/layout.tsx` | `src/app/dashboard-layout.tsx` | h-screen、pt-20、侧栏宽 clamp |
| `components/dashboard/app-header.tsx` | `src/components/dashboard/app-header.tsx` | GlowMenu 顶栏 |
| `components/ui/glow-menu.tsx` | `src/components/ui/glow-menu.tsx` | **整文件移植** |
| `components/dashboard/sidebar-nav.tsx` | `src/components/dashboard/sidebar-nav.tsx` | 改菜单项（见 §3.1） |
| `lib/hooks/use-layout.ts` | `src/hooks/use-layout.ts` | fullWidth 控制 |
| `components/ui/button.tsx` 等 | `src/components/ui/*` | shadcn base-maia 组件集 |
| `components.json` | `components.json` | style: base-maia |

**路由差异**：Next.js `useRouter` → React Router `useNavigate`；`usePathname` → `useLocation().pathname`

### 1.2 业务页 UI 模板

| 业务页 | UI 模板源 | 目标 |
|--------|-----------|------|
| 创作工坊项目列表 | `app/(dashboard)/projects/page.tsx` | `src/pages/workshop/project-list-page.tsx` |
| 新建项目弹窗 | `components/dashboard/create-project-dialog.tsx` | `src/components/workshop/create-project-dialog.tsx` |
| Step 4 分镜三栏 | `app/(dashboard)/projects/[id]/storyboards/page.tsx` + `_components/*` | `src/pages/workshop/step4-storyboard-page.tsx` |
| 系统设置 | `app/(dashboard)/settings/*/page.tsx` | `src/pages/settings/settings-page.tsx` |
| 首页 | `app/(dashboard)/dashboard/page.tsx` | `src/pages/dashboard/home-page.tsx` |
| 素材库 | `app/(dashboard)/assets/page.tsx` | `src/pages/materials/materials-page.tsx` |

### 1.3 功能逻辑源（无 UI，只抄行为）

| 功能 | 源 |
|------|-----|
| settings.json 读写 | `haode-ai-client/electron/main/ipc-handlers.ts` |
| workflow 项目 CRUD | 同上 + `read/write-workflow-project-data` |
| 四步工作流状态机 | `haode-ai-client/legacy/.../Sora2WorkflowSteps-eIR98mnV.js`（行为）+ `src/haode/runtime/services/*` |
| 分集/提取/分镜 | `haode-text-service.ts`、`haode-storyboard-service.ts` |
| 布局/风格预设 | `haode-layout-presets-data.ts`、`haode-style-presets-data.ts` |
| 功能验收 ID | `weeek-work/01`、`weeek-work/04` |

---

## 2. 目标工程路径约定

```
src/
├── app/
│   ├── router.tsx                 # React Router 路由表
│   ├── dashboard-layout.tsx       # 全局壳
│   └── root-layout.tsx
├── pages/
│   ├── dashboard/home-page.tsx
│   ├── workshop/
│   │   ├── project-list-page.tsx
│   │   ├── workflow-layout.tsx    # Stepper + outlet
│   │   ├── step1-script-page.tsx
│   │   ├── step2-episode-page.tsx
│   │   ├── step3-assets-page.tsx
│   │   └── step4-storyboard-page.tsx
│   ├── materials/materials-page.tsx
│   └── settings/settings-page.tsx
├── components/
│   ├── dashboard/                 # app-header, sidebar-nav
│   ├── workshop/                  # stepper, episode-tabs, entity-tags...
│   └── ui/                        # shadcn
├── stores/
│   ├── settings-store.ts
│   ├── workflow-project-store.ts
│   └── task-store.ts
└── lib/
    ├── workflow/                  # 四步业务
    ├── models/                    # LLM/图片/视频 gateway
    └── storage/                   # IPC 封装
```

---

## 3. 全局壳规格（Electron 适配 ai-fusion-video）

### 3.1 顶栏 GlowMenu 菜单项（替换 ai-fusion-video 默认）

```typescript
const menuItems = [
  { icon: LayoutDashboard, label: "首页",     href: "/dashboard", iconColor: "text-blue-500",   gradient: "..." },
  { icon: FolderKanban,    label: "创作工坊", href: "/workshop",  iconColor: "text-purple-500", gradient: "..." },
  { icon: Images,          label: "素材库",   href: "/materials", iconColor: "text-orange-500", gradient: "..." },
  { icon: Settings,        label: "系统设置", href: "/settings",  iconColor: "text-green-500",  gradient: "..." },
];
```

gradient 字符串**原样复制** `app-header.tsx` 中对应项。

### 3.2 侧栏二级菜单（按路由切换）

| 当前路由 | 侧栏项 |
|----------|--------|
| `/dashboard` | 总览 |
| `/workshop` | 项目列表 |
| `/workshop/:id/*` | ← 返回列表 · Step1 剧本 · Step2 分集 · Step3 角色场景 · Step4 分镜 |
| `/materials` | 本地素材 · 角色库 · 场景库 |
| `/settings` | 文件路径 · 模型配置 · 提示词 · 系统参数 · 用户协议 |

侧栏容器 class（**不可改**）：

```
rounded-2xl backdrop-blur-lg border border-border/40 shadow-lg
选中项: bg-foreground/6 + 左侧 iconColor 指示条
```

### 3.3 Dashboard Layout 关键 class

```tsx
<div className="h-screen overflow-hidden flex flex-col bg-background">
  <AppHeader />
  <div className="flex pt-20 flex-1 min-h-0">
    <div className="hidden lg:block shrink-0 w-[clamp(272px,23vw,332px)] px-4 pt-1 self-start">
      <SidebarNav />
    </div>
    <main className="flex-1 min-w-0 min-h-0 py-4 px-5 lg:px-8 overflow-auto">
      <div className={cn("w-full mx-auto", fullWidth ? "max-w-full" : "max-w-7xl")}>
        <Outlet />
      </div>
    </main>
  </div>
</div>
```

### 3.4 Electron 特有补充

- 窗口最小尺寸：`1280×800`（分镜三栏需要）
- 标题栏：可 `--webkit-app-region: drag` 仅顶栏空白区
- 不用 Next.js middleware 鉴权；P0 跳过登录，直接进入 `/dashboard`

---

## 4. 逐页 UI 规格（Cursor 按此写 JSX）

### 4.1 创作工坊 · 项目列表（= ai-fusion-video projects 页）

**功能 ID**：WS-01, WS-02, WS-06, WS-07

**组件树**

```
ProjectListPage
├── 标题区 (h1 + subtitle + 新建按钮)
├── 搜索栏 (玻璃 input)
├── grid 卡片 | 空状态 | loading
└── CreateProjectDialog
```

**Tailwind 配方（直接复制）**

| 元素 | class |
|------|-------|
| 页面标题 | `text-3xl font-bold tracking-tight` |
| 副标题 | `text-muted-foreground mt-1` |
| 新建按钮 | `flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-linear-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200` |
| 搜索容器 | `flex items-center gap-3 px-4 py-3 rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm` |
| 卡片 grid | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5` |
| 单卡片 | `group relative rounded-xl border border-border/30 p-5 cursor-pointer bg-card/50 backdrop-blur-sm hover:border-border/50 transition-all duration-300` |
| 卡片 hover | `whileHover={{ y: -4 }}` (framer-motion) |
| 渐变 overlay | `absolute inset-0 bg-linear-to-br ${gradients[idx % 6]} opacity-0 group-hover:opacity-100` |

**卡片内容（业务字段，替换 ai-fusion-video Project）**

```
[FolderKanban icon]  项目标题
步骤进度: Step {currentStep}/4  (Badge)
Clock + formatTime(updatedAt)
hover 显示删除按钮 (Trash2)
```

**动效**：复制 projects/page.tsx 的 `containerVariants` + `itemVariants` + `staggerChildren: 0.08`

---

### 4.2 四步向导壳（workflow-layout）

**新增组件**（ai-fusion-video 无直接对应，按融光风格自建）

```
WorkflowLayout
├── Stepper（顶栏，水平 4 步）
│   完成: ✓ text-muted-foreground 可点击回退
│   当前: ● ring-2 ring-primary
│   未完成: ○ opacity-50 pointer-events-none
├── 项目标题 inline edit (Input variant ghost)
└── <Outlet /> (step1~4 页面)
```

Stepper 容器：`flex items-center gap-2 mb-6 px-1 py-3 rounded-xl border border-border/20 bg-card/30 backdrop-blur-sm`

---

### 4.3 Step 1 — 输入剧本

**功能 ID**：S1-01~03, S1-06~07, S1-09

**布局**：`grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5 h-[calc(100vh-12rem)]`

| 区域 | 内容 | class |
|------|------|-------|
| 左 | Textarea 剧本 | `min-h-[400px] rounded-xl border-border/30 bg-card/30 backdrop-blur-sm resize-none` |
| 左下 | 字数 `{n}/50000` | `text-xs text-muted-foreground` |
| 右面板 | 提取模板 Select | 玻璃卡片包裹 `rounded-xl border border-border/30 bg-card/50 p-4 space-y-4` |
| 右面板 | LLM Select | 同上 |
| 底栏 | 保存 + 下一步 | 下一步用 CTA 渐变按钮 |

**禁止**：Ant Design Form 两列 label；必须用 shadcn Select + Label。

---

### 4.4 Step 2 — 分集规划

**功能 ID**：S2-01~12

**布局**：三行结构

```
Row1: 工具条 [AI 智能分集 CTA] [画风 Select] [LLM Select] [饱满度 Select(可选)]
Row2: grid xl:grid-cols-[240px_1fr_320px]
  左: 分集 Tabs (垂直) — 激活 bg-violet-500/10 border-violet-500/15
  中: 元数据表单 (标题/Hook/摘要/素材范围)
  右: 脚本预览 Textarea + 实体 Tag 行
Row3: [进入本集制作] 右对齐 CTA
```

**实体 Tag 颜色**（weeek-work/04）：

- 人物：`bg-blue-500/15 text-blue-300 border-blue-500/20`
- 场景：`bg-green-500/15 text-green-300 border-green-500/20`
- 物品：`bg-orange-500/15 text-orange-300 border-orange-500/20`

**AI 智能分集 loading**：按钮内 `Loader2 animate-spin` + 禁用；轮询 tasks.json 每 3s。

---

### 4.5 Step 3 — 角色与场景

**布局**：顶栏 Tabs（角色设定 | 场景设定 | 物品设定）+ 内容区 grid

```
内容区: grid xl:grid-cols-[1fr_280px]
  左: 资产卡片列表 (可滚动)
  右: 详情面板 (Prompt Textarea, 布局 Select, 参考图上传, 生成按钮)
```

单资产卡片：`rounded-xl border border-border/30 bg-card/50 p-4 flex gap-4`

**生图按钮**：`variant` 用 ui/button 的 `primary-gradient` 或 CTA class。

---

### 4.6 Step 4 — 分镜工作台（= storyboards 页三栏）

**功能 ID**：S4 P0 子集

**必须** `useFullWidth(true)` — 占满 main，不用 max-w-7xl。

**布局**（复制 storyboards/page.tsx 结构）：

```
div.rounded-xl.border.border-border/20.bg-card/10.overflow-hidden.flex.h-[calc(100vh-10rem)]
├── 左栏 w-64 xl:block (Sheet@mobile) — EpisodeTree
├── 中栏 flex-1 — Toolbar + TableView/CardView
└── 右栏 w-80 2xl:block (Sheet@mobile) — RefPanel 5 Tabs
```

**中栏工具栏按钮**：推理分镜、二次验证、生成图、批量 — 用 `outline` + icon。

**激活场次行**：`bg-violet-500/10 border-violet-500/15`

**右栏 5 Tab**：模板 | 生图 | 生视频 | 设置 | 任务 — shadcn Tabs

---

### 4.7 系统设置

**布局**：`grid lg:grid-cols-[220px_1fr] gap-6`

- 左：垂直 Tab 列表（同 sidebar 选中样式）
- 右：玻璃卡片表单区

**文件路径 Tab**：每项 = Label + 路径 Input + 「选择文件夹」Button；中文路径检测到则 `text-destructive text-xs` 提示。

**模型配置 Tab**：内层 Tabs LLM | 图片 | 视频；每项模型 Card 可增删改。

---

### 4.8 素材库

**UI 模板**：`assets/page.tsx` 网格 + 分类 Tab

- Tab：本地素材（默认）| 角色库 | 场景库
- 图片 grid：`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3`
- 缩略图：`rounded-lg border border-border/30 aspect-square object-cover hover:ring-2 hover:ring-primary/50`

---

## 5. 共享 UI  primitives（Phase 0 一并创建）

| 组件 | 路径 | 用途 |
|------|------|------|
| `GlassCard` | `components/ui/glass-card.tsx` | 统一 `bg-card/50 backdrop-blur-sm border-border/30 rounded-xl` |
| `PageHeader` | `components/ui/page-header.tsx` | title + subtitle + action slot |
| `GradientButton` | `components/ui/gradient-button.tsx` | CTA 渐变按钮 |
| `Stepper` | `components/workshop/workflow-stepper.tsx` | 四步进度 |
| `EntityTag` | `components/workshop/entity-tag.tsx` | 人物/场景/物品 Tag |
| `EmptyState` | `components/ui/empty-state.tsx` | 虚线边框空状态（复制 projects 页） |
| `LoadingState` | `components/ui/loading-state.tsx` | Loader2 居中 |

**GlassCard 实现**：

```tsx
export function GlassCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
```

---

## 6. 视觉验收清单（每 Phase 必勾选）

### Phase 0 — 壳

- [ ] 默认 dark，背景 `oklch(0.145 0 0)` 而非纯 `#000`（auth 页除外）
- [ ] 顶栏 GlowMenu hover 有 radial gradient 光晕
- [ ] 侧栏浮卡 `backdrop-blur-lg rounded-2xl`
- [ ] main 区 `pt-20` 不被顶栏遮挡
- [ ] 路由切换侧栏高亮正确
- [ ] **无** Ant Design 蓝色按钮/表格

### Phase 1 — 设置

- [ ] 左 Tab + 右表单，与 ai-fusion-video settings 布局一致
- [ ] 中文路径红色提示

### Phase 2 — 项目列表

- [ ] 与 `projects/page.tsx` 像素级一致（标题、搜索、卡片 grid、空状态）
- [ ] 卡片 hover 上浮 4px + 渐变 overlay
- [ ] 新建按钮蓝紫渐变

### Phase 3~5 — 四步向导

- [ ] Stepper 状态机：不可跳过未完成步骤
- [ ] Step2 分集 Tab violet 选中态
- [ ] Step3 三子 Tab
- [ ] 所有表单在 GlassCard 内

### Phase 6 — 分镜

- [ ] 三栏 + fullWidth
- [ ] 窄屏 Sheet 抽屉
- [ ] 右栏 5 Tab

---

## 7. Phase 执行表（Cursor Only Prompt）

### Phase 0 — 脚手架 + UI 壳

```
任务：初始化 haode-ai-client Electron 项目并复刻 ai-fusion-video Dashboard 壳。

必读源文件：
- ai-fusion-video-web/app/globals.css → 复制到 src/index.css
- ai-fusion-video-web/app/(dashboard)/layout.tsx
- ai-fusion-video-web/components/dashboard/app-header.tsx
- ai-fusion-video-web/components/ui/glow-menu.tsx
- ai-fusion-video-web/components/dashboard/sidebar-nav.tsx

要求：
1. Electron 30 + electron-vite + React Router + Tailwind 4 + shadcn base-maia
2. 创建 §5 全部 shared primitives
3. 路由 /dashboard /workshop /materials /settings 空页面
4. 菜单项用 §3.1 配置
5. 工程目录用 moyin-creator 惯例（stores/lib/packages/ai-core）

验收：§6 Phase 0 清单全部通过，npm run dev 可运行。
```

### Phase 1 — 系统设置

```
任务：Phase 1 系统设置。UI 参考 ai-fusion-video settings 页布局；功能参考 haode-ai-client settings + weeek-work/01 §四。
IPC: settings:read / settings:write → Documents/HaodeAI/settings.json
隐藏：音色、ComfyUI、即梦。
验收：§6 Phase 1 + PROJECT_BLUEPRINT §4.7。
```

### Phase 2 — 项目列表

```
任务：Phase 2。UI 几乎逐行移植 ai-fusion-video projects/page.tsx，替换数据为 WorkflowProjectMeta + workflow IPC。
验收：§6 Phase 2 + WS-01/02/06/07。
```

### Phase 3 — Step 1

```
任务：Phase 3 Step1。布局 §4.3。数据写入 workflow/{id}/data.json。
验收：S1-01~03, S1-06~07, S1-09。
```

### Phase 4 — Step 2

```
任务：Phase 4 Step2。布局 §4.4。实现 AI 智能分集 + tasks 轮询。
参考 haode-text-service、weeek-work/06 五阶段 Agent。
验收：S2-01~12。
```

### Phase 5 — Step 3

```
任务：Phase 5 Step3。布局 §4.5。移植 layout/style presets 数据。
验收：S3 核心项。
```

### Phase 6 — Step 4 分镜

```
任务：Phase 6。UI 移植 storyboards/page.tsx 三栏；功能接 storyboard-service。
useFullWidth(true)。验收 §6 Phase 6 + S4 P0。
```

### Phase 7 — 素材库 + 首页

```
任务：Phase 7。素材库 UI 移植 assets/page.tsx；IPC read-images-in-dir。
首页快速入口跳转 /workshop。
```

---

## 8. 常见错误（Cursor 必须避免）

| 错误 | 正确做法 |
|------|----------|
| 自己设计一套新 UI | 先打开 ai-fusion-video 源文件再写 |
| 用 Ant Design / Element Plus | 只用 shadcn + Tailwind token |
| 用 `#1677ff` 硬编码色 | 用 `text-primary` / OKLCH 变量 |
| 把四步做成 4 个独立路由无 Stepper | 必须 workflow-layout 统一 Stepper |
| 在 renderer 调 fs | 走 electron preload IPC |
| 一次生成全部页面 | 严格按 Phase 0→7 分对话执行 |
| 忽略 framer-motion 入场 | 列表页必须 stagger 动画 |

---

## 9. 依赖清单（Phase 0 写入 package.json）

与 ai-fusion-video 对齐的 UI 依赖：

```json
{
  "framer-motion": "^12.x",
  "class-variance-authority": "^0.7.x",
  "clsx": "^2.x",
  "tailwind-merge": "^3.x",
  "lucide-react": "^0.5x",
  "sonner": "^2.x",
  "next-themes": "^0.4.x",
  "@radix-ui/react-*": "与 shadcn 组件一致"
}
```

---

## 10. 对照开发技巧

**双屏/双窗口开发**：

1. 终端 A：`cd ai-fusion-video-web && pnpm dev` → localhost:3000 对照视觉
2. 终端 B：`cd haode-ai-client && npm run dev` → Electron 窗口

**每个页面完成后**：截图对比或使用 Playwright 对比关键 selector 的 computed style（background-color、border-radius）。

---

**下一步**：对 Cursor 发送 §0.3 起手 Prompt，指定 **Phase 0**。
