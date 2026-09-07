// Copyright (c) Haode AI. All rights reserved.

import { toast } from 'sonner'

export interface CapcutExportClipInput {
  label: string
  absolutePath: string
}

export interface CapcutExportEpisodeResult {
  success: boolean
  error?: string
  code?: 'NO_CLIPS' | 'DRAFTS_DIR_NOT_FOUND' | 'EXPORT_FAILED'
  draftPath?: string
  draftName?: string
  draftsDir?: string
  clipCount?: number
  registered?: boolean
  editorRunning?: boolean
}

function hasCapcutExportBridge(): boolean {
  return Boolean(window.electronAPI?.exportCapcutEpisode)
}

async function pickCapcutDraftsDir(defaultPath?: string): Promise<string | undefined> {
  const picked = await window.settingsAPI?.selectDirectory?.({
    defaultPath,
  })
  if (!picked?.success || !picked.path) return undefined
  return picked.path
}

export async function exportClipsToCapcutDraft(options: {
  projectName: string
  clips: CapcutExportClipInput[]
  draftsDir?: string
}): Promise<CapcutExportEpisodeResult> {
  if (!hasCapcutExportBridge()) {
    return {
      success: false,
      code: 'EXPORT_FAILED',
      error: '当前环境不支持导出剪映草稿，请使用桌面客户端',
    }
  }

  const clips = options.clips.filter((item) => String(item.absolutePath || '').trim())
  if (!clips.length) {
    return { success: false, code: 'NO_CLIPS', error: '没有可导出的本地视频文件' }
  }

  let draftsDir = options.draftsDir
  let result = await window.electronAPI!.exportCapcutEpisode!({
    projectName: options.projectName,
    clips,
    draftsDir,
  })

  if (result.code === 'DRAFTS_DIR_NOT_FOUND') {
    const pickedDir = await pickCapcutDraftsDir(result.draftsDir)
    if (!pickedDir) {
      return {
        success: false,
        code: 'DRAFTS_DIR_NOT_FOUND',
        error: '已取消选择剪映草稿目录',
      }
    }
    draftsDir = pickedDir
    result = await window.electronAPI!.exportCapcutEpisode!({
      projectName: options.projectName,
      clips,
      draftsDir,
    })
  }

  if (!result.success) {
    toast.error(result.error || '导出剪映草稿失败')
    return result
  }

  const draftLabel = result.draftName || options.projectName
  toast.success(
    `已导出至剪映草稿「${draftLabel}」（${result.clipCount ?? clips.length} 条视频）`,
    {
      description: result.editorRunning
        ? '剪映正在运行，请完全退出剪映后重新打开，在草稿列表中查看新项目'
        : '请在剪映草稿列表中打开新项目',
      duration: 6000,
    },
  )

  return result
}
