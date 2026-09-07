// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { CANVAS_NODE_CONSOLE_WIDTH } from '@/lib/canvas/canvas-console-layout'
import { CANVAS_NODE_TYPES, type CanvasImageNodeData } from '@/types/canvas-nodes'

/** 图片预览区宽度（收起态） */
export const CANVAS_IMAGE_PREVIEW_WIDTH_PX = 320

/** 文本/图片节点收起态预览区：与预览宽同高的正方形 */
export const CANVAS_MEDIA_NODE_SQUARE_ASPECT = '1 / 1' as const

/** 画布视频节点预览高度（与图片 1:1 预览边长一致） */
export const CANVAS_VIDEO_PREVIEW_HEIGHT_PX = CANVAS_IMAGE_PREVIEW_WIDTH_PX

/** 画布视频节点默认横屏 16:9 预览宽度 */
export const CANVAS_VIDEO_PREVIEW_WIDTH_PX = Math.round(
  CANVAS_VIDEO_PREVIEW_HEIGHT_PX * (16 / 9),
)

/** 竖屏等窄画幅：预览宽度与图片一致，高度按画幅比例扩展 */
export function resolveCanvasVideoPreviewDimensions(aspectRatio?: string): {
  width: number
  height: number
} {
  const parts = String(aspectRatio || '16:9')
    .split(':')
    .map(Number)
  if (parts.length === 2 && parts[0]! > 0 && parts[1]! > 0) {
    const widthRatio = parts[0]!
    const heightRatio = parts[1]!
    if (widthRatio >= heightRatio) {
      return {
        width: Math.round(CANVAS_VIDEO_PREVIEW_HEIGHT_PX * (widthRatio / heightRatio)),
        height: CANVAS_VIDEO_PREVIEW_HEIGHT_PX,
      }
    }
    return {
      width: CANVAS_IMAGE_PREVIEW_WIDTH_PX,
      height: Math.round(CANVAS_IMAGE_PREVIEW_WIDTH_PX * (heightRatio / widthRatio)),
    }
  }
  return {
    width: CANVAS_VIDEO_PREVIEW_WIDTH_PX,
    height: CANVAS_VIDEO_PREVIEW_HEIGHT_PX,
  }
}

/** 图片节点 React Flow 占位宽度（展开控制台时与下栏同宽） */
export const CANVAS_IMAGE_NODE_WIDTH_PX = CANVAS_NODE_CONSOLE_WIDTH

/** 预览图在外壳内水平居中偏移（仅旧版 layoutShellV1 数据迁移用） */
export const CANVAS_IMAGE_PREVIEW_OFFSET_X =
  (CANVAS_IMAGE_NODE_WIDTH_PX - CANVAS_IMAGE_PREVIEW_WIDTH_PX) / 2

/** 预览图右缘在外壳坐标系中的 x（旧布局） */
export const CANVAS_IMAGE_PREVIEW_RIGHT_X =
  CANVAS_IMAGE_PREVIEW_OFFSET_X + CANVAS_IMAGE_PREVIEW_WIDTH_PX

/** 图片节点外壳与预览布局（外壳恒为 320，控制台绝对浮层不占位） */
export function resolveCanvasImageShellLayout(): {
  shellWidth: number
  previewWidth: number
} {
  const previewWidth = CANVAS_IMAGE_PREVIEW_WIDTH_PX
  return {
    shellWidth: previewWidth,
    previewWidth,
  }
}

/**
 * 旧版图片节点根宽 320、控制台 648 且 left:-164，底部左侧控件落在节点 hitbox 外无法点击。
 * 迁移：根宽改为 648，position.x 左移 164px，保持预览图在画布上的视觉位置不变。
 */
export function backfillCanvasImageNodeShellLayout(nodes: Node[]): {
  nodes: Node[]
  changed: boolean
} {
  let changed = false
  const next = nodes.map((node) => {
    if (node.type !== CANVAS_NODE_TYPES.imageNode) return node
    const data = node.data as CanvasImageNodeData
    if (data.layoutShellV2) return node
    changed = true
    return {
      ...node,
      position: {
        ...node.position,
        x: node.position.x - CANVAS_IMAGE_PREVIEW_OFFSET_X,
      },
      data: {
        ...data,
        layoutShellV2: true,
      },
    }
  })
  return { nodes: next, changed }
}
