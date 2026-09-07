// Copyright (c) local-creator contributors. All rights reserved.

export type ScriptCreateUiStatus = 'empty' | 'generating' | 'result' | 'error'

export type ScriptContentType = 'manju_short' | 'voiceover' | 'twist_short'
export type ScriptDuration = '15s' | '60s' | '3min'
export type ScriptEpisodeCount = '1' | '3'
export type ScriptGenre = 'general' | 'sweet' | 'suspense' | 'comedy' | 'hotblood' | 'healing'
export type ScriptPlatform = 'douyin_vertical' | 'wechat_article'

export interface ScriptCreateParams {
  contentType: ScriptContentType
  duration: ScriptDuration
  episodeCount: ScriptEpisodeCount
  genre: ScriptGenre
  platform: ScriptPlatform
}

export interface ScriptCreateDraft {
  version: 1
  idea: string
  title: string
  script: string
  params: ScriptCreateParams
  updatedAt: number
}

export interface ScriptPreviewSummary {
  title: string
  hook: string
  durationHint: string
  sceneTitles: string[]
  characterNames: string[]
}

export const DEFAULT_SCRIPT_CREATE_PARAMS: ScriptCreateParams = {
  contentType: 'manju_short',
  duration: '60s',
  episodeCount: '1',
  genre: 'general',
  platform: 'douyin_vertical',
}

export const SCRIPT_CONTENT_TYPE_OPTIONS: Array<{ id: ScriptContentType; label: string }> = [
  { id: 'manju_short', label: '漫剧短剧' },
  { id: 'voiceover', label: '口播剧情' },
  { id: 'twist_short', label: '反转短片' },
]

export const SCRIPT_DURATION_OPTIONS: Array<{ id: ScriptDuration; label: string }> = [
  { id: '15s', label: '15 秒' },
  { id: '60s', label: '60 秒' },
  { id: '3min', label: '3 分钟' },
]

export const SCRIPT_EPISODE_OPTIONS: Array<{ id: ScriptEpisodeCount; label: string }> = [
  { id: '1', label: '单集' },
  { id: '3', label: '3 集' },
]

export const SCRIPT_GENRE_OPTIONS: Array<{ id: ScriptGenre; label: string }> = [
  { id: 'general', label: '不限' },
  { id: 'sweet', label: '甜宠' },
  { id: 'suspense', label: '悬疑' },
  { id: 'comedy', label: '搞笑' },
  { id: 'hotblood', label: '热血' },
  { id: 'healing', label: '治愈' },
]

export const SCRIPT_PLATFORM_OPTIONS: Array<{ id: ScriptPlatform; label: string }> = [
  { id: 'douyin_vertical', label: '抖音竖屏' },
  { id: 'wechat_article', label: '公众号' },
]

export const SCRIPT_IDEA_EXAMPLES: Array<{ id: string; label: string; idea: string }> = [
  {
    id: 'rebirth',
    label: '重生打脸',
    idea: '重生回到婚前，当众揭穿渣男，60 秒三个反转',
  },
  {
    id: 'workplace',
    label: '职场反转',
    idea: '社畜被领导甩锅，电梯监控反转打脸',
  },
  {
    id: 'sweet',
    label: '甜宠误会',
    idea: '青梅竹马假装情侣参加同学聚会，假戏真做',
  },
]

export function buildParamsChipLabel(params: ScriptCreateParams): string {
  const duration =
    SCRIPT_DURATION_OPTIONS.find((item) => item.id === params.duration)?.label ?? params.duration
  const platform =
    params.platform === 'douyin_vertical' ? '竖屏' : '公众号'
  const content =
    SCRIPT_CONTENT_TYPE_OPTIONS.find((item) => item.id === params.contentType)?.label ?? '漫剧'
  const episodes =
    SCRIPT_EPISODE_OPTIONS.find((item) => item.id === params.episodeCount)?.label ?? '单集'
  return `${duration} · ${platform} · ${content} · ${episodes}`
}
