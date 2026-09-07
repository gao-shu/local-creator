# Tasks: add-toolbox-script-create

> 交互真源：`design.md` → Product UX / Interaction Spec。实现不得回退成「默认双栏参数墙 + 三模式一级 Tab」。

## Phase 0 — 可验证 MVP

### 0.1 基础设施

- [ ] 0.1.1 扩展 `ToolboxToolModal`：可选 `maxHeightClassName`（默认保持现有高度）
- [ ] 0.1.2 `types.ts`：Draft、默认 params、UI 状态 `empty | generating | result | error`
- [ ] 0.1.3 `draft-storage.ts`：localStorage 单份读写
- [ ] 0.1.4 `serialize.ts`：trim、截断 `SCRIPT_MAX_LENGTH`、导出文件名
- [ ] 0.1.5 `prompt.ts`：灵感生成模板（可拍/分场/对白短/默认 60s 竖屏漫剧）
- [ ] 0.1.6 `generate.ts`：`pickMergedLlmModel` + `callChatCompletions` + AbortController
- [ ] 0.1.7 `parse-preview.ts`：从 Markdown 解析摘要；失败降级不抛硬错

### 0.2 工具注册与壳

- [ ] 0.2.1 `toolbox-page.tsx` 注册 `script-create`，标题「剧本创作」，描述「一句话生成可拍剧本，一键送进创作工坊」
- [ ] 0.2.2 卡片 **AI 角标**（或等价视觉区分于本地工具）
- [ ] 0.2.3 Modal：`max-w-5xl` + 加高；挂载 `ScriptCreateTool`

### 0.3 空态 UI（单栏主路径）

- [ ] 0.3.1 主提问「想拍一个什么故事？」+ 大 Textarea + 占位文案
- [ ] 0.3.2 默认条件芯片（60秒·竖屏·漫剧·单集）+「改条件」折叠面板（时长/集数/类型/题材/平台）
- [ ] 0.3.3 主按钮「生成剧本」+ AI 耗时/消耗小字提示
- [ ] 0.3.4 三个示例芯片一键填入完整示例句
- [ ] 0.3.5 未配置模型：空态引导条 +「去配置模型」；生成禁用或同引导
- [ ] 0.3.6 空创意校验 toast

### 0.4 生成中 / 错误

- [ ] 0.4.1 生成中骨架（标题/角色/场次灰条）+「正在写分场剧本…大约还要半分钟」
- [ ] 0.4.2 取消按钮 abort；禁用送工坊
- [ ] 0.4.3 失败可读错误 + 重试；保留旧全文
- [ ] 0.4.4 生成中关 Modal 二次确认，确认后 abort

### 0.5 结果态

- [ ] 0.5.1 只读摘要卡（标题/卖点/时长/场次列表；解析失败降级）
- [ ] 0.5.2 标题输入 + 全文 Textarea 真源 + 字数 n/50000
- [ ] 0.5.3 底栏：次级「复制」「导出 txt」「再生成」；主 CTA「送入创作工坊 →」视觉最重
- [ ] 0.5.4 再生成：同参请求；全文有本地修改时确认覆盖

### 0.6 草稿 / 复制 / 导出

- [ ] 0.6.1 打开 hydrate；编辑 debounce autosave
- [ ] 0.6.2 复制全文 + toast
- [ ] 0.6.3 导出 `.txt`

### 0.7 送入创作工坊

- [ ] 0.7.1 校验非空且非 generating
- [ ] 0.7.2 标题优先级：标题字段 > 解析标题 > 创意 20 字 > 未命名剧本
- [ ] 0.7.3 `createWorkflowProject` + session load + `patchData({ script })` + 必要 save
- [ ] 0.7.4 关闭 Modal + `navigate(/workshop/:id/step/1)`
- [ ] 0.7.5 成功 toast：剧本已就绪，可下一步分集
- [ ] 0.7.6 dataRoot/创建失败处理；草稿不强制清空

### 0.8 Phase 0 验收

- [ ] 0.8.1 默认不展开「改条件」也能完成生成
- [ ] 0.8.2 有 AI 角标与模型空态引导
- [ ] 0.8.3 生成中可取消；关窗有确认
- [ ] 0.8.4 结果摘要只读、改全文影响复制/导出/送工坊
- [ ] 0.8.5 主 CTA 送工坊后 Step1 文案一致
- [ ] 0.8.6 重开 Modal 草稿恢复
- [ ] 0.8.7 无「三模式一级 Tab」、无双写结构化编辑器

---

## Phase 1 — 可用增强

### 1.1 次级模式（非一级 Tab 抢主路径）

- [ ] 1.1.1 「更多方式」进入素材改编 / 润色改写
- [ ] 1.1.2 改编：粘贴 + 可选 `extractScriptTextFromFile`
- [ ] 1.1.3 润色：改写目标芯片；结果态「再短一点」走润色管道
- [ ] 1.1.4 对应 prompt 模板

### 1.2 预览与工坊增强

- [ ] 1.2.1 摘要解析增强（角色表等）
- [ ] 1.2.2 送工坊可选 `EpisodeStyle` → `patchData({ style })`
- [ ] 1.2.3 时长粗检提示

### 1.3 Phase 1 验收

- [ ] 1.3.1 主路径仍是一句话生成，次级模式可发现
- [ ] 1.3.2 带 style 送工坊正确
- [ ] 1.3.3 回归 Phase 0 验收

---

## 明确不在本 Change

- [ ] ~~历史草稿列表 / 我的剧本~~
- [ ] ~~覆盖当前工坊项目~~
- [ ] ~~预填 episodes[]~~
- [ ] ~~LLM streaming~~
- [ ] ~~docx 导出~~
- [ ] ~~settings scriptTemplates~~
- [ ] ~~画布分镜直连~~
- [ ] ~~默认双栏参数专业台~~
- [ ] ~~摘要与全文双写~~
