import type { AssetKind } from '@/types/workflow'
import {
  DEFAULT_CHARACTER_STYLE_KEY,
  getStylePresetValue,
  STYLE_PRESETS,
  type StyleTemplatesSource,
} from '@/lib/workflow/style-preset-catalog'
import {
  resolveEffectiveAssetStyleKey,
  resolveEffectiveStoryboardStyleKey,
} from '@/lib/workflow/project-visual-style'

export type { StylePreset, StyleTemplatesSource } from '@/lib/workflow/style-preset-catalog'
export {
  ASSET_KIND_STYLE_LABEL,
  DEFAULT_CHARACTER_STYLE_KEY,
  getCharacterStylePresets,
  getStylePresetSelectOptions,
  getStylePresetValue,
  listStylePresets,
  STYLE_PRESETS,
} from '@/lib/workflow/style-preset-catalog'

/** Step3 工具栏：解析当前生效的生图 preset key */
export function resolveProjectAssetStyleKey(
  data: Parameters<typeof resolveEffectiveAssetStyleKey>[0],
  _kind: AssetKind,
  _globalStyleKeys?: Partial<Record<AssetKind, string>>,
  source?: StyleTemplatesSource,
): string {
  return resolveEffectiveAssetStyleKey(data, source)
}

/** Step4 分镜生图：解析当前生效的 preset key */
export function resolveStoryboardStylePresetKey(
  data: Parameters<typeof resolveEffectiveStoryboardStyleKey>[0],
  _settingsFallback?: string,
  source?: StyleTemplatesSource,
): string {
  return resolveEffectiveStoryboardStyleKey(data, source)
}

/** 生图风格前缀文本 */
export function resolveStylePresetValue(
  assetStyleKey?: string,
  projectStyleKey?: string,
  source?: StyleTemplatesSource,
): string {
  const direct = getStylePresetValue(assetStyleKey, source)
  if (direct) return direct

  if (projectStyleKey) {
    const projectValue = getStylePresetValue(projectStyleKey, source)
    if (projectValue) return projectValue
  }

  return (
    getStylePresetValue(DEFAULT_CHARACTER_STYLE_KEY, source) ||
    STYLE_PRESETS.find((p) => p.key === DEFAULT_CHARACTER_STYLE_KEY)?.value ||
    ''
  )
}
