// Copyright (c) local-creator contributors. All rights reserved.

/**
 * 画布视频镜头正文拼装（对齐工坊 [spatialAnchor, prompt]）。
 *
 * 兼容（A5）：
 * - 仅认显式 `spatialAnchor` 字段，不对历史「已糊进 prompt」的字符串做自动拆分。
 * - 旧节点无独立锚点时行为与改前一致（正文 = prompt）。
 * - 新导入 / 智能分镜 / 分镜稿：写入侧拆字段，读出侧再 compose。
 *
 * P0 红线 DoD（C）：
 * 1. 不新增第二份 spatial / validate system prompt；复用 `lib/workflow/storyboard-prompt`。
 * 2. continuity issues 类型复用 `ParsedValidateIssue`，禁止本地再定义一份 interface。
 * 3. 微视 / 计费生视频路径不 fork；只在 shotBody 层 compose。
 */
export function composeCanvasVideoShotBody(data: {
  spatialAnchor?: string | null
  prompt?: string | null
}): string {
  return [data.spatialAnchor, data.prompt]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}
