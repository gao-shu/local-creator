// Copyright (c) Haode AI. All rights reserved.

import type { AppSettings, ModelConfig } from '@/types/settings'
import { pickImageModel } from '@/lib/models/image-client'
import { pickLlmModel } from '@/lib/models/llm-client'
import { pickVideoModel } from '@/lib/video/video-client'
import { mergeModelsForKind, mergeImageModelsGrouped } from '@/lib/models/system-models-service'
import { overlayWeishiCapabilitiesOnMergedVideoModels } from '@/lib/models/weishi-capability-overlay'
import {
  resolveSoftwareImageModelId,
  resolveSoftwareLlmModelId,
  resolveSoftwareVideoModelId,
} from '@/lib/models/software-model-prefs'
import { useSettingsStore } from '@/stores/settings-store'

export function getMergedLlmModels(settings: AppSettings): ModelConfig[] {
  const systemByKind = useSettingsStore.getState().systemModelsByKind
  return mergeModelsForKind('llm', settings.llmModels, systemByKind)
}

export function getMergedImageModels(settings: AppSettings): ModelConfig[] {
  const systemByKind = useSettingsStore.getState().systemModelsByKind
  return mergeModelsForKind('image', settings.imageModels, systemByKind)
}

export function getMergedImageModelGroups(settings: AppSettings) {
  const systemByKind = useSettingsStore.getState().systemModelsByKind
  return mergeImageModelsGrouped(settings.imageModels, systemByKind)
}

export function pickMergedImageModel(settings: AppSettings, preferredId?: string) {
  const models = getMergedImageModels(settings)
  const resolvedId = preferredId?.trim() || resolveSoftwareImageModelId(settings, models)
  return pickImageModel(models, resolvedId || undefined)
}

export function getMergedVideoModels(settings: AppSettings): ModelConfig[] {
  const systemByKind = useSettingsStore.getState().systemModelsByKind
  const merged = mergeModelsForKind('video', settings.videoModels, systemByKind)
  // 完整 video catalog（含内部微视）覆盖自定义微视清晰度，避免本地 480P 假档
  return overlayWeishiCapabilitiesOnMergedVideoModels(merged, systemByKind.video || [])
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
