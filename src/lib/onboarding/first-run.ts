// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings, ModelConfig, ModelKind } from '@/types/settings'
import { normalizeApiBase } from '@/lib/models/model-endpoint'

export type FirstRunStep = 1 | 2 | 3 | 4

/** 模型是否具备可测试的 Endpoint + API Key */
export function isModelConfiguredForUse(model: ModelConfig | null | undefined): boolean {
  if (!model) return false
  const endpoint =
    normalizeApiBase(model.endpoint) ||
    normalizeApiBase(model.baseUrl) ||
    ''
  const key = String(model.apiKey || '').trim()
  return Boolean(endpoint && key)
}

export function listConfigurableModels(settings: AppSettings): Array<{
  kind: ModelKind
  model: ModelConfig
}> {
  const rows: Array<{ kind: ModelKind; model: ModelConfig }> = []
  for (const model of settings.llmModels ?? []) rows.push({ kind: 'llm', model })
  for (const model of settings.imageModels ?? []) rows.push({ kind: 'image', model })
  for (const model of settings.videoModels ?? []) rows.push({ kind: 'video', model })
  return rows
}

/** 至少配置了一个 LLM 或图片模型（向导 Step2 要求） */
export function hasReadyLlmOrImageModel(settings: AppSettings): boolean {
  const llmOk = (settings.llmModels ?? []).some(isModelConfiguredForUse)
  const imageOk = (settings.imageModels ?? []).some(isModelConfiguredForUse)
  return llmOk || imageOk
}

export function shouldShowFirstRunWizard(settings: AppSettings | null | undefined): boolean {
  if (!settings) return false
  return settings.onboardingCompleted !== true
}
