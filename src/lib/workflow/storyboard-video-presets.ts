/** 视频参考模式（对齐 weifan-ai-ts / 画镜参考产品） */
import type { ModelConfig } from '@/types/settings'
import {
  DEFAULT_CUSTOM_VIDEO_DURATIONS,
  DEFAULT_CUSTOM_VIDEO_RATIOS,
  OPENAI_COMPAT_VIDEO_DEFAULT_DURATION_SEC,
  OPENAI_COMPAT_VIDEO_DURATIONS,
} from '@/lib/models/video-model-presets'
import {
  normalizeVideoResolutionValue as normalizeTierVideoResolution,
  resolveVideoResolutionOptions as resolveTierVideoResolutionOptions,
  shouldShowVideoResolutionSelector,
} from '@/lib/models/video-generation-tier-params'

export { shouldShowVideoResolutionSelector }

export type VideoReferenceMode =
  | 'multimodal'
  | 'first_frame'
  | 'first_last_frame'
  | 'text_to_video'

/** 下拉展示候选序；实际可选集按模型 `referenceModes`（见 resolveVideoCapability） */
export const VIDEO_REFERENCE_MODE_UI_ORDER: VideoReferenceMode[] = [
  'multimodal',
  'first_frame',
  'first_last_frame',
]

export const VIDEO_REFERENCE_MODE_ORDER: VideoReferenceMode[] = [
  ...VIDEO_REFERENCE_MODE_UI_ORDER,
  'text_to_video',
]

export const VIDEO_REFERENCE_MODE_LABELS: Record<VideoReferenceMode, string> = {
  multimodal: '全能多参',
  first_frame: '首帧图参考',
  first_last_frame: '首尾帧',
  text_to_video: '文生视频',
}

export const VIDEO_REFERENCE_MODE_HINTS: Record<VideoReferenceMode, string> = {
  multimodal: '会同时传入当前分镜图、提示词 @ 引用的资产图，以及本镜上传的参考图。',
  first_frame: '分镜图作首帧，@ 资产与参考图一并作为 reference_image 上传。',
  first_last_frame: '分镜图作首帧，尾帧参考图作结束帧（仅模型开放时可用）。',
  text_to_video: '当前模式会直接使用文案生成视频。',
}

/** 平台枚举下拉全量（已过时：UI 请用 resolveVideoReferenceModeOptions(model)） */
export const VIDEO_REFERENCE_MODE_OPTIONS = VIDEO_REFERENCE_MODE_UI_ORDER.map((value) => ({
  value,
  label: VIDEO_REFERENCE_MODE_LABELS[value],
}))

export const DEFAULT_VIDEO_REFERENCE_MODE: VideoReferenceMode = 'multimodal'

export function normalizeVideoReferenceMode(value?: string | null): VideoReferenceMode {
  if (value === 'text_only') return DEFAULT_VIDEO_REFERENCE_MODE
  if (value === 'text_to_video') return 'text_to_video'
  if (value && VIDEO_REFERENCE_MODE_UI_ORDER.includes(value as VideoReferenceMode)) {
    return value as VideoReferenceMode
  }
  return DEFAULT_VIDEO_REFERENCE_MODE
}

export function getVideoReferenceModeHint(mode: VideoReferenceMode): string {
  return VIDEO_REFERENCE_MODE_HINTS[mode] ?? ''
}

/** @deprecated 自定义模型表单预设用；时长下拉请用 resolveVideoDurationOptions(model) */
export const VIDEO_DURATION_OPTIONS = DEFAULT_CUSTOM_VIDEO_DURATIONS.map((sec) => ({
  value: String(sec),
  label: `${sec}秒`,
}))

/** 读兜底：旧模型无 durations（对齐 capability §5.2） */
const VIDEO_DURATION_READ_FALLBACK = [5] as const

/** 读兜底：旧模型无 ratios（对齐 capability §5.2） */
const VIDEO_ASPECT_READ_FALLBACK = ['16:9'] as const

/** OpenAI 兼容协议：画布用 1–30 秒滑轨（与 Seedance 滑轨交互一致，默认 5 秒） */
export function isOpenAiCompatDurationSliderModel(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform'> | null,
): boolean {
  const fmt = String(model?.apiFormat || '')
    .trim()
    .toLowerCase()
  if (
    fmt === 'zhipu' ||
    fmt === 'seedance_2' ||
    fmt === 'grok'
  ) {
    return false
  }
  if (fmt === 'openai' || fmt === 'openai_videos' || fmt === 'openai_compatible') {
    return true
  }
  // 仅标了兼容平台、未填专用格式时，也按 OpenAI 兼容滑轨处理
  return String(model?.platform || '').trim().toLowerCase() === 'openai_compatible' && !fmt
}

const OPENAI_COMPAT_VIDEO_DURATION_OPTIONS: Array<{ value: string; label: string }> =
  OPENAI_COMPAT_VIDEO_DURATIONS.map((sec) => ({
    value: String(sec),
    label: `${sec}秒`,
  }))

/** 是否用时长滑轨（OpenAI 兼容 1–30 / 其它选项数 > 5） */
export function shouldUseVideoDurationSlider(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'durations'> | null,
): boolean {
  return resolveVideoDurationOptions(model).length > 5
}

/** 分镜生视频时长下拉：OpenAI 兼容固定滑轨列表；其它模型优先读后台 model.durations */
export function resolveVideoDurationOptions(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'durations'> | null,
): Array<{ value: string; label: string }> {
  if (isOpenAiCompatDurationSliderModel(model)) return OPENAI_COMPAT_VIDEO_DURATION_OPTIONS
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
  return VIDEO_DURATION_READ_FALLBACK.map((sec) => ({
    value: String(sec),
    label: `${sec}秒`,
  }))
}

export function normalizeVideoDurationValue(
  value: string,
  model?: Pick<
    ModelConfig,
    'apiFormat' | 'platform' | 'durations' | 'defaultDurationSec'
  > | null,
): string {
  const options = resolveVideoDurationOptions(model)
  if (value && options.some((item) => item.value === value)) return value
  const preferred =
    model?.defaultDurationSec !== undefined && model.defaultDurationSec !== null
      ? String(model.defaultDurationSec)
      : isOpenAiCompatDurationSliderModel(model)
        ? String(OPENAI_COMPAT_VIDEO_DEFAULT_DURATION_SEC)
        : ''
  if (preferred && options.some((item) => item.value === preferred)) return preferred
  if (isOpenAiCompatDurationSliderModel(model)) {
    const fallback = String(OPENAI_COMPAT_VIDEO_DEFAULT_DURATION_SEC)
    if (options.some((item) => item.value === fallback)) return fallback
  }
  return options[0]?.value ?? '5'
}

export const DEFAULT_VIDEO_RESOLUTION = '720P'

/** 分档模型用后台列表；无 videoPricing 时仅用 model.resolutions（有什么展示什么） */
export function resolveVideoResolutionOptions(
  model?: ModelConfig | null,
): Array<{ value: string; label: string; disabled?: boolean }> {
  return resolveTierVideoResolutionOptions(model).map((item) => ({
    value: item.value,
    label: item.label,
  }))
}

export function normalizeVideoResolutionValue(
  value?: string | null,
  model?: ModelConfig | null,
): string {
  return normalizeTierVideoResolution(value, model)
}

/** @deprecated 新建自定义模型预设用；UI 读兜底请走 resolveVideoAspectOptions */
export const VIDEO_ASPECT_OPTIONS = DEFAULT_CUSTOM_VIDEO_RATIOS.map((ratio) => ({
  value: ratio,
  label: ratio,
}))

/** 画面比例下拉：优先读后台 model.ratios；缺省读兜底仅 16:9（§5.2） */
export function resolveVideoAspectOptions(
  model?: Pick<ModelConfig, 'ratios'> | null,
): Array<{ value: string; label: string }> {
  const fromModel = Array.isArray(model?.ratios)
    ? model.ratios.map((item) => String(item).trim()).filter(Boolean)
    : []
  if (fromModel.length > 0) {
    return [...new Set(fromModel)].map((value) => ({ value, label: value }))
  }
  return VIDEO_ASPECT_READ_FALLBACK.map((value) => ({ value, label: value }))
}

export function normalizeVideoAspectValue(
  value?: string | null,
  model?: Pick<ModelConfig, 'ratios' | 'defaultRatio'> | null,
): string {
  const options = resolveVideoAspectOptions(model)
  const trimmed = String(value || '').trim()
  if (trimmed && options.some((item) => item.value === trimmed)) return trimmed
  const preferred = String(model?.defaultRatio || '').trim()
  if (preferred && options.some((item) => item.value === preferred)) return preferred
  return options[0]?.value ?? '16:9'
}

export interface StoryboardVideoGeneratePrefs {
  referenceMode: VideoReferenceMode
  duration: string
  aspectRatio: string
  resolution: string
}

/** 从 settings.json 恢复 Step4 生视频表单上次选用 */
export function resolveStoryboardVideoGeneratePrefs(
  settings?: {
    lastUsedStoryboardVideoReferenceMode?: string
    lastUsedStoryboardVideoDuration?: string
    lastUsedStoryboardVideoAspectRatio?: string
    lastUsedStoryboardVideoResolution?: string
  } | null,
  model?: ModelConfig | null,
): StoryboardVideoGeneratePrefs {
  const aspectRatio = normalizeVideoAspectValue(
    settings?.lastUsedStoryboardVideoAspectRatio,
    model,
  )
  const resolution = normalizeVideoResolutionValue(settings?.lastUsedStoryboardVideoResolution, model)

  return {
    referenceMode: normalizeVideoReferenceMode(settings?.lastUsedStoryboardVideoReferenceMode),
    duration: normalizeVideoDurationValue(
      settings?.lastUsedStoryboardVideoDuration ?? '',
      model,
    ),
    aspectRatio,
    resolution,
  }
}
