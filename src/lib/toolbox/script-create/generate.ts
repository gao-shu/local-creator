// Copyright (c) Haode AI. All rights reserved.

import type { AppSettings } from '@/types/settings'
import { formatUserFacingBillingError } from '@/lib/utils'
import { callChatCompletions } from '@/lib/models/llm-client'
import { getMergedLlmModels, pickMergedLlmModel } from '@/lib/models/merged-model-picker'
import { buildScriptCreatePrompt } from '@/lib/toolbox/script-create/prompt'
import type { ScriptCreateParams } from '@/lib/toolbox/script-create/types'
import { clampScriptText } from '@/lib/toolbox/script-create/serialize'

export function hasScriptCreateLlmModel(settings: AppSettings | null | undefined): boolean {
  if (!settings) return false
  return getMergedLlmModels(settings).length > 0
}

export async function generateScriptFromIdea(input: {
  idea: string
  params: ScriptCreateParams
  settings: AppSettings
  signal?: AbortSignal
}): Promise<string> {
  const idea = input.idea.trim()
  if (!idea) {
    throw new Error('先写一句故事想法')
  }
  if (!hasScriptCreateLlmModel(input.settings)) {
    throw new Error('请先在系统设置中配置 LLM 模型')
  }

  const model = pickMergedLlmModel(input.settings)
  const prompt = buildScriptCreatePrompt(idea, input.params)
  const raw = await callChatCompletions(model, prompt, {
    signal: input.signal,
    temperature: 0.8,
    billingReason: 'consume_script',
  })

  const text = raw.trim()
  if (!text) {
    throw new Error('模型没有返回内容，请重试或换模型')
  }

  const { text: clamped, truncated } = clampScriptText(text)
  if (truncated) {
    // caller may toast; still return usable text
  }
  return clamped
}

export function resolveScriptCreateErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return '已取消'
  }
  if (error instanceof Error && /aborted|abort|取消/i.test(error.message)) {
    return '已取消'
  }
  return formatUserFacingBillingError(error, '生成失败，请稍后重试')
}
