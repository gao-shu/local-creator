// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { ModelConfig } from '@/types/settings'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type { CanvasRunOptions } from '@/lib/canvas/canvas-run-service'
import { callChatCompletions } from '@/lib/models/llm-client'
import { shouldUseE2eMockAi } from '@/lib/e2e/e2e-mock-ai'
import {
  getCanvasAgentSkillDefinition,
} from '@/lib/canvas/canvas-agent-skill-registry'
import {
  resolveCanvasAgentTargetNodes,
  rewriteCanvasNodePrompt,
  summarizeCanvasAgentNode,
  summarizeCanvasAgentNodes,
} from '@/lib/canvas/canvas-agent-service'
import type {
  CanvasAgentEditMediaOutput,
  CanvasAgentInput,
  CanvasAgentResult,
  CanvasAgentSkillId,
  CanvasStoryboardReviewIssue,
  CanvasStoryboardReviewOutput,
  CanvasStoryboardReviewSeverity,
} from '@/lib/canvas/canvas-agent-types'
import { buildCanvasStoryboardReviewPrompt } from '@/lib/canvas/canvas-agent-prompt'

export interface ExecuteCanvasAgentSkillDeps {
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void
  runNode: (
    nodeId: string,
    options?: CanvasRunOptions & { silent?: boolean },
  ) => Promise<unknown>
  /** 改视频前可选：同步侧栏所选视频模型等到节点参数 */
  prepareVideoNode?: (node: Node) => void
  /** 打开现有「提取音频」流程（对话框） */
  requestVideoExtractAudio?: (nodeId: string) => void
  /** 提取资产；返回 needs_confirm 时由 UI 二次确认 */
  runPromptExtract?: (
    sourceNodeId: string,
    options?: { confirmed?: boolean },
  ) => Promise<boolean | 'needs_confirm'>
  /** 智能分镜 */
  runPromptStoryboard?: (sourceNodeId: string) => Promise<boolean>
  /** 合成九宫格：传入图片节点 id（顺序即排版顺序） */
  composeImageGrid?: (
    nodeIds: string[],
  ) => Promise<{ nodeId: string; outputPath: string } | null>
}

export interface ExecuteCanvasAgentSkillOptions {
  skillId: CanvasAgentSkillId
  input: CanvasAgentInput
  /** LLM Skill 必填；行动型包装 Skill 可不传 */
  model?: ModelConfig
  deps: ExecuteCanvasAgentSkillDeps
  /** 提取资产等二次确认后重入 */
  confirmed?: boolean
}

function asNodes(input: CanvasAgentInput): Node[] {
  return input.nodes as Node[]
}

function asEdges(input: CanvasAgentInput): Edge[] {
  return input.edges as Edge[]
}

function nodeHasImageOutput(node: Node): boolean {
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    return Boolean(String((node.data as { outputPath?: string }).outputPath || '').trim())
  }
  return false
}

function pickPrimaryTarget(
  skillId: CanvasAgentSkillId,
  candidates: Node[],
): Node | undefined {
  const def = getCanvasAgentSkillDefinition(skillId)
  if (!def) return undefined
  const allowed = new Set(def.supportedNodeTypes)
  return candidates.find((node) => allowed.has(String(node.type || '')))
}

function resolveTargetsForSkill(
  skillId: CanvasAgentSkillId,
  input: CanvasAgentInput,
): Node[] {
  const instruction = String(input.userInstruction || '')
  const referenced =
    input.referencedNodeIds?.length
      ? input.referencedNodeIds
      : input.targetNodeIds.length
        ? input.targetNodeIds
        : undefined
  const resolved = resolveCanvasAgentTargetNodes(
    asNodes(input),
    asEdges(input),
    instruction,
    referenced,
  )
  const def = getCanvasAgentSkillDefinition(skillId)
  if (!def) return resolved
  const allowed = new Set(def.supportedNodeTypes)
  const filtered = resolved.filter((node) => allowed.has(String(node.type || '')))
  if (filtered.length) return filtered

  // 显式 target / 引用 id
  const idSet = new Set(
    (input.targetNodeIds.length ? input.targetNodeIds : input.referencedNodeIds) || [],
  )
  if (idSet.size) {
    const byId = asNodes(input).filter(
      (node) => idSet.has(node.id) && allowed.has(String(node.type || '')),
    )
    if (byId.length) return byId
  }

  // 画布选中态（含 shotPrompt 等非默认 Agent 目标）
  return asNodes(input).filter(
    (node) => node.selected && allowed.has(String(node.type || '')),
  )
}

function failedResult(
  skillId: CanvasAgentSkillId,
  targetNodeIds: string[],
  error: string,
): CanvasAgentResult {
  return { status: 'failed', skillId, targetNodeIds, error }
}

async function executeEditImage(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const targets = resolveTargetsForSkill('edit_image', options.input)
  const node = pickPrimaryTarget('edit_image', targets)
  if (!node) {
    return failedResult('edit_image', [], '请先选中一个图片节点，或在消息里 @实体名（如 @小明）。')
  }

  const instruction = String(options.input.userInstruction || '').trim()
  if (!instruction) {
    return failedResult('edit_image', [node.id], '请输入修改说明')
  }

  try {
    const rewritten = await rewriteCanvasNodePrompt({
      model: options.model!,
      node,
      nodes: asNodes(options.input),
      edges: asEdges(options.input),
      instruction,
    })
    options.deps.updateNodeData(node.id, { prompt: rewritten })
    await options.deps.runNode(node.id, {
      silent: false,
      ...(node.type === CANVAS_NODE_TYPES.imageNode && nodeHasImageOutput(node)
        ? { toolPrompt: instruction, useSelfReference: true }
        : {}),
    } as CanvasRunOptions)

    const output: CanvasAgentEditMediaOutput = {
      rewrittenPrompt: rewritten,
      nodeId: node.id,
      triggeredRun: true,
    }
    return {
      status: 'success',
      skillId: 'edit_image',
      targetNodeIds: [node.id],
      output,
    }
  } catch (error: unknown) {
    return failedResult(
      'edit_image',
      [node.id],
      (error as Error).message || '改图失败',
    )
  }
}

async function executeEditVideo(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const targets = resolveTargetsForSkill('edit_video', options.input)
  const node = pickPrimaryTarget('edit_video', targets)
  if (!node) {
    return failedResult('edit_video', [], '请先选中一个视频节点。')
  }

  const instruction = String(options.input.userInstruction || '').trim()
  if (!instruction) {
    return failedResult('edit_video', [node.id], '请输入修改说明')
  }

  try {
    const rewritten = await rewriteCanvasNodePrompt({
      model: options.model!,
      node,
      nodes: asNodes(options.input),
      edges: asEdges(options.input),
      instruction,
    })
    options.deps.prepareVideoNode?.(node)
    options.deps.updateNodeData(node.id, { prompt: rewritten })
    await options.deps.runNode(node.id, { silent: false } as CanvasRunOptions)

    const output: CanvasAgentEditMediaOutput = {
      rewrittenPrompt: rewritten,
      nodeId: node.id,
      triggeredRun: true,
    }
    return {
      status: 'success',
      skillId: 'edit_video',
      targetNodeIds: [node.id],
      output,
    }
  } catch (error: unknown) {
    return failedResult(
      'edit_video',
      [node.id],
      (error as Error).message || '改视频失败',
    )
  }
}

function clampScore(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function normalizeSeverity(value: unknown): CanvasStoryboardReviewSeverity {
  const s = String(value || '').toLowerCase()
  if (s === 'high' || s === 'medium' || s === 'low') return s
  return 'medium'
}

function parseStoryboardReviewJson(raw: string): CanvasStoryboardReviewOutput | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenced?.[1] || trimmed).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
    const statusRaw = String(parsed.status || '').toLowerCase()
    const status = statusRaw === 'pass' ? 'pass' : 'reject'
    const issuesRaw = Array.isArray(parsed.issues) ? parsed.issues : []
    const issues: CanvasStoryboardReviewIssue[] = issuesRaw
      .map((item) => {
        const row = (item || {}) as Record<string, unknown>
        const message = String(row.message || '').trim()
        if (!message) return null
        return {
          type: String(row.type || 'general').trim() || 'general',
          severity: normalizeSeverity(row.severity),
          message,
          suggestion: String(row.suggestion || '').trim() || undefined,
        }
      })
      .filter(Boolean) as CanvasStoryboardReviewIssue[]

    return {
      status,
      score: clampScore(parsed.score),
      issues,
      summary: String(parsed.summary || '').trim() || undefined,
    }
  } catch {
    return null
  }
}

/** 导出供单测：解析审核 JSON */
export function parseCanvasStoryboardReviewOutput(raw: string): CanvasStoryboardReviewOutput | null {
  return parseStoryboardReviewJson(raw)
}

function formatReviewFallback(raw: string): CanvasStoryboardReviewOutput {
  return {
    status: 'reject',
    score: 50,
    issues: [
      {
        type: 'parse_error',
        severity: 'medium',
        message: '模型未返回可解析的结构化审核 JSON，以下为原始摘要',
        suggestion: '请重试，或缩短输入后再次审核',
      },
    ],
    summary: raw.trim().slice(0, 800) || undefined,
  }
}

async function executeReviewStoryboard(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const targets = resolveTargetsForSkill('review_storyboard', options.input)
  if (!targets.length) {
    return failedResult(
      'review_storyboard',
      [],
      '请先选中或引用分镜相关节点（视频 / 文本分镜 / 图片）。',
    )
  }

  const targetNodeIds = targets.map((node) => node.id)
  const summaries = summarizeCanvasAgentNodes(
    asNodes(options.input),
    asEdges(options.input),
    targets,
  )
  // shotPrompt 等可能不在默认 summarize 目标集：补一层
  const enriched = targetNodeIds.map((id) => {
    const existing = summaries.find((item) => item.id === id)
    if (existing) return existing
    const node = asNodes(options.input).find((item) => item.id === id)
    if (!node) {
      return {
        id,
        type: 'unknown',
        label: id,
        prompt: '',
        hasOutput: false,
      }
    }
    return summarizeCanvasAgentNode(node, asNodes(options.input), asEdges(options.input))
  })

  const prompt = buildCanvasStoryboardReviewPrompt({
    nodes: enriched,
    userInstruction: options.input.userInstruction,
  })

  try {
    let raw: string
    if (shouldUseE2eMockAi()) {
      raw = JSON.stringify({
        status: 'reject',
        score: 72,
        summary: 'E2E mock 分镜审核',
        issues: [
          {
            type: 'shot_logic',
            severity: 'high',
            message: 'E2E：镜头衔接缺少空间建立',
            suggestion: '增加建立空间关系的中远景',
          },
        ],
      })
    } else {
      if (!options.model) {
        return failedResult('review_storyboard', targetNodeIds, '请先配置大语言模型')
      }
      raw = await callChatCompletions(options.model, prompt)
    }

    const parsed = parseStoryboardReviewJson(raw) || formatReviewFallback(raw)
    return {
      status: 'success',
      skillId: 'review_storyboard',
      targetNodeIds,
      output: parsed,
    }
  } catch (error: unknown) {
    return failedResult(
      'review_storyboard',
      targetNodeIds,
      (error as Error).message || '分镜审核失败',
    )
  }
}

async function executeExtractVoice(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const targets = resolveTargetsForSkill('extract_voice', options.input)
  const node = pickPrimaryTarget('extract_voice', targets)
  if (!node) {
    return failedResult('extract_voice', [], '请先选中或引用一个已有成片的视频节点。')
  }
  const outputPath = String((node.data as { outputPath?: string }).outputPath || '').trim()
  if (!outputPath) {
    return failedResult('extract_voice', [node.id], '该视频还没有成片，无法提取音色。')
  }
  if (!options.deps.requestVideoExtractAudio) {
    return failedResult('extract_voice', [node.id], '当前环境未接入提取音色能力')
  }
  options.deps.requestVideoExtractAudio(node.id)
  return {
    status: 'success',
    skillId: 'extract_voice',
    targetNodeIds: [node.id],
    output: { openedExtractAudioUi: true, nodeId: node.id },
  }
}

async function executeExtractAssets(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const targets = resolveTargetsForSkill('extract_assets', options.input)
  const node = pickPrimaryTarget('extract_assets', targets)
  if (!node) {
    return failedResult('extract_assets', [], '请先选中或引用一个文本 / 分镜文本节点。')
  }
  if (!options.deps.runPromptExtract) {
    return failedResult('extract_assets', [node.id], '当前环境未接入提取资产能力')
  }
  const result = await options.deps.runPromptExtract(node.id, {
    confirmed: options.confirmed,
  })
  if (result === 'needs_confirm') {
    return {
      status: 'failed',
      skillId: 'extract_assets',
      targetNodeIds: [node.id],
      error: 'NEEDS_EXTRACT_CONFIRM',
      output: { needsConfirm: true, nodeId: node.id },
    }
  }
  if (!result) {
    return failedResult('extract_assets', [node.id], '提取资产未启动或已取消')
  }
  return {
    status: 'success',
    skillId: 'extract_assets',
    targetNodeIds: [node.id],
    output: { started: true, nodeId: node.id },
  }
}

async function executeSmartStoryboard(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const targets = resolveTargetsForSkill('smart_storyboard', options.input)
  const node = pickPrimaryTarget('smart_storyboard', targets)
  if (!node) {
    return failedResult('smart_storyboard', [], '请先选中或引用一个文本 / 分镜文本节点。')
  }
  if (!options.deps.runPromptStoryboard) {
    return failedResult('smart_storyboard', [node.id], '当前环境未接入智能分镜能力')
  }
  const ok = await options.deps.runPromptStoryboard(node.id)
  if (!ok) {
    return failedResult('smart_storyboard', [node.id], '智能分镜未启动或已取消')
  }
  return {
    status: 'success',
    skillId: 'smart_storyboard',
    targetNodeIds: [node.id],
    output: { started: true, nodeId: node.id },
  }
}

async function executeMergeImageGrid(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const targets = resolveTargetsForSkill('merge_image_grid', options.input)
  const images = targets.filter((node) => {
    const type = String(node.type || '')
    return (
      type === CANVAS_NODE_TYPES.imageNode || type === CANVAS_NODE_TYPES.referenceImage
    )
  })
  if (images.length < 2) {
    return failedResult(
      'merge_image_grid',
      images.map((node) => node.id),
      '请至少选中或引用 2 张已有输出的图片（按引用顺序排版）。',
    )
  }
  if (!options.deps.composeImageGrid) {
    return failedResult(
      'merge_image_grid',
      images.map((node) => node.id),
      '当前环境未接入合成九宫格能力',
    )
  }
  try {
    const nodeIds = images.slice(0, 12).map((node) => node.id)
    const result = await options.deps.composeImageGrid(nodeIds)
    if (!result) {
      return failedResult('merge_image_grid', nodeIds, '合成九宫格已取消')
    }
    return {
      status: 'success',
      skillId: 'merge_image_grid',
      targetNodeIds: nodeIds,
      output: {
        nodeId: result.nodeId,
        outputPath: result.outputPath,
        sourceCount: nodeIds.length,
      },
    }
  } catch (error: unknown) {
    return failedResult(
      'merge_image_grid',
      images.map((node) => node.id),
      (error as Error).message || '合成九宫格失败',
    )
  }
}

/**
 * Agent Skill 统一执行入口。
 * Sidebar / Agent Node / 未来 Workflow 均应经此函数进入 Skill。
 */
export async function executeCanvasAgentSkill(
  options: ExecuteCanvasAgentSkillOptions,
): Promise<CanvasAgentResult> {
  const def = getCanvasAgentSkillDefinition(options.skillId)
  if (!def) {
    return failedResult(options.skillId, options.input.targetNodeIds, `未知 Skill：${options.skillId}`)
  }

  if (
    (options.skillId === 'edit_image' ||
      options.skillId === 'edit_video' ||
      options.skillId === 'review_storyboard') &&
    !options.model
  ) {
    return failedResult(options.skillId, options.input.targetNodeIds, '请先配置大语言模型')
  }

  if (options.skillId === 'edit_image') return executeEditImage(options)
  if (options.skillId === 'edit_video') return executeEditVideo(options)
  if (options.skillId === 'review_storyboard') return executeReviewStoryboard(options)
  if (options.skillId === 'extract_voice') return executeExtractVoice(options)
  if (options.skillId === 'extract_assets') return executeExtractAssets(options)
  if (options.skillId === 'smart_storyboard') return executeSmartStoryboard(options)
  if (options.skillId === 'merge_image_grid') return executeMergeImageGrid(options)

  return failedResult(options.skillId, options.input.targetNodeIds, `未实现的 Skill：${options.skillId}`)
}

/** 将审核 Result 格式化为侧栏可读文本 */
export function formatCanvasStoryboardReviewMessage(
  output: CanvasStoryboardReviewOutput,
): string {
  const lines = [
    `审核结论：${output.status === 'pass' ? '通过' : '不通过'}（${output.score} 分）`,
  ]
  if (output.summary) lines.push(output.summary)
  if (output.issues.length) {
    lines.push('问题：')
    for (const issue of output.issues) {
      const sug = issue.suggestion ? ` → 建议：${issue.suggestion}` : ''
      lines.push(`- [${issue.severity}] ${issue.type}: ${issue.message}${sug}`)
    }
  } else {
    lines.push('未列出具体问题。')
  }
  return lines.join('\n')
}
