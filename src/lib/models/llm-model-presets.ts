import type { ModelConfig } from '@/types/settings'
import { generateUUID } from '@/lib/utils'

export type LlmPresetKey = 'openai' | 'gemini' | 'claude' | 'openai_compatible'

export interface LlmPresetDefinition {
  key: LlmPresetKey
  label: string
  hint: string
  description: string
  apiFormat: string
  platform: string
  endpoint: string
  model: string
  autoAppendV1: boolean
  defaultName: string
}

/** 对齐 haode-ai-client Settings LLM 四项预设（无「完全自定义」） */
export const LLM_MODEL_PRESETS: Record<LlmPresetKey, LlmPresetDefinition> = {
  openai: {
    key: 'openai',
    label: 'OpenAI 官方',
    hint: 'gpt-4o, gpt-4...',
    description: 'https://api.openai.com/v1/chat/completions',
    apiFormat: 'openai',
    platform: 'openai_compatible',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o',
    autoAppendV1: false,
    defaultName: 'OpenAI 官方',
  },
  gemini: {
    key: 'gemini',
    label: 'Google Gemini',
    hint: 'gemini-2.5-pro...',
    description: 'Gemini API /v1beta generateContent',
    apiFormat: 'gemini',
    platform: 'google_gemini',
    endpoint:
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
    model: 'gemini-2.5-pro',
    autoAppendV1: false,
    defaultName: 'Google Gemini',
  },
  claude: {
    key: 'claude',
    label: 'Anthropic Claude',
    hint: 'claude-sonnet-4...',
    description: 'https://api.anthropic.com/v1/messages',
    apiFormat: 'claude',
    platform: 'anthropic',
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-sonnet-4-20250514',
    autoAppendV1: false,
    defaultName: 'Anthropic Claude',
  },
  openai_compatible: {
    key: 'openai_compatible',
    label: 'OpenAI 兼容',
    hint: '自定义 endpoint',
    description: 'OpenAI Chat /v1/chat/completions',
    apiFormat: 'openai',
    platform: 'openai_compatible',
    endpoint: '',
    model: '',
    autoAppendV1: true,
    defaultName: 'OpenAI兼容',
  },
}

export const LLM_PRESET_LIST = Object.values(LLM_MODEL_PRESETS)

export function resolveLlmPresetKey(model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'endpoint'> | null): LlmPresetKey {
  const apiFormat = String(model?.apiFormat || '').trim().toLowerCase()
  if (apiFormat === 'gemini') return 'gemini'
  if (apiFormat === 'claude') return 'claude'
  const endpoint = String(model?.endpoint || '').trim()
  if (
    apiFormat === 'openai' &&
    (model?.platform === 'openai_compatible' || !endpoint) &&
    !endpoint.includes('api.openai.com')
  ) {
    return 'openai_compatible'
  }
  return 'openai'
}

export function getLlmPresetLabel(model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'endpoint' | 'name'> | null): string {
  if (!model) return 'OpenAI 官方'
  return LLM_MODEL_PRESETS[resolveLlmPresetKey(model)]?.label ?? model.name ?? 'OpenAI 官方'
}

export function buildLlmPresetPatch(
  key: LlmPresetKey,
  options?: { keepName?: boolean; name?: string },
): Partial<ModelConfig> {
  const preset = LLM_MODEL_PRESETS[key]
  return {
    apiFormat: preset.apiFormat,
    platform: preset.platform,
    endpoint: preset.endpoint,
    model: preset.model,
    autoAppendV1: preset.autoAppendV1,
    name: options?.keepName ? options.name : options?.name || preset.defaultName,
  }
}

export function createLlmPresetModel(key: LlmPresetKey, options?: { name?: string }): ModelConfig {
  const preset = LLM_MODEL_PRESETS[key]
  return {
    id: generateUUID(),
    name: options?.name || preset.defaultName,
    apiFormat: preset.apiFormat,
    platform: preset.platform,
    endpoint: preset.endpoint,
    apiKey: '',
    model: preset.model,
    autoAppendV1: preset.autoAppendV1,
  }
}
