// Copyright (c) Haode AI. All rights reserved.

import {
  resolveImageResolutionOptions,
  shouldShowImageResolutionSelector,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import {
  findImageSizePreset,
  IMAGE_SIZE_OPTIONS,
  normalizeImageSizePreset,
} from '@/lib/workflow/image-size-presets'
import type { ModelConfig } from '@/types/settings'

export type CanvasImageAspectRatio = '16:9' | '9:16' | '1:1'

export const CANVAS_IMAGE_ASPECT_UI: ReadonlyArray<{ value: CanvasImageAspectRatio; label: string }> =
  [
    { value: '16:9', label: '横屏' },
    { value: '9:16', label: '竖屏' },
    { value: '1:1', label: '方图' },
  ]

export function parseCanvasImageAspectRatio(imageSize: string): CanvasImageAspectRatio {
  const value = normalizeImageSizePreset(imageSize)
  const preset = findImageSizePreset(value)
  if (!preset) return '16:9'
  if (preset.value === '1024x1024' || preset.label.includes('1:1')) return '1:1'
  if (preset.value.includes('9:16') || preset.label.includes('9:16')) return '9:16'
  return '16:9'
}

export function parseCanvasImageSizeTier(imageSize: string): string {
  const value = normalizeImageSizePreset(imageSize)
  const preset = findImageSizePreset(value)
  if (!preset) return '1K'
  if (preset.value.startsWith('4k')) return '4K'
  if (preset.value.startsWith('2k')) return '2K'
  return '1K'
}

export function buildCanvasImageSizePreset(tier: string, aspect: CanvasImageAspectRatio): string {
  const normalized = tier.trim().toUpperCase()
  const tierKey = normalized === '4K' ? '4k' : normalized === '2K' ? '2k' : '1k'
  if (aspect === '1:1') {
    return tierKey === '1k' ? '1024x1024' : `${tierKey}-1:1`
  }
  return aspect === '16:9' ? `${tierKey}-16:9` : `${tierKey}-9:16`
}

/** 无后台分档时：从当前画幅可用的 preset 推导清晰度选项 */
export function resolveCanvasImagePresetTierOptions(aspect: CanvasImageAspectRatio): string[] {
  const tiers = new Set<string>()
  for (const option of IMAGE_SIZE_OPTIONS) {
    if (parseCanvasImageAspectRatio(option.value) === aspect) {
      tiers.add(parseCanvasImageSizeTier(option.value))
    }
  }
  const order = ['1K', '2K', '4K']
  return order.filter((item) => tiers.has(item))
}

/** 画布：是否展示清晰度选择（后台分档优先，否则 preset 多档） */
export function shouldShowCanvasImageResolutionSelector(
  model: ModelConfig | null | undefined,
  aspect: CanvasImageAspectRatio,
): boolean {
  if (shouldShowImageResolutionSelector(model)) return true
  return resolveCanvasImagePresetTierOptions(aspect).length > 1
}

/** 画布：当前画幅下可用的清晰度档位 */
export function resolveCanvasImageResolutionTierOptions(
  model: ModelConfig | null | undefined,
  aspect: CanvasImageAspectRatio,
): string[] {
  if (shouldShowImageResolutionSelector(model)) {
    return resolveImageResolutionOptions(model).map((item) => item.value)
  }
  return resolveCanvasImagePresetTierOptions(aspect)
}

/** 画布：当前选中的清晰度档位 */
export function resolveCanvasImageActiveTier(
  model: ModelConfig | null | undefined,
  imageSize: string,
  tierParams: ImageGenerationTierParams,
): string {
  if (shouldShowImageResolutionSelector(model) && tierParams.resolution) {
    return tierParams.resolution
  }
  return parseCanvasImageSizeTier(imageSize)
}

export function formatCanvasImageParamsSummary(
  imageSize: string,
  model: ModelConfig | null | undefined,
  tierParams: ImageGenerationTierParams,
): string {
  const aspect = parseCanvasImageAspectRatio(imageSize)
  if (!shouldShowCanvasImageResolutionSelector(model, aspect)) {
    return aspect
  }
  const tier = resolveCanvasImageActiveTier(model, imageSize, tierParams)
  return `${aspect} · ${tier}`
}
