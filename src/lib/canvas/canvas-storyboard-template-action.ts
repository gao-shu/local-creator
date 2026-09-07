// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { WorkflowEpisode, WorkflowShot } from '@/types/workflow'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import {
  STORYBOARD_TEMPLATE_FAILURE_HINT,
  STORYBOARD_TEMPLATE_IMPORT_DEFAULTS,
} from '@/lib/canvas/canvas-storyboard-template-spec'
import {
  parseStoryboardTemplateDocument,
  type StoryboardTemplateParseFailure,
} from '@/lib/canvas/canvas-storyboard-template-parse'
import type { StoryboardTemplateNormalizedShot } from '@/lib/canvas/canvas-storyboard-template-spec'
import { buildCanvasGraphFromShots } from '@/lib/canvas/canvas-import-service'
import {
  CANVAS_GRAPH_NODE_GAP_X,
  CANVAS_GRAPH_PROMPT_WIDTH,
  CANVAS_INLINE_SHOT_GAP_Y,
  applyCanvasGraphNodeLayout,
} from '@/lib/canvas/canvas-graph-layout'
import {
  resolveCanvasPromptColumnX,
  resolveCanvasPromptStoryboardStartY,
} from '@/lib/canvas/canvas-prompt-layout'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'
import { formatCanvasTextNodeName } from '@/lib/canvas/canvas-prompt-naming'
import { formatCanvasVideoNodeName } from '@/lib/canvas/canvas-video-naming'
import { normalizeMentionSource } from '@/lib/workflow/mention-utils'
import { normalizeShot } from '@/lib/workflow/shot-utils'
import { generateUUID } from '@/lib/utils'

export type CanvasStoryboardTemplateImportOptions = {
  createShotPromptNodes: boolean
  createVideoNodes: boolean
}

export type RunCanvasStoryboardTemplateImportInput = {
  sourceNode: Node
  content: string
  canvasProjectId: string
  existingNodes: Node[]
  existingEdges: Edge[]
  options?: Partial<CanvasStoryboardTemplateImportOptions>
}

export type RunCanvasStoryboardTemplateImportResult = {
  shots: StoryboardTemplateNormalizedShot[]
  workflowShots: WorkflowShot[]
  nodes: Node[]
  edges: Edge[]
  summary: string
  warnings: string[]
}

function buildCanvasPseudoEpisode(content: string): WorkflowEpisode {
  return {
    id: `canvas_ep_${generateUUID()}`,
    episodeIndex: 1,
    title: '画布分镜稿',
    summary: '',
    content,
    characters: [],
    scenes: [],
    items: [],
  }
}

/** 视频节点标题用短对白，避免整段台词撑爆名称 */
export function shortenStoryboardDialogueTitle(dialogue: string, maxChars = 18): string {
  const text = String(dialogue || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return ''
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}…`
}

export function templateShotsToWorkflowShots(
  shots: StoryboardTemplateNormalizedShot[],
  episode: WorkflowEpisode,
): WorkflowShot[] {
  const now = Date.now()
  return shots.map((item) => {
    const title = shortenStoryboardDialogueTitle(item.dialogue) || `镜头 ${item.shotNumber}`
    const shot = normalizeShot(
      {
        id: `cv_tpl_${generateUUID()}`,
        episodeId: episode.id,
        episodeIndex: episode.episodeIndex,
        shotNumber: item.shotNumber,
        dialogue: title,
        prompt: normalizeMentionSource(item.prompt),
        spatialAnchor: item.spatialAnchor
          ? normalizeMentionSource(item.spatialAnchor)
          : item.spatialAnchor,
        remark: item.dialogue || undefined,
        status: 'draft',
        updatedAt: now,
      },
      episode,
    )
    if (!shot) throw new Error(`分镜数据规范化失败（镜头 ${item.shotNumber}）`)
    return shot
  })
}

function resolveImportOptions(
  partial?: Partial<CanvasStoryboardTemplateImportOptions>,
): CanvasStoryboardTemplateImportOptions {
  return {
    createShotPromptNodes:
      partial?.createShotPromptNodes ?? STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.createShotPromptNodes,
    createVideoNodes:
      partial?.createVideoNodes ?? STORYBOARD_TEMPLATE_IMPORT_DEFAULTS.createVideoNodes,
  }
}

function buildShotPromptNodes(options: {
  shots: StoryboardTemplateNormalizedShot[]
  sourceNode: Node
  existingNodes: Node[]
  existingEdges: Edge[]
  startX: number
  startY: number
}): { nodes: Node[]; edges: Edge[]; promptByShotNumber: Map<number, Node> } {
  const { shots, sourceNode, startX, startY } = options
  const nodes: Node[] = []
  const edges: Edge[] = []
  const promptByShotNumber = new Map<number, Node>()
  const stamp = Date.now()

  shots.forEach((shot, index) => {
    const node = createCanvasNode(
      CANVAS_NODE_TYPES.shotPrompt,
      { x: startX, y: startY + index * CANVAS_INLINE_SHOT_GAP_Y },
      {
        prompt: shot.prompt,
        label: formatCanvasTextNodeName(`镜头 ${shot.shotNumber}`),
        dialogue: shot.dialogue || undefined,
        shotNumber: shot.shotNumber,
        importShotNumber: shot.shotNumber,
        templateSourceNodeId: sourceNode.id,
        status: 'idle',
      },
    )
    node.id = `tpl_prompt_${shot.shotNumber}_${stamp}_${index}`
    const laidOut = applyCanvasGraphNodeLayout(node)
    nodes.push(laidOut)
    promptByShotNumber.set(shot.shotNumber, laidOut)
    edges.push({
      id: `e_${sourceNode.id}_${laidOut.id}`,
      source: sourceNode.id,
      sourceHandle: 'right',
      target: laidOut.id,
      targetHandle: 'left',
    })
  })

  return { nodes, edges, promptByShotNumber }
}

function patchTemplateVideoNodes(options: {
  nodes: Node[]
  shots: StoryboardTemplateNormalizedShot[]
  sourceNodeId: string
  /** 若存在分镜文本节点，把视频接到文本节点而不是源文本 */
  promptByShotNumber?: Map<number, Node>
  sourceNode: Node
  edges: Edge[]
}): void {
  const { nodes, shots, sourceNodeId, promptByShotNumber, sourceNode, edges } = options
  const durationByNumber = new Map(shots.map((s) => [s.shotNumber, s.durationSec] as const))
  const fullDialogueByNumber = new Map(shots.map((s) => [s.shotNumber, s.dialogue] as const))

  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.storyVideo) continue
    const data = { ...(node.data as Record<string, unknown>) }
    const shotNumber = Number(data.shotNumber ?? data.importShotNumber)
    if (!Number.isFinite(shotNumber)) continue

    const durationSec = durationByNumber.get(shotNumber)
    if (durationSec != null) data.durationSec = durationSec

    const fullDialogue = fullDialogueByNumber.get(shotNumber)
    if (fullDialogue) data.dialogue = fullDialogue

    data.templateSourceNodeId = sourceNodeId
    node.data = data

    if (promptByShotNumber?.has(shotNumber)) {
      const promptNode = promptByShotNumber.get(shotNumber)!
      // 去掉 source→video，改成 prompt→video
      for (let i = edges.length - 1; i >= 0; i -= 1) {
        const edge = edges[i]
        if (edge.source === sourceNode.id && edge.target === node.id) {
          edges.splice(i, 1)
        }
      }
      edges.push({
        id: `e_${promptNode.id}_${node.id}`,
        source: promptNode.id,
        sourceHandle: 'right',
        target: node.id,
        targetHandle: 'left',
      })
    }
  }
}

/**
 * 导入分镜稿 → 画布节点（同步、无 LLM）。
 * 默认：分镜文本节点 + 空视频节点（带 durationSec）；源文本节点保留原文。
 */
export function runCanvasStoryboardTemplateImport(
  input: RunCanvasStoryboardTemplateImportInput,
): RunCanvasStoryboardTemplateImportResult {
  const options = resolveImportOptions(input.options)
  if (!options.createShotPromptNodes && !options.createVideoNodes) {
    throw new Error('请至少勾选「分镜文本节点」或「视频节点」之一')
  }

  const parsed = parseStoryboardTemplateDocument(input.content)
  if (!parsed.ok) {
    const failure = parsed as StoryboardTemplateParseFailure
    throw new Error(failure.message || STORYBOARD_TEMPLATE_FAILURE_HINT[failure.code])
  }

  const episode = buildCanvasPseudoEpisode(input.content)
  const workflowShots = templateShotsToWorkflowShots(parsed.shots, episode)
  if (!workflowShots.length) {
    throw new Error(STORYBOARD_TEMPLATE_FAILURE_HINT.no_valid_shot)
  }

  const { storyboardColX } = resolveCanvasPromptColumnX(input.sourceNode.position.x)
  const startY = resolveCanvasPromptStoryboardStartY(
    input.sourceNode,
    input.existingNodes,
    input.existingEdges,
  )

  const nodes: Node[] = []
  const edges: Edge[] = []
  let promptByShotNumber: Map<number, Node> | undefined

  if (options.createShotPromptNodes) {
    const built = buildShotPromptNodes({
      shots: parsed.shots,
      sourceNode: input.sourceNode,
      existingNodes: input.existingNodes,
      existingEdges: input.existingEdges,
      startX: storyboardColX,
      startY,
    })
    nodes.push(...built.nodes)
    edges.push(...built.edges)
    promptByShotNumber = built.promptByShotNumber
  }

  if (options.createVideoNodes) {
    const videoStartX = options.createShotPromptNodes
      ? storyboardColX + CANVAS_GRAPH_PROMPT_WIDTH + CANVAS_GRAPH_NODE_GAP_X
      : storyboardColX

    // 有分镜文本列时不把 sourceNode 传给 build（避免自动 layout 叠到同一列）
    // 改由 patch 接 prompt→video；仅视频模式则与智能分镜一致 source→video
    const graph = buildCanvasGraphFromShots({
      shots: workflowShots,
      canvasProjectId: input.canvasProjectId,
      existingNodes: input.existingNodes,
      existingEdges: input.existingEdges,
      sourceNode: options.createShotPromptNodes ? undefined : input.sourceNode,
      layoutOverride: { startX: videoStartX, startY },
    })

    for (const node of graph.nodes) {
      if (node.type !== CANVAS_NODE_TYPES.storyVideo) continue
      const sn = Number((node.data as { shotNumber?: number }).shotNumber)
      if (!Number.isFinite(sn)) continue
      node.data = {
        ...node.data,
        videoName: formatCanvasVideoNodeName(`镜 ${sn}`),
      }
    }

    nodes.push(...graph.nodes)
    edges.push(...graph.edges)

    patchTemplateVideoNodes({
      nodes: graph.nodes,
      shots: parsed.shots,
      sourceNodeId: input.sourceNode.id,
      promptByShotNumber,
      sourceNode: input.sourceNode,
      edges,
    })
  }

  const parts: string[] = []
  if (options.createShotPromptNodes) parts.push(`${parsed.shots.length} 个分镜文本`)
  if (options.createVideoNodes) parts.push(`${parsed.shots.length} 个视频`)
  const summary = `已导入 ${parts.join(' + ')}`

  return {
    shots: parsed.shots,
    workflowShots,
    nodes,
    edges,
    summary,
    warnings: parsed.warnings,
  }
}
