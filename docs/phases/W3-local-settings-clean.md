# W3 · 本机 settings 清洗

> 仓库：`local-creator` · 前置：W2  
> **不入库**：仅改本机 `LocalCreator/settings.json`

## 目标

本机配置无微视模型项；默认指向 Agnes（LLM/图）与拾光（视频）。

## 路径

- 活动配置：`D:\Backup\Documents\LocalCreator\settings.json`
- 备份：`settings.json.w3-bak-20260910-154646`（同目录）

## 已完成

| 动作 | 结果 |
|------|------|
| 删除 `apiFormat === weishi_api` 视频模型 | 已删「微视API」`8d0bcda4-…` |
| 删除字段 `weishiReferenceMediaUploadMode` | 已删 |
| `defaultLlmModelId` 等 → Agnes | `builtin-agnes-2.5-flash` |
| `defaultImageModelId` 等 → Agnes 图 | `bb837c65-…`（agnes-image-2.1-flash） |
| `defaultVideoModelId` / 分镜上次视频 → 拾光 | `f4287cfa-…`（minimax_h3） |
| 全文无 `微视|weishi` | `verify_raw_hits=0` |
| Key / endpoint | 拾光项仍保留本机 Key（未写入 git） |

视频模型剩余 5 条：智谱 flash、agnes-ai、grok、Agnes video flash、拾光 minimax_h3。

## 验收

- [x] settings 无 weishi / 微视字符串
- [x] 无 `weishi_api` 模型
- [x] 默认 LLM / 图 / 视频已对齐清单 §4
- [x] 未提交 settings；备份保留可回滚

## 下一步

- **W4**：代码侧开箱默认（若新用户空 settings）与 W3 本机对齐复核  
- 或 **W2b** / **W5**
