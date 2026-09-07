/**
 * 计费 HTTP 矩阵联调：模型 fixture（与 smoke-system-model-billing 对齐）
 */
import { mapSystemModelDto } from '@/lib/models/system-models-service'
import type { ModelConfig } from '@/types/settings'

export const ORG_PROJECT_ID = '00000000-0000-4000-8000-probe00000001'

const internalSeedanceDto = {
  model_key: 'sys_internal_seedance_20',
  name: '内部·Seedance 2.0',
  kind: 'video' as const,
  source: 'system' as const,
  api_format: 'weishi_api',
  platform: 'openai_compatible',
  upstream_model: 'seedance-2.0',
  haodou_cost: 0,
  billing_mode: 'internal' as const,
  unit_price: '1.2',
  unit_label: '元/秒',
  config_json: {
    unit_price: '1.2',
    ratios: ['16:9'],
    durations: [5, 10],
    resolutions: ['720P'],
  },
  proxy_available: false,
  consumption: {
    billing_enabled: true,
    price: '1.2',
    unit: 'second' as const,
    unit_label: '元/秒',
  },
}

const internalSeedanceFastDto = {
  ...internalSeedanceDto,
  model_key: 'sys_internal_seedance_20_fast',
  name: '内部·Seedance 2.0 Fast',
  upstream_model: 'seedance-2.0-fast',
  unit_price: '0.0',
  consumption: null,
}

const externalLlmDto = {
  model_key: 'sys_ext_llm',
  name: '外部·示例 LLM',
  kind: 'llm' as const,
  source: 'system' as const,
  api_format: 'openai_compatible',
  platform: 'openai_compatible',
  upstream_model: 'gpt-4o-mini',
  haodou_cost: 4,
  billing_mode: 'external' as const,
  unit_price: '4',
  unit_label: '豆/次',
  config_json: { unit_price: '4' },
  proxy_available: true,
  consumption: null,
}

const externalImageDto = {
  model_key: 'sys_ext_image',
  name: '外部·示例生图',
  kind: 'image' as const,
  source: 'system' as const,
  api_format: 'openai_compatible',
  platform: 'openai_compatible',
  upstream_model: 'dall-e-3',
  haodou_cost: 4,
  billing_mode: 'external' as const,
  unit_price: '4',
  unit_label: '豆/张',
  config_json: { unit_price: '4' },
  proxy_available: true,
  consumption: null,
}

export const internalSeedance = mapSystemModelDto(internalSeedanceDto)
export const internalSeedanceFast = mapSystemModelDto(internalSeedanceFastDto)
export const externalLlm = mapSystemModelDto(externalLlmDto)
export const externalImage = mapSystemModelDto(externalImageDto)

export const videoCatalog = [internalSeedance, internalSeedanceFast]

export function customWeishiVideo(upstream: string, id = 'custom-weishi'): ModelConfig {
  return {
    id,
    name: '微视API',
    source: 'custom',
    apiFormat: 'weishi_api',
    model: upstream,
  }
}

export function customOpenAiLlm(): ModelConfig {
  return {
    id: 'custom-openai',
    name: '我的 GPT',
    source: 'custom',
    apiFormat: 'openai_compatible',
    apiKey: 'sk-probe-test',
    model: 'gpt-4o-mini',
    endpoint: 'https://example.com/v1/chat/completions',
  }
}

/** 断言互斥：好豆 vs 项目统计 */
export const HAODOU_VS_PROJECT_EXCLUSIVE = [
  '/client/haodou/consume',
  '/client/projects/video-consumption',
  '/client/projects/consumption',
]
