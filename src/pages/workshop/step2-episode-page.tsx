import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { EntityTag } from '@/components/workshop/entity-tag'
import { EpisodeTabs } from '@/components/workshop/episode-tabs'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import {
  applyStep1ScriptToFirstEpisode,
  buildStep1EpisodeSyncPreview,
  collectEpisodeEntities,
  createEmptyEpisode,
  ensureDefaultEpisode,
  ensureEpisodesWithScriptPreview,
  episodePlanAfterStructureEdit,
  episodePlanAfterUserEdit,
  formatEpisodePlanLabel,
  formatStep1EpisodeSyncConfirmDescription,
  formatStep2AiRunningMessage,
  formatStep2AiScriptSourceHint,
  formatEpisodeReextractSourceHint,
  hasWorkflowScriptContent,
  isEpisodeReextractReady,
  removeEpisode,
  reindexEpisodes,
  resolveEpisodeReextractScript,
  resolveStep2AiScript,
  updateEpisode,
} from '@/lib/workflow/episode-utils'
import {
  clearEpisodeSplitSessionTaskId,
  reconcileStaleEpisodeSplitTasks,
  setEpisodeSplitSessionTaskId,
  startEpisodeSplit,
} from '@/lib/workflow/episode-split-service'
import { startAssetExtract, startEpisodeAssetReextract } from '@/lib/workflow/asset-extract-service'
import {
  EXTRACT_POLL_MS,
  clearExtractSessionTaskId,
  getActiveExtractTask,
  getExtractSessionKind,
  reconcileStaleExtractTasks,
  resolveExtractKindFromTask,
  setExtractSessionTaskId,
} from '@/lib/workflow/extract-task-service'
import { needsReplaceAssetsConfirm, REPLACE_ASSETS_CONFIRM, resolveStep2ExtractTemplateKey } from '@/lib/workflow/asset-utils'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { resolveStep2TaskUiState } from '@/lib/workflow/step2-task-sync'
import {
  flushWorkflowSessionBeforeAiTask,
  mergeExtractResultFromDisk,
  reloadWorkflowSessionAfterSplit,
  STEP2_DIRTY_AI_SAVE_CONFIRM,
  STEP2_SYNC_STEP1_SCRIPT_CONFIRM,
} from '@/lib/workflow/step2-ai-session'
import { readWorkflowTasks } from '@/lib/storage/workflow-service'
import { getLlmModelSelectionError } from '@/lib/models/llm-client'
import { resolveSoftwareLlmModelId } from '@/lib/models/software-model-prefs'
import { buildModelSelectOptions } from '@/lib/models/model-select-options'
import { useSettingsStore } from '@/stores/settings-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import { useTaskStore } from '@/stores/task-store'
import { useActiveEpisode } from '@/hooks/use-active-episode'
import { ProjectVisualStyleField } from '@/components/workshop/project-visual-style-field'
import {
  resolveProjectEpisodeStyle,
  resolveProjectStylePresetKey,
} from '@/lib/workflow/project-visual-style'
import type { EpisodeTabKey, WorkflowEpisode, WorkflowEpisodePlan } from '@/types/workflow'
import { cn } from '@/lib/utils'

export function Step2EpisodePage() {
  const projectId = useWorkflowSessionStore((s) => s.projectId)
  const meta = useWorkflowSessionStore((s) => s.meta)
  const data = useWorkflowSessionStore((s) => s.data)
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const dirty = useWorkflowSessionStore((s) => s.dirty)
  const save = useWorkflowSessionStore((s) => s.save)
  const reload = useWorkflowSessionStore((s) => s.reload)

  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.load)
  const getMergedModels = useSettingsStore((s) => s.getMergedModels)
  const systemModelsByKind = useSettingsStore((s) => s.systemModelsByKind)
  const rememberEpisodeLlmModelId = useSettingsStore((s) => s.rememberLastUsedEpisodeLlmModelId)
  const rememberExtractTemplateKey = useSettingsStore((s) => s.rememberLastUsedExtractTemplateKey)

  const { activeEpisodeId, setActiveEpisodeId } = useActiveEpisode()

  const [activeTab, setActiveTab] = useState<EpisodeTabKey>('full')
  const [splitting, setSplitting] = useState(false)
  const [splitPending, setSplitPending] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractPending, setExtractPending] = useState(false)
  /** 区分「一键提取」与「重提本集」，避免共用 loading 文案 */
  const [extractActiveKind, setExtractActiveKind] = useState<
    'replace_all' | 'episode_reextract' | null
  >(null)
  const [replaceAssetsConfirmOpen, setReplaceAssetsConfirmOpen] = useState(false)
  const [replaceAssetsMode, setReplaceAssetsMode] = useState<'split' | 'extract' | null>(null)
  const [dirtySaveConfirmOpen, setDirtySaveConfirmOpen] = useState(false)
  const [pendingAiMode, setPendingAiMode] = useState<'split' | 'extract' | null>(null)
  const [syncStep1ConfirmOpen, setSyncStep1ConfirmOpen] = useState(false)
  const [taskMessage, setTaskMessage] = useState('')
  const initialTabResolved = useRef(false)
  const llmPrefApplied = useRef(false)
  const splitWasActive = useRef(false)
  const extractWasActive = useRef(false)
  const pollEpoch = useRef(0)

  useEffect(() => {
    if (!settings) loadSettings()
  }, [settings, loadSettings])

  const episodes = data?.episodes ?? []
  const scriptReadyForSplit = hasWorkflowScriptContent(data, 'split')
  const scriptReadyForExtract = hasWorkflowScriptContent(data, 'extract')

  const splitScriptResolution = useMemo(
    () => (data ? resolveStep2AiScript(data, 'split') : null),
    [data],
  )
  const extractScriptResolution = useMemo(
    () => (data ? resolveStep2AiScript(data, 'extract') : null),
    [data],
  )

  const splitSourceHint = splitScriptResolution
    ? formatStep2AiScriptSourceHint(splitScriptResolution)
    : ''
  const extractSourceHint = extractScriptResolution
    ? formatStep2AiScriptSourceHint(extractScriptResolution)
    : ''

  const step1SyncPreview = useMemo(() => buildStep1EpisodeSyncPreview(data), [data])

  const splitBusy = splitting || splitPending
  const extractBusy = extracting || extractPending
  const quickExtractBusy = extractBusy && extractActiveKind === 'replace_all'
  const reextractBusy = extractBusy && extractActiveKind === 'episode_reextract'
  const taskBusy = splitBusy || extractBusy

  useEffect(() => {
    initialTabResolved.current = false
    llmPrefApplied.current = false
    splitWasActive.current = false
    extractWasActive.current = false
    setSplitPending(false)
    setExtractPending(false)
    setExtractActiveKind(null)
  }, [projectId])

  const handleEpisodeTabChange = useCallback(
    (tab: EpisodeTabKey) => {
      setActiveTab(tab)
      if (tab !== 'full') setActiveEpisodeId(tab)
    },
    [setActiveEpisodeId],
  )

  // 仅 Step1 全文或分集数量变化时同步占位，避免编辑本集时被全文覆盖
  useEffect(() => {
    if (!data) return

    const nextEpisodes = ensureEpisodesWithScriptPreview(data)
    if (nextEpisodes !== data.episodes) {
      patchData({ episodes: nextEpisodes })
    }
  }, [data?.script, data?.episodes?.length, data, patchData])

  useEffect(() => {
    if (initialTabResolved.current) return
    if (episodes.length === 0) return
    if (activeEpisodeId) {
      setActiveTab(activeEpisodeId)
    } else {
      setActiveTab(episodes[0].id)
      setActiveEpisodeId(episodes[0].id)
    }
    initialTabResolved.current = true
  }, [activeEpisodeId, episodes, setActiveEpisodeId])

  const episodeStyle = resolveProjectEpisodeStyle(data, settings)
  const projectStylePresetKey = resolveProjectStylePresetKey(data, settings)

  const mergedLlmModels = useMemo(
    () => getMergedModels('llm'),
    [getMergedModels, systemModelsByKind, settings?.llmModels],
  )

  const llmOptions = useMemo(
    () => buildModelSelectOptions(mergedLlmModels, 'llm'),
    [mergedLlmModels],
  )

  const extractOptions = useMemo(
    () =>
      (settings?.extractTemplates ?? []).map((t) => ({
        value: t.key,
        label: t.name,
      })),
    [settings?.extractTemplates],
  )

  const activeExtractTemplateKey = useMemo(
    () => resolveStep2ExtractTemplateKey(settings, extractOptions, data?.extractTemplateKey),
    [data?.extractTemplateKey, extractOptions, settings],
  )

  const llmModelId = useMemo(
    () => resolveSoftwareLlmModelId(settings, mergedLlmModels),
    [
      mergedLlmModels,
      settings?.lastUsedEpisodeLlmModelId,
      settings?.lastUsedLlmModelId,
      settings?.lastUsedStoryboardLlmModelId,
      settings?.defaultLlmModelId,
    ],
  )

  useEffect(() => {
    if (!data || !settings || llmPrefApplied.current) return
    if (activeExtractTemplateKey && data.extractTemplateKey !== activeExtractTemplateKey) {
      patchData({ extractTemplateKey: activeExtractTemplateKey })
      void save({ silent: true })
    }
    llmPrefApplied.current = true
  }, [activeExtractTemplateKey, data, patchData, save, settings])

  const handleExtractTemplateChange = (value: string) => {
    void rememberExtractTemplateKey(value)
    patchData({ extractTemplateKey: value })
    void save({ silent: true })
  }

  const handleLlmModelChange = (value: string) => {
    void rememberEpisodeLlmModelId(value)
  }

  const selectedEpisode = useMemo(() => {
    if (activeTab === 'full') return null
    return episodes.find((ep) => ep.id === activeTab) ?? null
  }, [activeTab, episodes])

  const entities = useMemo(() => collectEpisodeEntities(selectedEpisode), [selectedEpisode])

  const episodeReextractReady = useMemo(
    () => isEpisodeReextractReady(selectedEpisode),
    [selectedEpisode],
  )

  const episodeReextractHint = useMemo(
    () => formatEpisodeReextractSourceHint(selectedEpisode),
    [selectedEpisode],
  )

  useEffect(() => {
    if (activeTab !== 'full' && episodes.length > 0 && !episodes.some((ep) => ep.id === activeTab)) {
      const fallback = activeEpisodeId ?? episodes[0]?.id ?? 'full'
      setActiveTab(fallback)
    }
  }, [activeEpisodeId, activeTab, episodes])

  const applySplitResultFromDisk = useCallback(async () => {
    if (!projectId) return
    await reloadWorkflowSessionAfterSplit(projectId)
  }, [projectId])

  const applyExtractResultFromDisk = useCallback(async () => {
    if (!projectId) return
    await mergeExtractResultFromDisk(projectId)
  }, [projectId])

  const pollTasks = useCallback(async () => {
    if (!projectId) return
    const epoch = pollEpoch.current
    try {
      const interruptedExtract = await reconcileStaleExtractTasks(projectId)
      if (epoch !== pollEpoch.current) return
      if (interruptedExtract) {
        extractWasActive.current = false
        setExtractActiveKind(null)
        toast.error(interruptedExtract.errorMessage || '历史提取任务已中断')
        void useTaskStore.getState().refresh()
        return
      }

      const interruptedSplit = await reconcileStaleEpisodeSplitTasks(projectId)
      if (epoch !== pollEpoch.current) return
      if (interruptedSplit) {
        setSplitting(false)
        splitWasActive.current = false
        setTaskMessage('')
        toast.error(interruptedSplit.errorMessage || '分集失败')
        const store = useWorkflowSessionStore.getState()
        if (store.dirty) await store.save({ silent: true })
        await reload()
        return
      }

      const tasks = await readWorkflowTasks(projectId)
      if (epoch !== pollEpoch.current) return

      const ui = resolveStep2TaskUiState(tasks, {
        extractWasActive: extractWasActive.current,
        splitWasActive: splitWasActive.current,
      }, projectId)

      if (ui.extractJustFinished) {
        extractWasActive.current = false
      } else if (ui.extracting) {
        extractWasActive.current = true
      }

      if (ui.splitJustFinished) {
        splitWasActive.current = false
      } else if (ui.splitting) {
        splitWasActive.current = true
      }

      const extractingNow = ui.extracting || extractWasActive.current
      const splittingNow = ui.splitting || splitWasActive.current
      setSplitting(splittingNow)
      setExtracting(extractingNow)

      if (extractingNow) {
        const activeExtract = getActiveExtractTask(tasks, projectId)
        const kind =
          getExtractSessionKind(projectId) ?? resolveExtractKindFromTask(activeExtract)
        if (kind) setExtractActiveKind(kind)
      } else {
        setExtractActiveKind(null)
      }

      setTaskMessage(ui.taskMessage)

      if (ui.extractJustFinished) {
        await applyExtractResultFromDisk()
        void useTaskStore.getState().refresh()
      }

      if (ui.splitJustFinished) {
        await applySplitResultFromDisk()
        const latest = useWorkflowSessionStore.getState().data?.episodes ?? []
        if (latest.length > 0) handleEpisodeTabChange(latest[0].id)
        return
      }

      const store = useWorkflowSessionStore.getState()
      if (!store.dirty && !extractingNow && !splittingNow) await reload()
    } catch {
      if (epoch !== pollEpoch.current) return
      splitWasActive.current = false
      extractWasActive.current = false
      setExtractActiveKind(null)
      setSplitting(false)
      setExtracting(false)
      setTaskMessage('')
    }
  }, [applyExtractResultFromDisk, applySplitResultFromDisk, projectId, reload])

  useEffect(() => {
    if (!projectId) return
    void pollTasks()
    const timer = window.setInterval(() => {
      void pollTasks()
    }, EXTRACT_POLL_MS)
    return () => window.clearInterval(timer)
  }, [projectId, pollTasks])

  const patchEpisodes = useCallback(
    (next: WorkflowEpisode[], episodePlan?: WorkflowEpisodePlan) => {
      if (episodePlan) {
        patchData({ episodes: next, episodePlan })
        return
      }
      patchData({ episodes: next })
    },
    [patchData],
  )

  const patchSelectedEpisode = useCallback(
    (patch: Partial<WorkflowEpisode>) => {
      if (!selectedEpisode || !data) return
      const nextEpisodes = updateEpisode(episodes, selectedEpisode.id, patch)
      const nextPlan = episodePlanAfterUserEdit(data)
      if (nextPlan) {
        patchData({ episodes: nextEpisodes, episodePlan: nextPlan })
      } else {
        patchEpisodes(nextEpisodes)
      }
    },
    [data, episodes, patchData, patchEpisodes, selectedEpisode],
  )

  const runEpisodeSplit = useCallback(async () => {
    if (!projectId || !data || !settings) return
    const resolution = resolveStep2AiScript(data, 'split')
    const script = resolution.script
    if (!script) {
      toast.error('请先录入剧本或本集脚本后再使用 AI 分集')
      return
    }
    const llmError = getLlmModelSelectionError(mergedLlmModels, llmModelId)
    if (llmError) {
      toast.error(llmError)
      return
    }
    if (splitBusy) return

    try {
      await flushWorkflowSessionBeforeAiTask()
    } catch (error: unknown) {
      toast.error((error as Error).message || '保存失败，无法开始分集')
      return
    }

    pollEpoch.current += 1
    setSplitPending(true)
    setSplitting(true)
    setTaskMessage(formatStep2AiRunningMessage(resolution, 'split'))
    splitWasActive.current = true

    const { taskId, promise } = startEpisodeSplit(projectId, {
      script,
      style: episodeStyle,
      extractTemplateKey: activeExtractTemplateKey || undefined,
      settings,
    })
    setEpisodeSplitSessionTaskId(projectId, taskId)

    void rememberEpisodeLlmModelId(llmModelId)

    try {
      await promise
      splitWasActive.current = false
      await applySplitResultFromDisk()
      const projectTitle = meta?.title?.trim() || '当前项目'
      toast.success(`「${projectTitle}」分集完成，资产草稿已同步到资产库`)
      const latest = useWorkflowSessionStore.getState().data?.episodes ?? []
      if (latest.length > 0) handleEpisodeTabChange(latest[0].id)
    } catch (error: unknown) {
      splitWasActive.current = false
      const err = error as Error
      toast.error(err.message || '分集失败')
    } finally {
      pollEpoch.current += 1
      clearEpisodeSplitSessionTaskId(projectId)
      setSplitPending(false)
      setSplitting(false)
      setTaskMessage('')
      await pollTasks()
    }
  }, [
    activeExtractTemplateKey,
    data,
    handleEpisodeTabChange,
    mergedLlmModels,
    meta?.title,
    applySplitResultFromDisk,
    pollTasks,
    projectId,
    rememberEpisodeLlmModelId,
    settings,
    splitBusy,
    episodeStyle,
  ])

  const runAssetExtract = useCallback(async () => {
    if (!projectId || !data || !settings) return
    const resolution = resolveStep2AiScript(data, 'extract')
    const script = resolution.script
    if (!script) {
      toast.error('请先录入剧本或本集脚本后再提取资产')
      return
    }
    const llmError = getLlmModelSelectionError(mergedLlmModels, llmModelId)
    if (llmError) {
      toast.error(llmError)
      return
    }
    if (extractBusy || splitBusy) return

    try {
      await flushWorkflowSessionBeforeAiTask()
    } catch (error: unknown) {
      toast.error((error as Error).message || '保存失败，无法开始提取')
      return
    }

    pollEpoch.current += 1
    setExtractPending(true)
    setExtracting(true)
    setExtractActiveKind('replace_all')
    setTaskMessage(formatStep2AiRunningMessage(resolution, 'extract'))
    extractWasActive.current = true

    const { taskId, promise } = startAssetExtract(projectId, {
      script,
      extractTemplateKey: activeExtractTemplateKey || undefined,
      descriptionStyle: episodeStyle,
      settings,
      llmModelId,
    })
    setExtractSessionTaskId(projectId, taskId, 'replace_all')

    void rememberEpisodeLlmModelId(llmModelId)

    try {
      await promise
      extractWasActive.current = false
      await applyExtractResultFromDisk()
      const projectTitle = meta?.title?.trim() || '当前项目'
      toast.success(`「${projectTitle}」资产已提取并同步到资产库`)
    } catch (error: unknown) {
      extractWasActive.current = false
      const err = error as Error
      toast.error(err.message || '资产提取失败')
    } finally {
      pollEpoch.current += 1
      clearExtractSessionTaskId(projectId)
      setExtractPending(false)
      setExtracting(false)
      setExtractActiveKind(null)
      setTaskMessage('')
      await pollTasks()
    }
  }, [
    activeExtractTemplateKey,
    data,
    episodes.length,
    extractBusy,
    llmModelId,
    mergedLlmModels,
    meta?.title,
    applyExtractResultFromDisk,
    pollTasks,
    projectId,
    rememberEpisodeLlmModelId,
    settings,
    splitBusy,
    episodeStyle,
  ])

  const runEpisodeReextract = useCallback(
    async (episodeId: string) => {
      if (!projectId || !settings) return

      const store = useWorkflowSessionStore.getState()
      const latestData = store.data
      if (!latestData) return

      const episode = (latestData.episodes ?? []).find((ep) => ep.id === episodeId)
      if (!episode) {
        toast.error('分集不存在，无法重提本集资产')
        return
      }

      const resolution = resolveEpisodeReextractScript(episode)
      if (!resolution) {
        toast.error('请先录入本集脚本后再重提本集资产')
        return
      }

      const llmError = getLlmModelSelectionError(mergedLlmModels, llmModelId)
      if (llmError) {
        toast.error(llmError)
        return
      }
      if (extractBusy || splitBusy) return

      try {
        await flushWorkflowSessionBeforeAiTask()
      } catch (error: unknown) {
        toast.error((error as Error).message || '保存失败，无法开始重提')
        return
      }

      const episodeAfterFlush =
        useWorkflowSessionStore.getState().data?.episodes?.find((ep) => ep.id === episodeId) ??
        episode
      const resolutionAfterFlush = resolveEpisodeReextractScript(episodeAfterFlush)
      if (!resolutionAfterFlush) {
        toast.error('请先录入本集脚本后再重提本集资产')
        return
      }

      pollEpoch.current += 1
      setExtractPending(true)
      setExtracting(true)
      setExtractActiveKind('episode_reextract')
      setTaskMessage(formatStep2AiRunningMessage(resolutionAfterFlush, 'episode_reextract'))
      extractWasActive.current = true

      const { taskId, promise } = startEpisodeAssetReextract(projectId, {
        episode: episodeAfterFlush,
        extractTemplateKey: activeExtractTemplateKey || undefined,
        descriptionStyle: episodeStyle,
        settings,
        llmModelId,
      })
      setExtractSessionTaskId(projectId, taskId, 'episode_reextract')

      void rememberEpisodeLlmModelId(llmModelId)

      try {
        await promise
        extractWasActive.current = false
        await applyExtractResultFromDisk()
        const projectTitle = meta?.title?.trim() || '当前项目'
        toast.success(
          `「${projectTitle}」第 ${episodeAfterFlush.episodeIndex} 集资产已重提并同步到资产库`,
        )
      } catch (error: unknown) {
        extractWasActive.current = false
        const err = error as Error
        toast.error(err.message || '重提本集资产失败')
      } finally {
        pollEpoch.current += 1
        clearExtractSessionTaskId(projectId)
        setExtractPending(false)
        setExtracting(false)
        setExtractActiveKind(null)
        setTaskMessage('')
        await pollTasks()
      }
    },
    [
      activeExtractTemplateKey,
      applyExtractResultFromDisk,
      extractBusy,
      llmModelId,
      mergedLlmModels,
      meta?.title,
      pollTasks,
      projectId,
      rememberEpisodeLlmModelId,
      settings,
      splitBusy,
      episodeStyle,
    ],
  )

  /** 点击即执行；启动前由 runEpisodeReextract 静默落盘 */
  const handleEpisodeReextractRequest = useCallback(
    (episodeId: string) => {
      const store = useWorkflowSessionStore.getState()
      const episode = store.data?.episodes?.find((ep) => ep.id === episodeId)
      if (!episode || !isEpisodeReextractReady(episode)) {
        toast.error('请先录入本集脚本后再重提本集资产')
        return
      }
      if (extractBusy || splitBusy) return
      void runEpisodeReextract(episodeId)
    },
    [extractBusy, runEpisodeReextract, splitBusy],
  )

  const handleSplit = useCallback(() => {
    if (!data) return
    if (dirty) {
      setPendingAiMode('split')
      setDirtySaveConfirmOpen(true)
      return
    }
    if (needsReplaceAssetsConfirm(data)) {
      setReplaceAssetsMode('split')
      setReplaceAssetsConfirmOpen(true)
      return
    }
    void runEpisodeSplit()
  }, [data, dirty, runEpisodeSplit])

  const handleQuickExtract = useCallback(() => {
    if (!data) return
    if (dirty) {
      setPendingAiMode('extract')
      setDirtySaveConfirmOpen(true)
      return
    }
    if (needsReplaceAssetsConfirm(data)) {
      setReplaceAssetsMode('extract')
      setReplaceAssetsConfirmOpen(true)
      return
    }
    void runAssetExtract()
  }, [data, dirty, runAssetExtract])

  const proceedPendingAiAction = useCallback(() => {
    if (!data || !pendingAiMode) return
    const mode = pendingAiMode
    setPendingAiMode(null)
    if (needsReplaceAssetsConfirm(data)) {
      setReplaceAssetsMode(mode)
      setReplaceAssetsConfirmOpen(true)
      return
    }
    if (mode === 'extract') void runAssetExtract()
    else void runEpisodeSplit()
  }, [data, pendingAiMode, runAssetExtract, runEpisodeSplit])

  const handleConfirmDirtySave = useCallback(() => {
    setDirtySaveConfirmOpen(false)
    proceedPendingAiAction()
  }, [proceedPendingAiAction])

  const handleConfirmReplaceAssets = useCallback(() => {
    setReplaceAssetsConfirmOpen(false)
    if (replaceAssetsMode === 'extract') {
      void runAssetExtract()
    } else {
      void runEpisodeSplit()
    }
    setReplaceAssetsMode(null)
  }, [replaceAssetsMode, runAssetExtract, runEpisodeSplit])

  const handleAddEpisode = () => {
    if (!data) return
    const next = reindexEpisodes([...episodes, createEmptyEpisode(episodes.length + 1)])
    patchEpisodes(next, episodePlanAfterStructureEdit(data))
    handleEpisodeTabChange(next[next.length - 1].id)
  }

  const { ask, confirmDialog } = useConfirmDialog()

  const handleDeleteEpisode = async (episodeId: string) => {
    const ok = await ask({
      title: '删除分集',
      description: '确定删除此分集吗？删除后不可恢复。',
      confirmLabel: '删除',
      variant: 'destructive',
    })
    if (!ok || !data) return
    const next = ensureDefaultEpisode(removeEpisode(episodes, episodeId))
    patchEpisodes(next, episodePlanAfterStructureEdit(data))
    const nextTab = next[0]?.id ?? 'full'
    if (nextTab !== 'full') setActiveEpisodeId(nextTab)
    setActiveTab(nextTab)
  }

  const handleClearEpisodes = async () => {
    if (episodes.length === 0) return
    const ok = await ask({
      title: '重置分集',
      description: '确定重置分集吗？将保留一集空白占位，供手搓创作。',
      confirmLabel: '重置',
      variant: 'destructive',
    })
    if (!ok) return
    const reset = [createEmptyEpisode(1)]
    patchEpisodes(reset, 'bootstrap')
    handleEpisodeTabChange(reset[0].id)
  }

  const handleConfirmSyncStep1Script = useCallback(() => {
    if (!data || !step1SyncPreview.changed) {
      setSyncStep1ConfirmOpen(false)
      return
    }
    const nextEpisodes = applyStep1ScriptToFirstEpisode(data)
    const nextPlan = episodePlanAfterUserEdit(data)
    patchData({
      episodes: nextEpisodes,
      ...(nextPlan ? { episodePlan: nextPlan } : {}),
    })
    setSyncStep1ConfirmOpen(false)
    toast.success('已将 Step1 全文同步到第 1 集')
  }, [data, patchData, step1SyncPreview.changed])

  if (!data) return null

  const previewContent =
    activeTab === 'full' ? data.script : (selectedEpisode?.content ?? '')
  const previewEditable = activeTab !== 'full'
  const episodePlanLabel = formatEpisodePlanLabel(data)

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <ProjectVisualStyleField
        settings={settings}
        presetKey={projectStylePresetKey}
        compact
        onApply={(patch) => patchData(patch)}
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-[160px] space-y-1">
          <Label className="text-[10px] text-muted-foreground">LLM 模型</Label>
          <Select
            value={llmModelId}
            onChange={handleLlmModelChange}
            options={llmOptions}
            placeholder="请选择 LLM 模型"
            disabled={llmOptions.length === 0}
          />
        </div>

        <div className="w-[160px] space-y-1" title="全局记住上次选用；提取优先各集脚本，分集优先 Step1 全文">
          <Label className="text-[10px] text-muted-foreground">资产提取模板（分集）</Label>
          <Select
            value={activeExtractTemplateKey}
            onChange={handleExtractTemplateChange}
            options={extractOptions}
            placeholder="选择资产提取模板"
            disabled={extractOptions.length === 0}
          />
        </div>

        <WorkshopAiButton
          type="button"
          sizePreset="header"
          data-testid="workshop-step2-split"
          onClick={handleSplit}
          loading={splitBusy}
          disabled={!scriptReadyForSplit || extractBusy}
          title={
            scriptReadyForSplit
              ? `${splitSourceHint}；会重新分集并覆盖现有分集与资产草稿`
              : '录入剧本或本集脚本后可 AI 分集并提取资产'
          }
        >
          {splitBusy ? '处理中…' : 'AI 分集并提取资产'}
        </WorkshopAiButton>

        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-xl gap-1.5 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10"
          data-testid="workshop-step2-extract"
          onClick={handleQuickExtract}
          disabled={!scriptReadyForExtract || extractBusy || splitBusy}
          title={
            scriptReadyForExtract
              ? `${extractSourceHint}，不修改分集内容`
              : '录入剧本或本集脚本后可一键提取资产'
          }
        >
          {quickExtractBusy ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
          {quickExtractBusy ? '提取中…' : '一键提取资产'}
        </Button>

        {taskBusy || taskMessage ? (
          <span className="text-xs text-muted-foreground">
            {taskMessage ||
              (reextractBusy
                ? '正在重提本集资产…'
                : quickExtractBusy
                  ? '正在提取资产…'
                  : '正在智能分集并同步资产…')}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(200px,11rem)_minmax(280px,22vw)_minmax(0,1fr)] gap-4 flex-1 min-h-0">
        <div className="flex flex-col gap-2 min-h-0">
          <span
            className="text-[10px] text-muted-foreground px-1"
            title="分集规划模式：占位分集可镜像 Step1 全文；手动/AI 分集后不再自动覆盖"
          >
            {episodePlanLabel}
          </span>
          <EpisodeTabs
            episodes={episodes}
            activeKey={activeTab}
            onChange={handleEpisodeTabChange}
            onAdd={handleAddEpisode}
            onDelete={handleDeleteEpisode}
            onClear={handleClearEpisodes}
          />
        </div>

        <GlassCard className="p-4 space-y-4 overflow-y-auto min-h-0">
          {activeTab === 'full' ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Step1 全文剧本（只读）。分集编辑请在左侧选择具体分集；AI 分集会优先使用此处全文。
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                data-testid="workshop-step2-goto-step1"
                onClick={() => {
                  if (!projectId) return
                  window.location.hash = `#/workshop/${projectId}/step/1`
                }}
              >
                前往 Step1 编辑全文
              </Button>
            </div>
          ) : selectedEpisode ? (
            <>
              <div className="flex items-center justify-between gap-3 pb-1">
                <p className="text-sm font-medium">
                  第 {selectedEpisode.episodeIndex} 集
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    / 共 {episodes.length} 集
                  </span>
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 rounded-lg gap-1 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10 text-xs px-2.5"
                  data-testid="workshop-step2-reextract-episode"
                  disabled={!episodeReextractReady || extractBusy || splitBusy}
                  title={episodeReextractHint}
                  onClick={() => handleEpisodeReextractRequest(selectedEpisode.id)}
                >
                  {reextractBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" /> : null}
                  {reextractBusy ? '重提中…' : '重提本集资产'}
                </Button>
              </div>
              <div className="space-y-2">
                <Label>集标题</Label>
                <Input
                  value={selectedEpisode.title}
                  onChange={(e) => patchSelectedEpisode({ title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>资产标签</Label>
                <div className="flex flex-wrap gap-1.5">
                  {entities.characters.map((item) => (
                    <EntityTag key={`c-${item.name}`} kind="character" label={item.name} />
                  ))}
                  {entities.scenes.map((item) => (
                    <EntityTag key={`s-${item.name}`} kind="scene" label={item.name} />
                  ))}
                  {entities.items.map((item) => (
                    <EntityTag key={`p-${item.name}`} kind="prop" label={item.name} />
                  ))}
                  {entities.characters.length + entities.scenes.length + entities.items.length ===
                  0 ? (
                    <span className="text-xs text-muted-foreground">暂无标签</span>
                  ) : null}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">请选择一集进行编辑</p>
          )}
        </GlassCard>

        <GlassCard className="p-4 flex flex-col min-h-0 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <Label>{previewEditable ? '本集脚本' : 'Step1 全文预览'}</Label>
              <div className="flex items-center gap-2 shrink-0">
                {previewEditable && step1SyncPreview.changed ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    data-testid="workshop-step2-sync-step1"
                    onClick={() => setSyncStep1ConfirmOpen(true)}
                  >
                    从 Step1 同步
                  </Button>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {previewContent.length} 字
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              {previewEditable
                ? '本集脚本为执行源；一键提取优先各集内容，分集优先 Step1 全文。'
                : '只读预览，与左侧各集脚本分离；修改全文请前往 Step1。'}
            </p>
          </div>
          <Textarea
            data-testid={
              previewEditable
                ? 'workshop-step2-episode-script-textarea'
                : 'workshop-step2-full-script-textarea'
            }
            value={previewContent}
            readOnly={!previewEditable}
            onChange={(e) =>
              previewEditable &&
              patchSelectedEpisode({
                content: e.target.value,
                contentManuallyEdited: true,
              })
            }
            className={cn(
              'flex-1 min-h-[320px] resize-none text-sm leading-relaxed',
              !previewEditable && 'cursor-default opacity-90',
            )}
            placeholder={
              activeTab === 'full' ? '暂无 Step1 全文剧本' : '输入或粘贴本集脚本…'
            }
          />
        </GlassCard>
      </div>

      <ConfirmDialog
        open={dirtySaveConfirmOpen}
        title={STEP2_DIRTY_AI_SAVE_CONFIRM.title}
        description={STEP2_DIRTY_AI_SAVE_CONFIRM.description}
        confirmLabel={STEP2_DIRTY_AI_SAVE_CONFIRM.confirmLabel}
        cancelLabel={STEP2_DIRTY_AI_SAVE_CONFIRM.cancelLabel}
        loading={taskBusy}
        onClose={() => {
          if (taskBusy) return
          setDirtySaveConfirmOpen(false)
          setPendingAiMode(null)
        }}
        onConfirm={handleConfirmDirtySave}
      />

      <ConfirmDialog
        open={syncStep1ConfirmOpen}
        title={STEP2_SYNC_STEP1_SCRIPT_CONFIRM.title}
        description={formatStep1EpisodeSyncConfirmDescription(step1SyncPreview)}
        confirmLabel={STEP2_SYNC_STEP1_SCRIPT_CONFIRM.confirmLabel}
        cancelLabel={STEP2_SYNC_STEP1_SCRIPT_CONFIRM.cancelLabel}
        variant="destructive"
        onClose={() => setSyncStep1ConfirmOpen(false)}
        onConfirm={handleConfirmSyncStep1Script}
      />

      <ConfirmDialog
        open={replaceAssetsConfirmOpen}
        title={REPLACE_ASSETS_CONFIRM.title}
        description={REPLACE_ASSETS_CONFIRM.description}
        confirmLabel={REPLACE_ASSETS_CONFIRM.confirmLabel}
        cancelLabel={REPLACE_ASSETS_CONFIRM.cancelLabel}
        variant="destructive"
        loading={taskBusy}
        onClose={() => {
          if (taskBusy) return
          setReplaceAssetsConfirmOpen(false)
          setReplaceAssetsMode(null)
        }}
        onConfirm={handleConfirmReplaceAssets}
      />

      {confirmDialog}
    </div>
  )
}
