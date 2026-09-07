// Copyright (c) local-creator contributors. All rights reserved.

import type { PromptTemplate } from '@/types/settings'
import type { EpisodeStyle, WorkflowProjectData } from '@/types/workflow'
import {
  DEFAULT_CHARACTER_STYLE_KEY,
  hasStylePresetKey,
  listStylePresets,
  type StyleTemplatesSource,
} from '@/lib/workflow/style-preset-catalog'

export const DEFAULT_PROJECT_STYLE_PRESET_KEY = DEFAULT_CHARACTER_STYLE_KEY

export interface StylePackMeta {
  category: EpisodeStyle
  label: string
  hint: string
  defaultPresetKey: string
}

export const STYLE_PACK_ORDER: EpisodeStyle[] = [
  'realistic',
  'comic',
  '2d_anime',
  '3d_anime',
  'article',
]

export const STYLE_PACK_META: Record<EpisodeStyle, StylePackMeta> = {
  realistic: {
    category: 'realistic',
    label: '写实',
    hint: '影视写实、真人古装',
    defaultPresetKey: 'style_realistic',
  },
  comic: {
    category: 'comic',
    label: '漫画',
    hint: '漫画分格、条漫视觉',
    defaultPresetKey: 'style_2d_celluloid',
  },
  '2d_anime': {
    category: '2d_anime',
    label: '2D动漫',
    hint: '日系二维、赛璐璐',
    defaultPresetKey: 'style_2d_shinkai',
  },
  '3d_anime': {
    category: '3d_anime',
    label: '3D动画',
    hint: '三维渲染、国漫 3D',
    defaultPresetKey: 'style_3d_anime',
  },
  article: {
    category: 'article',
    label: '图文推文',
    hint: '竖屏口播、短句节奏',
    defaultPresetKey: 'style_realistic',
  },
}

const BUILTIN_PRESET_CATEGORY: Record<string, EpisodeStyle> = {
  style_realistic: 'realistic',
  style_2d_celluloid: 'comic',
  style_2d_shinkai: '2d_anime',
  style_3d_anime: '3d_anime',
}

const CATEGORY_NAME_PATTERNS: Array<{ category: EpisodeStyle; pattern: RegExp }> = [
  { category: 'article', pattern: /推文|口播|图文|竖屏文案/i },
  { category: '3d_anime', pattern: /3d|三维|玄幻|建模|凡人|武动|三体|渲染/i },
  { category: '2d_anime', pattern: /2d|二维|赛璐璐|新海诚|日系|动漫|动画截图/i },
  { category: 'comic', pattern: /漫画|条漫|美漫|分格/i },
  { category: 'realistic', pattern: /真人|写实|古装|电影|摄影|纪实|院线/i },
]

function resolveStyleTemplatesList(source?: StyleTemplatesSource): PromptTemplate[] {
  if (!source) return []
  if (Array.isArray(source)) return source.filter((tpl) => !tpl.promptType || tpl.promptType === 'style')
  return (source.styleTemplates ?? []).filter((tpl) => !tpl.promptType || tpl.promptType === 'style')
}

/** 从 preset key / 模板名推断 LLM 描述大类 */
export function inferStyleCategoryFromPresetKey(
  presetKey: string,
  source?: StyleTemplatesSource,
): EpisodeStyle {
  const key = presetKey.trim()
  if (BUILTIN_PRESET_CATEGORY[key]) return BUILTIN_PRESET_CATEGORY[key]

  const templates = resolveStyleTemplatesList(source)
  const tpl = templates.find((item) => item.key === key)
  if (tpl?.styleCategory && STYLE_PACK_META[tpl.styleCategory]) {
    return tpl.styleCategory
  }

  const label = `${tpl?.name ?? ''} ${key}`
  for (const rule of CATEGORY_NAME_PATTERNS) {
    if (rule.pattern.test(label)) return rule.category
  }

  return 'realistic'
}

export function resolveProjectStylePresetKey(
  data: Pick<WorkflowProjectData, 'projectStylePresetKey'> | null | undefined,
  source?: StyleTemplatesSource,
): string {
  const key = data?.projectStylePresetKey?.trim()
  if (key && hasStylePresetKey(key, source)) return key
  return DEFAULT_PROJECT_STYLE_PRESET_KEY
}

/** LLM 分集/提取用的描述风格大类（由项目视觉风格自动推导） */
export function resolveProjectEpisodeStyle(
  data: Pick<WorkflowProjectData, 'projectStylePresetKey'> | null | undefined,
  source?: StyleTemplatesSource,
): EpisodeStyle {
  const presetKey = resolveProjectStylePresetKey(data, source)
  return inferStyleCategoryFromPresetKey(presetKey, source)
}

export function getStylePresetLabel(
  presetKey: string,
  source?: StyleTemplatesSource,
): string {
  const key = presetKey.trim()
  return listStylePresets(source).find((preset) => preset.key === key)?.name ?? key
}

export function resolveProjectVisualStyleSummary(
  data: Pick<WorkflowProjectData, 'projectStylePresetKey'> | null | undefined,
  source?: StyleTemplatesSource,
): { category: EpisodeStyle; categoryLabel: string; presetKey: string; presetLabel: string } {
  const presetKey = resolveProjectStylePresetKey(data, source)
  const category = inferStyleCategoryFromPresetKey(presetKey, source)
  return {
    category,
    categoryLabel: STYLE_PACK_META[category].label,
    presetKey,
    presetLabel: getStylePresetLabel(presetKey, source),
  }
}

export interface StylePackPresetOption {
  key: string
  name: string
  recommended: boolean
}

export interface StylePackGroup {
  meta: StylePackMeta
  presets: StylePackPresetOption[]
}

/** 按大类分组的可选生图风格（Step1 风格选择器） */
export function buildStylePackGroups(source?: StyleTemplatesSource): StylePackGroup[] {
  const templates = resolveStyleTemplatesList(source)
  const templateByKey = new Map(templates.map((tpl) => [tpl.key, tpl]))
  const allPresets = listStylePresets(source)

  return STYLE_PACK_ORDER.map((category) => {
    const meta = STYLE_PACK_META[category]
    const inCategory = allPresets
      .map((preset) => {
        const tpl = templateByKey.get(preset.key)
        const inferred = inferStyleCategoryFromPresetKey(preset.key, source)
        return {
          key: preset.key,
          name: preset.name,
          category: inferred,
          recommended: tpl?.styleRecommended ?? preset.key === meta.defaultPresetKey,
        }
      })
      .filter((item) => item.category === category)

    const sorted = [...inCategory].sort((a, b) => {
      if (a.recommended !== b.recommended) return a.recommended ? -1 : 1
      if (a.key === meta.defaultPresetKey) return -1
      if (b.key === meta.defaultPresetKey) return 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    const limited = sorted.slice(0, 8)
    if (!limited.some((item) => item.key === meta.defaultPresetKey)) {
      const fallback = allPresets.find((preset) => preset.key === meta.defaultPresetKey)
      if (
        fallback &&
        inferStyleCategoryFromPresetKey(fallback.key, source) === category
      ) {
        limited.unshift({
          key: fallback.key,
          name: fallback.name,
          category,
          recommended: true,
        })
      }
    }

    return {
      meta,
      presets: limited.map(({ key, name, recommended }) => ({ key, name, recommended })),
    }
  })
}

export function isAssetStyleFollowingProject(
  data: Pick<WorkflowProjectData, 'assetStyleOverrideKey'> | null | undefined,
): boolean {
  return !data?.assetStyleOverrideKey?.trim()
}

export function isStoryboardStyleFollowingProject(
  data: Pick<WorkflowProjectData, 'storyboardStyleOverrideKey'> | null | undefined,
): boolean {
  return !data?.storyboardStyleOverrideKey?.trim()
}

/** Step3 实际生图 preset key */
export function resolveEffectiveAssetStyleKey(
  data:
    | Pick<WorkflowProjectData, 'projectStylePresetKey' | 'assetStyleOverrideKey'>
    | null
    | undefined,
  source?: StyleTemplatesSource,
): string {
  const override = data?.assetStyleOverrideKey?.trim()
  if (override && hasStylePresetKey(override, source)) return override
  return resolveProjectStylePresetKey(data, source)
}

/** Step4 实际分镜生图 preset key */
export function resolveEffectiveStoryboardStyleKey(
  data:
    | Pick<WorkflowProjectData, 'projectStylePresetKey' | 'storyboardStyleOverrideKey'>
    | null
    | undefined,
  source?: StyleTemplatesSource,
): string {
  const override = data?.storyboardStyleOverrideKey?.trim()
  if (override && hasStylePresetKey(override, source)) return override
  return resolveProjectStylePresetKey(data, source)
}

/** 更新项目视觉风格并清除 Step3/4 覆盖（联动） */
export function buildProjectVisualStylePatch(presetKey: string): Pick<
  WorkflowProjectData,
  'projectStylePresetKey' | 'assetStyleOverrideKey' | 'storyboardStyleOverrideKey'
> {
  return {
    projectStylePresetKey: presetKey,
    assetStyleOverrideKey: undefined,
    storyboardStyleOverrideKey: undefined,
  }
}
