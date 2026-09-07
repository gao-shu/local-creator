// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type {
  CanvasImageNodeData,
  CanvasMediaOwnerKind,
  CanvasPromptNodeData,
  CanvasReferenceImageNodeData,
  CanvasVideoNodeData,
} from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import {
  resolveCanvasImageDisplayName,
  resolveCanvasImageTitle,
} from '@/lib/canvas/canvas-image-role'
import { composeCanvasVideoShotBody } from '@/lib/canvas/canvas-video-prompt'

export function getUpstreamNodes(targetId: string, nodes: Node[], edges: Edge[]): Node[] {
  const sourceIds = edges.filter((edge) => edge.target === targetId).map((edge) => edge.source)
  return nodes.filter((node) => sourceIds.includes(node.id))
}

function readPromptFromNode(node: Node): string {
  if (
    node.type === CANVAS_NODE_TYPES.shotPrompt ||
    node.type === CANVAS_NODE_TYPES.note ||
    node.type === 'textNode' ||
    node.type === 'storyPrompt'
  ) {
    const data = node.data as CanvasPromptNodeData & { label?: string }
    return String(data.prompt || data.label || '').trim()
  }
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    return String((node.data as CanvasImageNodeData)?.prompt || '').trim()
  }
  if (node.type === CANVAS_NODE_TYPES.storyVideo) {
    return composeCanvasVideoShotBody(node.data as CanvasVideoNodeData)
  }
  return ''
}

function isCanvasTextPromptNode(node: Node): boolean {
  return (
    node.type === CANVAS_NODE_TYPES.shotPrompt ||
    node.type === CANVAS_NODE_TYPES.note ||
    node.type === 'textNode' ||
    node.type === 'storyPrompt'
  )
}

export function collectUpstreamPrompts(targetId: string, nodes: Node[], edges: Edge[]): string[] {
  const upstream = getUpstreamNodes(targetId, nodes, edges)
  const prompts = upstream.map(readPromptFromNode).filter(Boolean)
  return [...new Set(prompts)]
}

/** 视频节点：仅继承上游文本/Prompt 节点，不继承图片节点的生图描述 */
export function collectUpstreamTextPrompts(targetId: string, nodes: Node[], edges: Edge[]): string[] {
  const upstream = getUpstreamNodes(targetId, nodes, edges)
  const prompts = upstream.filter(isCanvasTextPromptNode).map(readPromptFromNode).filter(Boolean)
  return [...new Set(prompts)]
}

export function resolveMergedPrompt(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
  localPrompt?: string,
): string {
  const local = String(localPrompt || '').trim()
  const upstream = collectUpstreamPrompts(targetId, nodes, edges)
  if (local && upstream.length) {
    return [local, ...upstream.filter((item) => item !== local)].join('\n')
  }
  if (local) return local
  return upstream.join('\n')
}

/** 图片节点生图：控制台有描述时仅用本地，否则继承上游 Prompt（与占位符逻辑一致） */
export function resolveCanvasImageNodePrompt(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
  localPrompt?: string,
): string {
  const local = String(localPrompt || '').trim()
  if (local) return local
  return resolveMergedPrompt(targetId, nodes, edges, '')
}

/** 视频节点：本地描述优先；上游仅合并文本/Prompt 节点，图片连线只作参考图 */
export function resolveCanvasVideoNodePrompt(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
  localPrompt?: string,
): string {
  const local = String(localPrompt || '').trim()
  const upstream = collectUpstreamTextPrompts(targetId, nodes, edges)
  if (local && upstream.length) {
    return [local, ...upstream.filter((item) => item !== local)].join('\n')
  }
  if (local) return local
  return upstream.join('\n')
}

/** 生视频/ Agent：本地 [spatialAnchor, prompt] 再与上游文本节点合并 */
export function resolveCanvasVideoNodeShotBody(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
  data: Pick<CanvasVideoNodeData, 'spatialAnchor' | 'prompt'>,
): string {
  return resolveCanvasVideoNodePrompt(targetId, nodes, edges, composeCanvasVideoShotBody(data))
}

export interface CanvasMediaSource {
  path: string
  ownerKind?: CanvasMediaOwnerKind
  ownerProjectId?: string
}

function readImageSourceFromNode(node: Node): CanvasMediaSource | null {
  if (node.type === CANVAS_NODE_TYPES.referenceImage) {
    const data = node.data as CanvasReferenceImageNodeData
    const path = String(data.imagePath || '').trim()
    if (!path) return null
    return {
      path,
      ownerKind: data.mediaOwnerKind,
      ownerProjectId: data.mediaOwnerProjectId,
    }
  }
  if (node.type === CANVAS_NODE_TYPES.imageNode) {
    const data = node.data as CanvasImageNodeData
    const path = String(data.outputPath || '').trim()
    if (!path) return null
    return {
      path,
      ownerKind: data.outputOwnerKind,
      ownerProjectId: data.outputOwnerProjectId,
    }
  }
  return null
}

export function resolveNodeImageSource(node: Node): CanvasMediaSource | null {
  return readImageSourceFromNode(node)
}

export function collectReferenceImageSources(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
): CanvasMediaSource[] {
  const upstream = getUpstreamNodes(targetId, nodes, edges)
  const sources = upstream
    .filter(
      (node) =>
        node.type === CANVAS_NODE_TYPES.referenceImage ||
        node.type === CANVAS_NODE_TYPES.imageNode,
    )
    .map(readImageSourceFromNode)
    .filter((item): item is CanvasMediaSource => Boolean(item))
  const seen = new Set<string>()
  return sources.filter((item) => {
    const key = `${item.ownerKind || 'canvas'}:${item.ownerProjectId || ''}:${item.path}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function collectReferenceImagePaths(targetId: string, nodes: Node[], edges: Edge[]): string[] {
  return collectReferenceImageSources(targetId, nodes, edges).map((item) => item.path)
}

export interface CanvasReferenceBinding {
  edgeId: string
  sourceNodeId: string
  source: CanvasMediaSource
}

export function collectReferenceImageBindings(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
): CanvasReferenceBinding[] {
  return collectVideoLinkedImageBindings(targetId, nodes, edges)
}

/** 与视频节点存在连线的图片/参考图（双向识别连线，仅展示仍存在的边） */
export function collectVideoLinkedImageBindings(
  videoNodeId: string,
  nodes: Node[],
  edges: Edge[],
): CanvasReferenceBinding[] {
  const bindings: CanvasReferenceBinding[] = []
  const seen = new Set<string>()

  for (const edge of edges) {
    let imageNodeId: string | null = null
    if (edge.target === videoNodeId) {
      const sourceNode = nodes.find((item) => item.id === edge.source)
      if (
        sourceNode?.type === CANVAS_NODE_TYPES.referenceImage ||
        sourceNode?.type === CANVAS_NODE_TYPES.imageNode
      ) {
        imageNodeId = edge.source
      }
    } else if (edge.source === videoNodeId) {
      const targetNode = nodes.find((item) => item.id === edge.target)
      if (
        targetNode?.type === CANVAS_NODE_TYPES.referenceImage ||
        targetNode?.type === CANVAS_NODE_TYPES.imageNode
      ) {
        imageNodeId = edge.target
      }
    }
    if (!imageNodeId) continue

    const node = nodes.find((item) => item.id === imageNodeId)
    if (!node) continue
    const source = readImageSourceFromNode(node)
    if (!source?.path) continue

    const key = `${source.ownerKind || 'canvas'}:${source.ownerProjectId || ''}:${source.path}`
    if (seen.has(key)) continue
    seen.add(key)
    bindings.push({ edgeId: edge.id, sourceNodeId: imageNodeId, source })
  }

  return bindings
}

export type CanvasVideoReferenceBarSource =
  | 'connected'
  | 'mention'
  | 'upload'

export interface CanvasUpstreamReferenceAsset {
  nodeId: string
  label: string
  path: string
  ownerKind?: CanvasMediaOwnerKind
  ownerProjectId?: string
  mentionName?: string
  /** 人物/场景/道具资产：缩略图右下角展示 @ 角标 */
  isMarkedAsset?: boolean
  source?: CanvasVideoReferenceBarSource
  /** 本地上传项可在参考条移除 */
  removable?: boolean
  uploadIndex?: number
}

function mapVideoLinkedBindingToReferenceAsset(
  binding: CanvasReferenceBinding,
  nodes: Node[],
  mentionNameByNodeId?: Map<string, string>,
): CanvasUpstreamReferenceAsset {
  const node = nodes.find((item) => item.id === binding.sourceNodeId)
  let label = '参考图'
  if (node?.type === CANVAS_NODE_TYPES.imageNode) {
    const data = node.data as CanvasImageNodeData
    label = resolveCanvasImageDisplayName({
      assetRole: data.assetRole,
      importShotNumber: data.importShotNumber,
      imageName: data.imageName,
      assetRoleConverted: data.assetRoleConverted,
    }).label
  } else if (node?.type === CANVAS_NODE_TYPES.referenceImage) {
    const data = node.data as CanvasReferenceImageNodeData
    const custom = String(data.label || '').trim()
    label =
      custom ||
      resolveCanvasImageTitle({
        assetRole: data.assetRole,
        importShotNumber: data.importShotNumber,
      }).label
  }
  return {
    nodeId: binding.sourceNodeId,
    label,
    path: binding.source.path,
    ownerKind: binding.source.ownerKind,
    ownerProjectId: binding.source.ownerProjectId,
    mentionName: mentionNameByNodeId?.get(binding.sourceNodeId),
    isMarkedAsset:
      node?.type === CANVAS_NODE_TYPES.imageNode
        ? Boolean(
            (node.data as CanvasImageNodeData).assetRoleConverted &&
              (node.data as CanvasImageNodeData).assetRole,
          )
        : node?.type === CANVAS_NODE_TYPES.referenceImage
          ? Boolean((node.data as CanvasReferenceImageNodeData).assetRole)
          : false,
    source: 'connected',
  }
}

/** 视频节点上游连线关联的图片资产（用于控制台参考条展示） */
export function collectUpstreamReferenceAssets(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
  mentionNameByNodeId?: Map<string, string>,
): CanvasUpstreamReferenceAsset[] {
  return collectVideoLinkedImageBindings(targetId, nodes, edges).map((binding) =>
    mapVideoLinkedBindingToReferenceAsset(binding, nodes, mentionNameByNodeId),
  )
}

export function collectUpstreamImageSources(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
): CanvasMediaSource[] {
  const upstream = getUpstreamNodes(targetId, nodes, edges)
  return upstream
    .filter((node) => node.type === CANVAS_NODE_TYPES.imageNode)
    .map(readImageSourceFromNode)
    .filter((item): item is CanvasMediaSource => Boolean(item))
}

export function collectUpstreamImageOutputs(targetId: string, nodes: Node[], edges: Edge[]): string[] {
  return collectUpstreamImageSources(targetId, nodes, edges).map((item) => item.path)
}

export function resolvePrimaryImageSource(
  targetId: string,
  nodes: Node[],
  edges: Edge[],
): CanvasMediaSource | null {
  const generated = collectUpstreamImageSources(targetId, nodes, edges)
  if (generated.length) return generated[0]
  const references = collectReferenceImageSources(targetId, nodes, edges)
  return references[0] || null
}

export function resolvePrimaryImagePath(targetId: string, nodes: Node[], edges: Edge[]): string {
  return resolvePrimaryImageSource(targetId, nodes, edges)?.path || ''
}
