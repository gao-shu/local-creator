// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type { CanvasImageGridPreset } from '@/types/canvas-image-tools'
import { composeCanvasImageGrid } from '@/lib/canvas/canvas-image-grid-compose'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'
import { assignDefaultImageNodeData } from '@/lib/canvas/canvas-image-role'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { saveCanvasUploadedImageFromDataUrl } from '@/lib/canvas/canvas-media-save'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'

export interface ComposeCanvasImageGridFromNodesOptions {
  nodes: Node[]
  nodeIds: string[]
  projectId: string
  settings: AppSettings
  appDataDir: string
  appendCanvasGraph: (newNodes: Node[], newEdges: Edge[]) => void
  /** 默认按数量推断：1–4→2x2，5–6→2x3，其余 3x3 */
  preset?: CanvasImageGridPreset
}

function inferGridPreset(count: number): CanvasImageGridPreset {
  if (count <= 4) return '2x2'
  if (count <= 6) return '2x3'
  return '3x3'
}

function readNodeImagePath(node: Node): string {
  const data = (node.data || {}) as { outputPath?: string; mediaPath?: string }
  return String(data.outputPath || data.mediaPath || '').trim()
}

/**
 * 从多个图片节点读取图面 → 宫格合成 → 保存并追加 imageNode。
 */
export async function composeAndAddCanvasImageGrid(
  options: ComposeCanvasImageGridFromNodesOptions,
): Promise<{ nodeId: string; outputPath: string }> {
  const idOrder = options.nodeIds.filter(Boolean)
  const sources = idOrder
    .map((id) => options.nodes.find((node) => node.id === id))
    .filter((node): node is Node => {
      if (!node) return false
      const type = String(node.type || '')
      return (
        type === CANVAS_NODE_TYPES.imageNode || type === CANVAS_NODE_TYPES.referenceImage
      )
    })

  if (sources.length < 2) {
    throw new Error('请至少选中或引用 2 张已有输出的图片')
  }

  const projectRoot = resolveCanvasProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )
  const srcs: string[] = []
  for (const node of sources) {
    const path = readNodeImagePath(node)
    if (!path) {
      throw new Error(`「${node.id}」还没有图片输出，无法合成`)
    }
    const dataUrl = await readImageAsDataUrl(path, projectRoot)
    if (!dataUrl) {
      throw new Error(`无法读取图片：${path}`)
    }
    srcs.push(dataUrl)
  }

  const preset = options.preset || inferGridPreset(srcs.length)
  const composedDataUrl = await composeCanvasImageGrid({
    imageSrcs: srcs,
    preset,
    allowEmptyCells: true,
  })

  const anchor = sources[0]!
  const draft = createCanvasNode(
    CANVAS_NODE_TYPES.imageNode,
    { x: (anchor.position?.x || 0) + 360, y: anchor.position?.y || 80 },
    assignDefaultImageNodeData(options.nodes, {
      status: 'idle',
      imageName: `宫格合成(${srcs.length})`,
      prompt: `由 ${srcs.length} 张图合成的 ${preset} 宫格`,
    }),
  )

  const outputPath = await saveCanvasUploadedImageFromDataUrl({
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    nodeId: draft.id,
    dataUrl: composedDataUrl,
  })

  const node: Node = {
    ...draft,
    data: {
      ...draft.data,
      outputPath,
      outputOwnerKind: 'canvas',
      outputOwnerProjectId: options.projectId,
      status: 'success',
    },
  }

  options.appendCanvasGraph([node], [])
  return { nodeId: node.id, outputPath }
}
