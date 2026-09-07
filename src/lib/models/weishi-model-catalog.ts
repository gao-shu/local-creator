// Copyright (c) local-creator. All rights reserved.

import type { ModelConfig } from '@/types/settings'
import { isWeishiApiModel, WEISHI_API_PRESET } from '@/lib/models/weishi-model-presets'
import { WEISHI_VIDEO_MODELS } from '@/lib/models/video-model-utils'
import { findWeishiSystemModelByUpstreamId } from '@/lib/models/weishi-capability-overlay'

export type WeishiVideoModelOption = {
  modelId: string
  label: string
}

export {
  applyWeishiCatalogCapabilities,
  findWeishiSystemModelByUpstreamId,
} from '@/lib/models/weishi-capability-overlay'

/** 设置里只展示 · 后的可读名 */
function formatWeishiVideoModelOptionLabel(model: ModelConfig, modelId: string): string {
  const displayName = model.name?.trim()
  if (!displayName) return modelId
  const dotIndex = displayName.indexOf('·')
  if (dotIndex >= 0) {
    const afterDot = displayName.slice(dotIndex + 1).trim()
    if (afterDot) return afterDot
  }
  return displayName !== modelId ? displayName : modelId
}

/** 从已配置的自定义视频模型中筛 weishi_api */
export function listWeishiVideoModelOptions(videoModels: ModelConfig[]): WeishiVideoModelOption[] {
  const seen = new Set<string>()
  const options: WeishiVideoModelOption[] = []

  for (const model of videoModels) {
    if (!isWeishiApiModel(model)) continue
    const modelId = model.model?.trim()
    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)
    options.push({
      modelId,
      label: formatWeishiVideoModelOptionLabel(model, modelId),
    })
  }

  return options.sort((a, b) => a.modelId.localeCompare(b.modelId, 'zh-CN'))
}

export function fallbackWeishiVideoModelOptions(): WeishiVideoModelOption[] {
  return WEISHI_VIDEO_MODELS.map((modelId) => ({ modelId, label: modelId }))
}

/** 开源版始终可用本地兜底列表 */
export function shouldUseWeishiVideoModelFallback(): boolean {
  return true
}

/** 优先已配置模型；否则硬编码兜底 */
export function resolveWeishiVideoModelOptions(videoModels: ModelConfig[]): WeishiVideoModelOption[] {
  const fromConfig = listWeishiVideoModelOptions(videoModels)
  if (fromConfig.length > 0) return fromConfig
  return fallbackWeishiVideoModelOptions()
}

/** 新建微视配置时默认选中的 upstream model */
export function resolveDefaultWeishiUpstreamModelId(videoModels: ModelConfig[]): string {
  const options = resolveWeishiVideoModelOptions(videoModels)
  return options[0]?.modelId?.trim() || WEISHI_API_PRESET.model?.trim() || 'seedance-2.0'
}

/** 保留编辑中的历史 model id */
export function ensureWeishiVideoModelOption(
  options: WeishiVideoModelOption[],
  currentModelId?: string | null,
): WeishiVideoModelOption[] {
  const current = currentModelId?.trim()
  if (!current || options.some((item) => item.modelId === current)) {
    return options
  }
  return [{ modelId: current, label: `${current}（已下架）` }, ...options]
}

/**
 * 用户自定义微视配置：从已有 catalog 条目同步能力字段；无则用预设
 */
export function buildWeishiCustomModelPatchFromCatalog(
  modelId: string,
  videoModels: ModelConfig[],
): Partial<ModelConfig> {
  const catalog = findWeishiSystemModelByUpstreamId(videoModels, modelId)
  if (!catalog) {
    return {
      model: modelId.trim(),
      configMode: 'simple',
      endpoint: WEISHI_API_PRESET.endpoint,
      baseUrl: WEISHI_API_PRESET.baseUrl,
      ratios: WEISHI_API_PRESET.ratios ? [...WEISHI_API_PRESET.ratios] : undefined,
      durations: WEISHI_API_PRESET.durations ? [...WEISHI_API_PRESET.durations] : undefined,
      resolutions: WEISHI_API_PRESET.resolutions ? [...WEISHI_API_PRESET.resolutions] : undefined,
      uploadByUrl: WEISHI_API_PRESET.uploadByUrl !== false,
      weishiAssetWhitelistEnabled: WEISHI_API_PRESET.weishiAssetWhitelistEnabled === true,
    }
  }

  return {
    model: modelId.trim(),
    configMode: 'simple',
    endpoint: catalog.endpoint,
    baseUrl: catalog.baseUrl,
    ratios: catalog.ratios?.length ? [...catalog.ratios] : undefined,
    defaultRatio: catalog.defaultRatio,
    durations: catalog.durations?.length ? [...catalog.durations] : undefined,
    defaultDurationSec: catalog.defaultDurationSec,
    referenceModes: catalog.referenceModes?.length ? [...catalog.referenceModes] : undefined,
    defaultReferenceMode: catalog.defaultReferenceMode,
    resolutions: catalog.resolutions?.length ? [...catalog.resolutions] : undefined,
    uploadByUrl: catalog.uploadByUrl !== false,
    weishiAssetWhitelistEnabled: catalog.weishiAssetWhitelistEnabled === true,
    videoPricing: catalog.videoPricing,
  }
}
