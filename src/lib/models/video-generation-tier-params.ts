// Copyright (c) local-creator contributors. All rights reserved.

import type { SelectOption } from '@/components/ui/select'
import type { ModelConfig } from '@/types/settings'
import {
  coerceVideoResolutionTag,
  formatVideoResolutionLabel,
  isTieredVideoPricing,
  VIDEO_RESOLUTION_ORDER,
  type VideoResolutionKey,
} from '@/lib/models/video-model-pricing'

export type VideoGenerationTierParams = {
  resolution: string | null
}

export type VideoGenerationTierPrefs = {
  resolution?: string | null
}

function orderVideoResolutionTags(tags: string[]): string[] {
  const unique = [...new Set(tags)]
  const known = VIDEO_RESOLUTION_ORDER.filter((item) => unique.includes(item))
  const custom = unique.filter((item) => !VIDEO_RESOLUTION_ORDER.includes(item as VideoResolutionKey))
  return [...known, ...custom]
}

function toResolutionSelectOptions(tags: string[]): SelectOption[] {
  return orderVideoResolutionTags(tags).map((value) => ({
    value,
    label: formatVideoResolutionLabel(value),
  }))
}

function coerceResolutionTagList(tags: unknown[] | undefined): string[] {
  if (!tags?.length) return []
  const out: string[] = []
  for (const item of tags) {
    const tag = coerceVideoResolutionTag(item)
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out
}

/**
 * 从模型字段解析已声明清晰度（不做客户端默认补全）。
 * pricing 与 model.resolutions 皆有时取交集，避免脏 videoPricing 多出假档（如本地 480P）。
 */
function resolveConfiguredResolutionTags(model?: ModelConfig | null | undefined): string[] {
  const fromPricing = coerceResolutionTagList(model?.videoPricing?.resolutions)
  const fromModel = coerceResolutionTagList(model?.resolutions)
  if (fromPricing.length > 0 && fromModel.length > 0) {
    const modelSet = new Set(fromModel)
    const intersection = fromPricing.filter((item) => modelSet.has(item))
    if (intersection.length > 0) return intersection
  }
  return fromPricing.length > 0 ? fromPricing : fromModel
}

/**
 * 分档计价清晰度：仅展示后台/模型声明的档位。
 * 空列表不回退全表（避免未配置时误出 480P/720P/…）。
 */
function resolveTieredVideoResolutionOptions(
  model?: ModelConfig | null | undefined,
): SelectOption[] {
  const meta = model?.videoPricing
  if (!meta || !isTieredVideoPricing(meta.pricingMode)) return []

  const configured = resolveConfiguredResolutionTags(model)
  if (configured.length === 0) return []
  return toResolutionSelectOptions(configured)
}

/** 无分档：仅用 model.resolutions；未声明则无可选项（不发明 480/720/1080） */
export function resolveVideoPresetResolutionOptions(
  model?: ModelConfig | null | undefined,
): SelectOption[] {
  const configured = Array.isArray(model?.resolutions)
    ? model.resolutions
        .map((item) => coerceVideoResolutionTag(item))
        .filter((item): item is string => Boolean(item))
    : []

  if (configured.length === 0) return []
  return toResolutionSelectOptions(configured)
}

/**
 * 仅当模型声明了「≥2」档清晰度时展示选择器。
 * 单档（如仅 720P）只在摘要里显示，避免假二选一；绝不因客户端默认表误亮。
 */
export function shouldShowVideoResolutionSelector(model: ModelConfig | null | undefined): boolean {
  return resolveVideoResolutionOptions(model).length >= 2
}

export function resolveVideoResolutionOptions(model?: ModelConfig | null | undefined): SelectOption[] {
  const tiered = resolveTieredVideoResolutionOptions(model)
  if (tiered.length > 0) return tiered

  // 已声明档位：有什么展示什么（catalog 常带 resolutions / default_resolution，但无 by_resolution）
  const declared = resolveConfiguredResolutionTags(model)
  if (declared.length > 0) return toResolutionSelectOptions(declared)

  return resolveVideoPresetResolutionOptions(model)
}

function pickResolutionFromOptions(
  raw: string | null | undefined,
  options: SelectOption[],
): string | null {
  const coerced = coerceVideoResolutionTag(raw)
  if (!coerced) return null
  const hit = options.find(
    (item) => item.value === coerced || item.value.toUpperCase() === coerced.toUpperCase(),
  )
  return hit?.value ?? null
}

export function normalizeVideoGenerationTierParams(
  model: ModelConfig | null | undefined,
  current?: VideoGenerationTierPrefs | null,
  fallback?: VideoGenerationTierPrefs | null,
): VideoGenerationTierParams {
  const meta = model?.videoPricing
  const resolutionOptions = resolveVideoResolutionOptions(model)

  const defaultFromOptions =
    pickResolutionFromOptions('720P', resolutionOptions) ??
    resolutionOptions[0]?.value ??
    null

  const defaultResolution =
    pickResolutionFromOptions(meta?.defaultResolution, resolutionOptions) ??
    pickResolutionFromOptions(fallback?.resolution, resolutionOptions) ??
    defaultFromOptions ??
    '720P'

  const resolution =
    pickResolutionFromOptions(current?.resolution, resolutionOptions) ?? defaultResolution

  // 选择器是否展示不影响落库值：单档也写入唯一可用清晰度
  return { resolution }
}

export function normalizeVideoResolutionValue(
  value?: string | null,
  model?: ModelConfig | null,
): string {
  return normalizeVideoGenerationTierParams(model, { resolution: value }).resolution ?? '720P'
}

export function formatVideoGenerationTierSummary(
  model: ModelConfig | null | undefined,
  params: VideoGenerationTierParams,
): string | null {
  if (!params.resolution) return null
  // 有声明档位（含单档）时展示文案；完全未配置则不假装有清晰度
  if (resolveVideoResolutionOptions(model).length < 1 && !model?.videoPricing?.defaultResolution) {
    return null
  }
  return formatVideoResolutionLabel(params.resolution)
}

export function resolveStoryboardVideoTierPrefs(settings?: {
  lastUsedStoryboardVideoResolution?: string | null
} | null): VideoGenerationTierPrefs {
  return {
    resolution: settings?.lastUsedStoryboardVideoResolution ?? null,
  }
}

export function buildVideoProxyTierPayload(
  model: ModelConfig | null | undefined,
  tier?: VideoGenerationTierPrefs | VideoGenerationTierParams | null,
): { resolution?: string } {
  const normalized = normalizeVideoGenerationTierParams(model, tier)
  if (!normalized.resolution) return {}
  return { resolution: normalized.resolution }
}
