// Copyright (c) haode-ai-client. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { isSystemModel } from '@/lib/models/system-models-service'
import { isInternalSystemModel } from '@/lib/models/system-model-routing'
import { shouldUseOpenAiVideoClient } from '@/lib/video/openai-video-client'
import { isGrokVideoModel } from '@/lib/video/grok-video-client'
import { isZhipuVideoModel } from '@/lib/video/zhipu-video-client'
import { isAgnesVideo25Model } from '@/lib/video/agnes-video-25-client'
import {
  pickExternalVideoReferencePaths,
  type ExternalVideoReferenceItem,
} from '@/lib/video/video-api-reference'
import { resolveVideoApiImageUrls } from '@/lib/video/video-media-resolve'
import { assertNotAborted } from '@/lib/video/video-generation-abort'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'

export type VideoProviderKind =
  | 'weishi'
  | 'zhipu'
  | 'grok'
  | 'agnes_video_25'
  | 'openai_compatible'
  | 'system'
  | 'unsupported'

export function resolveVideoProviderKind(model: ModelConfig): VideoProviderKind {
  if (isSystemModel(model) && model.modelKey) {
    // internal + weishi_api：成员 Key 直连微视，不走管理端代理
    if (isInternalSystemModel(model) && isWeishiApiModel(model)) return 'weishi'
    return 'system'
  }
  if (isWeishiApiModel(model)) return 'weishi'
  if (isAgnesVideo25Model(model)) return 'agnes_video_25'
  if (isGrokVideoModel(model)) return 'grok'
  if (isZhipuVideoModel(model.model || '', model.endpoint, model.apiFormat)) return 'zhipu'
  if (shouldUseOpenAiVideoClient(model)) return 'openai_compatible'
  return 'unsupported'
}

export interface PrepareExternalVideoRefsOptions {
  referenceMode?: VideoReferenceMode
  referenceImageItems?: ExternalVideoReferenceItem[]
  referenceImagePaths?: string[]
  referenceImagePath?: string | null
  projectRoot?: string
  apiBaseUrl?: string
  uploadLabel?: string
  abortSignal?: AbortSignal
}

/** 非微视模型：按参考模式选图 → 上传后台 → 返回 https URL 列表 */
export async function prepareExternalVideoReferenceUrls(
  options: PrepareExternalVideoRefsOptions,
): Promise<string[]> {
  const referenceMode = options.referenceMode ?? 'first_frame'
  const fallbackPaths =
    options.referenceImagePaths?.length
      ? options.referenceImagePaths
      : options.referenceImagePath
        ? [options.referenceImagePath]
        : []

  const pickOptions = {
    mode: referenceMode,
    items: options.referenceImageItems,
    paths: fallbackPaths,
  }

  const selectedPaths = pickExternalVideoReferencePaths(pickOptions)

  if (!selectedPaths.length) return []

  assertNotAborted(options.abortSignal)
  return resolveVideoApiImageUrls(selectedPaths, {
    apiBaseUrl: options.apiBaseUrl,
    projectRoot: options.projectRoot,
    label: options.uploadLabel ?? 'video_ref_image',
    abortSignal: options.abortSignal,
  })
}
