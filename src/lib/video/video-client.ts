import type { ModelConfig } from '@/types/settings'
import { type WeishiReferenceMediaUploadMode } from '@/lib/models/weishi-model-presets'
import {
  generateWeishiVideo,
  resolveWeishiCreateUrl,
  type WeishiVideoReferenceItem,
} from '@/lib/models/weishi-video-client'
import { normalizeVideoResolutionValue } from '@/lib/models/video-generation-tier-params'
import { readSettings } from '@/lib/storage/settings-service'
import { normalizeApiBase } from '@/lib/models/model-endpoint'
import { normalizeVideoModelConfig } from '@/lib/models/video-model-utils'
import { generateOpenAiCompatibleVideo } from '@/lib/video/openai-video-client'
import { generateGrokVideo, prepareGrokReferenceImageUrls } from '@/lib/video/grok-video-client'
import type { VideoProgressCallback } from '@/lib/video/video-progress'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import type { ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'
import { generateZhipuVideo, type ZhipuVideoCreateInput } from '@/lib/video/zhipu-video-client'
import { generateAgnesVideo25 } from '@/lib/video/agnes-video-25-client'
import { pickRemoteImageUrlForVideoApi } from '@/lib/video/remote-image-url'
import {
  resolveVideoApiAudioUrls,
  resolveVideoApiImageUrl,
} from '@/lib/video/video-media-resolve'
import {
  prepareExternalVideoReferenceUrls,
  resolveVideoProviderKind,
} from '@/lib/video/video-provider'
import { VIDEO_PROGRESS_UPLOADING, VIDEO_PROGRESS_SUBMITTING } from '@/lib/video/video-progress'
import { assertNotAborted } from '@/lib/video/video-generation-abort'
import type { VideoRemoteJobSnapshot } from '@/types/video-remote-job'
import { resumeVideoRemoteJob } from '@/lib/video/video-remote-job'
import { buildVideoRemoteJobSnapshot } from '@/lib/video/video-remote-job'

export function pickVideoModel(models: ModelConfig[], preferredId?: string): ModelConfig {
  if (!models.length) throw new Error('请先在系统设置中配置视频模型')
  if (preferredId) {
    const hit = models.find(
      (m) => m.id === preferredId || m.model === preferredId || m.name === preferredId,
    )
    if (hit) return hit
  }
  return models[0]
}

export interface GenerateVideoOptions {
  model: ModelConfig
  prompt: string
  durationSec?: number
  aspectRatio?: string
  resolution?: string
  referenceImagePath?: string | null
  referenceImagePaths?: string[]
  referenceImageItems?: Array<{
    label: string
    path: string
    kind?: ShotVideoReferenceKind
    weishiAssetUrl?: string
  }>
  referenceAudioPaths?: string[]
  referenceMode?: VideoReferenceMode
  withAudio?: boolean
  projectRoot?: string
  apiBaseUrl?: string
  referenceMediaUploadMode?: WeishiReferenceMediaUploadMode
  onProgress?: VideoProgressCallback
  /** 微视：确认弹窗前已上传的参考图 */
  weishiPreparedReferences?: WeishiVideoReferenceItem[]
  /** 完全无声时传 false，对应 metadata.generate_audio */
  generateAudio?: boolean
  onRemoteJobCreated?: (job: VideoRemoteJobSnapshot) => void | Promise<void>
  resumeJob?: VideoRemoteJobSnapshot
  abortSignal?: AbortSignal
}

export async function generateVideoRemoteUrl(options: GenerateVideoOptions): Promise<string> {
  return generateVideoRemoteUrlInner(options)
}

async function generateVideoRemoteUrlInner(options: GenerateVideoOptions): Promise<string> {
  const { model: rawModel, prompt } = options
  assertNotAborted(options.abortSignal)
  const model = normalizeVideoModelConfig(rawModel)
  if (!prompt.trim()) throw new Error('分镜 Prompt 为空')

  const durationSec = options.durationSec ?? 5
  const aspectRatio = options.aspectRatio ?? '16:9'
  const resolution = normalizeVideoResolutionValue(options.resolution, model)
  const provider = resolveVideoProviderKind(model)

  if (!model.apiKey?.trim()) {
    throw new Error(`模型「${model.name}」未配置 API Key`)
  }
  if (!model.model?.trim()) {
    throw new Error(`模型「${model.name}」未配置 model 名称`)
  }

  if (provider === 'weishi') {
    if (options.resumeJob) {
      return resumeVideoRemoteJob(options.resumeJob, model, options.onProgress, {
        apiBaseUrl: options.apiBaseUrl,
        abortSignal: options.abortSignal,
      })
    }
    return generateWeishiVideo(
      {
        model,
        prompt,
        durationSec,
        aspectRatio,
        resolution,
        referenceImagePath: options.referenceImagePath,
        referenceImagePaths: options.referenceImagePaths,
        referenceImageItems: options.referenceImageItems,
        referenceAudioPaths: options.referenceAudioPaths,
        referenceMode: options.referenceMode,
        projectRoot: options.projectRoot,
        apiBaseUrl: options.apiBaseUrl,
        referenceMediaUploadMode: options.referenceMediaUploadMode,
        preparedReferences: options.weishiPreparedReferences,
        generateAudio: options.generateAudio,
        abortSignal: options.abortSignal,
      },
      options.onProgress,
      {
        onRemoteJobCreated: options.onRemoteJobCreated
          ? async (payload) => {
              await options.onRemoteJobCreated?.(
                buildVideoRemoteJobSnapshot({
                  provider: 'weishi',
                  apiTaskId: payload.apiTaskId,
                  createUrl: payload.createUrl,
                  model,
                  durationSec,
                  resolution,
                }),
              )
            }
          : undefined,
      },
      options.abortSignal,
    )
  }

  const referenceMode = options.referenceMode ?? 'first_frame'
  const needsReferenceImage = referenceMode !== 'text_to_video'

  if (provider === 'grok') {
    assertNotAborted(options.abortSignal)
    if (options.resumeJob) {
      return resumeVideoRemoteJob(options.resumeJob, model, options.onProgress, {
        abortSignal: options.abortSignal,
      })
    }
    if (needsReferenceImage) {
      options.onProgress?.({ message: '读取参考图…', status: 'running' })
    }
    const resolvedImageUrls = needsReferenceImage
      ? await prepareGrokReferenceImageUrls({
          referenceMode,
          referenceImageItems: options.referenceImageItems,
          referenceImagePaths: options.referenceImagePaths,
          referenceImagePath: options.referenceImagePath,
          projectRoot: options.projectRoot,
          abortSignal: options.abortSignal,
        })
      : []
    assertNotAborted(options.abortSignal)
    if (needsReferenceImage && !resolvedImageUrls.length) {
      throw new Error(
        `图生视频缺少参考图（模式 ${referenceMode}）。请确认分镜图已生成。`,
      )
    }
    return generateGrokVideo(
      {
        model,
        prompt,
        durationSec,
        aspectRatio,
        resolution,
        resolvedImageUrls,
        referenceMode,
        projectRoot: options.projectRoot,
        apiBaseUrl: options.apiBaseUrl,
      },
      options.onProgress,
      {
        onRemoteJobCreated: options.onRemoteJobCreated
          ? async (payload) => {
              await options.onRemoteJobCreated?.(
                buildVideoRemoteJobSnapshot({
                  provider: 'grok',
                  apiTaskId: payload.apiTaskId,
                  createUrl: payload.createUrl,
                  model,
                  durationSec,
                  resolution,
                }),
              )
            }
          : undefined,
      },
      options.abortSignal,
    )
  }

  if (provider === 'agnes_video_25') {
    assertNotAborted(options.abortSignal)
    if (options.resumeJob) {
      return resumeVideoRemoteJob(options.resumeJob, model, options.onProgress, {
        abortSignal: options.abortSignal,
      })
    }
    if (needsReferenceImage) {
      options.onProgress?.(VIDEO_PROGRESS_UPLOADING)
    }
    const resolvedImageUrls = needsReferenceImage
      ? await prepareExternalVideoReferenceUrls({
          referenceMode,
          referenceImageItems: options.referenceImageItems,
          referenceImagePaths: options.referenceImagePaths,
          referenceImagePath: options.referenceImagePath,
          projectRoot: options.projectRoot,
          apiBaseUrl: options.apiBaseUrl,
          uploadLabel: 'agnes_video_25_ref',
          abortSignal: options.abortSignal,
        })
      : []
    assertNotAborted(options.abortSignal)

    const audioPaths = (options.referenceAudioPaths || []).map((p) => String(p || '').trim()).filter(Boolean)
    const resolvedAudioUrls =
      referenceMode === 'multimodal' && audioPaths.length
        ? await resolveVideoApiAudioUrls(audioPaths.slice(0, 3), {
            apiBaseUrl: options.apiBaseUrl,
            projectRoot: options.projectRoot,
            label: 'agnes_video_25_audio',
            abortSignal: options.abortSignal,
          })
        : []

    if (referenceMode === 'multimodal') {
      if (!resolvedImageUrls.length && !resolvedAudioUrls.length) {
        throw new Error('多模态参考至少需要一张参考图或一段参考音频')
      }
    } else if (needsReferenceImage && !resolvedImageUrls.length) {
      throw new Error(
        `图生视频缺少参考图（模式 ${referenceMode}）。请确认分镜图已生成并已上传至后台。`,
      )
    }

    return generateAgnesVideo25(
      {
        model,
        prompt,
        durationSec,
        aspectRatio,
        resolution,
        resolvedImageUrls,
        resolvedAudioUrls,
        referenceMode,
      },
      options.onProgress,
      {
        onRemoteJobCreated: options.onRemoteJobCreated
          ? async (payload) => {
              await options.onRemoteJobCreated?.(
                buildVideoRemoteJobSnapshot({
                  provider: 'agnes_video_25',
                  apiTaskId: payload.apiTaskId,
                  createUrl: payload.createUrl,
                  model,
                  durationSec,
                  resolution,
                }),
              )
            }
          : undefined,
      },
      options.abortSignal,
    )
  }

  if (provider === 'zhipu' || provider === 'openai_compatible') {
    assertNotAborted(options.abortSignal)
    if (needsReferenceImage) {
      options.onProgress?.(VIDEO_PROGRESS_UPLOADING)
    }
    const resolvedImageUrls = needsReferenceImage
      ? await prepareExternalVideoReferenceUrls({
          referenceMode,
          referenceImageItems: options.referenceImageItems,
          referenceImagePaths: options.referenceImagePaths,
          referenceImagePath: options.referenceImagePath,
          projectRoot: options.projectRoot,
          apiBaseUrl: options.apiBaseUrl,
          uploadLabel: provider === 'zhipu' ? 'zhipu_ref_image' : 'openai_video_ref',
          abortSignal: options.abortSignal,
        })
      : []
    assertNotAborted(options.abortSignal)

    if (needsReferenceImage && !resolvedImageUrls.length) {
      throw new Error(
        `图生视频缺少参考图（模式 ${referenceMode}）。请确认分镜图已生成并已上传至后台。`,
      )
    }

    if (provider === 'zhipu') {
      if (options.resumeJob) {
        return resumeVideoRemoteJob(options.resumeJob, model, options.onProgress, {
          abortSignal: options.abortSignal,
        })
      }
      const input: ZhipuVideoCreateInput = {
        apiKey: model.apiKey,
        endpoint: model.endpoint,
        model: model.model,
        prompt,
        durationSec,
        aspectRatio,
        resolution,
        resolvedImageUrls,
        referenceMode,
        projectRoot: options.projectRoot,
        apiBaseUrl: options.apiBaseUrl,
        withAudio: options.withAudio ?? options.generateAudio,
      }
      return generateZhipuVideo(input, options.onProgress, {
        onRemoteJobCreated: options.onRemoteJobCreated
          ? async (payload) => {
              await options.onRemoteJobCreated?.(
                buildVideoRemoteJobSnapshot({
                  provider: 'zhipu',
                  apiTaskId: payload.apiTaskId,
                  createUrl: payload.createUrl,
                  model,
                }),
              )
            }
          : undefined,
      }, options.abortSignal)
    }

    if (options.resumeJob) {
      return resumeVideoRemoteJob(options.resumeJob, model, options.onProgress, {
        abortSignal: options.abortSignal,
      })
    }

    return generateOpenAiCompatibleVideo(
      {
        model,
        prompt,
        durationSec,
        aspectRatio,
        resolution,
        resolvedImageUrls,
        referenceMode,
        projectRoot: options.projectRoot,
        apiBaseUrl: options.apiBaseUrl,
      },
      options.onProgress,
      {
        onRemoteJobCreated: options.onRemoteJobCreated
          ? async (payload) => {
              await options.onRemoteJobCreated?.(
                buildVideoRemoteJobSnapshot({
                  provider: 'openai_compatible',
                  apiTaskId: payload.apiTaskId,
                  createUrl: payload.createUrl,
                  model,
                }),
              )
            }
          : undefined,
      },
      options.abortSignal,
    )
  }

  throw new Error(
    `暂不支持该视频模型「${model.name || model.model}」（${model.platform || model.apiFormat || 'unknown'}）。` +
      '当前已支持：微视 API、智谱 CogVideoX、Grok Imagine Video、Agnes Video 2.5 Flash、OpenAI 兼容视频。',
  )
}
