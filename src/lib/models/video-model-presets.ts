import type { ModelConfig } from '@/types/settings'
import { generateUUID } from '@/lib/utils'
import { WEISHI_API_PRESET } from '@/lib/models/weishi-model-presets'

export type VideoPresetKey =
  | 'zhipu'
  | 'grok'
  | 'openai_videos'
  | 'seedance_2'
  | 'weishi_api'
  | 'openai_compatible'
  | 'agnes_video_25_flash'

export interface VideoPresetDefinition {
  key: VideoPresetKey
  label: string
  hint: string
  description: string
  apiFormat: string
  platform: string
  endpoint: string
  baseUrl?: string
  model: string
  autoAppendV1: boolean
  configMode?: 'simple' | 'advanced'
  defaultName: string
  ratios?: string[]
  durations?: number[]
  resolutions?: string[]
  referenceModes?: string[]
  defaultReferenceMode?: string
  uploadByUrl?: boolean
  weishiAssetWhitelistEnabled?: boolean
}

const SEEDANCE_2_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'

/** 自定义/通用视频模型默认画面比例 / 时长 / 分辨率（设置页标签默认值；保存前不可为空） */
export const DEFAULT_CUSTOM_VIDEO_RATIOS = ['16:9', '9:16', '1:1'] as const
export const DEFAULT_CUSTOM_VIDEO_DURATIONS = [5, 10, 15] as const
export const DEFAULT_CUSTOM_VIDEO_RESOLUTIONS = ['360P', '720P', '1080P'] as const

/** OpenAI 兼容 / Videos：画布时长滑轨 1–30 秒，默认 5 秒（对齐 Seedance 滑轨交互） */
export const OPENAI_COMPAT_VIDEO_DURATION_SEC_MIN = 1
export const OPENAI_COMPAT_VIDEO_DURATION_SEC_MAX = 30
export const OPENAI_COMPAT_VIDEO_DEFAULT_DURATION_SEC = 5
export const OPENAI_COMPAT_VIDEO_DURATIONS: number[] = Array.from(
  {
    length:
      OPENAI_COMPAT_VIDEO_DURATION_SEC_MAX - OPENAI_COMPAT_VIDEO_DURATION_SEC_MIN + 1,
  },
  (_, index) => OPENAI_COMPAT_VIDEO_DURATION_SEC_MIN + index,
)

/** 对齐 haode-ai-client Settings 视频六项预设（无 Cool / fjyw 等） */
export const VIDEO_MODEL_PRESETS: Record<VideoPresetKey, VideoPresetDefinition> = {
  zhipu: {
    key: 'zhipu',
    label: '智谱 CogVideoX',
    hint: 'cogvideox-flash / cogvideox-3',
    description: 'https://open.bigmodel.cn/api/paas/v4/videos/generations',
    apiFormat: 'zhipu',
    platform: 'openai_compatible',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/videos/generations',
    model: 'cogvideox-flash',
    autoAppendV1: false,
    configMode: 'advanced',
    defaultName: '智谱 CogVideoX-Flash',
    ratios: [...DEFAULT_CUSTOM_VIDEO_RATIOS],
    durations: [...DEFAULT_CUSTOM_VIDEO_DURATIONS],
    resolutions: [...DEFAULT_CUSTOM_VIDEO_RESOLUTIONS],
  },
  grok: {
    key: 'grok',
    label: 'Grok Imagine Video',
    hint: 'xAI / 中转 · grok-imagine-video',
    description: '填写根域名，自动拼接 /v1/videos/generations（官方 https://api.x.ai）',
    apiFormat: 'grok',
    platform: 'openai_compatible',
    endpoint: '',
    model: 'grok-imagine-video',
    autoAppendV1: true,
    configMode: 'advanced',
    defaultName: 'Grok Imagine Video',
    ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '3:2', '2:3'],
    durations: [5, 8, 10, 15],
    resolutions: ['480p', '720p', '1080p'],
  },
  openai_videos: {
    key: 'openai_videos',
    label: 'OpenAI Videos',
    hint: 'sora-2（推荐）',
    description: 'https://api.openai.com/v1/videos（异步：POST 取 id → GET 轮询）',
    apiFormat: 'openai_videos',
    platform: 'openai_compatible',
    endpoint: 'https://api.openai.com/v1/videos',
    model: 'sora-2',
    autoAppendV1: false,
    configMode: 'advanced',
    defaultName: 'OpenAI Videos',
    ratios: [...DEFAULT_CUSTOM_VIDEO_RATIOS],
    durations: [...OPENAI_COMPAT_VIDEO_DURATIONS],
    resolutions: [...DEFAULT_CUSTOM_VIDEO_RESOLUTIONS],
  },
  seedance_2: {
    key: 'seedance_2',
    label: '官方seedance2.0 api',
    hint: '火山 Ark 官方接口',
    description: SEEDANCE_2_ENDPOINT,
    apiFormat: 'seedance_2',
    platform: 'volcengine',
    endpoint: SEEDANCE_2_ENDPOINT,
    model: 'seedance-2.0',
    autoAppendV1: false,
    configMode: 'advanced',
    ratios: ['16:9', '9:16'],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    resolutions: ['480P', '720P', '1080P'],
    defaultName: '官方seedance2.0 api',
  },
  weishi_api: {
    key: 'weishi_api',
    label: '微视API',
    hint: 'Seedance 多参数封装',
    description: WEISHI_API_PRESET.endpoint || '',
    apiFormat: 'weishi_api',
    platform: 'openai_compatible',
    endpoint: WEISHI_API_PRESET.endpoint || '',
    baseUrl: WEISHI_API_PRESET.baseUrl,
    model: WEISHI_API_PRESET.model || 'seedance-2.0',
    autoAppendV1: false,
    configMode: 'simple',
    ratios: [...(WEISHI_API_PRESET.ratios ?? [])],
    durations: [...(WEISHI_API_PRESET.durations ?? [])],
    resolutions: [...(WEISHI_API_PRESET.resolutions ?? [])],
    uploadByUrl: WEISHI_API_PRESET.uploadByUrl,
    weishiAssetWhitelistEnabled: WEISHI_API_PRESET.weishiAssetWhitelistEnabled,
    defaultName: WEISHI_API_PRESET.name,
  },
  openai_compatible: {
    key: 'openai_compatible',
    label: 'OpenAI 兼容（中转站）',
    hint: '填写根域名',
    description: '填写根域名，自动拼接 /v1/videos（异步创建+轮询；勿用 /videos/generations 同步口）',
    apiFormat: 'openai',
    platform: 'openai_compatible',
    endpoint: '',
    model: '',
    autoAppendV1: true,
    configMode: 'advanced',
    defaultName: 'OpenAI兼容',
    ratios: [...DEFAULT_CUSTOM_VIDEO_RATIOS],
    durations: [...OPENAI_COMPAT_VIDEO_DURATIONS],
    resolutions: [...DEFAULT_CUSTOM_VIDEO_RESOLUTIONS],
  },
  agnes_video_25_flash: {
    key: 'agnes_video_25_flash',
    label: 'Agnes Video 2.5 Flash',
    hint: 'agnes-video-2.5-flash · 直连 apihub',
    description: 'https://apihub.agnes-ai.com/v1/videos（轮询 /agnesapi）',
    apiFormat: 'agnes_video_25',
    platform: 'openai_compatible',
    endpoint: 'https://apihub.agnes-ai.com/v1/videos',
    baseUrl: 'https://apihub.agnes-ai.com',
    model: 'agnes-video-2.5-flash',
    autoAppendV1: false,
    configMode: 'advanced',
    defaultName: 'Agnes Video 2.5 Flash',
    ratios: ['16:9', '9:16', '1:1', '4:3', '3:4', '21:9'],
    durations: [4, 5, 6, 7, 8, 9, 10, 11, 12],
    resolutions: ['720P'],
    referenceModes: ['text_to_video', 'first_frame', 'first_last_frame', 'multimodal'],
    defaultReferenceMode: 'text_to_video',
  },
}

export const VIDEO_PRESET_LIST = Object.values(VIDEO_MODEL_PRESETS)

/** 添加模型弹窗可选预设（微视 API 由外部独立入口创建） */
export const VIDEO_PRESET_PICKER_LIST = VIDEO_PRESET_LIST.filter((preset) => preset.key !== 'weishi_api')

export function resolveVideoPresetKey(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'endpoint' | 'model' | 'name'> | null,
): VideoPresetKey {
  const apiFormat = String(model?.apiFormat || '').trim().toLowerCase()
  if (apiFormat === 'zhipu') return 'zhipu'
  if (apiFormat === 'grok') return 'grok'
  if (apiFormat === 'weishi_api') return 'weishi_api'
  if (apiFormat === 'openai_videos' || apiFormat === 'openai_generations') return 'openai_videos'
  if (apiFormat === 'seedance_2') return 'seedance_2'
  if (apiFormat === 'agnes_video_25' || apiFormat === 'agnes_video_25_flash') {
    return 'agnes_video_25_flash'
  }
  const modelId = `${model?.model || ''} ${model?.name || ''}`.toLowerCase()
  if (modelId.includes('agnes-video-2.5') || modelId.includes('agnes video 2.5')) {
    return 'agnes_video_25_flash'
  }
  if (modelId.includes('grok-imagine-video')) return 'grok'
  const endpoint = String(model?.endpoint || '').trim()
  if (
    apiFormat === 'openai' &&
    (model?.platform === 'openai_compatible' || !endpoint) &&
    !endpoint.includes('api.openai.com')
  ) {
    return 'openai_compatible'
  }
  if (endpoint.includes('contents/generations/tasks')) return 'seedance_2'
  return 'openai_videos'
}

export function getVideoPresetLabel(
  model?: Pick<ModelConfig, 'apiFormat' | 'platform' | 'endpoint' | 'name'> | null,
): string {
  if (!model) return 'OpenAI Videos'
  const apiFormat = String(model.apiFormat || '').trim().toLowerCase()
  if (apiFormat === 'zhipu') return '智谱视频'
  if (apiFormat === 'grok') return 'Grok Imagine Video'
  return VIDEO_MODEL_PRESETS[resolveVideoPresetKey(model)]?.label ?? model.name ?? 'OpenAI Videos'
}

export function buildVideoPresetPatch(
  key: VideoPresetKey,
  options?: { keepName?: boolean; name?: string },
): Partial<ModelConfig> {
  const preset = VIDEO_MODEL_PRESETS[key]
  return {
    apiFormat: preset.apiFormat,
    platform: preset.platform,
    endpoint: preset.endpoint,
    baseUrl: preset.baseUrl,
    model: preset.model,
    autoAppendV1: preset.autoAppendV1,
    configMode: preset.configMode,
    ratios: preset.ratios?.length ? [...preset.ratios] : [...DEFAULT_CUSTOM_VIDEO_RATIOS],
    durations: preset.durations?.length
      ? [...preset.durations]
      : [...DEFAULT_CUSTOM_VIDEO_DURATIONS],
    resolutions: preset.resolutions?.length
      ? [...preset.resolutions]
      : [...DEFAULT_CUSTOM_VIDEO_RESOLUTIONS],
    uploadByUrl: preset.uploadByUrl,
    weishiAssetWhitelistEnabled: preset.weishiAssetWhitelistEnabled,
    referenceModes: preset.referenceModes?.length ? [...preset.referenceModes] : undefined,
    defaultReferenceMode: preset.defaultReferenceMode,
    name: options?.keepName ? options.name : options?.name || preset.defaultName,
  }
}

export function createVideoPresetModel(key: VideoPresetKey, options?: { name?: string }): ModelConfig {
  const preset = VIDEO_MODEL_PRESETS[key]
  const durations = preset.durations?.length
    ? [...preset.durations]
    : [...DEFAULT_CUSTOM_VIDEO_DURATIONS]
  const isOpenAiCompat = preset.apiFormat === 'openai' || preset.apiFormat === 'openai_videos'
  return {
    id: generateUUID(),
    name: options?.name || preset.defaultName,
    apiFormat: preset.apiFormat,
    platform: preset.platform,
    endpoint: preset.endpoint,
    baseUrl: preset.baseUrl,
    apiKey: '',
    model: preset.model,
    autoAppendV1: preset.autoAppendV1,
    configMode: preset.configMode,
    ratios: preset.ratios?.length ? [...preset.ratios] : [...DEFAULT_CUSTOM_VIDEO_RATIOS],
    durations,
    resolutions: preset.resolutions?.length
      ? [...preset.resolutions]
      : [...DEFAULT_CUSTOM_VIDEO_RESOLUTIONS],
    uploadByUrl: preset.uploadByUrl,
    weishiAssetWhitelistEnabled: preset.weishiAssetWhitelistEnabled,
    referenceModes: preset.referenceModes?.length ? [...preset.referenceModes] : undefined,
    defaultReferenceMode: preset.defaultReferenceMode,
    ...(isOpenAiCompat
      ? { defaultDurationSec: OPENAI_COMPAT_VIDEO_DEFAULT_DURATION_SEC }
      : {}),
  }
}
