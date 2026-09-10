/**
 * 视频能力解析（与计价分离）
 * 契约：上游 admin docs/design/video-model-capability.md · B0 / §5.2 / §9
 */

import type { ModelConfig } from '@/types/settings'
import {
  normalizeVideoAspectValue,
  normalizeVideoDurationValue,
  normalizeVideoReferenceMode,
  normalizeVideoResolutionValue,
  resolveVideoResolutionOptions,
  VIDEO_REFERENCE_MODE_LABELS,
  VIDEO_REFERENCE_MODE_ORDER,
  type VideoReferenceMode,
} from '@/lib/workflow/storyboard-video-presets'

/** 读兜底：旧模型无 ratios（与后台 ensure_default 对齐） */
export const VIDEO_CAPABILITY_FALLBACK_RATIOS = ['16:9'] as const

/** 读兜底：旧模型无 durations */
export const VIDEO_CAPABILITY_FALLBACK_DURATIONS = [5] as const

/**
 * 读兜底：旧模型无 reference_modes。
 * 不含 first_last_frame，兼容现网「首尾帧全局不可用」。
 */
export const VIDEO_CAPABILITY_FALLBACK_REFERENCE_MODES: readonly VideoReferenceMode[] = [
  'multimodal',
  'first_frame',
  'text_to_video',
] as const

export type VideoCapabilityOption = { value: string; label: string }

export type VideoCapabilityResolved = {
  ratios: VideoCapabilityOption[]
  defaultRatio: string
  resolutions: VideoCapabilityOption[]
  defaultResolution: string
  durations: VideoCapabilityOption[]
  defaultDurationSec: number
  referenceModes: Array<{ value: VideoReferenceMode; label: string }>
  defaultReferenceMode: VideoReferenceMode
}

function isVideoReferenceMode(value: string): value is VideoReferenceMode {
  return (VIDEO_REFERENCE_MODE_ORDER as readonly string[]).includes(value)
}

/** 从模型开放列表解析参考模式；缺省走读兜底（无首尾帧） */
export function resolveVideoReferenceModeOptions(
  model?: Pick<ModelConfig, 'referenceModes'> | null,
): Array<{ value: VideoReferenceMode; label: string }> {
  const raw = Array.isArray(model?.referenceModes)
    ? model.referenceModes.map((item) => String(item).trim()).filter(Boolean)
    : []
  const filtered: VideoReferenceMode[] = []
  for (const item of raw) {
    if (item === 'text_only') continue
    if (isVideoReferenceMode(item) && !filtered.includes(item)) {
      filtered.push(item)
    }
  }
  const ordered =
    filtered.length > 0
      ? VIDEO_REFERENCE_MODE_ORDER.filter((mode) => filtered.includes(mode))
      : [...VIDEO_CAPABILITY_FALLBACK_REFERENCE_MODES]
  return ordered.map((value) => ({
    value,
    label: VIDEO_REFERENCE_MODE_LABELS[value],
  }))
}

export function normalizeVideoReferenceModeForModel(
  value?: string | null,
  model?: Pick<ModelConfig, 'referenceModes' | 'defaultReferenceMode'> | null,
): VideoReferenceMode {
  const options = resolveVideoReferenceModeOptions(model)
  const allowed = new Set(options.map((item) => item.value))
  const preferred = String(value || '').trim()
  if (preferred === 'text_only') {
    // 与 normalizeVideoReferenceMode 一致：落到默认
  } else if (preferred && isVideoReferenceMode(preferred) && allowed.has(preferred)) {
    return preferred
  }
  const modelDefault = String(model?.defaultReferenceMode || '').trim()
  if (modelDefault && isVideoReferenceMode(modelDefault) && allowed.has(modelDefault)) {
    return modelDefault
  }
  return options[0]?.value ?? 'multimodal'
}

function resolveRatioOptions(model?: ModelConfig | null): VideoCapabilityOption[] {
  const fromModel = Array.isArray(model?.ratios)
    ? model.ratios.map((item) => String(item).trim()).filter(Boolean)
    : []
  if (fromModel.length > 0) {
    return [...new Set(fromModel)].map((value) => ({ value, label: value }))
  }
  return VIDEO_CAPABILITY_FALLBACK_RATIOS.map((value) => ({ value, label: value }))
}

function resolveDurationOptions(model?: ModelConfig | null): VideoCapabilityOption[] {
  const fromModel = Array.isArray(model?.durations)
    ? model.durations
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= 600)
    : []
  if (fromModel.length > 0) {
    return [...new Set(fromModel)]
      .sort((a, b) => a - b)
      .map((sec) => ({ value: String(sec), label: `${sec}秒` }))
  }
  return VIDEO_CAPABILITY_FALLBACK_DURATIONS.map((sec) => ({
    value: String(sec),
    label: `${sec}秒`,
  }))
}

function pickFromOptions(raw: string | null | undefined, options: VideoCapabilityOption[]): string {
  const trimmed = String(raw || '').trim()
  if (trimmed && options.some((item) => item.value === trimmed)) return trimmed
  return options[0]?.value ?? ''
}

/**
 * 统一四维能力解析：选项 + 默认值。
 * 缺字段读兜底对齐后台 §5.2；清晰度仍委托现有 tier resolve。
 */
export function resolveVideoCapability(model?: ModelConfig | null): VideoCapabilityResolved {
  const ratios = resolveRatioOptions(model)
  const durations = resolveDurationOptions(model)
  const resolutionOptions = resolveVideoResolutionOptions(model)
  const referenceModes = resolveVideoReferenceModeOptions(model)

  const defaultRatio = pickFromOptions(model?.defaultRatio, ratios) || '16:9'

  const defaultDurationRaw =
    model?.defaultDurationSec !== undefined && model.defaultDurationSec !== null
      ? String(model.defaultDurationSec)
      : undefined
  const defaultDurationValue =
    pickFromOptions(defaultDurationRaw, durations) || durations[0]?.value || '5'
  const defaultDurationSec = Number(defaultDurationValue) || 5

  const resolutions = resolutionOptions.map((item) => ({
    value: item.value,
    label: item.label,
  }))
  const defaultResolution =
    resolutionOptions.length > 0
      ? normalizeVideoResolutionValue(
          model?.videoPricing?.defaultResolution ?? resolutions[0]?.value,
          model,
        )
      : normalizeVideoResolutionValue(model?.videoPricing?.defaultResolution ?? '720P', model)

  const defaultReferenceMode = normalizeVideoReferenceModeForModel(
    model?.defaultReferenceMode,
    model,
  )

  return {
    ratios,
    defaultRatio,
    resolutions,
    defaultResolution,
    durations,
    defaultDurationSec,
    referenceModes,
    defaultReferenceMode,
  }
}


/** 当前选中值是否在模型开放列表中（模式） */
export function isVideoReferenceModeOpen(
  mode: VideoReferenceMode | string | null | undefined,
  model?: Pick<ModelConfig, 'referenceModes'> | null,
): boolean {
  if (!mode) return false
  return resolveVideoReferenceModeOptions(model).some((item) => item.value === mode)
}

/**
 * 当前模式对本模型是否不可用。
 * F3：按 `referenceModes` 判断，不再全局写死拦截首尾帧。
 * 无 model / 无 referenceModes 时走读兜底（不含 first_last_frame）。
 */
export function getUnsupportedVideoReferenceModeMessage(
  mode: VideoReferenceMode | string | null | undefined,
  model?: Pick<ModelConfig, 'referenceModes' | 'defaultReferenceMode'> | null,
): string | null {
  if (!mode) return null
  if (isVideoReferenceModeOpen(mode, model)) return null
  const key = String(mode).trim()
  const label =
    isVideoReferenceMode(key) && key in VIDEO_REFERENCE_MODE_LABELS
      ? VIDEO_REFERENCE_MODE_LABELS[key as VideoReferenceMode]
      : key
  return `当前模型不支持「${label}」`
}

export function pickDefaultVideoReferenceMode(
  model?: Pick<ModelConfig, 'referenceModes' | 'defaultReferenceMode'> | null,
): VideoReferenceMode {
  return normalizeVideoReferenceModeForModel(model?.defaultReferenceMode, model)
}

/** 将全局 normalize 后的模式限制到本模型开放列表 */
export function clampVideoReferenceMode(
  value?: string | null,
  model?: Pick<ModelConfig, 'referenceModes' | 'defaultReferenceMode'> | null,
): VideoReferenceMode {
  const normalized = normalizeVideoReferenceMode(value)
  return normalizeVideoReferenceModeForModel(normalized, model)
}

/** 换模型：四维当前值落入新模型开放列表（否则 → 默认/首项） */
export function normalizeVideoCapabilitySelection(
  model?: ModelConfig | null,
  current?: {
    referenceMode?: string | null
    durationSec?: number | string | null
    aspectRatio?: string | null
    resolution?: string | null
  } | null,
): {
  referenceMode: VideoReferenceMode
  durationSec: number
  aspectRatio: string
  resolution: string
} {
  const durationRaw =
    current?.durationSec !== undefined && current?.durationSec !== null
      ? String(current.durationSec)
      : ''
  return {
    referenceMode: clampVideoReferenceMode(current?.referenceMode, model),
    durationSec: Number(normalizeVideoDurationValue(durationRaw, model)) || 5,
    aspectRatio: normalizeVideoAspectValue(current?.aspectRatio, model),
    resolution: normalizeVideoResolutionValue(current?.resolution, model),
  }
}
