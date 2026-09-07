// Copyright (c) local-creator contributors. All rights reserved.

import type { VoiceLibraryEntry, VoiceLibraryProjectKind } from '@/types/voice-library'

export interface VoiceLibraryAPI {
  list: () => Promise<{ success: boolean; voices?: VoiceLibraryEntry[]; error?: string }>
  selectReferenceAudio: () => Promise<{
    success: boolean
    canceled?: boolean
    filePath?: string
    error?: string
  }>
  addVoice: (payload: {
    name: string
    sourceAudioPath: string
    projectId: string
    projectTitle?: string
    projectKind?: VoiceLibraryProjectKind
  }) => Promise<{ success: boolean; voice?: VoiceLibraryEntry; error?: string }>
  /** @deprecated 全局音色库不再需要 fork */
  forkEntries?: (payload: {
    sourceProjectId: string
    sourceProjectKind?: VoiceLibraryProjectKind
    targetProjectId: string
    targetProjectKind?: VoiceLibraryProjectKind
    voiceIds: string[]
  }) => Promise<{ success: boolean; forkedCount?: number; error?: string }>
}

function isVoiceIpcUnavailableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /no handler registered/i.test(message)
}

export async function listVoiceLibraryEntries(): Promise<VoiceLibraryEntry[]> {
  if (!window.voiceAPI?.list) return []
  try {
    const res = await window.voiceAPI.list()
    if (!res.success) throw new Error(res.error || '读取音色库失败')
    return res.voices ?? []
  } catch (error: unknown) {
    if (isVoiceIpcUnavailableError(error)) {
      console.warn('[voice-library] IPC handler unavailable, skip list')
      return []
    }
    throw error
  }
}

export async function selectVoiceReferenceAudio(): Promise<string | null> {
  if (!window.voiceAPI?.selectReferenceAudio) {
    throw new Error('音色库仅在桌面客户端可用')
  }
  try {
    const res = await window.voiceAPI.selectReferenceAudio()
    if (!res.success) throw new Error(res.error || '选择音频失败')
    if (res.canceled || !res.filePath) return null
    return res.filePath
  } catch (error: unknown) {
    if (isVoiceIpcUnavailableError(error)) {
      throw new Error('音色库服务未就绪，请完全退出并重新启动桌面客户端')
    }
    throw error
  }
}

/** @deprecated 全局音色库不再需要跨项目 fork */
export async function forkVoiceLibraryEntries(_payload: {
  sourceProjectId: string
  sourceProjectKind?: VoiceLibraryProjectKind
  targetProjectId: string
  targetProjectKind?: VoiceLibraryProjectKind
  voiceIds: string[]
}): Promise<{ forkedCount: number }> {
  return { forkedCount: 0 }
}

export async function addVoiceLibraryEntry(
  name: string,
  sourceAudioPath: string,
  options: {
    projectId: string
    projectTitle?: string
    projectKind?: VoiceLibraryProjectKind
  },
): Promise<VoiceLibraryEntry> {
  if (!window.voiceAPI?.addVoice) {
    throw new Error('音色库仅在桌面客户端可用')
  }
  const projectId = String(options.projectId || '').trim()
  if (!projectId) {
    throw new Error('项目未就绪，无法保存音色')
  }
  try {
    const res = await window.voiceAPI.addVoice({
      name,
      sourceAudioPath,
      projectId,
      projectTitle: options.projectTitle,
      projectKind: options.projectKind,
    })
    if (!res.success || !res.voice) throw new Error(res.error || '添加音色失败')
    return res.voice
  } catch (error: unknown) {
    if (isVoiceIpcUnavailableError(error)) {
      throw new Error('音色库服务未就绪，请完全退出并重新启动桌面客户端')
    }
    throw error
  }
}

export type VoiceProjectKind = VoiceLibraryProjectKind
