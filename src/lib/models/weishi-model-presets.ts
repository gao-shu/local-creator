import type { ModelConfig, ModelKind } from '@/types/settings'
import { isLoginRequired } from '@/lib/auth/login-mode'
import { isCharacterRefItem, type ShotVideoReferenceItem } from '@/lib/workflow/shot-video-utils'
import { generateUUID } from '@/lib/utils'

/** 对齐 haode-ai-client Settings weishi_api 默认项 */
export const WEISHI_API_PRESET: Omit<ModelConfig, 'id'> = {
  name: '微视API',
  endpoint: 'http://115.191.9.56:3011/v1/videos',
  baseUrl: 'http://115.191.9.56:3011',
  apiKey: '',
  model: 'seedance-2.0',
  apiFormat: 'weishi_api',
  platform: 'openai_compatible',
  autoAppendV1: false,
  configMode: 'simple',
  ratios: ['16:9', '9:16'],
  durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  resolutions: ['720P'],
  uploadByUrl: true,
  weishiAssetWhitelistEnabled: true,
  remark: '角色审核走 /v1/assets；生视频：角色 asset://，场景/道具/音色 https',
}

export function createWeishiApiModel(kind: ModelKind = 'video'): ModelConfig {
  return {
    id: generateUUID(),
    ...WEISHI_API_PRESET,
    name: kind === 'image' ? '微视API' : WEISHI_API_PRESET.name,
  }
}

export function isWeishiApiModel(model?: Pick<ModelConfig, 'apiFormat'> | null): boolean {
  return String(model?.apiFormat || '')
    .trim()
    .toLowerCase() === 'weishi_api'
}

/** 是否走微视审核通道（apiFormat 为 weishi_api 的模型配置） */
export function isWeishiReviewModel(
  model?: Pick<ModelConfig, 'apiFormat'> | null,
): boolean {
  return isWeishiApiModel(model)
}

/** 微视生视频参考素材上传方式 */
export type WeishiReferenceMediaUploadMode = 'weishi_asset' | 'backend_https'

export const DEFAULT_WEISHI_REFERENCE_MEDIA_UPLOAD_MODE: WeishiReferenceMediaUploadMode =
  'weishi_asset'

export const WEISHI_REFERENCE_MEDIA_UPLOAD_OPTIONS: Array<{
  value: WeishiReferenceMediaUploadMode
  label: string
}> = [
  { value: 'weishi_asset', label: '微视 /v1/assets（asset://）' },
  { value: 'backend_https', label: '后台服务器（https 公网 URL）' },
]

export function normalizeWeishiReferenceMediaUploadMode(
  value?: string | null,
): WeishiReferenceMediaUploadMode {
  if (WEISHI_REFERENCE_MEDIA_UPLOAD_OPTIONS.some((item) => item.value === value)) {
    return value as WeishiReferenceMediaUploadMode
  }
  return DEFAULT_WEISHI_REFERENCE_MEDIA_UPLOAD_MODE
}

/** 非微视模型或兜底：读取系统设置的上传策略 */
export function resolveEffectiveWeishiReferenceMediaUploadMode(
  value?: string | null,
  model?: Pick<ModelConfig, 'apiFormat'> | null,
): WeishiReferenceMediaUploadMode {
  if (model && isWeishiApiModel(model)) {
    return 'backend_https'
  }
  if (!isLoginRequired()) return 'weishi_asset'
  return normalizeWeishiReferenceMediaUploadMode(value)
}

/** 微视生视频参考图：仅 @角色 → /v1/assets；分镜/场景/道具/参考槽 → 后台 https */
export function resolveWeishiReferenceImageUploadMode(
  item: Pick<ShotVideoReferenceItem, 'kind' | 'label'>,
  model?: Pick<ModelConfig, 'apiFormat'> | null,
  globalMode?: string | null,
): WeishiReferenceMediaUploadMode {
  if (model && isWeishiApiModel(model)) {
    return isCharacterRefItem(item) ? 'weishi_asset' : 'backend_https'
  }
  return resolveEffectiveWeishiReferenceMediaUploadMode(globalMode, model)
}

/** 微视生视频参考音频：一律走后台 https */
export function resolveWeishiReferenceAudioUploadMode(
  model?: Pick<ModelConfig, 'apiFormat'> | null,
  globalMode?: string | null,
): WeishiReferenceMediaUploadMode {
  if (model && isWeishiApiModel(model)) return 'backend_https'
  return resolveEffectiveWeishiReferenceMediaUploadMode(globalMode, model)
}

/** 微视 API 分镜生视频可选时长（秒） */
export const WEISHI_VIDEO_DURATION_SEC_MIN = 4
export const WEISHI_VIDEO_DURATION_SEC_MAX = 15

export const WEISHI_VIDEO_DURATION_OPTIONS: Array<{ value: string; label: string }> = Array.from(
  { length: WEISHI_VIDEO_DURATION_SEC_MAX - WEISHI_VIDEO_DURATION_SEC_MIN + 1 },
  (_, index) => {
    const sec = WEISHI_VIDEO_DURATION_SEC_MIN + index
    return { value: String(sec), label: `${sec}秒` }
  },
)

export function clampWeishiVideoDurationSec(durationSec?: number | null): number {
  const n = Number(durationSec)
  if (!Number.isFinite(n)) return WEISHI_VIDEO_DURATION_SEC_MIN
  return Math.min(
    WEISHI_VIDEO_DURATION_SEC_MAX,
    Math.max(WEISHI_VIDEO_DURATION_SEC_MIN, Math.round(n)),
  )
}

/** 微视生视频时长：优先 UI 选择，不读模型配置 durations */
export function pickWeishiVideoDurationSec(durationSec?: number | null): number {
  if (durationSec != null && Number.isFinite(Number(durationSec))) {
    return clampWeishiVideoDurationSec(durationSec)
  }
  return WEISHI_VIDEO_DURATION_SEC_MIN
}

/** Step4 分辨率下拉（480/720/1080）→ 微视 metadata.resolution */
export function formatWeishiVideoMetadataResolution(
  resolution?: string | null,
): string | undefined {
  const text = String(resolution ?? '')
    .trim()
    .replace(/p$/i, '')
  if (!text) return undefined
  const num = Number(text)
  if (!Number.isFinite(num) || num <= 0) return undefined
  if (num >= 1080) return '1080p'
  if (num >= 720) return '720p'
  return '480p'
}
