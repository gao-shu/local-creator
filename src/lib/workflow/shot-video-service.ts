// Copyright (c) Local Creator. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { WorkflowShot } from '@/types/workflow'
import { shouldUseE2eMockAi, getE2eMockDelayMs, shouldE2eMockFail, createE2eMockFailError } from '@/lib/e2e/e2e-mock-ai'
import { isWorkflowApiAvailable } from '@/lib/storage/workflow-service'
import { saveGeneratedVideoFromUrl } from '@/lib/storage/fs-service'
import { resolveProjectMediaDir, resolveProjectRoot } from '@/lib/storage/project-paths'
import { toProjectRelativeMediaPath } from '@/lib/storage/media-path-resolver'
import { pickMergedVideoModel } from '@/lib/models/merged-model-picker'
import { generateVideoRemoteUrl } from '@/lib/video/video-client'
import type { MentionCandidate } from '@/lib/workflow/mention-utils'
import {
  buildShotVideoReferenceAudioPaths,
  buildShotVideoReferenceAudioItems,
} from '@/lib/workflow/shot-audio-reference-utils'
import type { VoiceLibraryEntry } from '@/types/voice-library'
import {
  appendMissingCharacterRefImages,
  assertStoryboardImageValidated,
  enrichVideoPromptWithReferenceImageHints,
  resolveVideoReferenceContext,
  resolveVideoReferenceItems,
} from '@/lib/workflow/shot-video-utils'
import type { VideoProgressCallback } from '@/lib/video/video-progress'
import {
  normalizeVideoReferenceMode,
  type VideoReferenceMode,
} from '@/lib/workflow/storyboard-video-presets'
import { applyPromptAffix } from '@/lib/workflow/prompt-affix-utils'
import { assertNotAborted, delayWithAbort } from '@/lib/video/video-generation-abort'
import {
  extractVideoIdFromApiContentUrl,
  resolveApiOriginVideoContentUrl,
  resolveVideoDownloadHeaders,
  shouldAllowPrivateVideoContentFetch,
} from '@/lib/video/video-content-download'
import type { WorkflowAsset } from '@/types/workflow'

export interface ShotVideoGenerateOptions {
  settings?: AppSettings
  projectId?: string
  appDataDir?: string
  videoModelId?: string
  referenceMode?: VideoReferenceMode
  keyframeMode?: boolean
  episodeShots?: WorkflowShot[]
  mentionCandidates?: MentionCandidate[]
  characters?: WorkflowAsset[]
  scenes?: WorkflowAsset[]
  props?: WorkflowAsset[]
  voiceLibrary?: VoiceLibraryEntry[]
  durationSec?: number
  resolution?: string
  aspectRatio?: string
  promptPrefix?: string
  promptSuffix?: string
  /** 用户确认后跳过「分镜图已审核」校验 */
  skipImageValidation?: boolean
  onProgress?: VideoProgressCallback
  onRemoteJobCreated?: (job: import('@/types/video-remote-job').VideoRemoteJobSnapshot) => void | Promise<void>
  resumeJob?: import('@/types/video-remote-job').VideoRemoteJobSnapshot
  abortSignal?: AbortSignal
}

async function resolveSettingsContext(settings?: AppSettings) {
  const { readSettings } = await import('@/lib/storage/settings-service')
  const res = await readSettings()
  return {
    settings: settings ?? res.data,
    appDataDir: res.appDataDir,
  }
}

export async function generateShotVideo(
  shot: WorkflowShot,
  options?: ShotVideoGenerateOptions,
): Promise<string> {
  assertNotAborted(options?.abortSignal)
  const { settings, appDataDir } = await resolveSettingsContext(options?.settings)
  if (!options?.skipImageValidation) {
    assertStoryboardImageValidated(shot)
  }
  const model = pickMergedVideoModel(settings, options?.videoModelId)
  const referenceMode = normalizeVideoReferenceMode(options?.referenceMode)
  const durationSec = options?.durationSec ?? 5
  const resolution = options?.resolution ?? '720'
  const aspectRatio = options?.aspectRatio ?? '16:9'
  const projectRoot = options?.projectId
    ? resolveProjectRoot(settings, options.appDataDir || appDataDir, options.projectId)
    : undefined

  let referenceImagePaths: string[] = []
  let referenceImageItems: ReturnType<typeof resolveVideoReferenceItems> = []
  let referenceAudioPaths: string[] = []
  let referenceAudioItems: ReturnType<typeof buildShotVideoReferenceAudioItems> = []
  if (referenceMode !== 'text_to_video') {
    const referenceContext = resolveVideoReferenceContext(
      shot,
      options?.episodeShots ?? [shot],
      options?.keyframeMode,
    )
    referenceImageItems = resolveVideoReferenceItems(
      shot,
      referenceMode,
      referenceContext,
      {
        mentionCandidates: options?.mentionCandidates,
        characters: options?.characters,
        scenes: options?.scenes,
        props: options?.props,
      },
    )
    referenceAudioPaths = buildShotVideoReferenceAudioPaths(shot, {
      mentionCandidates: options?.mentionCandidates,
      characters: options?.characters,
      voiceLibrary: options?.voiceLibrary,
    })
    referenceAudioItems = buildShotVideoReferenceAudioItems(shot, {
      mentionCandidates: options?.mentionCandidates,
      characters: options?.characters,
      voiceLibrary: options?.voiceLibrary,
    })
    referenceImageItems = appendMissingCharacterRefImages(referenceImageItems, {
      shot,
      audioItems: referenceAudioItems,
      mentionCandidates: options?.mentionCandidates,
      characters: options?.characters,
      scenes: options?.scenes,
      props: options?.props,
    })
    referenceImagePaths = referenceImageItems.map((item) => item.path)
    if (!referenceImagePaths.length) {
      if (referenceMode === 'first_last_frame') {
        throw new Error(`镜号 ${shot.shotNumber} 首尾帧模式需要首帧图与尾帧/参考图`)
      }
      if (referenceMode === 'multimodal') {
        throw new Error(`镜号 ${shot.shotNumber} 全能多参模式需要至少一张参考图或分镜图`)
      }
      throw new Error(`镜号 ${shot.shotNumber} 需先生成分镜图作为首帧参考`)
    }
    if (referenceMode === 'first_last_frame' && referenceImagePaths.length < 2) {
      if (options?.keyframeMode) {
        throw new Error(
          `镜号 ${shot.shotNumber} 首尾帧模式已开启「下一分镜作尾帧」，但下一镜没有可用分镜图`,
        )
      }
      throw new Error(
        `镜号 ${shot.shotNumber} 首尾帧模式需要 2 张图（当前分镜图 + 参考图/第二张生成图，或开启「下一分镜作尾帧」）`,
      )
    }
    if (referenceAudioPaths.length > 0 && !referenceImagePaths.length) {
      throw new Error(`镜号 ${shot.shotNumber} 使用参考音频时需同时提供分镜图或参考图`)
    }
  }

  if (!shot.prompt.trim()) {
    throw new Error(`镜号 ${shot.shotNumber} 请先填写分镜提示词`)
  }

  const shotBody = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
  const promptPrefix = options?.promptPrefix
  const promptSuffix = options?.promptSuffix

  const apiPrompt =
    referenceMode !== 'text_to_video' && referenceImageItems.length > 0
      ? applyPromptAffix(
          enrichVideoPromptWithReferenceImageHints(shotBody, referenceImageItems),
          promptPrefix,
          promptSuffix,
        )
      : applyPromptAffix(shotBody, promptPrefix, promptSuffix)

  const finalPrompt = apiPrompt

  if (!isWorkflowApiAvailable() || shouldUseE2eMockAi()) {
    await delayWithAbort(getE2eMockDelayMs(1200), options?.abortSignal)
    if (shouldE2eMockFail('shot-video')) {
      throw createE2eMockFailError('shot-video')
    }
    return `preview:video:${shot.id}:${Date.now()}`
  }

  const remoteUrl = await generateVideoRemoteUrl({
    model,
    prompt: finalPrompt,
    durationSec,
    aspectRatio,
    resolution,
    referenceImagePath: referenceImagePaths[0] ?? null,
    referenceImagePaths,
    referenceImageItems: referenceImageItems.map((item) => ({
      label: item.label,
      path: item.path,
      kind: item.kind,
    })),
    referenceAudioPaths,
    referenceMode,
    projectRoot,
    apiBaseUrl: settings.apiBaseUrl,
    onProgress: options?.onProgress,
    onRemoteJobCreated: options?.onRemoteJobCreated,
    resumeJob: options?.resumeJob,
    abortSignal: options?.abortSignal,
  })

  assertNotAborted(options?.abortSignal)

  const saveDir = options?.projectId
    ? resolveProjectMediaDir(settings, options.appDataDir || appDataDir, options.projectId, 'video')
    : settings.videoSavePath?.trim() || settings.generatedImagesPath
  assertNotAborted(options?.abortSignal)
  options?.onProgress?.({ message: '正在下载成片…', progress: 100, status: 'downloading' })
  const videoId =
    options?.resumeJob?.apiTaskId || extractVideoIdFromApiContentUrl(remoteUrl)
  const apiBaseForDownload =
    options?.resumeJob?.createUrl || model.endpoint || model.baseUrl
  const downloadUrl = resolveApiOriginVideoContentUrl({
    contentUrl: remoteUrl,
    apiBaseUrl: apiBaseForDownload,
    preferredVideoId: videoId,
  })
  const downloadHeaders = resolveVideoDownloadHeaders({
    url: downloadUrl,
    apiKey: model.apiKey,
    videoId,
  })
  const saved = await saveGeneratedVideoFromUrl(downloadUrl, saveDir, {
    abortSignal: options?.abortSignal,
    headers: downloadHeaders,
    allowPrivateNetwork: shouldAllowPrivateVideoContentFetch(downloadUrl, apiBaseForDownload),
  })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '保存视频失败')
  }

  if (options?.projectId) {
    return toProjectRelativeMediaPath(saved.filePath, projectRoot!)
  }

  return saved.filePath
}
