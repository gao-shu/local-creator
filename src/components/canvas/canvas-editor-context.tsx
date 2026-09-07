// Copyright (c) Haode AI. All rights reserved.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type OnMove,
  type Viewport,
} from '@xyflow/react'
import { toast } from 'sonner'
import type { CanvasAddNodeAnchor } from '@/components/canvas/canvas-add-node-menu'
import type { CanvasProjectData, CanvasProjectSettings } from '@/types/canvas'
import { normalizeCanvasProjectSettings } from '@/lib/canvas/canvas-project-settings'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type { CanvasVideoNodeData } from '@/types/canvas-nodes'
import { prepareCanvasVideoGeneratePreview } from '@/lib/canvas/canvas-video-generate-preview'
import { runCanvasBatchVideoGenerate } from '@/lib/canvas/canvas-batch-video-generate'
import { isPendingCanvasVideoNode } from '@/lib/canvas/canvas-shot-utils'
import { VIDEO_BATCH_CONCURRENCY } from '@/constants/batch-concurrency'
import type { WeishiVideoReferenceItem } from '@/lib/models/weishi-video-client'
import type { WeishiVideoRequestPreview } from '@/lib/models/weishi-video-client'
import { useSettingsStore } from '@/stores/settings-store'
import { useCanvasProjectStore } from '@/stores/canvas-project-store'
import {
  appendConnectedNodeEdge,
  createConnectedCanvasNode,
  type CanvasAddNodeConnection,
} from '@/lib/canvas/canvas-add-node-connection'
import {
  canRunCanvasNode,
  runCanvasNode,
  type CanvasRunOptions,
} from '@/lib/canvas/canvas-run-service'
import { cloneCanvasSelection, cloneSingleCanvasNode, deselectAllNodes } from '@/lib/canvas/canvas-clipboard'
import {
  resolveCanvasPasteFromSystemClipboard,
  resolveCanvasPasteVideoSource,
  type CanvasPasteImageSource,
  type CanvasPasteVideoSource,
} from '@/lib/canvas/canvas-paste-video'
import {
  saveCanvasGeneratedImage,
  saveCanvasGeneratedVideo,
  saveCanvasUploadedImageFromDataUrl,
  saveCanvasUploadedImageFromFile,
  saveCanvasUploadedVideoFromFile,
} from '@/lib/canvas/canvas-media-save'
import {
  collectCanvasDroppedMedia,
  collectCanvasDroppedScripts,
  deriveMediaBaseName,
  readDroppedImageDataUrl,
  resolveCanvasDropNodePosition,
} from '@/lib/canvas/canvas-file-drop'
import {
  CANVAS_PROMPT_TEXT_MAX_LENGTH,
  importCanvasPromptTextFromFile,
} from '@/lib/canvas/canvas-prompt-text-import'
import { looksLikeStoryboardTemplate } from '@/lib/canvas/canvas-storyboard-template-parse'
import { resolveCanvasVideoImportAspectRatio } from '@/lib/canvas/canvas-video-aspect-probe'
import { readSettings } from '@/lib/storage/settings-service'
import { CANVAS_CONSOLE_ELEVATED_Z_INDEX, isCanvasConsoleElevatedZIndex } from '@/lib/canvas/canvas-console-layout'
import { createCanvasNode } from '@/lib/canvas/canvas-node-factory'
import { expandNodeRemovals, getNodeDisplayLabel, wrapNodesInGroup } from '@/lib/canvas/canvas-group-utils'
import { collectBusyCanvasNodeLabels } from '@/lib/canvas/canvas-data-persist'
import {
  collectStoryboardShotNumbersFromNodes,
  formatDeletedStoryboardShotsToast,
  formatStoryboardVideoGeneratedToast,
  formatStoryboardVideoFailedToast,
  formatBatchStoryboardVideoToast,
} from '@/lib/canvas/canvas-shot-utils'

/** 展开控制台时沿 parentId 链整组置顶（子节点 zIndex 无法越过父分组） */
function resolveConsoleElevationIds(nodes: Node[], consoleNodeId: string | null): Set<string> {
  const ids = new Set<string>()
  if (!consoleNodeId) return ids
  let walk: string | undefined = consoleNodeId
  while (walk) {
    ids.add(walk)
    walk = nodes.find((node) => node.id === walk)?.parentId
  }
  return ids
}

function defaultCanvasNodeZIndex(node: Node): number {
  if (node.type === CANVAS_NODE_TYPES.group) return 0
  if (node.parentId) return 1
  return 0
}
import {
  assignDefaultImageNodeData,
  collectCanvasImageNodeNames,
  generateCanvasDefaultImageName,
} from '@/lib/canvas/canvas-image-role'
import {
  assignDefaultVideoNodeData,
  backfillCanvasVideoNodeNames,
  collectCanvasVideoNodeNames,
  formatCanvasVideoNodeName,
  generateCanvasDefaultVideoName,
} from '@/lib/canvas/canvas-video-naming'
import { backfillCanvasImageNodeShellLayout } from '@/lib/canvas/canvas-image-node-layout'
import { backfillCanvasStoryVideoNodeHitbox } from '@/lib/canvas/canvas-graph-layout'
import {
  canvasVideoProjectParamsToNodePatch,
  forceCanvasVideoNodeParamsForGenerate,
  normalizeCanvasVideoProjectParams,
  persistCanvasVideoParamsToSettings,
  resolveCanvasVideoParamsFromSettings,
  resolveInitialCanvasVideoProjectParams,
  syncVideoNodesWithProjectParams,
  type CanvasVideoNodeParamsPatch,
  type CanvasVideoProjectParams,
} from '@/lib/canvas/canvas-video-params-sync'
import { assignDefaultPromptNodeData, backfillCanvasPromptNodeLabels } from '@/lib/canvas/canvas-prompt-naming'
import type { PromptAiBusyState } from '@/lib/canvas/canvas-prompt-ai-actions'
import { cloneCanvasGraph, isSameCanvasGraph } from '@/components/canvas/canvas-viewport-toolbar'
import { pickCanvasCoverFromNodes, syncCanvasProjectCover } from '@/lib/canvas/canvas-cover-utils'
import {
  buildCanvasNodePatchFromMaterialItem,
  buildCanvasNodesFromMaterialItems,
  createCanvasMaterialLibraryRequest,
  mapCanvasRoleToAssetKind,
  resolveCanvasMaterialImportAnchor,
  type CanvasMaterialLibraryRequest,
} from '@/lib/canvas/canvas-material-import'
import { CanvasMaterialLibraryHost } from '@/components/canvas/canvas-material-library-host'
import type { MaterialLibraryItem } from '@/lib/materials/material-library-service'
import {
  CANVAS_EDGE_HANDLE_LEFT,
  CANVAS_EDGE_HANDLE_RIGHT,
  normalizeCanvasEdges,
} from '@/lib/canvas/canvas-edge-utils'
import { hasCanvasConnectionPair } from '@/lib/canvas/canvas-frame-connect'
import {
  CANVAS_VOICE_BIND_ONLY_FROM_CHARACTER,
  isCanvasVoiceAwareConnectionAllowed,
  resolveCanvasConnectionEndpoints,
} from '@/lib/canvas/canvas-voice-binding'
import {
  formatCanvasAgentReferenceToast,
  getSelectedCanvasNodes,
  isCanvasAgentSkillReferenceNode,
  isCanvasAgentTargetNode,
  resolveCanvasAgentNodeTypeLabel,
  summarizeCanvasAgentNode,
} from '@/lib/canvas/canvas-agent-service'
import type { CanvasAgentSkillId } from '@/lib/canvas/canvas-agent-types'
import {
  cancelCanvasInflightRun,
  hasCanvasInflightRun,
  listCanvasInflightRuns,
  registerCanvasInflightRun,
} from '@/lib/canvas/canvas-inflight-run-service'
import { isVideoGenerationAbortError } from '@/lib/video/video-generation-abort'
import {
  formatVideoContentDownloadErrorMessage,
  isVideoContentDownloadError,
} from '@/lib/video/video-content-download'
import {
  finishCanvasVideoTask,
  listResumableCanvasVideoNodesFromGraph,
  persistCanvasVideoRemoteJob,
  reconcileStaleCanvasVideoTasks,
  updateCanvasVideoTaskProgress,
} from '@/lib/canvas/canvas-video-task-service'
import { buildPersistedCanvasRemoteJob, isCanvasVideoNodeResumable } from '@/lib/canvas/canvas-video-resume-service'
import { hasCanvasVideoLocalOutput, normalizeStuckCanvasVideoNodes } from '@/lib/canvas/canvas-video-drag-items'
import {
  buildCanvasVideoGenerationElapsedPatch,
  buildCanvasVideoGenerationStartPatch,
} from '@/lib/canvas/canvas-generation-elapsed'
import { resumeCanvasVideoIfNeeded } from '@/lib/video/video-background-resume-service'
import { hasVideoResumeLock, releaseVideoResumeLock } from '@/lib/video/video-resume-session-lock'
import { isCanvasNodeRuntimeBusy } from '@/lib/canvas/canvas-data-persist'
import {
  finishCanvasNodeRunAttempt,
  startCanvasNodeRunAttempt,
  updateCanvasNodeRunAttempt,
  reconcileStaleCanvasRunHistory,
  failRunningCanvasRunHistoryForNode,
  applyCanvasRunHistoryNodeSync,
  releaseCanvasNodeRunSession,
} from '@/lib/canvas/canvas-run-history-service'
import {
  isMisleadingVideoPrepProgressMessage,
  VIDEO_PROGRESS_DOWNLOADING,
  VIDEO_PROGRESS_REOPEN_PLACEHOLDER,
} from '@/lib/video/video-progress'
import { useTaskStore } from '@/stores/task-store'
import {
  getCanvasProjectRunBridge,
  patchCanvasNodeData,
  patchCanvasNodeDataPersisted,
  registerCanvasProjectRunBridge,
} from '@/lib/canvas/canvas-project-run-bridge'
import {
  cancelActiveCanvasPromptAi,
  getInflightCanvasPromptAiTask,
  reconcileStaleCanvasPromptAiTasks,
  resolveCanvasPromptAiBusyState,
} from '@/lib/canvas/canvas-prompt-ai-task-service'
import { isCanvasApiAvailable, readCanvasData, readCanvasTasks } from '@/lib/storage/canvas-service'

const AUTOSAVE_MS = 1200

interface CanvasEditorContextValue {
  projectId: string
  nodes: Node[]
  edges: Edge[]
  setNodes: ReturnType<typeof useNodesState<Node>>[1]
  setEdges: ReturnType<typeof useEdgesState>[1]
  onNodesChange: ReturnType<typeof useNodesState<Node>>[2]
  onEdgesChange: ReturnType<typeof useEdgesState>[2]
  onConnect: (connection: Connection) => void
  isValidConnection: (connection: Connection | Edge) => boolean
  applyFrameSnapConnection: (
    connection: Connection,
    options?: { replace?: { source: string; target: string } },
  ) => void
  onMoveEnd: OnMove
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void
  /** 软件级视频参数（settings.lastUsedStoryboardVideo*，与工坊 Step4 共用） */
  canvasVideoParams: CanvasVideoProjectParams
  /** 更新画布视频参数并同步到全部视频节点 */
  updateCanvasVideoParams: (patch: Partial<CanvasVideoNodeParamsPatch>) => void
  /** @deprecated 请使用 updateCanvasVideoParams */
  applyCanvasVideoParamsToAllNodes: (patch?: Partial<CanvasVideoNodeParamsPatch>) => void
  runNode: (nodeId: string, options?: CanvasRunOptions & { silent?: boolean }) => Promise<void>
  /** 远端成片已出、本地落盘失败时仅重试下载 */
  retryVideoDownload: (nodeId: string) => Promise<boolean>
  /** 批量生成分镜视频（含 debug 微视确认后接续） */
  requestBatchStoryboardVideos: (nodeIds: string[]) => Promise<void>
  batchVideoGenerating: boolean
  stopNode: (nodeId: string) => boolean
  pasteFromClipboard: (position?: { x: number; y: number }) => Promise<void>
  pasteVideoAtPosition: (position: { x: number; y: number }) => Promise<void>
  importDroppedFilesAtPosition: (
    position: { x: number; y: number },
    dataTransfer: DataTransfer,
  ) => Promise<void>
  copySelection: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  isNodeRunning: (nodeId: string) => boolean
  /** 取消 inflight 并清除节点「进行中」UI 标记（与队列失败同步时用） */
  releaseNodeRunSession: (nodeId: string) => void
  hasRunningNodes: boolean
  flushPersist: () => void | Promise<void>
  imageConsoleNodeId: string | null
  openImageConsole: (nodeId: string) => void
  closeImageConsole: () => void
  promptConsoleNodeId: string | null
  openPromptConsole: (nodeId: string) => void
  closePromptConsole: () => void
  activatePromptConsole: (nodeId: string, options?: { toggleIfOpen?: boolean }) => void
  videoConsoleNodeId: string | null
  openVideoConsole: (nodeId: string) => void
  closeVideoConsole: () => void
  activateVideoConsole: (nodeId: string, options?: { toggleIfOpen?: boolean }) => void
  /** 请求打开指定视频节点的「导出音频」弹窗（添加节点菜单等入口） */
  videoExtractAudioRequest: { nodeId: string; nonce: number } | null
  requestVideoExtractAudio: (nodeId: string) => void
  addNodeMenuAnchor: CanvasAddNodeAnchor | null
  openAddNodeMenu: (anchor: CanvasAddNodeAnchor) => void
  closeAddNodeMenu: () => void
  addCanvasNode: (
    type: string,
    position: { x: number; y: number },
    connection?: CanvasAddNodeConnection | null,
    data?: Record<string, unknown>,
  ) => void
  appendCanvasGraph: (newNodes: Node[], newEdges: Edge[]) => void
  duplicateNode: (nodeId: string) => void
  deleteNode: (nodeId: string) => void
  removeNodesByIds: (nodeIds: string[], options?: { silent?: boolean }) => void
  deleteSelectedNodes: () => void
  pendingDeleteConfirm: {
    count: number
    labels: string[]
    hasRunning: boolean
    storyboardShotNumbers: number[]
  } | null
  confirmPendingDelete: () => void
  cancelPendingDelete: () => void
  groupSelectedNodes: () => void
  removeEdge: (edgeId: string) => void
  clearCanvas: () => void
  addMaterialLibraryItems: (items: MaterialLibraryItem[]) => void
  openMaterialLibrary: (request: CanvasMaterialLibraryRequest) => void
  openMaterialLibraryForNode: (
    nodeId: string,
    nodeType: string,
    defaultKind?: CanvasImageAssetRole,
  ) => void
  closeMaterialLibrary: () => void
  pendingWeishiVideo: {
    nodeId: string
    preview: WeishiVideoRequestPreview
  } | null
  weishiPreviewPreparing: boolean
  weishiPreviewNodeId: string | null
  confirmWeishiVideo: () => void
  cancelWeishiVideo: () => void
  /** 画布助手面板是否打开 */
  agentPanelOpen: boolean
  setAgentPanelOpen: (open: boolean) => void
  /** 助手对话引用的节点 id（点击画布节点加入） */
  agentReferencedNodeIds: string[]
  /** Chat 模式为 false，不响应点击/框选引用 */
  agentReferenceEnabled: boolean
  setAgentReferenceEnabled: (enabled: boolean) => void
  /** 改图 / 改视频 Skill；Chat 或未打开助手时为 null */
  agentSkillMode: CanvasAgentSkillId | null
  setAgentSkillMode: (skill: CanvasAgentSkillId | null) => void
  toggleAgentReference: (nodeId: string, additive?: boolean) => void
  removeAgentReference: (nodeId: string) => void
  clearAgentReferences: () => void
  /** 文本节点「提取资产 / 智能分镜」进行中（全局互斥） */
  promptAiBusy: PromptAiBusyState | null
  setPromptAiBusy: (busy: PromptAiBusyState | null) => void
  /** 取消进行中的智能分镜 / 提取资产：abort + 禁止落盘，并立即清 busy */
  cancelPromptAi: () => Promise<boolean>
}

const CanvasEditorContext = createContext<CanvasEditorContextValue | null>(null)

export function useCanvasEditor() {
  const ctx = useContext(CanvasEditorContext)
  if (!ctx) {
    throw new Error('useCanvasEditor must be used within CanvasEditorProvider')
  }
  return ctx
}

interface CanvasEditorProviderProps {
  projectId: string
  initialData: CanvasProjectData
  onPersist: (data: CanvasProjectData) => void | Promise<void>
  coverManual?: boolean
  children: ReactNode
}

export function CanvasEditorProvider({
  projectId,
  initialData,
  onPersist,
  coverManual = false,
  children,
}: CanvasEditorProviderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    normalizeStuckCanvasVideoNodes(initialData.nodes),
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(normalizeCanvasEdges(initialData.edges))
  const [canvasProjectSettings, setCanvasProjectSettings] = useState(() =>
    normalizeCanvasProjectSettings(initialData.settings),
  )
  const [runningNodeIds, setRunningNodeIds] = useState<ReadonlySet<string>>(() => new Set())
  const runningNodeIdsRef = useRef<Set<string>>(new Set())
  const nodeAbortControllersRef = useRef(new Map<string, AbortController>())
  const [imageConsoleNodeId, setImageConsoleNodeId] = useState<string | null>(null)
  const [promptConsoleNodeId, setPromptConsoleNodeId] = useState<string | null>(null)
  const [videoConsoleNodeId, setVideoConsoleNodeId] = useState<string | null>(null)
  const [videoExtractAudioRequest, setVideoExtractAudioRequest] = useState<{
    nodeId: string
    nonce: number
  } | null>(null)
  const [addNodeMenuAnchor, setAddNodeMenuAnchor] = useState<CanvasAddNodeAnchor | null>(null)
  const [promptAiBusy, setPromptAiBusy] = useState<PromptAiBusyState | null>(null)
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null)
  const viewportRef = useRef<Viewport>(initialData.viewport)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  const canvasProjectSettingsRef = useRef(canvasProjectSettings)
  const saveTimerRef = useRef<number | null>(null)
  const persistRef = useRef(onPersist)
  const lastCoverRef = useRef<string | undefined>()
  const coverManualRef = useRef(coverManual)
  const historyPastRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const historyFutureRef = useRef<{ nodes: Node[]; edges: Edge[] }[]>([])
  const applyingHistoryRef = useRef(false)
  const historyReadyRef = useRef(false)
  const historyDebounceTimerRef = useRef<number | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [materialLibraryOpen, setMaterialLibraryOpen] = useState(false)
  const [materialLibraryRequest, setMaterialLibraryRequest] =
    useState<CanvasMaterialLibraryRequest | null>(null)
  const [pendingWeishiVideo, setPendingWeishiVideo] = useState<{
    nodeId: string
    options?: CanvasRunOptions & { silent?: boolean }
    preview: WeishiVideoRequestPreview
    preparedReferences: WeishiVideoReferenceItem[]
    batchNodeIds?: string[]
  } | null>(null)
  const [batchVideoGenerating, setBatchVideoGenerating] = useState(false)
  const batchVideoGeneratingRef = useRef(false)
  const [weishiPreviewPreparing, setWeishiPreviewPreparing] = useState(false)
  const [weishiPreviewNodeId, setWeishiPreviewNodeId] = useState<string | null>(null)
  const [agentPanelOpen, setAgentPanelOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{
    removeIds: string[]
    labels: string[]
    hasRunning: boolean
    storyboardShotNumbers: number[]
  } | null>(null)
  const [agentReferencedNodeIds, setAgentReferencedNodeIds] = useState<string[]>([])
  const [agentReferenceEnabled, setAgentReferenceEnabledState] = useState(true)
  const [agentSkillMode, setAgentSkillModeState] = useState<CanvasAgentSkillId | null>(null)
  const agentReferencedNodeIdsRef = useRef<string[]>([])
  const agentSkillModeRef = useRef<CanvasAgentSkillId | null>(null)
  const initialCanvasVideoParams = useMemo(
    () =>
      resolveInitialCanvasVideoProjectParams(
        useSettingsStore.getState().settings,
        useSettingsStore.getState().getMergedModels('video'),
      ),
    [],
  )
  const [canvasVideoParams, setCanvasVideoParams] =
    useState<CanvasVideoProjectParams>(initialCanvasVideoParams)
  const canvasVideoParamsRef = useRef(initialCanvasVideoParams)

  useEffect(() => {
    canvasVideoParamsRef.current = canvasVideoParams
  }, [canvasVideoParams])

  useEffect(() => {
    agentReferencedNodeIdsRef.current = agentReferencedNodeIds
  }, [agentReferencedNodeIds])

  useEffect(() => {
    agentSkillModeRef.current = agentSkillMode
  }, [agentSkillMode])

  const setAgentSkillMode = useCallback((skill: CanvasAgentSkillId | null) => {
    agentSkillModeRef.current = skill
    setAgentSkillModeState(skill)
  }, [])

  const resolveAgentReferenceNodes = useCallback((nodesList: Node[]) => {
    const skill = agentSkillModeRef.current
    if (!skill) return getSelectedCanvasNodes(nodesList)
    return nodesList.filter(
      (node) => node.selected && isCanvasAgentSkillReferenceNode(node, skill),
    )
  }, [])

  const applyAgentReferenceSelection = useCallback(
    (nextIds: string[]) => {
      agentReferencedNodeIdsRef.current = nextIds
      setAgentReferencedNodeIds(nextIds)
      setNodes((current) => {
        const next = current.map((node) => ({
          ...node,
          selected: nextIds.includes(node.id),
        }))
        nodesRef.current = next
        return next
      })
    },
    [setNodes],
  )

  useEffect(() => {
    if (!agentSkillMode) return
    const prev = agentReferencedNodeIdsRef.current
    if (!prev.length) return
    const validIds = prev.filter((id) => {
      const node = nodesRef.current.find((item) => item.id === id)
      return node && isCanvasAgentSkillReferenceNode(node, agentSkillMode)
    })
    if (validIds.length !== prev.length) {
      applyAgentReferenceSelection(validIds)
    }
  }, [agentSkillMode, applyAgentReferenceSelection])

  const clearAgentReferences = useCallback(() => {
    applyAgentReferenceSelection([])
  }, [applyAgentReferenceSelection])

  const setAgentReferenceEnabled = useCallback(
    (enabled: boolean) => {
      setAgentReferenceEnabledState(enabled)
      if (!enabled) clearAgentReferences()
    },
    [clearAgentReferences],
  )

  /** Agent 打开时：单击追加/取消引用（不再整份替换）；框选仍同步为多选 */
  const toggleAgentReference = useCallback(
    (nodeId: string, _additive?: boolean) => {
      if (!agentPanelOpen || !agentReferenceEnabled) return
      const node = nodesRef.current.find((item) => item.id === nodeId)
      if (!node || !isCanvasAgentTargetNode(node)) return

      const skill = agentSkillModeRef.current
      if (skill && !isCanvasAgentSkillReferenceNode(node, skill)) {
        const typeLabel = resolveCanvasAgentNodeTypeLabel(String(node.type || ''))
        toast.message(`当前 Skill 不支持该节点类型（${typeLabel}）`)
        return
      }

      const prev = agentReferencedNodeIdsRef.current
      const nextIds = prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId]

      applyAgentReferenceSelection(nextIds)

      if (nextIds.includes(nodeId)) {
        const summary = summarizeCanvasAgentNode(node, nodesRef.current, edgesRef.current)
        toast.message(formatCanvasAgentReferenceToast(summary))
      }
    },
    [agentPanelOpen, agentReferenceEnabled, applyAgentReferenceSelection],
  )

  const removeAgentReference = useCallback(
    (nodeId: string) => {
      const nextIds = agentReferencedNodeIdsRef.current.filter((id) => id !== nodeId)
      applyAgentReferenceSelection(nextIds)
    },
    [applyAgentReferenceSelection],
  )

  useEffect(() => {
    if (!agentPanelOpen) {
      clearAgentReferences()
      setAgentReferenceEnabledState(true)
      setAgentSkillMode(null)
      return
    }
    if (!agentReferenceEnabled) return
    const selectedIds = resolveAgentReferenceNodes(nodesRef.current).map((node) => node.id)
    if (selectedIds.length && !agentReferencedNodeIdsRef.current.length) {
      applyAgentReferenceSelection(selectedIds)
    }
  }, [
    agentPanelOpen,
    agentReferenceEnabled,
    applyAgentReferenceSelection,
    clearAgentReferences,
    resolveAgentReferenceNodes,
    setAgentSkillMode,
  ])

  /** 框选等操作同步助手引用 */
  useEffect(() => {
    if (!agentPanelOpen || !agentReferenceEnabled) return
    const selectedIds = resolveAgentReferenceNodes(nodes).map((node) => node.id)
    const prev = agentReferencedNodeIdsRef.current
    const sortedSelected = [...selectedIds].sort().join(',')
    const sortedPrev = [...prev].sort().join(',')
    if (sortedSelected !== sortedPrev && selectedIds.length > 0) {
      applyAgentReferenceSelection(selectedIds)
    }
  }, [agentPanelOpen, agentReferenceEnabled, applyAgentReferenceSelection, nodes, resolveAgentReferenceNodes])

  const isNodeRunning = useCallback(
    (nodeId: string) => runningNodeIds.has(nodeId),
    [runningNodeIds],
  )
  const hasRunningNodes = runningNodeIds.size > 0

  const markNodeRunning = useCallback((nodeId: string) => {
    runningNodeIdsRef.current.add(nodeId)
    setRunningNodeIds(new Set(runningNodeIdsRef.current))
  }, [])

  const markNodeIdle = useCallback((nodeId: string) => {
    runningNodeIdsRef.current.delete(nodeId)
    setRunningNodeIds(new Set(runningNodeIdsRef.current))
  }, [])

  const releaseNodeRunSession = useCallback(
    (nodeId: string) => {
      releaseCanvasNodeRunSession(projectId, nodeId, markNodeIdle)
    },
    [markNodeIdle, projectId],
  )

  useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])

  useEffect(() => {
    edgesRef.current = edges
  }, [edges])

  useEffect(() => {
    canvasProjectSettingsRef.current = canvasProjectSettings
  }, [canvasProjectSettings])

  useEffect(() => {
    setCanvasProjectSettings(normalizeCanvasProjectSettings(initialData.settings))
  }, [projectId])

  useEffect(() => {
    persistRef.current = onPersist
  }, [onPersist])

  useEffect(() => {
    coverManualRef.current = coverManual
  }, [coverManual])

  const flushPersist = useCallback(async () => {
    await persistRef.current({
      version: 1,
      nodes: nodesRef.current,
      edges: edgesRef.current,
      viewport: viewportRef.current,
      settings: canvasProjectSettingsRef.current,
    })
    if (coverManualRef.current) return
    const cover = pickCanvasCoverFromNodes(nodesRef.current)
    if (cover && cover !== lastCoverRef.current) {
      lastCoverRef.current = cover
      void syncCanvasProjectCover(projectId, nodesRef.current, { coverManual: false })
    }
  }, [projectId])

  const schedulePersist = useCallback(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      void flushPersist()
    }, AUTOSAVE_MS)
  }, [flushPersist])

  /** 旧画布数据补全视频/文本节点默认名称与类型前缀 */
  useEffect(() => {
    let next = nodesRef.current
    let changed = false

    const videoBackfill = backfillCanvasVideoNodeNames(next)
    if (videoBackfill.changed) {
      next = videoBackfill.nodes
      changed = true
    }

    const textBackfill = backfillCanvasPromptNodeLabels(next)
    if (textBackfill.changed) {
      next = textBackfill.nodes
      changed = true
    }

    const imageLayoutBackfill = backfillCanvasImageNodeShellLayout(next)
    if (imageLayoutBackfill.changed) {
      next = imageLayoutBackfill.nodes
      changed = true
    }

    const videoHitboxBackfill = backfillCanvasStoryVideoNodeHitbox(next)
    if (videoHitboxBackfill.changed) {
      next = videoHitboxBackfill.nodes
      changed = true
    }

    if (!changed) return
    nodesRef.current = next
    setNodes(next)
    schedulePersist()
  }, [projectId, schedulePersist, setNodes])

  /** 展开图片/视频控制台时置顶节点（含 parent 分组链），避免被相邻/下方节点遮挡 */
  useLayoutEffect(() => {
    const elevatedId = imageConsoleNodeId ?? videoConsoleNodeId ?? promptConsoleNodeId
    setNodes((current) => {
      const elevatedIds = resolveConsoleElevationIds(current, elevatedId)
      let changed = false
      const next = current.map((node) => {
        if (elevatedIds.has(node.id)) {
          if (node.zIndex === CANVAS_CONSOLE_ELEVATED_Z_INDEX) return node
          changed = true
          return { ...node, zIndex: CANVAS_CONSOLE_ELEVATED_Z_INDEX }
        }
        if (isCanvasConsoleElevatedZIndex(node.zIndex)) {
          changed = true
          return { ...node, zIndex: defaultCanvasNodeZIndex(node) }
        }
        return node
      })
      if (changed) {
        nodesRef.current = next
      }
      return changed ? next : current
    })
  }, [imageConsoleNodeId, videoConsoleNodeId, promptConsoleNodeId, setNodes])

  const openImageConsole = useCallback((nodeId: string) => {
    setVideoConsoleNodeId(null)
    setPromptConsoleNodeId(null)
    setImageConsoleNodeId(nodeId)
  }, [])

  const closeImageConsole = useCallback(() => {
    setImageConsoleNodeId(null)
  }, [])

  const openPromptConsole = useCallback((nodeId: string) => {
    setImageConsoleNodeId(null)
    setVideoConsoleNodeId(null)
    setPromptConsoleNodeId(nodeId)
  }, [])

  const closePromptConsole = useCallback(() => {
    setPromptConsoleNodeId(null)
  }, [])

  const activatePromptConsole = useCallback(
    (nodeId: string, options?: { toggleIfOpen?: boolean }) => {
      const toggleIfOpen = options?.toggleIfOpen ?? true
      const switchingFromOther = Boolean(
        (imageConsoleNodeId && imageConsoleNodeId !== nodeId) ||
          (videoConsoleNodeId && videoConsoleNodeId !== nodeId),
      )

      if (switchingFromOther) {
        setImageConsoleNodeId(null)
        setVideoConsoleNodeId(null)
        setPromptConsoleNodeId(nodeId)
        return
      }

      if (promptConsoleNodeId === nodeId) {
        if (toggleIfOpen) setPromptConsoleNodeId(null)
        return
      }

      setImageConsoleNodeId(null)
      setVideoConsoleNodeId(null)
      setPromptConsoleNodeId(nodeId)
    },
    [imageConsoleNodeId, promptConsoleNodeId, videoConsoleNodeId],
  )

  const openVideoConsole = useCallback((nodeId: string) => {
    setImageConsoleNodeId(null)
    setPromptConsoleNodeId(null)
    setVideoConsoleNodeId(nodeId)
  }, [])

  const closeVideoConsole = useCallback(() => {
    setVideoConsoleNodeId(null)
  }, [])

  const activateVideoConsole = useCallback(
    (nodeId: string, options?: { toggleIfOpen?: boolean }) => {
      const toggleIfOpen = options?.toggleIfOpen ?? true
      const switchingFromOther = Boolean(
        (imageConsoleNodeId && imageConsoleNodeId !== nodeId) ||
          (promptConsoleNodeId && promptConsoleNodeId !== nodeId) ||
          (videoConsoleNodeId && videoConsoleNodeId !== nodeId),
      )

      if (switchingFromOther) {
        setImageConsoleNodeId(null)
        setPromptConsoleNodeId(null)
        setVideoConsoleNodeId(nodeId)
        return
      }

      if (videoConsoleNodeId === nodeId) {
        if (toggleIfOpen) setVideoConsoleNodeId(null)
        return
      }

      setImageConsoleNodeId(null)
      setPromptConsoleNodeId(null)
      setVideoConsoleNodeId(nodeId)
    },
    [imageConsoleNodeId, promptConsoleNodeId, videoConsoleNodeId],
  )

  const requestVideoExtractAudio = useCallback((nodeId: string) => {
    const trimmed = String(nodeId || '').trim()
    if (!trimmed) return
    setVideoExtractAudioRequest({ nodeId: trimmed, nonce: Date.now() })
  }, [])

  const openAddNodeMenu = useCallback((anchor: CanvasAddNodeAnchor) => {
    setAddNodeMenuAnchor(anchor)
  }, [])

  const closeAddNodeMenu = useCallback(() => {
    setAddNodeMenuAnchor(null)
  }, [])

  const addCanvasNode = useCallback(
    (
      type: string,
      position: { x: number; y: number },
      connection?: CanvasAddNodeConnection | null,
      data?: Record<string, unknown>,
    ) => {
      const nodeData =
        type === CANVAS_NODE_TYPES.imageNode
          ? assignDefaultImageNodeData(nodesRef.current, data)
          : type === CANVAS_NODE_TYPES.storyVideo
            ? {
                ...assignDefaultVideoNodeData(nodesRef.current, data),
                ...canvasVideoProjectParamsToNodePatch(canvasVideoParamsRef.current),
              }
            : type === CANVAS_NODE_TYPES.shotPrompt
              ? assignDefaultPromptNodeData(nodesRef.current, data)
              : data
      const nodePosition = position
      const { node, edge } = createConnectedCanvasNode(type, nodePosition, connection, nodeData)

      let edgeToAdd = edge
      if (edge) {
        const graphNodes = [...nodesRef.current, node]
        const endpoints = resolveCanvasConnectionEndpoints(edge, graphNodes)
        if (!isCanvasVoiceAwareConnectionAllowed(endpoints.source, endpoints.target)) {
          toast.error(CANVAS_VOICE_BIND_ONLY_FROM_CHARACTER)
          edgeToAdd = null
        }
      }

      setNodes((current) => {
        const next = [...current, node]
        nodesRef.current = next
        return next
      })
      if (edgeToAdd) {
        setEdges((current) => {
          const next = appendConnectedNodeEdge(current, edgeToAdd)
          edgesRef.current = next
          return next
        })
      }
      schedulePersist()
    },
    [setNodes, setEdges, schedulePersist],
  )

  const appendCanvasGraph = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      if (!newNodes.length && !newEdges.length) return
      setNodes((current) => {
        const next = [...current, ...newNodes]
        nodesRef.current = next
        return next
      })
      if (newEdges.length) {
        setEdges((current) => {
          const next = [...current, ...newEdges]
          edgesRef.current = next
          return next
        })
      }
      schedulePersist()
    },
    [setNodes, setEdges, schedulePersist],
  )

  const reloadCanvasGraphFromDisk = useCallback(async () => {
    const data = await readCanvasData(projectId)
    nodesRef.current = data.nodes
    edgesRef.current = data.edges
    setNodes(data.nodes)
    setEdges(data.edges)
  }, [projectId, setEdges, setNodes])

  const duplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodesRef.current.find((item) => item.id === nodeId)
      if (!node) return
      const cloned = cloneSingleCanvasNode(node)
      if (cloned.type === CANVAS_NODE_TYPES.imageNode) {
        cloned.data = assignDefaultImageNodeData(
          nodesRef.current,
          cloned.data as Record<string, unknown>,
        )
      } else if (cloned.type === CANVAS_NODE_TYPES.storyVideo) {
        cloned.data = {
          ...assignDefaultVideoNodeData(
            nodesRef.current,
            cloned.data as Record<string, unknown>,
          ),
          ...canvasVideoProjectParamsToNodePatch(canvasVideoParamsRef.current),
        }
      }
      setNodes((current) => {
        const next = [...deselectAllNodes(current), cloned]
        nodesRef.current = next
        return next
      })
      schedulePersist()
      toast.success('已复制节点')
    },
    [setNodes, schedulePersist],
  )

  const executeRemoveNodeIds = useCallback(
    (removeIds: Set<string>, options?: { silent?: boolean }) => {
      if (!removeIds.size) return
      const shotNumbers = collectStoryboardShotNumbersFromNodes(nodesRef.current, removeIds)
      setNodes((current) => {
        const next = current.filter((item) => !removeIds.has(item.id))
        nodesRef.current = next
        return next
      })
      setEdges((current) => {
        const next = current.filter(
          (edge) => !removeIds.has(edge.source) && !removeIds.has(edge.target),
        )
        edgesRef.current = next
        return next
      })
      if (imageConsoleNodeId && removeIds.has(imageConsoleNodeId)) {
        closeImageConsole()
      }
      if (videoConsoleNodeId && removeIds.has(videoConsoleNodeId)) {
        closeVideoConsole()
      }
      if (promptConsoleNodeId && removeIds.has(promptConsoleNodeId)) {
        closePromptConsole()
      }
      schedulePersist()
      if (options?.silent) return
      const shotToast = formatDeletedStoryboardShotsToast(shotNumbers)
      if (shotToast && shotNumbers.length === removeIds.size) {
        toast.success(shotToast)
      } else if (shotToast) {
        toast.success(`${shotToast}（共 ${removeIds.size} 个节点）`)
      } else if (removeIds.size > 1) {
        toast.success(`已删除 ${removeIds.size} 个节点`)
      } else {
        toast.success('已删除节点')
      }
    },
    [
      setNodes,
      setEdges,
      schedulePersist,
      imageConsoleNodeId,
      closeImageConsole,
      videoConsoleNodeId,
      closeVideoConsole,
      promptConsoleNodeId,
      closePromptConsole,
    ],
  )

  const requestRemoveNodeIds = useCallback(
    (removeIds: Set<string>) => {
      if (!removeIds.size) return
      const busyLabels = collectBusyCanvasNodeLabels(
        nodesRef.current,
        removeIds,
        isNodeRunning,
      )
      if (busyLabels.length) {
        const preview = busyLabels.slice(0, 3).join('、')
        const suffix = busyLabels.length > 3 ? ' 等' : ''
        toast.error(`以下节点正在生成，请先停止后再删除：${preview}${suffix}`)
        return
      }
      executeRemoveNodeIds(removeIds)
    },
    [executeRemoveNodeIds, isNodeRunning],
  )

  const confirmPendingDelete = useCallback(() => {
    if (!pendingDelete) return
    executeRemoveNodeIds(new Set(pendingDelete.removeIds))
    setPendingDelete(null)
  }, [executeRemoveNodeIds, pendingDelete])

  const cancelPendingDelete = useCallback(() => {
    setPendingDelete(null)
  }, [])

  const deleteNode = useCallback(
    (nodeId: string) => {
      const removeIds = new Set(expandNodeRemovals(nodesRef.current, [nodeId]))
      requestRemoveNodeIds(removeIds)
    },
    [requestRemoveNodeIds],
  )

  const removeNodesByIds = useCallback(
    (nodeIds: string[], options?: { silent?: boolean }) => {
      if (!nodeIds.length) return
      const removeIds = new Set(expandNodeRemovals(nodesRef.current, nodeIds))
      executeRemoveNodeIds(removeIds, options)
    },
    [executeRemoveNodeIds],
  )

  useEffect(() => {
    historyPastRef.current = [cloneCanvasGraph(initialData.nodes, initialData.edges)]
    historyFutureRef.current = []
    historyReadyRef.current = false
    const timer = window.setTimeout(() => {
      historyReadyRef.current = true
    }, 0)
    return () => window.clearTimeout(timer)
    // 仅项目切换时重置历史；勿依赖 initialData（自动保存会更新父级 data 导致历史被清空）
  }, [projectId])

  const bumpHistory = useCallback(() => {
    setHistoryVersion((value) => value + 1)
  }, [])

  const recordHistory = useCallback(() => {
    if (applyingHistoryRef.current || !historyReadyRef.current) return
    const snap = cloneCanvasGraph(nodesRef.current, edgesRef.current)
    const last = historyPastRef.current[historyPastRef.current.length - 1]
    if (last && isSameCanvasGraph(last, snap)) return
    historyPastRef.current.push(snap)
    if (historyPastRef.current.length > 50) {
      historyPastRef.current.shift()
    }
    historyFutureRef.current = []
    bumpHistory()
  }, [bumpHistory])

  const flushHistoryRecord = useCallback(() => {
    if (historyDebounceTimerRef.current) {
      window.clearTimeout(historyDebounceTimerRef.current)
      historyDebounceTimerRef.current = null
    }
    recordHistory()
  }, [recordHistory])

  const deleteSelectedNodes = useCallback(() => {
    const selectedIds = nodesRef.current.filter((node) => node.selected).map((node) => node.id)
    if (!selectedIds.length) return
    flushHistoryRecord()
    const removeIds = new Set(expandNodeRemovals(nodesRef.current, selectedIds))
    requestRemoveNodeIds(removeIds)
  }, [flushHistoryRecord, requestRemoveNodeIds])

  const groupSelectedNodes = useCallback(() => {
    const selected = nodesRef.current.filter((node) => node.selected)
    if (selected.length < 2) {
      toast.message('请至少选中两个节点再成组')
      return
    }
    flushHistoryRecord()
    setNodes((current) => {
      const next = wrapNodesInGroup(selected, current)
      nodesRef.current = next
      return next
    })
    closeImageConsole()
    closeVideoConsole()
    closePromptConsole()
    schedulePersist()
    toast.success('已成组')
  }, [
    flushHistoryRecord,
    setNodes,
    schedulePersist,
    closeImageConsole,
    closeVideoConsole,
    closePromptConsole,
  ])

  useEffect(() => {
    if (!historyReadyRef.current) return
    if (historyDebounceTimerRef.current) {
      window.clearTimeout(historyDebounceTimerRef.current)
    }
    historyDebounceTimerRef.current = window.setTimeout(() => {
      historyDebounceTimerRef.current = null
      recordHistory()
    }, 450)
    return () => {
      if (historyDebounceTimerRef.current) {
        window.clearTimeout(historyDebounceTimerRef.current)
      }
    }
  }, [nodes, edges, recordHistory])

  const applyHistorySnapshot = useCallback(
    (snap: { nodes: Node[]; edges: Edge[] }) => {
      if (historyDebounceTimerRef.current) {
        window.clearTimeout(historyDebounceTimerRef.current)
        historyDebounceTimerRef.current = null
      }
      applyingHistoryRef.current = true
      setNodes(snap.nodes)
      setEdges(snap.edges)
      nodesRef.current = snap.nodes
      edgesRef.current = snap.edges
      window.setTimeout(() => {
        applyingHistoryRef.current = false
      }, 500)
      schedulePersist()
      bumpHistory()
    },
    [setNodes, setEdges, schedulePersist, bumpHistory],
  )

  const undo = useCallback(() => {
    flushHistoryRecord()
    if (historyPastRef.current.length < 2) return
    const current = historyPastRef.current.pop()
    if (current) historyFutureRef.current.unshift(current)
    const prev = historyPastRef.current[historyPastRef.current.length - 1]
    applyHistorySnapshot(prev)
  }, [flushHistoryRecord, applyHistorySnapshot])

  const redo = useCallback(() => {
    flushHistoryRecord()
    const next = historyFutureRef.current.shift()
    if (!next) return
    historyPastRef.current.push(next)
    applyHistorySnapshot(next)
  }, [flushHistoryRecord, applyHistorySnapshot])

  const canUndo = historyPastRef.current.length > 1
  const canRedo = historyFutureRef.current.length > 0

  // historyVersion 驱动 canUndo/canRedo 重算
  void historyVersion

  useEffect(() => {
    schedulePersist()
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current)
    }
  }, [nodes, edges, schedulePersist])

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const removeIds = changes
        .filter((change) => change.type === 'remove')
        .map((change) => change.id)
      let nextChanges = changes
      if (removeIds.length) {
        const expanded = expandNodeRemovals(nodesRef.current, removeIds)
        const extra = expanded
          .filter((id) => !removeIds.includes(id))
          .map((id) => ({ type: 'remove' as const, id }))
        if (extra.length) nextChanges = [...changes, ...extra]
      }
      onNodesChange(nextChanges)
    },
    [onNodesChange],
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((change) => change.type === 'remove')) {
        flushHistoryRecord()
      }
      onEdgesChange(changes)
    },
    [flushHistoryRecord, onEdgesChange],
  )

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    const endpoints = resolveCanvasConnectionEndpoints(connection, nodesRef.current)
    return isCanvasVoiceAwareConnectionAllowed(endpoints.source, endpoints.target)
  }, [])

  const onConnect = useCallback(
    (connection: Connection) => {
      const endpoints = resolveCanvasConnectionEndpoints(connection, nodesRef.current)
      if (!isCanvasVoiceAwareConnectionAllowed(endpoints.source, endpoints.target)) {
        toast.error(CANVAS_VOICE_BIND_ONLY_FROM_CHARACTER)
        return
      }
      const normalized: Connection = {
        ...connection,
        sourceHandle: connection.sourceHandle ?? CANVAS_EDGE_HANDLE_RIGHT,
        targetHandle: connection.targetHandle ?? CANVAS_EDGE_HANDLE_LEFT,
      }
      setEdges((current) => {
        const next = addEdge({ ...normalized, type: 'canvas' }, current)
        edgesRef.current = next
        return next
      })
      schedulePersist()
    },
    [setEdges, schedulePersist],
  )

  const applyFrameSnapConnection = useCallback(
    (
      connection: Connection,
      options?: { replace?: { source: string; target: string } },
    ) => {
      const endpoints = resolveCanvasConnectionEndpoints(connection, nodesRef.current)
      if (!isCanvasVoiceAwareConnectionAllowed(endpoints.source, endpoints.target)) {
        toast.error(CANVAS_VOICE_BIND_ONLY_FROM_CHARACTER)
        return
      }
      const normalized: Connection = {
        ...connection,
        sourceHandle: connection.sourceHandle ?? CANVAS_EDGE_HANDLE_RIGHT,
        targetHandle: connection.targetHandle ?? CANVAS_EDGE_HANDLE_LEFT,
      }
      setEdges((current) => {
        const base = options?.replace
          ? current.filter(
              (edge) =>
                !(
                  edge.source === options.replace!.source &&
                  edge.target === options.replace!.target
                ),
            )
          : current
        if (
          hasCanvasConnectionPair(base, normalized.source!, normalized.target!)
        ) {
          edgesRef.current = base
          return base
        }
        const next = addEdge({ ...normalized, type: 'canvas' }, base)
        edgesRef.current = next
        return next
      })
      schedulePersist()
    },
    [schedulePersist, setEdges],
  )

  const removeEdge = useCallback(
    (edgeId: string) => {
      flushHistoryRecord()
      setEdges((current) => {
        const next = current.filter((edge) => edge.id !== edgeId)
        edgesRef.current = next
        return next
      })
      schedulePersist()
    },
    [flushHistoryRecord, setEdges, schedulePersist],
  )

  const onMoveEnd: OnMove = useCallback(
    (_event, viewport) => {
      viewportRef.current = viewport
      schedulePersist()
    },
    [schedulePersist],
  )

  const updateNodeData = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      setNodes((current) => {
        const next = current.map((node) =>
          node.id === nodeId ? { ...node, data: { ...node.data, ...patch } } : node,
        )
        nodesRef.current = next
        return next
      })
    },
    [setNodes],
  )

  const runBridgeRef = useRef({
    updateNodeData,
    flushPersist,
    schedulePersist,
    markNodeRunning,
    markNodeIdle,
  })
  useEffect(() => {
    runBridgeRef.current = {
      updateNodeData,
      flushPersist,
      schedulePersist,
      markNodeRunning,
      markNodeIdle,
    }
  }, [updateNodeData, flushPersist, schedulePersist, markNodeRunning, markNodeIdle])

  useEffect(() => {
    return registerCanvasProjectRunBridge(projectId, {
      patchNode: (nodeId, patch, options) => {
        const bridge = runBridgeRef.current
        bridge.updateNodeData(nodeId, patch)
        if (options?.flush) void bridge.flushPersist()
        else bridge.schedulePersist()
      },
      markNodeRunning: (nodeId) => runBridgeRef.current.markNodeRunning(nodeId),
      markNodeIdle: (nodeId) => runBridgeRef.current.markNodeIdle(nodeId),
      getNodes: () => nodesRef.current,
      appendGraph: appendCanvasGraph,
      removeNodesByIds,
      reloadFromDisk: reloadCanvasGraphFromDisk,
    })
  }, [appendCanvasGraph, projectId, reloadCanvasGraphFromDisk, removeNodesByIds])

  /** 重新进入画布：恢复文本提取/智能分镜任务状态 */
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const failed = await reconcileStaleCanvasPromptAiTasks(projectId)
      if (cancelled) return

      if (failed?.errorMessage) {
        toast.error(failed.errorMessage)
      }

      const tasks = await readCanvasTasks(projectId)
      const busy = resolveCanvasPromptAiBusyState(tasks, projectId)
      setPromptAiBusy(busy)

      const inflight = getInflightCanvasPromptAiTask(projectId)
      if (!inflight) return

      void inflight.promise
        .then(async (result) => {
          if (cancelled) return
          // 用户已取消：不视为完成，避免误触发刷新带来的「像又跑完了」
          if (result?.cancelled) {
            setPromptAiBusy(null)
            void useTaskStore.getState().refresh()
            return
          }
          await reloadCanvasGraphFromDisk()
          setPromptAiBusy(null)
          void useTaskStore.getState().refresh()
        })
        .catch(() => {
          if (!cancelled) setPromptAiBusy(null)
        })
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, reloadCanvasGraphFromDisk])

  const cancelPromptAi = useCallback(async () => {
    const busy = promptAiBusy
    if (!busy) return false
    const ok = await cancelActiveCanvasPromptAi(projectId, busy)
    setPromptAiBusy(null)
    if (ok) {
      toast.message(busy.kind === 'extract' ? '已取消提取资产' : '已取消智能分镜', {
        description: '本次结果不会写入画布',
      })
    }
    return ok
  }, [projectId, promptAiBusy])

  useEffect(() => {
    return () => {
      flushPersist()
    }
  }, [flushPersist])

  /** 重新进入画布：恢复可续接的生视频任务；无 remoteJob 的 running 节点标记中断 */
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const failed = await reconcileStaleCanvasVideoTasks(projectId)
      let graphNodes = nodesRef.current
      if (isCanvasApiAvailable()) {
        try {
          const fresh = await readCanvasData(projectId)
          graphNodes = fresh.nodes
        } catch {
          /* 用内存图兜底 */
        }
      }
      const historyResult = await reconcileStaleCanvasRunHistory(projectId, graphNodes)
      if (cancelled) return

      // 不再在「尚不可 resume」时清掉 inflight：离开主页再回来时任务常仍在本进程轮询。
      // 也不再整图 merge+setNodes（会触发全部视频节点重挂 src，限流队列挤爆 → 卡顿 +「加载超时」）。

      if (historyResult.syncedNodes.length) {
        for (const item of historyResult.syncedNodes) {
          if (hasCanvasInflightRun(projectId, item.nodeId)) continue
          releaseNodeRunSession(item.nodeId)
        }
        const syncedNodes = applyCanvasRunHistoryNodeSync(
          nodesRef.current,
          historyResult.syncedNodes,
        )
        nodesRef.current = syncedNodes
        setNodes(syncedNodes)
        runBridgeRef.current.schedulePersist()
      }

      const bridge = runBridgeRef.current
      if (failed) {
        if (!hasCanvasInflightRun(projectId, failed.nodeId)) {
          releaseNodeRunSession(failed.nodeId)
          bridge.updateNodeData(failed.nodeId, {
            status: 'error',
            error: failed.error,
            progressMessage: undefined,
            remoteJob: undefined,
            statusUpdatedAt: Date.now(),
          })
          bridge.schedulePersist()
        }
      }
      if (historyResult.failedCount > 0) {
        void useTaskStore.getState().refresh()
      }

      const inflightRuns = listCanvasInflightRuns(projectId)
      const inflightNodeIds = new Set(inflightRuns.map((run) => run.nodeId))
      // resume 判定同时看磁盘图与当前内存图，避免只因内存缺 remoteJob 误杀
      const resumableIds = new Set([
        ...listResumableCanvasVideoNodesFromGraph(nodesRef.current).map((node) => node.id),
        ...listResumableCanvasVideoNodesFromGraph(graphNodes).map((node) => node.id),
      ])

      const normalizeReopenRunningProgress = (nodeId: string, progressMessage?: string) => {
        if (!isMisleadingVideoPrepProgressMessage(progressMessage)) return
        // 关项目再开：磁盘常残留「上传参考素材…」，先落成「生成中 0%」再接续/等待轮询
        bridge.updateNodeData(nodeId, {
          progressMessage: VIDEO_PROGRESS_REOPEN_PLACEHOLDER.message,
          statusUpdatedAt: Date.now(),
        })
        bridge.schedulePersist()
      }

      const isNodeTerminalError = (node: Node) =>
        (node.data as { status?: string }).status === 'error'

      for (const node of nodesRef.current) {
        if (!canRunCanvasNode(node)) continue
        if (isNodeTerminalError(node)) {
          bridge.markNodeIdle(node.id)
          continue
        }
        const nodeData = node.data as CanvasVideoNodeData
        if (hasCanvasVideoLocalOutput(nodeData)) {
          const stuck =
            nodeData.status === 'running' ||
            Boolean(nodeData.remoteJob?.apiTaskId?.trim()) ||
            Boolean(nodeData.progressMessage?.trim())
          const resumable = resumableIds.has(node.id)
          const inflight = inflightNodeIds.has(node.id)

          if ((inflight || resumable) && stuck) {
            bridge.markNodeRunning(node.id)
            normalizeReopenRunningProgress(node.id, nodeData.progressMessage)
            if (resumable && !inflight) {
              void resumeCanvasVideoIfNeeded(projectId, node.id).finally(() => {
                bridge.markNodeIdle(node.id)
              })
            }
            continue
          }

          bridge.markNodeIdle(node.id)
          if (stuck) {
            bridge.updateNodeData(node.id, {
              status: 'success',
              error: undefined,
              progressMessage: undefined,
              remoteJob: undefined,
              statusUpdatedAt: Date.now(),
            })
            bridge.schedulePersist()
          }
          continue
        }

        const status = nodeData.status
        const resumable = resumableIds.has(node.id)
        const inflight = inflightNodeIds.has(node.id)
        if (status !== 'running' && !resumable && !inflight) continue

        if (inflight || resumable) {
          normalizeReopenRunningProgress(node.id, nodeData.progressMessage)
          if (resumable && !inflight) {
            bridge.markNodeRunning(node.id)
            // 磁盘有 remoteJob、内存没有时，只补这一节点的 runtime，避免整图重挂视频
            const diskNode = graphNodes.find((item) => item.id === node.id)
            const diskData = diskNode?.data as CanvasVideoNodeData | undefined
            if (
              diskData?.remoteJob?.apiTaskId?.trim() &&
              !nodeData.remoteJob?.apiTaskId?.trim()
            ) {
              bridge.updateNodeData(node.id, {
                remoteJob: diskData.remoteJob,
                status: 'running',
                error: undefined,
                statusUpdatedAt: Date.now(),
              })
            }
            void resumeCanvasVideoIfNeeded(projectId, node.id).finally(() => {
              bridge.markNodeIdle(node.id)
            })
          } else if (inflight) {
            bridge.markNodeRunning(node.id)
          }
          continue
        }

        bridge.updateNodeData(node.id, {
          status: 'error',
          error: '生成已中断，请重新生成',
          progressMessage: undefined,
          remoteJob: undefined,
          statusUpdatedAt: Date.now(),
        })
        bridge.markNodeIdle(node.id)
        bridge.schedulePersist()
        await failRunningCanvasRunHistoryForNode(
          projectId,
          node.id,
          '生成已中断，请重新生成',
        )
      }

      for (const run of inflightRuns) {
        const node = nodesRef.current.find((item) => item.id === run.nodeId)
        if (node && isNodeTerminalError(node)) {
          cancelCanvasInflightRun(projectId, run.nodeId)
          bridge.markNodeIdle(run.nodeId)
          continue
        }
        bridge.markNodeRunning(run.nodeId)
      }

      void useTaskStore.getState().refresh()
    })()

    return () => {
      cancelled = true
    }
  }, [projectId])

  const updateCanvasVideoParams = useCallback(
    (patch?: Partial<CanvasVideoNodeParamsPatch>) => {
      const store = useSettingsStore.getState()
      const videoModels = store.getMergedModels('video')
      const current = resolveCanvasVideoParamsFromSettings(store.settings, videoModels)
      const nextParams = normalizeCanvasVideoProjectParams(
        { ...current, ...patch },
        store.settings,
        videoModels,
      )
      persistCanvasVideoParamsToSettings(nextParams)
      const fresh = resolveCanvasVideoParamsFromSettings(
        useSettingsStore.getState().settings,
        videoModels,
      )
      canvasVideoParamsRef.current = fresh
      setCanvasVideoParams(fresh)

      setNodes((currentNodes) => {
        const synced = syncVideoNodesWithProjectParams(currentNodes, fresh, videoModels)
        if (!synced.changed) return currentNodes
        nodesRef.current = synced.nodes
        schedulePersist()
        return synced.nodes
      })
    },
    [schedulePersist, setNodes],
  )

  const applyCanvasVideoParamsToAllNodes = updateCanvasVideoParams

  const lastUsedVideoModelId = useSettingsStore((s) => s.settings?.lastUsedStoryboardVideoModelId)
  const lastUsedVideoReferenceMode = useSettingsStore(
    (s) => s.settings?.lastUsedStoryboardVideoReferenceMode,
  )
  const lastUsedVideoDuration = useSettingsStore((s) => s.settings?.lastUsedStoryboardVideoDuration)
  const lastUsedVideoAspectRatio = useSettingsStore(
    (s) => s.settings?.lastUsedStoryboardVideoAspectRatio,
  )
  const lastUsedVideoResolution = useSettingsStore(
    (s) => s.settings?.lastUsedStoryboardVideoResolution,
  )

  useEffect(() => {
    const store = useSettingsStore.getState()
    if (!store.settings) return
    const videoModels = store.getMergedModels('video')
    const fresh = resolveCanvasVideoParamsFromSettings(store.settings, videoModels)
    canvasVideoParamsRef.current = fresh
    setCanvasVideoParams(fresh)
    setNodes((currentNodes) => {
      if (!currentNodes.some((node) => node.type === CANVAS_NODE_TYPES.storyVideo)) {
        return currentNodes
      }
      const synced = syncVideoNodesWithProjectParams(currentNodes, fresh, videoModels)
      if (!synced.changed) return currentNodes
      nodesRef.current = synced.nodes
      schedulePersist()
      return synced.nodes
    })
  }, [
    lastUsedVideoModelId,
    lastUsedVideoReferenceMode,
    lastUsedVideoDuration,
    lastUsedVideoAspectRatio,
    lastUsedVideoResolution,
    schedulePersist,
    setNodes,
  ])

  const executeNode = useCallback(
    async (nodeId: string, options?: CanvasRunOptions & { silent?: boolean }) => {
      const node = nodesRef.current.find((item) => item.id === nodeId)
      if (!node || !canRunCanvasNode(node)) return false
      if (hasCanvasInflightRun(projectId, nodeId)) {
        toast.info('该节点任务进行中，请稍候')
        return false
      }
      // runningNodeIds 残留但无真实会话时清掉，避免「无效下载 URL」失败后无法重试
      if (runningNodeIdsRef.current.has(nodeId) && !isCanvasNodeRuntimeBusy(node)) {
        markNodeIdle(nodeId)
        releaseVideoResumeLock('canvas', projectId, nodeId)
      } else if (runningNodeIdsRef.current.has(nodeId)) {
        toast.info('该节点任务进行中，请稍候')
        return false
      }
      if (node.type === CANVAS_NODE_TYPES.storyVideo) {
        const videoData = node.data as CanvasVideoNodeData
        // 批量/并发时节点 data 可能滞后于控制台全局参数；发起前强制对齐
        const store = useSettingsStore.getState()
        const videoModels = store.getMergedModels('video')
        const freshParams =
          canvasVideoParamsRef.current ??
          resolveCanvasVideoParamsFromSettings(store.settings, videoModels)
        const videoModel =
          videoModels.find((item) => item.id === freshParams.videoModelId) ?? videoModels[0] ?? null
        const paramsPatch = forceCanvasVideoNodeParamsForGenerate(videoData, freshParams, videoModel)
        if (Object.keys(paramsPatch).length) {
          // 同步写 nodesRef，避免 setNodes 批处理导致并发第 2/3 路仍读到旧 data
          const nextNodes = nodesRef.current.map((item) =>
            item.id === nodeId
              ? { ...item, data: { ...item.data, ...paramsPatch } }
              : item,
          )
          nodesRef.current = nextNodes
          setNodes(nextNodes)
        }
        const alignedNode = nodesRef.current.find((item) => item.id === nodeId) ?? node
        const alignedData = alignedNode.data as CanvasVideoNodeData
        const alreadyFailed =
          alignedData.status === 'error' || Boolean(alignedData.error?.trim())
        // 失败后再生成：开新任务，不走「未完成恢复」
        if (!alreadyFailed) {
          const resumable = isCanvasVideoNodeResumable(alignedNode)
          const resumeLocked = hasVideoResumeLock('canvas', projectId, nodeId)
          if (resumable || resumeLocked) {
            if (resumable && !hasCanvasInflightRun(projectId, nodeId) && !resumeLocked) {
              void resumeCanvasVideoIfNeeded(projectId, nodeId)
            }
            toast.info('该节点视频任务恢复中，请稍候')
            return false
          }
        } else {
          releaseVideoResumeLock('canvas', projectId, nodeId)
        }
      }

      const runPromise = (async (): Promise<boolean> => {
        const abortController = new AbortController()
        nodeAbortControllersRef.current.set(nodeId, abortController)
        markNodeRunning(nodeId)
        const startAsVideo = node.type === CANVAS_NODE_TYPES.storyVideo
        const runningPatch = {
          status: 'running' as const,
          error: undefined,
          progressMessage: undefined,
          pendingDownloadUrl: undefined,
          ...(startAsVideo ? buildCanvasVideoGenerationStartPatch() : {}),
        }
        patchCanvasNodeData(projectId, nodeId, runningPatch, { flush: true })
        await patchCanvasNodeDataPersisted(projectId, nodeId, runningPatch)

        // 重新取节点：强制对齐后的 data 才用于组请求
        const liveNode = nodesRef.current.find((item) => item.id === nodeId) ?? node

        const runAttemptId = await startCanvasNodeRunAttempt({
          projectId,
          node: liveNode,
          label: getNodeDisplayLabel(liveNode),
        })

        let lastProgressPersistAt = 0
        const progressPersistMs = 2000
        const isVideoNode = liveNode.type === CANVAS_NODE_TYPES.storyVideo

        try {
          const result = await runCanvasNode(liveNode, {
            projectId,
            nodes: nodesRef.current,
            edges: edgesRef.current,
            abortSignal: abortController.signal,
            runOptions: options
              ? {
                  toolPrompt: options.toolPrompt,
                  useSelfReference: options.useSelfReference,
                  weishiPreparedReferences: options.weishiPreparedReferences,
                }
              : undefined,
            onProgress: (message) => {
              patchCanvasNodeData(projectId, nodeId, { progressMessage: message })
              void updateCanvasNodeRunAttempt(projectId, runAttemptId, {
                progressMessage: message,
              })
              if (!isVideoNode) return
              const now = Date.now()
              if (now - lastProgressPersistAt < progressPersistMs) return
              lastProgressPersistAt = now
              void updateCanvasVideoTaskProgress(projectId, nodeId, message)
            },
            onRemoteJobCreated: isVideoNode
              ? async (job) => {
                  const remoteJob = buildPersistedCanvasRemoteJob(job)
                  patchCanvasNodeData(projectId, nodeId, {
                    remoteJob,
                    status: 'running',
                    error: undefined,
                  })
                  await persistCanvasVideoRemoteJob(projectId, nodeId, remoteJob)
                  await updateCanvasNodeRunAttempt(projectId, runAttemptId, { remoteJob })
                  if (!options?.silent) {
                    toast.message('视频生成已开始，可能需要数分钟，画布仍可继续操作')
                  }
                }
              : undefined,
            onImageNodePatch: (imageNodeId, patch) => {
              patchCanvasNodeData(projectId, imageNodeId, patch)
            },
          })
          if (!result) {
            throw new Error('该节点不支持运行')
          }
          const successNow = Date.now()
          const successPatch = {
            ...result.patch,
            status: 'success' as const,
            error: undefined,
            progressMessage: undefined,
            remoteJob: undefined,
            pendingDownloadUrl: undefined,
            statusUpdatedAt: successNow,
            ...(isVideoNode
              ? {
                  needsRegen: false as const,
                  ...buildCanvasVideoGenerationElapsedPatch(
                    (nodesRef.current.find((item) => item.id === nodeId)?.data as CanvasVideoNodeData)
                      ?? (liveNode.data as CanvasVideoNodeData),
                    successNow,
                  ),
                }
              : {}),
          }
          if (isVideoNode) {
            // 落盘成功后立刻 flush，避免 UI 仍显示 running /「生成中…」
            patchCanvasNodeData(projectId, nodeId, successPatch, { flush: true })
            // 先卸会话标记，再异步持久化，避免 success 后仍因 inflight 盖遮罩
            const bridge = getCanvasProjectRunBridge(projectId)
            if (bridge) bridge.markNodeIdle(nodeId)
            else markNodeIdle(nodeId)
            await finishCanvasVideoTask(projectId, nodeId, {
              status: 'success',
              patch: {
                ...result.patch,
                progressMessage: undefined,
                remoteJob: undefined,
              },
            })
          } else {
            patchCanvasNodeData(projectId, nodeId, successPatch)
            await patchCanvasNodeDataPersisted(projectId, nodeId, successPatch)
            await flushPersist()
          }
          await finishCanvasNodeRunAttempt(projectId, runAttemptId, { status: 'completed' })
          if (isVideoNode) void useTaskStore.getState().refresh()
          if (!options?.silent) {
            toast.success(
              liveNode.type === CANVAS_NODE_TYPES.storyVideo
                ? formatStoryboardVideoGeneratedToast(liveNode.data as CanvasVideoNodeData)
                : '图片生成完成',
            )
          }
          return true
        } catch (error: unknown) {
          const err = error as Error
          const errorNow = Date.now()
          const downloadFailed = isVideoNode && isVideoContentDownloadError(error)
          const errorMessage = downloadFailed
            ? formatVideoContentDownloadErrorMessage(error)
            : err.message || '运行失败'
          const errorPatch = {
            status: 'error' as const,
            error: errorMessage,
            progressMessage: undefined,
            // 成片下载失败：保留 remoteJob（jobId），供「重新下载」
            ...(downloadFailed ? {} : { remoteJob: undefined }),
            statusUpdatedAt: errorNow,
            ...(downloadFailed
              ? { pendingDownloadUrl: error.remoteUrl }
              : isVideoNode
                ? { pendingDownloadUrl: undefined }
                : {}),
            ...(isVideoNode
              ? buildCanvasVideoGenerationElapsedPatch(
                  (nodesRef.current.find((item) => item.id === nodeId)?.data as CanvasVideoNodeData)
                    ?? (liveNode.data as CanvasVideoNodeData),
                  errorNow,
                )
              : {}),
          }
          patchCanvasNodeData(projectId, nodeId, errorPatch, { flush: true })
          if (isVideoNode) {
            const failedMessage = formatStoryboardVideoFailedToast(
              node.data as CanvasVideoNodeData,
              errorPatch.error,
            )
            await finishCanvasVideoTask(projectId, nodeId, {
              status: 'error',
              error: errorPatch.error,
              progressMessage: failedMessage,
              patch: downloadFailed
                ? { pendingDownloadUrl: error.remoteUrl }
                : { pendingDownloadUrl: undefined },
            })
            await finishCanvasNodeRunAttempt(projectId, runAttemptId, {
              status: 'failed',
              errorMessage: errorPatch.error,
              progressMessage: failedMessage,
            })
          } else {
            await patchCanvasNodeDataPersisted(projectId, nodeId, errorPatch)
            await flushPersist()
            await finishCanvasNodeRunAttempt(projectId, runAttemptId, {
              status: 'failed',
              errorMessage: errorPatch.error,
            })
          }
          if (!options?.silent) {
            if (isVideoGenerationAbortError(error)) {
              toast.message('已停止生成', {
                description: '本次任务已取消；若节点原先有成品，仍会保留。',
              })
            } else if (downloadFailed) {
              toast.error(errorMessage)
            } else if (isVideoNode) {
              toast.error(
                formatStoryboardVideoFailedToast(node.data as CanvasVideoNodeData, err.message),
              )
            } else {
              toast.error(err.message || '运行失败')
            }
          }
          return false
        } finally {
          nodeAbortControllersRef.current.delete(nodeId)
          const bridge = getCanvasProjectRunBridge(projectId)
          if (bridge) bridge.markNodeIdle(nodeId)
          else markNodeIdle(nodeId)
        }
      })()

      registerCanvasInflightRun({ projectId, nodeId, promise: runPromise })
      return runPromise
    },
    [markNodeIdle, markNodeRunning, projectId, updateNodeData],
  )

  const runNode = useCallback(
    async (nodeId: string, options?: CanvasRunOptions & { silent?: boolean }) => {
      const node = nodesRef.current.find((item) => item.id === nodeId)
      const debugEnabled = useSettingsStore.getState().settings?.debugEnabled
      if (node?.type === CANVAS_NODE_TYPES.storyVideo && debugEnabled) {
        if (pendingWeishiVideo) {
          toast.info('请先确认或取消当前视频生成弹窗')
          return
        }
        if (hasCanvasInflightRun(projectId, nodeId)) {
          toast.info('该节点任务进行中，请稍候')
          return
        }
        if (runningNodeIdsRef.current.has(nodeId) && !isCanvasNodeRuntimeBusy(node)) {
          markNodeIdle(nodeId)
          releaseVideoResumeLock('canvas', projectId, nodeId)
        } else if (runningNodeIdsRef.current.has(nodeId)) {
          toast.info('该节点任务进行中，请稍候')
          return
        }
        setWeishiPreviewPreparing(true)
        setWeishiPreviewNodeId(nodeId)
        try {
          const prepared = await prepareCanvasVideoGeneratePreview(node, {
            projectId,
            nodes: nodesRef.current,
            edges: edgesRef.current,
            onImageNodePatch: (imageNodeId, patch) => updateNodeData(imageNodeId, patch),
          })
          if (prepared) {
            setPendingWeishiVideo({
              nodeId,
              options,
              preview: prepared.preview,
              preparedReferences: prepared.preparedReferences,
            })
            return
          }
        } catch (error: unknown) {
          toast.error((error as Error).message || '准备视频参数失败')
          return
        } finally {
          setWeishiPreviewPreparing(false)
          setWeishiPreviewNodeId(null)
        }
      }
      const ok = await executeNode(nodeId, options)
      flushPersist()
    },
    [executeNode, flushPersist, markNodeIdle, pendingWeishiVideo, projectId, updateNodeData],
  )

  const retryVideoDownload = useCallback(
    async (nodeId: string): Promise<boolean> => {
      const node = nodesRef.current.find((item) => item.id === nodeId)
      if (!node || node.type !== CANVAS_NODE_TYPES.storyVideo) {
        toast.error('仅视频节点可重新下载成片')
        return false
      }
      const data = node.data as CanvasVideoNodeData
      const remoteUrl = String(data.pendingDownloadUrl || '').trim()
      if (!remoteUrl) {
        toast.error('没有可重新下载的成片地址，请重新生成')
        return false
      }
      if (hasCanvasInflightRun(projectId, nodeId) || runningNodeIdsRef.current.has(nodeId)) {
        toast.info('该节点任务进行中，请稍候')
        return false
      }

      // 先切离 error，再登记 inflight，避免「error + UI running」被清理 effect 误判为残留而 stopNode
      patchCanvasNodeData(
        projectId,
        nodeId,
        {
          status: 'running',
          error: undefined,
          progressMessage: VIDEO_PROGRESS_DOWNLOADING.message,
        },
        { flush: true },
      )

      const abortController = new AbortController()
      nodeAbortControllersRef.current.set(nodeId, abortController)

      const runPromise = (async (): Promise<boolean> => {
        try {
          const settingsRes = await readSettings()
          if (!settingsRes.data) throw new Error('无法读取系统设置')
          const videoModels = useSettingsStore.getState().getMergedModels('video')
          const preferredId = data.videoModelId || canvasVideoParamsRef.current.videoModelId
          const model =
            videoModels.find(
              (item) =>
                item.id === preferredId || item.model === preferredId || item.name === preferredId,
            ) ?? videoModels[0]
          const outputPath = await saveCanvasGeneratedVideo({
            settings: settingsRes.data,
            appDataDir: settingsRes.appDataDir,
            projectId,
            nodeId,
            remoteUrl,
            apiKey: model?.apiKey,
            videoId:
              data.remoteJob?.provider === 'system' ? undefined : data.remoteJob?.apiTaskId,
            apiBaseUrl:
              data.remoteJob?.createUrl || model?.endpoint || model?.baseUrl,
            downloadRetries: 3,
            abortSignal: abortController.signal,
            allowUnauthenticatedDownload:
              !String(model?.apiKey || '').trim() ||
              /\/client\/system-models\/video\/jobs\//i.test(remoteUrl),
          })
          const successNow = Date.now()
          const successPatch = {
            outputPath,
            outputOwnerKind: 'canvas' as const,
            outputOwnerProjectId: projectId,
            status: 'success' as const,
            error: undefined,
            progressMessage: undefined,
            remoteJob: undefined,
            pendingDownloadUrl: undefined,
            statusUpdatedAt: successNow,
            ...buildCanvasVideoGenerationElapsedPatch(data, successNow),
          }
          patchCanvasNodeData(projectId, nodeId, successPatch, { flush: true })
          await finishCanvasVideoTask(projectId, nodeId, {
            status: 'success',
            patch: successPatch,
          })
          await flushPersist()
          toast.success('成片已重新下载')
          return true
        } catch (error: unknown) {
          if (isVideoGenerationAbortError(error)) {
            patchCanvasNodeData(
              projectId,
              nodeId,
              {
                status: 'error',
                error: '已取消下载',
                progressMessage: undefined,
                pendingDownloadUrl: remoteUrl,
              },
              { flush: true },
            )
            toast.message('已取消下载')
            return false
          }
          const message = formatVideoContentDownloadErrorMessage(error)
          patchCanvasNodeData(
            projectId,
            nodeId,
            {
              status: 'error',
              error: message,
              progressMessage: undefined,
              pendingDownloadUrl: remoteUrl,
              statusUpdatedAt: Date.now(),
            },
            { flush: true },
          )
          await patchCanvasNodeDataPersisted(projectId, nodeId, {
            status: 'error',
            error: message,
            progressMessage: undefined,
            pendingDownloadUrl: remoteUrl,
            statusUpdatedAt: Date.now(),
          })
          toast.error(message)
          return false
        } finally {
          nodeAbortControllersRef.current.delete(nodeId)
          const bridge = getCanvasProjectRunBridge(projectId)
          if (bridge) bridge.markNodeIdle(nodeId)
          else markNodeIdle(nodeId)
        }
      })()

      // 必须先登记 inflight，再 markNodeRunning，否则 error 态清理 effect 会 stopNode 误杀下载
      registerCanvasInflightRun({ projectId, nodeId, promise: runPromise })
      markNodeRunning(nodeId)
      return runPromise
    },
    [flushPersist, markNodeIdle, markNodeRunning, projectId],
  )

  const stopNode = useCallback(
    (nodeId: string) => {
      const hadSession =
        runningNodeIdsRef.current.has(nodeId) || hasCanvasInflightRun(projectId, nodeId)
      const hadResumeLock = hasVideoResumeLock('canvas', projectId, nodeId)
      // 即使无会话登记，也尽量 abort / 清 idle，便于节点侧强制清 residual
      nodeAbortControllersRef.current.get(nodeId)?.abort()
      cancelCanvasInflightRun(projectId, nodeId)
      releaseVideoResumeLock('canvas', projectId, nodeId)
      markNodeIdle(nodeId)
      return hadSession || hadResumeLock
    },
    [markNodeIdle, projectId],
  )

  const runBatchStoryboardVideosInternal = useCallback(
    async (
      nodeIds: readonly string[],
      runOptions?: CanvasRunOptions & { silent?: boolean },
    ) => {
      if (!nodeIds.length) return
      if (batchVideoGeneratingRef.current) {
        toast.info('批量生成进行中…')
        return
      }
      if (pendingWeishiVideo) {
        toast.info('请先确认或取消当前视频生成弹窗')
        return
      }

      const runningVideoCount = nodesRef.current.filter(
        (item) =>
          item.type === CANVAS_NODE_TYPES.storyVideo &&
          (runningNodeIdsRef.current.has(item.id) || hasCanvasInflightRun(projectId, item.id)),
      ).length
      if (runningVideoCount >= VIDEO_BATCH_CONCURRENCY) {
        toast.info(`最多同时生成 ${VIDEO_BATCH_CONCURRENCY} 个视频，请稍候`)
        return
      }

      batchVideoGeneratingRef.current = true
      setBatchVideoGenerating(true)
      let success = 0
      let failed = 0
      const successVideoNodes: CanvasVideoNodeData[] = []
      const failedVideoNodes: CanvasVideoNodeData[] = []
      try {
        await runCanvasBatchVideoGenerate({
          nodeIds,
          concurrency: VIDEO_BATCH_CONCURRENCY,
          runShot: async (nodeId) => {
            const node = nodesRef.current.find((item) => item.id === nodeId)
            if (!node || !isPendingCanvasVideoNode(node)) return
            const nodeData = node.data as CanvasVideoNodeData
            const ok = await executeNode(nodeId, { ...runOptions, silent: true })
            if (ok) {
              success += 1
              successVideoNodes.push(nodeData)
            } else {
              failed += 1
              failedVideoNodes.push(nodeData)
            }
          },
        })
        flushPersist()
        if (success > 0 || failed > 0) {
          const summary = formatBatchStoryboardVideoToast(successVideoNodes, failedVideoNodes)
          if (failed === 0) toast.success(summary)
          else if (success > 0) toast.message(summary)
          else toast.error(summary)
        }
      } finally {
        batchVideoGeneratingRef.current = false
        setBatchVideoGenerating(false)
      }
    },
    [executeNode, flushPersist, pendingWeishiVideo, projectId],
  )

  const requestBatchStoryboardVideos = useCallback(
    async (nodeIds: readonly string[]) => {
      if (!nodeIds.length) return
      await runBatchStoryboardVideosInternal(nodeIds, { silent: true })
    },
    [runBatchStoryboardVideosInternal],
  )

  const confirmWeishiVideo = useCallback(() => {
    if (!pendingWeishiVideo) return
    const { nodeId, options, preparedReferences, batchNodeIds } = pendingWeishiVideo
    setPendingWeishiVideo(null)
    if (batchNodeIds?.length) {
      void runBatchStoryboardVideosInternal(batchNodeIds, {
        ...options,
        weishiPreparedReferences: preparedReferences,
        silent: true,
      })
      return
    }
    void (async () => {
      await executeNode(nodeId, {
        ...options,
        weishiPreparedReferences: preparedReferences,
      })
      flushPersist()
    })()
  }, [executeNode, flushPersist, pendingWeishiVideo, runBatchStoryboardVideosInternal])

  const cancelWeishiVideo = useCallback(() => {
    setPendingWeishiVideo(null)
  }, [])

  const copySelection = useCallback(() => {
    const cloned = cloneCanvasSelection(nodesRef.current, edgesRef.current)
    if (!cloned) {
      toast.message('请先选中要复制的节点')
      return
    }
    clipboardRef.current = cloned
    toast.success(`已复制 ${cloned.nodes.length} 个节点`)
  }, [])

  const pasteVideoWithSource = useCallback(
    async (position: { x: number; y: number }, source: CanvasPasteVideoSource) => {
      const importedAspectRatio =
        source.kind === 'local' ? await resolveCanvasVideoImportAspectRatio(source.path) : undefined

      const node = createCanvasNode(CANVAS_NODE_TYPES.storyVideo, position, {
        ...assignDefaultVideoNodeData(nodesRef.current),
        ...canvasVideoProjectParamsToNodePatch(canvasVideoParamsRef.current),
        ...(importedAspectRatio ? { aspectRatio: importedAspectRatio } : {}),
        status: 'running',
        progressMessage: '正在导入视频…',
        error: undefined,
      })

      setNodes((current) => {
        const next = [...deselectAllNodes(current), node]
        nodesRef.current = next
        return next
      })
      schedulePersist()

      try {
        let outputPath: string
        let outputOwnerKind: CanvasVideoNodeData['outputOwnerKind'] = 'canvas'
        let outputOwnerProjectId = projectId

        if (source.kind === 'existing') {
          outputPath = source.outputPath
          outputOwnerKind = source.outputOwnerKind ?? 'canvas'
          outputOwnerProjectId = source.outputOwnerProjectId ?? projectId
        } else {
          const settingsRes = await readSettings()
          const base = {
            settings: settingsRes.data,
            appDataDir: settingsRes.appDataDir,
            projectId,
            nodeId: node.id,
          }
          outputPath =
            source.kind === 'local'
              ? await saveCanvasUploadedVideoFromFile({ ...base, sourcePath: source.path })
              : await saveCanvasGeneratedVideo({ ...base, remoteUrl: source.url })
        }

        updateNodeData(node.id, {
          outputPath,
          outputOwnerKind,
          outputOwnerProjectId,
          status: 'success',
          error: undefined,
          progressMessage: undefined,
          statusUpdatedAt: Date.now(),
        })
        flushPersist()
        toast.success('已粘贴视频')
      } catch (error: unknown) {
        const message = (error as Error).message || '粘贴视频失败'
        updateNodeData(node.id, {
          status: 'error',
          error: message,
          progressMessage: undefined,
          statusUpdatedAt: Date.now(),
        })
        flushPersist()
        toast.error(message)
      }
    },
    [flushPersist, projectId, schedulePersist, setNodes, updateNodeData],
  )

  const pasteImageWithSource = useCallback(
    async (position: { x: number; y: number }, source: CanvasPasteImageSource) => {
      const label =
        source.kind === 'dataUrl'
          ? undefined
          : deriveMediaBaseName(source.kind === 'local' ? source.path : source.url) || undefined
      const imageName = label
        ? label
        : generateCanvasDefaultImageName(collectCanvasImageNodeNames(nodesRef.current))

      const node = createCanvasNode(CANVAS_NODE_TYPES.imageNode, position, {
        ...assignDefaultImageNodeData(nodesRef.current, { imageName }),
        status: 'running',
        progressMessage: '正在导入图片…',
        error: undefined,
      })

      setNodes((current) => {
        const next = [...deselectAllNodes(current), node]
        nodesRef.current = next
        return next
      })
      schedulePersist()

      try {
        const settingsRes = await readSettings()
        const base = {
          settings: settingsRes.data,
          appDataDir: settingsRes.appDataDir,
          projectId,
          nodeId: node.id,
        }
        const outputPath =
          source.kind === 'local'
            ? await saveCanvasUploadedImageFromFile({ ...base, sourcePath: source.path })
            : source.kind === 'dataUrl'
              ? await saveCanvasUploadedImageFromDataUrl({ ...base, dataUrl: source.dataUrl })
              : await saveCanvasGeneratedImage({ ...base, remoteUrl: source.url })

        updateNodeData(node.id, {
          outputPath,
          outputOwnerKind: 'canvas',
          outputOwnerProjectId: projectId,
          status: 'success',
          error: undefined,
          progressMessage: undefined,
          statusUpdatedAt: Date.now(),
        })
        flushPersist()
        toast.success(source.kind === 'dataUrl' ? '已粘贴截图' : '已粘贴图片')
      } catch (error: unknown) {
        const message = (error as Error).message || '粘贴图片失败'
        updateNodeData(node.id, {
          status: 'error',
          error: message,
          progressMessage: undefined,
          statusUpdatedAt: Date.now(),
        })
        flushPersist()
        toast.error(message)
      }
    },
    [flushPersist, projectId, schedulePersist, setNodes, updateNodeData],
  )

  const pasteFromClipboard = useCallback(
    async (position?: { x: number; y: number }) => {
      const clip = clipboardRef.current
      if (clip) {
        const stamp = Date.now()
        const idMap = new Map<string, string>()
        const takenImageNames = collectCanvasImageNodeNames(nodesRef.current)
        const takenVideoNames = collectCanvasVideoNodeNames(nodesRef.current)
        const pastedNodes = clip.nodes.map((node, index) => {
          const nextId = `${node.type}_${stamp}_${index}`
          idMap.set(node.id, nextId)
          let data = { ...node.data }
          if (node.type === CANVAS_NODE_TYPES.imageNode) {
            const imageName = generateCanvasDefaultImageName(takenImageNames)
            takenImageNames.push(imageName)
            data = { ...data, imageName }
          } else if (node.type === CANVAS_NODE_TYPES.storyVideo) {
            const videoName = generateCanvasDefaultVideoName(takenVideoNames)
            takenVideoNames.push(videoName)
            data = { ...data, videoName }
          }
          return {
            ...node,
            id: nextId,
            selected: true,
            position: {
              x: node.position.x + 40,
              y: node.position.y + 40,
            },
            data,
          }
        })
        const pastedEdges = clip.edges.map((edge, index) => ({
          ...edge,
          id: `e_paste_${stamp}_${index}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }))

        setNodes((current) => {
          const next = [...deselectAllNodes(current), ...pastedNodes]
          nodesRef.current = next
          return next
        })
        setEdges((current) => {
          const next = [...current, ...pastedEdges]
          edgesRef.current = next
          return next
        })
        flushPersist()
        toast.success(`已粘贴 ${pastedNodes.length} 个节点`)
        return
      }

      const pastePosition = position ?? {
        x: 120 + nodesRef.current.length * 28,
        y: 80 + nodesRef.current.length * 28,
      }
      const systemPaste = await resolveCanvasPasteFromSystemClipboard()
      if (systemPaste?.media === 'video') {
        await pasteVideoWithSource(pastePosition, systemPaste.source)
        return
      }
      if (systemPaste?.media === 'image') {
        await pasteImageWithSource(pastePosition, systemPaste.source)
        return
      }

      toast.message('剪贴板为空：请先复制画布节点、截图/图片，或复制图片/视频路径或链接')
    },
    [flushPersist, pasteImageWithSource, pasteVideoWithSource, setEdges, setNodes],
  )

  const pasteVideoAtPosition = useCallback(
    async (position: { x: number; y: number }) => {
      const source = await resolveCanvasPasteVideoSource({
        internalNodes: clipboardRef.current?.nodes,
      })
      if (!source) {
        toast.error('剪贴板中没有可用的视频（请复制视频链接、本地视频路径或已生成的视频节点）')
        return
      }
      await pasteVideoWithSource(position, source)
    },
    [pasteVideoWithSource],
  )

  const importDroppedFilesAtPosition = useCallback(
    async (position: { x: number; y: number }, dataTransfer: DataTransfer) => {
      const mediaItems = collectCanvasDroppedMedia(dataTransfer)
      const scriptItems = collectCanvasDroppedScripts(dataTransfer)
      if (!mediaItems.length && !scriptItems.length) {
        toast.error('请拖入图片、视频，或文本（md/txt/docx）文件')
        return
      }

      const settingsRes = await readSettings()
      const mediaBase = {
        settings: settingsRes.data,
        appDataDir: settingsRes.appDataDir,
        projectId,
      }

      const pendingNodes = [...nodesRef.current]
      const created: Array<{ node: Node; item: (typeof mediaItems)[number] }> = []
      let dropIndex = 0

      for (let index = 0; index < mediaItems.length; index += 1) {
        const item = mediaItems[index]!
        const nodePosition = resolveCanvasDropNodePosition(position, dropIndex)
        dropIndex += 1
        if (item.kind === 'image') {
          const imageName =
            item.displayName ||
            generateCanvasDefaultImageName(collectCanvasImageNodeNames(pendingNodes))
          const node = createCanvasNode(CANVAS_NODE_TYPES.imageNode, nodePosition, {
            ...assignDefaultImageNodeData(pendingNodes, { imageName }),
            status: 'running',
            progressMessage: '正在导入图片…',
            error: undefined,
          })
          pendingNodes.push(node)
          created.push({ node, item })
          continue
        }

        const videoName = item.displayName
          ? formatCanvasVideoNodeName(item.displayName)
          : generateCanvasDefaultVideoName(collectCanvasVideoNodeNames(pendingNodes))
        const importedAspectRatio = await resolveCanvasVideoImportAspectRatio(item.localPath)
        const node = createCanvasNode(CANVAS_NODE_TYPES.storyVideo, nodePosition, {
          ...assignDefaultVideoNodeData(pendingNodes, { videoName }),
          ...canvasVideoProjectParamsToNodePatch(canvasVideoParamsRef.current),
          ...(importedAspectRatio ? { aspectRatio: importedAspectRatio } : {}),
          status: 'running',
          progressMessage: '正在导入视频…',
          error: undefined,
        })
        pendingNodes.push(node)
        created.push({ node, item })
      }

      const createdScriptNodes: Node[] = []
      let scriptFailCount = 0
      let scriptTruncated = false
      let anyLooksLikeTemplate = false

      for (let index = 0; index < scriptItems.length; index += 1) {
        const item = scriptItems[index]!
        const nodePosition = resolveCanvasDropNodePosition(position, dropIndex)
        dropIndex += 1
        try {
          const { text, truncated } = await importCanvasPromptTextFromFile(
            item.file,
            CANVAS_PROMPT_TEXT_MAX_LENGTH,
          )
          if (truncated) scriptTruncated = true
          if (looksLikeStoryboardTemplate(text)) anyLooksLikeTemplate = true
          const node = createCanvasNode(
            CANVAS_NODE_TYPES.shotPrompt,
            nodePosition,
            assignDefaultPromptNodeData(pendingNodes, {
              prompt: text,
              label: item.displayName,
              status: 'idle',
            }),
          )
          pendingNodes.push(node)
          createdScriptNodes.push(node)
        } catch (error: unknown) {
          scriptFailCount += 1
          toast.error((error as Error).message || `导入文本失败：${item.displayName}`)
        }
      }

      if (created.length || createdScriptNodes.length) {
        setNodes((current) => {
          const next = [
            ...deselectAllNodes(current),
            ...created.map((entry) => entry.node),
            ...createdScriptNodes,
          ]
          nodesRef.current = next
          return next
        })
        schedulePersist()
      }

      let imageCount = 0
      let videoCount = 0
      let failCount = 0

      for (const { node, item } of created) {
        try {
          if (item.kind === 'image') {
            const outputPath = item.localPath
              ? await saveCanvasUploadedImageFromFile({
                  ...mediaBase,
                  nodeId: node.id,
                  sourcePath: item.localPath,
                })
              : await saveCanvasUploadedImageFromDataUrl({
                  ...mediaBase,
                  nodeId: node.id,
                  dataUrl: await readDroppedImageDataUrl(item.file),
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
            imageCount += 1
            continue
          }

          if (!item.localPath) {
            throw new Error('请从文件夹拖入本地视频文件')
          }
          const outputPath = await saveCanvasUploadedVideoFromFile({
            ...mediaBase,
            nodeId: node.id,
            sourcePath: item.localPath,
          })
          const aspectRatio =
            (node.data as CanvasVideoNodeData).aspectRatio ||
            (await resolveCanvasVideoImportAspectRatio(item.localPath))
          updateNodeData(node.id, {
            outputPath,
            outputOwnerKind: 'canvas',
            outputOwnerProjectId: projectId,
            ...(aspectRatio ? { aspectRatio: aspectRatio } : {}),
            status: 'success',
            error: undefined,
            progressMessage: undefined,
            statusUpdatedAt: Date.now(),
          })
          videoCount += 1
        } catch (error: unknown) {
          failCount += 1
          updateNodeData(node.id, {
            status: 'error',
            error: (error as Error).message || '导入失败',
            progressMessage: undefined,
            statusUpdatedAt: Date.now(),
          })
        }
      }

      flushPersist()
      const parts: string[] = []
      if (imageCount) parts.push(`${imageCount} 张图片`)
      if (videoCount) parts.push(`${videoCount} 个视频`)
      if (createdScriptNodes.length) parts.push(`${createdScriptNodes.length} 个文本`)
      if (parts.length) {
        const hint = anyLooksLikeTemplate
          ? '，可用「导入分镜稿」拆镜'
          : createdScriptNodes.length
            ? '，可用「导入分镜稿」或「智能分镜」'
            : ''
        toast.success(`已导入 ${parts.join('、')}${hint}`)
      }
      if (scriptTruncated) {
        toast.error(
          `文本最多 ${CANVAS_PROMPT_TEXT_MAX_LENGTH.toLocaleString()} 字，已截断导入内容`,
        )
      }
      if (failCount || scriptFailCount) {
        toast.error(`${failCount + scriptFailCount} 个文件导入失败`)
      }

      if (createdScriptNodes.length === 1 && !created.length) {
        openPromptConsole(createdScriptNodes[0]!.id)
      }
    },
    [flushPersist, openPromptConsole, projectId, schedulePersist, setNodes, updateNodeData],
  )

  const clearCanvas = useCallback(() => {
    if (hasRunningNodes) {
      toast.message('请等待进行中的生成任务完成')
      return
    }
    if (!nodesRef.current.length && !edgesRef.current.length) {
      toast.message('画布已经是空的')
      return
    }

    const snap = cloneCanvasGraph(nodesRef.current, edgesRef.current)
    const last = historyPastRef.current[historyPastRef.current.length - 1]
    if (!last || !isSameCanvasGraph(last, snap)) {
      historyPastRef.current.push(snap)
    }

    applyingHistoryRef.current = true
    setNodes([])
    setEdges([])
    nodesRef.current = []
    edgesRef.current = []
    closeImageConsole()
    closeVideoConsole()
    closePromptConsole()
    closeAddNodeMenu()
    clipboardRef.current = null

    historyPastRef.current.push(cloneCanvasGraph([], []))
    historyFutureRef.current = []
    bumpHistory()

    window.requestAnimationFrame(() => {
      applyingHistoryRef.current = false
    })

    flushPersist()
    toast.success('已清空画布')
  }, [
    hasRunningNodes,
    setNodes,
    setEdges,
    closeImageConsole,
    closeVideoConsole,
    closePromptConsole,
    closeAddNodeMenu,
    bumpHistory,
    flushPersist,
  ])

  const addMaterialLibraryItems = useCallback(
    (items: MaterialLibraryItem[]) => {
      if (!items.length) return
      const anchor = resolveCanvasMaterialImportAnchor(nodesRef.current)
      const imported = buildCanvasNodesFromMaterialItems(items, anchor)
      setNodes((current) => {
        const next = [...current, ...imported]
        nodesRef.current = next
        return next
      })
      schedulePersist()
      toast.success(`已添加 ${imported.length} 个资产到画布`)
    },
    [setNodes, schedulePersist],
  )

  const closeMaterialLibrary = useCallback(() => {
    setMaterialLibraryOpen(false)
    setMaterialLibraryRequest(null)
  }, [])

  const openMaterialLibrary = useCallback((request: CanvasMaterialLibraryRequest) => {
    setMaterialLibraryRequest(request)
    setMaterialLibraryOpen(true)
  }, [])

  const openMaterialLibraryForNode = useCallback(
    (nodeId: string, nodeType: string, defaultKind?: CanvasImageAssetRole) => {
      openMaterialLibrary(
        createCanvasMaterialLibraryRequest(
          { type: 'pick', nodeId, nodeType },
          mapCanvasRoleToAssetKind(defaultKind),
        ),
      )
    },
    [openMaterialLibrary],
  )

  const handleMaterialLibraryConfirm = useCallback(
    async (items: MaterialLibraryItem[]) => {
      const request = materialLibraryRequest
      if (!request || !items.length) return

      if (request.intent.type === 'add-nodes') {
        addMaterialLibraryItems(items)
        closeMaterialLibrary()
        return
      }

      const item = items[0]
      const node = nodesRef.current.find((entry) => entry.id === request.intent.nodeId)
      if (!node || !item) {
        closeMaterialLibrary()
        return
      }

      const patch = buildCanvasNodePatchFromMaterialItem(node.type || '', item)
      const previewPath = String(patch.outputPath || patch.imagePath || '').trim()
      if (!previewPath) {
        toast.error('该素材没有可用图片')
        return
      }

      updateNodeData(request.intent.nodeId, patch)
      if (node.type === CANVAS_NODE_TYPES.imageNode) {
        openImageConsole(request.intent.nodeId)
      } else if (node.type === CANVAS_NODE_TYPES.storyVideo) {
        openVideoConsole(request.intent.nodeId)
      }
      schedulePersist()
      closeMaterialLibrary()
      toast.success('已从素材库选择资产')
    },
    [
      materialLibraryRequest,
      addMaterialLibraryItems,
      closeMaterialLibrary,
      updateNodeData,
      openImageConsole,
      openVideoConsole,
      schedulePersist,
    ],
  )

  const value = useMemo(
    () => ({
      projectId,
      nodes,
      edges,
      setNodes,
      setEdges,
      onNodesChange: handleNodesChange,
      onEdgesChange: handleEdgesChange,
      onConnect,
      isValidConnection,
      applyFrameSnapConnection,
      onMoveEnd,
      updateNodeData,
      canvasVideoParams,
      updateCanvasVideoParams,
      applyCanvasVideoParamsToAllNodes,
      runNode,
      retryVideoDownload,
      requestBatchStoryboardVideos,
      batchVideoGenerating,
      stopNode,
      copySelection,
      pasteFromClipboard,
      pasteVideoAtPosition,
      importDroppedFilesAtPosition,
      undo,
      redo,
      canUndo,
      canRedo,
      isNodeRunning,
      releaseNodeRunSession,
      hasRunningNodes,
      flushPersist,
      imageConsoleNodeId,
      openImageConsole,
      closeImageConsole,
      promptConsoleNodeId,
      openPromptConsole,
      closePromptConsole,
      activatePromptConsole,
      videoConsoleNodeId,
      openVideoConsole,
      closeVideoConsole,
      activateVideoConsole,
      videoExtractAudioRequest,
      requestVideoExtractAudio,
      addNodeMenuAnchor,
      openAddNodeMenu,
      closeAddNodeMenu,
      addCanvasNode,
      appendCanvasGraph,
      duplicateNode,
      deleteNode,
      removeNodesByIds,
      deleteSelectedNodes,
      pendingDeleteConfirm: pendingDelete
        ? {
            count: pendingDelete.removeIds.length,
            labels: pendingDelete.labels,
            hasRunning: pendingDelete.hasRunning,
            storyboardShotNumbers: pendingDelete.storyboardShotNumbers,
          }
        : null,
      confirmPendingDelete,
      cancelPendingDelete,
      groupSelectedNodes,
      removeEdge,
      clearCanvas,
      addMaterialLibraryItems,
      openMaterialLibrary,
      openMaterialLibraryForNode,
      closeMaterialLibrary,
      pendingWeishiVideo: pendingWeishiVideo
        ? { nodeId: pendingWeishiVideo.nodeId, preview: pendingWeishiVideo.preview }
        : null,
      weishiPreviewPreparing,
      weishiPreviewNodeId,
      confirmWeishiVideo,
      cancelWeishiVideo,
      agentPanelOpen,
      setAgentPanelOpen,
      agentReferencedNodeIds,
      agentReferenceEnabled,
      setAgentReferenceEnabled,
      agentSkillMode,
      setAgentSkillMode,
      toggleAgentReference,
      removeAgentReference,
      clearAgentReferences,
      promptAiBusy,
      setPromptAiBusy,
      cancelPromptAi,
    }),
    [
      projectId,
      nodes,
      edges,
      setNodes,
      setEdges,
      handleNodesChange,
      handleEdgesChange,
      onConnect,
      isValidConnection,
      applyFrameSnapConnection,
      onMoveEnd,
      updateNodeData,
      canvasVideoParams,
      updateCanvasVideoParams,
      applyCanvasVideoParamsToAllNodes,
      runNode,
      retryVideoDownload,
      requestBatchStoryboardVideos,
      batchVideoGenerating,
      stopNode,
      copySelection,
      pasteFromClipboard,
      pasteVideoAtPosition,
      importDroppedFilesAtPosition,
      undo,
      redo,
      canUndo,
      canRedo,
      historyVersion,
      isNodeRunning,
      hasRunningNodes,
      flushPersist,
      imageConsoleNodeId,
      openImageConsole,
      closeImageConsole,
      promptConsoleNodeId,
      openPromptConsole,
      closePromptConsole,
      activatePromptConsole,
      videoConsoleNodeId,
      openVideoConsole,
      closeVideoConsole,
      activateVideoConsole,
      videoExtractAudioRequest,
      requestVideoExtractAudio,
      addNodeMenuAnchor,
      openAddNodeMenu,
      closeAddNodeMenu,
      addCanvasNode,
      appendCanvasGraph,
      duplicateNode,
      deleteNode,
      removeNodesByIds,
      deleteSelectedNodes,
      pendingDelete,
      confirmPendingDelete,
      cancelPendingDelete,
      groupSelectedNodes,
      removeEdge,
      clearCanvas,
      addMaterialLibraryItems,
      openMaterialLibrary,
      openMaterialLibraryForNode,
      closeMaterialLibrary,
      pendingWeishiVideo,
      weishiPreviewPreparing,
      weishiPreviewNodeId,
      confirmWeishiVideo,
      cancelWeishiVideo,
      agentPanelOpen,
      setAgentPanelOpen,
      agentReferencedNodeIds,
      agentReferenceEnabled,
      setAgentReferenceEnabled,
      agentSkillMode,
      setAgentSkillMode,
      toggleAgentReference,
      removeAgentReference,
      clearAgentReferences,
      promptAiBusy,
      setPromptAiBusy,
      cancelPromptAi,
    ],
  )

  return (
    <CanvasEditorContext.Provider value={value}>
      {children}
      <CanvasMaterialLibraryHost
        open={materialLibraryOpen}
        request={materialLibraryRequest}
        nodes={nodes}
        onClose={closeMaterialLibrary}
        onConfirm={handleMaterialLibraryConfirm}
      />
    </CanvasEditorContext.Provider>
  )
}
