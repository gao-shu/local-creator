// Copyright (c) local-creator. All rights reserved.

import type { AppSettings, ModelConfig } from '@/types/settings'
import { pickImageModel } from '@/lib/models/image-client'
import { pickLlmModel } from '@/lib/models/llm-client'
import { pickVideoModel } from '@/lib/video/video-client'
import {
  resolveSoftwareImageModelId,
  resolveSoftwareLlmModelId,
  resolveSoftwareVideoModelId,
} from '@/lib/models/software-model-prefs'

export function getMergedLlmModels(settings: AppSettings): ModelConfig[] {
  return settings.llmModels || []
}

export function getMergedImageModels(settings: AppSettings): ModelConfig[] {
  return settings.imageModels || []
}

export function getMergedImageModelGroups(settings: AppSettings) {
  return {
    systemGroups: [] as Array<{ groupName: string; models: ModelConfig[]; isMultiChannel?: boolean }>,
    customModels: getMergedImageModels(settings),
  }
}

export function pickMergedImageModel(settings: AppSettings, preferredId?: string) {
  const models = getMergedImageModels(settings)
  const resolvedId = preferredId?.trim() || resolveSoftwareImageModelId(settings, models)
  return pickImageModel(models, resolvedId || undefined)
}

export function getMergedVideoModels(settings: AppSettings): ModelConfig[] {
  return settings.videoModels || []
}

export function pickMergedVideoModel(settings: AppSettings, preferredId?: string) {
  const models = getMergedVideoModels(settings)
  const resolvedId = preferredId?.trim() || resolveSoftwareVideoModelId(settings, models)
  return pickVideoModel(models, resolvedId || undefined)
}

export function pickMergedLlmModel(settings: AppSettings, preferredId?: string) {
  const models = getMergedLlmModels(settings)
  const resolvedId = preferredId?.trim() || resolveSoftwareLlmModelId(settings, models)
  return pickLlmModel(models, resolvedId || undefined)
}
