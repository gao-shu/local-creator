// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { ModelConfig } from '@/types/settings'
import type {
  CanvasImageNodeData,
  CanvasReferenceImageNodeData,
  CanvasVideoNodeData,
} from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { callChatCompletions, callChatCompletionsWithMessages } from '@/lib/models/llm-client'
import { shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'
import { getNodeDisplayLabel } from '@/lib/canvas/canvas-group-utils'
import { resolveCanvasImageDisplayName } from '@/lib/canvas/canvas-image-role'
import { resolveCanvasVideoDisplayName } from '@/lib/canvas/canvas-video-naming'
import { resolveCanvasImageNodePrompt, resolveCanvasVideoNodeShotBody } from '@/lib/canvas/canvas-graph-utils'
import { buildCanvasAgentSystemPrompt } from '@/lib/canvas/canvas-agent-prompt'
import {
  CANVAS_AGENT_SKILLS,
  getCanvasAgentSkillDefinition,
} from '@/lib/canvas/canvas-agent-skill-registry'
import type {
  CanvasAgentMessage,
  CanvasAgentNodeSummary,
  CanvasAgentSkillId,
} from '@/lib/canvas/canvas-agent-types'
import type { CanvasPromptNodeData } from '@/types/canvas-nodes'

export { CANVAS_AGENT_SKILLS }

const AGENT_TARGET_NODE_TYPES = new Set<string>([
  CANVAS_NODE_TYPES.imageNode,
  CANVAS_NODE_TYPES.storyVideo,
  CANVAS_NODE_TYPES.referenceImage,
])

export function isCanvasAgentTargetNode(node: Node | { type?: string | null }): boolean {
  return AGENT_TARGET_NODE_TYPES.has(String(node.type || ''))
}

/** Skill 模式下允许点击引用的节点类型 */
export function isCanvasAgentSkillReferenceNode(
  node: Node | { type?: string | null },
  skill: CanvasAgentSkillId,
): boolean {
  const def = getCanvasAgentSkillDefinition(skill)
  if (!def) return isCanvasAgentTargetNode(node)
  return def.supportedNodeTypes.includes(String(node.type || ''))
}

/** 含分组内子节点：React Flow 分组内图片/视频的 parentId 非空 */
export function getSelectedCanvasNodes(nodes: Node[]): Node[] {
  return nodes.filter(
    (node) => node.selected && AGENT_TARGET_NODE_TYPES.has(String(node.type || '')),
  )
}

function resolveAgentNodeDisplayName(
  node: Node,
  data: CanvasImageNodeData & CanvasVideoNodeData & CanvasReferenceImageNodeData,
): string {
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    return resolveCanvasImageDisplayName({
      assetRole: data.assetRole,
      importShotNumber: data.importShotNumber,
      imageName: data.imageName,
      assetRoleConverted: data.assetRoleConverted,
    }).label
  }
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    return resolveCanvasVideoDisplayName({ videoName: data.videoName }).label
  }
  if (node.type === CANVAS_NODE_TYPES.referenceImage) {
    const refData = data as CanvasReferenceImageNodeData
    if (refData.assetRole) {
      return resolveCanvasImageDisplayName({
        assetRole: refData.assetRole,
        importShotNumber: refData.importShotNumber,
        assetRoleConverted: true,
      }).label
    }
    return getNodeDisplayLabel(node)
  }
  return (
    data.imageName?.trim() ||
    data.videoName?.trim() ||
    data.entityName?.trim() ||
    getNodeDisplayLabel(node)
  )
}

export function formatCanvasAgentReferenceToast(summary: CanvasAgentNodeSummary): string {
  const name = summary.displayName || summary.label
  const typeLabel = resolveCanvasAgentNodeTypeLabel(summary.type)
  return `已引用 ${name}（${typeLabel}节点）`
}

function resolveAgentNodePreviewPath(
  node: Node,
  data: CanvasImageNodeData & CanvasVideoNodeData & { imagePath?: string },
): string | undefined {
  if (node.type === CANVAS_NODE_TYPES.referenceImage) {
    return String(data.imagePath || '').trim() || undefined
  }
  return String(data.outputPath || '').trim() || undefined
}

function readNodePrompt(node: Node, nodes: Node[], edges: Edge[]): string {
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    const data = node.data as CanvasImageNodeData
    return resolveCanvasImageNodePrompt(node.id, nodes, edges, data.prompt)
  }
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    const data = node.data as CanvasVideoNodeData
    return resolveCanvasVideoNodeShotBody(node.id, nodes, edges, data)
  }
  if (node.type === CANVAS_NODE_TYPES.shotPrompt || node.type === CANVAS_NODE_TYPES.note) {
    const data = node.data as CanvasPromptNodeData
    return String(data.prompt || '').trim()
  }
  return ''
}

function nodeHasOutput(node: Node): boolean {
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    return Boolean(String((node.data as CanvasImageNodeData).outputPath || '').trim())
  }
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    return Boolean(String((node.data as CanvasVideoNodeData).outputPath || '').trim())
  }
  if (node.type === CANVAS_NODE_TYPES.referenceImage) {
    return Boolean(String((node.data as CanvasReferenceImageNodeData).imagePath || '').trim())
  }
  if (node.type === CANVAS_NODE_TYPES.shotPrompt) {
    return Boolean(String((node.data as CanvasPromptNodeData).prompt || '').trim())
  }
  return false
}

export function summarizeCanvasAgentNode(
  node: Node,
  nodes: Node[],
  edges: Edge[],
): CanvasAgentNodeSummary {
  const data = node.data as CanvasImageNodeData & CanvasVideoNodeData
  const displayName = resolveAgentNodeDisplayName(node, data)
  const previewPath = resolveAgentNodePreviewPath(node, data)
  return {
    id: node.id,
    type: String(node.type || ''),
    label: getNodeDisplayLabel(node),
    entityName: data.entityName?.trim() || undefined,
    displayName,
    prompt: readNodePrompt(node, nodes, edges),
    hasOutput: nodeHasOutput(node),
    previewPath,
    previewOwnerKind: data.outputOwnerKind ?? data.mediaOwnerKind,
    previewOwnerProjectId: data.outputOwnerProjectId ?? data.mediaOwnerProjectId,
  }
}

export function summarizeCanvasAgentNodes(
  nodes: Node[],
  edges: Edge[],
  targetNodes?: Node[],
  targetNodeIds?: string[],
): CanvasAgentNodeSummary[] {
  let list = targetNodes
  if (!list && targetNodeIds?.length) {
    const idSet = new Set(targetNodeIds)
    list = nodes.filter((node) => idSet.has(node.id))
  }
  list = list ?? getSelectedCanvasNodes(nodes)
  return list.map((node) => summarizeCanvasAgentNode(node, nodes, edges))
}

/** 从助手引用 / 选中节点 / @实体名 解析目标节点 */
export function resolveCanvasAgentTargetNodes(
  nodes: Node[],
  edges: Edge[],
  userText: string,
  referencedNodeIds?: string[],
): Node[] {
  if (referencedNodeIds?.length) {
    const idSet = new Set(referencedNodeIds)
    const refs = nodes.filter((node) => idSet.has(node.id))
    if (refs.length === 1) return refs
    if (refs.length > 1) return refs
  }

  const selected = getSelectedCanvasNodes(nodes)
  if (selected.length === 1) return selected

  const trimmed = userText.trim()
  if (!trimmed) return selected

  const mentionMatch = trimmed.match(/@([\u4e00-\u9fa5\w·\-]+)/)
  const entityHint = mentionMatch?.[1]?.trim()
  if (!entityHint) return selected

  const hit = nodes.find((node) => {
    if (node.type !== CANVAS_NODE_TYPES.imageNode) return false
    const data = node.data as CanvasImageNodeData
    const names = [data.entityName, data.imageName].filter(Boolean).map((item) => String(item).trim())
    return names.some((name) => name === entityHint || trimmed.includes(name))
  })
  return hit ? [hit] : selected
}

export function detectCanvasAgentSkillFromText(text: string): CanvasAgentSkillId | null {
  const normalized = text.trim()
  if (!normalized) return null
  if (/提取(音色|音频|人声)|抽(取)?音色/i.test(normalized)) return 'extract_voice'
  if (/提取资产|抽(取)?角色|抽(取)?场景/i.test(normalized)) return 'extract_assets'
  if (/智能分镜|生成分镜|拆分镜/i.test(normalized)) return 'smart_storyboard'
  if (/合成九宫格|拼(成)?九宫格|宫格合成/i.test(normalized)) return 'merge_image_grid'
  if (/审(核)?分镜|分镜审|镜头审|审一下.*(镜|镜头)/i.test(normalized)) return 'review_storyboard'
  if (/改视频|改镜头|视频.*(改|调整|慢|快)/i.test(normalized)) return 'edit_video'
  if (/改图|改角色|改场景|改得|更.*一点|沧桑|明亮|暗/i.test(normalized)) return 'edit_image'
  return null
}

function buildRewritePrompt(options: {
  nodeType: string
  currentPrompt: string
  instruction: string
  entityName?: string
}): string {
  const roleLabel =
    options.nodeType === CANVAS_NODE_TYPES.storyVideo
      ? '视频节点'
      : options.nodeType === CANVAS_NODE_TYPES.imageNode
        ? '图片节点'
        : '节点'
  const entityLine = options.entityName ? `实体名称：${options.entityName}\n` : ''
  return [
    '你是画布 AI 助手，负责根据用户要求改写节点描述。',
    `节点类型：${roleLabel}`,
    entityLine.trim(),
    '当前描述：',
    '---',
    options.currentPrompt || '（空）',
    '---',
    `用户修改要求：${options.instruction}`,
    '',
    '请直接输出修改后的完整描述，不要解释、不要 markdown。保留主体身份，只按用户要求调整画面或镜头描述。',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function rewriteCanvasNodePrompt(options: {
  model: ModelConfig
  node: Node
  nodes: Node[]
  edges: Edge[]
  instruction: string
}): Promise<string> {
  const summary = summarizeCanvasAgentNode(options.node, options.nodes, options.edges)
  const prompt = buildRewritePrompt({
    nodeType: summary.type,
    currentPrompt: summary.prompt,
    instruction: options.instruction,
    entityName: summary.entityName,
  })

  try {
    const raw = await callChatCompletions(options.model, prompt)
    const next = raw.trim().replace(/^["'`]+|["'`]+$/g, '')
    if (next) return next
  } catch {
    /* fallback below */
  }

  const base = summary.prompt.trim()
  if (!base) return options.instruction.trim()
  return `${base}\n${options.instruction.trim()}`
}

export function buildCanvasAgentAssistantReply(options: {
  skill: CanvasAgentSkillId
  summaries: CanvasAgentNodeSummary[]
  rewrittenPrompt?: string
}): string {
  const target = options.summaries[0]
  const name = target?.displayName || target?.label

  if (options.skill === 'edit_image') {
    return name ? `已更新「${name}」描述并触发生图。` : '已更新描述并触发生图。'
  }
  if (options.skill === 'edit_video') {
    return name ? `已更新「${name}」描述并触发视频生成。` : '已更新描述并触发视频生成。'
  }
  if (options.skill === 'extract_voice') {
    return name ? `已打开「${name}」的提取音色流程。` : '已打开提取音色流程。'
  }
  if (options.skill === 'extract_assets') {
    return name ? `已开始从「${name}」提取资产。` : '已开始提取资产。'
  }
  if (options.skill === 'smart_storyboard') {
    return name ? `已开始对「${name}」智能分镜。` : '已开始智能分镜。'
  }
  if (options.skill === 'merge_image_grid') {
    return '已合成宫格图并添加到画布。'
  }
  if (options.skill === 'review_storyboard') {
    return '分镜审核完成。'
  }
  return name ? `已完成「${name}」相关 Skill。` : '已完成 Skill。'
}

export function resolveCanvasAgentNodeTypeLabel(type: string): string {
  switch (type) {
    case CANVAS_NODE_TYPES.imageNode:
      return '图片'
    case CANVAS_NODE_TYPES.storyVideo:
      return '视频'
    case CANVAS_NODE_TYPES.referenceImage:
      return '参考图'
    case CANVAS_NODE_TYPES.shotPrompt:
      return '分镜文本'
    default:
      return '节点'
  }
}

/** 发送给 LLM 的用户消息（附带选中节点与 Skill 上下文） */
export function formatCanvasAgentUserMessageForLlm(
  text: string,
  summaries: CanvasAgentNodeSummary[],
  activeSkill?: CanvasAgentSkillId | null,
): string {
  const skill = activeSkill ? CANVAS_AGENT_SKILLS.find((item) => item.id === activeSkill) : undefined
  const lines: string[] = []
  if (skill) {
    lines.push(`[当前 Skill] ${skill.label}：${skill.description}`)
  }
  if (summaries.length) {
    lines.push(
      `[画布引用节点] ${summaries
        .map(
          (item) =>
            `${item.displayName || item.label}（${resolveCanvasAgentNodeTypeLabel(item.type)}${item.hasOutput ? '，已有输出' : ''}）`,
        )
        .join('、')}`,
    )
  }
  lines.push(`[用户消息] ${text}`)
  return lines.join('\n')
}

const CANVAS_AGENT_CHAT_HISTORY_LIMIT = 16

/** 基础 LLM 多轮对话（问答、引导；不直接执行 Skill） */
export async function chatWithCanvasAgent(options: {
  model: ModelConfig
  history: CanvasAgentMessage[]
  userMessage: string
  nodes: Node[]
  edges: Edge[]
  referencedNodeIds?: string[]
}): Promise<string> {
  if (shouldUseE2eMockAi()) {
    const trimmedInput = options.userMessage.trim()
    if (!trimmedInput) throw new Error('请输入内容')
    return `E2E mock 画布助手：已收到「${trimmedInput.slice(0, 80)}」`
  }

  const selectedNodes = summarizeCanvasAgentNodes(
    options.nodes,
    options.edges,
    undefined,
    options.referencedNodeIds,
  )
  const systemPrompt = buildCanvasAgentSystemPrompt({
    skills: CANVAS_AGENT_SKILLS,
    selectedNodes,
  })

  const dialogHistory = options.history
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .slice(-CANVAS_AGENT_CHAT_HISTORY_LIMIT)
    .map((item) => ({
      role: item.role as 'user' | 'assistant',
      content: item.content,
    }))

  const reply = await callChatCompletionsWithMessages(
    options.model,
    [
      { role: 'system', content: systemPrompt },
      ...dialogHistory,
      { role: 'user', content: options.userMessage },
    ],
    { temperature: 0.7 },
  )

  const trimmed = reply.trim()
  if (!trimmed) throw new Error('模型未返回有效内容，请重试')
  return trimmed
}
