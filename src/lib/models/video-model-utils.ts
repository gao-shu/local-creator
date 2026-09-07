import type { ModelConfig } from '@/types/settings'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { normalizeApiBase, resolveOpenAiPath } from '@/lib/models/model-endpoint'

const WEISHI_VIDEOS_SUFFIX = '/v1/videos'

export const WEISHI_VIDEO_MODELS = ['seedance-2.0', 'seedance-2.0-fast'] as const

export function isFullVideoResourceEndpoint(endpoint?: string): boolean {
  const base = normalizeApiBase(endpoint)
  if (!base) return false
  try {
    const pathname = new URL(base).pathname
    return /\/(video|videos)(\/|$)/i.test(pathname) || /\/generations(\/|$)/i.test(pathname)
  } catch {
    return false
  }
}

function shouldAutoBuildVideoEndpoint(model: Pick<ModelConfig, 'apiFormat'>): boolean {
  if (isWeishiApiModel(model)) return false
  const apiFormat = String(model.apiFormat || '').trim().toLowerCase()
  return (
    apiFormat !== 'zhipu' &&
    apiFormat !== 'seedance_2' &&
    apiFormat !== 'agnes_video_25' &&
    apiFormat !== 'agnes_video_25_flash'
  )
}

export function resolveVideoApiSubPath(model: Pick<ModelConfig, 'apiFormat'>): string {
  const path = resolveVideoApiPath(model)
  return path.startsWith('/v1') ? path.slice(3) : path
}

/** 解析视频创建接口完整 URL（含 openai 兼容中转站的 /v1 拼接） */
export function resolveVideoCreateUrl(
  model: Pick<
    ModelConfig,
    'endpoint' | 'baseUrl' | 'apiFormat' | 'autoAppendV1' | 'configMode'
  >,
): string {
  if (isWeishiApiModel(model)) {
    if (model.configMode === 'simple' && model.baseUrl?.trim()) {
      return buildVideoEndpointFromBaseUrl(model.baseUrl, model)
    }
    return normalizeApiBase(model.endpoint)
  }

  const endpoint = normalizeApiBase(model.endpoint)
  const migratedEndpoint = migrateOpenAiCompatibleVideoCreateUrl(endpoint, model)
  if (isFullVideoResourceEndpoint(migratedEndpoint)) return migratedEndpoint

  const apiFormat = String(model.apiFormat || '').trim().toLowerCase()
  if (apiFormat === 'zhipu' || apiFormat === 'seedance_2') {
    return migratedEndpoint || normalizeApiBase(model.baseUrl)
  }

  const root = migratedEndpoint || normalizeApiBase(model.baseUrl)
  if (!root) return ''

  const autoAppendV1 = model.autoAppendV1 !== false
  return resolveOpenAiPath(root, resolveVideoApiSubPath(model), autoAppendV1)
}

export function normalizeVideoModelConfig(model: ModelConfig): ModelConfig {
  const isWeishi = isWeishiApiModel(model)
  const ratios = Array.isArray(model.ratios)
    ? [...new Set(model.ratios.map((item) => String(item).trim()).filter(Boolean))]
    : []
  const durations = Array.isArray(model.durations)
    ? [
        ...new Set(
          model.durations.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0),
        ),
      ].sort((a, b) => a - b)
    : []
  const resolutions = Array.isArray(model.resolutions)
    ? [...new Set(model.resolutions.map((item) => String(item).trim()).filter(Boolean))]
    : []
  const referenceModes = Array.isArray(model.referenceModes)
    ? [...new Set(model.referenceModes.map((item) => String(item).trim()).filter(Boolean))]
    : model.referenceModes
  // 旧同步口 openai_generations → 异步 OpenAI Videos
  const rawFormat = String(model.apiFormat || '').trim().toLowerCase()
  const apiFormat = rawFormat === 'openai_generations' ? 'openai_videos' : model.apiFormat
  const normalized: ModelConfig = {
    ...model,
    apiFormat,
    ratios,
    durations,
    resolutions,
    referenceModes,
    defaultRatio: model.defaultRatio,
    defaultDurationSec: model.defaultDurationSec,
    defaultReferenceMode: model.defaultReferenceMode,
    configMode:
      model.configMode || (isWeishi && model.baseUrl?.trim() ? 'simple' : 'advanced'),
    uploadByUrl: isWeishi ? model.uploadByUrl !== false : model.uploadByUrl,
  }

  if (!shouldAutoBuildVideoEndpoint(normalized)) return normalized

  const rawEndpoint = migrateOpenAiCompatibleVideoCreateUrl(
    normalizeApiBase(normalized.endpoint),
    normalized,
  )
  if (isFullVideoResourceEndpoint(rawEndpoint)) {
    return {
      ...normalized,
      endpoint: rawEndpoint,
      baseUrl: normalized.baseUrl || extractBaseUrlFromEndpoint(rawEndpoint, normalized),
    }
  }

  const root = rawEndpoint || normalizeApiBase(normalized.baseUrl)
  if (!root) return normalized

  const endpoint = resolveVideoCreateUrl({ ...normalized, endpoint: root, baseUrl: root })
  return {
    ...normalized,
    endpoint,
    baseUrl: extractBaseUrlFromEndpoint(endpoint, normalized),
  }
}

export function supportsSimpleVideoEndpoint(model: Pick<ModelConfig, 'apiFormat'>): boolean {
  return isWeishiApiModel(model)
}

export function resolveWeishiVideosPath(): string {
  return WEISHI_VIDEOS_SUFFIX
}

export function resolveVideoApiPath(model: Pick<ModelConfig, 'apiFormat'>): string {
  const apiFormat = String(model.apiFormat || '').trim().toLowerCase()
  if (isWeishiApiModel(model)) return WEISHI_VIDEOS_SUFFIX
  // xAI Grok：仍为 POST /v1/videos/generations + GET /v1/videos/{id}（异步创建，非同步阻塞）
  if (apiFormat === 'grok') return '/v1/videos/generations'
  if (apiFormat === 'seedance_2') return ''
  // OpenAI Videos / 兼容中转：异步 POST /v1/videos
  return '/v1/videos'
}

function isOpenAiCompatibleVideoFormat(apiFormat: string): boolean {
  return (
    !apiFormat ||
    apiFormat === 'openai' ||
    apiFormat === 'openai_videos' ||
    apiFormat === 'openai_generations' ||
    apiFormat === 'openai_compatible'
  )
}

/** 把历史同步口 …/videos/generations、…/video/generations 纠成异步 …/videos */
export function migrateOpenAiCompatibleVideoCreateUrl(
  endpoint: string,
  model: Pick<ModelConfig, 'apiFormat'>,
): string {
  const apiFormat = String(model.apiFormat || '').trim().toLowerCase()
  if (apiFormat === 'grok' || apiFormat === 'zhipu') return endpoint
  if (!isOpenAiCompatibleVideoFormat(apiFormat)) return endpoint
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '')
  if (/\/videos\/generations$/i.test(trimmed)) {
    return trimmed.replace(/\/generations$/i, '')
  }
  if (/\/video\/generations$/i.test(trimmed)) {
    return trimmed.replace(/\/video\/generations$/i, '/videos')
  }
  return trimmed
}

export function buildVideoEndpointFromBaseUrl(
  baseUrl: string,
  model: Pick<ModelConfig, 'apiFormat'>,
): string {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return `${trimmed}${resolveVideoApiPath(model)}`
}

export function extractBaseUrlFromEndpoint(
  endpoint: string,
  model: Pick<ModelConfig, 'apiFormat'>,
): string {
  const trimmed = String(endpoint || '').trim().replace(/\/+$/, '')
  const suffix = resolveVideoApiPath(model)
  if (trimmed.endsWith(suffix)) return trimmed.slice(0, -suffix.length)
  return trimmed
}

export function appendStringTag(list: string[] | undefined, raw: string): string[] {
  const value = String(raw || '').trim()
  if (!value) return list ? [...list] : []
  const next = list ? [...list] : []
  if (!next.includes(value)) next.push(value)
  return next
}

export function appendDurationTag(list: number[] | undefined, raw: string): number[] {
  const num = Number(String(raw || '').trim())
  if (!Number.isFinite(num) || num <= 0) return list ? [...list] : []
  const rounded = Math.round(num)
  const next = list ? [...list] : []
  if (!next.includes(rounded)) {
    next.push(rounded)
    next.sort((a, b) => a - b)
  }
  return next
}

export function removeTagAt<T>(list: T[] | undefined, index: number): T[] {
  if (!list?.length) return []
  return list.filter((_, i) => i !== index)
}

export function pickFirstRatio(model?: ModelConfig | null): string {
  return model?.ratios?.[0]?.trim() || '16:9'
}

export function pickFirstDuration(model?: ModelConfig | null): number {
  return Number(model?.durations?.[0]) || 15
}

export function pickFirstResolution(model?: ModelConfig | null): string {
  return model?.resolutions?.[0]?.trim() || '720P'
}
