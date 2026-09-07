// Copyright (c) Haode AI. All rights reserved.

import type { Node } from '@xyflow/react'
import { toast } from 'sonner'
import type { AppSettings } from '@/types/settings'
import { buildCanvasEpisodeLabel } from '@/lib/canvas/canvas-episode-label'
import { exportClipsToCapcutDraft } from '@/lib/capcut/capcut-export-service'
import { formatCanvasVideoNodeName } from '@/lib/canvas/canvas-video-naming'
import {
  compareNodesByStoryboardShot,
  isPendingCanvasVideoNode,
  resolveStoryboardShotNumber,
} from '@/lib/canvas/canvas-shot-utils'
import { resolveCanvasMediaProjectRoot } from '@/lib/canvas/canvas-media-resolve'
import { resolveCanvasAssetDir, resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { copyMediaFileToDir, revealPathInExplorer } from '@/lib/storage/fs-service'
import { selectDirectory } from '@/lib/storage/settings-service'
import {
  isRemoteMediaReference,
  normalizeStoredMediaPath,
  resolveProjectMediaPath,
} from '@/lib/storage/media-path-resolver'
import {
  CANVAS_NODE_TYPES,
  type CanvasMediaOwnerKind,
  type CanvasVideoNodeData,
} from '@/types/canvas-nodes'
import type { ParsedValidateIssue } from '@/lib/workflow/storyboard-prompt'

export interface CanvasEpisodeVideoDeliverable {
  nodeId: string
  shotNumber?: number
  shotId?: string
  label: string
  storedPath: string
  absolutePath?: string
  outputOwnerKind?: CanvasMediaOwnerKind
  outputOwnerProjectId?: string
}

function buildVideoDeliverableLabel(data: CanvasVideoNodeData): string {
  const shotNumber = resolveStoryboardShotNumber(data)
  if (shotNumber != null) {
    return formatCanvasVideoNodeName(`镜 ${shotNumber}`)
  }
  const name = data.videoName?.trim()
  if (name) return formatCanvasVideoNodeName(name)
  return formatCanvasVideoNodeName(data.label)
}

function sortVideoDeliverableNodes(a: Node, b: Node): number {
  return compareNodesByStoryboardShot(a, b)
}

/** 收集画布中已成功产出的视频节点（按镜号排序） */
export function collectCanvasSuccessVideoNodes(nodes: Node[]): Node[] {
  return nodes
    .filter((node) => node.type === CANVAS_NODE_TYPES.storyVideo)
    .filter((node) => {
      const data = node.data as CanvasVideoNodeData
      return data.status === 'success' && Boolean(normalizeStoredMediaPath(data.outputPath || ''))
    })
    .sort(sortVideoDeliverableNodes)
}

export interface CanvasExportContinuityIssueView extends ParsedValidateIssue {
  /** 节点展示标签，如「视频  镜 3」 */
  label: string
}

export interface CanvasExportPreflightSummary {
  readyCount: number
  runningCount: number
  failedCount: number
  pendingCount: number
  runningLabels: string[]
  failedLabels: string[]
  pendingLabels: string[]
  warnings: string[]
  /** 有镜号但缺少 spatialAnchor 的视频节点标签 */
  missingSpatialAnchorLabels: string[]
  /** 节点上已缓存的连续性 issues（P0 空壳；有数据则列出） */
  continuityIssues: CanvasExportContinuityIssueView[]
  canExport: boolean
}

function collectCanvasContinuityPreflight(nodes: Node[]): {
  missingSpatialAnchorLabels: string[]
  continuityIssues: CanvasExportContinuityIssueView[]
} {
  const missingSpatialAnchorLabels: string[] = []
  const continuityIssues: CanvasExportContinuityIssueView[] = []

  const storyboardVideos = nodes
    .filter((node) => node.type === CANVAS_NODE_TYPES.storyVideo)
    .sort(sortVideoDeliverableNodes)

  for (const node of storyboardVideos) {
    const data = node.data as CanvasVideoNodeData
    const shotNumber = resolveStoryboardShotNumber(data)
    if (shotNumber == null) continue

    const label = buildVideoDeliverableLabel(data)
    if (!String(data.spatialAnchor || '').trim()) {
      missingSpatialAnchorLabels.push(label)
    }

    const issues = Array.isArray(data.continuityIssues) ? data.continuityIssues : []
    for (const issue of issues) {
      if (!issue || typeof issue !== 'object') continue
      const type = String(issue.type || '').trim() || 'continuity'
      const problem = String(issue.problem || '').trim()
      if (!problem) continue
      continuityIssues.push({
        ...issue,
        type,
        problem,
        shotNumber: issue.shotNumber ?? shotNumber,
        label,
      })
    }
  }

  return { missingSpatialAnchorLabels, continuityIssues }
}

/**
 * 导出前预检：统计可导出 / 运行中 / 失败 / 待生成，并附带文戏连续（缺锚点 / 缓存 issues）。
 * 文戏警告不阻死 canExport；不在此调 LLM。
 */
export function buildCanvasExportPreflight(nodes: Node[]): CanvasExportPreflightSummary {
  const videoNodes = nodes.filter((node) => node.type === CANVAS_NODE_TYPES.storyVideo)
  const runningLabels: string[] = []
  const failedLabels: string[] = []
  const pendingLabels: string[] = []

  for (const node of videoNodes) {
    const data = node.data as CanvasVideoNodeData
    const label = buildVideoDeliverableLabel(data)
    if (data.status === 'running') {
      runningLabels.push(label)
      continue
    }
    if (data.status === 'error') {
      failedLabels.push(label)
      continue
    }
    if (isPendingCanvasVideoNode(node)) {
      pendingLabels.push(label)
    }
  }

  const readyCount = collectCanvasSuccessVideoNodes(nodes).length
  const warnings: string[] = []
  if (runningLabels.length) {
    warnings.push(`${runningLabels.length} 个视频仍在生成，导出不会包含它们`)
  }
  if (failedLabels.length) {
    warnings.push(`${failedLabels.length} 个视频生成失败，需重新生成后再导出`)
  }
  if (pendingLabels.length) {
    warnings.push(`${pendingLabels.length} 个视频尚未生成`)
  }
  if (readyCount === 0) {
    warnings.push('当前没有可导出的成功视频')
  }

  const continuity = collectCanvasContinuityPreflight(nodes)

  return {
    readyCount,
    runningCount: runningLabels.length,
    failedCount: failedLabels.length,
    pendingCount: pendingLabels.length,
    runningLabels,
    failedLabels,
    pendingLabels,
    // 仅媒体状态类警告；文戏连续见 missingSpatialAnchorLabels / continuityIssues
    warnings,
    missingSpatialAnchorLabels: continuity.missingSpatialAnchorLabels,
    continuityIssues: continuity.continuityIssues,
    // 文戏警告不阻死导出；仅成功视频数决定 canExport
    canExport: readyCount > 0,
  }
}

export async function resolveCanvasEpisodeVideoDeliverables(options: {
  nodes: Node[]
  canvasProjectId: string
  settings: AppSettings
  appDataDir: string
}): Promise<CanvasEpisodeVideoDeliverable[]> {
  const videoNodes = collectCanvasSuccessVideoNodes(options.nodes)
  const deliverables: CanvasEpisodeVideoDeliverable[] = []

  for (const node of videoNodes) {
    const data = node.data as CanvasVideoNodeData
    const storedPath = normalizeStoredMediaPath(data.outputPath || '')
    if (!storedPath) continue

    const projectRoot = await resolveCanvasMediaProjectRoot(options.canvasProjectId, {
      ownerKind: data.outputOwnerKind,
      ownerProjectId: data.outputOwnerProjectId,
    })
    const absolutePath = projectRoot
      ? resolveProjectMediaPath(storedPath, projectRoot)
      : storedPath

    deliverables.push({
      nodeId: node.id,
      shotNumber: resolveStoryboardShotNumber(data),
      shotId: data.importShotId,
      label: buildVideoDeliverableLabel(data),
      storedPath,
      absolutePath:
        absolutePath && !isRemoteMediaReference(absolutePath) ? absolutePath : undefined,
      outputOwnerKind: data.outputOwnerKind,
      outputOwnerProjectId: data.outputOwnerProjectId,
    })
  }

  return deliverables
}

export function formatCanvasEpisodeVideoManifest(options: {
  deliverables: CanvasEpisodeVideoDeliverable[]
  projectTitle?: string
  episodeIndex?: number
  episodeTitle?: string
}): string {
  const { deliverables, projectTitle, episodeIndex, episodeTitle } = options
  const episodeLabel = buildCanvasEpisodeLabel(episodeIndex, episodeTitle)
  const header = [
    `# 画布成片清单${projectTitle ? ` · ${projectTitle}` : ''}${episodeIndex != null ? ` · ${episodeLabel}` : ''}`,
    `# 共 ${deliverables.length} 条`,
    '',
  ]

  const lines = deliverables.map((item, index) => {
    const path = item.absolutePath || item.storedPath
    return `${index + 1}. ${item.label}\t${path}`
  })

  return [...header, ...lines].join('\n')
}

export async function copyCanvasEpisodeVideoManifest(text: string): Promise<boolean> {
  const trimmed = text.trim()
  if (!trimmed) {
    toast.error('暂无可复制的成片路径')
    return false
  }
  try {
    await navigator.clipboard.writeText(trimmed)
    toast.success('已复制成片路径清单')
    return true
  } catch {
    toast.error('复制失败，请手动选择复制')
    return false
  }
}

export async function copyCanvasEpisodeVideosToDirectory(
  deliverables: CanvasEpisodeVideoDeliverable[],
  options: {
    canvasProjectId: string
    settings: AppSettings
    appDataDir: string
  },
): Promise<boolean> {
  const items = deliverables.filter((item) => Boolean(normalizeStoredMediaPath(item.storedPath || '')))
  if (!items.length) {
    toast.error('暂无可复制的视频文件')
    return false
  }

  const picked = await selectDirectory()
  if (picked.canceled) return false
  if (!picked.success || !picked.path) {
    toast.error(picked.error || '未选择目标目录')
    return false
  }

  const targetDir = picked.path
  const usedNames = new Set<string>()
  let successCount = 0
  let failCount = 0
  let lastError = ''

  for (const item of items) {
    const projectRoot =
      item.outputOwnerKind === 'workflow' && item.outputOwnerProjectId
        ? resolveProjectRoot(options.settings, options.appDataDir, item.outputOwnerProjectId)
        : resolveCanvasProjectRoot(options.settings, options.appDataDir, options.canvasProjectId)

    const sourcePath =
      item.absolutePath ||
      (projectRoot ? resolveProjectMediaPath(item.storedPath, projectRoot) : item.storedPath)

    if (!sourcePath || sourcePath.startsWith('preview:')) {
      failCount += 1
      lastError = '视频路径无效'
      continue
    }

    const extMatch = sourcePath.match(/(\.[a-zA-Z0-9]+)$/)
    const ext = extMatch?.[1]?.toLowerCase() || '.mp4'
    const base =
      item.label.replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').replace(/_+/g, '_').trim() || 'video'
    let filename = `${base}${ext}`
    let suffix = 2
    while (usedNames.has(filename.toLowerCase())) {
      filename = `${base}_${suffix}${ext}`
      suffix += 1
    }
    usedNames.add(filename.toLowerCase())

    const copied = await copyMediaFileToDir({
      sourcePath,
      targetDir,
      filename,
      externalTarget: true,
    })
    if (copied.success) {
      successCount += 1
    } else {
      failCount += 1
      lastError = copied.error || '复制失败'
    }
  }

  if (failCount === 0) {
    toast.success(`已复制 ${successCount} 个视频到指定目录`)
    return true
  }
  if (successCount > 0) {
    toast.warning(`已复制 ${successCount} 个，${failCount} 个失败`)
    return true
  }
  toast.error(lastError || '复制视频失败')
  return false
}

export async function openCanvasProjectFolder(options: {
  canvasProjectId: string
  settings: AppSettings
  appDataDir: string
}): Promise<boolean> {
  const root = resolveCanvasProjectRoot(
    options.settings,
    options.appDataDir,
    options.canvasProjectId,
  )
  const result = await revealPathInExplorer(root, { revealFile: false })
  if (!result.success) {
    toast.error(result.error || '打开项目文件夹失败')
    return false
  }
  return true
}

export async function openCanvasVideosFolder(options: {
  canvasProjectId: string
  settings: AppSettings
  appDataDir: string
}): Promise<boolean> {
  const dir = resolveCanvasAssetDir(
    options.settings,
    options.appDataDir,
    options.canvasProjectId,
    'videos',
  )
  const result = await revealPathInExplorer(dir, { revealFile: false })
  if (!result.success) {
    toast.error(result.error || '打开视频目录失败')
    return false
  }
  return true
}

/** 导出至剪映：生成剪映草稿（按镜号拼接时间线） */
export async function exportCanvasEpisodeToCapcut(options: {
  nodes: Node[]
  canvasProjectId: string
  settings: AppSettings
  appDataDir: string
  projectTitle?: string
  episodeIndex?: number
  episodeTitle?: string
}): Promise<boolean> {
  const deliverables = await resolveCanvasEpisodeVideoDeliverables(options)
  if (deliverables.length === 0) {
    toast.error('暂无成功视频，无法导出剪映草稿')
    return false
  }

  const clips = deliverables
    .map((item) => ({
      label: item.label,
      absolutePath: item.absolutePath || item.storedPath,
    }))
    .filter((item) => item.absolutePath && !item.absolutePath.startsWith('preview:'))

  const episodeLabel = buildCanvasEpisodeLabel(options.episodeIndex, options.episodeTitle)
  const projectName = [options.projectTitle, episodeLabel].filter(Boolean).join(' · ') || '画布导出'

  const manifest = formatCanvasEpisodeVideoManifest({
    deliverables,
    projectTitle: options.projectTitle,
    episodeIndex: options.episodeIndex,
    episodeTitle: options.episodeTitle,
  })

  try {
    await navigator.clipboard.writeText(manifest)
  } catch {
    // 剪贴板失败不阻断草稿导出
  }

  const result = await exportClipsToCapcutDraft({ projectName, clips })
  return result.success
}

export async function revealCanvasEpisodeVideoDeliverable(
  item: CanvasEpisodeVideoDeliverable,
): Promise<boolean> {
  const path = item.absolutePath || item.storedPath
  if (!path || isRemoteMediaReference(path)) {
    toast.error('该条目没有可打开的本地视频路径')
    return false
  }
  const result = await revealPathInExplorer(path, { revealFile: true })
  if (!result.success) {
    toast.error(result.error || '打开文件位置失败')
    return false
  }
  return true
}
