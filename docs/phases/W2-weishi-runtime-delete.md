# W2 · 微视运行时管道删除

> 仓库：`local-creator` · 前置：W0 清单、W1 产品面

## 目标

删除微视 / `weishi_api` 运行时管道与整文件，生视频仅走 OpenAI 兼容 / 智谱 / Grok / Agnes 等非微视客户端。

## 已完成

### 整文件删除（此前 + 本阶段收尾）

- `src/lib/models/weishi-*.ts`（catalog / client / asset / cache / overlay / preflight / presets）
- `src/lib/workflow/weishi-video-prompt.ts`、`src/lib/canvas/canvas-weishi-video-utils.ts`、`src/lib/auth/org-weishi-key.ts`（若仍存在）
- `src/components/workshop/weishi-video-confirm-dialog.tsx`
- `src/lib/workflow/shot-storyboard-review-service.ts`（含 stub）

### 运行时与类型

- `video-provider` / 各 video client：无微视分支
- 工坊确认弹窗改为通用 `video-request-confirm-dialog`
- `WorkflowAsset` / `WorkflowShot`：去掉 `weishiAsset*`、`weishiUploadedMedia`
- `asset-utils` / `shot-utils` / `project-media-paths` / 画布角色图：不再读写微视字段
- 设置读盘仍剔除历史已下线视频 API 格式（字符串拆写，避免源码直出敏感标识）

### 文案

- `release-changelog` 与业务注释中的「微视」已中性化

## 验收

```text
# 在 local-creator 根目录
# src / electron 应对「微视|weishi|WEISHI|Weishi|weishi_api」零命中
npm run compile
```

- [x] `src` + `electron` 业务 rg 零命中（`docs/`、`scripts/` 除外；scripts → W2b）
- [x] `npm run compile` 通过（本阶段执行）

## 不在本阶段

- **W2b**：`scripts/` 清扫
- **W3**：本机 `LocalCreator/settings.json` 清洗
- **W4**：默认模型对齐 Agnes + 拾光
- **W5**：mock e2e + 手测

## 下一步

指挥：`执行 W4`（开箱默认复核）或 `执行 W5` / `执行 W2b`。
