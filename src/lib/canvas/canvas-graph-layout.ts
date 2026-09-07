// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import {
  CANVAS_VIDEO_PREVIEW_HEIGHT_PX,
  CANVAS_VIDEO_PREVIEW_WIDTH_PX,
  resolveCanvasVideoPreviewDimensions,
} from '@/lib/canvas/canvas-image-node-layout'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { GROUP_HEADER, GROUP_PADDING } from '@/lib/canvas/canvas-group-utils'

/** 与 canvas-image-node IMAGE_WIDTH_PX 对齐 */
export const CANVAS_GRAPH_IMAGE_WIDTH = 320
/** 与 canvas-image-node 自适应预览最大高宽比 16:9 对齐 */
export const CANVAS_GRAPH_PREVIEW_MAX_HEIGHT = Math.round(CANVAS_GRAPH_IMAGE_WIDTH * (16 / 9))
/** 标题区 + 1:1 预览区（与文本节点收起态一致） */
export const CANVAS_GRAPH_IMAGE_HEIGHT = 26 + CANVAS_GRAPH_IMAGE_WIDTH + 12
/** 与图片节点预览宽一致（文本节点卡片 1:1） */
export const CANVAS_GRAPH_PROMPT_WIDTH = CANVAS_GRAPH_IMAGE_WIDTH
export const CANVAS_GRAPH_PROMPT_HEIGHT = 26 + CANVAS_GRAPH_IMAGE_WIDTH + 12
export const CANVAS_GRAPH_REF_WIDTH = 280
export const CANVAS_GRAPH_REF_HEIGHT = CANVAS_GRAPH_IMAGE_HEIGHT
/** 与 canvas-video-node 默认 16:9 预览宽度对齐 */
export const CANVAS_GRAPH_VIDEO_WIDTH = CANVAS_VIDEO_PREVIEW_WIDTH_PX
/** 标题区 + 16:9 预览区（预览高度与图片 1:1 一致） */
export const CANVAS_GRAPH_VIDEO_HEIGHT = 26 + CANVAS_VIDEO_PREVIEW_HEIGHT_PX + 12
/** 竖屏视频最大堆叠高度（9:16 @ 320 宽） */
export const CANVAS_GRAPH_VIDEO_MAX_STACK_HEIGHT = 26 + CANVAS_GRAPH_PREVIEW_MAX_HEIGHT + 12
/** 视频右侧分镜参考条：横向缩略图 */
export const CANVAS_GRAPH_SHOT_REF_WIDTH = 220
export const CANVAS_GRAPH_SHOT_REF_PREVIEW_MAX_HEIGHT = Math.round(
  CANVAS_GRAPH_SHOT_REF_WIDTH * (9 / 16),
)
export const CANVAS_GRAPH_SHOT_REF_HEIGHT =
  26 + CANVAS_GRAPH_SHOT_REF_PREVIEW_MAX_HEIGHT + 12
/** 与 canvas-audio-node / canvas-voice-node 卡片宽对齐 */
export const CANVAS_GRAPH_AUDIO_WIDTH = 260
export const CANVAS_GRAPH_AUDIO_HEIGHT = 172

export const CANVAS_GRAPH_NODE_GAP_X = 48
export const CANVAS_GRAPH_NODE_GAP_Y = 28

/** 分镜组之间的垂直间距（含 group 标题与 padding） */
export const CANVAS_GRAPH_SHOT_GROUP_GAP_Y =
  CANVAS_GRAPH_VIDEO_MAX_STACK_HEIGHT + GROUP_HEADER + GROUP_PADDING * 2 + CANVAS_GRAPH_NODE_GAP_Y

/** 画布 inline 分镜：仅视频节点时的垂直间距（名称行 + 预览区 + 间距）
 * 模板导入：分镜文本列与视频列共用此值，保证并排行对齐；取视频最大高度以免叠压。
 */
export const CANVAS_INLINE_SHOT_GAP_Y =
  CANVAS_GRAPH_VIDEO_MAX_STACK_HEIGHT + CANVAS_GRAPH_NODE_GAP_Y

export interface CanvasGraphNodeSize {
  width: number
  height: number
}

export function resolveCanvasGraphNodeSize(
  nodeType: string | undefined,
  data?: Record<string, unknown>,
): CanvasGraphNodeSize {
  if (data?.exportShotRefStrip) {
    return { width: CANVAS_GRAPH_SHOT_REF_WIDTH, height: CANVAS_GRAPH_SHOT_REF_HEIGHT }
  }
  switch (nodeType) {
    case CANVAS_NODE_TYPES.shotPrompt:
      return { width: CANVAS_GRAPH_PROMPT_WIDTH, height: CANVAS_GRAPH_PROMPT_HEIGHT }
    case CANVAS_NODE_TYPES.referenceImage:
      return { width: CANVAS_GRAPH_REF_WIDTH, height: CANVAS_GRAPH_REF_HEIGHT }
    case CANVAS_NODE_TYPES.imageNode:
      return { width: CANVAS_GRAPH_IMAGE_WIDTH, height: CANVAS_GRAPH_IMAGE_HEIGHT }
    case CANVAS_NODE_TYPES.storyVideo: {
      const preview = resolveCanvasVideoPreviewDimensions(
        data?.aspectRatio as string | undefined,
      )
      return {
        width: preview.width,
        height: 26 + preview.height + 12,
      }
    }
    case CANVAS_NODE_TYPES.audioNode:
      return { width: CANVAS_GRAPH_AUDIO_WIDTH, height: CANVAS_GRAPH_AUDIO_HEIGHT }
    default:
      return { width: CANVAS_GRAPH_IMAGE_WIDTH, height: CANVAS_GRAPH_IMAGE_HEIGHT }
  }
}

export function applyCanvasGraphNodeLayout(node: Node): Node {
  const size = resolveCanvasGraphNodeSize(node.type, node.data as Record<string, unknown>)
  return {
    ...node,
    width: size.width,
    height: size.height,
    style: {
      ...(node.style || {}),
      width: size.width,
      height: size.height,
    },
  }
}

function readCanvasGraphNodeWidth(node: Node): number | undefined {
  if (typeof node.width === 'number') return node.width
  const styleWidth = node.style?.width
  return typeof styleWidth === 'number' ? styleWidth : undefined
}

/** 旧版分镜视频节点 React Flow 占位曾用 648px 宽，会向右盖住相邻图片节点导致误拖拽 */
export function backfillCanvasStoryVideoNodeHitbox(nodes: Node[]): { nodes: Node[]; changed: boolean } {
  let changed = false
  const next = nodes.map((node) => {
    if (node.type !== CANVAS_NODE_TYPES.storyVideo) return node
    const expected = resolveCanvasGraphNodeSize(node.type, node.data as Record<string, unknown>)
    const currentWidth = readCanvasGraphNodeWidth(node)
    const widthOverflow =
      currentWidth != null && currentWidth > expected.width + 48
    const widthMismatch = currentWidth != null && currentWidth !== expected.width
    if (!widthOverflow && !widthMismatch) return node
    changed = true
    return applyCanvasGraphNodeLayout(node)
  })
  return { nodes: changed ? next : nodes, changed }
}

export function computeCanvasGraphBottom(existingNodes: Node[]): number {
  if (!existingNodes.length) return 80
  const roots = existingNodes.filter((node) => !node.parentId)
  if (!roots.length) return 80
  let maxBottom = 80
  for (const node of roots) {
    const height =
      typeof node.height === 'number'
        ? node.height
        : typeof node.style?.height === 'number'
          ? node.style.height
          : resolveCanvasGraphNodeSize(node.type, node.data as Record<string, unknown>).height
    maxBottom = Math.max(maxBottom, node.position.y + height)
  }
  return maxBottom + CANVAS_GRAPH_SHOT_GROUP_GAP_Y
}
