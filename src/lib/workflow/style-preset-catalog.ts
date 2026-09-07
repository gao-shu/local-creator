// Copyright (c) local-creator contributors. All rights reserved.

import cloudStylePresets from '@/lib/workflow/data/style-presets-cloud.json'
import type { AppSettings, PromptTemplate } from '@/types/settings'
import type { AssetKind } from '@/types/workflow'

export interface StylePreset {
  key: string
  name: string
  value: string
  sortOrder: number
  isBuiltin: boolean
}

interface CloudStyleRow {
  name: string
  key: string
  value: string
  sort_order?: number
  is_builtin?: boolean
  is_active?: boolean
}

/** 风格列表来源：完整 settings、仅 styleTemplates，或模板数组 */
export type StyleTemplatesSource =
  | Pick<AppSettings, 'styleTemplates'>
  | PromptTemplate[]
  | null
  | undefined

/** 角色 / 项目默认画风（写实） */
export const DEFAULT_CHARACTER_STYLE_KEY = 'style_realistic'

const BUILTIN_STYLE_ORDER = [
  'style_realistic',
  'style_2d_celluloid',
  'style_2d_shinkai',
  'style_3d_anime',
] as const

const BUILTIN_STYLE_ORDER_INDEX = new Map(
  BUILTIN_STYLE_ORDER.map((key, index) => [key, index]),
)

function buildStylePresetsFromCloud(): StylePreset[] {
  const rows = (cloudStylePresets as CloudStyleRow[]).filter(
    (row) => row.key && row.name && row.is_active !== false,
  )
  const byKey = new Map<string, StylePreset>()
  for (const row of rows) {
    byKey.set(row.key, {
      key: row.key,
      name: row.name,
      value: String(row.value || '').trim(),
      sortOrder: row.sort_order ?? 0,
      isBuiltin: Boolean(row.is_builtin),
    })
  }

  const builtins = BUILTIN_STYLE_ORDER.map((key) => byKey.get(key)).filter(
    (item): item is StylePreset => Boolean(item),
  )

  const cloud = rows
    .filter((row) => !row.is_builtin)
    .map((row) => byKey.get(row.key))
    .filter((item): item is StylePreset => Boolean(item))
    .sort(
      (a, b) =>
        a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'),
    )

  return [...builtins, ...cloud]
}

export const STYLE_PRESETS: StylePreset[] = buildStylePresetsFromCloud()

function resolveStyleTemplatesList(source?: StyleTemplatesSource): PromptTemplate[] | undefined {
  if (!source) return undefined
  if (Array.isArray(source)) return source
  return Array.isArray(source.styleTemplates) ? source.styleTemplates : undefined
}

function templateToStylePreset(tpl: PromptTemplate, index: number): StylePreset | null {
  if (tpl.promptType && tpl.promptType !== 'style') return null
  const key = tpl.key?.trim()
  if (!key) return null
  return {
    key,
    name: tpl.name?.trim() || key,
    value: String(tpl.content || '').trim(),
    sortOrder: index,
    isBuiltin: Boolean(tpl.isBuiltin),
  }
}

function sortStylePresets(presets: StylePreset[]): StylePreset[] {
  return [...presets].sort((a, b) => {
    const aBuiltin = BUILTIN_STYLE_ORDER_INDEX.get(a.key)
    const bBuiltin = BUILTIN_STYLE_ORDER_INDEX.get(b.key)
    if (aBuiltin != null && bBuiltin != null) return aBuiltin - bBuiltin
    if (aBuiltin != null) return -1
    if (bBuiltin != null) return 1
    if (a.isBuiltin !== b.isBuiltin) return a.isBuiltin ? -1 : 1
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN')
  })
}

export function listStylePresets(source?: StyleTemplatesSource): StylePreset[] {
  const templates = resolveStyleTemplatesList(source)
  if (!templates?.length) return [...STYLE_PRESETS]

  const presets: StylePreset[] = []
  const seen = new Set<string>()

  templates.forEach((tpl, index) => {
    const preset = templateToStylePreset(tpl, index)
    if (!preset || seen.has(preset.key)) return
    seen.add(preset.key)
    presets.push(preset)
  })

  for (const sys of STYLE_PRESETS) {
    if (seen.has(sys.key)) continue
    seen.add(sys.key)
    presets.push(sys)
  }

  return presets.length > 0 ? sortStylePresets(presets) : [...STYLE_PRESETS]
}

export function getCharacterStylePresets(source?: StyleTemplatesSource): StylePreset[] {
  return listStylePresets(source)
}

export function getStylePresetSelectOptions(source?: StyleTemplatesSource) {
  return listStylePresets(source).map((preset) => ({
    value: preset.key,
    label: preset.name,
  }))
}

export const ASSET_KIND_STYLE_LABEL: Record<AssetKind, string> = {
  character: '生图风格',
  scene: '生图风格',
  prop: '生图风格',
}

export function getStylePresetValue(key?: string, source?: StyleTemplatesSource) {
  if (!key) return ''
  return listStylePresets(source).find((p) => p.key === key)?.value ?? ''
}

export function hasStylePresetKey(key: string | undefined, source?: StyleTemplatesSource): boolean {
  if (!key?.trim()) return false
  return listStylePresets(source).some((p) => p.key === key.trim())
}
