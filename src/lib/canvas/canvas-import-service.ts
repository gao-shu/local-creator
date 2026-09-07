// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { WorkflowShot } from '@/types/workflow'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'
import {
  CANVAS_INLINE_SHOT_GAP_Y,
  computeCanvasGraphBottom,
  applyCanvasGraphNodeLayout,
} from '@/lib/canvas/canvas-graph-layout'
import { resolveCanvasPromptColumnX, resolveCanvasPromptStoryboardStartY } from '@/lib/canvas/canvas-prompt-layout'
import { formatCanvasVideoNodeName } from '@/lib/canvas/canvas-video-naming'

function pickPrimaryPath(paths: string[] | undefined, primaryIndex?: number, fallback?: string): string {
  const list = paths?.length ? paths : fallback ? [fallback] : []
  if (!list.length) return ''
  const idx = typeof primaryIndex === 'number' ? primaryIndex : 0
  return list[idx] || list[0] || ''
}

function computeImportStartY(existingNodes: Node[]): number {
  return computeCanvasGraphBottom(existingNodes)
}

export interface BuildCanvasFromShotsInput {
  shots: WorkflowShot[]
  canvasProjectId: string
  existingNodes?: Node[]
  existingEdges?: Edge[]
  startX?: number
  startY?: number
  /** 画布内「获取分镜」：在源文本节点右侧排布并连线 */
  sourceNode?: Node
  /** 覆盖自动布局（导入分镜稿：文本列 + 视频列并排） */
  layoutOverride?: { startX: number; startY: number }
}

function buildShotVideoName(shot: WorkflowShot): string {
  const label = `镜 ${shot.shotNumber}${shot.dialogue ? ` · ${shot.dialogue}` : ''}`
  return formatCanvasVideoNodeName(label)
}

function resolveStoryboardLayout(input: BuildCanvasFromShotsInput): { startX: number; startY: number } {
  if (input.layoutOverride) {
    return input.layoutOverride
  }
  if (input.sourceNode) {
    const { storyboardColX } = resolveCanvasPromptColumnX(input.sourceNode.position.x)
    return {
      startX: storyboardColX,
      startY: resolveCanvasPromptStoryboardStartY(
        input.sourceNode,
        input.existingNodes ?? [],
        input.existingEdges ?? [],
      ),
    }
  }
  return {
    startX: input.startX ?? 80,
    startY: input.startY ?? computeImportStartY(input.existingNodes ?? []),
  }
}

function appendInlineShotGraph(options: {
  shot: WorkflowShot
  index: number
  suffix: string
  canvasProjectId: string
  startX: number
  startY: number
  sourceNode?: Node
  nodes: Node[]
  edges: Edge[]
}): void {
  const { shot, index, suffix, canvasProjectId, startX, startY, sourceNode, nodes, edges } = options
  const videoPath = pickPrimaryPath(
    shot.generatedVideoPaths,
    shot.primaryGeneratedVideoIndex,
    shot.generatedVideoPath,
  )
  const shotLabel = buildShotVideoName(shot)
  const videoNode = createCanvasNode(
    CANVAS_NODE_TYPES.storyVideo,
    { x: 0, y: 0 },
    {
      prompt: shot.prompt?.trim() || undefined,
      spatialAnchor: shot.spatialAnchor?.trim() || undefined,
      videoName: shotLabel,
      shotNumber: shot.shotNumber,
      dialogue: shot.dialogue,
      importShotId: shot.id,
      importShotNumber: shot.shotNumber,
      needsRegen: false,
      outputPath: videoPath || undefined,
      outputOwnerKind: videoPath ? 'canvas' : undefined,
      outputOwnerProjectId: videoPath ? canvasProjectId : undefined,
      status: videoPath ? 'success' : 'idle',
    },
  )
  videoNode.id = `import_video_${suffix}`

  nodes.push(
    applyCanvasGraphNodeLayout({
      ...videoNode,
      position: {
        x: startX,
        y: startY + index * CANVAS_INLINE_SHOT_GAP_Y,
      },
    }),
  )

  if (sourceNode) {
    edges.push({
      id: `e_${sourceNode.id}_${videoNode.id}`,
      source: sourceNode.id,
      sourceHandle: 'right',
      target: videoNode.id,
      targetHandle: 'left',
    })
  }
}

/** 画布内从分镜列表生成节点图（inline 布局） */
export function buildCanvasGraphFromShots(input: BuildCanvasFromShotsInput): {
  nodes: Node[]
  edges: Edge[]
} {
  const { shots, canvasProjectId, sourceNode } = input
  const { startX, startY } = resolveStoryboardLayout(input)
  const stamp = Date.now()

  const nodes: Node[] = []
  const edges: Edge[] = []

  shots.forEach((shot, index) => {
    const suffix = `${shot.id.slice(-6)}_${stamp}_${index}`
    appendInlineShotGraph({
      shot,
      index,
      suffix,
      canvasProjectId,
      startX,
      startY,
      sourceNode,
      nodes,
      edges,
    })
  })

  return { nodes, edges }
}
