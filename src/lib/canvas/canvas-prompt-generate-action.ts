// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'
import { formatUserFacingBillingError } from '@/lib/utils'
import { getCanvasExtractLlmErrorHint, resolveCanvasExtractLlmModelId } from '@/lib/canvas/canvas-extract-llm'
import { callChatCompletions } from '@/lib/models/llm-client'
import { pickMergedLlmModel } from '@/lib/models/merged-model-picker'

export interface RunCanvasPromptGenerateInput {
  instruction: string
  existingPrompt?: string
  settings: AppSettings
  canvasProjectId?: string
}

function buildCanvasPromptGeneratePrompt(instruction: string, existingPrompt?: string): string {
  const body = existingPrompt?.trim()
  if (body) {
    return [
      '你是一名 AI 漫剧编剧助手。',
      '根据「创作要求」在「已有文本」基础上续写或改写，输出可直接用于分镜的正文。',
      '只输出正文，不要标题、不要解释、不要用 markdown 代码块。',
      '',
      '【已有文本】',
      body,
      '',
      '【创作要求】',
      instruction,
    ].join('\n')
  }

  return [
    '你是一名 AI 漫剧编剧助手。',
    '根据以下描述创作小说或剧本片段，适合后续做 AI 漫剧分镜。',
    '只输出正文，不要标题、不要解释、不要用 markdown 代码块。',
    '',
    '【创作要求】',
    instruction,
  ].join('\n')
}

/** 根据控制台描述生成/续写上方文本正文 */
export async function runCanvasPromptTextGenerate(
  input: RunCanvasPromptGenerateInput,
): Promise<string> {
  const instruction = input.instruction.trim()
  if (!instruction) {
    throw new Error('请先输入创作描述')
  }

  const resolvedModelId = resolveCanvasExtractLlmModelId(input.settings)
  if (!resolvedModelId) {
    throw new Error('请先在系统设置中配置 LLM 模型')
  }

  const model = pickMergedLlmModel(input.settings, resolvedModelId)
  const prompt = buildCanvasPromptGeneratePrompt(instruction, input.existingPrompt)

  const raw = await callChatCompletions(model, prompt)

  const generated = raw.trim()
  if (!generated) {
    throw new Error('模型未返回可用文本')
  }
  return generated
}

export function resolveCanvasPromptGenerateErrorMessage(error: unknown): string {
  const fallback = '生成失败'
  const message = formatUserFacingBillingError(error, fallback)
  return getCanvasExtractLlmErrorHint(message) || message
}

export function mergeCanvasPromptText(
  existingPrompt: string | undefined,
  generated: string,
  maxLength: number,
): string {
  const existing = existingPrompt?.trim()
  const next = existing ? `${existing}\n\n${generated.trim()}` : generated.trim()
  return next.slice(0, maxLength)
}
