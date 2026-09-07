import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { VIDEO_BATCH_CONCURRENCY, WORKSHOP_AUTO_SAVE_INTERVAL_MS } from '@/constants/batch-concurrency'
import { StoryboardCenterPanel, type PreviewAspectMode } from '@/components/workshop/storyboard-center-panel'
import { getLlmModelSelectionError } from '@/lib/models/llm-client'
import {
  resolveSoftwareImageModelId,
  resolveSoftwareLlmModelId,
  resolveSoftwareVideoModelId,
} from '@/lib/models/software-model-prefs'
import { buildModelSelectOptions, buildVideoModelSelectOptions } from '@/lib/models/model-select-options'
import { formatUserFacingBillingError } from '@/lib/utils'
import { StoryboardLeftPanel } from '@/components/workshop/storyboard-left-panel'
import { MaterialLibraryPickerDialog } from '@/components/workshop/material-library-picker-dialog'
import { StoryboardRightPanel } from '@/components/workshop/storyboard-right-panel'
import { CanvasVideoExtractAudioDialog } from '@/components/canvas/modals/canvas-video-extract-audio-dialog'
import type { StoryboardVideoGenerateParams } from '@/components/workshop/storyboard-video-tab'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { WeishiVideoConfirmDialog } from '@/components/workshop/weishi-video-confirm-dialog'
import { StoryboardBatchVideoConfirmDialog } from '@/components/workshop/storyboard-batch-video-confirm-dialog'
import { StoryboardValidateConfirmDialog } from '@/components/workshop/storyboard-validate-confirm-dialog'
import {
  resolveImagePreviewSrc,
  revealPathInExplorer,
  selectReferenceImage,
} from '@/lib/storage/fs-service'
import { getCachedVideoPreviewSrc } from '@/lib/video/video-preview-cache'
import { resolveProjectMediaDir, resolveProjectRoot } from '@/lib/storage/project-paths'
import { isRemoteMediaReference, resolveProjectMediaPath } from '@/lib/storage/media-path-resolver'
import {
  listStoryboardTemplateSelectOptions,
  resolveProjectStoryboardTemplateKey,
  type ParsedValidateIssue,
} from '@/lib/workflow/storyboard-prompt'
import {
  isStoryboardStyleFollowingProject,
  resolveEffectiveStoryboardStyleKey,
  resolveProjectVisualStyleSummary,
} from '@/lib/workflow/project-visual-style'
import { resolveStoryboardPreviewPrefs } from '@/lib/workflow/storyboard-preview-prefs'
import {
  DEFAULT_STORYBOARD_IMAGE_SIZE,
  normalizeImageSizePreset,
  resolveImageSizeApiValue,
} from '@/lib/workflow/image-size-presets'
import {
  appendShotGeneratedImage,
  generateShotImage,
  isGenerationCancelledError,
  restoreShotAfterGenerationCancel,
  snapshotShotImageGenerationState,
} from '@/lib/workflow/shot-image-service'
import {
  buildMentionCandidates,
} from '@/lib/workflow/mention-utils'
import { saveShotReferenceFromMaterialItem } from '@/lib/materials/import-material-asset'
import type { MaterialLibraryItem } from '@/lib/materials/material-library-service'
import {
  buildImageFieldsFromPaths,
  getGeneratedImagePaths,
  getReferenceImagePaths,
  MAX_REFERENCE_IMAGES,
} from '@/lib/workflow/asset-utils'
import { generateShotVideo } from '@/lib/workflow/shot-video-service'
import { pickVideoModel } from '@/lib/video/video-client'
import { isZhipuVideoModel, prepareZhipuVideoRequestPreview } from '@/lib/video/zhipu-video-client'
import {
  isGrokVideoModel,
  prepareGrokVideoRequestPreview,
} from '@/lib/video/grok-video-client'
import {
  prepareOpenAiVideoRequestPreview,
  shouldUseOpenAiVideoClient,
} from '@/lib/video/openai-video-client'
import { isWeishiApiModel, resolveEffectiveWeishiReferenceMediaUploadMode } from '@/lib/models/weishi-model-presets'
import {
  buildWeishiUploadPersistPatches,
  mergeShotPatchWithWeishiPrune,
} from '@/lib/models/weishi-shot-media-cache'
import {
  prepareWeishiVideoRequestPreview,
  resolveWeishiCreateUrl,
  type WeishiVideoRequestPreview,
  type WeishiVideoReferenceItem,
} from '@/lib/models/weishi-video-client'
import {
  clampVideoReferenceMode,
  getUnsupportedVideoReferenceModeMessage,
} from '@/lib/models/video-model-capability'
import {
  resolveStoryboardVideoGeneratePrefs,
  VIDEO_REFERENCE_MODE_LABELS,
} from '@/lib/workflow/storyboard-video-presets'
import { syncShotStoryboardToWeishiReview } from '@/lib/workflow/shot-storyboard-review-service'
import {
  appendShotGeneratedVideo,
  buildShotImageValidationPatch,
  buildVideoFieldsFromPaths,
  appendMissingCharacterRefImages,
  enrichVideoPromptWithReferenceImageHints,
  getShotPreviewVideoPath,
  hasShotVideo,
  isStoryboardImageValidated,
  resolveVideoReferenceContext,
  resolveVideoReferenceItems,
} from '@/lib/workflow/shot-video-utils'
import {
  buildWorkflowShotExtractAudioLabel,
  resolveWorkflowShotExtractAudioAvailability,
} from '@/lib/workflow/workflow-video-extract-audio'
import {
  composeWeishiVideoPrompt,
} from '@/lib/workflow/weishi-video-prompt'
import {
  appendShotReferenceImage,
  isShotReferencePatch,
  saveShotReferenceImageFromFile,
  saveShotScreenshotReference,
} from '@/lib/workflow/shot-reference-utils'
import {
  appendShotReferenceAudio,
  buildShotVideoReferenceAudioItems,
  formatReferenceAudioDisplayName,
  getReferenceAudioPaths,
  MAX_REFERENCE_AUDIOS,
  stripReferenceAudioExtension,
  saveShotReferenceAudio,
} from '@/lib/workflow/shot-audio-reference-utils'
import { listVoiceLibraryEntries, selectVoiceReferenceAudio } from '@/lib/voice/voice-library-service'
import {
  appendShot,
  collectEpisodeAssets,
  getShotPreviewPath,
  getShotsForEpisode,
  insertShotAfter,
  removeShotFromList,
  resolveSelectedShotAfterDelete,
  replaceEpisodeShots,
  formatShotStoryboardImageGeneratedToast,
  formatShotStoryboardImageFailedToast,
  formatShotVideoGeneratedToast,
  formatShotVideoFailedToast,
  formatBatchShotVideoToast,
} from '@/lib/workflow/shot-utils'
import { updateEpisode } from '@/lib/workflow/episode-utils'
import {
  applyPromptAffix,
  getAffixPresetById,
  normalizeAffixPresets,
} from '@/lib/workflow/prompt-affix-utils'
import { validateEpisodeStoryboard } from '@/lib/workflow/storyboard-service'
import {
  STORYBOARD_POLL_MS,
  getActiveStoryboardTask,
  getInflightStoryboardInference,
  inferEpisodeStoryboardWithTask,
  reconcileStaleStoryboardTasks,
} from '@/lib/workflow/storyboard-task-service'
import { getStoryboardFormatQaWarningMessage } from '@/lib/workflow/storyboard-format-qa'
import {
  autoSyncEpisodeShotsReferencedAssets,
  autoSyncShotReferencedAssets,
  shotAssetSyncEqual,
} from '@/lib/workflow/shot-asset-matcher'
import {
  cancelImageGenerationTask,
  createImageTaskId,
  finishImageGenerationTask,
  listInflightImageGenerations,
  reconcileStaleImageTasks,
  registerInflightImageGeneration,
  startImageGenerationTask,
} from '@/lib/workflow/image-task-service'
import {
  cancelVideoGenerationTask,
  createVideoTaskId,
  finishVideoGenerationTask,
  getVideoSessionTaskId,
  persistVideoTaskRemoteJob,
  reconcileStaleVideoTasks,
  startVideoGenerationTask,
  updateVideoGenerationTask,
  registerInflightVideoGeneration,
  listInflightVideoGenerations,
  countInflightVideoGenerations,
  isInflightVideoTask,
  isVideoGenerationInflight,
  getActiveVideoTask,
  cancelInflightVideoGeneration,
  clearWorkflowVideoGenerationCancelled,
  isWorkflowVideoGenerationCancelled,
  markWorkflowVideoGenerationCancelled,
  bindWorkflowVideoGenerationAbort,
  unbindWorkflowVideoGenerationAbort,
  stopWorkflowVideoGeneration,
} from '@/lib/workflow/video-task-service'
import { isVideoGenerationAbortError } from '@/lib/video/video-generation-abort'
import {
  buildPersistedRemoteJob,
  isWorkflowVideoTaskResumable,
} from '@/lib/workflow/workflow-video-resume-service'
import { resumeWorkflowVideoIfNeeded } from '@/lib/video/video-background-resume-service'
import { hasVideoResumeLock } from '@/lib/video/video-resume-session-lock'
import { readWorkflowTasks } from '@/lib/storage/workflow-service'
import {
  registerWorkflowImageStopHandler,
  stopWorkflowImageGeneration,
} from '@/lib/workflow/workflow-generation-stop'
import { isActiveTaskStatus, removeWorkflowTask } from '@/lib/workflow/task-service'
import { buildProjectTaskList, resolveStep4TaskUiState } from '@/lib/workflow/step4-task-sync'
import { exportWorkflowEpisodeToCapcut } from '@/lib/workflow/workshop-episode-capcut-export'
import { useTaskStore } from '@/stores/task-store'
import { useSettingsStore } from '@/stores/settings-store'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkflowShotPatch } from '@/hooks/use-workflow-shot-patch'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import { useActiveEpisode } from '@/hooks/use-active-episode'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import type { PromptAffixPreset } from '@/types/settings'
import type { WorkflowProjectData, WorkflowShot, WorkflowTask } from '@/types/workflow'
import type { InferenceFormat } from '@/lib/workflow/storyboard-image-presets'
import type { VoiceLibraryEntry } from '@/types/voice-library'

function resetStuckGenerating(
  shots: WorkflowShot[],
  preserveVideoShotIds: Set<string> = new Set(),
  preserveImageShotIds: Set<string> = new Set(),
): WorkflowShot[] {
  return shots.map((s) => {
    const patch: Partial<WorkflowShot> = {}
    if (s.status === 'generating' && !preserveImageShotIds.has(s.id)) {
      patch.status = getGeneratedImagePaths(s).length > 0 ? 'done' : 'draft'
    }
    if (s.videoStatus === 'generating' && !preserveVideoShotIds.has(s.id)) {
      patch.videoStatus = 'draft'
    }
    return Object.keys(patch).length ? { ...s, ...patch } : s
  })
}

function isResumableBatchVideoTask(task: WorkflowTask): boolean {
  return task.progressMessage?.includes('批量生视频') ?? false
}

function progressMessageMatchesShot(message: string, shotNumber: number): boolean {
  return new RegExp(`^镜号\\s*${shotNumber}\\s*[：:\\s]`).test(message.trim())
}

function isVideoGenerationStopped(shotId: string, error?: unknown): boolean {
  return isWorkflowVideoGenerationCancelled(shotId) || isVideoGenerationAbortError(error)
}

function findActiveVideoTaskForShot(
  tasks: WorkflowTask[],
  shot: Pick<WorkflowShot, 'id' | 'shotNumber'>,
): WorkflowTask | null {
  const byShotId = tasks.find(
    (task) =>
      task.type === 'video' &&
      isActiveTaskStatus(task.status) &&
      task.shotId === shot.id,
  )
  if (byShotId) return byShotId
  return (
    tasks.find(
      (task) =>
        task.type === 'video' &&
        isActiveTaskStatus(task.status) &&
        task.progressMessage &&
        progressMessageMatchesShot(task.progressMessage, shot.shotNumber),
    ) ?? null
  )
}

function resolveShotVideoProgressPercent(
  message: string | undefined,
  fallback?: number,
): number | undefined {
  if (fallback != null && Number.isFinite(fallback)) return fallback
  const match = message?.match(/(\d+)\s*%/)
  if (!match) return undefined
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

function resolvePreviousEpisodeShot(
  shots: WorkflowShot[],
  current: WorkflowShot,
): WorkflowShot | null {
  const sorted = [...shots].sort((a, b) => a.shotNumber - b.shotNumber)
  const index = sorted.findIndex((item) => item.id === current.id)
  if (index <= 0) return null
  return sorted[index - 1] ?? null
}

type WeishiVideoBeginResult = 'confirm' | 'direct' | 'failed'

type ShotImageGenerationSession = {
  controller: AbortController
  snapshot: Partial<WorkflowShot>
  previewUrl: string | null
  cancelled: boolean
  taskId?: string | null
  taskStartedAt?: number
}

export function Step4StoryboardPage() {
  const location = useLocation()
  const meta = useWorkflowSessionStore((s) => s.meta)
  const data = useWorkflowSessionStore((s) => s.data)
  const dirty = useWorkflowSessionStore((s) => s.dirty)
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const save = useWorkflowSessionStore((s) => s.save)
  const reload = useWorkflowSessionStore((s) => s.reload)

  const settings = useSettingsStore((s) => s.settings)
  const appDataDir = useSettingsStore((s) => s.appDataDir)
  const loadSettings = useSettingsStore((s) => s.load)
  const getMergedModels = useSettingsStore((s) => s.getMergedModels)
  const systemModelsByKind = useSettingsStore((s) => s.systemModelsByKind)
  const authToken = useAuthStore((s) => s.token)

  const mergedLlmModels = useMemo(
    () => getMergedModels('llm'),
    [getMergedModels, systemModelsByKind, settings?.llmModels],
  )

  const { activeEpisodeId, activeEpisode: selectedEpisode, setActiveEpisodeId } = useActiveEpisode()
  const { ask, confirmDialog } = useConfirmDialog()
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null)
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({})
  const [centerPreviewUrl, setCenterPreviewUrl] = useState<string | null>(null)
  const [centerVideoPreviewUrl, setCenterVideoPreviewUrl] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState<'image' | 'video'>('video')
  const [previewAspect, setPreviewAspect] = useState<PreviewAspectMode>('landscape')
  /** 进入 Step4 默认展开右侧工具栏 + 生视频 Tab（见 rightPanelSession 重置 StoryboardRightPanel） */
  const [rightCollapsed, setRightCollapsed] = useState(false)
  const [rightPanelSession, setRightPanelSession] = useState(0)

  /** 每次进入 Step4：展开右侧栏并重置面板（默认生视频 Tab） */
  useLayoutEffect(() => {
    if (!location.pathname.includes('/step/4')) return
    setRightCollapsed(false)
    setRightPanelSession((n) => n + 1)
  }, [location.pathname, meta?.id])
  const [inferring, setInferring] = useState(false)
  /** 全集文本二次验证（空间锚点），非单镜微视审核 */
  const [storyboardValidating, setStoryboardValidating] = useState(false)
  /** 二次验证结果待确认：不落盘，1C 弹窗应用/取消 */
  const [pendingValidate, setPendingValidate] = useState<{
    episodeId: string
    beforeShots: WorkflowShot[]
    afterShots: WorkflowShot[]
    passed?: boolean
    summary?: string
    issues: ParsedValidateIssue[]
    mode?: 'quick' | 'deep'
  } | null>(null)
  // 切集丢弃未确认结果，避免跨集误应用
  useEffect(() => {
    setPendingValidate((prev) => {
      if (!prev) return prev
      if (!activeEpisodeId || prev.episodeId !== activeEpisodeId) return null
      return prev
    })
  }, [activeEpisodeId])
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [imageGeneratingIds, setImageGeneratingIds] = useState<string[]>([])
  const [videoGeneratingIds, setVideoGeneratingIds] = useState<string[]>([])
  const [pendingDeleteShotId, setPendingDeleteShotId] = useState<string | null>(null)
  const [batchVideoConfirmOpen, setBatchVideoConfirmOpen] = useState(false)
  const [extractAudioDialogOpen, setExtractAudioDialogOpen] = useState(false)
  const [batchVideoGenerating, setBatchVideoGenerating] = useState(false)
  /** 批量生视频队列中的镜头 ID（用于禁用按钮，直到批量结束） */
  const [batchVideoTargetIds, setBatchVideoTargetIds] = useState<string[]>([])
  const [videoTaskMessage, setVideoTaskMessage] = useState('')
  const [videoProgressPercent, setVideoProgressPercent] = useState<number | undefined>()
  const [pendingWeishiVideo, setPendingWeishiVideo] = useState<{
    params: StoryboardVideoGenerateParams
    shot: WorkflowShot
    preview: WeishiVideoRequestPreview
    preparedReferences: WeishiVideoReferenceItem[]
    skipImageValidation?: boolean
    batchTargets?: WorkflowShot[]
  } | null>(null)
  const [weishiPreviewPreparing, setWeishiPreviewPreparing] = useState(false)
  const [validatingShotId, setValidatingShotId] = useState<string | null>(null)
  const [voiceLibrary, setVoiceLibrary] = useState<VoiceLibraryEntry[]>([])
  const [affixPresetDialogOpen, setAffixPresetDialogOpen] = useState(false)
  const stuckResetDone = useRef(false)
  const storyboardWasActive = useRef(false)
  const inferAttachEpoch = useRef(0)
  const videoAttachEpoch = useRef(0)
  const shotImageGenerationSessionsRef = useRef(new Map<string, ShotImageGenerationSession>())
  const previewPrefsHydrated = useRef(false)
  const videoOperationBusyRef = useRef(false)

  const markImageGenerating = useCallback((shotId: string) => {
    setImageGeneratingIds((prev) => (prev.includes(shotId) ? prev : [...prev, shotId]))
  }, [])

  const unmarkImageGenerating = useCallback((shotId: string) => {
    setImageGeneratingIds((prev) => prev.filter((id) => id !== shotId))
  }, [])

  const markVideoGenerating = useCallback((shotId: string) => {
    setVideoGeneratingIds((prev) => (prev.includes(shotId) ? prev : [...prev, shotId]))
  }, [])

  const markBatchVideoTargets = useCallback((shotIds: string[]) => {
    if (shotIds.length === 0) return
    setVideoGeneratingIds((prev) => [...new Set([...prev, ...shotIds])])
  }, [])

  const unmarkVideoGenerating = useCallback((shotId: string) => {
    setVideoGeneratingIds((prev) => prev.filter((id) => id !== shotId))
  }, [])

  const releaseBatchVideoTarget = useCallback((shotId: string) => {
    setBatchVideoTargetIds((prev) => (prev.includes(shotId) ? prev.filter((id) => id !== shotId) : prev))
  }, [])

  const syncImageGeneratingIdsFromInflight = useCallback((projectId: string) => {
    const shotIds = listInflightImageGenerations(projectId)
      .map((session) => session.shotId)
      .filter((shotId): shotId is string => Boolean(shotId))
    setImageGeneratingIds(shotIds)
  }, [])

  const syncVideoGeneratingIdsFromInflight = useCallback((projectId: string) => {
    const shotIds = listInflightVideoGenerations(projectId)
      .filter((session) => !session.isBatch && session.generatingShotId)
      .map((session) => session.generatingShotId!)
    setVideoGeneratingIds(shotIds)
    setBatchVideoGenerating(
      listInflightVideoGenerations(projectId).some((session) => session.isBatch),
    )
  }, [])

  const countActiveSingleShotVideos = useCallback(
    (projectId?: string | null) => {
      if (projectId) {
        return countInflightVideoGenerations(projectId, { singleShotOnly: true })
      }
      return videoGeneratingIds.length
    },
    [videoGeneratingIds.length],
  )

  const activeVideoTaskIdRef = useRef<string | null>(null)
  const videoGenerationCancelledRef = useRef(false)
  const [cancellingTaskId, setCancellingTaskId] = useState<string | null>(null)
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null)
  const [exportingToCapcut, setExportingToCapcut] = useState(false)
  const [materialReferencePickerShotId, setMaterialReferencePickerShotId] = useState<string | null>(null)

  const taskEntries = useTaskStore((s) => s.entries)
  const taskStoreLoading = useTaskStore((s) => s.loading)
  const refreshTaskStore = useTaskStore((s) => s.refresh)

  const projectTasks = useMemo(
    () =>
      taskEntries
        .filter((entry) => entry.projectId === meta?.id)
        .map((entry) => entry.task),
    [meta?.id, taskEntries],
  )


  useEffect(() => {
    if (!settings) loadSettings()
  }, [settings, loadSettings])

  useEffect(() => {
    if (!settings || previewPrefsHydrated.current) return
    const prefs = resolveStoryboardPreviewPrefs(settings)
    setPreviewMode(prefs.previewMode)
    setPreviewAspect(prefs.previewAspect)
    previewPrefsHydrated.current = true
  }, [settings])

  useEffect(() => {
    let active = true
    void listVoiceLibraryEntries()
      .then((voices) => {
        if (active) setVoiceLibrary(voices)
      })
      .catch(() => {
        if (active) setVoiceLibrary([])
      })
    return () => {
      active = false
    }
  }, [])

  const episodes = data?.episodes ?? []
  const allShots = data?.shots ?? []
  const { patchShots, patchShotById, getShotById } = useWorkflowShotPatch()
  const stylePresetKey = useMemo(
    () => resolveEffectiveStoryboardStyleKey(data, settings),
    [data, settings],
  )
  const followingProjectStoryboardStyle = isStoryboardStyleFollowingProject(data)
  const projectStyleSummary = useMemo(
    () => resolveProjectVisualStyleSummary(data, settings),
    [data, settings],
  )
  const storyboardImageApiSize = useMemo(
    () =>
      resolveImageSizeApiValue(
        normalizeImageSizePreset(
          settings?.lastUsedStoryboardImageSize,
          DEFAULT_STORYBOARD_IMAGE_SIZE,
        ),
      ),
    [settings?.lastUsedStoryboardImageSize],
  )
  const affixPresets = useMemo(
    () => normalizeAffixPresets(settings?.affixPresets),
    [settings?.affixPresets],
  )
  const selectedAffixPresetId =
    data?.selectedAffixPresetId ??
    affixPresets.find((item) => item.isDefault)?.id ??
    affixPresets[0]?.id
  const activeAffixPreset = useMemo(
    () => getAffixPresetById(affixPresets, selectedAffixPresetId),
    [affixPresets, selectedAffixPresetId],
  )
  const promptPrefix = data?.promptPrefix ?? activeAffixPreset?.prefix ?? ''
  const promptSuffix = data?.promptSuffix ?? activeAffixPreset?.suffix ?? ''

  const projectRoot = useMemo(() => {
    if (!meta?.id || !settings) return ''
    return resolveProjectRoot(settings, appDataDir, meta.id)
  }, [meta?.id, settings, appDataDir])

  useEffect(() => {
    if (stuckResetDone.current || !data?.shots?.length || !meta?.id) return
    if (!data.shots.some((s) => s.status === 'generating' || s.videoStatus === 'generating')) {
      stuckResetDone.current = true
      return
    }

    let cancelled = false
    void (async () => {
      const preserveVideoShotIds = new Set<string>()
      const preserveImageShotIds = new Set<string>()
      try {
        const tasks = await readWorkflowTasks(meta.id)
        for (const task of tasks) {
          if (isWorkflowVideoTaskResumable(task) && task.shotId) {
            preserveVideoShotIds.add(task.shotId)
          }
          if (task.type === 'image' && isActiveTaskStatus(task.status) && task.shotId) {
            preserveImageShotIds.add(task.shotId)
          }
        }
        for (const shotId of shotImageGenerationSessionsRef.current.keys()) {
          preserveImageShotIds.add(shotId)
        }
        for (const session of listInflightImageGenerations(meta.id)) {
          if (session.shotId) preserveImageShotIds.add(session.shotId)
        }
      } catch {
        /* 读取失败时仍清理明显卡死的 generating */
      }
      if (cancelled) return
      stuckResetDone.current = true
      patchData({ shots: resetStuckGenerating(data.shots, preserveVideoShotIds, preserveImageShotIds) })
    })()

    return () => {
      cancelled = true
    }
  }, [data?.shots, meta?.id, patchData])

  useEffect(() => {
    stuckResetDone.current = false
    setSelectedShotId(null)
    setImageGeneratingIds([])
    const projectId = meta?.id
    if (projectId) syncImageGeneratingIdsFromInflight(projectId)
  }, [meta?.id, syncImageGeneratingIdsFromInflight])

  const episodeShots = useMemo(
    () => (activeEpisodeId ? getShotsForEpisode(allShots, activeEpisodeId) : []),
    [allShots, activeEpisodeId],
  )

  const shotVideoMediaContext = useMemo(() => {
    if (!data || !selectedEpisode) {
      return { mentionCandidates: [], characters: [], scenes: [], props: [] }
    }
    const assets = collectEpisodeAssets(data, selectedEpisode)
    return {
      mentionCandidates: buildMentionCandidates(assets, voiceLibrary),
      characters: assets.characters,
      scenes: assets.scenes,
      props: assets.props,
    }
  }, [data, selectedEpisode, voiceLibrary])

  const episodeAssetFingerprint = useMemo(() => {
    if (!selectedEpisode || !data) return ''
    const assets = collectEpisodeAssets(data, selectedEpisode)
    return JSON.stringify({
      episodeId: selectedEpisode.id,
      characters: assets.characters.map((item) => `${item.id}:${item.name}`),
      scenes: assets.scenes.map((item) => `${item.id}:${item.name}`),
      props: assets.props.map((item) => `${item.id}:${item.name}`),
    })
  }, [data, selectedEpisode])

  const episodeShotsTextFingerprint = useMemo(
    () =>
      episodeShots
        .map((shot) =>
          [shot.id, shot.dialogue, shot.spatialAnchor, shot.prompt]
            .map((part) => String(part ?? ''))
            .join('\u0001'),
        )
        .join('\u0002'),
    [episodeShots],
  )

  useEffect(() => {
    if (!selectedEpisode || !data || episodeShots.length === 0) return
    const candidates = shotVideoMediaContext.mentionCandidates
    if (!candidates.length) return
    const nextList = autoSyncEpisodeShotsReferencedAssets(episodeShots, candidates)
    const changed = nextList.some((shot, index) => !shotAssetSyncEqual(shot, episodeShots[index] ?? shot))
    if (!changed) return
    patchShots(replaceEpisodeShots(allShots, selectedEpisode.id, nextList))
  }, [
    allShots,
    data,
    episodeAssetFingerprint,
    episodeShots,
    episodeShotsTextFingerprint,
    patchShots,
    selectedEpisode,
    shotVideoMediaContext.mentionCandidates,
  ])

  const selectedShot = useMemo(
    () => episodeShots.find((s) => s.id === selectedShotId) ?? null,
    [episodeShots, selectedShotId],
  )

  useEffect(() => {
    if (episodeShots.length === 0) {
      setSelectedShotId(null)
      return
    }
    if (!selectedShotId || !episodeShots.some((s) => s.id === selectedShotId)) {
      setSelectedShotId(episodeShots[0].id)
    }
  }, [episodeShots, selectedShotId])

  useEffect(() => {
    let cancelled = false
    const loadPreviews = async () => {
      const entries = await Promise.all(
        episodeShots.map(async (shot) => {
          const path = getShotPreviewPath(shot)
          const url = path ? await resolveImagePreviewSrc(path, projectRoot) : null
          return [shot.id, url] as const
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
  }, [episodeShots, projectRoot])

  useEffect(() => {
    let active = true
    const loadCenter = async () => {
      if (!selectedShot) {
        setCenterPreviewUrl(null)
        setCenterVideoPreviewUrl(null)
        return
      }
      const imagePath = getShotPreviewPath(selectedShot)
      const imageUrl = imagePath ? await resolveImagePreviewSrc(imagePath, projectRoot) : null
      const videoPath = getShotPreviewVideoPath(selectedShot)
      const videoUrl = videoPath ? await getCachedVideoPreviewSrc(videoPath, projectRoot) : null
      if (active) {
        setCenterPreviewUrl(imageUrl)
        setCenterVideoPreviewUrl(videoUrl)
      }
    }
    void loadCenter()
    return () => {
      active = false
    }
  }, [selectedShot, projectRoot])

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => {
      void save({ silent: true })
    }, WORKSHOP_AUTO_SAVE_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [dirty, save])

  const storyboardTemplateKey = useMemo(() => {
    if (!settings) return data?.storyboardTemplateKey ?? ''
    return resolveProjectStoryboardTemplateKey(data, settings)
  }, [data, settings])

  const storyboardTemplateOptions = useMemo(
    () => (settings ? listStoryboardTemplateSelectOptions(settings) : []),
    [settings],
  )

  useEffect(() => {
    if (!data || !settings) return
    const resolved = resolveProjectStoryboardTemplateKey(data, settings)
    if (data.storyboardTemplateKey !== resolved) {
      patchData({ storyboardTemplateKey: resolved })
    }
  }, [data, patchData, settings])

  const imageModelOptions = useMemo(
    () => buildModelSelectOptions(getMergedModels('image'), 'image'),
    [getMergedModels, systemModelsByKind, settings?.imageModels],
  )

  const videoModelOptions = useMemo(
    () =>
      buildVideoModelSelectOptions(
        getMergedModels('video'),
        systemModelsByKind.video,
        authToken,
      ),
    [authToken, getMergedModels, systemModelsByKind.video, settings?.videoModels],
  )

  const llmModelOptions = useMemo(
    () => buildModelSelectOptions(mergedLlmModels, 'llm'),
    [mergedLlmModels],
  )

  const mergedVideoModels = useMemo(
    () => getMergedModels('video'),
    [getMergedModels, systemModelsByKind, settings?.videoModels],
  )

  const mergedImageModels = useMemo(
    () => getMergedModels('image'),
    [getMergedModels, systemModelsByKind, settings?.imageModels],
  )

  const llmModelId = useMemo(
    () => resolveSoftwareLlmModelId(settings, mergedLlmModels),
    [
      mergedLlmModels,
      settings?.lastUsedStoryboardLlmModelId,
      settings?.lastUsedLlmModelId,
      settings?.lastUsedEpisodeLlmModelId,
      settings?.defaultLlmModelId,
    ],
  )

  const imageModelId = useMemo(
    () => resolveSoftwareImageModelId(settings, mergedImageModels),
    [
      mergedImageModels,
      settings?.lastUsedStoryboardImageModelId,
      settings?.lastUsedAssetImageModelId,
    ],
  )

  const videoModelId = useMemo(
    () => resolveSoftwareVideoModelId(settings, mergedVideoModels),
    [mergedVideoModels, settings?.lastUsedStoryboardVideoModelId],
  )

  const rememberStoryboardLlmModelId = useSettingsStore((s) => s.rememberLastUsedStoryboardLlmModelId)
  const rememberStoryboardImageModelId = useSettingsStore((s) => s.rememberLastUsedStoryboardImageModelId)
  const rememberStoryboardVideoModelId = useSettingsStore((s) => s.rememberLastUsedStoryboardVideoModelId)
  const rememberStoryboardStyleKey = useSettingsStore((s) => s.rememberLastUsedStoryboardStyleKey)
  const rememberStoryboardPreviewPrefs = useSettingsStore((s) => s.rememberLastUsedStoryboardPreviewPrefs)

  const handlePreviewModeChange = useCallback(
    (mode: 'image' | 'video') => {
      setPreviewMode(mode)
      rememberStoryboardPreviewPrefs({ previewMode: mode })
    },
    [rememberStoryboardPreviewPrefs],
  )

  const handlePreviewAspectChange = useCallback(
    (aspect: PreviewAspectMode) => {
      setPreviewAspect(aspect)
      rememberStoryboardPreviewPrefs({ previewAspect: aspect })
    },
    [rememberStoryboardPreviewPrefs],
  )

  const resolveActiveVideoModel = useCallback(() => {
    const videoModels = getMergedModels('video')
    if (!videoModels.length) return null
    try {
      return pickVideoModel(videoModels, videoModelId || undefined)
    } catch {
      return null
    }
  }, [getMergedModels, systemModelsByKind, settings?.videoModels, videoModelId])

  const activeVideoModel = useMemo(() => resolveActiveVideoModel(), [resolveActiveVideoModel])

  const applyWeishiPersistPatches = useCallback(
    async (shotId: string, patches: ReturnType<typeof buildWeishiUploadPersistPatches>) => {
      const { shotPatch, dataPatch } = patches
      const hasShotPatch = Object.keys(shotPatch).length > 0
      const hasDataPatch = Object.keys(dataPatch).length > 0
      if (hasShotPatch) patchShotById(shotId, shotPatch)
      if (hasDataPatch) patchData(dataPatch)
      if (hasShotPatch || hasDataPatch) {
        await save({ silent: true })
      }
    },
    [patchData, patchShotById, save],
  )

  const patchShotMediaWithPrune = useCallback(
    (shotId: string, patch: Partial<WorkflowShot>) => {
      const shot = getShotById(shotId)
      if (!shot) return
      const model = resolveActiveVideoModel()
      const { mentionCandidates, characters, scenes, props } = shotVideoMediaContext
      patchShotById(
        shotId,
        mergeShotPatchWithWeishiPrune(shot, patch, {
          mentionCandidates,
          characters,
          scenes,
          props,
          endpoint: model?.endpoint,
        }),
      )
    },
    [getShotById, patchShotById, resolveActiveVideoModel, shotVideoMediaContext],
  )

  const handleShotChange = useCallback(
    (shotId: string, patch: Partial<WorkflowShot>) => {
      if (isShotReferencePatch(patch)) {
        patchShotMediaWithPrune(shotId, patch)
        void save({ silent: true })
        return
      }

      let finalPatch = patch
      const shot = getShotById(shotId)
      const affectsAssetMatch =
        patch.dialogue !== undefined ||
        patch.prompt !== undefined ||
        patch.spatialAnchor !== undefined

      if (shot && affectsAssetMatch && selectedEpisode && data) {
        const assets = collectEpisodeAssets(data, selectedEpisode)
        const candidates = buildMentionCandidates(assets, voiceLibrary)
        const synced = autoSyncShotReferencedAssets({ ...shot, ...patch }, candidates)
        if (!shotAssetSyncEqual(shot, synced)) {
          finalPatch = {
            ...patch,
            dialogue: synced.dialogue,
            prompt: synced.prompt,
            spatialAnchor: synced.spatialAnchor,
            referencedAssetIds: synced.referencedAssetIds,
            updatedAt: Date.now(),
          }
        }
      }

      patchShotById(shotId, finalPatch)
    },
    [data, getShotById, patchShotById, patchShotMediaWithPrune, save, selectedEpisode, voiceLibrary],
  )

  const patchSelectedShot = useCallback(
    (patch: Partial<WorkflowShot>) => {
      if (!selectedShotId) return
      handleShotChange(selectedShotId, patch)
    },
    [handleShotChange, selectedShotId],
  )

  const handleEpisodeContentChange = useCallback(
    (content: string) => {
      if (!selectedEpisode) return
      patchData({
        episodes: updateEpisode(episodes, selectedEpisode.id, {
          content,
          contentManuallyEdited: true,
        }),
      })
    },
    [episodes, patchData, selectedEpisode],
  )

  const persistProjectAffix = useCallback(
    (
      patch: Partial<
        Pick<WorkflowProjectData, 'promptPrefix' | 'promptSuffix' | 'selectedAffixPresetId'>
      >,
    ) => {
      patchData(patch)
      void save({ silent: true })
    },
    [patchData, save],
  )

  const handleSelectAffixPreset = useCallback(
    (presetId: number) => {
      const preset = getAffixPresetById(affixPresets, presetId)
      if (!preset) return
      persistProjectAffix({
        selectedAffixPresetId: presetId,
        promptPrefix: preset.prefix,
        promptSuffix: preset.suffix,
      })
    },
    [affixPresets, persistProjectAffix],
  )

  const handleSaveAffixPresets = useCallback(
    (presets: PromptAffixPreset[], selectedId: number) => {
      useSettingsStore.getState().updateSettings({ affixPresets: presets })
      void useSettingsStore.getState().save({ silent: true })
      const preset = getAffixPresetById(presets, selectedId)
      if (preset) {
        persistProjectAffix({
          selectedAffixPresetId: selectedId,
          promptPrefix: preset.prefix,
          promptSuffix: preset.suffix,
        })
      }
      toast.success('前后缀预设已保存')
    },
    [persistProjectAffix],
  )

  const syncStoryboardTaskState = useCallback(async () => {
    const projectId = meta?.id
    if (!projectId) return
    try {
      const interrupted = await reconcileStaleStoryboardTasks(projectId)
      if (interrupted) {
        storyboardWasActive.current = false
        setInferring(false)
        toast.error(interrupted.errorMessage || '推理分镜失败')
      }
      await refreshTaskStore()
    } catch {
      /* 读取失败时保留当前列表，避免任务面板卡死 */
    }
  }, [meta?.id, refreshTaskStore])

  const runInferStoryboard = useCallback(async () => {
    if (!data || !selectedEpisode || !settings || !meta?.id) return
    setInferring(true)
    storyboardWasActive.current = true
    try {
      const inferPromise = inferEpisodeStoryboardWithTask(
        meta.id,
        data,
        selectedEpisode,
        {
          settings,
          storyboardTemplateKey,
        },
      )
      void syncStoryboardTaskState()
      const inferResult = await inferPromise
      const nextEpisodeShots = inferResult.shots
      const latestData = useWorkflowSessionStore.getState().data ?? data
      const assets = collectEpisodeAssets(latestData, selectedEpisode)
      const candidates = buildMentionCandidates(assets, voiceLibrary)
      const syncedEpisodeShots = candidates.length
        ? autoSyncEpisodeShotsReferencedAssets(nextEpisodeShots, candidates)
        : nextEpisodeShots
      const currentShots = latestData.shots ?? allShots
      patchShots(replaceEpisodeShots(currentShots, selectedEpisode.id, syncedEpisodeShots))
      if (syncedEpisodeShots[0]) setSelectedShotId(syncedEpisodeShots[0].id)
      const saved = await save({ silent: true })
      if (!saved) {
        toast.error('分镜已生成但保存失败，请稍后重试保存')
      } else {
        toast.success(`已生成 ${syncedEpisodeShots.length} 个分镜`)
      }
    } catch (error: unknown) {
      toast.error(formatUserFacingBillingError(error, '推理分镜失败'))
    } finally {
      await syncStoryboardTaskState()
    }
  }, [
    allShots,
    data,
    meta?.id,
    patchShots,
    save,
    selectedEpisode,
    settings,
    storyboardTemplateKey,
    syncStoryboardTaskState,
    voiceLibrary,
  ])

  const handleInfer = async () => {
    if (!data || !selectedEpisode || !settings || !meta?.id) return
    const llmError = getLlmModelSelectionError(mergedLlmModels, llmModelId)
    if (llmError) {
      toast.error(llmError)
      return
    }
    if (inferring) {
      toast.info('分镜推理进行中，请稍候')
      return
    }

    if (getActiveStoryboardTask(projectTasks, meta.id)) {
      setInferring(true)
      toast.info('分镜推理进行中，请稍候')
      return
    }

    if (episodeShots.length > 0) {
      const ok = await ask({
        title: '重新推理分镜？',
        description: `本集已有 ${episodeShots.length} 个分镜，重新推理将覆盖全部手写内容与生成状态，是否继续？`,
        confirmLabel: '继续推理',
        variant: 'destructive',
      })
      if (!ok) return
    }

    await runInferStoryboard()
  }

  /**
   * 全集文本二次验证：调 LLM 补空间锚点，结果进 pendingValidate，不落盘。
   * 确认弹窗见 1C。
   */
  const handleValidateStoryboard = useCallback(async () => {
    if (!data || !selectedEpisode || !settings || !meta?.id) {
      toast.error('项目未就绪，请稍后重试')
      return
    }

    const llmError = getLlmModelSelectionError(mergedLlmModels, llmModelId)
    if (llmError) {
      toast.error(llmError)
      return
    }

    if (storyboardValidating) {
      toast.info('二次验证进行中，请稍候')
      return
    }

    if (pendingValidate) {
      toast.info('请先处理当前二次验证结果')
      return
    }

    if (inferring || getActiveStoryboardTask(projectTasks, meta.id)) {
      toast.info('分镜推理进行中，请稍候')
      return
    }

    if (batchVideoGenerating) {
      toast.info('批量生视频进行中，请稍候')
      return
    }

    if (episodeShots.length === 0) {
      toast.error('请先推理或添加分镜后再二次验证')
      return
    }

    const beforeShots = episodeShots.map((shot) => ({ ...shot }))
    setStoryboardValidating(true)
    try {
      const result = await validateEpisodeStoryboard(beforeShots, {
        settings,
        projectId: meta.id,
        isInternal: useAuthStore.getState().user?.is_internal === true,
        episodeContent: selectedEpisode.content,
      })
      const afterShots = result.shots
      const changedCount = afterShots.filter((shot, index) => {
        const prev = beforeShots[index]
        return Boolean(shot.spatialAnchor) && shot.spatialAnchor !== prev?.spatialAnchor
      }).length
      if (changedCount === 0) {
        toast.error('二次验证未产生可应用的空间锚点，数据未改动')
        return
      }
      setPendingValidate({
        episodeId: selectedEpisode.id,
        beforeShots,
        afterShots,
        passed: result.passed,
        summary: result.summary,
        issues: result.issues ?? [],
        mode: result.mode,
      })
      const modeLabel = result.mode === 'quick' ? '快速' : '深度'
      const issueHint =
        result.issues.length > 0 ? `，发现 ${result.issues.length} 条连续性提示` : ''
      const batchHint =
        (result.batchCount ?? 1) > 1 ? `（分 ${result.batchCount} 批）` : ''
      toast.success(
        `空间锚点补充完成（${modeLabel}）：${changedCount} 条待确认${issueHint}${batchHint}`,
      )
    } catch (error: unknown) {
      // 空结果 / JSON 失败等由 service 抛错；此处统一 toast，不写盘
      toast.error(formatUserFacingBillingError(error, '补空间锚点失败'))
    } finally {
      setStoryboardValidating(false)
    }
  }, [
    batchVideoGenerating,
    data,
    episodeShots,
    inferring,
    llmModelId,
    mergedLlmModels,
    meta?.id,
    pendingValidate,
    projectTasks,
    selectedEpisode,
    settings,
    storyboardValidating,
  ])

  const handleDismissValidateStoryboard = useCallback(() => {
    setPendingValidate(null)
    toast.message('已放弃本次空间锚点结果')
  }, [])

  const handleApplyValidateStoryboard = useCallback(async () => {
    if (!pendingValidate || !selectedEpisode || !data) return
    if (pendingValidate.episodeId !== selectedEpisode.id) {
      setPendingValidate(null)
      toast.info('集已切换，空间锚点结果已失效')
      return
    }

    // 仅写入有结果的镜号的 spatialAnchor；prompt / referencedAssetIds / @ 原文保留
    const anchorById = new Map(
      pendingValidate.afterShots.map((shot) => [shot.id, shot.spatialAnchor]),
    )
    let appliedCount = 0
    const nextEpisodeShots = episodeShots.map((shot) => {
      const nextAnchor = anchorById.get(shot.id)?.trim()
      if (!nextAnchor || nextAnchor === (shot.spatialAnchor || '').trim()) return shot
      appliedCount += 1
      return {
        ...shot,
        spatialAnchor: nextAnchor,
        updatedAt: Date.now(),
      }
    })

    if (appliedCount === 0) {
      setPendingValidate(null)
      toast.message('没有需要写入的空间锚点')
      return
    }

    const latestData = useWorkflowSessionStore.getState().data ?? data
    const currentShots = latestData.shots ?? allShots
    patchShots(replaceEpisodeShots(currentShots, selectedEpisode.id, nextEpisodeShots))
    setPendingValidate(null)

    const saved = await save({ silent: true })
    if (!saved) {
      toast.error('空间锚点已更新但保存失败，请稍后重试保存')
      return
    }
    toast.success(`已应用 ${appliedCount} 条空间锚点`)
  }, [
    allShots,
    data,
    episodeShots,
    patchShots,
    pendingValidate,
    save,
    selectedEpisode,
  ])

  const resetLocalVideoGeneration = useCallback(() => {
    videoGenerationCancelledRef.current = true
    activeVideoTaskIdRef.current = null
    setBatchVideoTargetIds([])
    const projectId = meta?.id
    if (projectId && isVideoGenerationInflight(projectId)) {
      syncVideoGeneratingIdsFromInflight(projectId)
    } else {
      setVideoGeneratingIds([])
      setBatchVideoGenerating(false)
    }
    setWeishiPreviewPreparing(false)
    setVideoTaskMessage('')
    videoOperationBusyRef.current = false
    const preserveVideoShotIds = new Set(
      projectId
        ? listInflightVideoGenerations(projectId)
            .filter((session) => !session.isBatch && session.generatingShotId)
            .map((session) => session.generatingShotId!)
        : [],
    )
    const preserveImageShotIds = new Set<string>()
    if (projectId) {
      for (const session of listInflightImageGenerations(projectId)) {
        if (session.shotId) preserveImageShotIds.add(session.shotId)
      }
    }
    for (const shotId of shotImageGenerationSessionsRef.current.keys()) {
      preserveImageShotIds.add(shotId)
    }
    if (
      data?.shots?.some(
        (s) =>
          s.videoStatus === 'generating' ||
          (s.status === 'generating' && !preserveImageShotIds.has(s.id)),
      )
    ) {
      patchData({ shots: resetStuckGenerating(data.shots, preserveVideoShotIds, preserveImageShotIds) })
    }
  }, [data?.shots, meta?.id, patchData, syncVideoGeneratingIdsFromInflight])

  const applyVideoTaskUiFromWorkflowTask = useCallback(
    (task: WorkflowTask) => {
      if (task.type !== 'video' || !isWorkflowVideoTaskResumable(task)) return
      if (videoGenerationCancelledRef.current) return

      const isBatch = isResumableBatchVideoTask(task)
      if (activeVideoTaskIdRef.current === task.id) {
        if (task.progressMessage) {
          setVideoTaskMessage(task.progressMessage)
        }
        if (!isBatch && task.shotId) {
          const shot = getShotById(task.shotId)
          if (shot && shot.videoStatus !== 'generating') {
            patchShotById(task.shotId, { videoStatus: 'generating' })
          }
        }
        return
      }

      videoGenerationCancelledRef.current = false
      videoOperationBusyRef.current = true
      activeVideoTaskIdRef.current = task.id

      if (isBatch) {
        setBatchVideoGenerating(true)
      } else if (task.shotId) {
        markVideoGenerating(task.shotId)
        setBatchVideoGenerating(false)
        patchShotById(task.shotId, { videoStatus: 'generating' })
      }

      if (task.progressMessage) {
        setVideoTaskMessage(task.progressMessage)
      }
    },
    [getShotById, markVideoGenerating, patchShotById],
  )

  const syncVideoTaskState = useCallback(async () => {
    const projectId = meta?.id
    if (!projectId) return
    try {
      const interrupted = await reconcileStaleVideoTasks(projectId)
      if (interrupted && !isVideoGenerationInflight(projectId)) {
        resetLocalVideoGeneration()
        setPendingWeishiVideo(null)
        toast.error(interrupted.errorMessage || '生视频失败')
      }

      const interruptedImage = await reconcileStaleImageTasks(projectId)
      if (interruptedImage) {
        toast.error(interruptedImage.errorMessage || '生图失败')
      }

      // Step 切换导致 Step4 重挂载时，旧实例的 unmark 不会更新新 state；按 inflight 重新同步
      syncImageGeneratingIdsFromInflight(projectId)

      const tasks = await readWorkflowTasks(projectId)
      const resumable = tasks.filter((task) => isWorkflowVideoTaskResumable(task))

      const maxConcurrency = VIDEO_BATCH_CONCURRENCY
      for (const task of resumable) {
        if (countInflightVideoGenerations(projectId, { singleShotOnly: true }) >= maxConcurrency) {
          break
        }
        if (
          !isInflightVideoTask(projectId, task.id) &&
          !hasVideoResumeLock('workflow', projectId, task.id)
        ) {
          void resumeWorkflowVideoIfNeeded(projectId, task.id)
        }
      }

      if (resumable.length > 0) {
        const resumableShotIds = resumable
          .filter((task) => !isResumableBatchVideoTask(task) && task.shotId)
          .map((task) => task.shotId!)
        if (resumableShotIds.length > 0) {
          setVideoGeneratingIds((prev) => [...new Set([...prev, ...resumableShotIds])])
        }
        const batchTask = resumable.find((task) => isResumableBatchVideoTask(task))
        applyVideoTaskUiFromWorkflowTask(batchTask ?? resumable[0])
      }

      await refreshTaskStore()
    } catch {
      /* 读取失败时保留当前列表 */
    }
  }, [applyVideoTaskUiFromWorkflowTask, meta?.id, refreshTaskStore, resetLocalVideoGeneration, syncImageGeneratingIdsFromInflight])

  useEffect(() => {
    if (!meta?.id) return
    storyboardWasActive.current = false
    void refreshTaskStore()
    void syncStoryboardTaskState()
    void syncVideoTaskState()
    const timer = window.setInterval(() => {
      void syncStoryboardTaskState()
      void syncVideoTaskState()
    }, STORYBOARD_POLL_MS)
    return () => window.clearInterval(timer)
  }, [meta?.id, refreshTaskStore, syncStoryboardTaskState, syncVideoTaskState])

  useEffect(() => {
    if (!meta?.id) return
    const ui = resolveStep4TaskUiState(
      projectTasks,
      { storyboardWasActive: storyboardWasActive.current },
      meta.id,
      activeEpisodeId ?? undefined,
    )
    storyboardWasActive.current = ui.storyboardWasActive
    setInferring(ui.inferring)

    if (!ui.storyboardJustFinished) return
    void (async () => {
      const session = useWorkflowSessionStore.getState()
      // 推理结果已写入内存时，reload 会把旧磁盘数据盖回去
      if (session.dirty) {
        await session.save({ silent: true })
      } else {
        await session.reload()
      }
      const latestData = useWorkflowSessionStore.getState().data
      const latestShots = activeEpisodeId
        ? getShotsForEpisode(latestData?.shots ?? [], activeEpisodeId)
        : []
      if (latestShots[0]) setSelectedShotId(latestShots[0].id)
    })()
  }, [activeEpisodeId, meta?.id, projectTasks, reload])

  const resumableVideoShotIds = useMemo(() => {
    return new Set(
      projectTasks
        .filter(
          (task) =>
            isWorkflowVideoTaskResumable(task) &&
            task.shotId &&
            !isResumableBatchVideoTask(task),
        )
        .map((task) => task.shotId!),
    )
  }, [projectTasks])

  const activeResumableVideoTask = useMemo(
    () => projectTasks.find((task) => isWorkflowVideoTaskResumable(task)) ?? null,
    [projectTasks],
  )
  const activeProjectVideoTask = useMemo(
    () => (meta?.id ? getActiveVideoTask(projectTasks, meta.id) : null),
    [meta?.id, projectTasks],
  )
  const activeVideoTaskShotIds = useMemo(() => {
    const ids = new Set<string>()
    for (const task of projectTasks) {
      if (task.type !== 'video' || !isActiveTaskStatus(task.status)) continue
      if (task.shotId?.trim()) ids.add(task.shotId)
    }
    return ids
  }, [projectTasks])
  useEffect(() => {
    const projectId = meta?.id
    if (!projectId) return

    setVideoGeneratingIds((prev) => {
      const pruned = prev.filter((shotId) => {
        const shot = episodeShots.find((item) => item.id === shotId)
        if (shot?.videoStatus === 'generating') return true
        if (activeVideoTaskShotIds.has(shotId)) return true
        if (batchVideoTargetIds.includes(shotId)) return true
        return listInflightVideoGenerations(projectId).some(
          (session) => !session.isBatch && session.generatingShotId === shotId,
        )
      })
      if (pruned.length === prev.length && pruned.every((id, index) => id === prev[index])) {
        return prev
      }
      return pruned
    })

    const selectedShot = selectedShotId
      ? episodeShots.find((item) => item.id === selectedShotId)
      : null
    const selectedStillBusy =
      selectedShotId &&
      (activeVideoTaskShotIds.has(selectedShotId) ||
        selectedShot?.videoStatus === 'generating' ||
        listInflightVideoGenerations(projectId).some(
          (session) => session.generatingShotId === selectedShotId,
        ))
    if (selectedShotId && !selectedStillBusy) {
      setVideoTaskMessage((message) => {
        if (!message || !selectedShot) return message
        return progressMessageMatchesShot(message, selectedShot.shotNumber) ? '' : message
      })
      setVideoProgressPercent(undefined)
    }

    if (!isVideoGenerationInflight(projectId) && activeVideoTaskShotIds.size === 0) {
      videoOperationBusyRef.current = false
    }
  }, [
    activeVideoTaskShotIds,
    batchVideoTargetIds,
    episodeShots,
    meta?.id,
    projectTasks,
    selectedShotId,
  ])

  const activeImageTaskShotIds = useMemo(() => {
    const ids = new Set<string>()
    for (const task of projectTasks) {
      if (task.type !== 'image' || !isActiveTaskStatus(task.status)) continue
      if (task.shotId?.trim()) ids.add(task.shotId)
    }
    return ids
  }, [projectTasks])

  const isShotImageBusy = useCallback(
    (shotId: string) => {
      if (imageGeneratingIds.includes(shotId)) return true
      if (activeImageTaskShotIds.has(shotId)) return true
      if (episodeShots.find((item) => item.id === shotId)?.status === 'generating') return true
      if (meta?.id) {
        return listInflightImageGenerations(meta.id).some((session) => session.shotId === shotId)
      }
      return false
    },
    [activeImageTaskShotIds, episodeShots, imageGeneratingIds, meta?.id],
  )

  useEffect(() => {
    const projectId = meta?.id
    if (!generatingId) return

    if (!isShotImageBusy(generatingId)) {
      setGeneratingId(null)
    }
  }, [generatingId, isShotImageBusy, meta?.id, projectTasks])

  const resumableVideoShotId = activeResumableVideoTask?.shotId ?? null
  const resumableBatchVideo = activeResumableVideoTask
    ? isResumableBatchVideoTask(activeResumableVideoTask)
    : false
  const resolvedVideoProgressMessage =
    videoTaskMessage ||
    activeResumableVideoTask?.progressMessage ||
    activeProjectVideoTask?.progressMessage ||
    undefined

  const isShotVideoBusy = useCallback(
    (shotId: string) => {
      if (batchVideoTargetIds.includes(shotId)) return true
      if (
        videoGeneratingIds.includes(shotId) ||
        resumableVideoShotIds.has(shotId) ||
        activeVideoTaskShotIds.has(shotId) ||
        episodeShots.find((item) => item.id === shotId)?.videoStatus === 'generating'
      ) {
        return true
      }
      if (meta?.id) {
        return listInflightVideoGenerations(meta.id).some(
          (session) => session.generatingShotId === shotId,
        )
      }
      return false
    },
    [
      activeVideoTaskShotIds,
      batchVideoTargetIds,
      episodeShots,
      meta?.id,
      resumableVideoShotIds,
      videoGeneratingIds,
    ],
  )

  const centerVideoProgressMessage = useMemo(() => {
    if (!selectedShot || !selectedShotId) return undefined
    if (!isShotVideoBusy(selectedShotId)) return undefined
    const task = findActiveVideoTaskForShot(projectTasks, selectedShot)
    if (task?.progressMessage) return task.progressMessage
    if (videoTaskMessage && progressMessageMatchesShot(videoTaskMessage, selectedShot.shotNumber)) {
      return videoTaskMessage
    }
    return `镜号 ${selectedShot.shotNumber}：视频生成中…`
  }, [isShotVideoBusy, projectTasks, selectedShot, selectedShotId, videoTaskMessage])

  const extractAudioAvailability = useMemo(
    () =>
      resolveWorkflowShotExtractAudioAvailability({
        shot: selectedShot,
        videoGenerating: Boolean(selectedShotId && isShotVideoBusy(selectedShotId)),
        videoPreparing: weishiPreviewPreparing,
      }),
    [isShotVideoBusy, selectedShot, selectedShotId, weishiPreviewPreparing],
  )
  const extractAudioTitle = extractAudioAvailability.available
    ? '从本地视频提取 mp3 参考音频'
    : extractAudioAvailability.disabledReason ?? '无法提取音频'

  const centerVideoProgressPercent = useMemo(() => {
    if (!selectedShot || !centerVideoProgressMessage) return undefined
    if (videoTaskMessage && progressMessageMatchesShot(videoTaskMessage, selectedShot.shotNumber)) {
      return resolveShotVideoProgressPercent(centerVideoProgressMessage, videoProgressPercent)
    }
    return resolveShotVideoProgressPercent(centerVideoProgressMessage)
  }, [centerVideoProgressMessage, selectedShot, videoProgressPercent, videoTaskMessage])

  const displayProjectTasks = useMemo(
    () =>
      buildProjectTaskList(projectTasks, {
        inferring,
        videoGenerating:
          videoGeneratingIds.length > 0 ||
          batchVideoGenerating ||
          weishiPreviewPreparing ||
          Boolean(meta?.id && isVideoGenerationInflight(meta.id)) ||
          Boolean(activeResumableVideoTask),
        videoProgressMessage: resolvedVideoProgressMessage,
        episode: selectedEpisode,
      }),
    [
      activeResumableVideoTask,
      batchVideoGenerating,
      inferring,
      meta?.id,
      projectTasks,
      resolvedVideoProgressMessage,
      selectedEpisode,
      videoGeneratingIds,
      weishiPreviewPreparing,
    ],
  )

  useEffect(() => {
    const projectId = meta?.id
    if (!projectId || !selectedEpisode) return
    const inflight = getInflightStoryboardInference(projectId, selectedEpisode.id)
    if (!inflight) return
    const epoch = ++inferAttachEpoch.current
    setInferring(true)
    storyboardWasActive.current = true
    void inflight
      .catch(() => {
        /* toast 由 handleInfer 或 pollTasks 处理 */
      })
      .finally(() => {
        if (epoch !== inferAttachEpoch.current) return
        void syncStoryboardTaskState()
      })
  }, [meta?.id, selectedEpisode?.id, syncStoryboardTaskState])

  useEffect(() => {
    const projectId = meta?.id
    if (!projectId) return

    let cancelled = false

    const attachInflightUi = (projectId: string) => {
      const epoch = ++videoAttachEpoch.current
      videoGenerationCancelledRef.current = false
      const inflightSessions = listInflightVideoGenerations(projectId)
      if (inflightSessions.length === 0) return

      videoOperationBusyRef.current = true
      syncVideoGeneratingIdsFromInflight(projectId)

      const active = getActiveVideoTask(projectTasks, projectId)
      if (active?.progressMessage) {
        setVideoTaskMessage(active.progressMessage)
      }

      void Promise.all(inflightSessions.map((session) => session.promise)).finally(() => {
        if (epoch !== videoAttachEpoch.current) return
        void syncVideoTaskState()
      })
    }

    void (async () => {
      const tasks = await readWorkflowTasks(projectId)
      const resumable = tasks.filter((task) => isWorkflowVideoTaskResumable(task))
      const inflightSessions = listInflightVideoGenerations(projectId)
      if (inflightSessions.length === 0 && resumable.length > 0) {
        const maxConcurrency = VIDEO_BATCH_CONCURRENCY
        for (const task of resumable) {
          if (countInflightVideoGenerations(projectId, { singleShotOnly: true }) >= maxConcurrency) {
            break
          }
          if (
            !isInflightVideoTask(projectId, task.id) &&
            !hasVideoResumeLock('workflow', projectId, task.id)
          ) {
            void resumeWorkflowVideoIfNeeded(projectId, task.id)
          }
        }
      }
      if (cancelled) return
      const latestInflight = listInflightVideoGenerations(projectId)
      if (latestInflight.length > 0) {
        attachInflightUi(projectId)
        return
      }
      if (resumable.length > 0) {
        const resumableShotIds = resumable
          .filter((task) => !isResumableBatchVideoTask(task) && task.shotId)
          .map((task) => task.shotId!)
        if (resumableShotIds.length > 0) {
          setVideoGeneratingIds((prev) => [...new Set([...prev, ...resumableShotIds])])
        }
        const batchTask = resumable.find((task) => isResumableBatchVideoTask(task))
        applyVideoTaskUiFromWorkflowTask(batchTask ?? resumable[0])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [applyVideoTaskUiFromWorkflowTask, meta?.id, projectTasks, syncVideoGeneratingIdsFromInflight, syncVideoTaskState])

  const handleGenerateOne = async (
    imageSizePreset: string,
    shot = selectedShot,
    options?: { inferenceFormat?: InferenceFormat },
  ) => {
    if (!shot || !settings || !selectedEpisode || !data) return
    if (!shot.prompt.trim()) {
      toast.error('请先填写分镜提示词')
      return
    }
    const shotId = shot.id
    const projectId = meta?.id
    const taskId = projectId ? createImageTaskId() : null
    const startMessage = `镜号 ${shot.shotNumber}：生图中…`
    const assets = collectEpisodeAssets(data, selectedEpisode)
    const candidates = buildMentionCandidates(assets)
    const previewBeforeGenerate =
      selectedShotId === shotId ? centerPreviewUrl : (previewMap[shotId] ?? null)
    const controller = new AbortController()
    shotImageGenerationSessionsRef.current.set(shotId, {
      controller,
      snapshot: snapshotShotImageGenerationState(shot),
      previewUrl: previewBeforeGenerate,
      cancelled: false,
      taskId,
      taskStartedAt: 0,
    })
    markImageGenerating(shotId)
    setGeneratingId(shotId)
    patchShotById(shotId, { status: 'generating' })

    const runGeneration = async () => {
      let taskStartedAt = 0
      if (projectId && taskId) {
        taskStartedAt = await startImageGenerationTask(projectId, taskId, {
          episode: selectedEpisode,
          progressMessage: startMessage,
          shotId,
        })
        const session = shotImageGenerationSessionsRef.current.get(shotId)
        if (session) session.taskStartedAt = taskStartedAt
      }
      try {
        const imagePath = await generateShotImage(shot, {
          settings,
          projectId: meta?.id,
          appDataDir,
          imageSizePreset,
          projectStyleKey: stylePresetKey,
          inferenceFormat: options?.inferenceFormat,
          promptPrefix,
          promptSuffix,
          previousShot: resolvePreviousEpisodeShot(episodeShots, shot),
          episodeShots,
          mentionCandidates: candidates,
          signal: controller.signal,
        })
        const session = shotImageGenerationSessionsRef.current.get(shotId)
        if (session?.cancelled) return
        const currentShot = getShotById(shotId) ?? shot
        patchShotMediaWithPrune(shotId, appendShotGeneratedImage(currentShot, imagePath))
        const url = await resolveImagePreviewSrc(imagePath, projectRoot)
        setPreviewMap((prev) => ({ ...prev, [shotId]: url ?? imagePath }))
        if (selectedShotId === shotId) setCenterPreviewUrl(url ?? imagePath)
        await save({ silent: true })
        if (projectId && taskId) {
          await finishImageGenerationTask(
            projectId,
            taskId,
            {
              status: 'completed',
              progressMessage: formatShotStoryboardImageGeneratedToast(shot),
            },
            taskStartedAt,
            selectedEpisode,
          )
        }
        toast.success(formatShotStoryboardImageGeneratedToast(shot))
      } catch (error: unknown) {
        const session = shotImageGenerationSessionsRef.current.get(shotId)
        if (session?.cancelled || isGenerationCancelledError(error)) {
          if (session && !session.cancelled) {
            patchShotById(shotId, restoreShotAfterGenerationCancel(session.snapshot))
          }
          if (projectId && taskId) {
            await finishImageGenerationTask(
              projectId,
              taskId,
              {
                status: 'failed',
                progressMessage: `镜号 ${shot.shotNumber}：已取消`,
                errorMessage: '生图已取消',
              },
              taskStartedAt,
              selectedEpisode,
            )
          }
          return
        }
        patchShotById(shotId, { status: 'failed' })
        await save({ silent: true })
        const message = formatUserFacingBillingError(error, '生图失败')
        if (projectId && taskId) {
          await finishImageGenerationTask(
            projectId,
            taskId,
            {
              status: 'failed',
              progressMessage: formatShotStoryboardImageFailedToast(shot, message),
              errorMessage: message,
            },
            taskStartedAt,
            selectedEpisode,
          )
        }
        toast.error(formatShotStoryboardImageFailedToast(shot, message))
      } finally {
        shotImageGenerationSessionsRef.current.delete(shotId)
        unmarkImageGenerating(shotId)
        setGeneratingId((current) => (current === shotId ? null : current))
      }
    }

    const generationPromise = runGeneration()
    if (projectId && taskId) {
      registerInflightImageGeneration(projectId, taskId, generationPromise, { shotId })
    }
    await generationPromise
  }

  const stopShotImageGeneration = useCallback(
    async (shotId: string, options?: { taskId?: string | null; silent?: boolean }) => {
      const projectId = meta?.id
      const session = shotImageGenerationSessionsRef.current.get(shotId)
      let taskId = options?.taskId ?? session?.taskId ?? null

      if (session) {
        if (session.cancelled) return true
        session.cancelled = true
        session.controller.abort()
        patchShotById(shotId, restoreShotAfterGenerationCancel(session.snapshot))
        if (session.previewUrl) {
          setPreviewMap((prev) => ({ ...prev, [shotId]: session.previewUrl! }))
          if (selectedShotId === shotId) setCenterPreviewUrl(session.previewUrl)
        } else {
          setPreviewMap((prev) => {
            const next = { ...prev }
            delete next[shotId]
            return next
          })
          if (selectedShotId === shotId) setCenterPreviewUrl(null)
        }
        shotImageGenerationSessionsRef.current.delete(shotId)
        unmarkImageGenerating(shotId)
        setGeneratingId((current) => (current === shotId ? null : current))
      } else {
        const shot = episodeShots.find((item) => item.id === shotId)
        if (shot?.status === 'generating') {
          patchShotById(shotId, {
            status: getGeneratedImagePaths(shot).length > 0 ? 'done' : 'draft',
          })
        }
        unmarkImageGenerating(shotId)
        setGeneratingId((current) => (current === shotId ? null : current))
      }

      if (projectId && taskId) {
        await cancelImageGenerationTask(projectId, taskId, {
          progressMessage: '已终止',
          errorMessage: '生图已取消',
        })
      }

      if (!options?.silent) {
        toast.message('已停止生成', {
          description: '本次任务已取消；若分镜原先有成品，仍会保留。',
        })
      }
      return true
    },
    [episodeShots, meta?.id, patchShotById, selectedShotId],
  )

  useEffect(() => {
    registerWorkflowImageStopHandler(stopShotImageGeneration)
    return () => registerWorkflowImageStopHandler(null)
  }, [stopShotImageGeneration])

  const handleStopShotGeneration = useCallback(
    (shotId: string) => {
      void stopShotImageGeneration(shotId)
    },
    [stopShotImageGeneration],
  )

  const stopVideoGenerationForShot = useCallback(
    async (shotId: string, taskIdHint?: string | null) => {
      const projectId = meta?.id
      if (!projectId) return

      if (activeVideoTaskIdRef.current) {
        videoGenerationCancelledRef.current = true
      }

      await stopWorkflowVideoGeneration(projectId, { taskId: taskIdHint, shotId })

      unmarkVideoGenerating(shotId)
      releaseBatchVideoTarget(shotId)
      setPendingWeishiVideo((prev) => (prev?.shot.id === shotId ? null : prev))
      setWeishiPreviewPreparing(false)

      if (selectedShotId === shotId) {
        setVideoTaskMessage('')
        setVideoProgressPercent(undefined)
      }
      if (!isVideoGenerationInflight(projectId)) {
        videoOperationBusyRef.current = false
        setVideoTaskMessage('')
        setVideoProgressPercent(undefined)
        activeVideoTaskIdRef.current = null
      } else {
        syncVideoGeneratingIdsFromInflight(projectId)
      }
      void refreshTaskStore()
    },
    [
      meta?.id,
      refreshTaskStore,
      releaseBatchVideoTarget,
      selectedShotId,
      syncVideoGeneratingIdsFromInflight,
      unmarkVideoGenerating,
    ],
  )

  const handleStopGenerateVideoShot = useCallback(
    async (shotId: string) => {
      await stopVideoGenerationForShot(shotId)
      toast.message('已停止生成', {
        description: '本次任务已取消；若分镜原先有成品视频，仍会保留。',
      })
    },
    [stopVideoGenerationForShot],
  )

  const handleCancelWorkflowTask = useCallback(
    async (taskId: string) => {
      const projectId = meta?.id
      if (!projectId) return
      setCancellingTaskId(taskId)
      try {
        const task = projectTasks.find((item) => item.id === taskId)
        if (task?.type === 'video' && task.shotId) {
          await stopVideoGenerationForShot(task.shotId, taskId)
          toast.message('任务已终止')
          return
        }
        if (task?.type === 'image' && task.shotId) {
          await stopWorkflowImageGeneration(projectId, {
            taskId,
            shotId: task.shotId,
            silent: true,
          })
          toast.message('任务已终止')
          return
        }
        const isActiveSession =
          activeVideoTaskIdRef.current === taskId || getVideoSessionTaskId(projectId) === taskId
        if (isActiveSession) {
          resetLocalVideoGeneration()
          setPendingWeishiVideo(null)
        }
        if (task?.type === 'image') {
          await cancelImageGenerationTask(projectId, taskId)
        } else {
          await cancelVideoGenerationTask(projectId, taskId)
        }
        toast.message('任务已终止')
      } catch (error: unknown) {
        toast.error((error as Error).message || '终止任务失败')
      } finally {
        setCancellingTaskId(null)
        void refreshTaskStore()
      }
    },
    [meta?.id, projectTasks, refreshTaskStore, resetLocalVideoGeneration, stopVideoGenerationForShot, stopWorkflowImageGeneration],
  )

  const handleDeleteWorkflowTask = useCallback(
    async (taskId: string) => {
      const projectId = meta?.id
      if (!projectId) return
      setDeletingTaskId(taskId)
      try {
        const task = projectTasks.find((item) => item.id === taskId)
        if (task && isActiveTaskStatus(task.status)) {
          if (task.type === 'video' && task.shotId) {
            await stopVideoGenerationForShot(task.shotId, taskId)
          } else if (task.type === 'image' && task.shotId) {
            await stopWorkflowImageGeneration(projectId, {
              taskId,
              shotId: task.shotId,
              silent: true,
            })
          } else if (task.type === 'video') {
            await stopWorkflowVideoGeneration(projectId, { taskId })
          } else if (task.type === 'image') {
            await stopWorkflowImageGeneration(projectId, { taskId, silent: true })
          }
        }
        const removed = await removeWorkflowTask(projectId, taskId)
        if (removed) toast.message('任务已删除')
        else toast.error('任务不存在或已删除')
      } catch (error: unknown) {
        toast.error((error as Error).message || '删除任务失败')
      } finally {
        setDeletingTaskId(null)
        void refreshTaskStore()
      }
    },
    [meta?.id, projectTasks, refreshTaskStore, stopVideoGenerationForShot, stopWorkflowImageGeneration],
  )

  const handleClearGeneratedImages = useCallback(async () => {
    if (!selectedShot) return
    const ok = await ask({
      title: '清空生成图',
      description: '确定清空当前分镜的全部生成图吗？',
      confirmLabel: '清空',
      variant: 'destructive',
    })
    if (!ok) return
    patchSelectedShot({
      ...buildImageFieldsFromPaths(getReferenceImagePaths(selectedShot), [], 0),
      status: 'draft',
      validated: false,
      validatedImagePath: undefined,
      validatedImagePaths: undefined,
    })
    setPreviewMap((prev) => {
      const next = { ...prev }
      delete next[selectedShot.id]
      return next
    })
    setCenterPreviewUrl(null)
    void save({ silent: true })
  }, [ask, patchSelectedShot, save, selectedShot])

  const handleSetPrimaryImage = useCallback(
    (index: number) => {
      if (!selectedShot) return
      const paths = getGeneratedImagePaths(selectedShot)
      if (!paths.length) return
      patchShotMediaWithPrune(selectedShot.id, {
        ...buildImageFieldsFromPaths(getReferenceImagePaths(selectedShot), paths, index),
      })
      void resolveImagePreviewSrc(paths[index], projectRoot).then((url) => {
        if (url) {
          setPreviewMap((prev) => ({ ...prev, [selectedShot.id]: url }))
          setCenterPreviewUrl(url)
        }
      })
      void save({ silent: true })
    },
    [patchShotMediaWithPrune, projectRoot, save, selectedShot],
  )

  const prepareWeishiVideoPreviewForShot = useCallback(
    async (
      shot: WorkflowShot,
      params: StoryboardVideoGenerateParams,
      options?: { batchCount?: number; markStoryboardValidated?: boolean },
    ) => {
      if (!mergedVideoModels.length) return null
      let model
      try {
        model = pickVideoModel(mergedVideoModels, videoModelId || undefined)
      } catch {
        return null
      }
      if (!isWeishiApiModel(model)) return null

      const videoModel = resolveActiveVideoModel()
      const referenceMode = clampVideoReferenceMode(params.referenceMode, videoModel ?? model)
      const referenceContext = resolveVideoReferenceContext(shot, episodeShots)
      const { mentionCandidates, characters, scenes, props } = shotVideoMediaContext
      let refItems = resolveVideoReferenceItems(
        shot,
        referenceMode,
        referenceContext,
        {
          mentionCandidates,
          characters,
          scenes,
          props,
          weishiEndpoint: videoModel?.endpoint,
        },
      )
      const audioItems = buildShotVideoReferenceAudioItems(shot, {
        mentionCandidates,
        characters,
        scenes,
        props,
        voiceLibrary,
      })
      refItems = appendMissingCharacterRefImages(refItems, {
        shot,
        audioItems,
        mentionCandidates,
        characters,
        scenes,
        props,
        weishiEndpoint: videoModel?.endpoint,
      })
      const refPaths = refItems.map((item) => item.path)
      const audioPaths = audioItems.map((item) => item.path)
      const shotBody = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
      const videoPrompt = composeWeishiVideoPrompt({
        shotBody,
        imageItems: referenceMode !== 'text_to_video' ? refItems : [],
        audioItems,
        prefix: promptPrefix,
        suffix: promptSuffix,
      })
      const referenceModeLabel =
        VIDEO_REFERENCE_MODE_LABELS[referenceMode] ?? referenceMode

      return prepareWeishiVideoRequestPreview({
        model,
        prompt: videoPrompt,
        durationSec: params.durationSec,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        referenceImagePath: refPaths[0] ?? null,
        referenceImagePaths: refPaths,
        referenceImageItems: refItems.map((item) => ({
          label: item.label,
          path: item.path,
          kind: item.kind,
          weishiAssetUrl: item.weishiAssetUrl,
        })),
        referenceAudioPaths: audioPaths,
        referenceAudioItems: audioItems.map((item) => ({ label: item.label, path: item.path })),
        projectRoot: meta?.id ? resolveProjectRoot(settings, appDataDir, meta.id) : undefined,
        apiBaseUrl: settings.apiBaseUrl,
        referenceMediaUploadMode: resolveEffectiveWeishiReferenceMediaUploadMode(
          settings.weishiReferenceMediaUploadMode,
          model,
        ),
        referenceMode,
        referenceModeLabel,
        shotNumber: shot.shotNumber,
        batchCount: options?.batchCount,
      }).then(async (prepared) => {
        const persistPatches = buildWeishiUploadPersistPatches({
          shot,
          refItems: refItems.map((item) => ({
            path: item.path,
            kind: item.kind,
            sourceAssetId: item.sourceAssetId,
            weishiAssetUrl: item.weishiAssetUrl,
          })),
          preparedReferences: prepared.preparedReferences,
          characters,
          scenes,
          props,
          endpoint: videoModel?.endpoint,
        })
        const validationPatch = options?.markStoryboardValidated
          ? buildShotImageValidationPatch(shot)
          : {}
        await applyWeishiPersistPatches(shot.id, {
          shotPatch: { ...persistPatches.shotPatch, ...validationPatch },
          dataPatch: persistPatches.dataPatch,
        })
        return prepared
      })
    },
    [
      appDataDir,
      applyWeishiPersistPatches,
      episodeShots,
      meta?.id,
      promptPrefix,
      promptSuffix,
      resolveActiveVideoModel,
      settings,
      shotVideoMediaContext,
      videoModelId,
      voiceLibrary,
    ],
  )

  const prepareZhipuVideoPreviewForShot = useCallback(
    async (
      shot: WorkflowShot,
      params: StoryboardVideoGenerateParams,
      options?: { batchCount?: number },
    ) => {
      if (!mergedVideoModels.length) return null
      let model
      try {
        model = pickVideoModel(mergedVideoModels, videoModelId || undefined)
      } catch {
        return null
      }
      if (!isZhipuVideoModel(model.model || '', model.endpoint, model.apiFormat)) return null

      const referenceMode = clampVideoReferenceMode(params.referenceMode, model)
      const referenceContext = resolveVideoReferenceContext(shot, episodeShots)
      const { mentionCandidates, characters, scenes, props } = shotVideoMediaContext
      const refItems = resolveVideoReferenceItems(
        shot,
        referenceMode,
        referenceContext,
        { mentionCandidates, characters, scenes, props },
      )
      const refPaths = refItems.map((item) => item.path)
      const shotBody = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
      const videoPrompt =
        referenceMode !== 'text_to_video' && refItems.length > 0
          ? applyPromptAffix(
              enrichVideoPromptWithReferenceImageHints(shotBody, refItems),
              promptPrefix,
              promptSuffix,
            )
          : applyPromptAffix(shotBody, promptPrefix, promptSuffix)
      const referenceModeLabel =
        VIDEO_REFERENCE_MODE_LABELS[referenceMode] ?? referenceMode

      return prepareZhipuVideoRequestPreview({
        model,
        prompt: videoPrompt,
        durationSec: params.durationSec,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        referenceMode,
        referenceImagePath: refPaths[0] ?? null,
        referenceImagePaths: refPaths,
        referenceImageItems: refItems.map((item) => ({
          label: item.label,
          path: item.path,
          kind: item.kind,
        })),
        projectRoot: meta?.id ? resolveProjectRoot(settings, appDataDir, meta.id) : undefined,
        apiBaseUrl: settings.apiBaseUrl,
        referenceModeLabel,
        shotNumber: shot.shotNumber,
        batchCount: options?.batchCount,
      })
    },
    [
      appDataDir,
      episodeShots,
      meta?.id,
      promptPrefix,
      promptSuffix,
      settings,
      shotVideoMediaContext,
      videoModelId,
      mergedVideoModels,
    ],
  )

  const prepareGrokVideoPreviewForShot = useCallback(
    async (
      shot: WorkflowShot,
      params: StoryboardVideoGenerateParams,
      options?: { batchCount?: number },
    ) => {
      if (!mergedVideoModels.length) return null
      let model
      try {
        model = pickVideoModel(mergedVideoModels, videoModelId || undefined)
      } catch {
        return null
      }
      if (!isGrokVideoModel(model)) return null

      const referenceMode = clampVideoReferenceMode(params.referenceMode, model)
      const referenceContext = resolveVideoReferenceContext(shot, episodeShots)
      const { mentionCandidates, characters, scenes, props } = shotVideoMediaContext
      const refItems = resolveVideoReferenceItems(
        shot,
        referenceMode,
        referenceContext,
        { mentionCandidates, characters, scenes, props },
      )
      const refPaths = refItems.map((item) => item.path)
      const shotBody = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
      const videoPrompt =
        referenceMode !== 'text_to_video' && refItems.length > 0
          ? applyPromptAffix(
              enrichVideoPromptWithReferenceImageHints(shotBody, refItems),
              promptPrefix,
              promptSuffix,
            )
          : applyPromptAffix(shotBody, promptPrefix, promptSuffix)
      const referenceModeLabel =
        VIDEO_REFERENCE_MODE_LABELS[referenceMode] ?? referenceMode

      return prepareGrokVideoRequestPreview({
        model,
        prompt: videoPrompt,
        durationSec: params.durationSec,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        referenceMode,
        referenceImagePath: refPaths[0] ?? null,
        referenceImagePaths: refPaths,
        referenceImageItems: refItems.map((item) => ({
          label: item.label,
          path: item.path,
          kind: item.kind,
        })),
        projectRoot: meta?.id ? resolveProjectRoot(settings, appDataDir, meta.id) : undefined,
        apiBaseUrl: settings.apiBaseUrl,
        referenceModeLabel,
        shotNumber: shot.shotNumber,
        batchCount: options?.batchCount,
      })
    },
    [
      appDataDir,
      episodeShots,
      meta?.id,
      promptPrefix,
      promptSuffix,
      settings,
      shotVideoMediaContext,
      videoModelId,
      mergedVideoModels,
    ],
  )

  const prepareOpenAiVideoPreviewForShot = useCallback(
    async (
      shot: WorkflowShot,
      params: StoryboardVideoGenerateParams,
      options?: { batchCount?: number },
    ) => {
      if (!mergedVideoModels.length) return null
      let model
      try {
        model = pickVideoModel(mergedVideoModels, videoModelId || undefined)
      } catch {
        return null
      }
      if (!shouldUseOpenAiVideoClient(model)) return null

      const referenceMode = clampVideoReferenceMode(params.referenceMode, model)
      const referenceContext = resolveVideoReferenceContext(shot, episodeShots)
      const { mentionCandidates, characters, scenes, props } = shotVideoMediaContext
      const refItems = resolveVideoReferenceItems(
        shot,
        referenceMode,
        referenceContext,
        { mentionCandidates, characters, scenes, props },
      )
      const refPaths = refItems.map((item) => item.path)
      const shotBody = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
      const videoPrompt =
        referenceMode !== 'text_to_video' && refItems.length > 0
          ? applyPromptAffix(
              enrichVideoPromptWithReferenceImageHints(shotBody, refItems),
              promptPrefix,
              promptSuffix,
            )
          : applyPromptAffix(shotBody, promptPrefix, promptSuffix)
      const referenceModeLabel =
        VIDEO_REFERENCE_MODE_LABELS[referenceMode] ?? referenceMode

      return prepareOpenAiVideoRequestPreview({
        model,
        prompt: videoPrompt,
        durationSec: params.durationSec,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        referenceMode,
        referenceImagePath: refPaths[0] ?? null,
        referenceImagePaths: refPaths,
        referenceImageItems: refItems.map((item) => ({
          label: item.label,
          path: item.path,
          kind: item.kind,
        })),
        projectRoot: meta?.id ? resolveProjectRoot(settings, appDataDir, meta.id) : undefined,
        apiBaseUrl: settings.apiBaseUrl,
        referenceModeLabel,
        shotNumber: shot.shotNumber,
        batchCount: options?.batchCount,
      })
    },
    [
      appDataDir,
      episodeShots,
      meta?.id,
      promptPrefix,
      promptSuffix,
      settings,
      shotVideoMediaContext,
      videoModelId,
      mergedVideoModels,
    ],
  )

  const beginWeishiVideoConfirm = useCallback(
    async (
      params: StoryboardVideoGenerateParams,
      shot: WorkflowShot,
      options?: { skipImageValidation?: boolean; batchTargets?: WorkflowShot[] },
    ): Promise<WeishiVideoBeginResult> => {
      if (weishiPreviewPreparing) {
        toast.info('视频参考素材准备中，请稍候')
        return 'failed'
      }
      if (!mergedVideoModels.length) return 'direct'
      let model
      try {
        model = pickVideoModel(mergedVideoModels, videoModelId || undefined)
      } catch {
        return 'direct'
      }
      if (
        !isWeishiApiModel(model) &&
        !isZhipuVideoModel(model.model || '', model.endpoint, model.apiFormat) &&
        !isGrokVideoModel(model) &&
        !shouldUseOpenAiVideoClient(model)
      ) {
        return 'direct'
      }
      if (!settings.debugEnabled) return 'direct'
      // 批量生成跳过调试确认弹窗，仅单条生成展示 API 预览
      if (options?.batchTargets?.length) return 'direct'

      videoOperationBusyRef.current = true
      setWeishiPreviewPreparing(true)
      setVideoTaskMessage(`镜号 ${shot.shotNumber}：准备参考素材…`)
      try {
        if (isWeishiApiModel(model)) {
          const prepared = await prepareWeishiVideoPreviewForShot(shot, params, {
            batchCount: options?.batchTargets?.length,
            markStoryboardValidated: options?.skipImageValidation,
          })
          if (!prepared) return 'direct'
          setPendingWeishiVideo({
            params,
            shot,
            preview: prepared.preview,
            preparedReferences: prepared.preparedReferences,
            skipImageValidation: options?.skipImageValidation,
            batchTargets: options?.batchTargets,
          })
          return 'confirm'
        }

        if (isZhipuVideoModel(model.model || '', model.endpoint, model.apiFormat)) {
          const prepared = await prepareZhipuVideoPreviewForShot(shot, params, {
            batchCount: options?.batchTargets?.length,
          })
          if (!prepared) return 'direct'
          setPendingWeishiVideo({
            params,
            shot,
            preview: prepared.preview,
            preparedReferences: [],
            skipImageValidation: options?.skipImageValidation,
            batchTargets: options?.batchTargets,
          })
          return 'confirm'
        }

        if (isGrokVideoModel(model)) {
          const prepared = await prepareGrokVideoPreviewForShot(shot, params, {
            batchCount: options?.batchTargets?.length,
          })
          if (!prepared) return 'direct'
          setPendingWeishiVideo({
            params,
            shot,
            preview: prepared.preview,
            preparedReferences: [],
            skipImageValidation: options?.skipImageValidation,
            batchTargets: options?.batchTargets,
          })
          return 'confirm'
        }

        if (shouldUseOpenAiVideoClient(model)) {
          const prepared = await prepareOpenAiVideoPreviewForShot(shot, params, {
            batchCount: options?.batchTargets?.length,
          })
          if (!prepared) return 'direct'
          setPendingWeishiVideo({
            params,
            shot,
            preview: prepared.preview,
            preparedReferences: [],
            skipImageValidation: options?.skipImageValidation,
            batchTargets: options?.batchTargets,
          })
          return 'confirm'
        }

        return 'direct'
      } catch (error: unknown) {
        toast.error((error as Error).message || '视频开白失败')
        return 'failed'
      } finally {
        setWeishiPreviewPreparing(false)
        setVideoTaskMessage('')
        videoOperationBusyRef.current = false
      }
    },
    [
      prepareWeishiVideoPreviewForShot,
      prepareZhipuVideoPreviewForShot,
      prepareGrokVideoPreviewForShot,
      prepareOpenAiVideoPreviewForShot,
      settings?.debugEnabled,
      mergedVideoModels,
      videoModelId,
    ],
  )

  const runGenerateVideoOne = async (
    params: StoryboardVideoGenerateParams,
    shot = selectedShot,
    options?: {
      skipImageValidation?: boolean
      weishiPreparedReferences?: WeishiVideoReferenceItem[]
    },
  ) => {
    if (!shot || !settings) return
    const shotId = shot.id
    const projectId = meta?.id
    if (projectId) {
      const resumableTask = projectTasks.find(
        (task) => isWorkflowVideoTaskResumable(task) && task.shotId === shotId,
      )
      if (resumableTask) {
        if (
          !isInflightVideoTask(projectId, resumableTask.id) &&
          !hasVideoResumeLock('workflow', projectId, resumableTask.id)
        ) {
          void resumeWorkflowVideoIfNeeded(projectId, resumableTask.id)
        }
        toast.info('检测到未完成视频任务，正在恢复…')
        return
      }
    }
    const taskId = projectId ? createVideoTaskId() : null
    const startMessage = `镜号 ${shot.shotNumber}：生视频中…`

    videoGenerationCancelledRef.current = false
    clearWorkflowVideoGenerationCancelled(shotId)
    activeVideoTaskIdRef.current = taskId
    markVideoGenerating(shotId)
    setPreviewMode('video')
    setVideoTaskMessage(startMessage)
    setVideoProgressPercent(undefined)
    patchShotById(shotId, { videoStatus: 'generating' })
    videoOperationBusyRef.current = true
    const { mentionCandidates, characters, scenes, props } = shotVideoMediaContext

    const executeGeneration = async () => {
      let taskStartedAt = 0
      if (projectId && taskId) {
        taskStartedAt = await startVideoGenerationTask(projectId, taskId, {
          episode: selectedEpisode,
          progressMessage: startMessage,
          shotId,
        })
      }
      const controller = new AbortController()
      bindWorkflowVideoGenerationAbort(shotId, controller)
      try {
        const videoPath = await generateShotVideo(shot, {
          settings,
          projectId: meta?.id,
          appDataDir,
          videoModelId: videoModelId || undefined,
          referenceMode: params.referenceMode,
          episodeShots,
          mentionCandidates,
          characters,
          scenes,
          props,
          voiceLibrary,
          durationSec: params.durationSec,
          resolution: params.resolution,
          aspectRatio: params.aspectRatio,
          promptPrefix,
          promptSuffix,
          skipImageValidation: options?.skipImageValidation,
          weishiPreparedReferences: options?.weishiPreparedReferences,
          abortSignal: controller.signal,
          onWeishiPersist: async (patches) => {
            await applyWeishiPersistPatches(shotId, patches)
          },
          onRemoteJobCreated: async (job) => {
            if (!projectId || !taskId) return
            await persistVideoTaskRemoteJob(
              projectId,
              taskId,
              buildPersistedRemoteJob(job),
              {
                shotId,
                progressMessage: `镜号 ${shot.shotNumber}：生视频中…`,
              },
            )
          },
          onProgress: (update) => {
            const progressMessage = `镜号 ${shot.shotNumber}：${update.message}`
            setVideoTaskMessage(progressMessage)
            setVideoProgressPercent(update.progress)
            if (projectId && taskId && taskStartedAt) {
              void updateVideoGenerationTask(
                projectId,
                taskId,
                progressMessage,
                taskStartedAt,
                selectedEpisode,
              )
            }
          },
        })
        if (isVideoGenerationStopped(shotId)) {
          return
        }
      patchShotById(shotId, appendShotGeneratedVideo(getShotById(shotId) ?? shot, videoPath))
      if (selectedShotId === shotId) {
        const previewUrl = await getCachedVideoPreviewSrc(videoPath, projectRoot)
        setCenterVideoPreviewUrl(previewUrl)
        setPreviewMode('video')
      }
      await save({ silent: true })
      if (projectId && taskId && taskStartedAt) {
        await finishVideoGenerationTask(
          projectId,
          taskId,
          {
            status: 'completed',
            progressMessage: formatShotVideoGeneratedToast(shot),
          },
          taskStartedAt,
          selectedEpisode,
        )
      }
      toast.success(formatShotVideoGeneratedToast(shot))
    } catch (error: unknown) {
      if (isVideoGenerationStopped(shotId, error)) {
        return
      }
      patchShotById(shotId, { videoStatus: 'failed' })
      await save({ silent: true })
      const errorMessage = formatUserFacingBillingError(error, '生视频失败')
      if (projectId && taskId && taskStartedAt) {
        await finishVideoGenerationTask(
          projectId,
          taskId,
          {
            status: 'failed',
            progressMessage: formatShotVideoFailedToast(shot, errorMessage),
            errorMessage,
          },
          taskStartedAt,
          selectedEpisode,
        )
      }
      toast.error(formatShotVideoFailedToast(shot, errorMessage))
    } finally {
      unbindWorkflowVideoGenerationAbort(shotId, controller)
      clearWorkflowVideoGenerationCancelled(shotId)
      activeVideoTaskIdRef.current = null
      unmarkVideoGenerating(shotId)
      if (!projectId || !isVideoGenerationInflight(projectId)) {
        setVideoTaskMessage('')
        setVideoProgressPercent(undefined)
        videoOperationBusyRef.current = false
      }
      const latestShot = getShotById(shotId)
      if (
        !isVideoGenerationStopped(shotId) &&
        latestShot?.videoStatus === 'generating' &&
        taskId &&
        projectId &&
        !isInflightVideoTask(projectId, taskId)
      ) {
        patchShotById(shotId, { videoStatus: 'failed' })
      }
      if (projectId) void refreshTaskStore()
    }
    }

    if (projectId && taskId) {
      const promise = executeGeneration()
      registerInflightVideoGeneration(projectId, taskId, promise, {
        isBatch: false,
        generatingShotId: shotId,
      })
      await promise
    } else {
      await executeGeneration()
    }
  }

  const requestGenerateVideoOne = (
    params: StoryboardVideoGenerateParams,
    shot = selectedShot,
  ) => {
    if (!shot || !settings) return
    if (!shot.prompt.trim()) {
      toast.error('请先填写分镜提示词')
      return
    }
    if (weishiPreviewPreparing) {
      toast.info('视频任务进行中，请稍候')
      return
    }
    if (batchVideoGenerating) {
      if (batchVideoTargetIds.includes(shot.id)) {
        toast.info('该镜头已在批量生视频队列中，将按并发数自动排队生成')
        return
      }
      const shotStillGenerating =
        videoGeneratingIds.includes(shot.id) ||
        shot.videoStatus === 'generating' ||
        activeVideoTaskShotIds.has(shot.id)
      if (shotStillGenerating) {
        toast.info('该镜头正在生成视频')
        return
      }
    }
    if (pendingWeishiVideo) {
      toast.info('请先确认或取消当前视频生成弹窗')
      return
    }
    if (
      videoGeneratingIds.includes(shot.id) ||
      shot.videoStatus === 'generating' ||
      activeVideoTaskShotIds.has(shot.id)
    ) {
      toast.info('该镜头正在生成视频')
      return
    }
    const projectId = meta?.id
    if (projectId && countActiveSingleShotVideos(projectId) >= VIDEO_BATCH_CONCURRENCY) {
      toast.info(`最多同时生成 ${VIDEO_BATCH_CONCURRENCY} 个视频，请稍候`)
      return
    }
    const unsupportedMsg = getUnsupportedVideoReferenceModeMessage(
      params.referenceMode,
      resolveActiveVideoModel(),
    )
    if (unsupportedMsg) {
      toast.warning(unsupportedMsg)
      return
    }
    const skipImageValidation = !isStoryboardImageValidated(shot)
    void beginWeishiVideoConfirm(params, shot, { skipImageValidation }).then((result) => {
      if (result === 'direct') void runGenerateVideoOne(params, shot, { skipImageValidation })
    })
  }

  const handleConfirmWeishiVideo = () => {
    if (!pendingWeishiVideo) return
    const { params, shot, skipImageValidation, batchTargets, preparedReferences } =
      pendingWeishiVideo
    setPendingWeishiVideo(null)
    if (batchTargets?.length) {
      void runBatchGenerateVideos(params, batchTargets)
      return
    }
    void runGenerateVideoOne(params, shot, {
      skipImageValidation,
      weishiPreparedReferences: preparedReferences,
    })
  }

  const runBatchGenerateVideos = useCallback(
    async (params: StoryboardVideoGenerateParams, targets: WorkflowShot[]) => {
      if (!settings || targets.length === 0) return

      const projectId = meta?.id
      const taskId = projectId ? createVideoTaskId() : null
      const batchStartMessage = `批量生视频 0/${targets.length}`

      const targetIds = targets.map((item) => item.id)
      videoGenerationCancelledRef.current = false
      activeVideoTaskIdRef.current = taskId
      setBatchVideoTargetIds(targetIds)
      setBatchVideoGenerating(true)
      setPreviewMode('video')
      setVideoTaskMessage(batchStartMessage)
      setVideoProgressPercent(undefined)
      videoOperationBusyRef.current = true
      markBatchVideoTargets(targetIds)
      for (const target of targets) {
        clearWorkflowVideoGenerationCancelled(target.id)
        patchShotById(target.id, { videoStatus: 'generating' })
      }

      const executeBatch = async () => {
        let taskStartedAt = 0
        if (projectId && taskId) {
          taskStartedAt = await startVideoGenerationTask(projectId, taskId, {
            episode: selectedEpisode,
            progressMessage: batchStartMessage,
          })
        }

        let success = 0
        let failed = 0
        const successShots: WorkflowShot[] = []
        const failedShots: WorkflowShot[] = []
        const limit = VIDEO_BATCH_CONCURRENCY
        let cursor = 0
        const { mentionCandidates, characters, scenes, props } = shotVideoMediaContext

        const runOne = async (shot: WorkflowShot) => {
          if (videoGenerationCancelledRef.current) return
          const shotId = shot.id
          const shotTaskId = projectId ? createVideoTaskId() : null
          const skipImageValidation = !isStoryboardImageValidated(shot)

          const executeShot = async () => {
            let shotTaskStartedAt = 0
            if (projectId && shotTaskId) {
              shotTaskStartedAt = await startVideoGenerationTask(projectId, shotTaskId, {
                episode: selectedEpisode,
                progressMessage: `镜号 ${shot.shotNumber}：生视频中…`,
                shotId,
              })
            }
            const controller = new AbortController()
            bindWorkflowVideoGenerationAbort(shotId, controller)
            try {
              const videoPath = await generateShotVideo(shot, {
                settings,
                projectId: meta?.id,
                appDataDir,
                videoModelId: videoModelId || undefined,
                referenceMode: params.referenceMode,
                episodeShots,
                mentionCandidates,
                characters,
                scenes,
                props,
                voiceLibrary,
                durationSec: params.durationSec,
                resolution: params.resolution,
                aspectRatio: params.aspectRatio,
                promptPrefix,
                promptSuffix,
                skipImageValidation,
                abortSignal: controller.signal,
                onWeishiPersist: async (patches) => {
                  const validationPatch = skipImageValidation ? buildShotImageValidationPatch(shot) : {}
                  await applyWeishiPersistPatches(shotId, {
                    shotPatch: { ...patches.shotPatch, ...validationPatch },
                    dataPatch: patches.dataPatch,
                  })
                },
                onRemoteJobCreated: async (job) => {
                  if (!projectId || !shotTaskId) return
                  await persistVideoTaskRemoteJob(
                    projectId,
                    shotTaskId,
                    buildPersistedRemoteJob(job),
                    {
                      shotId,
                      progressMessage: `镜号 ${shot.shotNumber}：生视频中…`,
                    },
                  )
                },
                onProgress: (update) => {
                  const progressMessage = `镜号 ${shot.shotNumber}：${update.message}`
                  setVideoTaskMessage(progressMessage)
                  setVideoProgressPercent(update.progress)
                  if (projectId && shotTaskId && shotTaskStartedAt) {
                    void updateVideoGenerationTask(
                      projectId,
                      shotTaskId,
                      progressMessage,
                      shotTaskStartedAt,
                      selectedEpisode,
                    )
                  }
                  if (projectId && taskId && taskStartedAt) {
                    void updateVideoGenerationTask(
                      projectId,
                      taskId,
                      `批量生视频 ${success + failed}/${targets.length} · ${progressMessage}`,
                      taskStartedAt,
                      selectedEpisode,
                    )
                  }
                },
              })
              if (isVideoGenerationStopped(shotId)) {
                return
              }
              patchShotById(shotId, appendShotGeneratedVideo(getShotById(shotId) ?? shot, videoPath))
              if (selectedShotId === shotId) {
                const previewUrl = await getCachedVideoPreviewSrc(videoPath, projectRoot)
                setCenterVideoPreviewUrl(previewUrl)
                setPreviewMode('video')
              }
              success += 1
              successShots.push(shot)
              if (projectId && shotTaskId && shotTaskStartedAt) {
                await finishVideoGenerationTask(
                  projectId,
                  shotTaskId,
                  {
                    status: 'completed',
                    progressMessage: formatShotVideoGeneratedToast(shot),
                  },
                  shotTaskStartedAt,
                  selectedEpisode,
                )
              }
            } catch (error: unknown) {
              if (isVideoGenerationStopped(shotId, error)) {
                return
              }
              const errorMessage = formatUserFacingBillingError(error, '生视频失败')
              patchShotById(shotId, { videoStatus: 'failed' })
              failed += 1
              failedShots.push(shot)
              if (projectId && shotTaskId && shotTaskStartedAt) {
                await finishVideoGenerationTask(
                  projectId,
                  shotTaskId,
                  {
                    status: 'failed',
                    progressMessage: formatShotVideoFailedToast(shot, errorMessage),
                    errorMessage,
                  },
                  shotTaskStartedAt,
                  selectedEpisode,
                )
              }
              toast.error(formatShotVideoFailedToast(shot, errorMessage))
            } finally {
              unbindWorkflowVideoGenerationAbort(shotId, controller)
              clearWorkflowVideoGenerationCancelled(shotId)
              unmarkVideoGenerating(shotId)
              releaseBatchVideoTarget(shotId)
              const done = success + failed
              const batchProgress = `批量生视频 ${done}/${targets.length}（成功 ${success}，失败 ${failed}）`
              setVideoTaskMessage(batchProgress)
              if (projectId && taskId && taskStartedAt) {
                void updateVideoGenerationTask(
                  projectId,
                  taskId,
                  batchProgress,
                  taskStartedAt,
                  selectedEpisode,
                )
              }
            }
          }

          if (projectId && shotTaskId) {
            const shotPromise = executeShot()
            registerInflightVideoGeneration(projectId, shotTaskId, shotPromise, {
              isBatch: false,
              generatingShotId: shotId,
            })
            await shotPromise
          } else {
            await executeShot()
          }
        }

        const workers = Array.from({ length: Math.min(limit, targets.length) }, async () => {
          while (cursor < targets.length) {
            if (videoGenerationCancelledRef.current) break
            const index = cursor
            cursor += 1
            await runOne(targets[index])
          }
        })

      try {
        await Promise.all(workers)
        if (videoGenerationCancelledRef.current) return
        if (projectId && taskId && taskStartedAt) {
          const batchSummary = formatBatchShotVideoToast(successShots, failedShots)
          await finishVideoGenerationTask(
            projectId,
            taskId,
            failed === 0
              ? {
                  status: 'completed',
                  progressMessage: batchSummary,
                }
              : {
                  status: 'failed',
                  progressMessage: batchSummary,
                  errorMessage: failed > 0 ? `${failed} 个分镜生视频失败` : undefined,
                },
            taskStartedAt,
            selectedEpisode,
          )
        }
        const batchToast = formatBatchShotVideoToast(successShots, failedShots)
        if (failed === 0) toast.success(batchToast)
        else if (success > 0) toast.message(batchToast)
        else toast.error(batchToast)
        await save({ silent: true })
      } finally {
        activeVideoTaskIdRef.current = null
        setBatchVideoTargetIds([])
        setBatchVideoGenerating(false)
        if (projectId) {
          syncVideoGeneratingIdsFromInflight(projectId)
        } else {
          setVideoGeneratingIds([])
        }
        if (!projectId || !isVideoGenerationInflight(projectId)) {
          setVideoTaskMessage('')
          setVideoProgressPercent(undefined)
          videoOperationBusyRef.current = false
        }
      }
      }

      if (projectId && taskId) {
        const promise = executeBatch()
        registerInflightVideoGeneration(projectId, taskId, promise, { isBatch: true })
        await promise
      } else {
        await executeBatch()
      }
    },
    [appDataDir, applyWeishiPersistPatches, episodeShots, markBatchVideoTargets, meta?.id, patchShotById, projectRoot, promptPrefix, promptSuffix, releaseBatchVideoTarget, save, selectedEpisode, selectedShotId, settings, shotVideoMediaContext, unmarkVideoGenerating, videoModelId, voiceLibrary],
  )

  const buildStoryboardVideoParams = useCallback((): StoryboardVideoGenerateParams => {
    const model = resolveActiveVideoModel()
    const prefs = resolveStoryboardVideoGeneratePrefs(settings, model)
    return {
      referenceMode: clampVideoReferenceMode(prefs.referenceMode, model),
      durationSec: Number(prefs.duration) || 5,
      resolution: prefs.resolution,
      aspectRatio: prefs.aspectRatio,
    }
  }, [resolveActiveVideoModel, settings])

  const handleBatchGenerateVideos = useCallback(() => {
    if (!settings || episodeShots.length === 0) return
    if (batchVideoGenerating || weishiPreviewPreparing) {
      toast.info('视频任务进行中，请稍候')
      return
    }
    if (pendingWeishiVideo) {
      toast.info('请先确认或取消当前视频生成弹窗')
      return
    }
    const params = buildStoryboardVideoParams()
    const unsupportedMsg = getUnsupportedVideoReferenceModeMessage(
      params.referenceMode,
      resolveActiveVideoModel(),
    )
    if (unsupportedMsg) {
      toast.warning(unsupportedMsg)
      return
    }
    const targets = episodeShots.filter((s) => s.prompt.trim() && !hasShotVideo(s))
    if (targets.length === 0) {
      toast.error('没有符合条件的分镜可生成视频')
      return
    }
    const firstTarget = targets[0]!
    void beginWeishiVideoConfirm(params, firstTarget, {
      batchTargets: targets,
      skipImageValidation: !isStoryboardImageValidated(firstTarget),
    }).then((result) => {
      if (result === 'direct') void runBatchGenerateVideos(params, targets)
    })
  }, [
    beginWeishiVideoConfirm,
    batchVideoGenerating,
    buildStoryboardVideoParams,
    episodeShots,
    pendingWeishiVideo,
    resolveActiveVideoModel,
    runBatchGenerateVideos,
    settings,
    weishiPreviewPreparing,
  ])

  const batchVideoTargetCount = useMemo(
    () => episodeShots.filter((s) => s.prompt.trim() && !hasShotVideo(s)).length,
    [episodeShots],
  )

  const requestBatchGenerateVideos = useCallback(() => {
    if (!settings || episodeShots.length === 0) return
    if (batchVideoGenerating || weishiPreviewPreparing) {
      toast.info('视频任务进行中，请稍候')
      return
    }
    if (pendingWeishiVideo) {
      toast.info('请先确认或取消当前视频生成弹窗')
      return
    }
    const params = buildStoryboardVideoParams()
    const unsupportedMsg = getUnsupportedVideoReferenceModeMessage(
      params.referenceMode,
      resolveActiveVideoModel(),
    )
    if (unsupportedMsg) {
      toast.warning(unsupportedMsg)
      return
    }
    if (batchVideoTargetCount === 0) {
      toast.error('没有符合条件的分镜可生成视频')
      return
    }
    setBatchVideoConfirmOpen(true)
  }, [
    batchVideoGenerating,
    batchVideoTargetCount,
    buildStoryboardVideoParams,
    episodeShots.length,
    pendingWeishiVideo,
    resolveActiveVideoModel,
    settings,
    weishiPreviewPreparing,
  ])

  const batchVideoConfirmParams = useMemo(() => {
    if (!batchVideoConfirmOpen) return null
    return buildStoryboardVideoParams()
  }, [batchVideoConfirmOpen, buildStoryboardVideoParams])

  const handleBatchGenerateVideosConfirm = useCallback(() => {
    setBatchVideoConfirmOpen(false)
    handleBatchGenerateVideos()
  }, [handleBatchGenerateVideos])

  const handleClearVideos = useCallback(async () => {
    if (!selectedShot) return
    const ok = await ask({
      title: '清空生成视频',
      description: '确定清空当前分镜的全部生成视频吗？',
      confirmLabel: '清空',
      variant: 'destructive',
    })
    if (!ok) return
    patchSelectedShot({
      ...buildVideoFieldsFromPaths([], 0),
      videoStatus: 'draft',
      videoValidated: false,
    })
    setCenterVideoPreviewUrl(null)
  }, [ask, patchSelectedShot, selectedShot])

  const handleSetPrimaryVideo = useCallback(
    (index: number) => {
      if (!selectedShot) return
      const paths = selectedShot.generatedVideoPaths ?? (selectedShot.generatedVideoPath ? [selectedShot.generatedVideoPath] : [])
      if (!paths.length) return
      patchSelectedShot({
        ...buildVideoFieldsFromPaths(paths, index),
      })
      void getCachedVideoPreviewSrc(paths[index], projectRoot).then((url) => {
        setCenterVideoPreviewUrl(url)
        setPreviewMode('video')
      })
    },
    [patchSelectedShot, projectRoot, selectedShot],
  )

  const handleOpenVideoFolder = useCallback(async () => {
    if (!settings || !meta?.id) {
      toast.error('请先保存项目后再打开文件夹')
      return
    }
    const videoDir = resolveProjectMediaDir(settings, appDataDir, meta.id, 'video')
    const result = await revealPathInExplorer(videoDir, { revealFile: false })
    if (!result.success) {
      toast.error(result.error || '无法打开文件夹')
    }
  }, [appDataDir, meta?.id, settings])

  const handleOpenExtractAudio = useCallback(() => {
    if (!meta?.id) {
      toast.error('请先保存项目后再提取音频')
      return
    }
    if (!extractAudioAvailability.available) return
    setExtractAudioDialogOpen(true)
  }, [extractAudioAvailability.available, meta?.id])

  /** 右下角「打开文件夹」：优先定位当前分镜视频/分镜图，否则打开项目根目录 */
  const handleOpenProjectFolder = useCallback(async () => {
    if (!settings || !meta?.id) {
      toast.error('请先保存项目后再打开文件夹')
      return
    }
    const root = resolveProjectRoot(settings, appDataDir, meta.id)

    const resolveRevealTarget = (storedPath?: string | null) => {
      const trimmed = String(storedPath || '').trim()
      if (!trimmed || trimmed.startsWith('preview:') || isRemoteMediaReference(trimmed)) {
        return null
      }
      const absolutePath = resolveProjectMediaPath(trimmed, root)
      if (!absolutePath || isRemoteMediaReference(absolutePath)) return null
      return { absolutePath, revealFile: true as const }
    }

    let target =
      (selectedShot ? resolveRevealTarget(getShotPreviewVideoPath(selectedShot)) : null) ??
      (selectedShot ? resolveRevealTarget(getShotPreviewPath(selectedShot)) : null) ?? {
        absolutePath: root,
        revealFile: false as const,
      }

    const result = await revealPathInExplorer(target.absolutePath, { revealFile: target.revealFile })
    if (!result.success) {
      toast.error(result.error || '无法打开文件夹')
    }
  }, [appDataDir, meta?.id, selectedShot, settings])


  const handleAddShot = () => {
    if (!selectedEpisode) return
    const next = appendShot(allShots, selectedEpisode)
    patchShots(next)
    const added = getShotsForEpisode(next, selectedEpisode.id).at(-1)
    if (added) setSelectedShotId(added.id)
  }

  const handleInsertAfter = useCallback(
    (afterShotId: string | null) => {
      if (!selectedEpisode) return
      const next = insertShotAfter(allShots, selectedEpisode, afterShotId)
      patchShots(next)
      const episodeList = getShotsForEpisode(next, selectedEpisode.id)
      const idx = afterShotId ? episodeList.findIndex((s) => s.id === afterShotId) : -1
      const inserted = episodeList[idx >= 0 ? idx + 1 : 0]
      if (inserted) setSelectedShotId(inserted.id)
    },
    [allShots, patchShots, selectedEpisode],
  )

  const handleValidateShot = useCallback(
    async (shotId: string) => {
      const shot = allShots.find((s) => s.id === shotId)
      if (!shot) return
      if (isStoryboardImageValidated(shot)) {
        toast.message('当前分镜图已审核通过')
        return
      }

      const videoModel = resolveActiveVideoModel()
      if (!videoModel || !isWeishiApiModel(videoModel)) {
        toast.error('非微视API视频模型暂不支持审核')
        return
      }

      setValidatingShotId(shotId)
      try {
        const patch = await syncShotStoryboardToWeishiReview(shot, videoModel, {
          projectRoot,
          apiBaseUrl: settings?.apiBaseUrl,
        })
        patchShotById(shotId, patch)
        await save({ silent: true })
        toast.success('分镜图已审核，微视开白已写入参考图')
      } catch (error) {
        toast.error((error as Error).message || '分镜图审核失败')
      } finally {
        setValidatingShotId(null)
      }
    },
    [allShots, patchShotById, projectRoot, resolveActiveVideoModel, save, settings?.apiBaseUrl],
  )

  const handleClearShots = async () => {
    if (!selectedEpisode || episodeShots.length === 0) return
    const ok = await ask({
      title: '清空分镜',
      description: '确定清空本集全部分镜吗？删除后不可恢复。',
      confirmLabel: '清空',
      variant: 'destructive',
    })
    if (!ok) return
    patchShots(allShots.filter((s) => s.episodeId !== selectedEpisode.id))
    setSelectedShotId(null)
  }

  const handleUploadShotReference = useCallback(
    async (shotId: string) => {
      if (!settings || !meta?.id) {
        toast.error('请先保存项目后再上传参考图')
        return
      }
      const targetShot = allShots.find((s) => s.id === shotId)
      if (!targetShot) return

      const refCount = getReferenceImagePaths(targetShot).length
      if (refCount >= MAX_REFERENCE_IMAGES) {
        toast.message(`参考图最多 ${MAX_REFERENCE_IMAGES} 张`)
        return
      }

      const picked = await selectReferenceImage()
      if (picked.canceled) return
      if (!picked.success || !picked.filePath) {
        toast.error(picked.error || '选择图片失败')
        return
      }

      try {
        const imagePath = await saveShotReferenceImageFromFile(picked.filePath, {
          settings,
          appDataDir,
          projectId: meta.id,
          shotId,
        })
        patchShotMediaWithPrune(shotId, appendShotReferenceImage(targetShot, imagePath))
        await save({ silent: true })
        toast.success('参考图已上传并保存')
      } catch (error: unknown) {
        toast.error(`上传参考图失败: ${(error as Error).message || '未知错误'}`)
      }
    },
    [allShots, appDataDir, meta?.id, patchShotMediaWithPrune, save, settings],
  )

  const materialReferencePickerShot = useMemo(
    () => (materialReferencePickerShotId ? allShots.find((s) => s.id === materialReferencePickerShotId) : undefined),
    [allShots, materialReferencePickerShotId],
  )

  const materialReferenceRemainingSlots = useMemo(() => {
    if (!materialReferencePickerShot) return MAX_REFERENCE_IMAGES
    return Math.max(0, MAX_REFERENCE_IMAGES - getReferenceImagePaths(materialReferencePickerShot).length)
  }, [materialReferencePickerShot])

  const handlePickShotReferenceFromLibrary = useCallback(
    (shotId: string) => {
      if (!settings || !meta?.id) {
        toast.error('请先保存项目', {
          description: '需先有可写入的项目目录，才能从素材库复制参考图。请点击保存后再试。',
        })
        return
      }
      const targetShot = allShots.find((s) => s.id === shotId)
      if (!targetShot) return
      const refCount = getReferenceImagePaths(targetShot).length
      if (refCount >= MAX_REFERENCE_IMAGES) {
        toast.message(`参考图已满（最多 ${MAX_REFERENCE_IMAGES} 张）`, {
          description: '请先删除部分参考图，再从素材库添加。',
        })
        return
      }
      setMaterialReferencePickerShotId(shotId)
    },
    [allShots, meta?.id, settings],
  )

  const handleMaterialReferenceConfirm = useCallback(
    async (items: MaterialLibraryItem[]) => {
      const shotId = materialReferencePickerShotId
      if (!shotId || !settings || !meta?.id || !items.length) return

      let currentShot = allShots.find((s) => s.id === shotId)
      if (!currentShot) return

      try {
        let added = 0
        for (const item of items) {
          if (getReferenceImagePaths(currentShot).length >= MAX_REFERENCE_IMAGES) {
            if (added === 0) {
              toast.message(`参考图已满（最多 ${MAX_REFERENCE_IMAGES} 张）`, {
                description: '请先删除部分参考图，再从素材库添加。',
              })
            }
            break
          }
          const imagePath = await saveShotReferenceFromMaterialItem({
            item,
            settings,
            appDataDir,
            projectId: meta.id,
            shotId,
          })
          const patch = appendShotReferenceImage(currentShot, imagePath)
          currentShot = { ...currentShot, ...patch }
          patchShotMediaWithPrune(shotId, patch)
          added += 1
        }
        if (added > 0) {
          await save({ silent: true })
          toast.success(added === 1 ? '参考图已从素材库添加' : `已从素材库添加 ${added} 张参考图`)
        }
      } catch (error: unknown) {
        toast.error((error as Error).message || '从素材库添加参考图失败')
        throw error
      }
    },
    [
      allShots,
      appDataDir,
      materialReferencePickerShotId,
      meta?.id,
      patchShotMediaWithPrune,
      save,
      settings,
    ],
  )

  const handleUploadShotReferenceAudio = useCallback(
    async (shotId: string) => {
      if (!settings || !meta?.id) {
        toast.error('请先保存项目后再上传音色')
        return
      }
      const targetShot = allShots.find((s) => s.id === shotId)
      if (!targetShot) return

      if (getReferenceAudioPaths(targetShot).length >= MAX_REFERENCE_AUDIOS) {
        toast.message(`参考音色最多 ${MAX_REFERENCE_AUDIOS} 个`)
        return
      }

      let sourcePath: string | null = null
      try {
        sourcePath = await selectVoiceReferenceAudio()
      } catch (error: unknown) {
        toast.error((error as Error).message || '选择音频失败')
        return
      }
      if (!sourcePath) return

      const voiceName =
        stripReferenceAudioExtension(
          sourcePath.replace(/\\/g, '/').split('/').pop() || '',
        ) || formatReferenceAudioDisplayName(sourcePath, getReferenceAudioPaths(targetShot).length)

      const toastId = toast.loading('正在保存音色...')
      try {
        const audioPath = await saveShotReferenceAudio(sourcePath, {
          settings,
          appDataDir,
          projectId: meta.id,
          shotId,
        })
        patchShotById(shotId, appendShotReferenceAudio(targetShot, audioPath, voiceName))
        await save({ silent: true })
        toast.success('音色已保存到项目，可在提示词中 @ 引用', { id: toastId })
      } catch (error: unknown) {
        toast.error(`保存音色失败: ${(error as Error).message || '未知错误'}`, { id: toastId })
      }
    },
    [allShots, appDataDir, meta?.id, patchShotById, save, settings],
  )

  const handleScreenshotToReference = useCallback(
    async (targetShotId: string, dataUrl: string) => {
      if (!settings || !meta?.id) {
        toast.error('请先保存项目后再使用截图')
        return
      }
      const targetShot = allShots.find((s) => s.id === targetShotId)
      if (!targetShot) return

      const refCount = targetShot.referenceImagePaths?.length ?? (targetShot.referenceImagePath ? 1 : 0)
      if (refCount >= MAX_REFERENCE_IMAGES) {
        toast.message(`参考图最多 ${MAX_REFERENCE_IMAGES} 张`)
        return
      }

      try {
        const imagePath = await saveShotScreenshotReference(dataUrl, {
          settings,
          appDataDir,
          projectId: meta.id,
          shotId: targetShotId,
        })
        patchShotMediaWithPrune(targetShotId, appendShotReferenceImage(targetShot, imagePath))
        await save({ silent: true })
        const isCurrent = targetShotId === selectedShotId
        toast.success(`截图已添加到${isCurrent ? '当前' : '下一'}分镜参考图`)
      } catch (error: unknown) {
        toast.error(`截图失败: ${(error as Error).message || '未知错误'}`)
      }
    },
    [allShots, appDataDir, meta?.id, patchShotMediaWithPrune, save, selectedShotId, settings],
  )

  const handleDeleteShot = useCallback(
    (shotId: string) => {
      setPendingDeleteShotId(shotId)
    },
    [],
  )

  const handleConfirmDeleteShot = useCallback(() => {
    if (!pendingDeleteShotId) return
    const shotId = pendingDeleteShotId
    patchShots(removeShotFromList(allShots, shotId))
    if (selectedShotId === shotId) setSelectedShotId(null)
    setPendingDeleteShotId(null)
  }, [allShots, patchShots, pendingDeleteShotId, selectedShotId])

  const handleGenerateShot = useCallback(
    (shotId: string) => {
      const shot = allShots.find((s) => s.id === shotId)
      if (!shot) return
      setSelectedShotId(shotId)
      void handleGenerateOne(storyboardImageApiSize, shot)
    },
    [allShots, handleGenerateOne, storyboardImageApiSize],
  )

  const handleGenerateVideoShot = useCallback(
    (shotId: string) => {
      const shot = allShots.find((s) => s.id === shotId)
      if (!shot || !settings) return
      setSelectedShotId(shotId)
      requestGenerateVideoOne(buildStoryboardVideoParams(), shot)
    },
    [allShots, buildStoryboardVideoParams, requestGenerateVideoOne, settings],
  )

  const notifyStub = (label: string) => toast.message(`${label}功能开发中`)
  const stubAction = (label: string) => () => notifyStub(label)

  const handleExportToCapcut = useCallback(async () => {
    const projectId = meta?.id
    if (!projectId || !selectedEpisode) {
      toast.error('请先打开创作工坊项目并选择分集')
      return
    }
    if (!settings) {
      toast.error('设置未加载，请稍后重试')
      return
    }
    setExportingToCapcut(true)
    try {
      await exportWorkflowEpisodeToCapcut({
        shots: episodeShots,
        settings,
        appDataDir,
        projectId,
        projectTitle: meta?.title,
        episode: selectedEpisode,
      })
    } finally {
      setExportingToCapcut(false)
    }
  }, [appDataDir, episodeShots, meta?.id, meta?.title, selectedEpisode, settings])

  if (!data) return null

  const busy = inferring || batchVideoGenerating || storyboardValidating
  const generating = Boolean(selectedShotId && isShotImageBusy(selectedShotId))
  const videoGenerating = Boolean(
    selectedShotId &&
      (isShotVideoBusy(selectedShotId) ||
        (weishiPreviewPreparing && pendingWeishiVideo?.shot.id === selectedShotId)),
  )

  return (
    <div className="flex flex-col h-full min-h-0 gap-2">
      <div className="flex flex-1 min-h-0 gap-2">
        <StoryboardLeftPanel
          data={data}
          episodes={episodes}
          projectId={meta?.id}
          selectedEpisodeId={activeEpisodeId}
          selectedShotId={selectedShotId}
          shots={episodeShots}
          previewMap={previewMap}
          generatingId={generatingId}
          isShotImageBusy={isShotImageBusy}
          validatingShotId={validatingShotId}
          isShotVideoBusy={isShotVideoBusy}
          inferring={inferring}
          storyboardValidating={storyboardValidating}
          storyboardValidatePending={Boolean(pendingValidate)}
          busy={busy}
          projectRoot={projectRoot}
          voiceLibrary={voiceLibrary}
          onEpisodeChange={(id) => {
            setActiveEpisodeId(id)
            setSelectedShotId(null)
          }}
          onEpisodeContentChange={handleEpisodeContentChange}
          onSelectShot={setSelectedShotId}
          onShotChange={handleShotChange}
          onUploadShotReference={(shotId) => void handleUploadShotReference(shotId)}
          onPickShotReferenceFromLibrary={(shotId) => handlePickShotReferenceFromLibrary(shotId)}
          onUploadShotReferenceAudio={(shotId) => void handleUploadShotReferenceAudio(shotId)}
          onGenerateShot={handleGenerateShot}
          onStopGenerateShot={handleStopShotGeneration}
          onStopGenerateVideoShot={handleStopGenerateVideoShot}
          onDeleteShot={handleDeleteShot}
          onValidateShot={handleValidateShot}
          onGenerateVideoShot={handleGenerateVideoShot}
          onInsertAfter={handleInsertAfter}
          onInfer={() => void handleInfer()}
          onValidateStoryboard={handleValidateStoryboard}
          onAdd={handleAddShot}
          onClear={handleClearShots}
        />

        <StoryboardCenterPanel
          meta={meta}
          episode={selectedEpisode}
          shot={selectedShot}
          shots={episodeShots}
          selectedShotId={selectedShotId}
          previewMap={previewMap}
          previewUrl={centerPreviewUrl}
          videoPreviewUrl={centerVideoPreviewUrl}
          previewMode={previewMode}
          aspectMode={previewAspect}
          generating={generating}
          videoGenerating={videoGenerating}
          videoProgressMessage={centerVideoProgressMessage}
          videoProgressPercent={centerVideoProgressPercent}
          projectRoot={projectRoot}
          onPreviewModeChange={handlePreviewModeChange}
          onAspectModeChange={handlePreviewAspectChange}
          onSelectShot={setSelectedShotId}
          onScreenshotToReference={handleScreenshotToReference}
        />

        <StoryboardRightPanel
          key={`step4-right-${meta?.id ?? 'none'}-s${rightPanelSession}`}
          shot={selectedShot}
          episodeShotCount={episodeShots.length}
          projectStyle={stylePresetKey}
          storyboardTemplateOptions={storyboardTemplateOptions}
          storyboardTemplateKey={storyboardTemplateKey}
          llmModelOptions={llmModelOptions}
          llmModelId={llmModelId}
          imageModelOptions={imageModelOptions}
          imageModelId={imageModelId}
          videoModelOptions={videoModelOptions}
          videoModels={mergedVideoModels}
          videoModelId={videoModelId}
          projectRoot={projectRoot}
          generating={generating}
          videoGenerating={videoGenerating}
          batchVideoGenerating={batchVideoGenerating || resumableBatchVideo}
          videoPreparing={weishiPreviewPreparing}
          videoProgressMessage={centerVideoProgressMessage}
          videoProgressPercent={centerVideoProgressPercent}
          collapsed={rightCollapsed}
          onCollapse={() => setRightCollapsed((v) => !v)}
          onStoryboardTemplateChange={(key) => {
            if (!key || key === data.storyboardTemplateKey) return
            patchData({ storyboardTemplateKey: key })
            void save({ silent: true })
          }}
          onLlmModelChange={(id) => {
            rememberStoryboardLlmModelId(id)
          }}
          onImageModelChange={(id) => {
            rememberStoryboardImageModelId(id)
          }}
          followingProjectStyle={followingProjectStoryboardStyle}
          projectStyleLabel={`${projectStyleSummary.categoryLabel} · ${projectStyleSummary.presetLabel}`}
          onFollowProjectStyleChange={(following) => {
            if (following) {
              patchData({ storyboardStyleOverrideKey: undefined })
            } else {
              patchData({ storyboardStyleOverrideKey: stylePresetKey })
            }
            void save({ silent: true })
          }}
          onStyleChange={(styleKey) => {
            patchData({ storyboardStyleOverrideKey: styleKey })
            rememberStoryboardStyleKey(styleKey)
            void save({ silent: true })
          }}
          onShotChange={patchSelectedShot}
          onGenerateImage={(size, opts) => void handleGenerateOne(size, selectedShot ?? undefined, opts)}
          onClearGeneratedImages={handleClearGeneratedImages}
          onSetPrimaryImage={handleSetPrimaryImage}
          onVideoModelChange={(id) => {
            rememberStoryboardVideoModelId(id)
          }}
          onGenerateVideo={(params) => requestGenerateVideoOne(params)}
          onClearVideos={handleClearVideos}
          onSetPrimaryVideo={handleSetPrimaryVideo}
          onOpenVideoFolder={handleOpenVideoFolder}
          onExtractAudio={handleOpenExtractAudio}
          extractAudioDisabled={!extractAudioAvailability.available}
          extractAudioTitle={extractAudioTitle}
          onBatchGenerateVideos={requestBatchGenerateVideos}
          affixPresets={affixPresets}
          selectedAffixPresetId={selectedAffixPresetId}
          promptPrefix={promptPrefix}
          promptSuffix={promptSuffix}
          affixPresetDialogOpen={affixPresetDialogOpen}
          onPromptPrefixChange={(value) => persistProjectAffix({ promptPrefix: value })}
          onPromptSuffixChange={(value) => persistProjectAffix({ promptSuffix: value })}
          onSelectAffixPreset={handleSelectAffixPreset}
          onOpenAffixPresetManager={() => setAffixPresetDialogOpen(true)}
          onCloseAffixPresetManager={() => setAffixPresetDialogOpen(false)}
          onSaveAffixPresets={handleSaveAffixPresets}
          projectTasks={displayProjectTasks}
          projectTasksLoading={taskStoreLoading}
          onCancelWorkflowTask={handleCancelWorkflowTask}
          cancellingWorkflowTaskId={cancellingTaskId}
          onDeleteWorkflowTask={handleDeleteWorkflowTask}
          deletingWorkflowTaskId={deletingTaskId}
          onStopGenerateVideo={
            selectedShotId ? () => void handleStopGenerateVideoShot(selectedShotId) : undefined
          }
          onStopGenerateImage={
            selectedShotId ? () => handleStopShotGeneration(selectedShotId) : undefined
          }
        />
      </div>

      <div className="flex shrink-0 items-center justify-end gap-2 py-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          title="导出到剪映草稿"
          className="h-8 text-xs"
          disabled={exportingToCapcut || episodeShots.length === 0}
          onClick={() => void handleExportToCapcut()}
          data-testid="workshop-step4-export-capcut"
        >
          {exportingToCapcut ? '导出中…' : '导出至剪映'}
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8 text-xs" onClick={stubAction('导入')}>
          导入
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 text-xs"
          data-testid="workshop-step4-open-folder"
          onClick={() => void handleOpenProjectFolder()}
        >
          打开文件夹
        </Button>
      </div>

      <WeishiVideoConfirmDialog
        open={Boolean(pendingWeishiVideo)}
        preview={pendingWeishiVideo?.preview ?? null}
        videoModel={activeVideoModel}
        onClose={() => setPendingWeishiVideo(null)}
        onConfirm={handleConfirmWeishiVideo}
      />

      <CanvasVideoExtractAudioDialog
        open={extractAudioDialogOpen}
        onClose={() => setExtractAudioDialogOpen(false)}
        projectId={meta?.id ?? ''}
        projectKind="workflow"
        videoPath={
          selectedShot ? String(getShotPreviewVideoPath(selectedShot) || '').trim() : ''
        }
        videoLabel={selectedShot ? buildWorkflowShotExtractAudioLabel(selectedShot) : undefined}
      />

      <StoryboardValidateConfirmDialog
        open={Boolean(pendingValidate)}
        beforeShots={pendingValidate?.beforeShots ?? []}
        afterShots={pendingValidate?.afterShots ?? []}
        passed={pendingValidate?.passed}
        summary={pendingValidate?.summary}
        issues={pendingValidate?.issues ?? []}
        mode={pendingValidate?.mode}
        onClose={handleDismissValidateStoryboard}
        onConfirm={() => void handleApplyValidateStoryboard()}
      />

      <StoryboardBatchVideoConfirmDialog
        open={batchVideoConfirmOpen}
        targetCount={batchVideoTargetCount}
        videoModel={activeVideoModel}
        durationSec={batchVideoConfirmParams?.durationSec ?? 5}
        resolution={batchVideoConfirmParams?.resolution}
        aspectRatio={batchVideoConfirmParams?.aspectRatio}
        referenceMode={batchVideoConfirmParams?.referenceMode}
        loading={batchVideoGenerating}
        onClose={() => {
          if (batchVideoGenerating) return
          setBatchVideoConfirmOpen(false)
        }}
        onConfirm={handleBatchGenerateVideosConfirm}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteShotId)}
        title="删除分镜"
        description="确定删除此镜头吗？删除后不可恢复。"
        confirmLabel="删除"
        cancelLabel="取消"
        variant="destructive"
        onClose={() => setPendingDeleteShotId(null)}
        onConfirm={handleConfirmDeleteShot}
      />

      {confirmDialog}

      <MaterialLibraryPickerDialog
        open={Boolean(materialReferencePickerShotId)}
        mode="reference"
        defaultKind="character"
        currentProjectId={meta?.id || ''}
        selectionLimit={materialReferenceRemainingSlots || undefined}
        confirmLabel="添加为参考图"
        onClose={() => setMaterialReferencePickerShotId(null)}
        onConfirm={handleMaterialReferenceConfirm}
      />
    </div>
  )
}
