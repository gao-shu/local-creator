# 去拾光内置预设

> 日期：2026-09-10 · 仓库：`local-creator`

## 背景

「拾光」并非独立视频管道，仅是 W4 写入的 **OpenAI 兼容内置项**（`builtin-shiguang-minimax-h3` + 默认 `127.0.0.1:3300`）。

## 变更

- 删除 `BUILTIN_SHIGUANG_VIDEO` / `DEFAULT_LOCAL_COMPAT_PROXY`
- 开箱 `videoModels: []`；视频默认 ID 取用户已有列表首项（无则空）
- 读盘剔除历史 `builtin-shiguang-minimax-h3`
- Agnes 图内置不再预填 3300（endpoint 空，用户自填）
- 设置页文案去掉「拾光」
- `docs/00-decisions.md` 测试矩阵：视频改为用户自配

## 保留

- 通用 OpenAI / 智谱 / Grok / Agnes video 客户端与路由不变
- 本机 `settings.json` 里用户自己添加的「拾光」自定义项（UUID）**不自动删除**；仅去掉产品内置

## 验收

```text
rg -n "拾光|shiguang|SHIGUANG|minimax_h3|127.0.0.1:3300" src
npm run compile
```
