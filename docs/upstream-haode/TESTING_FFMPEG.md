# 画布 / 工坊视频抽音（FFmpeg）测试

> **更新日期**：2026-09-02  
> **范围**：画布视频节点 + 工坊 Step4 生视频 Tab · 本地已落盘视频 · mp3 · Windows 捆绑 FFmpeg。  
> 架构见 [`ARCHITECTURE.md`](./ARCHITECTURE.md) §3.10 · 发版勾选 [`FULL_REGRESSION_CHECKLIST.md`](./FULL_REGRESSION_CHECKLIST.md)

**`verify:full` 仅跑 Layer A**（`test:ffmpeg-layer-a`，6 项）。其余按需单跑。

**baseline**：Layer A 已于 2026-09-02 全绿（含 Windows `test-ffmpeg-extract`），见 CHECKLIST §0.5。

---

## 1. 自动化

**前置（仅 Windows 发版 / 打包验收）**：`vendor/ffmpeg/win/ffmpeg.exe` 与 `ffprobe.exe`（`npm run fetch:ffmpeg-win` 或手动放入）。

```bash
# Layer A（verify:full 已含）
npm run test:ffmpeg-layer-a
# 或逐项：
npm run test:ffmpeg-bundle
npm run test:ffmpeg-runtime
npm run test:ffmpeg-probe
npm run test:ffmpeg-extract
npm run test:media-ipc
npm run test:extract-audio-from-video

# Layer B（= package.json test:ffmpeg-layer-b）：改抽音入口 / 音色库 / 范围校验
npm run test:ffmpeg-layer-b
# 或逐项：
npm run test:project-voice-extract-paths
npm run test:save-extracted-voice-library
npm run test:canvas-video-extract-audio
npm run test:workflow-video-extract-audio
npm run test:extract-audio-range
npm run test:extract-audio-post-actions

# 编译
npm run compile

# Layer C：Windows 打包产物含可执行 FFmpeg（仅 win32）
npm run verify:ffmpeg-win-pack
```

| 脚本 | 覆盖 |
|------|------|
| `test:ffmpeg-bundle` | 开发 vendor 目录是否就绪 |
| `test:ffmpeg-runtime` | spawn / 超时 / 退出码 |
| `test:ffmpeg-probe` | ffprobe 解析音轨与时长 |
| `test:ffmpeg-extract` | 抽音参数与 range 规范化 |
| `test:media-ipc` | IPC channel 契约 |
| `test:extract-audio-from-video` | 项目路径 + 落盘约定 |
| `test:project-voice-extract-paths` | `voices/extract_{ts}/reference.mp3` |
| `test:save-extracted-voice-library` | 音色库入库校验（1.8–15.2 秒） |
| `test:canvas-video-extract-audio` | 画布节点入口可用性判定 |
| `test:workflow-video-extract-audio` | 工坊 Step4 分镜主视频入口可用性 |
| `test:extract-audio-range` | UI 起止秒校验 |
| `test:extract-audio-post-actions` | 抽音成功后路径解析 |
| `verify:ffmpeg-win-pack` | `electron-builder --win dir` + `resources/ffmpeg/win` + `-version` |

---

## 2. 手工验收（桌面客户端 · 约 10 分钟）

**前置**：Windows 开发或打包版；画布项目内至少一个**本地成片**视频节点（非 `preview:` / 非远程 URL）；`vendor/ffmpeg/win` 或安装包内 FFmpeg 可用。

| # | 场景 | 操作 | 预期 |
|---|------|------|------|
| 1 | 入口禁用 | 无成片 / 生成中 / 远程未落盘 | 「提取音频」禁用，tooltip 说明原因 |
| 1b | 工坊 Step4 | 右栏生视频 Tab →「提取音频」 | 与画布相同对话框；写入当前工坊项目 `voices/` |
| 2 | 探测 | 打开提取对话框 | 显示时长、是否有音轨；无音轨时不可提取 |
| 3 | 整段提取 | 整段 → 开始提取 | `{project}/voices/extract_*/reference.mp3` 生成；toast 成功 |
| 4 | 截取 | 指定起止秒（结束留空=片尾） | mp3 时长符合区间；非法起止有错误提示 |
| 5 | 打开文件夹 | 提取成功后点「打开文件夹」 | 资源管理器定位到 `reference.mp3` |
| 6 | 音色库（可选） | 编辑名称 →「保存到音色库」 | 1.8–15.2 秒内入库成功；超长/过短有错误 |
| 7 | 打包版 | 安装包内抽音（非 dev vendor） | probe + 提取均正常 |

**Fresh clone**：先 `npm run fetch:ffmpeg-win`（失败时可手动下载 exe 到 `vendor/ffmpeg/win/`）。
