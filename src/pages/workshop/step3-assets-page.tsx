import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { ASSET_KIND_UI } from '@/components/workshop/asset-kind-labels'
import { WorkshopAiButton, WORKSHOP_AI_TOKENS } from '@/components/workshop/workshop-ai-button'
import { getLlmModelSelectionError } from '@/lib/models/llm-client'
import { AssetListPanel } from '@/components/workshop/asset-list-panel'
import { AssetDetailPanel } from '@/components/workshop/asset-detail-panel'
import { WorkflowStyleFollowBar } from '@/components/workshop/workflow-style-follow-bar'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import {
  isAssetStyleFollowingProject,
  resolveEffectiveAssetStyleKey,
  resolveProjectVisualStyleSummary,
} from '@/lib/workflow/project-visual-style'
import {
  getStylePresetSelectOptions,
} from '@/lib/workflow/style-presets'
import {
  ASSET_KIND_LABEL,
  ASSET_LIST_KEY,
  buildImageFieldsFromPaths,
  clearAssetReviewPatch,
  createEmptyAsset,
  filterAssetsByEpisode,
  findWorkflowAsset,
  findWorkflowAssetById,
  getAssetPreviewPath,
  getGeneratedImagePaths,
  getReferenceImagePaths,
  getSelectedReferenceImagePath,
  linkEpisodeEntitiesFromScript,
  mergeEntityList,
  patchWorkflowAssetInData,
  removeWorkflowAssetFromData,
  resetStuckGeneratingAssets,
  shouldPersistAssetPatchImmediately,
  syncProjectAssetEpisodeLinks,
  updateAssetList,
  validateAssetDescription,
  shouldClearReviewForImageChange,
  formatBatchAssetImageToast,
  formatAssetImageGeneratedToast,
  formatAssetImageFailedToast,
  ASSET_IMAGE_GENERATED_LABEL,
  ASSET_IMAGE_FAILED_LABEL,
} from '@/lib/workflow/asset-utils'
import {
  generateAssetImage,
  generateAssetImageBatch,
  isGenerationCancelledError,
} from '@/lib/workflow/image-generate-service'
import {
  createImageTaskId,
  finishImageGenerationTask,
  listInflightImageGenerations,
  registerInflightImageGeneration,
  reconcileStaleImageTasks,
  startImageGenerationTask,
  cancelImageGenerationTask,
} from '@/lib/workflow/image-task-service'
import { isActiveTaskStatus } from '@/lib/workflow/task-service'
import { readWorkflowTasks } from '@/lib/storage/workflow-service'
import { registerWorkflowAssetImageStopHandler } from '@/lib/workflow/workflow-generation-stop'
import { IMAGE_BATCH_CONCURRENCY, WORKSHOP_AUTO_SAVE_INTERVAL_MS } from '@/constants/batch-concurrency'
import {
  syncCharacterToReview,
  resolveAssetReviewModelFromVideoModel,
} from '@/lib/workflow/character-review-service'
import { openAssetInExplorer } from '@/lib/workflow/asset-explorer'
import { getAssetReviewSnapshot } from '@/lib/workflow/asset-review-status'
import { isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { resolveSoftwareImageModelId } from '@/lib/models/software-model-prefs'
import { buildModelSelectOptions } from '@/lib/models/model-select-options'
import { ImageGenerationTierField } from '@/components/models/image-generation-tier-field'
import { ImageGenerationCostHint } from '@/components/models/image-generation-cost-hint'
import { useImageGenerationCostPreview } from '@/hooks/use-image-generation-cost-preview'
import {
  normalizeImageGenerationTierParams,
  resolveAssetImageTierPrefs,
  type ImageGenerationTierParams,
} from '@/lib/models/image-generation-tier-params'
import {
  DEFAULT_IMAGE_SIZE,
  normalizeImageSizePreset,
  resolveImageSizeApiValue,
  toImageSizeSelectOptions,
} from '@/lib/workflow/image-size-presets'
import { findShotsReferencingAsset, getAssetDeleteConfirmContent, syncProjectShotsReferencedAssets } from '@/lib/workflow/shot-utils'
import {
  collectSyncedAssetIds,
  isAssetSyncedToLibrary,
  materialLibrarySyncSuccessMessage,
  syncAssetToMaterialLibrary,
  type MaterialLibraryItem,
} from '@/lib/materials/material-library-service'
import {
  readMaterialsIndex,
  type MaterialsIndexFile,
} from '@/lib/materials/materials-index-service'
import {
  cloneAssetFromMaterialLibrary,
  resolveUniqueAssetName,
} from '@/lib/materials/import-material-asset'
import { MaterialLibraryPickerDialog } from '@/components/workshop/material-library-picker-dialog'
import { createEmptyMaterialsIndex } from '@/types/material-library'
import { updateEpisode } from '@/lib/workflow/episode-utils'
import { useSettingsStore } from '@/stores/settings-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import { useActiveEpisode } from '@/hooks/use-active-episode'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import type { AssetKind, WorkflowAsset } from '@/types/workflow'
import { cn } from '@/lib/utils'

const ALL_EPISODES = '__all__'

type AssetImageGenerationSession = {
  controller: AbortController
  taskId: string | null
  taskStartedAt: number
  cancelled: boolean
}

function entityField(kind: AssetKind) {
  if (kind === 'character') return 'characters' as const
  if (kind === 'scene') return 'scenes' as const
  return 'items' as const
}

export function Step3AssetsPage() {
  const projectId = useWorkflowSessionStore((s) => s.projectId)
  const meta = useWorkflowSessionStore((s) => s.meta)
  const data = useWorkflowSessionStore((s) => s.data)
  const dirty = useWorkflowSessionStore((s) => s.dirty)
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const save = useWorkflowSessionStore((s) => s.save)

  const settings = useSettingsStore((s) => s.settings)
  const appDataDir = useSettingsStore((s) => s.appDataDir)
  const loadSettings = useSettingsStore((s) => s.load)
  const getMergedModels = useSettingsStore((s) => s.getMergedModels)
  const systemModelsByKind = useSettingsStore((s) => s.systemModelsByKind)

  const mergedLlmModels = useMemo(
    () => getMergedModels('llm'),
    [getMergedModels, systemModelsByKind, settings?.llmModels],
  )

  const [activeKind, setActiveKind] = useState<AssetKind>('character')
  const [episodeFilterOverride, setEpisodeFilterOverride] = useState<string | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [batchGeneratingKinds, setBatchGeneratingKinds] = useState<Set<AssetKind>>(() => new Set())
  const isCurrentKindBatchGenerating = batchGeneratingKinds.has(activeKind)
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({})
  const [syncingReview, setSyncingReview] = useState(false)
  const [syncingToMaterialLibrary, setSyncingToMaterialLibrary] = useState(false)
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false)
  const [materialsIndex, setMaterialsIndex] = useState<MaterialsIndexFile>(createEmptyMaterialsIndex())
  const [imageSize, setImageSize] = useState(DEFAULT_IMAGE_SIZE)
  const rememberAssetImageSize = useSettingsStore((s) => s.rememberLastUsedAssetImageSize)
  const rememberAssetImageModelId = useSettingsStore((s) => s.rememberLastUsedAssetImageModelId)
  const rememberAssetImageTierParams = useSettingsStore((s) => s.rememberLastUsedAssetImageTierParams)
  const rememberAssetStyleKey = useSettingsStore((s) => s.rememberLastUsedAssetStyleKey)
  const { ask, confirmDialog } = useConfirmDialog()
  const assetImageGenerationSessionsRef = useRef<Map<string, AssetImageGenerationSession>>(new Map())
  const stuckResetDone = useRef(false)

  useEffect(() => {
    stuckResetDone.current = false
  }, [projectId])

  // 重启/关闭后 asset.status 可能仍为 generating（已写入 data.json），进入 Step3 时清理卡死状态
  useEffect(() => {
    if (stuckResetDone.current || !data || !projectId) return
    const hasStuck = [...(data.characters ?? []), ...(data.scenes ?? []), ...(data.props ?? [])].some(
      (asset) => asset.status === 'generating',
    )
    if (!hasStuck) {
      stuckResetDone.current = true
      return
    }

    let cancelled = false
    void (async () => {
      const preserveAssetIds = new Set<string>()
      try {
        await reconcileStaleImageTasks(projectId)
        const tasks = await readWorkflowTasks(projectId)
        for (const task of tasks) {
          if (
            task.type === 'image' &&
            isActiveTaskStatus(task.status) &&
            task.assetId &&
            listInflightImageGenerations(projectId).some((s) => s.taskId === task.id)
          ) {
            preserveAssetIds.add(task.assetId)
          }
        }
        for (const assetId of assetImageGenerationSessionsRef.current.keys()) {
          preserveAssetIds.add(assetId)
        }
        for (const session of listInflightImageGenerations(projectId)) {
          if (session.assetId) preserveAssetIds.add(session.assetId)
        }
      } catch {
        /* 读取失败时仍清理明显卡死的 generating */
      }
      if (cancelled) return
      stuckResetDone.current = true
      const next = resetStuckGeneratingAssets(data, preserveAssetIds)
      if (next !== data) {
        patchData(next)
        void save({ silent: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [data, patchData, projectId, save])

  useEffect(() => {
    if (!settings) return
    setImageSize(
      normalizeImageSizePreset(settings.lastUsedAssetImageSize, DEFAULT_IMAGE_SIZE),
    )
  }, [settings?.lastUsedAssetImageSize, settings])

  const handleImageSizeChange = useCallback(
    (value: string) => {
      setImageSize(value)
      rememberAssetImageSize(value)
    },
    [rememberAssetImageSize],
  )

  const { activeEpisodeId, setActiveEpisodeId } = useActiveEpisode()

  useEffect(() => {
    if (!settings) loadSettings()
  }, [settings, loadSettings])

  const imageModels = useMemo(
    () => getMergedModels('image').filter((m) => !isWeishiApiModel(m)),
    [getMergedModels, systemModelsByKind, settings?.imageModels],
  )

  const imageModelId = useMemo(
    () => resolveSoftwareImageModelId(settings, imageModels),
    [
      imageModels,
      settings?.lastUsedAssetImageModelId,
      settings?.lastUsedStoryboardImageModelId,
    ],
  )

  const activeImageModel = useMemo(
    () => imageModels.find((model) => model.id === imageModelId) ?? null,
    [imageModelId, imageModels],
  )

  const imageTierParams = useMemo(
    () => normalizeImageGenerationTierParams(activeImageModel, null, resolveAssetImageTierPrefs(settings)),
    [
      activeImageModel,
      settings?.lastUsedAssetImageQuality,
      settings?.lastUsedAssetImageResolution,
    ],
  )

  const handleImageTierParamsChange = useCallback(
    (next: ImageGenerationTierParams) => {
      rememberAssetImageTierParams({
        resolution: next.resolution,
        quality: next.quality,
      })
    },
    [rememberAssetImageTierParams],
  )

  const { previewText: imageCostPreview, loading: imageCostLoading } = useImageGenerationCostPreview({
    model: activeImageModel,
    tierParams: imageTierParams,
    apiBase: settings?.apiBaseUrl,
  })

  useEffect(() => {
    if (!activeImageModel) return
    const normalized = normalizeImageGenerationTierParams(
      activeImageModel,
      null,
      resolveAssetImageTierPrefs(settings),
    )
    const current = resolveAssetImageTierPrefs(settings)
    if (
      normalized.resolution === (current.resolution ?? null) &&
      normalized.quality === (current.quality ?? null)
    ) {
      return
    }
    rememberAssetImageTierParams({
      resolution: normalized.resolution,
      quality: normalized.quality,
    })
  }, [activeImageModel?.id])

  const handleImageModelChange = useCallback(
    (id: string) => {
      rememberAssetImageModelId(id)
    },
    [rememberAssetImageModelId],
  )

  const selectedReviewModel = useMemo(
    () =>
      resolveAssetReviewModelFromVideoModel(
        settings?.videoModels ?? [],
        settings?.lastUsedStoryboardVideoModelId,
        settings?.imageModels ?? [],
      ),
    [settings?.videoModels, settings?.lastUsedStoryboardVideoModelId, settings?.imageModels],
  )

  const episodes = data?.episodes ?? []
  const listKey = ASSET_LIST_KEY[activeKind]
  const allAssets = (data?.[listKey] ?? []) as WorkflowAsset[]
  const stylePresetKey = resolveEffectiveAssetStyleKey(data, settings)
  const followingProjectStyle = isAssetStyleFollowingProject(data)
  const projectStyleSummary = resolveProjectVisualStyleSummary(data, settings)
  const handleStylePresetChange = useCallback(
    (styleKey: string) => {
      patchData({ assetStyleOverrideKey: styleKey })
      rememberAssetStyleKey(activeKind, styleKey)
    },
    [activeKind, patchData, rememberAssetStyleKey],
  )
  const handleFollowProjectStyleChange = useCallback(
    (following: boolean) => {
      if (following) {
        patchData({ assetStyleOverrideKey: undefined })
        return
      }
      patchData({ assetStyleOverrideKey: stylePresetKey })
    },
    [patchData, stylePresetKey],
  )
  const stylePresetOptions = useMemo(
    () => getStylePresetSelectOptions(settings),
    [settings],
  )

  useEffect(() => {
    setEpisodeFilterOverride(null)
  }, [projectId])

  const episodeFilterId = useMemo(() => {
    if (episodeFilterOverride !== null) return episodeFilterOverride
    if (activeEpisodeId) return activeEpisodeId
    if (episodes.length > 0) return episodes[0].id
    return ALL_EPISODES
  }, [activeEpisodeId, episodeFilterOverride, episodes])

  const setEpisodeFilterId = useCallback(
    (id: string) => {
      setEpisodeFilterOverride(id)
      if (id !== ALL_EPISODES) setActiveEpisodeId(id)
    },
    [setActiveEpisodeId],
  )

  useEffect(() => {
    if (episodeFilterId !== ALL_EPISODES && episodes.length > 0) {
      if (!episodes.some((ep) => ep.id === episodeFilterId)) {
        setEpisodeFilterOverride(episodes[0].id)
        setActiveEpisodeId(episodes[0].id)
      }
    }
  }, [episodes, episodeFilterId, setActiveEpisodeId])

  const selectedEpisode = useMemo(() => {
    if (episodeFilterId === ALL_EPISODES) return null
    return episodes.find((ep) => ep.id === episodeFilterId) ?? null
  }, [episodeFilterId, episodes])

  const filteredAssets = useMemo(
    () => filterAssetsByEpisode(allAssets, selectedEpisode, activeKind),
    [allAssets, selectedEpisode, activeKind],
  )

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => save({ silent: true }), WORKSHOP_AUTO_SAVE_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, allAssets, save])

  const selectedIndex = useMemo(
    () => filteredAssets.findIndex((a) => a.id === selectedAssetId),
    [filteredAssets, selectedAssetId],
  )

  const selectedAsset = selectedIndex >= 0 ? filteredAssets[selectedIndex] : null

  const syncedToMaterialLibrary = useMemo(() => {
    if (!selectedAsset || !projectId) return false
    return isAssetSyncedToLibrary(selectedAsset, projectId, materialsIndex)
  }, [selectedAsset, projectId, materialsIndex])

  const syncedAssetIds = useMemo(
    () => (projectId ? collectSyncedAssetIds(materialsIndex, projectId) : new Set<string>()),
    [materialsIndex, projectId],
  )

  const projectRoot = useMemo(() => {
    if (!settings || !projectId) return undefined
    return resolveProjectRoot(settings, appDataDir, projectId)
  }, [settings, appDataDir, projectId])

  useEffect(() => {
    if (filteredAssets.length === 0) {
      setSelectedAssetId(null)
      return
    }
    if (!selectedAssetId || !filteredAssets.some((a) => a.id === selectedAssetId)) {
      setSelectedAssetId(filteredAssets[0].id)
    }
  }, [filteredAssets, selectedAssetId])

  useEffect(() => {
    let cancelled = false
    void readMaterialsIndex().then((index) => {
      if (!cancelled) setMaterialsIndex(index)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, selectedAssetId])

  useEffect(() => {
    let cancelled = false
    const loadPreviews = async () => {
      if (!settings || !projectId) return
      const projectRoot = resolveProjectRoot(settings, appDataDir, projectId)
      const entries = await Promise.all(
        filteredAssets.map(async (asset) => {
          const path = getAssetPreviewPath(asset)
          const url = path ? await readImageAsDataUrl(path, projectRoot) : null
          return [asset.id, url] as const
        }),
      )
      if (!cancelled) {
        setPreviewMap(Object.fromEntries(entries.filter(([, url]) => url)))
      }
    }
    void loadPreviews()
    return () => {
      cancelled = true
    }
  }, [filteredAssets, settings, appDataDir, projectId])

  const episodeOptions = useMemo(
    () => [
      { value: ALL_EPISODES, label: '全部' },
      ...episodes.map((ep) => ({
        value: ep.id,
        label: `第${ep.episodeIndex}集`,
      })),
    ],
    [episodes],
  )

  const imageModelOptions = useMemo(
    () =>
      buildModelSelectOptions(
        getMergedModels('image').filter((m) => !isWeishiApiModel(m)),
        'image',
      ),
    [getMergedModels, systemModelsByKind, settings?.imageModels],
  )

  const resolvedImageSize = useMemo(
    () => resolveImageSizeApiValue(imageSize),
    [imageSize],
  )

  const patchAllAssets = useCallback(
    (nextAll: WorkflowAsset[]) => {
      const current = useWorkflowSessionStore.getState().data
      if (!current) return
      const nextData = { ...current, [listKey]: nextAll }
      patchData(
        current.episodes.length > 0 ? syncProjectAssetEpisodeLinks(nextData) : { [listKey]: nextAll },
      )
    },
    [listKey, patchData],
  )

  /** 按 id 增量更新，始终基于 store 最新快照，避免异步生图覆盖其它资产的编辑 */
  const patchAssetById = useCallback(
    (
      assetId: string,
      patch: Partial<WorkflowAsset>,
      options?: { persist?: boolean; kind?: AssetKind },
    ) => {
      const store = useWorkflowSessionStore.getState()
      const current = store.data
      if (!current) return

      const kind = options?.kind ?? activeKind
      const targetListKey = ASSET_LIST_KEY[kind]
      const nextData = patchWorkflowAssetInData(current, kind, assetId, patch)
      store.patchData(
        current.episodes.length > 0
          ? nextData
          : { [targetListKey]: nextData[targetListKey] },
      )

      const persist = options?.persist ?? shouldPersistAssetPatchImmediately(patch)
      if (persist) void store.save({ silent: true })
    },
    [activeKind],
  )

  const patchSelectedAsset = useCallback(
    (patch: Partial<WorkflowAsset>) => {
      if (!selectedAssetId) return
      patchAssetById(selectedAssetId, patch)
    },
    [patchAssetById, selectedAssetId],
  )

  const buildAssetImageMessage = useCallback(
    (asset: WorkflowAsset, suffix: string) => {
      const label = asset.name?.trim() || ASSET_KIND_LABEL[activeKind]
      return `${label}：${suffix}`
    },
    [activeKind],
  )

  const stopAssetImageGeneration = useCallback(
    async (assetId: string, options?: { taskId?: string | null; silent?: boolean }) => {
      if (!projectId) return false
      const session = assetImageGenerationSessionsRef.current.get(assetId)
      const taskId = options?.taskId ?? session?.taskId ?? null

      if (session) {
        if (session.cancelled) return true
        session.cancelled = true
        session.controller.abort()
        assetImageGenerationSessionsRef.current.delete(assetId)
      }

      const store = useWorkflowSessionStore.getState()
      const currentAsset =
        (store.data ? findWorkflowAssetById(store.data, assetId) : undefined) ?? null
      const assetKind = currentAsset?.kind ?? activeKind
      if (currentAsset?.status === 'generating') {
        patchAssetById(
          assetId,
          {
            status: getGeneratedImagePaths(currentAsset).length > 0 ? 'done' : 'failed',
          },
          { kind: assetKind },
        )
        await save({ silent: true })
      }

      if (taskId) {
        await cancelImageGenerationTask(projectId, taskId, {
          progressMessage: '已终止',
          errorMessage: '生图已取消',
        })
      }

      if (!options?.silent) {
        toast.message('已停止生成', {
          description: '本次任务已取消；若资产原先有成品图，仍会保留。',
        })
      }
      return true
    },
    [activeKind, patchAssetById, projectId, save],
  )

  useEffect(() => {
    registerWorkflowAssetImageStopHandler(stopAssetImageGeneration)
    return () => registerWorkflowAssetImageStopHandler(null)
  }, [stopAssetImageGeneration])

  const handleGenerateOne = async () => {
    if (!selectedAsset || !settings) return
    const assetId = selectedAsset.id
    const assetAtStart = selectedAsset
    const descriptionError = validateAssetDescription(assetAtStart)
    if (descriptionError) {
      toast.warning(descriptionError)
      return
    }
    const taskId = projectId ? createImageTaskId() : null
    const controller = new AbortController()
    if (projectId && taskId) {
      assetImageGenerationSessionsRef.current.set(assetId, {
        controller,
        taskId,
        taskStartedAt: 0,
        cancelled: false,
      })
    }
    patchAssetById(assetId, { status: 'generating' }, { kind: assetAtStart.kind })
    const refPath = getSelectedReferenceImagePath(assetAtStart)
    const uploadToastId = refPath ? 'asset-ref-upload' : undefined

    const runGeneration = async () => {
      let taskStartedAt = 0
      if (projectId && taskId) {
        taskStartedAt = await startImageGenerationTask(projectId, taskId, {
          episode: selectedEpisode,
          progressMessage: buildAssetImageMessage(assetAtStart, '生图中…'),
          assetId,
        })
        const session = assetImageGenerationSessionsRef.current.get(assetId)
        if (session) session.taskStartedAt = taskStartedAt
      }
      try {
        const imagePath = await generateAssetImage(assetAtStart, {
          settings,
          projectId: projectId || undefined,
          appDataDir,
          projectStyleKey: stylePresetKey,
          imageSize: resolvedImageSize,
          signal: controller.signal,
          onReferencePhase: (phase) => {
            if (!uploadToastId) return
            if (phase === 'start') {
              toast.loading('正在上传并校验参考图…', { id: uploadToastId })
              return
            }
            // 上传/校验结束：立即关掉，勿挂到整次生图结束
            toast.dismiss(uploadToastId)
          },
        })
        const session = assetImageGenerationSessionsRef.current.get(assetId)
        if (session?.cancelled) return
        const store = useWorkflowSessionStore.getState()
        const currentAsset =
          (store.data ? findWorkflowAsset(store.data, assetAtStart.kind, assetId) : undefined) ??
          assetAtStart
        const nextGens = [...getGeneratedImagePaths(currentAsset), imagePath]
        patchAssetById(
          assetId,
          {
            ...buildImageFieldsFromPaths(
              getReferenceImagePaths(currentAsset),
              nextGens,
              nextGens.length - 1,
            ),
            status: 'done',
            ...(shouldClearReviewForImageChange(currentAsset, imagePath)
              ? clearAssetReviewPatch()
              : {}),
          },
          { kind: assetAtStart.kind },
        )
        await save({ silent: true })
        if (projectId && taskId) {
          await finishImageGenerationTask(
            projectId,
            taskId,
            {
              status: 'completed',
              progressMessage: buildAssetImageMessage(assetAtStart, ASSET_IMAGE_GENERATED_LABEL),
            },
            taskStartedAt,
            selectedEpisode,
          )
        }
        toast.success(formatAssetImageGeneratedToast(assetAtStart))
      } catch (error: unknown) {
        const session = assetImageGenerationSessionsRef.current.get(assetId)
        if (session?.cancelled || isGenerationCancelledError(error)) {
          return
        }
        patchAssetById(assetId, { status: 'failed' }, { kind: assetAtStart.kind })
        await save({ silent: true })
        const message = (error as Error).message || '生图失败'
        if (projectId && taskId) {
          await finishImageGenerationTask(
            projectId,
            taskId,
            {
              status: 'failed',
              progressMessage: buildAssetImageMessage(assetAtStart, ASSET_IMAGE_FAILED_LABEL),
              errorMessage: message,
            },
            taskStartedAt,
            selectedEpisode,
          )
        }
        toast.error(formatAssetImageFailedToast(assetAtStart, message))
      } finally {
        assetImageGenerationSessionsRef.current.delete(assetId)
        if (uploadToastId) toast.dismiss(uploadToastId)
      }
    }

    const generationPromise = runGeneration()
    if (projectId && taskId) {
      registerInflightImageGeneration(projectId, taskId, generationPromise, { assetId })
    }
    await generationPromise
  }

  const pendingBatchAssets = useMemo(
    () => filteredAssets.filter((asset) => asset.status !== 'done'),
    [filteredAssets],
  )

  const runAssetBatchGenerate = useCallback(
    async (list: WorkflowAsset[], actionLabel: '生成' | '重新生成') => {
      if (!settings || list.length === 0) return
      const batchKind = activeKind
      const missingDescription = list.filter((asset) => validateAssetDescription(asset))
      if (missingDescription.length === list.length) {
        toast.warning(
          validateAssetDescription(list[0]) ?? `请先填写${ASSET_KIND_UI[batchKind].description}`,
        )
        return
      }
      if (missingDescription.length > 0) {
        toast.message(`已跳过 ${missingDescription.length} 个未填写描述的${ASSET_KIND_LABEL[batchKind]}`)
      }
      const runnable = list.filter((asset) => !validateAssetDescription(asset))
      if (runnable.length === 0) return

      setBatchGeneratingKinds((prev) => new Set(prev).add(batchKind))
      const taskMetaByAssetId = new Map<string, { taskId: string; taskStartedAt: number }>()
      const batchStyleKey = resolveEffectiveAssetStyleKey(data, settings)
      try {
        const { successCount, failedCount, results, errors } = await generateAssetImageBatch(runnable, {
          settings,
          projectId: projectId || undefined,
          appDataDir,
          projectStyleKey: batchStyleKey,
          imageSize: resolvedImageSize,
          concurrency: IMAGE_BATCH_CONCURRENCY,
          onItemStart: async (asset) => {
            patchAssetById(asset.id, { status: 'generating' }, { kind: batchKind })
            if (!projectId) return
            const taskId = createImageTaskId()
            const controller = new AbortController()
            assetImageGenerationSessionsRef.current.set(asset.id, {
              controller,
              taskId,
              taskStartedAt: 0,
              cancelled: false,
            })
            const taskStartedAt = await startImageGenerationTask(projectId, taskId, {
              episode: selectedEpisode,
              progressMessage: buildAssetImageMessage(asset, '生图中…'),
              assetId: asset.id,
            })
            const session = assetImageGenerationSessionsRef.current.get(asset.id)
            if (session) session.taskStartedAt = taskStartedAt
            taskMetaByAssetId.set(asset.id, { taskId, taskStartedAt })
          },
          resolveItemOptions: (asset) => {
            const session = assetImageGenerationSessionsRef.current.get(asset.id)
            return session ? { signal: session.controller.signal } : undefined
          },
          onItemComplete: async (asset, imagePath, error) => {
            const meta = taskMetaByAssetId.get(asset.id)
            const session = assetImageGenerationSessionsRef.current.get(asset.id)
            const cancelled = session?.cancelled ?? false

            if (!imagePath) {
              if (!cancelled) {
                patchAssetById(asset.id, { status: 'failed' }, { kind: batchKind })
              }
            } else {
              const store = useWorkflowSessionStore.getState()
              const currentAsset =
                (store.data ? findWorkflowAsset(store.data, batchKind, asset.id) : undefined) ??
                asset
              const nextGens = [...getGeneratedImagePaths(currentAsset), imagePath]
              patchAssetById(
                asset.id,
                {
                  ...buildImageFieldsFromPaths(
                    getReferenceImagePaths(currentAsset),
                    nextGens,
                    nextGens.length - 1,
                  ),
                  status: 'done',
                  ...(shouldClearReviewForImageChange(currentAsset, imagePath)
                    ? clearAssetReviewPatch()
                    : {}),
                },
                { kind: batchKind },
              )
            }

            if (projectId && meta) {
              if (imagePath) {
                await finishImageGenerationTask(
                  projectId,
                  meta.taskId,
                  {
                    status: 'completed',
                    progressMessage: buildAssetImageMessage(asset, ASSET_IMAGE_GENERATED_LABEL),
                  },
                  meta.taskStartedAt,
                  selectedEpisode,
                )
              } else if (cancelled) {
                await finishImageGenerationTask(
                  projectId,
                  meta.taskId,
                  {
                    status: 'failed',
                    progressMessage: buildAssetImageMessage(asset, '已取消'),
                    errorMessage: '生图已取消',
                  },
                  meta.taskStartedAt,
                  selectedEpisode,
                )
              } else {
                await finishImageGenerationTask(
                  projectId,
                  meta.taskId,
                  {
                    status: 'failed',
                    progressMessage: buildAssetImageMessage(asset, ASSET_IMAGE_FAILED_LABEL),
                    errorMessage: error || '生图失败',
                  },
                  meta.taskStartedAt,
                  selectedEpisode,
                )
              }
              taskMetaByAssetId.delete(asset.id)
            }
            assetImageGenerationSessionsRef.current.delete(asset.id)
          },
        })

        await save({ silent: true })
        const successAssets = runnable.filter((asset) => Boolean(results[asset.id]))
        const failedAssets = runnable.filter((asset) => Boolean(errors[asset.id]))
        const summary = formatBatchAssetImageToast(successAssets, failedAssets)
        if (failedCount === 0) {
          toast.success(summary)
        } else if (successCount > 0) {
          toast.message(summary)
        } else {
          toast.error(summary)
        }
      } catch (error: unknown) {
        if (projectId) {
          for (const [assetId, meta] of taskMetaByAssetId) {
            await finishImageGenerationTask(
              projectId,
              meta.taskId,
              {
                status: 'failed',
                progressMessage: '批量生图已中断',
                errorMessage: (error as Error).message || '批量生图失败',
              },
              meta.taskStartedAt,
              selectedEpisode,
            )
            assetImageGenerationSessionsRef.current.delete(assetId)
          }
          taskMetaByAssetId.clear()
        }
        await save({ silent: true })
        toast.error((error as Error).message || `批量${actionLabel}失败`)
      } finally {
        setBatchGeneratingKinds((prev) => {
          const next = new Set(prev)
          next.delete(batchKind)
          return next
        })
      }
    },
    [
      activeKind,
      appDataDir,
      buildAssetImageMessage,
      data,
      patchAssetById,
      projectId,
      resolvedImageSize,
      save,
      selectedEpisode,
      settings,
    ],
  )

  const handleBatchGeneratePending = useCallback(() => {
    if (pendingBatchAssets.length === 0) {
      toast.message('当前列表没有待生成的资产')
      return
    }
    void runAssetBatchGenerate(pendingBatchAssets, '生成')
  }, [pendingBatchAssets, runAssetBatchGenerate])

  const handleBatchRegenerateAll = useCallback(() => {
    void runAssetBatchGenerate(filteredAssets, '重新生成')
  }, [filteredAssets, runAssetBatchGenerate])

  const handleStopBatchGenerating = useCallback(async () => {
    const generatingAssets = filteredAssets.filter((asset) => asset.status === 'generating')
    if (generatingAssets.length === 0) return
    for (const asset of generatingAssets) {
      await stopAssetImageGeneration(asset.id, { silent: true })
    }
    toast.message('已停止批量生成', {
      description: '进行中的任务已取消；若资产原先有成品图，仍会保留。',
    })
  }, [filteredAssets, stopAssetImageGeneration])

  const handleAddAsset = () => {
    if (!data) return
    const nextIndex = allAssets.length + 1
    const asset = createEmptyAsset(
      activeKind,
      `新${ASSET_KIND_LABEL[activeKind]}${nextIndex}`,
    )
    const nextAssets = [...allAssets, asset]

    if (selectedEpisode) {
      asset.episodeIndexes = [selectedEpisode.episodeIndex]
      asset.episodeIndex = selectedEpisode.episodeIndex
      const field = entityField(activeKind)
      const nextData = {
        ...data,
        [listKey]: nextAssets,
        episodes: updateEpisode(data.episodes, selectedEpisode.id, {
          [field]: mergeEntityList(selectedEpisode[field], [
            { name: asset.name, description: asset.description },
          ]),
        }),
      }
      patchData(syncProjectAssetEpisodeLinks(nextData))
    } else {
      patchAllAssets(nextAssets)
    }
    setSelectedAssetId(asset.id)
  }

  const handleMatchEpisodeFromScript = () => {
    if (!data || !selectedEpisode) return
    const linked = linkEpisodeEntitiesFromScript(selectedEpisode, allAssets, activeKind)
    const field = entityField(activeKind)
    const addedCount = linked[field].length - selectedEpisode[field].length
    if (addedCount <= 0) {
      toast.message('未在本集脚本中找到新的资产名称')
      return
    }
    patchData(
      syncProjectAssetEpisodeLinks({
        ...data,
        episodes: updateEpisode(data.episodes, selectedEpisode.id, { [field]: linked[field] }),
      }),
    )
    toast.success(`已匹配 ${addedCount} 个${ASSET_KIND_LABEL[activeKind]}到本集`)
  }

  const handleRemoveAsset = async (assetId?: string) => {
    const id = assetId ?? selectedAssetId
    if (!id || !data) return
    const asset = findWorkflowAsset(data, activeKind, id)
    const refs = findShotsReferencingAsset(data, id)
    const { title, description } = getAssetDeleteConfirmContent(refs, asset?.name)
    const ok = await ask({
      title,
      description,
      confirmLabel: '删除',
      variant: 'destructive',
    })
    if (!ok) return
    let nextData = removeWorkflowAssetFromData(data, activeKind, id)
    if (nextData.shots?.length) {
      nextData = {
        ...nextData,
        shots: syncProjectShotsReferencedAssets(nextData.shots, nextData),
      }
    }
    patchData(nextData)
    if (selectedAssetId === id) setSelectedAssetId(null)
  }

  const handleOpenAssetFolder = useCallback(
    async (asset: WorkflowAsset) => {
      if (!projectRoot) {
        toast.error('请先配置数据根目录')
        return
      }
      const result = await openAssetInExplorer(asset, projectRoot)
      if (!result.success) {
        toast.error(result.error || '无法打开文件夹')
      }
    },
    [projectRoot],
  )

  const goPrevAsset = () => {
    if (selectedIndex > 0) setSelectedAssetId(filteredAssets[selectedIndex - 1].id)
  }

  const goNextAsset = () => {
    if (selectedIndex >= 0 && selectedIndex < filteredAssets.length - 1) {
      setSelectedAssetId(filteredAssets[selectedIndex + 1].id)
    }
  }

  const handleSyncReview = async () => {
    if (!selectedAsset || !selectedReviewModel) {
      toast.error('请先在 Step4 生视频页选择视频大模型，或在设置中配置视频/图片模型')
      return
    }
    const assetId = selectedAsset.id
    setSyncingReview(true)
    try {
      const result = await syncCharacterToReview(selectedAsset, selectedReviewModel, {
        projectRoot,
        apiBaseUrl: settings?.apiBaseUrl,
      })

      const reviewPatch: Partial<WorkflowAsset> = {
        weishiAssetId: result.weishiAssetId,
        weishiAssetUrl: result.weishiAssetUrl,
        weishiAssetStatus: result.weishiAssetStatus,
        jimengAssetId: result.jimengAssetId,
        jimengAssetStatus: result.jimengAssetStatus,
        reviewImagePath: result.reviewImagePath,
      }

      const store = useWorkflowSessionStore.getState()
      const current = store.data
      if (!current) return

      const listKey = ASSET_LIST_KEY[selectedAsset.kind]
      const nextList = updateAssetList(current[listKey], assetId, reviewPatch)
      const nextData = { ...current, [listKey]: nextList }
      store.patchData(
        current.episodes.length > 0
          ? syncProjectAssetEpisodeLinks(nextData)
          : { [listKey]: nextList },
      )
      await store.save({ silent: true })

      const label = result.provider === 'weishi' ? '微视' : '即梦'
      const snapshot = getAssetReviewSnapshot({
        ...selectedAsset,
        ...reviewPatch,
      })
      if (snapshot.isApproved) {
        toast.success(`「${selectedAsset.name || '未命名角色'}」${label}审核已通过`)
      } else {
        toast.success(`已提交${label}审核：${selectedAsset.name || '未命名角色'}`)
      }
    } catch (error: unknown) {
      toast.error((error as Error).message || '同步审核失败')
    } finally {
      setSyncingReview(false)
    }
  }

  const existingProjectAssetNamesByKind = useMemo(
    () => ({
      character: data?.characters?.map((asset) => asset.name) ?? [],
      scene: data?.scenes?.map((asset) => asset.name) ?? [],
      prop: data?.props?.map((asset) => asset.name) ?? [],
    }),
    [data?.characters, data?.scenes, data?.props],
  )

  const handleImportFromMaterialLibrary = async (items: MaterialLibraryItem[]) => {
    if (!data || !projectId || !settings || !items.length) return

    try {
      let nextData = { ...data }
      let lastImportedId: string | null = null

      for (const item of items) {
        const kind = item.asset.kind
        const targetListKey = ASSET_LIST_KEY[kind]
        const currentList = [...nextData[targetListKey]]
        const uniqueName = resolveUniqueAssetName(
          currentList.map((asset) => asset.name),
          item.asset.name,
        )
        const asset = await cloneAssetFromMaterialLibrary({
          source: item,
          targetProjectId: projectId,
          settings,
          appDataDir,
          nameOverride: uniqueName,
        })
        const nextList = [...currentList, asset]
        nextData = { ...nextData, [targetListKey]: nextList }

        if (selectedEpisode) {
          const field = entityField(kind)
          nextData = {
            ...nextData,
            episodes: updateEpisode(nextData.episodes, selectedEpisode.id, {
              [field]: mergeEntityList(selectedEpisode[field], [
                { name: asset.name, description: asset.description },
              ]),
            }),
          }
        }

        if (kind === activeKind) {
          lastImportedId = asset.id
        }
      }

      patchData(
        nextData.episodes.length > 0 ? syncProjectAssetEpisodeLinks(nextData) : nextData,
      )
      if (lastImportedId) setSelectedAssetId(lastImportedId)
      await save({ silent: true })
      toast.success(`已从素材库导入 ${items.length} 个资产`)
    } catch (error: unknown) {
      toast.error((error as Error).message || '从素材库导入失败')
      throw error
    }
  }

  const handleSyncToMaterialLibrary = async () => {
    if (!selectedAsset || !projectId || !settings) return
    if (!getAssetPreviewPath(selectedAsset)) {
      toast.error('请先有参考图或生成图后再保存到素材库')
      return
    }
    setSyncingToMaterialLibrary(true)
    const wasSynced = syncedToMaterialLibrary
    try {
      await syncAssetToMaterialLibrary(
        selectedAsset,
        projectId,
        meta?.title?.trim() || projectId,
        settings,
        appDataDir,
        { projectKind: 'workflow' },
      )
      const index = await readMaterialsIndex()
      setMaterialsIndex(index)
      toast.success(materialLibrarySyncSuccessMessage(selectedAsset.name, wasSynced))
    } catch (error: unknown) {
      toast.error((error as Error).message || '保存到素材库失败')
    } finally {
      setSyncingToMaterialLibrary(false)
    }
  }

  if (!data) return null

  const viewingEpisode = episodeFilterId !== ALL_EPISODES
  const kindKeys: AssetKind[] = ['character', 'scene', 'prop']

  return (
    <div className="flex flex-col h-full min-h-0 gap-3">
      <div className="flex items-center gap-1 border-b border-border/30 shrink-0">
        {kindKeys.map((kind) => (
          <button
            key={kind}
            type="button"
            data-testid={`workshop-step3-tab-${kind}`}
            onClick={() => setActiveKind(kind)}
            className={cn(
              'px-5 py-2.5 text-sm transition-colors relative',
              activeKind === kind
                ? cn(WORKSHOP_AI_TOKENS.text, 'font-medium')
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {ASSET_KIND_UI[kind].tab}
            {activeKind === kind ? (
              <span className={cn('absolute bottom-0 left-2 right-2 h-0.5 rounded-full', WORKSHOP_AI_TOKENS.underline)} />
            ) : null}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0 gap-3">
        <div className="w-[272px] shrink-0 min-h-0">
          <AssetListPanel
            key={activeKind}
            kind={activeKind}
            assets={filteredAssets}
            selectedId={selectedAssetId}
            previewMap={previewMap}
            syncedAssetIds={syncedAssetIds}
            onSelect={setSelectedAssetId}
            onAdd={handleAddAsset}
            onImportFromLibrary={() => setMaterialPickerOpen(true)}
            onDelete={handleRemoveAsset}
            onOpenFolder={(asset) => void handleOpenAssetFolder(asset)}
            emptyContent={
              <div className="py-6 px-2 text-center text-xs text-muted-foreground space-y-3">
                <p>{viewingEpisode ? '本集暂无匹配项' : '暂无资产'}</p>
                {viewingEpisode && allAssets.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      className={cn(WORKSHOP_AI_TOKENS.textAccent, 'hover:underline')}
                      onClick={() => setEpisodeFilterId(ALL_EPISODES)}
                    >
                      查看全部（{allAssets.length}）
                    </button>
                    <button
                      type="button"
                      className={cn(WORKSHOP_AI_TOKENS.textAccent, 'hover:underline')}
                      onClick={handleMatchEpisodeFromScript}
                    >
                      按脚本匹配
                    </button>
                  </div>
                ) : null}
              </div>
            }
          />
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
          <div className="flex flex-wrap items-end gap-2 shrink-0 rounded-lg border border-border bg-card px-3 py-2.5">
            <div className="w-[130px] space-y-1">
              <Label className="text-[10px] text-muted-foreground">第几集</Label>
              <Select
                value={episodeFilterId}
                onChange={setEpisodeFilterId}
                options={episodeOptions}
                disabled={episodeOptions.length <= 1}
              />
            </div>
            {imageModelOptions.length > 0 ? (
              <div className="w-[160px] space-y-1">
                <Label className="text-[10px] text-muted-foreground">图片生成模型</Label>
                <Select
                  value={imageModelId}
                  onChange={handleImageModelChange}
                  options={imageModelOptions}
                  placeholder="选择生图模型"
                />
              </div>
            ) : null}
            <ImageGenerationTierField
              model={activeImageModel}
              value={imageTierParams}
              onChange={handleImageTierParamsChange}
            />
            <ImageGenerationCostHint
              text={imageCostPreview}
              loading={imageCostLoading}
              className="self-end pb-1 min-w-[88px]"
            />
            <div className="w-[220px]">
              <WorkflowStyleFollowBar
                label="生图风格"
                following={followingProjectStyle}
                projectStyleLabel={`${projectStyleSummary.categoryLabel} · ${projectStyleSummary.presetLabel}`}
                styleKey={stylePresetKey}
                styleOptions={stylePresetOptions}
                onFollowChange={handleFollowProjectStyleChange}
                onStyleChange={handleStylePresetChange}
              />
            </div>
            <div className="w-[168px] space-y-1">
              <Label className="text-[10px] text-muted-foreground">图片尺寸</Label>
              <Select
                value={imageSize}
                onChange={handleImageSizeChange}
                options={toImageSizeSelectOptions()}
              />
            </div>

            <div className="flex-1" />

            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid="workshop-step3-batch-regenerate"
              onClick={handleBatchRegenerateAll}
              disabled={isCurrentKindBatchGenerating || filteredAssets.length === 0}
              className="border-border/40 bg-transparent"
              title="对当前列表全部资产重新生图（含已完成）"
            >
              {isCurrentKindBatchGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              批量重新生成
            </Button>
            {isCurrentKindBatchGenerating ? (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="px-5"
                data-testid="workshop-step3-batch-stop"
                onClick={() => void handleStopBatchGenerating()}
              >
                停止批量生成
              </Button>
            ) : (
              <WorkshopAiButton
                type="button"
                sizePreset="toolbar"
                className="px-5"
                data-testid="workshop-step3-batch-generate"
                onClick={handleBatchGeneratePending}
                disabled={pendingBatchAssets.length === 0}
                title="仅对「待生成 / 失败」资产生图"
              >
                批量生成
              </WorkshopAiButton>
            )}
          </div>

          <div className="flex-1 min-h-0">
            <AssetDetailPanel
              kind={activeKind}
              asset={selectedAsset}
              projectId={projectId}
              settings={settings}
              appDataDir={appDataDir}
              generating={
                selectedAsset?.status === 'generating' || isCurrentKindBatchGenerating
              }
              canGoPrev={selectedIndex > 0}
              canGoNext={selectedIndex >= 0 && selectedIndex < filteredAssets.length - 1}
              projectRoot={projectRoot}
              reviewModel={selectedReviewModel}
              syncingReview={syncingReview}
              syncedToMaterialLibrary={syncedToMaterialLibrary}
              syncingToMaterialLibrary={syncingToMaterialLibrary}
              onPrev={goPrevAsset}
              onNext={goNextAsset}
              onChange={patchSelectedAsset}
              onGenerate={handleGenerateOne}
              onStopGenerate={
                selectedAsset
                  ? () => void stopAssetImageGeneration(selectedAsset.id)
                  : undefined
              }
              onSyncReview={activeKind === 'character' ? handleSyncReview : undefined}
              onSyncToMaterialLibrary={() => void handleSyncToMaterialLibrary()}
            />
          </div>
        </div>
      </div>

      {confirmDialog}

      <MaterialLibraryPickerDialog
        open={materialPickerOpen}
        defaultKind={activeKind}
        currentProjectId={projectId || ''}
        existingProjectAssetNamesByKind={existingProjectAssetNamesByKind}
        confirmLabel="导入到项目"
        onClose={() => setMaterialPickerOpen(false)}
        onConfirm={handleImportFromMaterialLibrary}
      />
    </div>
  )
}
