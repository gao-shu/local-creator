// Copyright (c) Haode AI. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import {
  appendConnectedNodeEdge,
  createConnectedCanvasNode,
} from '@/lib/canvas/canvas-add-node-connection'
import {
  assignDefaultImageNodeData,
  CANVAS_IMAGE_ROLE_LABELS,
  generateCanvasConvertedAssetName,
} from '@/lib/canvas/canvas-image-role'
import {
  CANVAS_GRAPH_PREVIEW_MAX_HEIGHT,
} from '@/lib/canvas/canvas-graph-layout'
import {
  CANVAS_PROMPT_ASSET_ROW_GAP,
  resolveCanvasPromptAssetColumnStartY,
  resolveCanvasPromptColumnX,
} from '@/lib/canvas/canvas-prompt-layout'

import { CANVAS_NODE_TYPES, type CanvasImageAssetRole } from '@/types/canvas-nodes'

const IMAGE_NODE_HEIGHT = 26 + CANVAS_GRAPH_PREVIEW_MAX_HEIGHT + 12
const ROW_GAP = CANVAS_PROMPT_ASSET_ROW_GAP

function resolveUniqueEntityImageName(
  entityName: string,
  role: CanvasImageAssetRole,
  usedNames: string[],
): string {
  const trimmed = entityName.trim()
  const base = trimmed || generateCanvasConvertedAssetName(role, usedNames)
  const used = new Set(usedNames.map((name) => name.trim().toLowerCase()).filter(Boolean))
  if (!used.has(base.toLowerCase())) return base
  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${base}${index}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
  return `${base}_${Date.now().toString().slice(-4)}`
}

export interface CanvasPromptExtractEntity {
  name: string
  description: string
}

function collectImageNames(nodes: Node[]): string[] {
  return nodes
    .filter((node) => node.type === CANVAS_NODE_TYPES.imageNode)
    .map((node) => String((node.data as { imageName?: string }).imageName || '').trim())
    .filter(Boolean)
}

function appendAssetNode(
  sourceNodeId: string,
  role: CanvasImageAssetRole,
  entity: CanvasPromptExtractEntity,
  position: { x: number; y: number },
  existingNodes: Node[],
  pendingNodes: Node[],
  usedNames: string[],
): { node: Node; edge: Edge | null } {
  const imageName = resolveUniqueEntityImageName(entity.name, role, usedNames)
  usedNames.push(imageName)
  const data = assignDefaultImageNodeData([...existingNodes, ...pendingNodes], {
    assetRole: role,
    prompt: entity.description,
    imageName,
    entityName: entity.name.trim() || imageName,
    assetRoleConverted: true,
    label: `${CANVAS_IMAGE_ROLE_LABELS[role]} · ${entity.name.trim() || imageName}`,
  })
  return createConnectedCanvasNode(
    CANVAS_NODE_TYPES.imageNode,
    position,
    { direction: 'source', nodeId: sourceNodeId, handleId: 'right' },
    data,
  )
}

/** 从文本节点右侧生成角色 / 场景图片节点（两列布局） */
export function buildAssetNodesFromPromptText(
  sourceNode: Node,
  characters: CanvasPromptExtractEntity[],
  scenes: CanvasPromptExtractEntity[],
  existingNodes: Node[],
  existingEdges: Edge[] = [],
): { nodes: Node[]; edges: Edge[] } {
  const sourceX = sourceNode.position.x
  const { characterColX, sceneColX } = resolveCanvasPromptColumnX(sourceX)
  const characterStartY = resolveCanvasPromptAssetColumnStartY(
    sourceNode,
    'character',
    existingNodes,
    existingEdges,
  )
  const sceneStartY = resolveCanvasPromptAssetColumnStartY(
    sourceNode,
    'scene',
    existingNodes,
    existingEdges,
  )
  const usedNames = collectImageNames(existingNodes)
  const nodes: Node[] = []
  let edges: Edge[] = []

  characters.forEach((entity, index) => {
    const { node, edge } = appendAssetNode(
      sourceNode.id,
      'character',
      entity,
      { x: characterColX, y: characterStartY + index * (IMAGE_NODE_HEIGHT + ROW_GAP) },
      existingNodes,
      nodes,
      usedNames,
    )
    nodes.push(node)
    edges = appendConnectedNodeEdge(edges, edge)
  })

  scenes.forEach((entity, index) => {
    const { node, edge } = appendAssetNode(
      sourceNode.id,
      'scene',
      entity,
      { x: sceneColX, y: sceneStartY + index * (IMAGE_NODE_HEIGHT + ROW_GAP) },
      existingNodes,
      nodes,
      usedNames,
    )
    nodes.push(node)
    edges = appendConnectedNodeEdge(edges, edge)
  })

  return { nodes, edges }
}
