// Copyright (c) Haode AI. All rights reserved.

import { toast } from 'sonner'
import { buildCanvasEpisodeLabel } from '@/lib/canvas/canvas-episode-label'
import { exportClipsToCapcutDraft } from '@/lib/capcut/capcut-export-service'
import {
  isRemoteMediaReference,
  resolveProjectMediaPath,
} from '@/lib/storage/media-path-resolver'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { getShotPreviewVideoPath } from '@/lib/workflow/shot-video-utils'
import type { AppSettings } from '@/types/settings'
import type { WorkflowEpisode, WorkflowShot } from '@/types/workflow'

export interface WorkshopEpisodeVideoDeliverable {
  shotNumber: number
  shotId: string
  label: string
  storedPath: string
  absolutePath?: string
}

/** 收集本集各分镜当前选用的成片视频（按镜号排序） */
export function collectWorkshopEpisodeVideoDeliverables(
  shots: WorkflowShot[],
): WorkshopEpisodeVideoDeliverable[] {
  return shots
    .map((shot) => {
      const storedPath = getShotPreviewVideoPath(shot)
      if (!storedPath) return null
      return {
        shotNumber: shot.shotNumber,
        shotId: shot.id,
        label: `镜 ${shot.shotNumber}`,
        storedPath,
      }
    })
    .filter((item): item is WorkshopEpisodeVideoDeliverable => item != null)
    .sort((a, b) => a.shotNumber - b.shotNumber)
}

function formatWorkshopEpisodeVideoManifest(options: {
  deliverables: WorkshopEpisodeVideoDeliverable[]
  projectTitle?: string
  episode: WorkflowEpisode
}): string {
  const { deliverables, projectTitle, episode } = options
  const episodeLabel = buildCanvasEpisodeLabel(episode.episodeIndex, episode.title)
  const header = [
    `# 工坊成片清单${projectTitle ? ` · ${projectTitle}` : ''} · ${episodeLabel}`,
    `# 共 ${deliverables.length} 条`,
    '',
  ]
  const lines = deliverables.map((item, index) => {
    const path = item.absolutePath || item.storedPath
    return `${index + 1}. ${item.label}\t${path}`
  })
  return [...header, ...lines].join('\n')
}

/** 导出至剪映：生成剪映草稿（按镜号拼接时间线） */
export async function exportWorkflowEpisodeToCapcut(options: {
  shots: WorkflowShot[]
  settings: AppSettings
  appDataDir: string
  projectId: string
  projectTitle?: string
  episode: WorkflowEpisode
}): Promise<boolean> {
  const baseDeliverables = collectWorkshopEpisodeVideoDeliverables(options.shots)
  if (baseDeliverables.length === 0) {
    toast.error('本集还没有可导出的成片视频')
    return false
  }

  const projectRoot = resolveProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )
  const deliverables = baseDeliverables.map((item) => {
    const absolutePath = projectRoot
      ? resolveProjectMediaPath(item.storedPath, projectRoot)
      : item.storedPath
    return {
      ...item,
      absolutePath:
        absolutePath && !isRemoteMediaReference(absolutePath) ? absolutePath : undefined,
    }
  })

  const clips = deliverables
    .map((item) => ({
      label: item.label,
      absolutePath: item.absolutePath || item.storedPath,
    }))
    .filter((item) => item.absolutePath && !item.absolutePath.startsWith('preview:'))

  const episodeLabel = buildCanvasEpisodeLabel(options.episode.episodeIndex, options.episode.title)
  const projectName = [options.projectTitle, episodeLabel].filter(Boolean).join(' · ') || '工坊导出'

  const manifest = formatWorkshopEpisodeVideoManifest({
    deliverables,
    projectTitle: options.projectTitle,
    episode: options.episode,
  })

  try {
    await navigator.clipboard.writeText(manifest)
  } catch {
    // 剪贴板失败不阻断草稿导出
  }

  const result = await exportClipsToCapcutDraft({ projectName, clips })
  return result.success
}
