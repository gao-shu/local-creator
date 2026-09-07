import type { ModelConfig } from '@/types/settings'
import { generateUUID } from '@/lib/utils'

export type ImagePresetKey = 'openai' | 'gemini' | 'openai_compatible' | 'grok'

export interface ImagePresetDefinition {
  key: ImagePresetKey
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

/** 对齐 Settings 图片预设 */
export const IMAGE_MODEL_PRESETS: Record<ImagePresetKey, ImagePresetDefinition> = {
  openai: {
    key: 'openai',
    label: 'OpenAI 官方',
    hint: 'gpt-image-1, dall-e-3...',
    description: 'https://api.openai.com/v1/images/generations',
    apiFormat: 'openai',
    platform: 'openai_compatible',
    endpoint: 'https://api.openai.com/v1/images/generations',
    model: 'dall-e-3',
    autoAppendV1: false,
    defaultName: 'OpenAI 官方',
  },
  gemini: {
    key: 'gemini',
    label: 'Google Gemini',
    hint: 'imagen-3.0...',
    description: 'Gemini 图片生成 /v1beta generateContent',
    apiFormat: 'gemini',
    platform: 'google_gemini',
    endpoint:
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent',
    model: 'gemini-2.0-flash-exp-image-generation',
    autoAppendV1: false,
    defaultName: 'Google Gemini',
  },
  openai_compatible: {
    key: 'openai_compatible',
    label: 'OpenAI 兼容（中转站）',
    hint: '填写根域名',
    description: '填写根域名，文生图 /v1/images/generations，参考图 multipart /v1/images/edits',
    apiFormat: 'openai',
    platform: 'openai_compatible',
    endpoint: '',
    model: '',
    autoAppendV1: true,
    defaultName: 'OpenAI兼容',
  },
  grok: {
    key: 'grok',
    label: 'Grok Imagine（xAI）',
    hint: 'xAI / 中转 · grok-imagine-image',
    description:
      '填写根域名，文生图 /v1/images/generations，参考图 JSON /v1/images/edits（官方 https://api.x.ai）',
    apiFormat: 'grok',
    platform: 'openai_compatible',
    endpoint: '',
    model: 'grok-imagine-image',
    autoAppendV1: true,
    defaultName: 'Grok Imagine',
  },
}

export const IMAGE_PRESET_LIST = Object.values(IMAGE_MODEL_PRESETS)

/** 是否按 xAI Grok Imagine Image 协议（JSON image.url，非 multipart） */
export function isGrokImageModel(
  model?: Pick<ModelConfig, 'apiFormat' | 'model' | 'name' | 'endpoint' | 'baseUrl'> | null,
): boolean {
  if (!model) return false
  const fmt = String(model.apiFormat || '')
    .trim()
    .toLowerCase()
  if (fmt === 'grok') return true

  const id = `${model.model || ''} ${model.name || ''}`.toLowerCase()
  if (id.includes('grok-imagine-image')) return true
  // 避免把 grok-imagine-video 误判为图片
  if (id.includes('grok') && id.includes('image') && !id.includes('video')) return true

  const ep = `${model.endpoint || ''} ${model.baseUrl || ''}`.toLowerCase()
  if (ep.includes('api.x.ai') && /\/images(\/|$)/.test(ep)) return true
  return false
}

export function resolveImagePresetKey(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'endpoint' | 'model' | 'name' | 'baseUrl'> | null,
): ImagePresetKey {
  const apiFormat = String(model?.apiFormat || '').trim().toLowerCase()
  if (apiFormat === 'gemini') return 'gemini'
  if (apiFormat === 'grok' || isGrokImageModel(model)) return 'grok'
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

export function getImagePresetLabel(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'endpoint' | 'name' | 'model' | 'baseUrl'> | null,
): string {
  if (!model) return 'OpenAI 官方'
  const apiFormat = String(model.apiFormat || '').trim().toLowerCase()
  if (apiFormat === 'weishi_api') return '微视API'
  return IMAGE_MODEL_PRESETS[resolveImagePresetKey(model)]?.label ?? model.name ?? 'OpenAI 官方'
}

export function buildImagePresetPatch(
  key: ImagePresetKey,
  options?: { keepName?: boolean; name?: string },
): Partial<ModelConfig> {
  const preset = IMAGE_MODEL_PRESETS[key]
  return {
    apiFormat: preset.apiFormat,
    platform: preset.platform,
    endpoint: preset.endpoint,
    model: preset.model,
    autoAppendV1: preset.autoAppendV1,
    name: options?.keepName ? options.name : options?.name || preset.defaultName,
  }
}

export function createImagePresetModel(key: ImagePresetKey, options?: { name?: string }): ModelConfig {
  const preset = IMAGE_MODEL_PRESETS[key]
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
