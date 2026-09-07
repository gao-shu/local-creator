# 架构与代码入口

> **更新日期**：2026-07-16  
> 人类开发者稳定文档；IPC 变更时须同步更新本文 §3。

---

## 1. 分层总览

```
┌─────────────────────────────────────────────────────────────┐
│  Renderer（React）                                           │
│  pages/ → components/ → stores/ → lib/                       │
├─────────────────────────────────────────────────────────────┤
│  Preload（contextBridge）  electron/preload.ts               │
├─────────────────────────────────────────────────────────────┤
│  Main（Node）  electron/main/*.ts                            │
│  IPC · 文件 IO · 自动更新 · 剪映导出 · 路径安全               │
└─────────────────────────────────────────────────────────────┘
         ↕ HTTP / WebSocket（第三方 API、后端 duanju.*）
```

| 层 | 职责 | 禁止 |
|----|------|------|
| `src/pages/` | 路由级页面，薄壳 | 直接 `fs` / 裸 IPC |
| `src/components/` | UI，按业务分子目录 | 复杂业务逻辑堆在组件内 |
| `src/stores/` | Zustand 全局状态 + persist | 在 store 内直接调第三方 API（走 lib） |
| `src/lib/` | 业务服务、API 客户端、存储封装 | — |
| `electron/main/` | 特权 IO、对话框、更新 | 业务规则（应在 lib，主进程只做 IO） |

持久化：`settings.json` 与 `dataRoot` 下 workflow/canvas 项目目录，以及 **软件级** 全局资源（音色库、素材库），经 IPC 读写。路径安全见 `electron/main/ipc-path-security.ts`。

**dataRoot 全局资源布局**（与项目目录并列，非 `{projectId}/` 内）：

| 资源 | 索引 | 媒体文件 | 迁移 |
|------|------|----------|------|
| 素材库 | `{dataRoot}/materials.json` | `{dataRoot}/materials/assets/lib_{uuid}/ref\|gen/` | 懒迁移：`materials:read` / `materials:sync-asset` 触发；标记 `{dataRoot}/materials/.migrated-global-v1.json` |
| 音色库 | `{dataRoot}/voice-library/voice-library.json` | `{dataRoot}/voice-library/voices/voice_{ts}/` | 懒迁移：`voice-library:list` / `voice-library:migrate` 触发；自各项目 `voice-library.json` 合并 |

路径解析：`src/lib/materials/global-materials-paths.ts`、`src/lib/voice/global-voice-library-paths.ts`。

---

## 2. 路由与模块入口（CODEMAP）

定义于 `src/app/router.tsx`。

| 路由 | 页面 | 主要组件 / lib |
|------|------|----------------|
| `/login` | `pages/auth/login-page.tsx` | `lib/auth/auth-service.ts` |
| `/dashboard` | `pages/dashboard/home-page.tsx` | `components/dashboard/` |
| `/workshop` | `pages/workshop/project-list-page.tsx` | `stores/workflow-project-store.ts` |
| `/workshop/:id/step/1~4` | `pages/workshop/step*-*.tsx` | `components/workshop/`、`lib/workflow/` |
| `/canvas` | `pages/canvas/canvas-list-page.tsx` | `stores/canvas-project-store.ts` |
| `/canvas/:projectId` | `pages/canvas/canvas-editor-page.tsx` | `components/canvas/`、`lib/canvas/` |
| `/toolbox` | `pages/toolbox/toolbox-page.tsx` | `components/toolbox/` |
| `/materials/*` | `pages/materials/materials-page.tsx` | `lib/materials/`、`components/materials/` |
| `/settings/*` | `pages/settings/settings-page.tsx` | `stores/settings-store.ts` |

**自动更新**：`components/update/app-update-host.tsx` + `electron/main/ipc-update.ts`  
**发版上传**：`scripts/release.mjs`、`scripts/upload-release.mjs`（见 [`RELEASE.md`](./RELEASE.md)）

---

## 3. IPC 通道清单

Preload 暴露：`window.settingsAPI`、`workflowAPI`、`canvasAPI`、`electronAPI`、`materialsAPI`、`fsAPI`、`voiceAPI`、`mediaAPI`。

### 3.1 settings · `electron/main/ipc-settings.ts`

| Channel | 用途 |
|---------|------|
| `settings:read` / `settings:write` | 全局 settings.json |
| `settings:bind-data-root` | 绑定便携数据根目录 |
| `settings:export-data-root-package` | 导出便携 zip |
| `settings:get-file-path` | settings 文件路径 |
| `dialog:select-directory` | 目录选择对话框 |

### 3.2 workflow · `electron/main/ipc-workflow.ts`

| Channel | 用途 |
|---------|------|
| `workflow:list-projects` | 项目索引 |
| `workflow:create-project` | 新建工坊项目 |
| `workflow:delete-project` | 删除 |
| `workflow:get-project` | 元数据 |
| `workflow:read-data` / `workflow:write-data` | data.json |
| `workflow:update-project` | 元数据 patch |
| `workflow:read-tasks` / `workflow:write-tasks` | tasks.json |
| `workflow:export-project` / `workflow:import-project` | 导入导出 |

### 3.3 canvas · `electron/main/ipc-canvas.ts`

| Channel | 用途 |
|---------|------|
| `canvas:list-projects` | 画布项目索引 |
| `canvas:create-project` | 新建 |
| `canvas:delete-project` | 删除 |
| `canvas:get-project` | 元数据 |
| `canvas:read-data` / `canvas:write-data` | 画布 JSON |
| `canvas:update-project` | 元数据 patch |

### 3.4 fs · `electron/main/ipc-fs.ts`

| Channel | 用途 |
|---------|------|
| `fs:select-image` | 选图 |
| `fs:select-video` / `fs:select-videos` | 选视频 |
| `fs:import-local-image` | 导入本地图 |
| `fs:save-generated-image` | 保存生成图 |
| `fs:read-image-data-url` | 读图 data URL |
| `fs:save-remote-file` | 下载远程文件到 dataRoot |
| `fs:ensure-directories` | 创建目录 |
| `fs:copy-reference-audio` / `fs:copy-media-file` | 复制媒体 |
| `fs:read-audio-data-url` | 读音频 data URL |
| `fs:reveal-path` | 在资源管理器中Reveal |

### 3.5 materials · `electron/main/ipc-materials.ts`

**存储**：全局索引 `{dataRoot}/materials.json`（人物/场景/道具三类）；媒体复制到 `{dataRoot}/materials/assets/lib_{uuid}/ref|gen/`（主进程 `materials-sync.ts`）。条目通过 `sourceProjectId` + `sourceAssetId` 关联来源项目/画布节点，支持重复同步（更新）。

| Channel | 用途 |
|---------|------|
| `materials:read` / `materials:write` | 读/写全局 `materials.json`（读时路径解析为绝对路径） |
| `materials:upsert-entry` | 单条 upsert（按来源项目 + 资产 ID 去重） |
| `materials:sync-asset` | 从工坊/画布资产复制媒体并 upsert（`lib/materials/material-library-service.ts`） |
| `materials:migrate` | 手动触发遗留项目内路径 → 全局库迁移 |
| `materials:remove-entries` | 按 `entryIds` 删除索引条目及 `materials/assets/lib_*` 目录 |

Renderer 封装：`src/lib/materials/materials-index-service.ts`；导入/克隆：`import-material-asset.ts`。

### 3.6 voice · `electron/main/ipc-voice.ts`

**存储**：全局 `{dataRoot}/voice-library/voice-library.json`；参考音频 `{dataRoot}/voice-library/voices/voice_{ts}/reference.{mp3|wav}`。首次访问时从各 workflow/canvas 项目内遗留 `voice-library.json` 合并迁移。

| Channel | 用途 |
|---------|------|
| `voice-library:list` | 全局音色列表（访问时自动迁移） |
| `voice-library:select-reference-audio` | 系统对话框选参考音频 |
| `voice-library:add-voice` | 添加音色（复制音频到全局库） |
| `voice-library:migrate` | 手动触发遗留项目音色合并 |
| `voice-library:fork-entries` | **已废弃**（全局库无需跨项目 fork，固定返回 `forkedCount: 0`） |

### 3.7 更新 · `electron/main/ipc-update.ts`

| Channel | 用途 |
|---------|------|
| `check-for-updates` | 检查更新 |
| `download-update` / `install-update` | 下载并安装 |
| `get-app-version` / `get-update-status` / `get-update-feed-url` | 状态查询 |

事件（preload `electronAPI.on*`）：`update-checking`、`update-available`、`update-not-available`、`update-download-progress`、`update-downloaded`、`update-error`。

### 3.8 剪映 · `electron/main/capcut-export.ts`

| Channel | 用途 |
|---------|------|
| `capcut:export-episode` | 导出剪映草稿 |
| `capcut:resolve-default-drafts-dir` | 默认草稿目录 |
| `capcut:open-drafts-dir` | 打开目录 |

### 3.9 视频拖拽 · `electron/main/video-drag.ts`

| Channel | 用途 |
|---------|------|
| `video:prepare-drag-source` | 单文件拖拽准备 |
| `video:prepare-drag-sources` | 多文件 |
| `video:start-drag` | 开始拖拽（send） |

### 3.10 media · `electron/main/ipc-media.ts`

**Phase 1 能力**：画布视频节点与工坊 Step4 分镜主视频，从**已落盘本地视频**探测音轨/时长，整段或按起止秒提取 mp3，写入当前项目 `voices/`，可选保存到软件音色库（**无**波形、云端抽音）。

**FFmpeg 路径**

| 场景 | 目录 |
|------|------|
| 开发 `electron-vite dev` | `{repo}/vendor/ffmpeg/win/` |
| Windows 打包安装后 | `{process.resourcesPath}/ffmpeg/win/` |

- 配置：`electron-builder.yml` → `extraResources`（`vendor/ffmpeg/win` → `resources/ffmpeg/win`）
- 解析：`electron/main/ffmpeg-paths.ts`
- 首次开发机：`npm run fetch:ffmpeg-win`（二进制不入 git）
- 发版前：`scripts/build-desktop.mjs` 校验 vendor；完整打包验收：`npm run verify:ffmpeg-win-pack`

**主进程模块**

| 文件 | 职责 |
|------|------|
| `ffmpeg-runtime.ts` | `runFfmpeg` / `runFfprobe`、超时与 stderr |
| `ffmpeg-probe.ts` | `probeVideoAudio` → `{ hasAudio, durationSec }` |
| `ffmpeg-extract.ts` | `extractAudio` → mp3；`normalizeExtractRange` 校验起止秒 |
| `ipc-media.ts` | IPC 注册与 payload 规范化 |

**IPC**

| Channel | 用途 |
|---------|------|
| `media:probe-video-audio` | ffprobe 探测 `{ inputPath, projectRoot? }` → `{ hasAudio, durationSec, error? }` |
| `media:extract-audio` | ffmpeg 抽音 `{ inputPath, outputPath, startSec?, endSec?, projectRoot? }` → `{ success, outputAbs?, error? }` |

路径安全：`inputPath` / `outputPath` 经 `resolveReadableMediaPath` / `assertWritableDirUnderDataRoot`（`ipc-path-security.ts`）。

**Renderer 分层**

| 层 | 入口 |
|----|------|
| preload | `window.mediaAPI`（`electron/preload.ts`） |
| 薄 IPC | `src/lib/media/media-service.ts` |
| 项目上下文 | `src/lib/media/extract-audio-from-video.ts`（`probeVideoAudioFromProject`、`extractAudioFromVideo`） |
| 落盘约定 | `src/lib/voice/project-voice-extract-paths.ts` → `voices/extract_{timestamp}/reference.mp3` |
| 音色库（可选） | `src/lib/media/save-extracted-audio-to-voice-library.ts` → 复用 `voice-library:add-voice` |
| 抽音后操作 | `src/lib/media/extract-audio-post-actions.ts`（打开文件夹、路径解析） |
| 起止秒校验（UI） | `src/lib/media/extract-audio-range.ts` |

**UI（Phase 1）**

- **画布**：`canvas-video-node`（hover 角标 / 右键 / 控制台工具栏「提取音频」）
- **工坊 Step4**：`storyboard-video-tab`「提取音频」→ 共用 `CanvasVideoExtractAudioDialog`（`projectKind: 'workflow'`）
- 可用性：画布 `canvas-video-extract-audio.ts`；工坊 `workflow-video-extract-audio.ts`（共用 `video-extract-audio-availability.ts`）
- 对话框：`canvas-video-extract-audio-dialog.tsx`（probe → 整段/截取 → 提取 → 打开文件夹 / 可选入库）

**后续 Phase**：波形截取、自动 @ / 参考条绑定。

---

## 4. 模型与 API 调用（renderer）

| 领域 | 入口 |
|------|------|
| LLM / 图片 | `src/lib/models/`、settings 内模型配置 |
| 视频（多 provider） | `src/lib/video/`（微视、智谱、OpenAI 等） |
| 工坊生视频 | `src/lib/workflow/shot-video-service.ts` |
| 画布生视频 | `src/lib/canvas/canvas-video-task-service.ts` |
| 上传 / 开白 | `src/lib/auth/client-file-service.ts` |
| 任务队列 | `src/stores/task-store.ts`、`src/lib/workflow/task-service.ts` |

业务细节与错误码见仓外 [`../docs/business/`](../docs/business/)（同级目录存在时）。

---

## 5. 参考仓库（可选本地 clone）

| 用途 | 典型路径（本机示例，非必须） |
|------|------------------------------|
| UI 视觉 | `ai-fusion-video/ai-fusion-video-web` |
| 工程规范 | `moyin-creator` |
| 功能 ID | `weeek-work` |

无参考仓时：以本仓库 `src/` 与 `docs/` 为准，UI 复刻 Tier 3 任务可能无法执行。

---

## 6. 相关文档

- 分期与功能 ID：[`PROJECT_BLUEPRINT.md`](./PROJECT_BLUEPRINT.md)
- 画布模块：[`CANVAS_MODULE_REVIEW_AND_CHECKLIST.md`](./CANVAS_MODULE_REVIEW_AND_CHECKLIST.md)
- 自测：[`TESTING.md`](./TESTING.md)
