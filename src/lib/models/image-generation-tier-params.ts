// Copyright (c) local-creator contributors. All rights reserved.

import type { SelectOption } from '@/components/ui/select'
import type { ModelConfig, ImageQuality } from '@/types/settings'
import {
  formatImageQualityLabel,
  isTieredImagePricing,
  normalizeImageQuality,
  normalizeImageResolution,
} from '@/lib/models/image-model-pricing'

export type ImageGenerationTierParams = {
  resolution: string | null
  quality: ImageQuality | null
}

export type ImageGenerationTierPrefs = {
  resolution?: string | null
  quality?: ImageQuality | string | null
}

const DEFAULT_RESOLUTION_ORDER = ['1K', '2K', '4K'] as const
const DEFAULT_QUALITY_ORDER: ImageQuality[] = ['low', 'medium', 'high']

export function shouldShowImageResolutionSelector(model: ModelConfig | null | undefined): boolean {
  const meta = model?.imagePricing
  if (!meta) return false
  if (!isTieredImagePricing(meta.pricingMode)) return false
  return resolveImageResolutionOptions(model).length > 0
}

export function shouldShowImageQualitySelector(model: ModelConfig | null | undefined): boolean {
  const meta = model?.imagePricing
  if (!meta) return false
  return meta.supportsQualityModes === true || meta.pricingMode === 'by_quality_resolution'
}

export function shouldShowImageGenerationTierControls(model: ModelConfig | null | undefined): boolean {
  return shouldShowImageResolutionSelector(model) || shouldShowImageQualitySelector(model)
}

export function resolveImageResolutionOptions(model: ModelConfig | null | undefined): SelectOption[] {
  const meta = model?.imagePricing
  if (!meta || !isTieredImagePricing(meta.pricingMode)) return []

  const configured = meta.resolutions?.length
    ? meta.resolutions
        .map((item) => normalizeImageResolution(item))
        .filter((item): item is string => Boolean(item))
    : []

  const ordered =
    configured.length > 0
      ? DEFAULT_RESOLUTION_ORDER.filter((item) => configured.includes(item))
      : [...DEFAULT_RESOLUTION_ORDER]

  return ordered.map((value) => ({ value, label: value }))
}

export function resolveImageQualityOptions(model: ModelConfig | null | undefined): SelectOption[] {
  if (!shouldShowImageQualitySelector(model)) return []
  return DEFAULT_QUALITY_ORDER.map((value) => ({
    value,
    label: formatImageQualityLabel(value),
  }))
}

export function normalizeImageGenerationTierParams(
  model: ModelConfig | null | undefined,
  current?: ImageGenerationTierPrefs | null,
  fallback?: ImageGenerationTierPrefs | null,
): ImageGenerationTierParams {
  const meta = model?.imagePricing
  const resolutionOptions = resolveImageResolutionOptions(model)
  const qualityOptions = resolveImageQualityOptions(model)

  const defaultResolution =
    normalizeImageResolution(meta?.defaultResolution) ??
    normalizeImageResolution(fallback?.resolution) ??
    resolutionOptions[0]?.value ??
    '1K'

  const defaultQuality =
    normalizeImageQuality(meta?.defaultQuality) ??
    normalizeImageQuality(fallback?.quality) ??
    normalizeImageQuality(qualityOptions[0]?.value) ??
    'medium'

  let resolution = normalizeImageResolution(current?.resolution) ?? defaultResolution
  let quality = normalizeImageQuality(current?.quality) ?? defaultQuality

  if (resolutionOptions.length > 0 && !resolutionOptions.some((item) => item.value === resolution)) {
    resolution = defaultResolution
  }
  if (qualityOptions.length > 0 && !qualityOptions.some((item) => item.value === quality)) {
    quality = defaultQuality
  }

  return {
    resolution: shouldShowImageResolutionSelector(model) ? resolution : null,
    quality: shouldShowImageQualitySelector(model) ? quality : null,
  }
}

export function formatImageGenerationTierSummary(
  model: ModelConfig | null | undefined,
  params: ImageGenerationTierParams,
): string | null {
  const parts: string[] = []
  if (shouldShowImageResolutionSelector(model) && params.resolution) {
    parts.push(params.resolution)
  }
  if (shouldShowImageQualitySelector(model) && params.quality) {
    parts.push(formatImageQualityLabel(params.quality))
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

export function resolveAssetImageTierPrefs(settings?: {
  lastUsedAssetImageResolution?: string | null
  lastUsedAssetImageQuality?: ImageQuality | string | null
} | null): ImageGenerationTierPrefs {
  return {
    resolution: settings?.lastUsedAssetImageResolution ?? null,
    quality: settings?.lastUsedAssetImageQuality ?? null,
  }
}

export function resolveStoryboardImageTierPrefs(settings?: {
  lastUsedStoryboardImageResolution?: string | null
  lastUsedStoryboardImageQuality?: ImageQuality | string | null
} | null): ImageGenerationTierPrefs {
  return {
    resolution: settings?.lastUsedStoryboardImageResolution ?? null,
    quality: settings?.lastUsedStoryboardImageQuality ?? null,
  }
}

/** 代理生图 / quote 请求体：仅在有计价档控件时传 resolution/quality */
export function buildImageProxyTierPayload(
  model: ModelConfig | null | undefined,
  tier?: ImageGenerationTierPrefs | ImageGenerationTierParams | null,
): { resolution?: string; quality?: string } {
  const normalized = normalizeImageGenerationTierParams(model, tier)
  const payload: { resolution?: string; quality?: string } = {}
  if (normalized.resolution) payload.resolution = normalized.resolution
  if (normalized.quality) payload.quality = normalized.quality
  return payload
}
