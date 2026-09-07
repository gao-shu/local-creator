// Copyright (c) Haode AI. All rights reserved.

import type { AppSettings, ModelConfig } from '@/types/settings'
import { resolveInitialModelId } from '@/lib/models/default-model-utils'
import { resolvePreferredLlmModelId } from '@/lib/models/llm-client'

/** 软件级图片模型：settings.lastUsed*ImageModelId */
export function resolveSoftwareImageModelId(
  settings: AppSettings | null | undefined,
  models: ModelConfig[],
): string {
  const lastUsed =
    settings?.lastUsedAssetImageModelId?.trim() ||
    settings?.lastUsedStoryboardImageModelId?.trim()
  return resolveInitialModelId(models, { defaultId: lastUsed })
}

/** 软件级文本 LLM：优先 defaultLlmModelId（统一默认 Agnes），再回退 lastUsed* */
export function resolveSoftwareLlmModelId(
  settings: AppSettings | null | undefined,
  models: ModelConfig[],
): string {
  const preferred =
    settings?.defaultLlmModelId?.trim() ||
    settings?.lastUsedLlmModelId?.trim() ||
    settings?.lastUsedStoryboardLlmModelId?.trim() ||
    settings?.lastUsedEpisodeLlmModelId?.trim()
  return resolvePreferredLlmModelId(models, preferred) || models[0]?.id || ''
}

/** 软件级视频模型：settings.lastUsedStoryboardVideoModelId */
export function resolveSoftwareVideoModelId(
  settings: AppSettings | null | undefined,
  models: ModelConfig[],
): string {
  return resolveInitialModelId(models, {
    defaultId: settings?.lastUsedStoryboardVideoModelId?.trim(),
  })
}
