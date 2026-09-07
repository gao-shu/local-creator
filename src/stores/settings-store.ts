import { create } from 'zustand'

import { toast } from 'sonner'

import type { AppSettings, ModelConfig, ModelKind, PromptTemplate, TemplateListKey, ImageQuality } from '@/types/settings'

import { validateSettingsPaths } from '@/lib/storage/path-utils'

import { appendPathHistory, normalizeDataRootPath } from '@/lib/storage/storage-path-utils'

import { applyStorageRootToSettings } from '@/lib/storage/data-layout'

import { modelListKey } from '@/lib/models/default-model-utils'

import { bindDataRoot, readSettings, writeSettings } from '@/lib/storage/settings-service'

import { canEditApiBaseUrl, migrateApiBaseUrl, resolveApiBase, syncApiBaseToStorage } from '@/lib/auth/api-base'

import { getStylePresetValue } from '@/lib/workflow/style-presets'
import { normalizeLayoutKey } from '@/lib/workflow/layout-presets'
import type { VideoReferenceMode } from '@/lib/workflow/storyboard-video-presets'
import type { InferenceFormat } from '@/lib/workflow/storyboard-image-presets'



/** 开源版无公司系统模型目录；保留字段以免旧调用点崩溃 */
export type SystemModelsByKind = Record<ModelKind, ModelConfig[]>

const EMPTY_SYSTEM_MODELS: SystemModelsByKind = { llm: [], image: [], video: [] }

interface SettingsStore {

  settings: AppSettings | null

  filePath: string

  launcherDir: string

  dataRoot: string

  appDataDir: string

  loading: boolean

  saving: boolean

  dirty: boolean

  /** 恒为空；公司系统模型已删除 */
  systemModelsByKind: SystemModelsByKind

  load: () => Promise<void>

  getMergedModels: (kind: ModelKind) => ModelConfig[]

  save: (options?: { silent?: boolean; successMessage?: string }) => Promise<boolean>

  rememberLastUsedLlmModelId: (id: string) => void

  rememberLastUsedEpisodeLlmModelId: (id: string) => void

  rememberLastUsedStoryboardLlmModelId: (id: string) => void

  rememberLastUsedAssetImageSize: (presetValue: string) => void

  rememberLastUsedAssetImageTierParams: (patch: {
    resolution?: string | null
    quality?: ImageQuality | string | null
  }) => void

  rememberLastUsedStoryboardImageSize: (presetValue: string) => void

  rememberLastUsedAssetImageModelId: (modelId: string) => void

  rememberLastUsedStoryboardImageModelId: (modelId: string) => void

  rememberLastUsedStoryboardVideoModelId: (modelId: string) => void

  rememberLastUsedStoryboardVideoGenerateParams: (
    patch: Partial<{
      referenceMode: VideoReferenceMode
      duration: string
      aspectRatio: string
      resolution: string
    }>,
  ) => void

  rememberLastUsedStoryboardImageGenerateParams: (
    patch: Partial<{
      inferenceFormat: InferenceFormat
      concurrency: string
      resolution: string
      quality: ImageQuality | string
    }>,
  ) => void

  rememberLastUsedStoryboardPreviewPrefs: (
    patch: Partial<{
      previewMode: 'image' | 'video'
      previewAspect: 'landscape' | 'portrait'
    }>,
  ) => void

  rememberLastUsedAssetStyleKey: (kind: 'character' | 'scene' | 'prop', styleKey: string) => void

  rememberDefaultAssetLayoutKey: (kind: 'character' | 'scene' | 'prop', layoutKey: string) => void

  rememberLastUsedCanvasStoryboardTemplateKey: (templateKey: string) => void

  rememberLastUsedExtractTemplateKey: (templateKey: string) => void

  rememberLastUsedCanvasLayoutKey: (kind: 'character' | 'scene' | 'prop', layoutKey: string) => void

  rememberLastUsedStoryboardStyleKey: (styleKey: string) => void

  updateSettings: (patch: Partial<AppSettings>) => void

  updatePath: (key: keyof Pick<

    AppSettings,

    | 'characterLibraryPath'

    | 'sceneLibraryPath'

    | 'generatedImagesPath'

    | 'videoSavePath'

  >, value: string) => void

  updateDataRootPath: (value: string) => void

  importExistingDataRoot: (value: string) => Promise<boolean>

  addModel: (kind: ModelKind, config: ModelConfig) => void

  updateModel: (kind: ModelKind, id: string, patch: Partial<AppSettings['llmModels'][0]>) => void

  removeModel: (kind: ModelKind, id: string) => void

  setDefaultModel: (kind: ModelKind, id: string) => void

  addTemplate: (listKey: TemplateListKey, template: PromptTemplate) => void

  updateTemplate: (
    listKey: TemplateListKey,
    id: string,
    patch: Partial<PromptTemplate>,
  ) => void

  removeTemplate: (listKey: TemplateListKey, id: string) => void

}



function modelKey(kind: ModelKind): 'llmModels' | 'imageModels' | 'videoModels' {

  if (kind === 'llm') return 'llmModels'

  if (kind === 'image') return 'imageModels'

  return 'videoModels'

}

let loadSettingsInflight: Promise<void> | null = null

export const useSettingsStore = create<SettingsStore>((set, get) => ({

  settings: null,

  filePath: '',

  launcherDir: '',

  dataRoot: '',

  appDataDir: '',

  loading: false,

  saving: false,

  dirty: false,

  systemModelsByKind: EMPTY_SYSTEM_MODELS,

  getMergedModels: (kind) => {
    const state = get()
    if (!state.settings) return []
    const key = modelKey(kind)
    return state.settings[key] || []
  },

  load: async () => {
    if (loadSettingsInflight) return loadSettingsInflight
    loadSettingsInflight = (async () => {
      set({ loading: true })

      try {

        const res = await readSettings()

        if (!res.success) {

          toast.error(res.error || '加载设置失败')

          return

        }

        set({

          settings: res.data,

          filePath: res.filePath,

          launcherDir: res.launcherDir,

          dataRoot: res.dataRoot,

          appDataDir: res.appDataDir,

          dirty: false,

        })

        syncApiBaseToStorage(resolveApiBase(res.data?.apiBaseUrl))

      } finally {

        set({ loading: false })
        loadSettingsInflight = null

      }
    })()
    return loadSettingsInflight
  },



  save: async (options) => {

    const { settings } = get()

    if (!settings) return false



    if (!settings.dataRootPath?.trim()) {

      toast.error('请先在「存储位置」中选择数据根目录')

      return false

    }



    const pathErrors = validateSettingsPaths({

      dataRootPath: settings.dataRootPath,

      characterLibraryPath: settings.characterLibraryPath,

      sceneLibraryPath: settings.sceneLibraryPath,

      generatedImagesPath: settings.generatedImagesPath,

      videoSavePath: settings.videoSavePath,

    })

    if (pathErrors.length > 0) {

      toast.error(pathErrors[0])

      return false

    }



    set({ saving: true })

    try {

      const res = await writeSettings(settings)

      if (!res.success) {

        toast.error(res.error || '保存失败')

        return false

      }

      const root = res.dataRoot || settings.dataRootPath

      set({

        dirty: false,

        dataRoot: root,

        appDataDir: root,

        filePath: res.filePath || get().filePath,

      })

      if (!options?.silent) {
        toast.success(options?.successMessage || '设置已保存')
      }

      return true

    } finally {

      set({ saving: false })

    }

  },



  /** 工作流切换 LLM 时记录上次使用（静默写入 settings.json） */
  rememberLastUsedLlmModelId: (id) => {
    get().rememberLastUsedEpisodeLlmModelId(id)
  },

  rememberLastUsedEpisodeLlmModelId: (id) => {
    if (!id) return
    const state = get()
    if (!state.settings) return
    if (!state.getMergedModels('llm').some((m) => m.id === id)) return
    get().updateSettings({
      lastUsedEpisodeLlmModelId: id,
      lastUsedLlmModelId: id,
      lastUsedStoryboardLlmModelId: id,
    })
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardLlmModelId: (id) => {
    if (!id) return
    const state = get()
    if (!state.settings) return
    if (!state.getMergedModels('llm').some((m) => m.id === id)) return
    get().updateSettings({
      lastUsedStoryboardLlmModelId: id,
      lastUsedLlmModelId: id,
      lastUsedEpisodeLlmModelId: id,
    })
    void get().save({ silent: true })
  },

  rememberLastUsedAssetImageSize: (presetValue) => {
    if (!presetValue) return
    get().updateSettings({ lastUsedAssetImageSize: presetValue })
    void get().save({ silent: true })
  },

  rememberLastUsedAssetImageTierParams: (patch) => {
    if (!patch || Object.keys(patch).length === 0) return
    const settingsPatch: Partial<AppSettings> = {}
    if (patch.resolution !== undefined) {
      settingsPatch.lastUsedAssetImageResolution = patch.resolution || undefined
    }
    if (patch.quality !== undefined) {
      const quality = String(patch.quality ?? '').trim()
      settingsPatch.lastUsedAssetImageQuality =
        quality === 'low' || quality === 'medium' || quality === 'high'
          ? quality
          : undefined
    }
    get().updateSettings(settingsPatch)
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardImageSize: (presetValue) => {
    if (!presetValue) return
    get().updateSettings({ lastUsedStoryboardImageSize: presetValue })
    void get().save({ silent: true })
  },

  rememberLastUsedAssetImageModelId: (modelId) => {
    if (!modelId) return
    const state = get()
    if (!state.settings) return
    if (!state.getMergedModels('image').some((m) => m.id === modelId)) return
    get().updateSettings({
      lastUsedAssetImageModelId: modelId,
      lastUsedStoryboardImageModelId: modelId,
    })
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardImageModelId: (modelId) => {
    if (!modelId) return
    const state = get()
    if (!state.settings) return
    if (!state.getMergedModels('image').some((m) => m.id === modelId)) return
    get().updateSettings({
      lastUsedStoryboardImageModelId: modelId,
      lastUsedAssetImageModelId: modelId,
    })
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardVideoModelId: (modelId) => {
    if (!modelId) return
    const state = get()
    if (!state.settings) return
    if (!state.getMergedModels('video').some((m) => m.id === modelId)) return
    get().updateSettings({ lastUsedStoryboardVideoModelId: modelId })
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardVideoGenerateParams: (patch) => {
    if (!patch || Object.keys(patch).length === 0) return
    const settingsPatch: Partial<AppSettings> = {}
    if (patch.referenceMode) {
      settingsPatch.lastUsedStoryboardVideoReferenceMode = patch.referenceMode
    }
    if (patch.duration) settingsPatch.lastUsedStoryboardVideoDuration = patch.duration
    if (patch.aspectRatio) settingsPatch.lastUsedStoryboardVideoAspectRatio = patch.aspectRatio
    if (patch.resolution) settingsPatch.lastUsedStoryboardVideoResolution = patch.resolution
    get().updateSettings(settingsPatch)
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardImageGenerateParams: (patch) => {
    if (!patch || Object.keys(patch).length === 0) return
    const settingsPatch: Partial<AppSettings> = {}
    if (patch.inferenceFormat) {
      settingsPatch.lastUsedStoryboardImageInferenceFormat = patch.inferenceFormat
    }
    if (patch.concurrency) settingsPatch.lastUsedStoryboardBatchConcurrency = patch.concurrency
    if (patch.resolution) settingsPatch.lastUsedStoryboardImageResolution = patch.resolution
    if (patch.quality) {
      const quality = String(patch.quality).trim()
      if (quality === 'low' || quality === 'medium' || quality === 'high') {
        settingsPatch.lastUsedStoryboardImageQuality = quality
      }
    }
    get().updateSettings(settingsPatch)
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardPreviewPrefs: (patch) => {
    if (!patch || Object.keys(patch).length === 0) return
    const settingsPatch: Partial<AppSettings> = {}
    if (patch.previewMode) settingsPatch.lastUsedStoryboardPreviewMode = patch.previewMode
    if (patch.previewAspect) settingsPatch.lastUsedStoryboardPreviewAspect = patch.previewAspect
    get().updateSettings(settingsPatch)
    void get().save({ silent: true })
  },

  rememberLastUsedAssetStyleKey: (kind, styleKey) => {
    if (!styleKey) return
    const { settings } = get()
    if (!getStylePresetValue(styleKey, settings)) return
    get().updateSettings({
      lastUsedAssetStyleKeys: { ...settings?.lastUsedAssetStyleKeys, [kind]: styleKey },
    })
    void get().save({ silent: true })
  },

  rememberDefaultAssetLayoutKey: (kind, layoutKey) => {
    if (!layoutKey) return
    const assetKind = kind === 'prop' ? 'prop' : kind
    if (!normalizeLayoutKey(layoutKey, assetKind === 'prop' ? 'prop' : assetKind)) return
    const { settings } = get()
    get().updateSettings({
      defaultAssetLayoutKeys: { ...settings?.defaultAssetLayoutKeys, [kind]: layoutKey },
    })
    void get().save({ silent: true })
  },

  rememberLastUsedCanvasStoryboardTemplateKey: (templateKey) => {
    if (!templateKey) return
    const { settings } = get()
    const exists = settings?.storyboardTemplates?.some(
      (item) => item.key === templateKey || item.id === templateKey,
    )
    if (!exists) return
    get().updateSettings({ lastUsedCanvasStoryboardTemplateKey: templateKey })
    void get().save({ silent: true })
  },

  rememberLastUsedExtractTemplateKey: (templateKey) => {
    if (!templateKey) return
    const { settings } = get()
    const exists = settings?.extractTemplates?.some(
      (item) => item.key === templateKey || item.id === templateKey,
    )
    if (!exists) return
    get().updateSettings({ lastUsedExtractTemplateKey: templateKey })
    void get().save({ silent: true })
  },

  rememberLastUsedCanvasLayoutKey: (kind, layoutKey) => {
    if (!layoutKey) return
    const assetKind = kind === 'prop' ? 'prop' : kind
    if (!normalizeLayoutKey(layoutKey, assetKind === 'prop' ? 'prop' : assetKind)) return
    const { settings } = get()
    get().updateSettings({
      lastUsedCanvasLayoutKeys: { ...settings?.lastUsedCanvasLayoutKeys, [kind]: layoutKey },
    })
    void get().save({ silent: true })
  },

  rememberLastUsedStoryboardStyleKey: (styleKey) => {
    if (!styleKey) return
    const { settings } = get()
    if (!getStylePresetValue(styleKey, settings)) return
    get().updateSettings({ lastUsedStoryboardStyleKey: styleKey })
    void get().save({ silent: true })
  },

  updateSettings: (patch) => {

    const current = get().settings
    const nextPatch = { ...patch }

    if ('apiBaseUrl' in nextPatch) {
      if (!canEditApiBaseUrl(Boolean(current?.debugEnabled))) {
        delete nextPatch.apiBaseUrl
      } else if (typeof nextPatch.apiBaseUrl === 'string') {
        nextPatch.apiBaseUrl = migrateApiBaseUrl(nextPatch.apiBaseUrl)
      }
    }

    set((state) => ({

      settings: state.settings ? { ...state.settings, ...nextPatch } : state.settings,

      dirty: true,

    }))

    void get().save({ silent: true })

  },



  updatePath: (key, value) => {

    set((state) => {

      if (!state.settings) return state

      return {

        settings: { ...state.settings, [key]: value },

        dirty: true,

      }

    })

  },



  updateDataRootPath: (value) => {

    set((state) => {

      if (!state.settings) return state

      const normalized = normalizeDataRootPath(value)

      const previous = state.settings.dataRootPath

      const next = applyStorageRootToSettings(state.settings, normalized)

      return {

        settings: {

          ...next,

          dataRootPathHistory: previous

            ? appendPathHistory(state.settings.dataRootPathHistory, previous)

            : state.settings.dataRootPathHistory,

        },

        dirty: true,

      }

    })

  },



  importExistingDataRoot: async (value) => {

    const normalized = normalizeDataRootPath(value)

    if (!normalized) {

      toast.error('无效的数据目录')

      return false

    }

    const res = await bindDataRoot(normalized)

    if (!res.success || !res.data) {

      toast.error(res.error || '绑定数据目录失败')

      return false

    }

    set({

      settings: res.data,

      filePath: res.filePath || '',

      launcherDir: res.launcherDir || get().launcherDir,

      dataRoot: res.dataRoot || normalized,

      appDataDir: res.dataRoot || normalized,

      dirty: false,

    })

    toast.success(

      res.fileExists

        ? '已加载该目录中的配置与项目数据'

        : '已绑定新数据目录，保存后将在此创建配置',

    )

    return true

  },



  addModel: (kind, config) => {

    const key = modelKey(kind)

    set((state) => {

      if (!state.settings) return state

      const nextList = [...state.settings[key], config]
      const isFirst = nextList.length === 1

      const lastUsedPatch: Partial<AppSettings> = {}
      if (isFirst) {
        if (kind === 'llm') {
          lastUsedPatch.lastUsedEpisodeLlmModelId = config.id
          lastUsedPatch.lastUsedStoryboardLlmModelId = config.id
          lastUsedPatch.lastUsedLlmModelId = config.id
        }
        if (kind === 'image') {
          lastUsedPatch.lastUsedAssetImageModelId = config.id
          lastUsedPatch.lastUsedStoryboardImageModelId = config.id
        }
        if (kind === 'video') lastUsedPatch.lastUsedStoryboardVideoModelId = config.id
      }

      return {

        settings: {

          ...state.settings,

          [key]: nextList,

          ...lastUsedPatch,

        },

        dirty: true,

      }

    })

    void get().save({ silent: true })

  },



  updateModel: (kind, id, patch) => {

    const key = modelKey(kind)

    set((state) => {

      if (!state.settings) return state

      return {

        settings: {

          ...state.settings,

          [key]: state.settings[key].map((m) => (m.id === id ? { ...m, ...patch } : m)),

        },

        dirty: true,

      }

    })

    void get().save({ silent: true })

  },



  removeModel: (kind, id) => {

    const key = modelKey(kind)

    set((state) => {

      if (!state.settings) return state

      const nextList = state.settings[key].filter((m) => m.id !== id)
      const nextFallback = nextList[0]?.id

      const patch: Partial<AppSettings> = {
        [key]: nextList,
      }

      if (kind === 'llm') {
        if (state.settings.lastUsedEpisodeLlmModelId === id) {
          patch.lastUsedEpisodeLlmModelId = nextFallback
        }
        if (state.settings.lastUsedStoryboardLlmModelId === id) {
          patch.lastUsedStoryboardLlmModelId = nextFallback
        }
        if (state.settings.lastUsedLlmModelId === id) {
          patch.lastUsedLlmModelId = nextFallback
        }
      }
      if (kind === 'image') {
        if (state.settings.lastUsedAssetImageModelId === id) {
          patch.lastUsedAssetImageModelId = nextFallback
        }
        if (state.settings.lastUsedStoryboardImageModelId === id) {
          patch.lastUsedStoryboardImageModelId = nextFallback
        }
      }
      if (kind === 'video' && state.settings.lastUsedStoryboardVideoModelId === id) {
        patch.lastUsedStoryboardVideoModelId = nextFallback
      }

      return {

        settings: {

          ...state.settings,

          ...patch,

        },

        dirty: true,

      }

    })

    void get().save({ silent: true })

  },



  setDefaultModel: (_kind, _id) => {
    // 已废弃：模型选择由各工作流阶段「上次选用」记忆，不再维护默认大模型
  },



  addTemplate: (listKey, template) => {

    set((state) => {

      if (!state.settings) return state

      return {

        settings: {

          ...state.settings,

          [listKey]: [...state.settings[listKey], template],

        },

        dirty: true,

      }

    })

    void get().save({ silent: true })

  },



  updateTemplate: (listKey, id, patch) => {

    const { settings } = get()

    if (!settings) return

    const target = settings[listKey].find((t) => t.id === id)

    if (target?.isBuiltin) {

      toast.error('系统模板不可修改')

      return

    }

    set((state) => {

      if (!state.settings) return state

      return {

        settings: {

          ...state.settings,

          [listKey]: state.settings[listKey].map((t) =>

            t.id === id ? { ...t, ...patch } : t,

          ),

        },

        dirty: true,

      }

    })

    void get().save({ silent: true })

  },



  removeTemplate: (listKey, id) => {

    const { settings } = get()

    if (!settings) return

    const target = settings[listKey].find((t) => t.id === id)

    if (target?.isBuiltin) {

      toast.error('系统模板不可删除')

      return

    }

    set((state) => {

      if (!state.settings) return state

      return {

        settings: {

          ...state.settings,

          [listKey]: state.settings[listKey].filter((t) => t.id !== id),

        },

        dirty: true,

      }

    })

    void get().save({ silent: true })

  },

}))


