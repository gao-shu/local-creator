// Copyright (c) local-creator contributors. All rights reserved.

import type { Node } from '@xyflow/react'
import type { AppSettings } from '@/types/settings'
import type { CanvasImageNodeData, CanvasVideoNodeData } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { resolveCanvasImageDisplayName } from '@/lib/canvas/canvas-image-role'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { saveDataUrlImage } from '@/lib/storage/fs-service'
import { toProjectRelativeMediaPath } from '@/lib/storage/media-path-resolver'
import { updateCanvasProject } from '@/lib/storage/canvas-service'
import type { ProjectCoverChange } from '@/lib/workflow/project-cover-utils'

export type CanvasCoverChange = ProjectCoverChange

export interface CanvasCoverCandidate {
  id: string
  label: string
  path: string
}

function collectCanvasImageNodePaths(nodes: Node[]): string[] {
  const paths: string[] = []

  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.imageNode) continue
    const data = node.data as CanvasImageNodeData
    const path = String(data.outputPath || '').trim()
    if (!path) continue
    if (data.outputOwnerKind === 'workflow') continue
    paths.push(path)
  }

  return paths
}

export function pickCanvasCoverFromNodes(nodes: Node[]): string | undefined {
  const paths = collectCanvasImageNodePaths(nodes)
  return paths.at(-1)
}

/** 自动拼图预览：取最近 4 张节点图 */
export function collectCanvasPreviewPaths(nodes: Node[]): string[] {
  return collectCanvasImageNodePaths(nodes).slice(-4).reverse()
}

export function collectCanvasCoverCandidates(nodes: Node[]): CanvasCoverCandidate[] {
  const items: CanvasCoverCandidate[] = []

  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.imageNode) continue
    const data = node.data as CanvasImageNodeData
    const path = String(data.outputPath || '').trim()
    if (!path) continue
    if (data.outputOwnerKind === 'workflow') continue
    items.push({
      id: node.id,
      label:
        resolveCanvasImageDisplayName({
          imageName: data.imageName,
          assetRole: data.assetRole,
          assetRoleConverted: data.assetRoleConverted,
          importShotNumber: data.importShotNumber,
        }).label || `图片 ${items.length + 1}`,
      path,
    })
  }

  return items.reverse()
}

export async function saveCanvasCoverImage(
  dataUrl: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
  },
): Promise<string> {
  const projectRoot = resolveCanvasProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )
  const saved = await saveDataUrlImage(dataUrl, {
    targetDir: projectRoot,
    filename: 'cover.jpg',
  })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '封面保存失败')
  }
  return toProjectRelativeMediaPath(saved.filePath, projectRoot)
}

export function referenceCanvasCoverPath(
  imagePath: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
  },
): string {
  const trimmed = String(imagePath || '').trim()
  if (!trimmed) throw new Error('缺少封面路径')
  if (trimmed.startsWith('data:')) {
    throw new Error('封面不能使用 base64，请先保存到项目目录')
  }
  const projectRoot = resolveCanvasProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )
  return toProjectRelativeMediaPath(trimmed, projectRoot)
}

export async function syncCanvasProjectCover(
  projectId: string,
  nodes: Node[],
  options?: { coverManual?: boolean },
): Promise<void> {
  if (options?.coverManual) return
  const coverImagePath = pickCanvasCoverFromNodes(nodes)
  if (!coverImagePath) return
  try {
    await updateCanvasProject(projectId, { coverImagePath, coverManual: false })
  } catch {
    /* 封面更新失败不阻断保存 */
  }
}

export function countCanvasNodeStats(nodes: Node[]): {
  runnable: number
  success: number
  error: number
  running: number
} {
  let runnable = 0
  let success = 0
  let error = 0
  let running = 0

  for (const node of nodes) {
    if (node.type !== CANVAS_NODE_TYPES.imageNode && node.type !== CANVAS_NODE_TYPES.storyVideo) {
      continue
    }
    runnable += 1
    const status = String((node.data as CanvasImageNodeData | CanvasVideoNodeData)?.status || 'idle')
    if (status === 'success') success += 1
    else if (status === 'error') error += 1
    else if (status === 'running') running += 1
  }

  return { runnable, success, error, running }
}
