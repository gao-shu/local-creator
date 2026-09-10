# W0 · 微视删除清单与验收表

> 日期：2026-09-08 · 阶段：**仅盘点，本文件产出后不算已删代码**  
> 原则：**整条删除** `weishi_api` / 「微视」品牌与审核管道；**不是**再清空 IP 或长期隐藏。  
> 测试矩阵（已锁定）：文本/图片 = **Agnes**；视频 = **拾光 · minimax_h3**（OpenAI 兼容路径）。

## 0. 为何还在

P2 删除的是好豆 / 微信 / 公司后端代理；微视曾被当作「用户自备网关」保留，故：

- 独立模块文件（`weishi-*.ts(x)`）
- `apiFormat: 'weishi_api'` 全链路
- 角色 `/v1/assets` 审核、`asset://`、确认弹窗
- 工坊 Step3/4、画布生视频分支
- 本地 `settings.json` 内可能仍有微视模型项

旧文档 `delete-inventory.md` §D「微视可保留」**已作废**，以本文 + `00-decisions.md` 为准。

## 1. 决策锁定（W0）

| # | 决策 | 说明 |
|---|------|------|
| W0-1 | 删除微视整域 | 含文案「微视」、`weishi_*` 标识、专用 client/UI |
| W0-2 | 不保留兼容壳 | 不做 `isWeishiApiModel() => false` 长期桩 |
| W0-3 | 视频保留非微视 provider | OpenAI 兼容（拾光）、Agnes video、智谱、Grok 等按现有逻辑保留 |
| W0-4 | 审核字段 | `weishiAsset*` / `weishiUploadedMedia`：读忽略或迁移剥掉，不再写入 |
| W0-5 | 测试默认 | LLM/图片 → Agnes；视频 → 拾光 minimax_h3（本机配置，**不入库**） |
| W0-6 | scripts | 含微视的计费/probe 脚本：W2b 删除或移出，不阻塞主路径 compile |

## 2. 整文件删除候选（W1～W2）

| 路径 | 职责 | 建议阶段 |
|------|------|----------|
| `src/lib/models/weishi-model-presets.ts` | 预设 / `isWeishiApiModel` | W1 断引用后删 |
| `src/lib/models/weishi-model-catalog.ts` | 微视 catalog | W2 |
| `src/lib/models/weishi-video-client.ts` | 生视频 client | W2 |
| `src/lib/models/weishi-asset-service.ts` | `/v1/assets` 审核上传 | W2 |
| `src/lib/models/weishi-shot-media-cache.ts` | 分镜微视媒体缓存 | W2 |
| `src/lib/models/weishi-capability-overlay.ts` | 能力叠加 / 假档清洗 | W2 |
| `src/lib/models/weishi-video-preflight.ts` | 入参上限 | W2 |
| `src/lib/workflow/weishi-video-prompt.ts` | 微视提示词拼装 | W2 |
| `src/lib/canvas/canvas-weishi-video-utils.ts` | 画布微视工具 | W2 |
| `src/lib/auth/org-weishi-key.ts` | 微视 Key 解析 | W2 |
| `src/components/settings/weishi-model-config-fields.tsx` | 设置表单微视字段 | W1 |
| `src/components/workshop/weishi-video-confirm-dialog.tsx` | 生视频确认弹窗 | W2 |

另：`src/lib/storage/settings-defaults.ts` 内 `BUILTIN_WEISHI_VIDEO` / `ensureBuiltinWeishiVideo` / `stripStaleCompanyWeishiUrls` → **删除或改为通用陈旧 URL 清洗（不含微视品牌）**（W1）。

## 3. 必须改断的集成点（按域）

### 3.1 设置 / 模型预设

| 文件 | 动作 |
|------|------|
| `video-model-presets.ts` | 去掉 `weishi_api` 预设键与 picker |
| `image-model-presets.ts` | 去掉 weishi 文案分支 |
| `model-config-dialog.tsx` / `models-tab.tsx` / `video-model-extra-fields.tsx` / `system-tab.tsx` | 去掉微视 UI/分支 |
| `model-select-options.ts` / `model-test-service.ts` / `video-model-utils.ts` | 去掉 weishi 特殊逻辑 |

### 3.2 视频分发

| 文件 | 动作 |
|------|------|
| `video-provider.ts` | 删除 `'weishi'` provider |
| `video-client.ts` / `video-remote-job.ts` / `openai-video-client.ts` / `zhipu-video-client.ts` / `grok-video-client.ts` | 去掉 weishi 分支与注释耦合 |
| `video-media-resolve.ts` / `video-api-reference.ts` / `video-progress.ts` | 同上 |
| `video-generation-tier-params.ts` | 去掉微视 catalog 特例 |

### 3.3 工坊

| 文件 | 动作 |
|------|------|
| `step3-assets-page.tsx` / `character-review-service.ts` / `asset-review-status.ts` / `asset-utils.ts` | 去掉微视审核通道 |
| `step4-storyboard-page.tsx` / `shot-video-service.ts` / `shot-video-utils.ts` / `shot-utils.ts` | 去掉微视生视频 / 媒体上传分支 |
| `shot-storyboard-review-service.ts` | 微视开白审核删除或改为「不支持则提示换模型」 |
| `storyboard-video-presets.ts` / `reference-*-upload.ts` / `project-media-paths.ts` / `storyboard-shot-status-hint.ts` | 清 weishi |
| `asset-detail-panel.tsx` / `asset-image-gallery.tsx` / `storyboard-*` 相关 | 清文案与盾牌微视态 |

### 3.4 画布

| 文件 | 动作 |
|------|------|
| `canvas-editor-context.tsx` / `canvas-workflow.tsx` / `canvas-run-service.ts` | 去掉微视预览/确认/运行分支 |
| `canvas-video-generate-preview.ts` / `canvas-video-resume-service.ts` / `canvas-video-prompt.ts` / `canvas-mention-utils.ts` / `canvas-image-character.ts` | 清 weishi |
| `canvas-video-node.tsx` / `canvas-image-character-overlay.tsx` | 清 weishi |

### 3.5 类型

| 文件 | 字段/类型 | 动作 |
|------|-----------|------|
| `types/settings.ts` | `weishiAssetWhitelistEnabled` 等 | 删除 |
| `types/workflow.ts` | `weishiAsset*`、`weishiUploadedMedia`、`WeishiShotMediaEntry` | 删除或一次性迁移后删除 |
| `types/canvas-nodes.ts` / `material-library.ts` | `weishiAsset*` | 同上 |
| `types/video-remote-job.ts` | 微视相关注释/字段 | 清理 |

### 3.6 Electron / 其它

| 文件 | 动作 |
|------|------|
| `electron/main/ipc-settings.ts` / `materials-sync.ts` | 去掉 weishi 字段同步 |
| `api-base.ts` | 可保留「陈旧公司 host」正则，但不必再出现「微视」产品名 |
| `batch-concurrency.ts` / `release-changelog.ts` | 文案清理（changelog 可改写历史条目） |

### 3.7 scripts（W2b，可后置）

命中文件包括但不限于：`smoke-system-model-billing.ts`、`test-video-capability-g4.ts`、`test-video-model-pricing-5*.ts`、`probe-*.mjs`、`billing-call-*.ts`、`canvas-e1-fixtures.mjs` 等。  
**主路径 `npm run compile` 不依赖它们**；公开开源前再清。

## 4. 本机数据（W3，不入库）

路径：`D:\Backup\Documents\LocalCreator\settings.json`（及 pointer）。

| 动作 | 说明 |
|------|------|
| 删除所有 `apiFormat === 'weishi_api'` 的 video 模型 | 含已清空 URL 但仍叫「微视API」的项 |
| 默认 LLM / 图片 → Agnes（已有 Key 的项） | 与 W0-5 一致 |
| 默认视频 → 拾光 · minimax_h3 | 确认 endpoint（常为本机 `localhost:3300` 代理）可用 |
| 不提交 settings | Key 仅本机 |

## 5. 阶段映射（指挥用）

| 阶段 | 内容 | 验收摘要 |
|------|------|----------|
| **W0** | 本文 | 决策无歧义；清单可勾选 |
| **W1** | 产品面：预设/UI/内置/文案入口 | 设置无「微视」；compile | **已完成**见 [phases/W1-weishi-product-surface.md](phases/W1-weishi-product-surface.md) |
| **W2** | 运行时删管道 + 整文件删除 | 见 §6 rg；生视频走非微视 | **已完成**见 [phases/W2-weishi-runtime-delete.md](phases/W2-weishi-runtime-delete.md) |
| **W2b** | scripts 清扫 | scripts 无微视业务依赖 |
| **W3** | 本机 settings 清洗 | LocalCreator 无 weishi 模型项 | **已完成**见 [phases/W3-local-settings-clean.md](phases/W3-local-settings-clean.md) |
| **W4** | 默认模型对齐 Agnes + 拾光 | 开箱默认正确 | **已完成**见 [phases/W4-default-agnes-shiguang.md](phases/W4-default-agnes-shiguang.md) |
| **W5** | compile + mock e2e（方案 1）+ 手测 Agnes/拾光 | 见 §7 | **自动部分完成**见 [phases/W5-verify.md](phases/W5-verify.md)；手测待确认 |

## 6. 总验收 rg（W2 完成时）

在 `local-creator` 根目录：

```text
rg -n "微视|weishi|WEISHI|Weishi|weishi_api" src electron
```

**期望：** `src/`、`electron/` **零业务命中**。  
允许例外（若暂留须在 PR 说明）：

- 无（目标为零）
- `docs/`、`docs/upstream-haode/` 历史镜像可后清
- `scripts/` 允许拖到 W2b

补充：

```text
rg -n "weishiAsset|weishiUploaded|isWeishiApiModel|WEISHI_API" src
```

期望：零命中。

## 7. W5 功能验收（与自动化）

| 项 | 标准 |
|----|------|
| `npm run compile` | 退出码 0 |
| Mock E2E 方案 1 | `test:e2e:smoke` 通过；可选再加 `workshop-project-create`、`canvas-list-smoke` / `canvas-project-create` |
| 手测 LLM | Agnes 可完成一轮对话/工坊文本步骤 |
| 手测图片 | Agnes 生图成功 |
| 手测视频 | 拾光 minimax_h3 生视频成功（代理需就绪） |
| UI | 全局搜索无「微视」用户可见文案 |

**不做（本轮）：** Live API 自动化套件（方案 2）。

## 8. 风险与注意

1. **删除面大**：Step4 / 画布与微视确认弹窗耦合深，W2 建议拆 `W2.1 断入口 → W2.2 删 client → W2.3 删 UI 文件`。  
2. **旧项目数据**：含 `weishiUploadedMedia` 的分镜可能丢审核态；生成仍应走 OpenAI/拾光。  
3. **Mock E2E**：不依赖微视；W1 后即可跑一轮防回归。  
4. **禁止**向 `haode-ai-client` 回写；只改 `local-creator`。

## 9. W0 完成勾选

- [x] 决策表写入本文 §1  
- [x] 整文件删除列表 §2  
- [x] 集成改断列表 §3  
- [x] 本机数据动作 §4  
- [x] 阶段映射与 rg 验收 §5～§6  
- [ ] 负责人确认后指挥 `执行 W1`（或 `执行 W2.1`）

---

**下一步指挥：** `执行 W1`（推荐）或先 `执行方案 1`（mock e2e，与删微视并行探回归）。
