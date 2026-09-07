// Copyright (c) local-creator contributors. All rights reserved.

import type { ModelConfig, VideoModelPricingMeta } from '@/types/settings'
import { coerceVideoResolutionTag } from '@/lib/models/video-model-pricing'
import { isWeishiApiModel, WEISHI_API_PRESET } from '@/lib/models/weishi-model-presets'

/** 按 upstream model id 匹配平台下发的微视系统模型（含内部模型） */
export function findWeishiSystemModelByUpstreamId(
  systemVideoModels: ModelConfig[],
  modelId: string,
): ModelConfig | undefined {
  const id = modelId.trim()
  if (!id) return undefined
  return systemVideoModels.find((model) => isWeishiApiModel(model) && model.model?.trim() === id)
}

function normalizeResolutionList(tags: string[] | undefined): string[] {
  if (!tags?.length) return []
  const out: string[] = []
  for (const item of tags) {
    const tag = coerceVideoResolutionTag(item)
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out
}

/**
 * catalog 已声明 resolutions 时，强制对齐 videoPricing.resolutions / default，
 * 避免本地脏 pricing（含 480P）盖过 catalog 单档。
 */
function alignVideoPricingToResolutions(
  pricing: VideoModelPricingMeta | undefined,
  resolutions: string[],
  preferredDefault?: string | null,
): VideoModelPricingMeta | undefined {
  if (!pricing) return undefined
  if (!resolutions.length) return pricing

  const preferred = coerceVideoResolutionTag(preferredDefault)
  const existing = coerceVideoResolutionTag(pricing.defaultResolution)
  const defaultResolution =
    (preferred && resolutions.includes(preferred) ? preferred : null) ??
    (existing && resolutions.includes(existing) ? existing : null) ??
    resolutions[0]

  return {
    ...pricing,
    resolutions: [...resolutions],
    defaultResolution,
  }
}

/**
 * 自定义「微视API」能力常落后于 /client/models。
 * 按 upstream model 叠后台 resolutions / ratios / durations / reference_modes 等，
 * 避免本地脏档或抹掉服务端能力字段。
 * systemVideoModels 须含内部微视（不要用 filterSystemModelsForSelect 后的列表）。
 */
export function applyWeishiCatalogCapabilities(
  model: ModelConfig,
  systemVideoModels: ModelConfig[],
): ModelConfig {
  if (!isWeishiApiModel(model)) return model
  const upstreamId = model.model?.trim()
  if (!upstreamId) return model

  const catalog = findWeishiSystemModelByUpstreamId(systemVideoModels, upstreamId)
  if (!catalog) return model

  const catalogResolutions = normalizeResolutionList(catalog.resolutions)
  const resolutions = catalogResolutions.length
    ? catalogResolutions
    : model.resolutions

  const basePricing = catalog.videoPricing ?? model.videoPricing
  const videoPricing =
    catalogResolutions.length > 0
      ? alignVideoPricingToResolutions(
          basePricing,
          catalogResolutions,
          catalog.videoPricing?.defaultResolution ?? catalogResolutions[0],
        )
      : basePricing

  const catalogRatios = Array.isArray(catalog.ratios) ? catalog.ratios.filter(Boolean) : []
  const catalogDurations = Array.isArray(catalog.durations)
    ? catalog.durations.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : []
  const catalogReferenceModes = Array.isArray(catalog.referenceModes)
    ? catalog.referenceModes.map((item) => String(item).trim()).filter(Boolean)
    : []

  return {
    ...model,
    ratios: catalogRatios.length ? [...catalogRatios] : model.ratios,
    defaultRatio: catalogRatios.length
      ? catalog.defaultRatio ?? model.defaultRatio
      : model.defaultRatio ?? catalog.defaultRatio,
    durations: catalogDurations.length ? [...catalogDurations] : model.durations,
    defaultDurationSec: catalogDurations.length
      ? catalog.defaultDurationSec ?? model.defaultDurationSec
      : model.defaultDurationSec ?? catalog.defaultDurationSec,
    /** 本地不得抹掉服务端 reference_modes（G4） */
    referenceModes: catalogReferenceModes.length
      ? [...catalogReferenceModes]
      : model.referenceModes,
    defaultReferenceMode: catalogReferenceModes.length
      ? catalog.defaultReferenceMode ?? model.defaultReferenceMode
      : model.defaultReferenceMode ?? catalog.defaultReferenceMode,
    resolutions: resolutions?.length ? [...resolutions] : model.resolutions,
    videoPricing,
    uploadByUrl: catalog.uploadByUrl ?? model.uploadByUrl,
    weishiAssetWhitelistEnabled:
      catalog.weishiAssetWhitelistEnabled ?? model.weishiAssetWhitelistEnabled,
  }
}

/** 合并列表后：对自定义微视叠一层完整 video catalog */
export function overlayWeishiCapabilitiesOnMergedVideoModels(
  models: ModelConfig[],
  fullSystemVideoModels: ModelConfig[],
): ModelConfig[] {
  if (!fullSystemVideoModels.length) return models
  return models.map((model) => {
    if (model.source === 'system') return model
    return applyWeishiCatalogCapabilities(model, fullSystemVideoModels)
  })
}

function sameResolutionList(a?: string[] | null, b?: string[] | null): boolean {
  const left = normalizeResolutionList(a ?? undefined)
  const right = normalizeResolutionList(b ?? undefined)
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function weishiResolutionFieldsEqual(a: ModelConfig, b: ModelConfig): boolean {
  return (
    sameResolutionList(a.resolutions, b.resolutions) &&
    sameResolutionList(a.videoPricing?.resolutions, b.videoPricing?.resolutions) &&
    coerceVideoResolutionTag(a.videoPricing?.defaultResolution) ===
      coerceVideoResolutionTag(b.videoPricing?.defaultResolution)
  )
}

/**
 * 落盘迁移：自定义/内置微视配置去掉历史假档 480P（接口未下发时本地常误存 480+720）。
 * 不碰其它字段；清空后回退到 WEISHI_API_PRESET。
 */
export function sanitizeStoredWeishiVideoModels(models: ModelConfig[]): ModelConfig[] {
  const fallback = normalizeResolutionList(WEISHI_API_PRESET.resolutions)
  const presetResolutions = fallback.length > 0 ? fallback : ['720P']

  return models.map((model) => {
    if (!isWeishiApiModel(model) || model.source === 'system') return model

    const fromModel = normalizeResolutionList(model.resolutions)
    const fromPricing = normalizeResolutionList(model.videoPricing?.resolutions)
    const source = fromModel.length > 0 ? fromModel : fromPricing
    const without480 = source.filter((item) => item !== '480P')
    const resolutions = without480.length > 0 ? without480 : [...presetResolutions]

    const pricingHad480 = fromPricing.includes('480P')
    const modelHad480 = fromModel.includes('480P')
    if (!modelHad480 && !pricingHad480 && sameResolutionList(model.resolutions, resolutions)) {
      return model
    }

    return {
      ...model,
      resolutions: [...resolutions],
      videoPricing: model.videoPricing
        ? alignVideoPricingToResolutions(
            model.videoPricing,
            resolutions,
            model.videoPricing.defaultResolution,
          )
        : model.videoPricing,
    }
  })
}

/** settings.json 磁盘侧是否仍含需清洗的微视假档（用于读配置时落盘） */
export function shouldPersistSanitizedWeishiVideoModels(
  diskModels: ModelConfig[] | undefined | null,
): boolean {
  if (!Array.isArray(diskModels) || diskModels.length === 0) return false
  const cleaned = sanitizeStoredWeishiVideoModels(diskModels)
  for (let i = 0; i < diskModels.length; i += 1) {
    const before = diskModels[i]
    const after = cleaned[i]
    if (!before || !after) continue
    if (!isWeishiApiModel(before) || before.source === 'system') continue
    if (!weishiResolutionFieldsEqual(before, after)) return true
  }
  return false
}

function sameStringList(a?: string[] | null, b?: string[] | null): boolean {
  const left = (a ?? []).map((item) => String(item))
  const right = (b ?? []).map((item) => String(item))
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function sameNumberList(a?: number[] | null, b?: number[] | null): boolean {
  const left = (a ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n))
  const right = (b ?? []).map((n) => Number(n)).filter((n) => Number.isFinite(n))
  if (left.length !== right.length) return false
  return left.every((item, index) => item === right[index])
}

function weishiCapabilityFieldsEqual(a: ModelConfig, b: ModelConfig): boolean {
  return (
    weishiResolutionFieldsEqual(a, b) &&
    sameStringList(a.ratios, b.ratios) &&
    sameNumberList(a.durations, b.durations) &&
    sameStringList(a.referenceModes, b.referenceModes) &&
    String(a.defaultRatio ?? '') === String(b.defaultRatio ?? '') &&
    (a.defaultDurationSec ?? null) === (b.defaultDurationSec ?? null) &&
    String(a.defaultReferenceMode ?? '') === String(b.defaultReferenceMode ?? '')
  )
}

/**
 * sync /client/models 后：把 catalog 清晰度与能力字段写回自定义微视，便于落盘。
 */
export function writeBackWeishiCatalogCapabilities(
  models: ModelConfig[],
  fullSystemVideoModels: ModelConfig[],
): { models: ModelConfig[]; changed: boolean } {
  if (!fullSystemVideoModels.length) {
    return { models, changed: false }
  }

  let changed = false
  const next = models.map((model) => {
    if (model.source === 'system' || !isWeishiApiModel(model)) return model
    const overlaid = applyWeishiCatalogCapabilities(model, fullSystemVideoModels)
    if (weishiCapabilityFieldsEqual(model, overlaid)) return model
    changed = true
    return overlaid
  })
  return { models: next, changed }
}
