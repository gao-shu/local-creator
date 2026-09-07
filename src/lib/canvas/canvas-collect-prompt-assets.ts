// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import type { WorkflowAsset } from '@/types/workflow'
import {
  CANVAS_NODE_TYPES,
  type CanvasImageAssetRole,
  type CanvasImageNodeData,
} from '@/types/canvas-nodes'

function roleToAssetKind(role: CanvasImageAssetRole): WorkflowAsset['kind'] {
  if (role === 'character') return 'character'
  if (role === 'scene') return 'scene'
  return 'prop'
}

function collectConnectedNodeIds(sourceNodeId: string, edges: Edge[]): Set<string> {
  const ids = new Set<string>()
  for (const edge of edges) {
    if (edge.source === sourceNodeId) ids.add(edge.target)
    if (edge.target === sourceNodeId) ids.add(edge.source)
  }
  return ids
}

function imageNodeToWorkflowAsset(node: Node): WorkflowAsset | null {
  if (node.type !== CANVAS_NODE_TYPES.imageNode) return null
  const data = node.data as CanvasImageNodeData
  const role = data.assetRole
  if (!role) return null

  const name = String(data.entityName || data.imageName || data.label || '')
    .replace(/^(人物|角色|场景|物品)\s*·\s*/u, '')
    .trim()
  if (!name) return null

  const description = String(data.prompt || '').trim() || name
  return {
    id: node.id,
    kind: roleToAssetKind(role),
    name,
    description,
    prompt: description,
  }
}

/** 收集与文本节点相连的角色 / 场景 / 物品图片节点，供分镜 LLM @ 引用 */
export function collectCanvasPromptAssets(
  sourceNodeId: string,
  nodes: Node[],
  edges: Edge[],
): {
  characters: WorkflowAsset[]
  scenes: WorkflowAsset[]
  props: WorkflowAsset[]
} {
  const connectedIds = collectConnectedNodeIds(sourceNodeId, edges)
  const characters: WorkflowAsset[] = []
  const scenes: WorkflowAsset[] = []
  const props: WorkflowAsset[] = []

  for (const node of nodes) {
    if (!connectedIds.has(node.id)) continue
    const asset = imageNodeToWorkflowAsset(node)
    if (!asset) continue
    if (asset.kind === 'character') characters.push(asset)
    else if (asset.kind === 'scene') scenes.push(asset)
    else props.push(asset)
  }

  return { characters, scenes, props }
}

function isCanvasPromptBoundAssetNode(node: Node): boolean {
  return imageNodeToWorkflowAsset(node) != null
}

/** 与文本节点相连、可作为提取资产的角色 / 场景 / 物品图片节点 id */
export function resolveCanvasPromptBoundAssetNodeIds(
  sourceNodeId: string,
  nodes: Node[],
  edges: Edge[],
): string[] {
  const connectedIds = collectConnectedNodeIds(sourceNodeId, edges)
  return nodes
    .filter((node) => connectedIds.has(node.id) && isCanvasPromptBoundAssetNode(node))
    .map((node) => node.id)
}

/** 文本节点是否已有绑定资产（提取前需二次确认） */
export function needsCanvasPromptExtractConfirm(
  sourceNodeId: string,
  nodes: Node[],
  edges: Edge[],
): boolean {
  return resolveCanvasPromptBoundAssetNodeIds(sourceNodeId, nodes, edges).length > 0
}
