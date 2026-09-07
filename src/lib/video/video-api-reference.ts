// Copyright (c) local-creator contributors. All rights reserved.

import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import type { ShotVideoReferenceKind } from '@/lib/workflow/shot-video-utils'
import { resolveZhipuModel } from '@/lib/video/zhipu-video-client'

export interface ExternalVideoReferenceItem {
  path: string
  kind?: ShotVideoReferenceKind
  label?: string
}

/** 全能多参 / Grok R2V：参考图上限 */
export const EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES = 7

/**
 * 非微视视频 API（智谱 / OpenAI 兼容 / Grok）参考图选取。
 * - first_frame：1 张（分镜优先）
 * - multimodal：多张去重（上限 EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES）
 * - first_last_frame：首尾各 1
 * - text_to_video：无图
 */
export function pickExternalVideoReferencePaths(options: {
  mode?: VideoReferenceMode
  items?: ExternalVideoReferenceItem[]
  paths?: string[]
}): string[] {
  const mode = options.mode ?? 'first_frame'
  const paths = (options.paths ?? []).map((p) => String(p || '').trim()).filter(Boolean)

  const items: ExternalVideoReferenceItem[] = options.items?.length
    ? options.items
    : paths.map((path) => ({ path, kind: 'shot_reference' as const }))

  if (mode === 'text_to_video' || !items.length) return []

  const storyboard = items.find((item) => item.kind === 'storyboard')
  const endFrame = items.find((item) => item.kind === 'end_frame')

  if (mode === 'first_last_frame') {
    const start = storyboard ?? items[0]
    const end =
      endFrame ??
      items.find((item) => item.path !== start?.path && item.kind !== 'storyboard')
    const selected: string[] = []
    if (start?.path) selected.push(start.path)
    if (end?.path && end.path !== start?.path) selected.push(end.path)
    return selected
  }

  if (mode === 'multimodal') {
    const selected: string[] = []
    const seen = new Set<string>()
    const push = (raw?: string) => {
      const path = String(raw || '').trim()
      if (!path || seen.has(path)) return
      seen.add(path)
      selected.push(path)
    }
    // 分镜优先，再按 items 顺序收 @ 资产 / 手动参考
    push(storyboard?.path)
    for (const item of items) {
      if (selected.length >= EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES) break
      push(item.path)
    }
    for (const path of paths) {
      if (selected.length >= EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES) break
      push(path)
    }
    return selected.slice(0, EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES)
  }

  // first_frame：仅 1 张，分镜优先
  if (storyboard?.path) return [storyboard.path]
  if (items[0]?.path) return [items[0].path]
  return paths.slice(0, 1)
}

/**
 * 智谱 image_url 字段格式（按官方 OpenAPI 区分模型）：
 * - cogvideox-flash / cogvideox-2：ImageUrlInput → 仅 string<uri>
 * - cogvideox-3 首尾帧：ImageUrlInputExtended → string<uri>[2]
 * - cogvideox-3 单图：string<uri>
 */
export function formatZhipuImageUrlField(
  urls: string[],
  options?: { mode?: VideoReferenceMode; model?: string },
): string | string[] | undefined {
  const valid = urls.map((u) => String(u || '').trim()).filter(Boolean)
  if (!valid.length) return undefined

  const mode = options?.mode
  const modelId = resolveZhipuModel(options?.model)

  if (mode === 'first_last_frame' && valid.length >= 2 && modelId === 'cogvideox-3') {
    return [valid[0], valid[1]]
  }

  // flash/2 及单图模式：必须是 string，单元素数组会被 API 忽略
  return valid[0]
}

/** @deprecated 使用 formatZhipuImageUrlField */
export function buildZhipuImageUrlParam(
  urls: string[],
  mode?: VideoReferenceMode,
): string | string[] | undefined {
  return formatZhipuImageUrlField(urls, { mode })
}

/**
 * OpenAI 兼容 / Grok 中转：按参考模式区分 I2V 与 R2V。
 * - first_frame → image: { url }（起始帧锚定）
 * - multimodal → reference_images（不锁首帧；1 张也走 R2V）
 * - text_to_video → 无图
 * - first_last_frame → 首尾帧别名（非 Grok I2V/R2V）
 */
export function buildOpenAiVideoImageParams(
  urls: string[],
  mode?: VideoReferenceMode,
): Record<string, unknown> {
  const valid = urls.map((u) => String(u || '').trim()).filter(Boolean)
  if (!valid.length || mode === 'text_to_video') return {}

  if (mode === 'first_last_frame' && valid.length >= 2) {
    return {
      image_url: valid[0],
      image: valid[0],
      last_frame_url: valid[1],
      last_frame: valid[1],
      first_frame_url: valid[0],
      first_frame: valid[0],
    }
  }

  // 全能多参：R2V，不与 image 同传
  if (mode === 'multimodal' || valid.length >= 2) {
    return {
      reference_images: valid
        .slice(0, EXTERNAL_VIDEO_MULTIMODAL_MAX_IMAGES)
        .map((url) => ({ url })),
    }
  }

  // 首帧图参考（默认单图）：I2V；附带 image_url 字符串以兼容部分网关
  const url = valid[0]
  return {
    image: { url },
    image_url: url,
  }
}
