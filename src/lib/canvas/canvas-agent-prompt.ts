// Copyright (c) Haode AI. All rights reserved.

import type { CanvasAgentNodeSummary, CanvasAgentSkill } from '@/lib/canvas/canvas-agent-types'

/** 系统提示词：定义 System / User / Assistant 角色与 Skill 能力边界 */
export function buildCanvasAgentSystemPrompt(options: {
  skills: CanvasAgentSkill[]
  selectedNodes: CanvasAgentNodeSummary[]
}): string {
  const skillBlock = options.skills
    .map(
      (skill) =>
        `- ${skill.label}（id: ${skill.id}）：${skill.hint}${skill.expensive ? '；会触发生成任务' : ''}`,
    )
    .join('\n')

  const contextBlock =
    options.selectedNodes.length > 0
      ? options.selectedNodes
          .map((node) => {
            const parts = [
              `节点「${node.displayName || node.label}」`,
              `类型=${node.type}`,
              node.entityName ? `实体=${node.entityName}` : null,
              node.hasOutput ? '已有输出' : '尚无输出',
              node.prompt ? `当前描述=${node.prompt.slice(0, 200)}` : '当前描述为空',
            ].filter(Boolean)
            return `- ${parts.join('；')}`
          })
          .join('\n')
      : '- 当前未选中任何节点'

  return [
    '你是「AI 画布助手」，嵌入在 AI 影视/漫创桌面工具的画布编辑器中。',
    '',
    '## 对话角色',
    '- System（系统）：本提示词，定义你的身份、能力与边界',
    '- User（用户）：创作者/导演，提出创作问题或修改需求',
    '- Assistant（助手）：你，负责解答、引导；仅在用户于界面确认后才执行会消耗资源的 Skill',
    '',
    '## 内置 Skill（用户确认后由客户端执行，你不要假装已执行）',
    skillBlock,
    '',
    '## 当前画布上下文',
    contextBlock,
    '',
    '## 回复要求',
    '1. 使用简洁、专业的中文，语气友好',
    '2. 普通问答（身份介绍、流程说明、创作建议）直接回答',
    '3. 涉及改图/改视频/审分镜时：说明需选中对应节点，并引导用户切换到对应 Skill；Chat 模式不要假装已执行',
    '4. 不要编造已完成的生成结果；不要输出 markdown 代码块包裹整段回复',
    '5. 回答长度适中，重点清晰；可主动推荐合适的 Skill',
  ].join('\n')
}

/** review_storyboard：要求模型只返回结构化 JSON */
export function buildCanvasStoryboardReviewPrompt(options: {
  nodes: CanvasAgentNodeSummary[]
  userInstruction?: string
}): string {
  const nodeBlock = options.nodes
    .map((node, index) => {
      const name = node.displayName || node.label || node.id
      return [
        `### 镜头/节点 ${index + 1}`,
        `id: ${node.id}`,
        `type: ${node.type}`,
        `name: ${name}`,
        `hasOutput: ${node.hasOutput ? 'yes' : 'no'}`,
        'prompt:',
        node.prompt?.trim() || '（空）',
      ].join('\n')
    })
    .join('\n\n')

  const extra = options.userInstruction?.trim()
    ? `\n用户补充关注点：${options.userInstruction.trim()}\n`
    : ''

  return [
    '你是漫剧分镜审核助手。根据下列画布节点内容做只读审核。',
    '不要修改镜头，不要建议立即重新生成视频（生成昂贵，由用户自行确认）。',
    '重点检查：镜头逻辑、空间关系、人物一致性、动作连贯、提示词空洞或矛盾。',
    extra,
    '节点列表：',
    nodeBlock,
    '',
    '请只输出一个 JSON 对象（不要 markdown，不要解释），字段如下：',
    '{',
    '  "status": "pass" | "reject",',
    '  "score": 0-100 的整数,',
    '  "summary": "一句话总评",',
    '  "issues": [',
    '    { "type": "shot_logic|continuity|character|prompt|other", "severity": "low|medium|high", "message": "...", "suggestion": "..." }',
    '  ]',
    '}',
    '若无明显问题：status 为 pass，issues 可为空数组。',
  ].join('\n')
}