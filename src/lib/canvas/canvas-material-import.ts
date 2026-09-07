// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import type { MaterialLibraryItem } from '@/lib/materials/material-library-service'
import { resolveMaterialLibraryMediaOwner } from '@/lib/materials/global-materials-paths'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'
import { CANVAS_IMAGE_ROLE_LABELS } from '@/lib/canvas/canvas-image-role'
import { CANVAS_NODE_TYPES, type CanvasImageAssetRole, type CanvasImageNodeData, type CanvasReferenceImageNodeData } from '@/types/canvas-nodes'
import { getAssetPreviewPath } from '@/lib/workflow/asset-utils'
import type { AssetKind } from '@/types/workflow'

const NODE_COL_GAP = 360
const NODE_ROW_GAP = 420
const GRID_COLUMNS = 3

function mapAssetKindToCanvasRole(kind: AssetKind): CanvasImageAssetRole {
  if (kind === 'prop') return 'item'
  return kind
}

export function mapCanvasRoleToAssetKind(role?: CanvasImageAssetRole): AssetKind {
  if (role === 'item') return 'prop'
  if (role === 'scene') return 'scene'
  return 'character'
}

/** 素材库条目在画布上应展示为对应人物/场景/道具资产（非普通图片） */
function buildMaterialLibraryAssetFields(item: MaterialLibraryItem) {
  const assetRole = mapAssetKindToCanvasRole(item.asset.kind)
  const name = item.asset.name.trim() || '未命名'
  const layoutKey = item.asset.layoutKey?.trim() || undefined

  return {
    assetRole,
    assetRoleConverted: true,
    assetRoleOrigin: assetRole,
    entityName: name,
    imageName: name,
    label: `${CANVAS_IMAGE_ROLE_LABELS[assetRole]} · ${name}`,
    ...(layoutKey ? { layoutKey } : {}),
    importWorkflowAssetId: item.asset.id,
    importWorkflowProjectId: item.projectId,
    materialLibraryEntryId: materialLibraryItemKey(item),
    materialSourceAssetId: item.asset.id,
    materialSourceProjectId: item.projectId,
  }
}

/** 将单个素材库条目应用到已有画布节点（生图 / 参考图） */
export function buildCanvasNodePatchFromMaterialItem(
  nodeType: string,
  item: MaterialLibraryItem,
): Record<string, unknown> {
  const outputPath = getAssetPreviewPath(item.asset)
  const assetFields = buildMaterialLibraryAssetFields(item)
  const mediaOwner = resolveMaterialLibraryMediaOwner(outputPath, item.projectId)
  const shared = {
    ...assetFields,
    status: outputPath ? 'success' : 'idle',
    error: undefined,
  }

  if (nodeType === CANVAS_NODE_TYPES.referenceImage) {
    const patch: Partial<CanvasReferenceImageNodeData> = {
      ...shared,
      imagePath: outputPath,
      mediaOwnerKind: outputPath ? mediaOwner.ownerKind : undefined,
      mediaOwnerProjectId: outputPath ? mediaOwner.ownerProjectId : undefined,
      pickOnMount: false,
    }
    return patch
  }

  const patch: Partial<CanvasImageNodeData> = {
    ...shared,
    outputPath,
    outputOwnerKind: outputPath ? mediaOwner.ownerKind : undefined,
    outputOwnerProjectId: outputPath ? mediaOwner.ownerProjectId : undefined,
    prompt: item.asset.prompt || item.asset.description || '',
  }
  return patch
}

export type CanvasMaterialLibraryIntent =
  | { type: 'add-nodes' }
  | { type: 'pick'; nodeId: string; nodeType: string }

export interface CanvasMaterialLibraryRequest {
  intent: CanvasMaterialLibraryIntent
  defaultKind: AssetKind
}

export function createCanvasMaterialLibraryRequest(
  intent: CanvasMaterialLibraryIntent,
  defaultKind: AssetKind = 'character',
): CanvasMaterialLibraryRequest {
  return { intent, defaultKind }
}

export function materialLibraryItemKey(item: MaterialLibraryItem): string {
  return item.libraryEntryId || `${item.projectId}:${item.asset.id}`
}

/** 收集画布上已导入的素材库条目 key */
export function collectCanvasMaterialLibraryKeys(nodes: Node[]): Set<string> {
  const keys = new Set<string>()
  for (const node of nodes) {
    const data = node.data as { materialLibraryEntryId?: string }
    const key = String(data.materialLibraryEntryId || '').trim()
    if (key) keys.add(key)
  }
  return keys
}

/** 将素材库条目转为画布生图节点（引用全局素材库或遗留源项目路径） */
export function buildCanvasNodesFromMaterialItems(
  items: MaterialLibraryItem[],
  anchor: { x: number; y: number },
): Node[] {
  return items.map((item, index) => {
    const col = index % GRID_COLUMNS
    const row = Math.floor(index / GRID_COLUMNS)
    const outputPath = getAssetPreviewPath(item.asset)
    const assetFields = buildMaterialLibraryAssetFields(item)
    const mediaOwner = resolveMaterialLibraryMediaOwner(outputPath, item.projectId)

    return createCanvasNode(
      CANVAS_NODE_TYPES.imageNode,
      {
        x: anchor.x + col * NODE_COL_GAP,
        y: anchor.y + row * NODE_ROW_GAP,
      },
      {
        ...assetFields,
        prompt: item.asset.prompt || item.asset.description || '',
        outputPath: outputPath || undefined,
        outputOwnerKind: outputPath ? mediaOwner.ownerKind : undefined,
        outputOwnerProjectId: outputPath ? mediaOwner.ownerProjectId : undefined,
        status: outputPath ? 'success' : 'idle',
      },
    )
  })
}

export function resolveCanvasMaterialImportAnchor(nodes: Node[]): { x: number; y: number } {
  if (!nodes.length) return { x: 120, y: 80 }
  const roots = nodes.filter((node) => !node.parentId)
  const list = roots.length ? roots : nodes
  const maxY = Math.max(...list.map((node) => node.position.y))
  const minX = Math.min(...list.map((node) => node.position.x))
  return { x: minX, y: maxY + NODE_ROW_GAP }
}
