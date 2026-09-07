// Copyright (c) haode-ai-client. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { WorkflowProjectData, WorkflowProjectMeta } from '@/types/workflow'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import { toProjectRelativeMediaPath } from '@/lib/storage/media-path-resolver'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { getAssetPreviewPath } from '@/lib/workflow/asset-utils'
import { collectProjectPreviewPaths } from '@/lib/workflow/project-preview-utils'
import { saveProjectMediaFromDataUrl } from '@/lib/workflow/project-media-save'
import { getShotPreviewPath } from '@/lib/workflow/shot-utils'
import { readWorkflowData } from '@/lib/storage/workflow-service'

export interface ProjectCoverCandidate {
  id: string
  label: string
  group: 'shot' | 'character' | 'scene' | 'prop'
  path: string
}

export type ProjectCoverChange =
  | 'keep'
  | 'auto'
  | { source: 'upload'; dataUrl: string }
  | { source: 'asset'; path: string }

/** 可选为封面的分镜图 / 资产图 */
export function collectProjectCoverCandidates(data: WorkflowProjectData): ProjectCoverCandidate[] {
  const items: ProjectCoverCandidate[] = []
  const seen = new Set<string>()

  const push = (candidate: ProjectCoverCandidate) => {
    if (seen.has(candidate.path)) return
    seen.add(candidate.path)
    items.push(candidate)
  }

  const shots = [...(data.shots ?? [])].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const shot of shots) {
    const path = getShotPreviewPath(shot)
    if (!path) continue
    push({
      id: shot.id,
      label: `分镜 ${shot.shotNumber}`,
      group: 'shot',
      path,
    })
  }

  const assetGroups = [
    { key: 'characters' as const, group: 'character' as const, prefix: '角色' },
    { key: 'scenes' as const, group: 'scene' as const, prefix: '场景' },
    { key: 'props' as const, group: 'prop' as const, prefix: '物品' },
  ]

  for (const { key, group, prefix } of assetGroups) {
    const assets = [...data[key]].sort((a, b) => b.updatedAt - a.updatedAt)
    for (const asset of assets) {
      const path = getAssetPreviewPath(asset)
      if (!path) continue
      push({
        id: asset.id,
        label: `${prefix} · ${asset.name}`,
        group,
        path,
      })
    }
  }

  return items
}

/** 解析项目卡片封面：手动封面优先，否则自动拼图 */
export async function resolveProjectCardPreviews(
  project: WorkflowProjectMeta,
  options: {
    settings: AppSettings
    appDataDir: string
  },
): Promise<{ urls: string[]; manual: boolean }> {
  const projectRoot = resolveProjectRoot(options.settings, options.appDataDir, project.id)

  if (project.coverImagePath) {
    const coverUrl = await readImageAsDataUrl(project.coverImagePath, projectRoot)
    if (coverUrl) return { urls: [coverUrl], manual: true }
  }

  const data = await readWorkflowData(project.id)
  const paths = collectProjectPreviewPaths(data)
  const urls = await Promise.all(paths.map((filePath) => readImageAsDataUrl(filePath, projectRoot)))
  return {
    urls: urls.filter((url): url is string => Boolean(url)),
    manual: false,
  }
}

/** 保存上传封面到项目根目录 cover.jpg */
export async function saveProjectCoverImage(
  dataUrl: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
  },
): Promise<string> {
  return saveProjectMediaFromDataUrl({
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    dataUrl,
    entityId: options.projectId,
    target: 'cover',
    purpose: 'ref',
  })
}

/** 引用项目内已有图片作为封面（不复制文件） */
export function referenceProjectCoverPath(
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
  const projectRoot = resolveProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )
  return toProjectRelativeMediaPath(trimmed, projectRoot)
}
