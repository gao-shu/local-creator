// Copyright (c) Haode AI. All rights reserved.

import type {
  ImageAspectRatioItem,
  ImagePricingMode,
  ImageQuality,
  ModelConfig,
  ModelKind,
  ModelConsumptionConfig,
  BillingMode,
  VideoPricingMode,
} from '@/types/settings'
import { resolveApiBase } from '@/lib/auth/api-base'
import { useAuthStore } from '@/stores/auth-store'
import { hasPersistedRealToken, isLoginRequired, isOfflineLocalToken, isRealUserSession } from '@/lib/auth/login-mode'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import { WEISHI_API_PRESET } from '@/lib/models/weishi-model-presets'
import { normalizeBillingMode, SYSTEM_MODEL_ID_PREFIX } from '@/lib/models/system-model-routing'
import { parseUnitPrice } from '@/lib/models/system-model-unit-price'
import {
  buildImageModelPickerGroups,
  mapDtoToImagePricingMeta,
  type ImageModelPickerGroups,
} from '@/lib/models/image-model-pricing'
import { mapDtoToVideoPricingMeta, isTieredVideoPricing } from '@/lib/models/video-model-pricing'

export type ClientSystemModelDto = {
  model_key: string
  name: string
  kind: ModelKind
  source: 'system'
  api_format?: string | null
  platform?: string | null
  endpoint?: string | null
  upstream_model?: string | null
  haodou_cost: number
  billing_mode?: BillingMode | string
  unit_price?: string
  unit_label?: string
  config_json?: Record<string, unknown>
  proxy_available?: boolean
  consumption?: ModelConsumptionConfig | null
  pricing_mode?: ImagePricingMode | VideoPricingMode | string | null
  pricing_summary?: string | null
  price_range?: { min: string; max: string } | null
  default_resolution?: string | null
  default_quality?: ImageQuality | string | null
  resolutions?: string[] | null
  supports_quality_modes?: boolean
  aspect_ratios?: ImageAspectRatioItem[] | null
  group_name?: string | null
  description?: string | null
  /** video 能力（B4 下发；亦可落在 config_json） */
  ratios?: string[] | null
  default_ratio?: string | null
  durations?: number[] | null
  default_duration_sec?: number | null
  reference_modes?: string[] | null
  default_reference_mode?: string | null
}

export function systemModelId(modelKey: string): string {
  return `${SYSTEM_MODEL_ID_PREFIX}${modelKey}`
}

import {
  isInternalSystemModel,
  isSystemModel,
  shouldUseSystemModelProxy,
} from '@/lib/models/system-model-routing'

export { isInternalSystemModel, isSystemModel, shouldUseSystemModelProxy }

export function mapSystemModelDto(dto: ClientSystemModelDto): ModelConfig & { catalogKind: ModelKind } {
  const config = dto.config_json || {}
  const billingMode = normalizeBillingMode(dto.billing_mode)
  const consumption =
    dto.consumption && typeof dto.consumption === 'object'
      ? {
          billing_enabled: Boolean(dto.consumption.billing_enabled),
          price: String(dto.consumption.price ?? '0.00'),
          unit: dto.consumption.unit,
          unit_label: String(dto.consumption.unit_label ?? ''),
        }
      : undefined

  const isWeishi = String(dto.api_format || '').trim().toLowerCase() === 'weishi_api'
  const weishiBaseUrl = isWeishi ? WEISHI_API_PRESET.baseUrl : undefined
  const weishiEndpoint = isWeishi ? WEISHI_API_PRESET.endpoint : undefined
  const unitPrice = parseUnitPrice(
    dto.unit_price ?? (config.unit_price as string | number | undefined) ?? dto.haodou_cost,
  )
  const imagePricing = dto.kind === 'image' ? mapDtoToImagePricingMeta(dto) : undefined
  const videoPricingRaw = dto.kind === 'video' ? mapDtoToVideoPricingMeta(dto) : undefined
  const configResolutions = Array.isArray(config.resolutions) ? (config.resolutions as string[]) : undefined
  const dtoResolutions = dto.resolutions?.length ? [...dto.resolutions] : undefined
  const resolutions =
    dto.kind === 'image' && dtoResolutions
      ? dtoResolutions
      : dto.kind === 'video' && dtoResolutions
        ? dtoResolutions
        : configResolutions ?? (isWeishi ? [...(WEISHI_API_PRESET.resolutions ?? [])] : undefined)
  /** 分档计价未下发 resolutions 时，与合并后的 model.resolutions 对齐（有什么展示什么） */
  const videoPricing =
    videoPricingRaw &&
    isTieredVideoPricing(videoPricingRaw.pricingMode) &&
    !(videoPricingRaw.resolutions?.length) &&
    resolutions?.length
      ? { ...videoPricingRaw, resolutions: [...resolutions] }
      : videoPricingRaw
  const imageDescription = imagePricing?.description?.trim()

  const ratiosFromDto = Array.isArray(dto.ratios) ? dto.ratios.map(String) : undefined
  const ratiosFromConfig = Array.isArray(config.ratios) ? (config.ratios as string[]) : undefined
  const ratios =
    ratiosFromDto?.length
      ? ratiosFromDto
      : ratiosFromConfig?.length
        ? ratiosFromConfig
        : isWeishi
          ? [...(WEISHI_API_PRESET.ratios ?? [])]
          : undefined

  const durationsFromDto = Array.isArray(dto.durations)
    ? dto.durations.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : undefined
  const durationsFromConfig = Array.isArray(config.durations)
    ? (config.durations as number[])
    : undefined
  const durations =
    durationsFromDto?.length
      ? durationsFromDto
      : durationsFromConfig?.length
        ? durationsFromConfig
        : isWeishi
          ? [...(WEISHI_API_PRESET.durations ?? [])]
          : undefined

  const referenceModesRaw = Array.isArray(dto.reference_modes)
    ? dto.reference_modes
    : Array.isArray(config.reference_modes)
      ? (config.reference_modes as unknown[])
      : undefined
  const referenceModes = referenceModesRaw?.length
    ? referenceModesRaw.map((item) => String(item).trim()).filter(Boolean)
    : undefined

  const defaultRatio =
    String(dto.default_ratio ?? config.default_ratio ?? '').trim() || undefined
  const defaultDurationSecRaw = dto.default_duration_sec ?? config.default_duration_sec
  const defaultDurationSec =
    defaultDurationSecRaw !== undefined && defaultDurationSecRaw !== null && defaultDurationSecRaw !== ''
      ? Number(defaultDurationSecRaw)
      : undefined
  const defaultReferenceMode =
    String(dto.default_reference_mode ?? config.default_reference_mode ?? '').trim() || undefined

  return {
    id: systemModelId(dto.model_key),
    name: dto.name,
    source: 'system',
    modelKey: dto.model_key,
    billingMode,
    proxyAvailable: Boolean(dto.proxy_available),
    isBackendModel: true,
    apiFormat: dto.api_format || undefined,
    platform: dto.platform || undefined,
    endpoint: dto.endpoint || weishiEndpoint || undefined,
    baseUrl: weishiBaseUrl,
    model: dto.upstream_model || (config.upstream_model as string | undefined) || (isWeishi ? WEISHI_API_PRESET.model : undefined),
    ratios,
    defaultRatio,
    durations,
    defaultDurationSec:
      defaultDurationSec !== undefined && Number.isFinite(defaultDurationSec)
        ? defaultDurationSec
        : undefined,
    referenceModes,
    defaultReferenceMode,
    resolutions,
    configMode: isWeishi ? 'simple' : undefined,
    uploadByUrl: isWeishi ? config.upload_by_url !== false : undefined,
    weishiAssetWhitelistEnabled: isWeishi
      ? config.weishi_asset_whitelist_enabled !== false
      : undefined,
    remark:
      billingMode === 'internal'
        ? '内部 API · 配额'
        : dto.kind === 'image' && imageDescription
          ? imageDescription
          : '平台系统模型',
    unitPrice: unitPrice > 0 ? unitPrice : undefined,
    unitLabel: dto.unit_label?.trim() || undefined,
    haodouCost: billingMode === 'internal' ? undefined : dto.haodou_cost > 0 ? dto.haodou_cost : undefined,
    consumption,
    imagePricing,
    videoPricing,
    catalogKind: dto.kind,
  }
}

export type SystemModelsByKind = Record<ModelKind, ModelConfig[]>

export function groupSystemModels(models: ModelConfig[]): SystemModelsByKind {
  const empty: SystemModelsByKind = { llm: [], image: [], video: [] }
  for (const model of models) {
    const kind = (model as ModelConfig & { catalogKind?: ModelKind }).catalogKind
    if (kind && empty[kind]) {
      empty[kind].push(model)
    }
  }
  return empty
}

/** 业务下拉用：视频类系统模型仅保留外部 API（好豆/代理），内部配额模型单独走组织 Key 链路 */
export function filterSystemModelsForSelect(
  kind: ModelKind,
  systemModels: ModelConfig[],
): ModelConfig[] {
  if (kind !== 'video') return systemModels
  return systemModels.filter((model) => !isInternalSystemModel(model))
}

export async function fetchClientSystemModelsByKind(apiBase?: string): Promise<SystemModelsByKind> {
  const list = await fetchClientSystemModels(apiBase)
  return groupSystemModels(list)
}

export async function fetchClientSystemModels(apiBase?: string): Promise<ModelConfig[]> {
  const token = useAuthStore.getState().token
  if (!token || isOfflineLocalToken(token)) return []

  // 本地模式（未强制登录）下：仅有真实 Session 时才拉系统模型（单价展示等）
  if (!isLoginRequired()) {
    if (!hasPersistedRealToken(token)) return []
  } else if (!isRealUserSession(token)) {
    return []
  }

  const base = resolveApiBase(apiBase).replace(/\/+$/, '')
  const url = base.startsWith('/')
    ? `${base}/client/models`
    : `${base}/client/models`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    noteClientSessionFailure(res.status, text)
    return []
  }
  const body = (await res.json()) as { code?: number; message?: string; data?: { list?: ClientSystemModelDto[] } }
  if (body.code !== 0 || !body.data?.list) {
    noteClientSessionFailure(res.status, body.message, body.code)
    return []
  }
  return body.data.list.map(mapSystemModelDto)
}

export function mergeModelsByKind(
  kind: ModelKind,
  customModels: ModelConfig[],
  systemByKind: SystemModelsByKind,
): ModelConfig[] {
  const custom = customModels.filter((m) => !isSystemModel(m))
  const systemModels = filterSystemModelsForSelect(kind, systemByKind[kind] || [])
  return [...systemModels, ...custom]
}

/** 按 kind 合并：系统模型在前，自定义在后 */
export function mergeModelsForKind(
  kind: ModelKind,
  customModels: ModelConfig[],
  systemByKind: SystemModelsByKind,
): ModelConfig[] {
  return mergeModelsByKind(kind, customModels, systemByKind)
}

/** 图片模型：系统按 group_name 分组 + 自定义模型 */
export function mergeImageModelsGrouped(
  customModels: ModelConfig[],
  systemByKind: SystemModelsByKind,
): ImageModelPickerGroups {
  const systemModels = filterSystemModelsForSelect('image', systemByKind.image || [])
  return buildImageModelPickerGroups(customModels, systemModels)
}

export type { ImageModelPickerGroups }

export function ensureCustomSource(model: ModelConfig): ModelConfig {
  if (isSystemModel(model)) return model
  return { ...model, source: model.source || 'custom' }
}
