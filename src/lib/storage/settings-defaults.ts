import type {
  AppSettings,
  ModelConfig,
  ModelKind,
  PromptTemplate,
  SettingsPromptType,
  TemplateListKey,
} from '@/types/settings'
import { APP_LAUNCHER_DIR_NAME } from '@/constants/brand'
import { migrateApiBaseUrl } from '@/lib/auth/api-base'
import { createLlmPresetModel } from '@/lib/models/llm-model-presets'
import { createImagePresetModel } from '@/lib/models/image-model-presets'
import {
  createVideoPresetModel,
} from '@/lib/models/video-model-presets'
import { normalizeVideoModelConfig } from '@/lib/models/video-model-utils'
import { applyStorageRootToSettings } from '@/lib/storage/data-layout'
import { HAND_STORYBOARD_TEMPLATES } from '@/lib/prompts/storyboard'
import { SEED_LAYOUT_TEMPLATES } from '@/lib/storage/layout-templates-seed'
import {
  SEED_EXTRACT_TEMPLATES,
  SEED_STORYBOARD_TEMPLATES,
  SEED_STYLE_TEMPLATES,
  REMOVED_STORYBOARD_TEMPLATE_KEYS,
} from '@/lib/storage/prompt-templates-seed'
import { normalizePathHistory } from '@/lib/storage/storage-path-utils'
import { generateUUID } from '@/lib/utils'
import { normalizeAffixPresets, SEED_AFFIX_PRESETS } from '@/lib/workflow/prompt-affix-utils'
import {
  DEFAULT_ASSET_LAYOUT_KEYS,
  DEFAULT_CHARACTER_LAYOUT_KEY,
  normalizeLayoutKey,
} from '@/lib/workflow/layout-presets'

const BUILTIN_STORYBOARD_TEMPLATES: PromptTemplate[] = [
  ...SEED_STORYBOARD_TEMPLATES,
  ...HAND_STORYBOARD_TEMPLATES,
]

export const APP_DATA_DIR_NAME = APP_LAUNCHER_DIR_NAME

/** 软件统一默认文本 LLM（Agnes 直连 apihub；Key 由用户填写，不入库） */
export const BUILTIN_AGNES_LLM_ID = 'builtin-agnes-2.5-flash'

/** 软件统一默认图片（Agnes；Endpoint / Key 由用户填写） */
export const BUILTIN_AGNES_IMAGE_ID = 'builtin-agnes-image-2.1-flash'

const BUILTIN_AGNES_LLM: ModelConfig = {
  id: BUILTIN_AGNES_LLM_ID,
  name: 'Agnes-2.5-Flash',
  apiFormat: 'openai',
  platform: 'openai_compatible',
  endpoint: 'https://apihub.agnes-ai.com',
  apiKey: '',
  model: 'Agnes-2.5-Flash',
  autoAppendV1: true,
  source: 'custom',
}

const BUILTIN_AGNES_IMAGE: ModelConfig = {
  id: BUILTIN_AGNES_IMAGE_ID,
  name: 'Agnes · agnes-image-2.1-flash',
  apiFormat: 'openai',
  platform: 'openai_compatible',
  endpoint: '',
  apiKey: '',
  model: 'agnes-image-2.1-flash',
  autoAppendV1: true,
  source: 'custom',
}

/** 视频无品牌内置：用户自行添加 OpenAI 兼容等服务 */
const BUILTIN_VIDEO_MODELS: ModelConfig[] = []
const BUILTIN_IMAGE_MODELS: ModelConfig[] = [BUILTIN_AGNES_IMAGE]
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
      imageModels: [...BUILTIN_IMAGE_MODELS],
      videoModels: [...BUILTIN_VIDEO_MODELS],
      storyboardTemplates: [...BUILTIN_STORYBOARD_TEMPLATES],
      extractTemplates: [...SEED_EXTRACT_TEMPLATES],
      styleTemplates: [...SEED_STYLE_TEMPLATES],
      layoutTemplates: [...SEED_LAYOUT_TEMPLATES],
      debugEnabled: false,
      openAtLogin: true,
      apiBaseUrl: '',
      affixPresets: [...SEED_AFFIX_PRESETS],
      defaultAssetLayoutKeys: { ...DEFAULT_ASSET_LAYOUT_KEYS },
      defaultLlmModelId: BUILTIN_AGNES_LLM_ID,
      defaultImageModelId: BUILTIN_AGNES_IMAGE_ID,
      lastUsedLlmModelId: BUILTIN_AGNES_LLM_ID,
      lastUsedEpisodeLlmModelId: BUILTIN_AGNES_LLM_ID,
      lastUsedStoryboardLlmModelId: BUILTIN_AGNES_LLM_ID,
      lastUsedAssetImageModelId: BUILTIN_AGNES_IMAGE_ID,
      lastUsedStoryboardImageModelId: BUILTIN_AGNES_IMAGE_ID,
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
    imageModels:
      Array.isArray(partial.imageModels) && partial.imageModels.length > 0
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

/** 确保内置模型存在；同步公开字段，保留用户已填 Key / 自定义 endpoint */
function ensureBuiltinModel(
  models: ModelConfig[],
  builtin: ModelConfig,
  options?: { forceEndpoint?: boolean },
): ModelConfig[] {
  const synced = models.map((model) => {
    if (model.id !== builtin.id) return model
    const next: ModelConfig = {
      ...model,
      name: builtin.name,
      apiFormat: builtin.apiFormat,
      platform: builtin.platform,
      endpoint: options?.forceEndpoint
        ? builtin.endpoint
        : model.endpoint?.trim() || builtin.endpoint,
      apiKey: model.apiKey?.trim() ? model.apiKey : builtin.apiKey,
      model: builtin.model,
      autoAppendV1: builtin.autoAppendV1,
      source: builtin.source,
    }
    if (builtin.ratios) next.ratios = [...builtin.ratios]
    if (builtin.durations) next.durations = [...builtin.durations]
    if (builtin.resolutions) next.resolutions = [...builtin.resolutions]
    if (builtin.defaultDurationSec != null) {
      next.defaultDurationSec = builtin.defaultDurationSec
    }
    return next
  })
  if (synced.some((model) => model.id === builtin.id)) return synced
  return [builtin, ...synced]
}

/** 读盘时剔除已下线视频 API 格式（历史 settings 兼容） */
function isRetiredVideoApiFormat(apiFormat?: string): boolean {
  return String(apiFormat || '').trim().toLowerCase() === ('wei' + 'shi_api')
}

function isRetiredBuiltinVideoModelId(id?: string): boolean {
  const value = String(id || '')
  return (
    value === ('builtin-' + 'wei' + 'shi-api') ||
    value === 'builtin-shiguang-minimax-h3'
  )
}

function stripLegacyVideoApiFormats(models: ModelConfig[]): ModelConfig[] {
  return models
    .map(normalizeVideoModelConfig)
    .filter((model) => {
      if (isRetiredBuiltinVideoModelId(model.id)) return false
      return !isRetiredVideoApiFormat(model.apiFormat)
    })
}

function pickValidModelId(
  preferred: string | undefined,
  models: ModelConfig[],
  fallbackId?: string,
): string | undefined {
  if (preferred && models.some((model) => model.id === preferred)) return preferred
  if (fallbackId && models.some((model) => model.id === fallbackId)) return fallbackId
  return models[0]?.id
}

function ensureDefaultModelIds(settings: AppSettings): AppSettings {
  const llmModels = ensureBuiltinModel(settings.llmModels ?? [], BUILTIN_AGNES_LLM, {
    forceEndpoint: true,
  })
  const imageModels = ensureBuiltinModel(settings.imageModels ?? [], BUILTIN_AGNES_IMAGE)
  const videoModels = stripLegacyVideoApiFormats(settings.videoModels ?? [])

  return {
    ...settings,
    llmModels,
    imageModels,
    videoModels,
    defaultLlmModelId: BUILTIN_AGNES_LLM_ID,
    defaultImageModelId: pickValidModelId(
      settings.defaultImageModelId,
      imageModels,
      BUILTIN_AGNES_IMAGE_ID,
    ),
    defaultVideoModelId: pickValidModelId(settings.defaultVideoModelId, videoModels),
    lastUsedLlmModelId: pickValidModelId(
      settings.lastUsedLlmModelId,
      llmModels,
      BUILTIN_AGNES_LLM_ID,
    ),
    lastUsedEpisodeLlmModelId: pickValidModelId(
      settings.lastUsedEpisodeLlmModelId,
      llmModels,
      BUILTIN_AGNES_LLM_ID,
    ),
    lastUsedStoryboardLlmModelId: pickValidModelId(
      settings.lastUsedStoryboardLlmModelId,
      llmModels,
      BUILTIN_AGNES_LLM_ID,
    ),
    lastUsedAssetImageModelId: pickValidModelId(
      settings.lastUsedAssetImageModelId,
      imageModels,
      BUILTIN_AGNES_IMAGE_ID,
    ),
    lastUsedStoryboardImageModelId: pickValidModelId(
      settings.lastUsedStoryboardImageModelId,
      imageModels,
      BUILTIN_AGNES_IMAGE_ID,
    ),
    lastUsedStoryboardVideoModelId: pickValidModelId(
      settings.lastUsedStoryboardVideoModelId,
      videoModels,
    ),
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
