import type {
  AppSettings,
  ModelConfig,
  ModelKind,
  PromptTemplate,
  SettingsPromptType,
  TemplateListKey,
} from '@/types/settings'
import { getBuiltInApiBase, migrateApiBaseUrl } from '@/lib/auth/api-base'
import { createLlmPresetModel } from '@/lib/models/llm-model-presets'
import { createImagePresetModel } from '@/lib/models/image-model-presets'
import { createVideoPresetModel } from '@/lib/models/video-model-presets'
import { normalizeVideoModelConfig } from '@/lib/models/video-model-utils'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { sanitizeStoredWeishiVideoModels } from '@/lib/models/weishi-capability-overlay'
import { applyStorageRootToSettings } from '@/lib/storage/data-layout'
import { HAND_STORYBOARD_TEMPLATES } from '@/lib/prompts/storyboard'
import { SEED_LAYOUT_TEMPLATES } from '@/lib/storage/layout-templates-seed'
import {
  SEED_EXTRACT_TEMPLATES,
  SEED_STORYBOARD_TEMPLATES,
  SEED_STYLE_TEMPLATES,
  REMOVED_STORYBOARD_TEMPLATE_KEYS,
} from '@/lib/storage/prompt-templates-seed'

const BUILTIN_STORYBOARD_TEMPLATES: PromptTemplate[] = [
  ...SEED_STORYBOARD_TEMPLATES,
  ...HAND_STORYBOARD_TEMPLATES,
]
import { normalizePathHistory } from '@/lib/storage/storage-path-utils'
import { generateUUID } from '@/lib/utils'
import { normalizeAffixPresets, SEED_AFFIX_PRESETS } from '@/lib/workflow/prompt-affix-utils'
import {
  DEFAULT_ASSET_LAYOUT_KEYS,
  DEFAULT_CHARACTER_LAYOUT_KEY,
  normalizeLayoutKey,
} from '@/lib/workflow/layout-presets'

export const APP_DATA_DIR_NAME = 'HaodeAI'

const BUILTIN_WEISHI_VIDEO: ModelConfig = {
  ...createVideoPresetModel('weishi_api'),
  id: 'builtin-weishi-api',
  name: '微视API',
}

/** 软件统一默认文本 LLM（Agnes 直连 apihub） */
export const BUILTIN_AGNES_LLM_ID = 'builtin-agnes-2.5-flash'

const BUILTIN_AGNES_LLM: ModelConfig = {
  id: BUILTIN_AGNES_LLM_ID,
  name: 'Agnes-2.5-Flash',
  apiFormat: 'openai',
  platform: 'openai_compatible',
  endpoint: 'https://apihub.agnes-ai.com',
  apiKey: 'sk-ZwiKGxKYSaRyWy9kmsmsFPwGJChWevm4EL2kW6SISNKkufQw',
  model: 'Agnes-2.5-Flash',
  autoAppendV1: true,
  source: 'custom',
}

const BUILTIN_VIDEO_MODELS: ModelConfig[] = [BUILTIN_WEISHI_VIDEO]
const BUILTIN_LLM_MODELS: ModelConfig[] = [BUILTIN_AGNES_LLM]

/** 设置页模板分类（对齐 comic-generator 文档 §1.2） */
export const TEMPLATE_SECTIONS: {
  key: TemplateListKey
  title: string
  promptType: PromptTemplate['promptType']
}[] = [
  { key: 'extractTemplates', title: '提取模板', promptType: 'extract' },
  { key: 'styleTemplates', title: '风格模板', promptType: 'style' },
  { key: 'storyboardTemplates', title: '分镜模板', promptType: 'storyboard' },
  { key: 'layoutTemplates', title: '布局模板', promptType: 'layout' },
]

function mergeTemplateList(
  seed: PromptTemplate[],
  saved: PromptTemplate[] | undefined,
): PromptTemplate[] {
  const seedKeys = new Set(seed.map((t) => t.key))
  const merged: PromptTemplate[] = []

  // 所有 seed 模板均为系统自带，只读；始终以 seed 内容为准
  for (const tpl of seed) {
    merged.push({ ...tpl, isBuiltin: true })
  }

  // 用户自定义：key 不在 seed 中的条目
  for (const tpl of saved ?? []) {
    if (!seedKeys.has(tpl.key)) {
      merged.push({ ...tpl, isBuiltin: false })
    }
  }

  return merged
}

/** 合并 seed 与用户自定义模板；内置模板始终以 seed 为准 */
export function ensurePromptTemplates(settings: AppSettings): AppSettings {
  return {
    ...settings,
    extractTemplates: mergeTemplateList(SEED_EXTRACT_TEMPLATES, settings.extractTemplates),
    styleTemplates: mergeTemplateList(SEED_STYLE_TEMPLATES, settings.styleTemplates),
    storyboardTemplates: mergeTemplateList(
      BUILTIN_STORYBOARD_TEMPLATES,
      settings.storyboardTemplates,
    ).filter((t) => !REMOVED_STORYBOARD_TEMPLATE_KEYS.has(t.key)),
    layoutTemplates: mergeTemplateList(SEED_LAYOUT_TEMPLATES, settings.layoutTemplates),
  }
}

export function createDefaultSettings(dataRoot = ''): AppSettings {
  return applyStorageRootToSettings(
    ensurePromptTemplates({
      dataRootPath: dataRoot,
      dataRootPathHistory: [],
      projectsDataPath: dataRoot,
      workflowDataPath: dataRoot,
      projectsDataPathHistory: [],
      workflowDataPathHistory: [],
      characterLibraryPath: '',
      sceneLibraryPath: '',
      generatedImagesPath: '',
      videoSavePath: '',
      llmModels: [...BUILTIN_LLM_MODELS],
      imageModels: [],
      videoModels: [...BUILTIN_VIDEO_MODELS],
      storyboardTemplates: [...BUILTIN_STORYBOARD_TEMPLATES],
      extractTemplates: [...SEED_EXTRACT_TEMPLATES],
      styleTemplates: [...SEED_STYLE_TEMPLATES],
      layoutTemplates: [...SEED_LAYOUT_TEMPLATES],
      debugEnabled: false,
      openAtLogin: true,
      weishiReferenceMediaUploadMode: 'weishi_asset',
      apiBaseUrl: getBuiltInApiBase(),
      affixPresets: [...SEED_AFFIX_PRESETS],
      defaultAssetLayoutKeys: { ...DEFAULT_ASSET_LAYOUT_KEYS },
      defaultLlmModelId: BUILTIN_AGNES_LLM_ID,
    }),
    dataRoot,
  )
}

/** 合并 settings 中的全局默认布局；旧版角色默认为「特写+三视图」时迁移至「即梦+大头+三视图」 */
export function ensureDefaultAssetLayoutKeys(
  saved?: Partial<Record<'character' | 'scene' | 'prop', string>>,
): Record<'character' | 'scene' | 'prop', string> {
  const merged: Record<'character' | 'scene' | 'prop', string> = { ...DEFAULT_ASSET_LAYOUT_KEYS }
  if (saved) {
    for (const kind of ['character', 'scene', 'prop'] as const) {
      const normalized = normalizeLayoutKey(saved[kind], kind)
      if (normalized) merged[kind] = normalized
    }
  }
  if (saved?.character === 'layout_character_three') {
    merged.character = DEFAULT_CHARACTER_LAYOUT_KEY
  }
  return merged
}

export function mergeSettings(
  partial: Partial<AppSettings> | null | undefined,
  dataRoot = '',
): AppSettings {
  const defaults = createDefaultSettings(dataRoot)
  if (!partial || typeof partial !== 'object') return defaults

  const merged: AppSettings = {
    ...defaults,
    ...partial,
    llmModels: Array.isArray(partial.llmModels) ? partial.llmModels : defaults.llmModels,
    imageModels: Array.isArray(partial.imageModels)
      ? partial.imageModels
      : defaults.imageModels,
    videoModels:
      Array.isArray(partial.videoModels) && partial.videoModels.length > 0
        ? partial.videoModels
        : defaults.videoModels,
    extractTemplates: Array.isArray(partial.extractTemplates)
      ? partial.extractTemplates
      : defaults.extractTemplates,
    styleTemplates: Array.isArray(partial.styleTemplates)
      ? partial.styleTemplates
      : defaults.styleTemplates,
    storyboardTemplates: Array.isArray(partial.storyboardTemplates)
      ? partial.storyboardTemplates
      : defaults.storyboardTemplates,
    layoutTemplates: Array.isArray(partial.layoutTemplates)
      ? partial.layoutTemplates
      : defaults.layoutTemplates,
    affixPresets: normalizeAffixPresets(
      Array.isArray(partial.affixPresets) ? partial.affixPresets : defaults.affixPresets,
    ),
    projectsDataPathHistory: normalizePathHistory(partial.projectsDataPathHistory),
    workflowDataPathHistory: normalizePathHistory(partial.workflowDataPathHistory),
    dataRootPathHistory: normalizePathHistory(partial.dataRootPathHistory),
  }

  merged.apiBaseUrl = migrateApiBaseUrl(merged.apiBaseUrl, defaults.apiBaseUrl)
  merged.defaultAssetLayoutKeys = ensureDefaultAssetLayoutKeys(partial.defaultAssetLayoutKeys)
  if (merged.storyboardValidateMode !== 'quick' && merged.storyboardValidateMode !== 'deep') {
    delete merged.storyboardValidateMode
  }

  const withDefaults = ensureDefaultModelIds(merged)

  const root = withDefaults.dataRootPath || dataRoot
  return applyStorageRootToSettings(ensurePromptTemplates(withDefaults), root)
}

function ensureBuiltinAgnesLlm(models: ModelConfig[]): ModelConfig[] {
  const synced = models.map((model) => {
    if (model.id !== BUILTIN_AGNES_LLM_ID) return model
    return {
      ...model,
      name: BUILTIN_AGNES_LLM.name,
      apiFormat: BUILTIN_AGNES_LLM.apiFormat,
      platform: BUILTIN_AGNES_LLM.platform,
      endpoint: BUILTIN_AGNES_LLM.endpoint,
      apiKey: BUILTIN_AGNES_LLM.apiKey,
      model: BUILTIN_AGNES_LLM.model,
      autoAppendV1: BUILTIN_AGNES_LLM.autoAppendV1,
      source: BUILTIN_AGNES_LLM.source,
    }
  })
  if (synced.some((model) => model.id === BUILTIN_AGNES_LLM_ID)) return synced
  return [BUILTIN_AGNES_LLM, ...synced]
}

function ensureBuiltinWeishiVideo(models: ModelConfig[]): ModelConfig[] {
  // 已有微视：纠正内置项上过期的清晰度（历史上可能误存 480P+720P）
  const synced = models.map((model) => {
    if (model.id !== BUILTIN_WEISHI_VIDEO.id || !isWeishiApiModel(model)) return model
    const resolutions = BUILTIN_WEISHI_VIDEO.resolutions
      ? [...BUILTIN_WEISHI_VIDEO.resolutions]
      : model.resolutions
    const videoPricing =
      model.videoPricing && resolutions?.length
        ? {
            ...model.videoPricing,
            resolutions: [...resolutions],
            defaultResolution:
              resolutions.includes(String(model.videoPricing.defaultResolution ?? ''))
                ? model.videoPricing.defaultResolution
                : resolutions[0],
          }
        : model.videoPricing
    return {
      ...model,
      resolutions,
      videoPricing,
      ratios: BUILTIN_WEISHI_VIDEO.ratios ? [...BUILTIN_WEISHI_VIDEO.ratios] : model.ratios,
      durations: BUILTIN_WEISHI_VIDEO.durations
        ? [...BUILTIN_WEISHI_VIDEO.durations]
        : model.durations,
    }
  })
  const withBuiltin = synced.some(isWeishiApiModel) ? synced : [BUILTIN_WEISHI_VIDEO, ...synced]
  // 所有自定义微视：落盘清洗历史假档 480P
  return sanitizeStoredWeishiVideoModels(withBuiltin)
}

function ensureDefaultModelIds(settings: AppSettings): AppSettings {
  const llmModels = ensureBuiltinAgnesLlm(settings.llmModels)
  return {
    ...settings,
    llmModels,
    videoModels: ensureBuiltinWeishiVideo(settings.videoModels.map(normalizeVideoModelConfig)),
    // 软件统一默认文本 LLM → Agnes-2.5-Flash
    defaultLlmModelId: BUILTIN_AGNES_LLM_ID,
  }
}

export function createEmptyModel(kind: ModelKind): ModelConfig {
  if (kind === 'llm') {
    return { ...createLlmPresetModel('openai_compatible', { name: '' }), source: 'custom' }
  }
  if (kind === 'video') {
    return { ...createVideoPresetModel('openai_compatible', { name: '' }), source: 'custom' }
  }
  return { ...createImagePresetModel('openai_compatible', { name: '' }), source: 'custom' }
}

export function createEmptyTemplate(promptType: SettingsPromptType): PromptTemplate {
  const isLayout = promptType === 'layout'
  return {
    id: generateUUID(),
    key: isLayout ? `layout_character_custom_${Date.now()}` : `custom_${Date.now()}`,
    name: isLayout ? '自定义布局' : '新模板',
    promptType,
    content: '',
    isBuiltin: false,
    ...(isLayout ? { layoutKind: 'character' as const } : {}),
  }
}
