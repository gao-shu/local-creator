// Copyright (c) local-creator contributors. All rights reserved.

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
  unit_cost: number
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

/** 开源版无额度计费 */
export function resolveImageCostSync(
  _model?: ModelConfig | null,
  _options?: { resolution?: string | null; quality?: string | null; quantity?: number },
): number {
  return 0
}

export function shouldFetchImageModelQuote(
  _model?: ModelConfig | null,
  _options?: { resolution?: string | null; quality?: string | null },
): boolean {
  return false
}

export async function quoteClientModel(
  _options: ImageModelQuoteRequest,
): Promise<ClientModelQuoteDto> {
  throw new Error('公司询价接口已移除')
}

export async function resolveImageCost(
  _model?: ModelConfig | null,
  _options?: {
    resolution?: string | null
    quality?: string | null
    quantity?: number
    apiBase?: string
  },
): Promise<number> {
  return 0
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

/** 列表/下拉展示价 */
export function formatImageModelListPriceLabel(model: ModelConfig | null | undefined): string | null {
  if (!model) return null
  return model.imagePricing?.pricingSummary?.trim() || null
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
