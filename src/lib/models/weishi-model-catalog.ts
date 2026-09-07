// Copyright (c) Haode AI. All rights reserved.

import type { BillingMode, ModelConfig } from '@/types/settings'
import { hasPersistedRealToken, isLoginRequired, isRealUserSession } from '@/lib/auth/login-mode'
import { useAuthStore } from '@/stores/auth-store'
import { isWeishiApiModel, WEISHI_API_PRESET } from '@/lib/models/weishi-model-presets'
import { WEISHI_VIDEO_MODELS } from '@/lib/models/video-model-utils'
import {
  findWeishiSystemModelByUpstreamId,
} from '@/lib/models/weishi-capability-overlay'

export type WeishiVideoModelOption = {
  modelId: string
  label: string
  billingMode?: BillingMode
}

export {
  applyWeishiCatalogCapabilities,
  findWeishiSystemModelByUpstreamId,
} from '@/lib/models/weishi-capability-overlay'

/** 系统模型名常为「内部·Seedance 2.0」，设置里只展示 · 后的可读名 */
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

/** 从 GET /client/models 同步的系统视频模型中筛 weishi_api（后台仅返回 enabled） */
export function listWeishiVideoModelOptions(systemVideoModels: ModelConfig[]): WeishiVideoModelOption[] {
  const seen = new Set<string>()
  const options: WeishiVideoModelOption[] = []

  for (const model of systemVideoModels) {
    if (!isWeishiApiModel(model)) continue
    const modelId = model.model?.trim()
    if (!modelId || seen.has(modelId)) continue
    seen.add(modelId)
    options.push({
      modelId,
      label: formatWeishiVideoModelOptionLabel(model, modelId),
      billingMode: model.billingMode,
    })
  }

  return options.sort((a, b) => a.modelId.localeCompare(b.modelId, 'zh-CN'))
}

export function fallbackWeishiVideoModelOptions(): WeishiVideoModelOption[] {
  return WEISHI_VIDEO_MODELS.map((modelId) => ({ modelId, label: modelId }))
}

/** 本地离线 / 未登录：允许硬编码兜底；真实登录 Session：仅信后台 catalog */
export function shouldUseWeishiVideoModelFallback(): boolean {
  try {
    if (!isLoginRequired()) return true
  } catch {
    return true
  }
  const token = useAuthStore.getState().token
  if (!token || !hasPersistedRealToken(token) || !isRealUserSession(token)) return true
  return false
}

/** 优先后台 catalog；登录态下无 weishi 系统模型时不回退硬编码 */
export function resolveWeishiVideoModelOptions(systemVideoModels: ModelConfig[]): WeishiVideoModelOption[] {
  const fromBackend = listWeishiVideoModelOptions(systemVideoModels)
  if (fromBackend.length > 0) return fromBackend
  if (shouldUseWeishiVideoModelFallback()) return fallbackWeishiVideoModelOptions()
  return []
}

/** 新建微视配置时默认选中的 upstream model（优先后台 catalog 首项） */
export function resolveDefaultWeishiUpstreamModelId(systemVideoModels: ModelConfig[]): string {
  const options = resolveWeishiVideoModelOptions(systemVideoModels)
  return options[0]?.modelId?.trim() || WEISHI_API_PRESET.model?.trim() || 'seedance-2.0'
}

/** 保留编辑中的历史 model id（可能已从后台下架） */
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
 * 用户自定义微视配置：从平台 catalog 同步 endpoint / 能力字段（设置页不展示，保存时写入）
 */
export function buildWeishiCustomModelPatchFromCatalog(
  modelId: string,
  systemVideoModels: ModelConfig[],
): Partial<ModelConfig> {
  const catalog = findWeishiSystemModelByUpstreamId(systemVideoModels, modelId)
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
