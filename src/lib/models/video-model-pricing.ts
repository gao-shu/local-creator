// Copyright (c) Haode AI. All rights reserved.

import type { ModelConfig, VideoModelPricingMeta, VideoPricingMode } from '@/types/settings'

export type { VideoPricingMode }

export const VIDEO_RESOLUTION_ORDER = ['360P', '480P', '720P', '1080P', '1440P', '4K'] as const
export type VideoResolutionKey = (typeof VIDEO_RESOLUTION_ORDER)[number]

const RESOLUTION_ALIASES: Record<string, VideoResolutionKey> = {
  '360': '360P',
  '360p': '360P',
  '360P': '360P',
  '480': '480P',
  '480p': '480P',
  '480P': '480P',
  sd: '480P',
  '720': '720P',
  '720p': '720P',
  '720P': '720P',
  hd: '720P',
  '1080': '1080P',
  '1080p': '1080P',
  '1080P': '1080P',
  fhd: '1080P',
  '1440': '1440P',
  '1440p': '1440P',
  '1440P': '1440P',
  '2k': '1440P',
  '2K': '1440P',
  qhd: '1440P',
  '2160': '4K',
  '2160p': '4K',
  '4k': '4K',
  '4K': '4K',
  uhd: '4K',
}

export type ClientVideoModelQuoteDto = {
  model_key: string
  billing_mode: string
  pricing_mode?: VideoPricingMode | null
  unit_price: string
  unit_label: string
  unit_cost: number
  pricing_summary?: string | null
  resolution?: string | null
  duration_sec?: number | null
  quantity: number
}

export type VideoModelQuoteRequest = {
  modelKey: string
  resolution?: string
  durationSec: number
  apiBase?: string
}

type QuoteEnvelope = { code?: number; message?: string; data?: ClientVideoModelQuoteDto }

export function normalizeVideoResolution(value: unknown): VideoResolutionKey | null {
  if (value === null || value === undefined) return null
  const key = String(value).trim()
  if (!key) return null
  return RESOLUTION_ALIASES[key] ?? RESOLUTION_ALIASES[key.toLowerCase()] ?? null
}

/**
 * 白名单之外的自定义分辨率透传（如 540P）。
 * 仅接受「数字 + 可选 p/P」形态，避免把任意脏串放进下拉。
 */
export function coerceVideoResolutionTag(value: unknown): string | null {
  const known = normalizeVideoResolution(value)
  if (known) return known
  const raw = String(value ?? '').trim()
  if (!raw) return null
  if (/^\d+$/.test(raw)) return `${raw}P`
  if (/^\d+p$/i.test(raw)) return raw.toUpperCase()
  return null
}

export function isTieredVideoPricing(mode: VideoPricingMode | null | undefined): boolean {
  return mode === 'by_resolution'
}

export function formatVideoResolutionLabel(resolution: string | null | undefined): string {
  const known = normalizeVideoResolution(resolution)
  if (known) {
    if (known === '4K') return '4K'
    return known.toLowerCase()
  }
  const coerced = coerceVideoResolutionTag(resolution)
  if (coerced) {
    if (coerced.toUpperCase() === '4K') return '4K'
    return coerced.toLowerCase()
  }
  return String(resolution ?? '')
}

export function formatResolutionCapabilityLabel(resolutions: string[] | undefined): string | null {
  if (!resolutions?.length) return null
  const picked = VIDEO_RESOLUTION_ORDER.filter((item) =>
    resolutions.some((entry) => normalizeVideoResolution(entry) === item),
  )
  return picked.length > 0 ? picked.map(formatVideoResolutionLabel).join('·') : null
}

export function mapDtoToVideoPricingMeta(dto: {
  pricing_mode?: VideoPricingMode | string | null
  pricing_summary?: string | null
  price_range?: { min: string; max: string } | null
  default_resolution?: string | null
  resolutions?: string[] | null
}): VideoModelPricingMeta | undefined {
  const pricingMode = dto.pricing_mode as VideoPricingMode | null | undefined
  const hasPricing =
    pricingMode ||
    dto.pricing_summary ||
    dto.price_range ||
    dto.default_resolution ||
    (dto.resolutions?.length ?? 0) > 0

  if (!hasPricing) return undefined

  const resolutions = dto.resolutions
    ?.map((item) => coerceVideoResolutionTag(item))
    .filter((item): item is string => Boolean(item))

  return {
    pricingMode: pricingMode ?? null,
    pricingSummary: dto.pricing_summary ?? null,
    priceRange: dto.price_range ?? null,
    defaultResolution: normalizeVideoResolution(dto.default_resolution) ?? coerceVideoResolutionTag(dto.default_resolution),
    resolutions: resolutions?.length ? [...new Set(resolutions)] : undefined,
  }
}

export function resolveSelectedVideoTier(options?: {
  resolution?: string | null
  model?: ModelConfig | null
}): { resolution: VideoResolutionKey } {
  const meta = options?.model?.videoPricing
  const resolution =
    normalizeVideoResolution(options?.resolution) ??
    normalizeVideoResolution(meta?.defaultResolution) ??
    '720P'
  return { resolution }
}

export function isDefaultVideoTier(
  model: ModelConfig | null | undefined,
  options?: { resolution?: string | null; durationSec?: number },
): boolean {
  void options?.durationSec
  const meta = model?.videoPricing
  if (!meta) return true
  const selected = resolveSelectedVideoTier({ model, resolution: options?.resolution })
  const defaultResolution = normalizeVideoResolution(meta.defaultResolution) ?? '720P'
  return selected.resolution === defaultResolution
}

export function resolveVideoCostSync(
  _model?: ModelConfig | null,
  _options?: { resolution?: string | null; durationSec?: number },
): number {
  return 0
}

export function shouldFetchVideoModelQuote(
  _model?: ModelConfig | null,
  _options?: { resolution?: string | null; durationSec?: number },
): boolean {
  return false
}

export async function quoteClientVideoModel(
  _options: VideoModelQuoteRequest,
): Promise<ClientVideoModelQuoteDto> {
  throw new Error('公司询价接口已移除')
}

export async function resolveVideoCost(
  _model?: ModelConfig | null,
  _options?: {
    resolution?: string | null
    durationSec?: number
    apiBase?: string
  },
): Promise<number> {
  return 0
}

export function formatVideoPricingModeLabel(mode: VideoPricingMode | null | undefined): string | null {
  if (mode === 'by_resolution') return '分辨率'
  if (mode === 'flat') return '固定'
  return null
}

export type VideoCapabilityDisplay = {
  resolutionLabel: string | null
}

export function buildVideoCapabilityDisplay(model: ModelConfig | null | undefined): VideoCapabilityDisplay {
  const meta = model?.videoPricing
  return {
    resolutionLabel: formatResolutionCapabilityLabel(meta?.resolutions),
  }
}

export function formatVideoModelListPriceLabel(model: ModelConfig | null | undefined): string | null {
  if (!model) return null
  return model.videoPricing?.pricingSummary?.trim() || null
}

export function formatVideoUnitPriceLabel(quote: ClientVideoModelQuoteDto): string {
  const price = parseUnitPrice(quote.unit_price)
  if (price <= 0) return '免费'
  return `${price.toFixed(1)} ${quote.unit_label || '豆/秒'}`
}
