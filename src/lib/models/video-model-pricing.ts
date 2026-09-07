// Copyright (c) Haode AI. All rights reserved.

import { resolveApiBase } from '@/lib/auth/api-base'
import { hasPersistedRealToken } from '@/lib/auth/login-mode'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import { computeHaodouChargeAmount, parseUnitPrice } from '@/lib/models/system-model-unit-price'
import { useAuthStore } from '@/stores/auth-store'
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
  haodou_cost: number
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

export function resolveVideoHaodouCostSync(
  model: ModelConfig | null | undefined,
  options?: { resolution?: string | null; durationSec?: number },
): number {
  if (!model) return 0
  const durationSec = Math.max(1, Math.trunc(options?.durationSec ?? 5))
  if (model.billingMode === 'internal') return 0

  if (
    model.videoPricing &&
    isTieredVideoPricing(model.videoPricing.pricingMode) &&
    !isDefaultVideoTier(model, options)
  ) {
    return 0
  }

  if (typeof model.unitPrice === 'number' && model.unitPrice > 0) {
    return computeHaodouChargeAmount(model.unitPrice, durationSec)
  }
  if (typeof model.haodouCost === 'number' && model.haodouCost > 0) {
    return computeHaodouChargeAmount(model.haodouCost, durationSec)
  }
  return 0
}

export function shouldFetchVideoModelQuote(
  model: ModelConfig | null | undefined,
  options?: { resolution?: string | null },
): boolean {
  if (!model?.videoPricing) return false
  if (model.billingMode === 'internal') return false
  if (!isTieredVideoPricing(model.videoPricing.pricingMode)) return false
  return !isDefaultVideoTier(model, options)
}

export async function quoteClientVideoModel(
  options: VideoModelQuoteRequest,
): Promise<ClientVideoModelQuoteDto> {
  const token = useAuthStore.getState().token
  if (!token || !hasPersistedRealToken(token)) {
    throw new Error('未登录')
  }

  const modelKey = options.modelKey.trim()
  if (!modelKey) throw new Error('模型标识无效')

  const body = buildClientVideoQuoteRequestBody({
    modelKey,
    durationSec: options.durationSec,
    resolution: options.resolution,
  })

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

/**
 * Quote 请求体仅含计价字段（H2）：model_key + duration_sec + 可选 resolution。
 * 禁止夹带 aspect_ratio / reference_mode。
 */
export function buildClientVideoQuoteRequestBody(options: {
  modelKey: string
  durationSec: number
  resolution?: string | null
}): Record<string, unknown> {
  const durationSec = Math.max(1, Math.trunc(options.durationSec))
  const body: Record<string, unknown> = {
    model_key: options.modelKey.trim(),
    duration_sec: durationSec,
  }
  const resolution = normalizeVideoResolution(options.resolution)
  if (resolution) body.resolution = resolution
  return body
}

export async function resolveVideoHaodouCost(
  model: ModelConfig | null | undefined,
  options?: {
    resolution?: string | null
    durationSec?: number
    apiBase?: string
  },
): Promise<number> {
  if (!model?.modelKey?.trim()) return 0
  if (model.billingMode === 'internal') return 0

  if (shouldFetchVideoModelQuote(model, options)) {
    const quote = await quoteClientVideoModel({
      modelKey: model.modelKey,
      resolution: options?.resolution ?? undefined,
      durationSec: options?.durationSec ?? 5,
      apiBase: options?.apiBase,
    })
    return quote.haodou_cost
  }

  return resolveVideoHaodouCostSync(model, options)
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
  const summary = model.videoPricing?.pricingSummary?.trim()
  if (summary) return summary
  if (model.billingMode === 'internal') return null
  if (typeof model.haodouCost === 'number' && model.haodouCost > 0) {
    const unit = model.unitLabel?.trim() || '豆/秒'
    return `${model.haodouCost} ${unit}`
  }
  if (typeof model.unitPrice === 'number' && model.unitPrice > 0) {
    const unit = model.unitLabel?.trim() || '豆/秒'
    return `${model.unitPrice.toFixed(1)} ${unit}`
  }
  return null
}

export function formatVideoUnitPriceLabel(quote: ClientVideoModelQuoteDto): string {
  const price = parseUnitPrice(quote.unit_price)
  if (price <= 0) return '免费'
  return `${price.toFixed(1)} ${quote.unit_label || '豆/秒'}`
}
