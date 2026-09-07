// Copyright (c) Haode AI. All rights reserved.

import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { getCanvasProject } from '@/lib/storage/canvas-service'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { readSettings } from '@/lib/storage/settings-service'
import { getWorkflowProject } from '@/lib/storage/workflow-service'
import type { ExtractAudioProjectKind } from '@/lib/media/extract-audio-from-video'

export interface ExtractAudioProjectContext {
  projectRoot?: string
  projectTitle?: string
}

/** 解析抽音所需的 workflow / canvas 项目根与标题 */
export async function resolveExtractAudioProjectContext(
  projectId: string,
  projectKind: ExtractAudioProjectKind,
): Promise<ExtractAudioProjectContext> {
  const trimmedProjectId = String(projectId || '').trim()
  if (!trimmedProjectId) return {}

  try {
    const settingsRes = await readSettings()
    const projectRoot =
      projectKind === 'workflow'
        ? resolveProjectRoot(settingsRes.data, settingsRes.appDataDir, trimmedProjectId)
        : resolveCanvasProjectRoot(settingsRes.data, settingsRes.appDataDir, trimmedProjectId)

    let projectTitle: string | undefined
    try {
      if (projectKind === 'workflow') {
        const meta = await getWorkflowProject(trimmedProjectId)
        projectTitle = meta.title?.trim() || undefined
      } else {
        const meta = await getCanvasProject(trimmedProjectId)
        projectTitle = meta.title?.trim() || undefined
      }
    } catch {
      // 标题读取失败不影响抽音
    }

    return { projectRoot, projectTitle }
  } catch {
    return {}
  }
}
