# Change: add-toolbox-script-create

## Why

创作者常有「一句话灵感」，需要快速产出可拍摄剧本，但不想立刻创建完整工坊项目、走完四步流水线。

现有能力缺口：
- 工具箱仅有本地媒体工具（视频合并、图片裁剪），无 AI 出稿能力
- 创作工坊 Step1 支持剧本编辑/导入，**不提供 AI 生成**
- 蓝图明确不做独立「我的剧本」入口；剧本成功态应落在工坊工作流内

因此在工具箱增加**轻量 AI 剧本生成器**：一句话出稿 → 扫读/微调 → 送入工坊，补齐「灵感到可制作」最短路径。

## What Changes

### 产品体验（优先）

- 卡片「剧本创作」+ **AI** 角标；描述：*一句话生成可拍剧本，一键送进创作工坊*
- **默认空态单栏**：大输入 + 默认条件芯片（60秒·竖屏·漫剧·单集）+「改条件」展开；**不是**一上来双栏参数墙
- 三个示例创意一键填入；未配置模型时空态引导去设置
- 生成中：耗时预期文案 + 骨架 + 可取消（非流式）
- 结果态：**只读摘要**（标题/卖点/场次扫读）+ **可编辑全文真源** + 底栏
- 底栏唯一主 CTA：**送入创作工坊**；复制 / 导出 txt 为次级
- 本地单份草稿 autosave；不做剧本库

### 工程范围

- `ScriptCreateTool` + `lib/toolbox/script-create/*`
- Modal 加宽加高
- LLM：`callChatCompletions` + `consume_script` + AbortSignal
- 送工坊：新建项目写入 `script` → `/workshop/:id/step/1`

### 分期

- **Phase 0**：灵感生成主路径（上表体验）+ 复制/导出/草稿/送工坊
- **Phase 1**：更多方式（改编/润色）、EpisodeStyle 可选、时长粗检等

### 非目标

独立剧本库、覆盖当前工坊项目、docx、streaming、预填 `episodes[]`、画布直连、设置页 `scriptTemplates`、打开即三模式并列 Tab、摘要与全文双写编辑

## Impact

- Affected specs: `toolbox`、`toolbox-script-create`（新）
- Affected code（预期）:
  - `src/pages/toolbox/toolbox-page.tsx`
  - `src/components/toolbox/toolbox-tool-modal.tsx`
  - `src/components/toolbox/script-create-tool.tsx`（新）
  - `src/lib/toolbox/script-create/*`（新）
  - 复用 llm-client、workflow-service、workflow-session-store、SCRIPT_MAX_LENGTH
- 产品边界：与蓝图「不做我的剧本独立入口」兼容
- 详细交互与文案：见同目录 `design.md` → **Product UX / Interaction Spec**

## Success Metrics

| 指标 | 说明 |
|------|------|
| 生成完成率 | 点生成 → 有正文 |
| **送工坊转化率** | 北极星：有正文 → 进工坊 |
| **送工坊后 Step2 操作率** | 剧本可制作性 |
| 复制/导出率 | 逃生舱 |
| 二次打开草稿率 | 半成品编辑是否成立 |
