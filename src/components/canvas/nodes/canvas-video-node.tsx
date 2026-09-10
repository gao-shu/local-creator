// Copyright (c) local-creator contributors. All rights reserved.

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type SyntheticEvent,
} from 'react'
import type { NodeProps } from '@xyflow/react'
import { useUpdateNodeInternals } from '@xyflow/react'
import { Video as VideoIcon, AudioLines } from 'lucide-react'
import { toast } from 'sonner'
import { Select } from '@/components/ui/select'
import { CanvasGeneratePill } from '@/components/canvas/canvas-generate-pill'
import { CanvasVideoParamsPopover } from '@/components/canvas/nodes/canvas-video-params-popover'
import { CanvasNodeConnector } from '@/components/canvas/nodes/canvas-node-connector'
import { CanvasVideoCornerActions } from '@/components/canvas/nodes/canvas-video-corner-actions'
import { CanvasVideoGeneratingOverlay } from '@/components/canvas/nodes/canvas-video-generating-overlay'
import { CanvasImageNameEditor } from '@/components/canvas/nodes/canvas-image-name-editor'
import { CanvasVideoTopToolbar } from '@/components/canvas/nodes/canvas-video-top-toolbar'
import {
  CanvasNodeContextMenu,
  type CanvasNodeContextMenuAnchor,
} from '@/components/canvas/nodes/canvas-node-context-menu'
import { MentionTextarea } from '@/components/workshop/mention-textarea'
import { normalizeVideoGenerationTierParams } from '@/lib/models/video-generation-tier-params'
import { useSettingsStore } from '@/stores/settings-store'
import { useAuthStore } from '@/stores/auth-store'
import { readSettings } from '@/lib/storage/settings-service'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { hasCanvasInflightRun } from '@/lib/canvas/canvas-inflight-run-service'
import { isVideoRemoteJobStale } from '@/lib/video/video-remote-job'
import { resolveRunningVideoProgressMessageForUi } from '@/lib/video/video-progress'
import type { CanvasVideoNodeData } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { useCanvasVideoPreview } from '@/hooks/use-canvas-media-preview'
import { useCanvasVideoElementLoad } from '@/hooks/use-canvas-video-element-load'
import { useCanvasNodeNearViewport, CANVAS_VIDEO_KEEP_WARM_AFTER_LEAVE_MS } from '@/hooks/use-canvas-node-near-viewport'
import { useAdaptiveVideoFrame } from '@/hooks/use-adaptive-video-frame'
import { useCanvasNodeQuickAdd } from '@/hooks/use-canvas-node-quick-add'
import { useCanvasConsoleDismissOnOutsidePointerDown } from '@/hooks/use-canvas-console-dismiss'
import { captureVideoFrame, captureVideoLastFrame } from '@/lib/video/capture-video-frame'
import {
  peekVideoThumbnailCache,
  primeVideoThumbnailCache,
} from '@/lib/video/video-preview-cache'
import { useCanvasMentionCandidates } from '@/hooks/use-canvas-mention-candidates'
import {
  pickCanvasLocalImage,
  pickCanvasLocalVideo,
  saveCanvasUploadedImageFromDataUrl,
} from '@/lib/canvas/canvas-media-save'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'
import {
  assignDefaultImageNodeData,
  collectCanvasImageNodeNames,
  generateCanvasDefaultImageName,
} from '@/lib/canvas/canvas-image-role'
import {
  collectCanvasVideoReferenceBarAssets,
  collectCanvasVideoPromptMentionAssets,
  filterCanvasAssetMentionCandidates,
  isTypingCanvasManualMention,
  prepareCanvasVideoPromptContext,
} from '@/lib/canvas/canvas-mention-utils'
import { resolveCanvasVideoNodePrompt } from '@/lib/canvas/canvas-graph-utils'
import { resolveCanvasVideoNodeDragPath, hasCanvasVideoLocalOutput, isStuckCanvasVideoNodeWithOutput } from '@/lib/canvas/canvas-video-drag-items'
import {
  formatCanvasGenerationElapsed,
  resolveCanvasVideoGenerationStartedAt,
} from '@/lib/canvas/canvas-generation-elapsed'
import {
  buildCanvasAudioNodeDataFromExtract,
  resolveCanvasVideoExtractAudioAvailabilityFromNode,
  type CanvasVideoExtractAudioExtractedMeta,
} from '@/lib/canvas/canvas-video-extract-audio'
import type { ExtractAudioFromProjectResult } from '@/lib/media/extract-audio-from-video'
import { CANVAS_GRAPH_NODE_GAP_X } from '@/lib/canvas/canvas-graph-layout'
import {
  formatStoryboardShotTitle,
  resolveStoryboardShotDisplayPhase,
  resolveStoryboardShotNumber,
  buildStoryboardShotPromptPatch,
} from '@/lib/canvas/canvas-shot-utils'
import {
  formatCanvasVideoNodeName,
  generateCanvasDefaultVideoName,
  resolveCanvasVideoDisplayName,
  stripCanvasVideoNamePrefix,
  CANVAS_VIDEO_DEFAULT_NAME_COLOR,
} from '@/lib/canvas/canvas-video-naming'
import { CanvasVideoPreviewDialog } from '@/components/canvas/nodes/canvas-video-preview-dialog'
import { CanvasVideoExtractAudioDialog } from '@/components/canvas/modals/canvas-video-extract-audio-dialog'
import { CanvasVideoReferenceBar } from '@/components/canvas/nodes/canvas-video-reference-bar'
import { CanvasVideoPromptExpandDialog } from '@/components/canvas/nodes/canvas-video-prompt-expand-dialog'
import { CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE, CANVAS_NODE_CONSOLE_WIDTH, CANVAS_NODE_TOP_TOOLBAR_ANCHOR_STYLE } from '@/lib/canvas/canvas-console-layout'
import {
  CANVAS_IMAGE_PREVIEW_WIDTH_PX,
  CANVAS_VIDEO_PREVIEW_HEIGHT_PX,
  resolveCanvasVideoPreviewDimensions,
} from '@/lib/canvas/canvas-image-node-layout'
import { buildVideoModelSelectOptions } from '@/lib/models/model-select-options'
import { normalizeVideoAspectLabel } from '@/lib/canvas/canvas-video-aspect-probe'
import { openCanvasVideosFolder } from '@/lib/canvas/canvas-episode-deliverables'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { revealCanvasVideoInExplorer } from '@/lib/canvas/canvas-video-actions'
import {
  normalizeVideoDurationValue,
  normalizeVideoResolutionValue,
  resolveVideoAspectOptions,
  resolveVideoDurationOptions,
  resolveVideoResolutionOptions,
  shouldShowVideoResolutionSelector,
} from '@/lib/workflow/storyboard-video-presets'
import {
  clampVideoReferenceMode,
  getUnsupportedVideoReferenceModeMessage,
  resolveVideoReferenceModeOptions,
} from '@/lib/models/video-model-capability'
import { buildCanvasVideoModelSwitchPatch } from '@/lib/canvas/canvas-video-params-sync'
import { cn } from '@/lib/utils'
import {
  CANVAS_NODE_COMPACT_SELECT,
  CANVAS_NODE_CONSOLE,
  CANVAS_NODE_PREVIEW_FRAME,
  CANVAS_NODE_PREVIEW_HOVER_BORDER,
} from '@/lib/canvas/canvas-node-theme'

import {
  CANVAS_MEDIA_NODE_HEADER_ROW_CLASS,
  CanvasMediaNodeMissingOverlay,
  CanvasMediaNodeTypeLabel,
  CanvasMediaNodeVideoLoadErrorOverlay,
  CanvasMediaNodeVideoLoadOverlay,
  CanvasMediaNodeVideoPlaceholder,
} from '@/components/canvas/nodes/canvas-media-node-chrome'

import {
  readCanvasVideoAutoMentionEnabled,
  writeCanvasVideoAutoMentionEnabled,
} from '@/lib/canvas/canvas-video-auto-mention'

const CONSOLE_WIDTH_PX = CANVAS_NODE_CONSOLE_WIDTH

function toggleInlineVideoPlayPause(video: HTMLVideoElement) {
  if (video.paused) {
    void video.play().catch(() => {})
    return
  }
  video.pause()
}

function isInlineVideoControlBarClick(event: MouseEvent<HTMLVideoElement>): boolean {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.height <= 0) return false
  const yFromBottom = rect.bottom - event.clientY
  return yFromBottom <= 48 && yFromBottom >= 0
}

function CanvasVideoNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasVideoNodeData
  const {
    projectId,
    nodes,
    edges,
    updateNodeData,
    canvasVideoParams,
    updateCanvasVideoParams,
    runNode,
    retryVideoDownload,
    stopNode,
    isNodeRunning,
    videoPreviewNodeId,
    pendingVideoConfirm,
    videoConsoleNodeId,
    closeVideoConsole,
    activateVideoConsole,
    videoExtractAudioRequest,
    deleteNode,
    duplicateNode,
    addCanvasNode,
    appendCanvasGraph,
    agentPanelOpen,
    agentReferenceEnabled,
    toggleAgentReference,
  } = useCanvasEditor()
  const settings = useSettingsStore((state) => state.settings)
  const appDataDir = useSettingsStore((state) => state.appDataDir)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const systemVideoCatalog = useSettingsStore((state) => state.systemModelsByKind.video)
  const authToken = useAuthStore((state) => state.token)
  const [uploading, setUploading] = useState(false)
  const [capturingFrame, setCapturingFrame] = useState(false)
  const [revealingFolder, setRevealingFolder] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewInitialTime, setPreviewInitialTime] = useState(0)
  const [videoHovered, setVideoHovered] = useState(false)
  const [inlineVideoReady, setInlineVideoReady] = useState(false)
  const [posterSrc, setPosterSrc] = useState('')
  const inlineVideoRef = useRef<HTMLVideoElement>(null)
  const [contextMenuAnchor, setContextMenuAnchor] = useState<CanvasNodeContextMenuAnchor | null>(
    null,
  )
  const [autoMentionEnabled, setAutoMentionEnabled] = useState(readCanvasVideoAutoMentionEnabled)
  const [promptExpandOpen, setPromptExpandOpen] = useState(false)
  const [extractAudioDialogOpen, setExtractAudioDialogOpen] = useState(false)
  const prevPreviewRef = useRef('')
  const lastExtractAudioRequestNonceRef = useRef<number | null>(null)
  const { src: previewSrc, mediaMissing } = useCanvasVideoPreview(
    nodeData.outputPath,
    projectId,
    nodeData.outputOwnerKind,
    nodeData.outputOwnerProjectId,
  )
  const consoleOpen = videoConsoleNodeId === id
  const showConsole = consoleOpen
  const nodeRootRef = useCanvasConsoleDismissOnOutsidePointerDown(
    showConsole,
    closeVideoConsole,
    id,
  )
  const isNearViewport = useCanvasNodeNearViewport(nodeRootRef)
  /** 进过视口后短时保持加载，避免拖动画布边缘反复卸/挂 src */
  const [keepVideoWarm, setKeepVideoWarm] = useState(false)
  useEffect(() => {
    if (isNearViewport) {
      setKeepVideoWarm(true)
      return
    }
    if (!keepVideoWarm) return
    const timer = window.setTimeout(() => {
      setKeepVideoWarm(false)
    }, CANVAS_VIDEO_KEEP_WARM_AFTER_LEAVE_MS)
    return () => window.clearTimeout(timer)
  }, [isNearViewport, keepVideoWarm])
  const videoLoadEnabled =
    Boolean(previewSrc) && !mediaMissing && (isNearViewport || keepVideoWarm)
  const videoElementLoad = useCanvasVideoElementLoad({
    nodeId: id,
    resolvedSrc: previewSrc,
    enabled: videoLoadEnabled,
    priority: selected ? 10 : isNearViewport ? 5 : 0,
  })

  useEffect(() => {
    const video = inlineVideoRef.current
    if (!video) return
    if (!isNearViewport && !video.paused) {
      try {
        video.pause()
      } catch {
        /* ignore */
      }
    }
  }, [isNearViewport])
  const hasPendingRemoteJob = useMemo(
    () => {
      // 已失败/成功时残留 remoteJob 不算进行中（否则会 toast 却无遮罩）
      if (nodeData.status === 'success' || nodeData.status === 'error') return false
      return Boolean(
        nodeData.remoteJob?.apiTaskId?.trim() &&
          !isVideoRemoteJobStale(nodeData.remoteJob),
      )
    },
    [nodeData.remoteJob, nodeData.status],
  )
  const hasLocalVideoOutput = useMemo(
    () => hasCanvasVideoLocalOutput(nodeData),
    [nodeData.outputPath],
  )
  const isPlayableLocalVideo = hasLocalVideoOutput && Boolean(previewSrc)
  const running = useMemo(() => {
    // 成功/失败已落定：勿再因 inflight 未 finally 而盖「生成中…」
    if (nodeData.status === 'success' || nodeData.status === 'error') return false

    const hasActiveRemoteJob = hasPendingRemoteJob
    const hasLiveSession =
      hasCanvasInflightRun(projectId, id) ||
      videoPreviewNodeId === id ||
      pendingVideoConfirm?.nodeId === id

    // 已有可播成片且无真实会话：残留 status=running / remoteJob 不当作生成中（落盘成功未收尾）
    if (isPlayableLocalVideo && !hasLiveSession) {
      return false
    }

    // 仅 status/远端/inflight 驱动「生成中」；避免 runningNodeIds 残留导致队列已失败仍转圈
    const taskActive =
      nodeData.status === 'running' ||
      hasActiveRemoteJob ||
      hasLiveSession

    if (taskActive) {
      if (
        nodeData.status === 'running' &&
        nodeData.remoteJob?.apiTaskId?.trim() &&
        isVideoRemoteJobStale(nodeData.remoteJob)
      ) {
        return false
      }
      return true
    }

    if (isPlayableLocalVideo) return false
    if (hasLocalVideoOutput) return false
    return false
  }, [
    hasLocalVideoOutput,
    id,
    isPlayableLocalVideo,
    nodeData.status,
    nodeData.remoteJob,
    hasPendingRemoteJob,
    previewSrc,
    projectId,
    videoPreviewNodeId,
    pendingVideoConfirm?.nodeId,
  ])

  const generationStartedAt = useMemo(
    () => resolveCanvasVideoGenerationStartedAt(nodeData),
    [nodeData.generationStartedAt, nodeData.remoteJob?.createdAt],
  )
  const [generationNowTick, setGenerationNowTick] = useState(() => Date.now())
  useEffect(() => {
    if (!running || !generationStartedAt) return
    setGenerationNowTick(Date.now())
    const timer = window.setInterval(() => setGenerationNowTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [generationStartedAt, running])

  const generationElapsedLabel = useMemo(() => {
    if (running && generationStartedAt) {
      return formatCanvasGenerationElapsed(generationNowTick - generationStartedAt)
    }
    const storedMs = Number(nodeData.generationElapsedMs)
    if (Number.isFinite(storedMs) && storedMs >= 0) {
      return formatCanvasGenerationElapsed(storedMs)
    }
    return ''
  }, [
    generationNowTick,
    generationStartedAt,
    nodeData.generationElapsedMs,
    running,
  ])
  const showGenerationElapsed = Boolean(generationElapsedLabel)

  const hasVideo = Boolean(previewSrc)
  const showMissingOverlay = hasLocalVideoOutput && mediaMissing && !running
  const videoLoadOverlayPhase: 'queued' | 'loading' | null =
    videoElementLoad.phase === 'queued'
      ? 'queued'
      : videoElementLoad.phase === 'loading' && !inlineVideoReady
        ? 'loading'
        : null
  const showVideoLoadOverlay =
    Boolean(previewSrc) &&
    isNearViewport &&
    !showMissingOverlay &&
    !running &&
    videoLoadOverlayPhase != null
  const showVideoLoadErrorOverlay =
    Boolean(previewSrc) &&
    isNearViewport &&
    !showMissingOverlay &&
    !running &&
    videoElementLoad.phase === 'error'
  const showDeferredViewportPlaceholder =
    Boolean(previewSrc) && !mediaMissing && !videoLoadEnabled && !running
  const extractAudioAvailability = useMemo(
    () =>
      resolveCanvasVideoExtractAudioAvailabilityFromNode({
        data: nodeData,
        running,
        uploading,
        mediaMissing: hasLocalVideoOutput ? mediaMissing : undefined,
      }),
    [hasLocalVideoOutput, mediaMissing, nodeData, running, uploading],
  )
  const extractAudioTitle = extractAudioAvailability.available
    ? '从本地视频提取 mp3 参考音频'
    : extractAudioAvailability.disabledReason ?? '无法提取音频'

  useEffect(() => {
    setInlineVideoReady(false)
  }, [videoElementLoad.displaySrc])

  useEffect(() => {
    const src = String(previewSrc || '').trim()
    if (!src) {
      setPosterSrc('')
      return
    }
    setPosterSrc(peekVideoThumbnailCache(src) || '')
  }, [previewSrc])

  useEffect(() => {
    if (selected || isNearViewport) videoElementLoad.boostPriority()
  }, [selected, isNearViewport, videoElementLoad.boostPriority])

  const cachePosterFromVideoEl = useCallback(
    async (video: HTMLVideoElement | null) => {
      const src = String(previewSrc || '').trim()
      if (!src || !video?.videoWidth) return
      if (peekVideoThumbnailCache(src)) return
      try {
        const frame = await captureVideoFrame(video)
        if (!frame) return
        primeVideoThumbnailCache(src, frame)
        setPosterSrc(frame)
      } catch {
        /* ignore poster capture errors */
      }
    },
    [previewSrc],
  )

  useEffect(() => {
    if (!prevPreviewRef.current && previewSrc) {
      closeVideoConsole()
    }
    prevPreviewRef.current = previewSrc
  }, [previewSrc, closeVideoConsole])

  const handlePatch = useCallback(
    (patch: Partial<CanvasVideoNodeData>) => {
      updateNodeData(id, patch)
    },
    [id, updateNodeData],
  )

  useEffect(() => {
    if (!isStuckCanvasVideoNodeWithOutput(nodeData)) return
    // 真实会话进行中（含「保留旧片重新生成」）：勿强制 success
    if (hasCanvasInflightRun(projectId, id)) return
    if (videoPreviewNodeId === id || pendingVideoConfirm?.nodeId === id) return
    if (isNodeRunning(id)) stopNode(id)
    handlePatch({
      status: 'success',
      error: undefined,
      progressMessage: undefined,
      remoteJob: undefined,
      pendingDownloadUrl: undefined,
      statusUpdatedAt: Date.now(),
    })
  }, [
    handlePatch,
    id,
    isNodeRunning,
    nodeData.outputPath,
    nodeData.status,
    nodeData.remoteJob,
    nodeData.progressMessage,
    pendingVideoConfirm?.nodeId,
    projectId,
    stopNode,
    videoPreviewNodeId,
  ])

  // 已成功可播却残留 pendingDownloadUrl（历史 401 后修好下载等）→ 清掉，避免误显「重新下载」
  useEffect(() => {
    if (!isPlayableLocalVideo) return
    if (nodeData.status === 'error') return
    if (!String(nodeData.pendingDownloadUrl || '').trim()) return
    if (hasCanvasInflightRun(projectId, id)) return
    if (videoPreviewNodeId === id || pendingVideoConfirm?.nodeId === id) return
    handlePatch({ pendingDownloadUrl: undefined })
  }, [
    handlePatch,
    id,
    isPlayableLocalVideo,
    nodeData.pendingDownloadUrl,
    nodeData.status,
    pendingVideoConfirm?.nodeId,
    projectId,
    videoPreviewNodeId,
  ])

  // 失败节点上残留 remoteJob / running 标记时自动清理，避免无法重新生成
  useEffect(() => {
    if (nodeData.status !== 'error') return
    // 正在重新下载成片时勿当残留 UI running 清理，否则会 abort 下载
    if (hasCanvasInflightRun(projectId, id)) return
    const hasStaleRemote = Boolean(nodeData.remoteJob?.apiTaskId?.trim())
    const hasStaleUiRunning = isNodeRunning(id)
    if (!hasStaleRemote && !hasStaleUiRunning) return
    if (hasStaleUiRunning) stopNode(id)
    if (hasStaleRemote) {
      handlePatch({
        remoteJob: undefined,
        progressMessage: undefined,
        statusUpdatedAt: Date.now(),
      })
    }
  }, [
    handlePatch,
    id,
    isNodeRunning,
    nodeData.remoteJob,
    nodeData.status,
    projectId,
    stopNode,
  ])

  const videoDisplayName = useMemo(
    () => resolveCanvasVideoDisplayName({ videoName: nodeData.videoName }),
    [nodeData.videoName],
  )

  const selfNode = useMemo(() => nodes.find((node) => node.id === id), [nodes, id])

  const storyboardShotNumber = useMemo(
    () => resolveStoryboardShotNumber(nodeData),
    [nodeData.shotNumber, nodeData.importShotNumber],
  )

  const storyboardShotTitle = useMemo(() => {
    if (storyboardShotNumber == null) return ''
    return formatStoryboardShotTitle({
      shotNumber: storyboardShotNumber,
      dialogue: nodeData.dialogue,
      phase: resolveStoryboardShotDisplayPhase(nodeData, { running }),
      hasOutput: hasLocalVideoOutput,
      needsRegen: nodeData.needsRegen,
      status: nodeData.status,
    })
  }, [
    storyboardShotNumber,
    nodeData.dialogue,
    nodeData.needsRegen,
    nodeData.status,
    running,
    hasLocalVideoOutput,
  ])

  const showStoryboardNeedsRegenBadge = Boolean(
    storyboardShotNumber != null && nodeData.needsRegen && hasLocalVideoOutput && !running,
  )

  useEffect(() => {
    if (storyboardShotNumber != null) return
    if (String(nodeData.videoName || '').trim()) return
    const existingNames = nodes
      .filter((node) => node.type === CANVAS_NODE_TYPES.storyVideo && node.id !== id)
      .map((node) => String((node.data as CanvasVideoNodeData).videoName || '').trim())
      .filter(Boolean)
    handlePatch({ videoName: generateCanvasDefaultVideoName(existingNames) })
  }, [nodeData.videoName, nodes, id, handlePatch, storyboardShotNumber])

  const handleSaveVideoName = useCallback(
    (name: string) => {
      const body = stripCanvasVideoNamePrefix(name.trim()) || name.trim()
      handlePatch({
        videoName: body ? formatCanvasVideoNodeName(body) : undefined,
      })
    },
    [handlePatch],
  )

  const capcutStoredPath = useMemo(
    () => resolveCanvasVideoNodeDragPath(nodeData),
    [nodeData],
  )
  const capcutProjectRoot = useMemo(() => {
    if (!settings || !capcutStoredPath) return undefined
    if (nodeData.outputOwnerKind === 'workflow' && nodeData.outputOwnerProjectId) {
      return resolveProjectRoot(settings, appDataDir, nodeData.outputOwnerProjectId)
    }
    return resolveCanvasProjectRoot(settings, appDataDir, projectId)
  }, [
    appDataDir,
    capcutStoredPath,
    nodeData.outputOwnerKind,
    nodeData.outputOwnerProjectId,
    projectId,
    settings,
  ])
  const capcutFilename = useMemo(() => {
    const base =
      videoDisplayName.label.replace(/[^\w\u4e00-\u9fa5.-]+/g, '_').trim() || 'canvas-video'
    return `${base}.mp4`
  }, [videoDisplayName.label])

  const videoModels = getMergedModels('video')
  const modelOptions = useMemo(
    () => buildVideoModelSelectOptions(videoModels, systemVideoCatalog, authToken, { modelPickerOnly: true }),
    [authToken, systemVideoCatalog, videoModels],
  )
  const activeModelId =
    canvasVideoParams.videoModelId ||
    videoModels[0]?.id ||
    ''
  const activeModel = videoModels.find((model) => model.id === activeModelId) ?? videoModels[0] ?? null
  const referenceMode = clampVideoReferenceMode(canvasVideoParams.referenceMode, activeModel)
  const referenceModeOptions = useMemo(
    () => resolveVideoReferenceModeOptions(activeModel),
    [activeModel],
  )
  const resolutionOptions = useMemo(
    () => resolveVideoResolutionOptions(activeModel),
    [activeModel],
  )
  const resolutionValue = normalizeVideoResolutionValue(canvasVideoParams.resolution, activeModel)
  const showVideoResolutionSelector = shouldShowVideoResolutionSelector(activeModel)
  const durationOptions = useMemo(
    () => resolveVideoDurationOptions(activeModel),
    [activeModel],
  )
  const aspectOptions = useMemo(
    () => resolveVideoAspectOptions(activeModel),
    [activeModel],
  )
  const durationValue = normalizeVideoDurationValue(
    canvasVideoParams.durationSec != null ? String(canvasVideoParams.durationSec) : '',
    activeModel,
  )
  const canvasVideoDurationSec = Number(durationValue) || 5
  const canvasVideoTierParams = useMemo(
    () => normalizeVideoGenerationTierParams(activeModel, { resolution: resolutionValue }),
    [activeModel, resolutionValue],
  )
  const videoCostEstimate = null
  const videoCostLoading = false
  const consoleAspectRatio = canvasVideoParams.aspectRatio ?? '16:9'
  const { frameStyle, onVideoLoadedMetadata, previewWidth } = useAdaptiveVideoFrame(
    previewSrc,
    previewSrc ? undefined : consoleAspectRatio,
    {
      // 已有成片时按视频源真实宽高比展示，不用 nodeData 归一化画幅标签算外框
      adaptToSource: Boolean(previewSrc),
      anchorHeightPx: CANVAS_VIDEO_PREVIEW_HEIGHT_PX,
      anchorWidthPx: CANVAS_IMAGE_PREVIEW_WIDTH_PX,
      storedAspectRatio: nodeData.aspectRatio ?? canvasVideoParams.aspectRatio,
    },
  )

  const upstreamPrompt = useMemo(
    () => resolveCanvasVideoNodePrompt(id, nodes, edges, ''),
    [id, nodes, edges],
  )
  const mentionCandidates = useCanvasMentionCandidates(nodes, projectId, id, edges)
  const assetMentionCandidates = useMemo(
    () => filterCanvasAssetMentionCandidates(mentionCandidates),
    [mentionCandidates],
  )
  const displayPrompt = nodeData.prompt || ''
  const displaySpatialAnchor = String(nodeData.spatialAnchor || '').trim()

  const upstreamAssets = useMemo(
    () =>
      collectCanvasVideoReferenceBarAssets({
        videoNodeId: id,
        prompt: displayPrompt,
        nodes,
        edges,
        mentionCandidates,
        consoleReferenceImagePaths: nodeData.consoleReferenceImagePaths,
      }),
    [displayPrompt, edges, id, mentionCandidates, nodeData.consoleReferenceImagePaths, nodes],
  )

  const promptMentionAssets = useMemo(
    () =>
      collectCanvasVideoPromptMentionAssets({
        prompt: displayPrompt,
        mentionCandidates,
      }),
    [displayPrompt, mentionCandidates],
  )

  const handleUploadConsoleReference = useCallback(async () => {
    try {
      const path = await pickCanvasLocalImage({
        projectId,
        nodeId: id,
        kind: 'reference',
      })
      if (!path) return
      const next = [...(nodeData.consoleReferenceImagePaths ?? []), path]
      handlePatch({ consoleReferenceImagePaths: next })
      toast.success('已添加参考图')
    } catch (error: unknown) {
      toast.error((error as Error).message || '参考图上传失败')
    }
  }, [handlePatch, id, nodeData.consoleReferenceImagePaths, projectId])

  const handleRemoveConsoleReference = useCallback(
    (index: number) => {
      const current = nodeData.consoleReferenceImagePaths ?? []
      const next = current.filter((_, itemIndex) => itemIndex !== index)
      handlePatch({
        consoleReferenceImagePaths: next.length ? next : undefined,
      })
    },
    [handlePatch, nodeData.consoleReferenceImagePaths],
  )

  const applyAutoMention = useCallback(
    (rawPrompt: string, options?: { preserveWhitespace?: boolean }) => {
      if (!rawPrompt) {
        handlePatch(buildStoryboardShotPromptPatch(nodeData, rawPrompt))
        return rawPrompt
      }
      const { prompt: nextPrompt } = prepareCanvasVideoPromptContext(rawPrompt, nodes, {
        edges,
        preserveWhitespace: options?.preserveWhitespace,
        autoMentionEnabled: true,
      })
      handlePatch(buildStoryboardShotPromptPatch(nodeData, nextPrompt))
      return nextPrompt
    },
    [edges, handlePatch, nodeData, nodes],
  )

  const handlePromptChange = useCallback(
    (value: string) => {
      if (autoMentionEnabled && !isTypingCanvasManualMention(value)) {
        applyAutoMention(value, { preserveWhitespace: true })
        return
      }
      handlePatch(buildStoryboardShotPromptPatch(nodeData, value))
    },
    [applyAutoMention, autoMentionEnabled, handlePatch, nodeData],
  )

  const handleAutoMentionChange = useCallback(
    (enabled: boolean) => {
      setAutoMentionEnabled(enabled)
      writeCanvasVideoAutoMentionEnabled(enabled)
      if (!enabled) return
      applyAutoMention(displayPrompt || upstreamPrompt, { preserveWhitespace: true })
    },
    [applyAutoMention, displayPrompt, upstreamPrompt],
  )

  useEffect(() => {
    if (!showConsole || !autoMentionEnabled) return
    if (displayPrompt.trim()) return
    if (!upstreamPrompt.trim()) return
    applyAutoMention(upstreamPrompt)
  }, [applyAutoMention, autoMentionEnabled, displayPrompt, showConsole, upstreamPrompt])

  const compactSelectClass = cn(
    'h-6 w-auto max-w-none shrink-0 border-0 px-1 text-[11px] shadow-none',
    CANVAS_NODE_COMPACT_SELECT,
  )

  const openConsole = useCallback(() => {
    activateVideoConsole(id, { toggleIfOpen: false })
  }, [activateVideoConsole, id])

  const toggleConsoleFromVideo = useCallback(() => {
    if (!hasVideo) return
    if (showConsole) closeVideoConsole()
    else openConsole()
  }, [closeVideoConsole, hasVideo, openConsole, showConsole])

  const handleInlineVideoMetadata = useCallback(
    (event: SyntheticEvent<HTMLVideoElement>) => {
      onVideoLoadedMetadata(event)
      if (!hasLocalVideoOutput) return
      const video = event.currentTarget
      if (video.videoWidth <= 0 || video.videoHeight <= 0) return
      const detected = normalizeVideoAspectLabel(video.videoWidth, video.videoHeight)
      if (detected !== nodeData.aspectRatio) {
        handlePatch({ aspectRatio: detected })
      }
    },
    [handlePatch, hasLocalVideoOutput, nodeData.aspectRatio, onVideoLoadedMetadata],
  )

  const handleVideoPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    ;(event.currentTarget as HTMLDivElement & { __dragStart?: { x: number; y: number } }).__dragStart = {
      x: event.clientX,
      y: event.clientY,
    }
    // 生成中也要能点开控制台查看提示词，阻止画布拖拽抢点击
    if (!event.ctrlKey && !event.metaKey) {
      event.stopPropagation()
    }
  }, [])

  const handleVideoClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.currentTarget as HTMLDivElement & {
        __dragStart?: { x: number; y: number }
      }
      const start = target.__dragStart
      if (start) {
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
        if (moved > 4) return
      }
      if (event.ctrlKey || event.metaKey) return
      // 生成中：允许展开/收起控制台只读查看提示词
      if (running) {
        event.stopPropagation()
        if (showConsole) closeVideoConsole()
        else openConsole()
        return
      }
      if (agentPanelOpen && agentReferenceEnabled) {
        event.stopPropagation()
        toggleAgentReference(id)
        return
      }
      if (!hasVideo) {
        event.stopPropagation()
        openConsole()
        return
      }
      event.stopPropagation()
      toggleConsoleFromVideo()
    },
    [
      agentPanelOpen,
      agentReferenceEnabled,
      closeVideoConsole,
      hasVideo,
      id,
      openConsole,
      running,
      showConsole,
      toggleAgentReference,
      toggleConsoleFromVideo,
    ],
  )

  const videoControlsActive = Boolean(previewSrc)

  const openVideoPreview = useCallback(() => {
    const video = inlineVideoRef.current
    setPreviewInitialTime(video?.currentTime ?? 0)
    setPreviewOpen(true)
  }, [])

  const closeVideoPreview = useCallback(() => {
    setPreviewOpen(false)
  }, [])

  useEffect(() => {
    const video = inlineVideoRef.current
    if (!video || !showConsole) return

    const openModeratePreview = () => {
      openVideoPreview()
    }

    const handleFullscreenChange = () => {
      if (document.fullscreenElement !== video) return
      void document.exitFullscreen().catch(() => {})
      openModeratePreview()
    }

    const nativeRequestFullscreen = video.requestFullscreen.bind(video)
    video.requestFullscreen = async () => {
      openModeratePreview()
    }

    const webkitVideo = video as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void
    }
    const nativeWebkitEnterFullscreen = webkitVideo.webkitEnterFullscreen?.bind(webkitVideo)
    if (nativeWebkitEnterFullscreen) {
      webkitVideo.webkitEnterFullscreen = () => {
        openModeratePreview()
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      video.requestFullscreen = nativeRequestFullscreen
      if (nativeWebkitEnterFullscreen) {
        webkitVideo.webkitEnterFullscreen = nativeWebkitEnterFullscreen
      }
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [openVideoPreview, showConsole])

  const handleInlineVideoClick = useCallback(
    (event: MouseEvent<HTMLVideoElement>) => {
      if (!previewSrc) return
      event.stopPropagation()
      if (isInlineVideoControlBarClick(event)) return
      if (!showConsole) {
        openConsole()
      }
      toggleInlineVideoPlayPause(event.currentTarget)
    },
    [openConsole, previewSrc, showConsole],
  )

  const handleDeleteVideo = useCallback(() => {
    handlePatch({
      outputPath: undefined,
      status: 'idle',
      error: undefined,
      needsRegen: false,
    })
    closeVideoConsole()
    toast.success('已删除视频')
  }, [handlePatch, closeVideoConsole])

  const handleConnectorAdd = useCanvasNodeQuickAdd(id, previewWidth)
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    updateNodeInternals(id)
  }, [id, previewSrc, frameStyle, previewWidth, updateNodeInternals])

  const handleUploadVideo = useCallback(async () => {
    if (uploading) return
    setUploading(true)
    try {
      const uploaded = await pickCanvasLocalVideo({
        projectId,
        nodeId: id,
      })
      if (!uploaded) return
      handlePatch({
        outputPath: uploaded.outputPath,
        outputOwnerKind: 'canvas',
        outputOwnerProjectId: projectId,
        ...(uploaded.aspectRatio ? { aspectRatio: uploaded.aspectRatio } : {}),
        status: 'success',
        error: undefined,
      })
      openConsole()
      toast.success('视频已上传')
    } catch (error: unknown) {
      toast.error((error as Error).message || '上传视频失败')
    } finally {
      setUploading(false)
    }
  }, [uploading, projectId, id, handlePatch, openConsole])

  const handleRevealFolder = useCallback(async () => {
    if (revealingFolder) return
    setRevealingFolder(true)
    try {
      const storedPath = String(nodeData.outputPath || '').trim()
      if (storedPath && storedPath !== 'preview:' && nodeData.status === 'success') {
        await revealCanvasVideoInExplorer({
          storedPath: nodeData.outputPath,
          canvasProjectId: projectId,
          ownerKind: nodeData.outputOwnerKind,
          ownerProjectId: nodeData.outputOwnerProjectId,
        })
        return
      }
      if (!settings) {
        toast.error('请先加载设置')
        return
      }
      await openCanvasVideosFolder({
        canvasProjectId: projectId,
        settings,
        appDataDir,
      })
    } finally {
      setRevealingFolder(false)
    }
  }, [
    revealingFolder,
    nodeData.outputPath,
    nodeData.status,
    nodeData.outputOwnerKind,
    nodeData.outputOwnerProjectId,
    projectId,
    settings,
    appDataDir,
  ])

  const handleReferenceModeChange = useCallback(
    (value: string) => {
      updateCanvasVideoParams({
        referenceMode: clampVideoReferenceMode(value, activeModel),
      })
    },
    [activeModel, updateCanvasVideoParams],
  )

  const handleDurationChange = useCallback(
    (value: string) => {
      const normalized = normalizeVideoDurationValue(value, activeModel)
      updateCanvasVideoParams({ durationSec: Number(normalized) || 5 })
    },
    [activeModel, updateCanvasVideoParams],
  )

  const handleAspectRatioChange = useCallback(
    (value: string) => {
      updateCanvasVideoParams({ aspectRatio: value })
    },
    [updateCanvasVideoParams],
  )

  const handleResolutionChange = useCallback(
    (value: string) => {
      updateCanvasVideoParams({
        resolution: normalizeVideoResolutionValue(value, activeModel),
      })
    },
    [activeModel, updateCanvasVideoParams],
  )

  const handleModelChange = useCallback(
    (value: string) => {
      updateCanvasVideoParams(
        buildCanvasVideoModelSwitchPatch(value, videoModels, canvasVideoParams),
      )
    },
    [canvasVideoParams, updateCanvasVideoParams, videoModels],
  )

  const handleRun = useCallback(() => {
    const unsupported = getUnsupportedVideoReferenceModeMessage(referenceMode, activeModel)
    if (unsupported) {
      toast.error(unsupported)
      return
    }
    const sessionBusy = hasCanvasInflightRun(projectId, id)
    const remoteBusy = hasPendingRemoteJob
    const statusBusy = nodeData.status === 'running'
    if (sessionBusy || remoteBusy || statusBusy) {
      toast.info('该节点任务进行中，请稍候')
      return
    }
    // 仅 UI running 标记残留：清掉后允许重试（如下载失败「无效的下载 URL」后）
    if (isNodeRunning(id)) {
      stopNode(id)
    }
    if (pendingVideoConfirm) {
      toast.info('请先确认或取消当前视频生成弹窗')
      return
    }
    void runNode(id)
  }, [
    activeModel,
    hasPendingRemoteJob,
    id,
    isNodeRunning,
    nodeData.status,
    pendingVideoConfirm,
    projectId,
    referenceMode,
    runNode,
    stopNode,
  ])

  const handleCancelGeneration = useCallback(() => {
    stopNode(id)
    // 无论 inflight/status 是否一致，取消后必须清掉 residual，避免遮罩卡死
    handlePatch({
      status: hasLocalVideoOutput ? 'success' : 'error',
      error: hasLocalVideoOutput ? undefined : '已取消生成',
      progressMessage: undefined,
      remoteJob: undefined,
      statusUpdatedAt: Date.now(),
    })
  }, [handlePatch, hasLocalVideoOutput, id, stopNode])

  const canRetryDownload = Boolean(String(nodeData.pendingDownloadUrl || '').trim())
  // 仅「落盘失败」需要此按钮；已成功可播却残留 pendingDownloadUrl 时不当展示
  const showRetryDownloadOverlay =
    canRetryDownload && !running && (nodeData.status === 'error' || !isPlayableLocalVideo || mediaMissing)
  const handleRetryDownload = useCallback(() => {
    if (!canRetryDownload) {
      toast.error('没有可重新下载的成片地址')
      return
    }
    if (running || hasCanvasInflightRun(projectId, id)) {
      toast.info('该节点任务进行中，请稍候')
      return
    }
    void retryVideoDownload(id)
  }, [canRetryDownload, id, projectId, retryVideoDownload, running])

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuAnchor({ x: event.clientX, y: event.clientY })
  }, [])

  const handleOpenExtractAudio = useCallback(() => {
    if (!extractAudioAvailability.available) return
    setExtractAudioDialogOpen(true)
  }, [extractAudioAvailability.available])

  const handleCaptureFrame = useCallback(
    async (mode: 'current' | 'tail') => {
      if (!previewSrc || capturingFrame || running || uploading) return
      const video = inlineVideoRef.current
      if (!video?.videoWidth) {
        toast.warning('截图失败，请确认视频已加载')
        return
      }

      setCapturingFrame(true)
      const previousTime = video.currentTime
      try {
        const dataUrl =
          mode === 'tail' ? await captureVideoLastFrame(video) : await captureVideoFrame(video)
        if (!dataUrl) {
          toast.warning(
            mode === 'tail' ? '尾帧截取失败，请确认视频已加载完成' : '截图失败，请确认视频已加载',
          )
          return
        }

        const frameSec =
          mode === 'tail'
            ? Number.isFinite(video.duration)
              ? Math.max(0, video.duration - 0.04)
              : 0
            : Number.isFinite(video.currentTime)
              ? video.currentTime
              : 0
        const mm = Math.floor(Math.max(0, frameSec) / 60)
        const ss = Math.floor(Math.max(0, frameSec) % 60)
        const timeLabel = `${mm}:${String(ss).padStart(2, '0')}`
        const baseName =
          mode === 'tail'
            ? `${videoDisplayName.label || '视频'} · 尾帧`
            : `${videoDisplayName.label || '视频'} · 截帧 ${timeLabel}`
        const existingNames = collectCanvasImageNodeNames(nodes)
        const imageName = existingNames.some(
          (name) => name.trim().toLowerCase() === baseName.trim().toLowerCase(),
        )
          ? generateCanvasDefaultImageName(existingNames)
          : baseName

        const preview = resolveCanvasVideoPreviewDimensions(nodeData.aspectRatio)
        const position = {
          x: (selfNode?.position.x ?? 0) + preview.width + CANVAS_GRAPH_NODE_GAP_X,
          y: selfNode?.position.y ?? 0,
        }
        const node = createCanvasNode(
          CANVAS_NODE_TYPES.imageNode,
          position,
          assignDefaultImageNodeData(nodes, {
            imageName,
            status: 'running',
            progressMessage: mode === 'tail' ? '正在保存尾帧…' : '正在保存截帧…',
            error: undefined,
          }),
        )
        appendCanvasGraph([node], [])

        try {
          const settingsRes = await readSettings()
          const outputPath = await saveCanvasUploadedImageFromDataUrl({
            settings: settingsRes.data,
            appDataDir: settingsRes.appDataDir,
            projectId,
            nodeId: node.id,
            dataUrl,
          })
          updateNodeData(node.id, {
            outputPath,
            outputOwnerKind: 'canvas',
            outputOwnerProjectId: projectId,
            status: 'success',
            error: undefined,
            progressMessage: undefined,
            statusUpdatedAt: Date.now(),
          })
          toast.success(mode === 'tail' ? '已截取尾帧到画布' : '已截取当前帧到画布')
        } catch (error: unknown) {
          const message = (error as Error).message || '保存截帧失败'
          updateNodeData(node.id, {
            status: 'error',
            error: message,
            progressMessage: undefined,
            statusUpdatedAt: Date.now(),
          })
          toast.error(message)
        }
      } finally {
        // 尾帧 seek 后尽量还原播放位置，避免打断用户预览
        if (mode === 'tail' && Number.isFinite(previousTime)) {
          try {
            video.currentTime = previousTime
          } catch {
            /* ignore */
          }
        }
        setCapturingFrame(false)
      }
    },
    [
      appendCanvasGraph,
      capturingFrame,
      nodeData.aspectRatio,
      nodes,
      previewSrc,
      projectId,
      running,
      selfNode?.position.x,
      selfNode?.position.y,
      updateNodeData,
      uploading,
      videoDisplayName.label,
    ],
  )

  useEffect(() => {
    if (!videoExtractAudioRequest || videoExtractAudioRequest.nodeId !== id) return
    if (lastExtractAudioRequestNonceRef.current === videoExtractAudioRequest.nonce) return
    lastExtractAudioRequestNonceRef.current = videoExtractAudioRequest.nonce
    if (extractAudioAvailability.available) {
      setExtractAudioDialogOpen(true)
      return
    }
    toast.error(extractAudioAvailability.disabledReason ?? '无法提取音频')
  }, [
    extractAudioAvailability.available,
    extractAudioAvailability.disabledReason,
    id,
    videoExtractAudioRequest,
  ])

  const handleExtracted = useCallback(
    (result: ExtractAudioFromProjectResult, meta: CanvasVideoExtractAudioExtractedMeta) => {
      const audioNodeData = buildCanvasAudioNodeDataFromExtract(result, meta, {
        videoNodeId: id,
        videoLabel: videoDisplayName.label,
        canvasProjectId: projectId,
      })
      if (!audioNodeData) return

      const preview = resolveCanvasVideoPreviewDimensions(nodeData.aspectRatio)
      addCanvasNode(
        CANVAS_NODE_TYPES.audioNode,
        {
          x: (selfNode?.position.x ?? 0) + preview.width + CANVAS_GRAPH_NODE_GAP_X,
          y: selfNode?.position.y ?? 0,
        },
        null,
        audioNodeData,
      )
      toast.success('已创建音频节点')
    },
    [
      addCanvasNode,
      id,
      nodeData.aspectRatio,
      projectId,
      selfNode?.position.x,
      selfNode?.position.y,
      videoDisplayName.label,
    ],
  )

  return (
    <div
      ref={nodeRootRef}
      data-testid={`canvas-node-${id}`}
      data-video-busy={running ? 'true' : 'false'}
      className="relative overflow-visible"
      style={{ width: previewWidth }}
      onContextMenu={handleContextMenu}
    >
      <CanvasNodeContextMenu
        anchor={contextMenuAnchor}
        title="视频 → 操作"
        onClose={() => setContextMenuAnchor(null)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => {
          closeVideoConsole()
          deleteNode(id)
        }}
        extraItems={[
          {
            label: '导出音频',
            icon: AudioLines,
            disabled: !extractAudioAvailability.available,
            title: extractAudioTitle,
            onClick: handleOpenExtractAudio,
          },
        ]}
      />
      <div
        className={CANVAS_MEDIA_NODE_HEADER_ROW_CLASS}
        style={{ width: previewWidth }}
      >
        <CanvasMediaNodeTypeLabel icon={VideoIcon} iconTitle="视频" />
        {!showConsole ? (
          storyboardShotNumber != null ? (
            <p
              className={cn(
                'min-w-0 flex-1 truncate text-[13px] font-medium leading-none',
                CANVAS_VIDEO_DEFAULT_NAME_COLOR,
              )}
              title={
                running
                  ? `${storyboardShotTitle}（点击预览区可查看完整提示词）`
                  : storyboardShotTitle
              }
            >
              {storyboardShotTitle}
            </p>
          ) : (
            <CanvasImageNameEditor
              value={videoDisplayName.nickname}
              fixedPrefix={videoDisplayName.rolePrefix}
              fixedPrefixColorClass={videoDisplayName.colorClass}
              colorClass={videoDisplayName.colorClass}
              onSave={handleSaveVideoName}
              placement="above"
              placeholder="视频名称"
              className="min-w-0 flex-1 justify-start"
            />
          )
        ) : null}
      </div>

      <div className="relative z-0" style={{ width: previewWidth }}>
          {showConsole ? (
            <div
              className="nodrag nopan pointer-events-none absolute z-40"
              style={{
                width: CONSOLE_WIDTH_PX,
                ...CANVAS_NODE_TOP_TOOLBAR_ANCHOR_STYLE,
              }}
            >
              <div className="pointer-events-auto">
                <CanvasVideoTopToolbar
                  previewSrc={previewSrc}
                  running={running}
                  uploading={uploading}
                  capturingFrame={capturingFrame}
                  revealingFolder={revealingFolder}
                  onUpload={() => void handleUploadVideo()}
                  onRevealFolder={() => void handleRevealFolder()}
                  onCaptureFrame={() => void handleCaptureFrame('current')}
                  onCaptureLastFrame={() => void handleCaptureFrame('tail')}
                  onExtractAudio={handleOpenExtractAudio}
                  extractAudioDisabled={!extractAudioAvailability.available}
                  extractAudioTitle={extractAudioTitle}
                />
              </div>
            </div>
          ) : null}
          <div
            role={videoControlsActive ? undefined : 'button'}
            tabIndex={videoControlsActive ? undefined : 0}
            onClick={handleVideoClick}
            onPointerDown={handleVideoPointerDown}
            onKeyDown={
              videoControlsActive
                ? undefined
                : (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      if (running) {
                        if (showConsole) closeVideoConsole()
                        else openConsole()
                        return
                      }
                      if (!hasVideo) openConsole()
                      else toggleConsoleFromVideo()
                    }
                  }
            }
            onMouseEnter={() => setVideoHovered(true)}
            onMouseLeave={() => setVideoHovered(false)}
            className={cn(
              'group/video relative z-[1] block w-full shrink-0 cursor-pointer transition-[box-shadow,ring-color] duration-300',
              videoElementLoad.displaySrc ? 'bg-black' : 'bg-muted/30 dark:bg-[#12131a]',
              CANVAS_NODE_PREVIEW_FRAME,
              CANVAS_NODE_PREVIEW_HOVER_BORDER,
              running &&
                'ring-2 ring-cyan-400/50 shadow-[0_0_0_1px_rgba(34,211,238,0.25),0_0_28px_rgba(34,211,238,0.18)]',
            )}
            style={frameStyle}
          >
            {videoElementLoad.displaySrc ? (
              <video
                key={videoElementLoad.displaySrc}
                ref={inlineVideoRef}
                src={videoElementLoad.displaySrc}
                controls={Boolean(videoElementLoad.displaySrc)}
                playsInline
                preload={hasLocalVideoOutput ? 'metadata' : 'auto'}
                disablePictureInPicture
                controlsList="nofullscreen noremoteplayback nodownload"
                className={cn(
                  'canvas-node-inline-video relative z-[2] block h-full w-full max-w-full bg-black object-contain object-center transition-opacity duration-200',
                  inlineVideoReady ? 'opacity-100' : 'opacity-0',
                  !videoElementLoad.displaySrc && 'pointer-events-none',
                )}
                onLoadedMetadata={(event) => {
                  handleInlineVideoMetadata(event)
                  // 元数据就绪即可放行名额；首帧显示仍等 loadeddata
                  videoElementLoad.markReady()
                }}
                onLoadedData={(event) => {
                  setInlineVideoReady(true)
                  videoElementLoad.markReady()
                  void cachePosterFromVideoEl(event.currentTarget)
                }}
                onCanPlay={(event) => {
                  setInlineVideoReady(true)
                  videoElementLoad.markReady()
                  void cachePosterFromVideoEl(event.currentTarget)
                }}
                onError={() => {
                  videoElementLoad.markError('视频预览加载失败')
                }}
                onPointerDown={(event) => {
                  if (!previewSrc) return
                  if (isInlineVideoControlBarClick(event)) {
                    event.stopPropagation()
                  }
                }}
                onClick={handleInlineVideoClick}
                onDoubleClick={(event) => {
                  if (!showConsole) return
                  event.preventDefault()
                  event.stopPropagation()
                  openVideoPreview()
                }}
              />
            ) : (
              <CanvasMediaNodeVideoPlaceholder
                posterSrc={posterSrc || undefined}
                hint={
                  showDeferredViewportPlaceholder && !posterSrc
                    ? '靠近可视区域后加载'
                    : undefined
                }
              />
            )}

            {showMissingOverlay ? <CanvasMediaNodeMissingOverlay mediaKind="video" /> : null}
            {showVideoLoadOverlay && videoLoadOverlayPhase ? (
              <CanvasMediaNodeVideoLoadOverlay phase={videoLoadOverlayPhase} />
            ) : null}
            {showVideoLoadErrorOverlay ? (
              <CanvasMediaNodeVideoLoadErrorOverlay
                message={videoElementLoad.errorMessage}
                onRetry={videoElementLoad.retry}
              />
            ) : null}

            {showStoryboardNeedsRegenBadge ? (
              <span className="pointer-events-none absolute left-2 top-2 z-[12] rounded-md border border-amber-400/40 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium leading-none text-amber-200">
                待更新
              </span>
            ) : null}

            {previewSrc ? (
              <CanvasVideoCornerActions
                previewSrc={previewSrc}
                capcutStoredPath={capcutStoredPath}
                capcutProjectRoot={capcutProjectRoot}
                capcutFilename={capcutFilename}
                running={running}
                uploading={uploading}
                revealingFolder={revealingFolder}
                visible={videoHovered && !running}
                onPreview={openVideoPreview}
                onDelete={handleDeleteVideo}
                onRevealFolder={() => void handleRevealFolder()}
                onExtractAudio={handleOpenExtractAudio}
                extractAudioDisabled={!extractAudioAvailability.available}
                extractAudioTitle={extractAudioTitle}
              />
            ) : null}

            {previewSrc && !showConsole && !running ? (
              <div className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/video:bg-black/10" />
            ) : null}

            {running ? (
              <CanvasVideoGeneratingOverlay
                message={resolveRunningVideoProgressMessageForUi(nodeData.progressMessage)}
                cancelTestId={`canvas-node-${id}-cancel-video-generating`}
                onCancel={handleCancelGeneration}
              />
            ) : null}

            {!running && showRetryDownloadOverlay ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[22] flex justify-center px-2">
                <button
                  type="button"
                  data-testid={`canvas-node-${id}-retry-video-download`}
                  title="重新下载成片（无需重新生成）"
                  className={cn(
                    'nodrag nopan pointer-events-auto inline-flex h-8 items-center justify-center rounded-full px-3',
                    'border border-sky-400/45 bg-sky-500/90 text-[12px] font-medium text-white',
                    'shadow-sm transition-colors hover:bg-sky-400',
                  )}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    handleRetryDownload()
                  }}
                >
                  重新下载
                </button>
              </div>
            ) : null}
          </div>

          <CanvasNodeConnector side="left" anchored onQuickAdd={handleConnectorAdd} />
          <CanvasNodeConnector side="right" anchored onQuickAdd={handleConnectorAdd} />

          {showConsole ? (
            <div
              className="nodrag nopan pointer-events-none absolute z-30"
              style={{
                width: CONSOLE_WIDTH_PX,
                ...CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE,
              }}
            >
              <div
                className={cn(
                  CANVAS_NODE_CONSOLE,
                  'pointer-events-auto flex flex-col px-3.5 pt-3 pb-2.5 !overflow-visible',
                )}
                onPointerDown={(event) => event.stopPropagation()}
              >
              <CanvasVideoReferenceBar
                assets={upstreamAssets}
                mentionAssets={promptMentionAssets}
                canvasProjectId={projectId}
                autoMentionEnabled={autoMentionEnabled}
                onAutoMentionChange={handleAutoMentionChange}
                onUploadReference={() => void handleUploadConsoleReference()}
                onRemoveUpload={handleRemoveConsoleReference}
                onExpandPrompt={() => setPromptExpandOpen(true)}
                embedded
                disabled={running}
              />

              {displaySpatialAnchor ? (
                <div
                  className="mb-2 rounded-lg border border-border/25 bg-background/40 px-2.5 py-1.5 dark:border-white/8 dark:bg-black/20"
                  data-testid={`canvas-node-${id}-spatial-anchor`}
                >
                  <p className="text-[10px] font-medium text-muted-foreground dark:text-white/40">
                    空间锚点（只读）
                  </p>
                  <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground dark:text-white/55">
                    {displaySpatialAnchor}
                  </p>
                </div>
              ) : null}

              <div
                className="nowheel nodrag nopan min-h-0"
                onPointerDown={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
              >
                <MentionTextarea
                  value={displayPrompt}
                  onChange={handlePromptChange}
                  candidates={assetMentionCandidates}
                  canvasProjectId={projectId}
                  embedded
                  tone="canvas"
                  rows={3}
                  scrollBoxHeight={168}
                  maxHeight={168}
                  disabled={running}
                  emptyHint="输入 @ 可引用已标记的人物/场景/道具"
                  placeholder={
                    upstreamPrompt
                      ? upstreamPrompt
                      : '根据图片生成视频（可选补充描述）…'
                  }
                  className="border-0 bg-transparent px-0 py-0 text-[14px] leading-relaxed"
                />
              </div>

              <div
                className="mt-2 flex shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-visible pt-1 nodrag nopan"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <div className="flex min-w-0 flex-1 items-center gap-0.5">
                  {modelOptions.length ? (
                    <Select
                      value={activeModelId}
                      onChange={handleModelChange}
                      options={modelOptions}
                      placeholder="模型"
                      compactMenu
                      hideSuffixInTrigger
                      hideSuffixInMenu
                      disabled={running}
                      className={cn(compactSelectClass, '!w-[120px]')}
                      title="视频模型"
                    />
                  ) : (
                    <span className="px-1 text-[11px] text-red-400">请配置模型</span>
                  )}

                  <CanvasVideoParamsPopover
                    aspectRatio={consoleAspectRatio}
                    aspectOptions={aspectOptions}
                    onAspectRatioChange={handleAspectRatioChange}
                    resolution={resolutionValue}
                    resolutionOptions={resolutionOptions}
                    showResolution={showVideoResolutionSelector}
                    onResolutionChange={handleResolutionChange}
                    durationSec={Number(durationValue) || 5}
                    durationOptions={durationOptions}
                    onDurationChange={handleDurationChange}
                    referenceMode={referenceMode}
                    referenceModeOptions={referenceModeOptions}
                    onReferenceModeChange={handleReferenceModeChange}
                    consoleAuxId={id}
                  />
                </div>

                <CanvasGeneratePill
                  testId={`canvas-node-${id}-generate-video`}
                  running={running}
                  disabled={!modelOptions.length || running}
                  showGenerateCost={false}
                  generateCost={null}
                  generateCostLoading={videoCostLoading}
                  className="h-8 gap-1 px-3"
                  onClick={handleRun}
                />
                {running ? (
                  <button
                    type="button"
                    data-testid={`canvas-node-${id}-stop-video`}
                    title="停止生视频"
                    aria-label="停止生视频"
                    onClick={(event) => {
                      event.stopPropagation()
                      stopNode(id)
                    }}
                    className="nodrag nopan inline-flex h-8 shrink-0 items-center justify-center rounded-full border border-red-500/35 bg-red-500/10 px-3 text-xs font-medium text-red-400 hover:bg-red-500/15"
                  >
                    停止
                  </button>
                ) : null}
              </div>

              {nodeData.error ? (
                <div className="mt-2 space-y-1.5">
                  <p
                    data-testid={`canvas-node-${id}-video-error`}
                    className="text-[11px] leading-relaxed text-red-400"
                  >
                    {nodeData.error}
                  </p>
                  {canRetryDownload ? (
                    <button
                      type="button"
                      data-testid={`canvas-node-${id}-retry-video-download-console`}
                      className="nodrag nopan inline-flex h-7 items-center rounded-md border border-sky-500/35 bg-sky-500/10 px-2.5 text-[11px] font-medium text-sky-300 hover:bg-sky-500/15"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRetryDownload()
                      }}
                    >
                      重新下载成片
                    </button>
                  ) : null}
                </div>
              ) : null}
              </div>
            </div>
          ) : null}
      </div>

      {showGenerationElapsed ? (
        <div
          className="pointer-events-none mt-0.5 flex h-[14px] w-full shrink-0 items-center justify-end"
          style={{ width: previewWidth }}
          title={running ? '生视频已用时间' : '生视频耗时'}
        >
          <span className="shrink-0 text-[11px] leading-none tabular-nums text-muted-foreground/70 dark:text-white/35">
            {generationElapsedLabel}
          </span>
        </div>
      ) : null}

      <CanvasVideoPreviewDialog
        open={previewOpen}
        src={previewSrc || ''}
        initialTime={previewInitialTime}
        onClose={closeVideoPreview}
      />

      <CanvasVideoExtractAudioDialog
        open={extractAudioDialogOpen}
        onClose={() => setExtractAudioDialogOpen(false)}
        projectId={projectId}
        videoPath={String(nodeData.outputPath || '').trim()}
        videoLabel={videoDisplayName.label}
        onExtracted={handleExtracted}
      />

      <CanvasVideoPromptExpandDialog
        open={promptExpandOpen}
        value={displayPrompt}
        spatialAnchor={displaySpatialAnchor || undefined}
        placeholder={
          upstreamPrompt ? upstreamPrompt : '根据图片生成视频（可选补充描述）…'
        }
        emptyHint="输入 @ 可引用已标记的人物/场景/道具资产"
        candidates={assetMentionCandidates}
        canvasProjectId={projectId}
        onChange={handlePromptChange}
        onClose={() => setPromptExpandOpen(false)}
        referenceAssets={upstreamAssets}
        mentionAssets={promptMentionAssets}
        autoMentionEnabled={autoMentionEnabled}
        onAutoMentionChange={handleAutoMentionChange}
        onUploadReference={() => void handleUploadConsoleReference()}
        onRemoveUpload={handleRemoveConsoleReference}
        footer={{
          referenceMode,
          referenceModeOptions,
          onReferenceModeChange: handleReferenceModeChange,
          modelId: activeModelId,
          modelOptions,
          onModelChange: handleModelChange,
          durationValue,
          durationOptions,
          onDurationChange: handleDurationChange,
          aspectRatio: consoleAspectRatio,
          aspectOptions,
          onAspectRatioChange: handleAspectRatioChange,
          resolutionValue,
          resolutionOptions,
          showResolution: showVideoResolutionSelector,
          onResolutionChange: handleResolutionChange,
          generateTestId: `canvas-node-${id}-generate-video-expand`,
          running,
          generateDisabled: !modelOptions.length,
          showGenerateCost: false,
          generateCost: null,
          generateCostLoading: videoCostLoading,
          onGenerate: handleRun,
          onStop: () => stopNode(id),
        }}
      />

    </div>
  )
}

export const CanvasVideoNode = memo(CanvasVideoNodeComponent)
