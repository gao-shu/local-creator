import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { startAssetExtract } from '@/lib/workflow/asset-extract-service'
import {
  EXTRACT_POLL_MS,
  clearExtractSessionTaskId,
  reconcileStaleExtractTasks,
  setExtractSessionTaskId,
} from '@/lib/workflow/extract-task-service'
import {
  clearEpisodeSplitSessionTaskId,
  reconcileStaleEpisodeSplitTasks,
  setEpisodeSplitSessionTaskId,
  startEpisodeSplit,
} from '@/lib/workflow/episode-split-service'
import {
  formatStep2AiRunningMessage,
  formatStep2AiScriptSourceHint,
  hasWorkflowScriptContent,
  resolveStep2AiScript,
} from '@/lib/workflow/episode-utils'
import { needsReplaceAssetsConfirm, REPLACE_ASSETS_CONFIRM, resolveStep2ExtractTemplateKey } from '@/lib/workflow/asset-utils'
import { resolveStep2TaskUiState } from '@/lib/workflow/step2-task-sync'
import {
  flushWorkflowSessionBeforeAiTask,
  mergeExtractResultFromDisk,
  reloadWorkflowSessionAfterSplit,
} from '@/lib/workflow/step2-ai-session'
import { getLlmModelSelectionError } from '@/lib/models/llm-client'
import { resolveSoftwareLlmModelId } from '@/lib/models/software-model-prefs'
import { buildModelSelectOptions } from '@/lib/models/model-select-options'
import { readWorkflowTasks } from '@/lib/storage/workflow-service'
import { resolveProjectEpisodeStyle } from '@/lib/workflow/project-visual-style'
import { useSettingsStore } from '@/stores/settings-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import { useTaskStore } from '@/stores/task-store'

type UseWorkflowEpisodeAiActionsOptions = {
  /** 分集任务完成后回调（如 Step2 切换到第一集） */
  onSplitFinished?: () => void
}

export function useWorkflowEpisodeAiActions(options: UseWorkflowEpisodeAiActionsOptions = {}) {
  const projectId = useWorkflowSessionStore((s) => s.projectId)
  const meta = useWorkflowSessionStore((s) => s.meta)
  const data = useWorkflowSessionStore((s) => s.data)
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const save = useWorkflowSessionStore((s) => s.save)
  const reload = useWorkflowSessionStore((s) => s.reload)

  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.load)
  const getMergedModels = useSettingsStore((s) => s.getMergedModels)
  const systemModelsByKind = useSettingsStore((s) => s.systemModelsByKind)
  const rememberEpisodeLlmModelId = useSettingsStore((s) => s.rememberLastUsedEpisodeLlmModelId)
  const rememberExtractTemplateKey = useSettingsStore((s) => s.rememberLastUsedExtractTemplateKey)

  const [splitting, setSplitting] = useState(false)
  const [splitPending, setSplitPending] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractPending, setExtractPending] = useState(false)
  const [replaceAssetsConfirmOpen, setReplaceAssetsConfirmOpen] = useState(false)
  const [replaceAssetsMode, setReplaceAssetsMode] = useState<'split' | 'extract' | null>(null)
  const [taskMessage, setTaskMessage] = useState('')

  const llmPrefApplied = useRef(false)
  const splitWasActive = useRef(false)
  const extractWasActive = useRef(false)
  const pollEpoch = useRef(0)

  useEffect(() => {
    if (!settings) loadSettings()
  }, [settings, loadSettings])

  useEffect(() => {
    llmPrefApplied.current = false
    splitWasActive.current = false
    extractWasActive.current = false
    setSplitPending(false)
    setExtractPending(false)
  }, [projectId])

  const scriptReadyForSplit = hasWorkflowScriptContent(data, 'split')
  const scriptReadyForExtract = hasWorkflowScriptContent(data, 'extract')
  const scriptReady = scriptReadyForSplit || scriptReadyForExtract

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
  const splitBusy = splitting || splitPending
  const extractBusy = extracting || extractPending
  const taskBusy = splitBusy || extractBusy

  const episodeStyle = resolveProjectEpisodeStyle(data, settings)

  const mergedLlmModels = useMemo(
    () => getMergedModels('llm'),
    [getMergedModels, systemModelsByKind, settings?.llmModels],
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

  const activeLlmModel = useMemo(
    () => mergedLlmModels.find((m) => m.id === llmModelId) ?? null,
    [llmModelId, mergedLlmModels],
  )

  useEffect(() => {
    if (!data || !settings || llmPrefApplied.current) return
    if (activeExtractTemplateKey && data.extractTemplateKey !== activeExtractTemplateKey) {
      patchData({ extractTemplateKey: activeExtractTemplateKey })
      void save({ silent: true })
    }
    llmPrefApplied.current = true
  }, [activeExtractTemplateKey, data, patchData, save, settings])

  const handleExtractTemplateChange = useCallback(
    (value: string) => {
      void rememberExtractTemplateKey(value)
      patchData({ extractTemplateKey: value })
      void save({ silent: true })
    },
    [patchData, rememberExtractTemplateKey, save],
  )

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

      const ui = resolveStep2TaskUiState(
        tasks,
        {
          extractWasActive: extractWasActive.current,
          splitWasActive: splitWasActive.current,
        },
        projectId,
      )

      extractWasActive.current = ui.extractWasActive
      splitWasActive.current = ui.splitWasActive
      setSplitting(ui.splitting)
      setExtracting(ui.extracting)
      setTaskMessage(ui.taskMessage)

      if (ui.extractJustFinished) {
        await applyExtractResultFromDisk()
        void useTaskStore.getState().refresh()
      }

      if (ui.splitJustFinished) {
        await applySplitResultFromDisk()
        options.onSplitFinished?.()
        return
      }

      const store = useWorkflowSessionStore.getState()
      if (!store.dirty && !ui.extracting && !ui.splitting) await reload()
    } catch {
      if (epoch !== pollEpoch.current) return
      splitWasActive.current = false
      extractWasActive.current = false
      setSplitting(false)
      setExtracting(false)
      setTaskMessage('')
    }
  }, [applyExtractResultFromDisk, applySplitResultFromDisk, options.onSplitFinished, projectId, reload])

  useEffect(() => {
    if (!projectId) return
    void pollTasks()
    const timer = window.setInterval(() => {
      void pollTasks()
    }, EXTRACT_POLL_MS)
    return () => window.clearInterval(timer)
  }, [projectId, pollTasks])

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
      options.onSplitFinished?.()
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
    llmModelId,
    mergedLlmModels,
    meta?.title,
    options.onSplitFinished,
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
    setTaskMessage(formatStep2AiRunningMessage(resolution, 'extract'))
    extractWasActive.current = true

    const { taskId, promise } = startAssetExtract(projectId, {
      script,
      extractTemplateKey: activeExtractTemplateKey || undefined,
      descriptionStyle: episodeStyle,
      settings,
      llmModelId,
    })
    setExtractSessionTaskId(projectId, taskId)

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
      setTaskMessage('')
      await pollTasks()
    }
  }, [
    activeExtractTemplateKey,
    data,
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

  const handleSplit = useCallback(() => {
    if (!data) return
    if (needsReplaceAssetsConfirm(data)) {
      setReplaceAssetsMode('split')
      setReplaceAssetsConfirmOpen(true)
      return
    }
    void runEpisodeSplit()
  }, [data, runEpisodeSplit])

  const handleQuickExtract = useCallback(() => {
    if (!data) return
    if (needsReplaceAssetsConfirm(data)) {
      setReplaceAssetsMode('extract')
      setReplaceAssetsConfirmOpen(true)
      return
    }
    void runAssetExtract()
  }, [data, runAssetExtract])

  const handleConfirmReplaceAssets = useCallback(() => {
    setReplaceAssetsConfirmOpen(false)
    if (replaceAssetsMode === 'extract') {
      void runAssetExtract()
    } else {
      void runEpisodeSplit()
    }
    setReplaceAssetsMode(null)
  }, [replaceAssetsMode, runAssetExtract, runEpisodeSplit])

  const llmOptions = useMemo(
    () => buildModelSelectOptions(mergedLlmModels, 'llm'),
    [mergedLlmModels],
  )

  const closeReplaceAssetsConfirm = useCallback(() => {
    if (taskBusy) return
    setReplaceAssetsConfirmOpen(false)
    setReplaceAssetsMode(null)
  }, [taskBusy])

  return {
    scriptReady,
    scriptReadyForSplit,
    scriptReadyForExtract,
    splitSourceHint,
    extractSourceHint,
    splitBusy,
    extractBusy,
    taskBusy,
    taskMessage,
    handleSplit,
    handleQuickExtract,
    replaceAssetsConfirm: {
      open: replaceAssetsConfirmOpen,
      ...REPLACE_ASSETS_CONFIRM,
      loading: taskBusy,
      onClose: closeReplaceAssetsConfirm,
      onConfirm: handleConfirmReplaceAssets,
    },
    llmOptions,
    extractOptions,
    activeExtractTemplateKey,
    handleExtractTemplateChange,
    llmModelId,
    rememberEpisodeLlmModelId,
    episodeStyle,
    patchData,
  }
}
