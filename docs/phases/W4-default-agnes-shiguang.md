# W4 · 开箱默认 Agnes + 拾光

> 仓库：`local-creator` · 前置：W3 本机清洗

## 目标

空 settings / 新安装开箱：文本与图片默认 **Agnes**，视频默认 **拾光 · minimax_h3**（OpenAI 兼容，默认指向本机 `127.0.0.1:3300`）。

## 已完成

### `settings-defaults.ts`

- 内置三项：`builtin-agnes-2.5-flash`、`builtin-agnes-image-2.1-flash`、`builtin-shiguang-minimax-h3`
- `createDefaultSettings`：填充三类模型列表，并写入 `default*` / `lastUsed*` 指向上述 ID
- 读盘 `ensureDefaultModelIds`：确保三内置存在；剔除已下线视频格式；无效默认回退到内置
- 同步内置公开字段时**保留用户已填 Key**（及非强制时的 endpoint）

### `software-model-prefs.ts`

- 图片 / 视频解析与 LLM 一致：优先 `default*ModelId`，再 `lastUsed*`

## 验收

- [x] 新默认 settings：LLM=Agnes，图=Agnes，视频=拾光
- [x] `npm run compile` 通过
- [ ] 手测填 Key 后一轮生成 → **W5**

## Key 说明

内置项 `apiKey` 默认为空，**不入库真实 Key**；用户本机填写或沿用 W3 已有自定义项。

## 下一步

指挥：`执行 W5`（compile + mock e2e + 手测）或 `执行 W2b`（scripts）。
