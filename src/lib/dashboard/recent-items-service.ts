// Copyright (c) local-creator contributors. All rights reserved.

import { loadSyncedMaterialLibrary, type MaterialLibraryItem } from '@/lib/materials/material-library-service'
import { listCanvasProjects } from '@/lib/storage/canvas-service'
import { listWorkflowProjects } from '@/lib/storage/workflow-service'
import type { CanvasProjectMeta } from '@/types/canvas'
import type { WorkflowProjectMeta } from '@/types/workflow'

export type RecentAssetItem = MaterialLibraryItem

export type RecentProjectKind = 'workshop' | 'canvas'

export type RecentProjectItem =
  | { kind: 'workshop'; project: WorkflowProjectMeta }
  | { kind: 'canvas'; project: CanvasProjectMeta }

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

export async function loadRecentProjects(limit = 3): Promise<RecentProjectItem[]> {
  const [workshopResult, canvasResult] = await Promise.allSettled([
    listWorkflowProjects(),
    listCanvasProjects(),
  ])

  const workshopProjects =
    workshopResult.status === 'fulfilled' ? workshopResult.value : []
  const canvasProjects = canvasResult.status === 'fulfilled' ? canvasResult.value : []

  const items: RecentProjectItem[] = [
    ...workshopProjects.map((project) => ({ kind: 'workshop' as const, project })),
    ...canvasProjects.map((project) => ({ kind: 'canvas' as const, project })),
  ]

  return items.sort((a, b) => b.project.updatedAt - a.project.updatedAt).slice(0, limit)
}

export async function loadRecentAssets(limit = 10): Promise<RecentAssetItem[]> {
  const items = await loadSyncedMaterialLibrary()
  return items.slice(0, limit)
}
