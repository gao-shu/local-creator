import type { ModelKind } from '@/types/settings'
import { IMAGE_PRESET_LIST } from '@/lib/models/image-model-presets'
import { LLM_PRESET_LIST } from '@/lib/models/llm-model-presets'
import { VIDEO_PRESET_PICKER_LIST } from '@/lib/models/video-model-presets'

export interface ModelPlatformOption {
  value: string
  label: string
  description: string
}

export const MODEL_PLATFORM_OPTIONS: ModelPlatformOption[] = [
  {
    value: 'openai_compatible',
    label: 'OpenAI 兼容',
    description: 'OpenAI、DeepSeek、智谱等 OpenAI 格式 API',
  },
  {
    value: 'new_api',
    label: 'New API',
    description: '聚合网关，支持多种模型格式',
  },
  {
    value: 'volcengine',
    label: '火山引擎',
    description: '字节跳动豆包等模型',
  },
  {
    value: 'google_vertex',
    label: 'Google Vertex AI',
    description: 'Google Cloud Vertex AI Gemini',
  },
  {
    value: 'google_gemini',
    label: 'Google Gemini API',
    description: 'Google AI Studio / Gemini Developer API',
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    description: 'Claude 系列模型',
  },
  {
    value: 'ollama',
    label: 'Ollama',
    description: '本地部署的开源模型',
  },
]

export function getPlatformLabel(value?: string) {
  return MODEL_PLATFORM_OPTIONS.find((p) => p.value === value)?.label ?? value ?? 'OpenAI 兼容'
}

export function getPlatformDescription(value?: string) {
  return MODEL_PLATFORM_OPTIONS.find((p) => p.value === value)?.description ?? ''
}

export const MODEL_KIND_LABEL = {
  llm: 'LLM',
  image: '图片',
  video: '视频',
} as const

export const MODEL_ID_PLACEHOLDER = {
  llm: 'deepseek-chat / gpt-4o',
  image: 'grok-imagine-image / dall-e-3 / gpt-image-2',
  video: 'agnes-video-2.5-flash / grok-imagine-video / seedance-2.0',
} as const

export const MODEL_API_FORMAT_OPTIONS: Record<
  ModelKind,
  { value: string; label: string; description: string }[]
> = {
  llm: LLM_PRESET_LIST.map((preset) => ({
    value: preset.key,
    label: preset.label,
    description: preset.description,
  })),
  image: IMAGE_PRESET_LIST.map((preset) => ({
    value: preset.key,
    label: preset.label,
    description: preset.hint || preset.description,
  })),
  video: VIDEO_PRESET_PICKER_LIST.map((preset) => ({
    value: preset.key,
    label: preset.label,
    description: preset.hint || preset.description,
  })),
}
