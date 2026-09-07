// Copyright (c) Haode AI. All rights reserved.

import type { AppSettings } from '@/types/settings'
import { getMergedLlmModels } from '@/lib/models/merged-model-picker'
import { resolveSoftwareLlmModelId } from '@/lib/models/software-model-prefs'
import { isSystemModel } from '@/lib/models/model-merge'

function hasCustomLlmCredentials(model: { apiKey?: string; endpoint?: string; model?: string }) {
  return Boolean(model.apiKey?.trim() && model.endpoint?.trim() && model.model?.trim())
}

/** 画布文本：软件级 LLM（settings.lastUsed*LlmModelId） */
export function resolveCanvasExtractLlmModelId(settings: AppSettings): string | undefined {
  const models = getMergedLlmModels(settings)
  if (!models.length) return undefined

  const fromSoftware = resolveSoftwareLlmModelId(settings, models)
  if (fromSoftware) return fromSoftware

  const defaultId = settings.defaultLlmModelId?.trim()
  if (defaultId && models.some((model) => model.id === defaultId)) {
    return defaultId
  }

  const custom = models.find((model) => !isSystemModel(model) && hasCustomLlmCredentials(model))
  if (custom) return custom.id

  return models[0]?.id
}

export function getCanvasExtractLlmErrorHint(message: string): string | null {
  if (!/系统模型.*Endpoint|Endpoint.*系统模型/i.test(message)) return null
  return '当前使用的是平台系统 LLM，但后台未配置上游 Endpoint。请在「系统设置 → LLM 模型」中设置默认自定义模型（填写 API Key 与 Endpoint），或联系管理员在后台补全系统模型配置。'
}
