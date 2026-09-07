// Copyright (c) Haode AI. All rights reserved.

import { resolveApiBase } from '@/lib/auth/api-base'
import { hasPersistedRealToken } from '@/lib/auth/login-mode'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import { computeHaodouChargeAmount, parseUnitPrice } from '@/lib/models/system-model-unit-price'
import { useAuthStore } from '@/stores/auth-store'
import type {
  ImageModelPricingMeta,
  ImagePricingMode,
  ImageQuality,
  ModelConfig,
} from '@/types/settings'

export type { ImagePricingMode, ImageQuality }

export const IMAGE_QUALITY_LABELS: Record<ImageQuality, string> = {
  low: '低',
  medium: '中',
  high: '高',
}

export type ClientModelQuoteDto = {
  model_key: string
  billing_mode: string
  pricing_mode?: ImagePricingMode | null
  unit_price: string
  unit_label: string
  haodou_cost: number
  pricing_summary?: string | null
  resolution?: string | null
  quality?: ImageQuality | null
  quantity: number
}

export type ImageModelQuoteRequest = {
  modelKey: string
  resolution?: string
  quality?: ImageQuality | string
  quantity?: number
  apiBase?: string
}

type QuoteEnvelope = { code?: number; message?: string; data?: ClientModelQuoteDto }

export function normalizeImageQuality(value: unknown): ImageQuality | null {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw
  return null
}

export function normalizeImageResolution(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const upper = raw.toUpperCase()
  if (upper === '1K' || upper === '2K' || upper === '4K') return upper
  return null
}

export function isTieredImagePricing(mode: ImagePricingMode | null | undefined): boolean {
  return mode === 'by_resolution' || mode === 'by_quality_resolution'
}

export function formatImageQualityLabel(quality: ImageQuality | string | null | undefined): string {
  const normalized = normalizeImageQuality(quality)
  if (!normalized) return String(quality ?? '')
  return IMAGE_QUALITY_LABELS[normalized]
}

export function formatResolutionCapabilityLabel(resolutions: string[] | undefined): string | null {
  if (!resolutions?.length) return null
  const order = ['1K', '2K', '4K']
  const picked = order.filter((item) => resolutions.includes(item))
  return picked.length > 0 ? picked.join('·') : null
}

export function mapDtoToImagePricingMeta(dto: {
  pricing_mode?: ImagePricingMode | string | null
  pricing_summary?: string | null
  price_range?: { min: string; max: string } | null
  default_resolution?: string | null
  default_quality?: string | null
  resolutions?: string[] | null
  supports_quality_modes?: boolean
  aspect_ratios?: Array<Record<string, unknown>> | null
  group_name?: string | null
  description?: string | null
}): ImageModelPricingMeta | undefined {
  const pricingMode = dto.pricing_mode as ImagePricingMode | null | undefined
  const hasPricing =
    pricingMode ||
    dto.pricing_summary ||
    dto.price_range ||
    dto.default_resolution ||
    dto.default_quality ||
    (dto.resolutions?.length ?? 0) > 0 ||
    dto.supports_quality_modes ||
    (dto.aspect_ratios?.length ?? 0) > 0 ||
    dto.group_name ||
    dto.description

  if (!hasPricing) return undefined

  const aspectRatios = Array.isArray(dto.aspect_ratios)
    ? dto.aspect_ratios
        .map((item) => {
          const label = String(item.label ?? '').trim()
          const value = String(item.value ?? '').trim()
          const width = Number(item.width)
          const height = Number(item.height)
          if (!label || !value || !Number.isFinite(width) || !Number.isFinite(height)) return null
          if (width <= 0 || height <= 0) return null
          return { label, value, width, height }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null)
    : undefined

  return {
    pricingMode: pricingMode ?? null,
    pricingSummary: dto.pricing_summary ?? null,
    priceRange: dto.price_range ?? null,
    defaultResolution: normalizeImageResolution(dto.default_resolution),
    defaultQuality: normalizeImageQuality(dto.default_quality),
    resolutions: dto.resolutions?.length ? [...dto.resolutions] : undefined,
    supportsQualityModes: dto.supports_quality_modes === true,
    aspectRatios: aspectRatios?.length ? aspectRatios : undefined,
    groupName: String(dto.group_name ?? '').trim() || null,
    description: String(dto.description ?? '').trim() || null,
  }
}

export function resolveSelectedImageTier(options?: {
  resolution?: string | null
  quality?: string | null
  model?: ModelConfig | null
}): { resolution: string | null; quality: ImageQuality | null } {
  const meta = options?.model?.imagePricing
  const resolution =
    normalizeImageResolution(options?.resolution) ??
    normalizeImageResolution(meta?.defaultResolution) ??
    '1K'
  const quality =
    normalizeImageQuality(options?.quality) ??
    normalizeImageQuality(meta?.defaultQuality) ??
    'medium'
  return { resolution, quality }
}

export function isDefaultImageTier(
  model: ModelConfig | null | undefined,
  options?: { resolution?: string | null; quality?: string | null },
): boolean {
  const meta = model?.imagePricing
  if (!meta) return true
  const selected = resolveSelectedImageTier({ model, ...options })
  const defaultResolution = normalizeImageResolution(meta.defaultResolution) ?? '1K'
  const defaultQuality = normalizeImageQuality(meta.defaultQuality) ?? 'medium'
  return selected.resolution === defaultResolution && selected.quality === defaultQuality
}

/** 列表同步预估：仅默认档准确；非默认档应调 quote API */
export function resolveImageHaodouCostSync(
  model: ModelConfig | null | undefined,
  options?: { resolution?: string | null; quality?: string | null; quantity?: number },
): number {
  if (!model) return 0
  const quantity = Math.max(1, Math.trunc(options?.quantity ?? 1))
  if (model.billingMode === 'internal') return 0

  if (
    model.imagePricing &&
    isTieredImagePricing(model.imagePricing.pricingMode) &&
    !isDefaultImageTier(model, options)
  ) {
    return 0
  }

  if (typeof model.unitPrice === 'number' && model.unitPrice > 0) {
    return computeHaodouChargeAmount(model.unitPrice, quantity)
  }
  if (typeof model.haodouCost === 'number' && model.haodouCost > 0) {
    return quantity === 1 ? model.haodouCost : computeHaodouChargeAmount(model.haodouCost, quantity)
  }
  return 0
}

export function shouldFetchImageModelQuote(
  model: ModelConfig | null | undefined,
  options?: { resolution?: string | null; quality?: string | null },
): boolean {
  if (!model?.imagePricing) return false
  if (model.billingMode === 'internal') return false
  if (!isTieredImagePricing(model.imagePricing.pricingMode)) return false
  return !isDefaultImageTier(model, options)
}

export async function quoteClientModel(
  options: ImageModelQuoteRequest,
): Promise<ClientModelQuoteDto> {
  const token = useAuthStore.getState().token
  if (!token || !hasPersistedRealToken(token)) {
    throw new Error('未登录')
  }

  const modelKey = options.modelKey.trim()
  if (!modelKey) throw new Error('模型标识无效')

  const quantity = Math.trunc(options.quantity ?? 1)
  const body: Record<string, unknown> = {
    model_key: modelKey,
    quantity,
  }
  if (options.resolution) body.resolution = options.resolution
  if (options.quality) body.quality = options.quality

  const base = resolveApiBase(options.apiBase).replace(/\/+$/, '')
  const url = base.startsWith('/') ? `${base}/client/models/quote` : `${base}/client/models/quote`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const json = (await res.json()) as QuoteEnvelope & { detail?: string }
  if (!res.ok || json.code !== 0 || !json.data) {
    const hint = json.message || (typeof json.detail === 'string' ? json.detail : undefined)
    noteClientSessionFailure(res.status, hint, json.code)
    throw new Error(json.message || hint || '询价失败')
  }
  return json.data
}

export async function resolveImageHaodouCost(
  model: ModelConfig | null | undefined,
  options?: {
    resolution?: string | null
    quality?: string | null
    quantity?: number
    apiBase?: string
  },
): Promise<number> {
  if (!model?.modelKey?.trim()) return 0
  if (model.billingMode === 'internal') return 0

  if (shouldFetchImageModelQuote(model, options)) {
    const quote = await quoteClientModel({
      modelKey: model.modelKey,
      resolution: options?.resolution ?? undefined,
      quality: options?.quality ?? undefined,
      quantity: options?.quantity,
      apiBase: options?.apiBase,
    })
    return quote.haodou_cost
  }

  return resolveImageHaodouCostSync(model, options)
}

export function formatImageUnitPriceLabel(quote: ClientModelQuoteDto): string {
  const price = parseUnitPrice(quote.unit_price)
  if (price <= 0) return '免费'
  return `${price.toFixed(1)} ${quote.unit_label || '豆/张'}`
}

export function formatImagePricingModeLabel(mode: ImagePricingMode | null | undefined): string | null {
  if (mode === 'by_resolution') return '分辨率'
  if (mode === 'by_quality_resolution') return '质量+分辨率'
  if (mode === 'flat') return '固定'
  return null
}

export function formatAspectRatioCountLabel(count: number): string | null {
  if (count <= 0) return null
  return `${count} 比例`
}

export type ImageCapabilityDisplay = {
  resolutionLabel: string | null
  aspectRatioLabel: string | null
}

export function buildImageCapabilityDisplay(model: ModelConfig | null | undefined): ImageCapabilityDisplay {
  const meta = model?.imagePricing
  return {
    resolutionLabel: formatResolutionCapabilityLabel(meta?.resolutions),
    aspectRatioLabel: formatAspectRatioCountLabel(meta?.aspectRatios?.length ?? 0),
  }
}

/** 列表/下拉展示价：优先 pricing_summary，否则好豆兜底 */
export function formatImageModelListPriceLabel(model: ModelConfig | null | undefined): string | null {
  if (!model) return null
  const summary = model.imagePricing?.pricingSummary?.trim()
  if (summary) return summary
  if (model.billingMode === 'internal') return null
  if (typeof model.haodouCost === 'number' && model.haodouCost > 0) {
    const unit = model.unitLabel?.trim() || '豆/张'
    return `${model.haodouCost} ${unit}`
  }
  if (typeof model.unitPrice === 'number' && model.unitPrice > 0) {
    const unit = model.unitLabel?.trim() || '豆/张'
    return `${model.unitPrice.toFixed(1)} ${unit}`
  }
  return null
}

export type ImageModelGroup = {
  /** 分组键：group_name 或单模型 modelKey/id */
  groupKey: string
  /** 同组多通道名；单模型无分组时为 null */
  groupName: string | null
  /** 组内模型（已按名称排序） */
  models: ModelConfig[]
  /** 同 group_name 下是否有多条通道 */
  isMultiChannel: boolean
}

export function resolveImageModelGroupKey(model: ModelConfig | null | undefined): string {
  if (!model) return ''
  const groupName = model.imagePricing?.groupName?.trim()
  if (groupName) return groupName
  return model.modelKey?.trim() || model.id
}

export function resolveImageModelGroupLabel(model: ModelConfig | null | undefined): string {
  const groupName = model?.imagePricing?.groupName?.trim()
  if (groupName) return groupName
  return model?.name?.trim() || model?.modelKey?.trim() || model?.id || ''
}

export function collectImageGroupNames(models: ModelConfig[]): string[] {
  const names = new Set<string>()
  for (const model of models) {
    const name = model.imagePricing?.groupName?.trim()
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'zh-CN'))
}

export function groupImageModelsByGroupName(models: ModelConfig[]): ImageModelGroup[] {
  const groups: ImageModelGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const model of models) {
    const groupKey = resolveImageModelGroupKey(model)
    if (!groupKey) continue
    const groupName = model.imagePricing?.groupName?.trim() || null
    const existingIdx = indexByKey.get(groupKey)

    if (existingIdx === undefined) {
      indexByKey.set(groupKey, groups.length)
      groups.push({
        groupKey,
        groupName,
        models: [model],
        isMultiChannel: false,
      })
      continue
    }

    const group = groups[existingIdx]
    group.models.push(model)
    group.isMultiChannel = group.models.length > 1
  }

  for (const group of groups) {
    group.models.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }
  return groups
}

export function findImageModelsInSameGroup(
  allModels: ModelConfig[],
  model: ModelConfig | null | undefined,
): ModelConfig[] {
  if (!model) return []
  const groupKey = resolveImageModelGroupKey(model)
  if (!groupKey) return [model]
  const members = allModels.filter((item) => resolveImageModelGroupKey(item) === groupKey)
  return members.length > 0 ? members : [model]
}

export function flattenImageModelGroups(groups: ImageModelGroup[]): ModelConfig[] {
  return groups.flatMap((group) => group.models)
}

export type ImageModelPickerGroups = {
  systemGroups: ImageModelGroup[]
  customModels: ModelConfig[]
}

/** 业务下拉：系统模型按 group_name 分组，自定义模型单独列表 */
export function buildImageModelPickerGroups(
  customModels: ModelConfig[],
  systemModels: ModelConfig[],
): ImageModelPickerGroups {
  const custom = customModels.filter((model) => model.source !== 'system')
  const system = systemModels.filter((model) => model.source === 'system')
  return {
    systemGroups: groupImageModelsByGroupName(system),
    customModels: custom,
  }
}
