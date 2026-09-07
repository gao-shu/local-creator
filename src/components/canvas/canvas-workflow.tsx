// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Background, BackgroundVariant, MiniMap, ReactFlow, ReactFlowProvider, SelectionMode, useReactFlow, type FinalConnectionState, type Node, type OnSelectionChangeParams } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  CanvasEditorProvider,
  useCanvasEditor,
} from '@/components/canvas/canvas-editor-context'
import { CanvasAgentSidebar } from '@/components/canvas/canvas-agent-sidebar'
import { CanvasDoubaoWebPanel } from '@/components/canvas/canvas-doubao-web-panel'
import { CanvasParamsPanel } from '@/components/canvas/canvas-params-panel'
import { CanvasRunQueuePanel } from '@/components/canvas/canvas-run-queue-panel'
import { CanvasAddNodeMenu } from '@/components/canvas/canvas-add-node-menu'
import { CanvasFloatingToolbar } from '@/components/canvas/canvas-floating-toolbar'
import { CanvasEpisodeExportDialog } from '@/components/canvas/canvas-episode-export-dialog'
import { CANVAS_CONNECTION_RADIUS } from '@/lib/canvas/canvas-edge-utils'
import { resolveCanvasFrameConnectEnd } from '@/lib/canvas/canvas-frame-connect'
import {
  buildCanvasAddNodeConnectionFromConnectState,
  shouldOpenAddNodeMenuOnConnectEnd,
} from '@/lib/canvas/canvas-add-node-connection'
import { CANVAS_PASTE_VIDEO_ACTION } from '@/lib/canvas/canvas-paste-video'
import {
  CANVAS_PROMPT_EXTRACT_ACTION,
  CANVAS_PROMPT_STORYBOARD_ACTION,
  CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION,
  CANVAS_VIDEO_EXTRACT_AUDIO_ACTION,
} from '@/lib/canvas/canvas-menu-actions'
import {
  runCanvasEditorPromptExtract,
  runCanvasEditorPromptStoryboard,
  runCanvasEditorPromptTemplateImport,
  CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM,
  type CanvasPromptAiActionOptions,
  type CanvasPromptAiEditorContext,
} from '@/lib/canvas/canvas-prompt-ai-actions'
import { resolveCanvasVideoExtractSourceNode } from '@/lib/canvas/canvas-video-extract-audio'
import { useSettingsStore } from '@/stores/settings-store'
import { CanvasViewportToolbar } from '@/components/canvas/canvas-viewport-toolbar'
import { CanvasAiBar } from '@/components/canvas/toolbar/canvas-ai-bar'
import { CanvasSelectionToolbar } from '@/components/canvas/canvas-selection-toolbar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { WeishiVideoConfirmDialog } from '@/components/workshop/weishi-video-confirm-dialog'
import { canvasNodeTypes } from '@/components/canvas/canvas-node-types'
import { canvasEdgeTypes } from '@/components/canvas/canvas-edge-types'
import { CanvasConnectionLine } from '@/components/canvas/canvas-connection-line'
import { createCanvasMaterialLibraryRequest } from '@/lib/canvas/canvas-material-import'
import { dataTransferMayContainCanvasMedia } from '@/lib/canvas/canvas-file-drop'
import {
  endNativeVideoDragSession,
  shouldSuppressCanvasFileDropFromNativeVideoDrag,
} from '@/lib/canvas/canvas-native-video-drag-guard'
import { resolveCanvasTheme } from '@/lib/canvas/canvas-theme'
import { formatStoryboardShotsDeleteConfirmDescription } from '@/lib/canvas/canvas-shot-utils'
import { resolveSelectedVideoDragItems, getSelectedCanvasVideoNodes } from '@/lib/canvas/canvas-video-drag-items'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { useDocumentDarkMode } from '@/hooks/use-document-dark-mode'
import type { CanvasProjectData, CanvasProjectMeta } from '@/types/canvas'
import type { CanvasAgentSkillId } from '@/lib/canvas/canvas-agent-types'

interface CanvasWorkflowProps {
  projectId: string
  initialData: CanvasProjectData
  onPersist: (data: CanvasProjectData) => void | Promise<void>
  saving?: boolean
  exportDialogOpen?: boolean
  onExportDialogOpenChange?: (open: boolean) => void
  agentOpen?: boolean
  onAgentOpenChange?: (open: boolean) => void
  pendingAgentSkill?: CanvasAgentSkillId | null
  onPendingAgentSkillConsumed?: () => void
  doubaoOpen?: boolean
  onDoubaoOpenChange?: (open: boolean) => void
  paramsOpen?: boolean
  onParamsOpenChange?: (open: boolean) => void
  queueOpen?: boolean
  onQueueOpenChange?: (open: boolean) => void
  canvasMeta?: CanvasProjectMeta | null
}

function CanvasFlowSurface({
  projectId,
  canvasMeta,
  saving,
  exportDialogOpen = false,
  onExportDialogOpenChange,
  agentOpen = false,
  onAgentOpenChange,
  pendingAgentSkill = null,
  onPendingAgentSkillConsumed,
  doubaoOpen = false,
  onDoubaoOpenChange,
  paramsOpen = false,
  onParamsOpenChange,
  queueOpen = false,
  onQueueOpenChange,
}: {
  projectId: string
  canvasMeta?: CanvasProjectMeta | null
  saving?: boolean
  exportDialogOpen?: boolean
  onExportDialogOpenChange?: (open: boolean) => void
  agentOpen?: boolean
  onAgentOpenChange?: (open: boolean) => void
  pendingAgentSkill?: CanvasAgentSkillId | null
  onPendingAgentSkillConsumed?: () => void
  doubaoOpen?: boolean
  onDoubaoOpenChange?: (open: boolean) => void
  paramsOpen?: boolean
  onParamsOpenChange?: (open: boolean) => void
  queueOpen?: boolean
  onQueueOpenChange?: (open: boolean) => void
}) {
  const { screenToFlowPosition, fitView } = useReactFlow()
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    applyFrameSnapConnection,
    onMoveEnd,
    copySelection,
    pasteFromClipboard,
    hasRunningNodes,
    undo,
    redo,
    canUndo,
    canRedo,
    closeImageConsole,
    closeVideoConsole,
    closePromptConsole,
    openPromptConsole,
    appendCanvasGraph,
    updateNodeData,
    imageConsoleNodeId,
    videoConsoleNodeId,
    addNodeMenuAnchor,
    openAddNodeMenu,
    closeAddNodeMenu,
    addCanvasNode,
    pasteVideoAtPosition,
    importDroppedFilesAtPosition,
    clearCanvas,
    openMaterialLibrary,
    pendingWeishiVideo,
    confirmWeishiVideo,
    cancelWeishiVideo,
    setAgentPanelOpen,
    setAgentSkillMode,
    deleteSelectedNodes,
    pendingDeleteConfirm,
    confirmPendingDelete,
    cancelPendingDelete,
    promptAiBusy,
    setPromptAiBusy,
    removeNodesByIds,
    requestVideoExtractAudio,
    isNodeRunning,
    isValidConnection,
  } = useCanvasEditor()
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false)
  const pendingExtractOptionsRef = useRef<CanvasPromptAiActionOptions | null>(null)
  const [minimapOpen, setMinimapOpen] = useState(true)
  const [draggingMedia, setDraggingMedia] = useState(false)
  const settings = useSettingsStore((state) => state.settings)
  const appDataDir = useSettingsStore((state) => state.appDataDir)
  const isDark = useDocumentDarkMode()
  const canvasTheme = useMemo(() => resolveCanvasTheme(isDark), [isDark])

  useEffect(() => {
    setAgentPanelOpen(agentOpen)
  }, [agentOpen, setAgentPanelOpen])

  /** Skills 池深链：打开侧栏并切换到目标 Skill（仍走现有 Agent Sidebar） */
  useEffect(() => {
    if (!pendingAgentSkill) return
    setAgentSkillMode(pendingAgentSkill)
    onAgentOpenChange?.(true)
    onPendingAgentSkillConsumed?.()
  }, [
    onAgentOpenChange,
    onPendingAgentSkillConsumed,
    pendingAgentSkill,
    setAgentSkillMode,
  ])

  const defaultEdgeOptions = useMemo(
    () => ({
      type: 'canvas' as const,
      selectable: true,
      focusable: true,
      pathOptions: { curvature: 0.45 },
      style: { stroke: canvasTheme.edgeStroke, strokeWidth: 1.5 },
    }),
    [canvasTheme.edgeStroke],
  )

  const handleConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: FinalConnectionState) => {
      const result = resolveCanvasFrameConnectEnd({ nodes, edges, connectionState })
      if (result.action === 'snap') {
        applyFrameSnapConnection(
          result.connection,
          result.replace ? { replace: result.replace } : undefined,
        )
        return
      }

      if (!shouldOpenAddNodeMenuOnConnectEnd(connectionState, result.action)) return

      const connection = buildCanvasAddNodeConnectionFromConnectState(connectionState)
      if (!connection) return

      const screenX =
        'clientX' in event ? event.clientX : event.changedTouches?.[0]?.clientX ?? 0
      const screenY =
        'clientY' in event ? event.clientY : event.changedTouches?.[0]?.clientY ?? 0
      const position = screenToFlowPosition({ x: screenX, y: screenY })

      closeImageConsole()
      closeVideoConsole()
      closePromptConsole()

      openAddNodeMenu({
        screenX,
        screenY,
        flowX: position.x,
        flowY: position.y,
        connection,
      })
    },
    [
      applyFrameSnapConnection,
      closeImageConsole,
      closePromptConsole,
      closeVideoConsole,
      edges,
      nodes,
      openAddNodeMenu,
      screenToFlowPosition,
    ],
  )

  useEffect(() => {
    const shouldBypassCanvasShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return true
      }
      if (target?.closest('[data-canvas-shortcut-lock]')) return true
      const selectedText = window.getSelection()?.toString().trim()
      if (selectedText) return true
      return false
    }

    const handler = (event: KeyboardEvent) => {
      if (shouldBypassCanvasShortcut(event)) return
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        copySelection()
      }
      if (mod && event.key.toLowerCase() === 'v') {
        event.preventDefault()
        const position = screenToFlowPosition({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        })
        void pasteFromClipboard(position)
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        redo()
      } else if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      } else if (mod && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [copySelection, pasteFromClipboard, screenToFlowPosition, undo, redo])

  const handleAddNode = useCallback(
    (type: string, data?: Record<string, unknown>, position?: { x: number; y: number }) => {
      addCanvasNode(
        type,
        position ?? { x: 120 + nodes.length * 28, y: 80 + nodes.length * 28 },
        undefined,
        data,
      )
    },
    [addCanvasNode, nodes.length],
  )

  const promptAiContext = useMemo<CanvasPromptAiEditorContext>(
    () => ({
      projectId,
      nodes,
      edges,
      settings,
      appendCanvasGraph,
      updateNodeData,
      openPromptConsole,
      promptAiBusy,
      setPromptAiBusy,
      removeNodesByIds,
      onStoryboardNodesCreated: (nodeIds: string[]) => {
        const many = nodeIds.length >= 12
        void fitView({
          nodes: nodeIds.map((id) => ({ id })),
          padding: many ? 0.32 : 0.22,
          duration: 360,
          maxZoom: many ? 0.72 : 0.95,
          minZoom: 0.08,
        })
      },
    }),
    [
      appendCanvasGraph,
      edges,
      fitView,
      nodes,
      openPromptConsole,
      projectId,
      promptAiBusy,
      removeNodesByIds,
      setPromptAiBusy,
      settings,
      updateNodeData,
    ],
  )

  const runPromptExtract = useCallback(
    async (options?: CanvasPromptAiActionOptions) => {
      const result = await runCanvasEditorPromptExtract(promptAiContext, options)
      if (result === 'needs_confirm') {
        pendingExtractOptionsRef.current = options ?? null
        setExtractConfirmOpen(true)
      }
    },
    [promptAiContext],
  )

  const handleAddNodeMenuSelect = useCallback(
    (type: string, position: { x: number; y: number }, data?: Record<string, unknown>) => {
      if (type === CANVAS_PASTE_VIDEO_ACTION) {
        void pasteVideoAtPosition(position)
        return
      }
      if (type === CANVAS_PROMPT_STORYBOARD_ACTION) {
        void runCanvasEditorPromptStoryboard(promptAiContext)
        return
      }
      if (type === CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION) {
        runCanvasEditorPromptTemplateImport(promptAiContext, {
          sourceNodeId: addNodeMenuAnchor?.connection?.nodeId,
        })
        return
      }
      if (type === CANVAS_PROMPT_EXTRACT_ACTION) {
        void runPromptExtract({
          sourceNodeId: addNodeMenuAnchor?.connection?.nodeId,
        })
        return
      }
      if (type === CANVAS_VIDEO_EXTRACT_AUDIO_ACTION) {
        const source = resolveCanvasVideoExtractSourceNode(nodes, {
          connection: addNodeMenuAnchor?.connection,
        })
        if (source) requestVideoExtractAudio(source.id)
        return
      }
      addCanvasNode(type, position, addNodeMenuAnchor?.connection, data)
    },
    [
      addCanvasNode,
      addNodeMenuAnchor?.connection,
      nodes,
      pasteVideoAtPosition,
      promptAiContext,
      requestVideoExtractAudio,
      runPromptExtract,
    ],
  )

  const handleFloatingToolbarAddNode = useCallback(
    (type: string, data?: Record<string, unknown>) => {
      const defaultPosition = { x: 120 + nodes.length * 28, y: 80 + nodes.length * 28 }
      if (type === CANVAS_PASTE_VIDEO_ACTION) {
        void pasteVideoAtPosition(defaultPosition)
        return
      }
      if (type === CANVAS_PROMPT_STORYBOARD_ACTION) {
        void runCanvasEditorPromptStoryboard(promptAiContext)
        return
      }
      if (type === CANVAS_PROMPT_TEMPLATE_IMPORT_ACTION) {
        runCanvasEditorPromptTemplateImport(promptAiContext)
        return
      }
      if (type === CANVAS_PROMPT_EXTRACT_ACTION) {
        void runPromptExtract()
        return
      }
      handleAddNode(type, data)
    },
    [handleAddNode, nodes.length, pasteVideoAtPosition, promptAiContext, runPromptExtract],
  )

  const runningNodeIdsForMenu = useMemo(() => {
    const ids = new Set<string>()
    for (const node of nodes) {
      if (isNodeRunning(node.id)) ids.add(node.id)
    }
    return ids
  }, [isNodeRunning, nodes])

  const selectedNodeCount = useMemo(
    () => nodes.filter((node) => node.selected).length,
    [nodes],
  )

  const pendingDeleteDialogCopy = useMemo(() => {
    if (!pendingDeleteConfirm) {
      return { title: '删除节点？', description: '将删除选中的节点及其连线。' }
    }
    const { count, hasRunning, labels, storyboardShotNumbers } = pendingDeleteConfirm
    const shotCount = storyboardShotNumbers.length
    const allStoryboardShots = shotCount > 0 && shotCount === count
    const shotDescription = formatStoryboardShotsDeleteConfirmDescription(storyboardShotNumbers)

    if (hasRunning) {
      const runningHint = `以下节点任务进行中：${labels.slice(0, 4).join('、')}${
        labels.length > 4 ? ' 等' : ''
      }。删除后本地入口会消失，远端任务不会自动取消，仍可能继续扣费/生成。`
      return {
        title: allStoryboardShots
          ? shotCount === 1
            ? '删除分镜？'
            : `删除 ${shotCount} 镜？`
          : `删除 ${count} 个节点？`,
        description: allStoryboardShots ? `${shotDescription}\n\n${runningHint}` : runningHint,
      }
    }

    return {
      title: allStoryboardShots
        ? shotCount === 1
          ? '删除分镜？'
          : `删除 ${shotCount} 镜？`
        : `删除 ${count} 个节点？`,
      description: allStoryboardShots
        ? shotDescription
        : shotCount > 0
          ? `${shotDescription}\n\n其余 ${count - shotCount} 个非分镜节点也会一并删除。`
          : `将删除选中的 ${count} 个节点及其连线。`,
    }
  }, [pendingDeleteConfirm])

  const selectedVideoDragItems = useMemo(
    () =>
      resolveSelectedVideoDragItems({
        nodes,
        canvasProjectId: projectId,
        settings,
        appDataDir,
      }),
    [appDataDir, nodes, projectId, settings],
  )

  const selectedVideoCount = useMemo(
    () => getSelectedCanvasVideoNodes(nodes).length,
    [nodes],
  )

  const selectedBusy = useMemo(
    () => nodes.some((node) => node.selected && isNodeRunning(node.id)),
    [isNodeRunning, nodes],
  )

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      if (selectedNodes.length === 1) return
      closeImageConsole()
      closeVideoConsole()
      closePromptConsole()
    },
    [closeImageConsole, closeVideoConsole, closePromptConsole],
  )

  const handleNodeClick = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      const isPromptNode =
        node.type === CANVAS_NODE_TYPES.shotPrompt ||
        node.type === 'textNode' ||
        node.type === 'storyPrompt'
      if (!isPromptNode) return
      if (!imageConsoleNodeId && !videoConsoleNodeId) return
      openPromptConsole(node.id)
    },
    [imageConsoleNodeId, openPromptConsole, videoConsoleNodeId],
  )

  const handlePaneClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.detail === 1) {
        closeImageConsole()
        closeVideoConsole()
        closePromptConsole()
        return
      }
      if (event.detail !== 2) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      openAddNodeMenu({
        screenX: event.clientX,
        screenY: event.clientY,
        flowX: position.x,
        flowY: position.y,
      })
    },
    [screenToFlowPosition, closeImageConsole, closeVideoConsole, closePromptConsole, openAddNodeMenu],
  )

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      closeImageConsole()
      closeVideoConsole()
      closePromptConsole()
      closeAddNodeMenu()
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      openAddNodeMenu({
        screenX: event.clientX,
        screenY: event.clientY,
        flowX: position.x,
        flowY: position.y,
      })
    },
    [screenToFlowPosition, closeImageConsole, closeVideoConsole, closePromptConsole, closeAddNodeMenu, openAddNodeMenu],
  )

  /** drop 后短时忽略 dragover，避免 Electron 残留 dragover 再次点亮紫色框 */
  const suppressDraggingMediaUntilRef = useRef(0)

  const clearDraggingMedia = useCallback(() => {
    suppressDraggingMediaUntilRef.current = Date.now() + 400
    setDraggingMedia(false)
  }, [])

  // 节点内 drop 会 stopPropagation：须用 capture 监听，才能清掉全屏紫色拖放遮罩
  useEffect(() => {
    const onDragFinished = () => {
      endNativeVideoDragSession()
      clearDraggingMedia()
    }
    window.addEventListener('dragend', onDragFinished, true)
    window.addEventListener('drop', onDragFinished, true)
    window.addEventListener('canvas-clear-dragging-media', onDragFinished)
    return () => {
      window.removeEventListener('dragend', onDragFinished, true)
      window.removeEventListener('drop', onDragFinished, true)
      window.removeEventListener('canvas-clear-dragging-media', onDragFinished)
    }
  }, [clearDraggingMedia])

  const handlePaneDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()
      clearDraggingMedia()
      // 从「拖拽到剪映」松手回画布时，不导入复制节点
      if (shouldSuppressCanvasFileDropFromNativeVideoDrag()) {
        endNativeVideoDragSession()
        return
      }
      if (!dataTransferMayContainCanvasMedia(event.dataTransfer)) return
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })
      void importDroppedFilesAtPosition(position, event.dataTransfer)
    },
    [clearDraggingMedia, importDroppedFilesAtPosition, screenToFlowPosition],
  )

  const handlePaneDragOver = useCallback((event: React.DragEvent) => {
    if (shouldSuppressCanvasFileDropFromNativeVideoDrag()) return
    if (!dataTransferMayContainCanvasMedia(event.dataTransfer)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (Date.now() < suppressDraggingMediaUntilRef.current) return
    setDraggingMedia(true)
  }, [])

  const handlePaneDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    const related = event.relatedTarget
    if (related instanceof globalThis.Node && event.currentTarget.contains(related)) return
    clearDraggingMedia()
  }, [clearDraggingMedia])

  const busy = hasRunningNodes

  return (
    <div
      data-testid="canvas-workflow-surface"
      className="canvas-workflow-surface relative flex h-full w-full min-h-0 overflow-hidden rounded-xl border border-border/25 bg-[var(--canvas-workflow-bg)]"
    >
      <CanvasFloatingToolbar
        saving={saving}
        canClear={nodes.length > 0 && !busy}
        nodes={nodes}
        promptAiBusy={promptAiBusy}
        onAddNode={(type, data) => handleFloatingToolbarAddNode(type, data)}
        onClearCanvas={() => setClearConfirmOpen(true)}
        onOpenMaterialLibrary={() =>
          openMaterialLibrary(createCanvasMaterialLibraryRequest({ type: 'add-nodes' }, 'character'))
        }
      />

      <div
        className="relative min-w-0 flex-1 min-h-0"
        onDragOver={handlePaneDragOver}
        onDragLeave={handlePaneDragLeave}
        onDropCapture={clearDraggingMedia}
        onDrop={handlePaneDrop}
      >
        {nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
            <div className="space-y-2 text-center">
              <p className="text-sm text-muted-foreground/70">双击或右键画布添加节点</p>
              <p className="text-xs text-muted-foreground/45">或从文件夹拖入图片 / 视频 / 文本（md/txt）</p>
            </div>
          </div>
        ) : null}

        {draggingMedia ? (
          <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center rounded-xl border-2 border-dashed border-violet-400/55 bg-violet-500/8">
            <p className="text-sm font-medium text-violet-600/90 dark:text-violet-300/90">
              松开鼠标导入图片、视频或文本节点
            </p>
          </div>
        ) : null}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={canvasNodeTypes}
          edgeTypes={canvasEdgeTypes}
          edgesFocusable
          elementsSelectable
          nodesDraggable
          edgesReconnectable={false}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          onConnectEnd={handleConnectEnd}
          onMoveEnd={onMoveEnd}
          onNodeClick={handleNodeClick}
          onSelectionChange={handleSelectionChange}
          onPaneClick={handlePaneClick}
          onPaneContextMenu={handlePaneContextMenu}
          connectOnClick={false}
          connectionDragThreshold={6}
          connectionRadius={CANVAS_CONNECTION_RADIUS}
          connectionLineComponent={CanvasConnectionLine}
          nodeDragThreshold={3}
          selectionOnDrag
          selectionKeyCode="Control"
          selectionMode={SelectionMode.Partial}
          multiSelectionKeyCode="Control"
          panOnDrag
          zoomOnDoubleClick={false}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView={nodes.length > 0}
          minZoom={0.08}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
          deleteKeyCode={['Backspace', 'Delete']}
          proOptions={{ hideAttribution: true }}
          style={{ backgroundColor: canvasTheme.workflowBg }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1.4}
            color={canvasTheme.dotColor}
          />
          {minimapOpen ? (
            <MiniMap
              pannable
              zoomable
              position="bottom-left"
              className="canvas-minimap !mb-[54px] !ml-2"
              style={{
                width: 148,
                height: 92,
                borderRadius: 6,
              }}
              bgColor={canvasTheme.minimapBg}
              nodeColor={canvasTheme.minimapNode}
              nodeBorderRadius={4}
              maskColor={canvasTheme.minimapMask}
              maskStrokeColor={canvasTheme.minimapMaskStroke}
              maskStrokeWidth={1.5}
            />
          ) : null}
        </ReactFlow>

        <CanvasSelectionToolbar
          count={selectedNodeCount}
          selectedBusy={selectedBusy}
          videoDragItems={selectedVideoDragItems}
          selectedVideoCount={selectedVideoCount}
          onDelete={deleteSelectedNodes}
        />

        <CanvasViewportToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          hasNodes={nodes.length > 0}
          onUndo={undo}
          onRedo={redo}
          minimapOpen={minimapOpen}
          onToggleMinimap={() => setMinimapOpen((open) => !open)}
        />

        <CanvasAiBar projectId={projectId} />

        <CanvasAddNodeMenu
          anchor={addNodeMenuAnchor}
          nodes={nodes}
          promptAiBusy={promptAiBusy}
          runningNodeIds={runningNodeIdsForMenu}
          onSelect={(type, position, data) => {
            handleAddNodeMenuSelect(type, position, data)
            closeAddNodeMenu()
          }}
          onClose={closeAddNodeMenu}
        />

        <ConfirmDialog
          open={clearConfirmOpen}
          title="清空画布？"
          description="将删除画布上的所有节点与连线。清空后可通过撤销（Ctrl+Z）恢复。"
          confirmLabel="清空"
          cancelLabel="取消"
          variant="destructive"
          onClose={() => setClearConfirmOpen(false)}
          onConfirm={() => {
            clearCanvas()
            setClearConfirmOpen(false)
          }}
        />

        <ConfirmDialog
          open={extractConfirmOpen}
          title={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.title}
          description={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.description}
          confirmLabel={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.confirmLabel}
          cancelLabel={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.cancelLabel}
          variant="destructive"
          onClose={() => {
            setExtractConfirmOpen(false)
            pendingExtractOptionsRef.current = null
          }}
          onConfirm={() => {
            const pending = pendingExtractOptionsRef.current
            setExtractConfirmOpen(false)
            pendingExtractOptionsRef.current = null
            void runPromptExtract({ ...pending, confirmed: true })
          }}
        />

        <ConfirmDialog
          open={Boolean(pendingDeleteConfirm)}
          title={pendingDeleteDialogCopy.title}
          description={pendingDeleteDialogCopy.description}
          confirmLabel="仍要删除"
          cancelLabel="取消"
          variant="destructive"
          onClose={cancelPendingDelete}
          onConfirm={confirmPendingDelete}
        />

        <WeishiVideoConfirmDialog
          open={Boolean(pendingWeishiVideo)}
          preview={pendingWeishiVideo?.preview ?? null}
          onClose={cancelWeishiVideo}
          onConfirm={confirmWeishiVideo}
        />

        <CanvasEpisodeExportDialog
          open={exportDialogOpen}
          onClose={() => onExportDialogOpenChange?.(false)}
          canvasProjectId={projectId}
          meta={canvasMeta}
        />
      </div>

      <CanvasAgentSidebar open={agentOpen} onClose={() => onAgentOpenChange?.(false)} />
      <CanvasParamsPanel open={paramsOpen} onClose={() => onParamsOpenChange?.(false)} />
      {queueOpen ? <CanvasRunQueuePanel onClose={() => onQueueOpenChange?.(false)} /> : null}
      <CanvasDoubaoWebPanel
        open={doubaoOpen}
        onClose={() => onDoubaoOpenChange?.(false)}
      />
    </div>
  )
}

function CanvasWorkflowInner({
  projectId,
  canvasMeta,
  saving,
  exportDialogOpen,
  onExportDialogOpenChange,
  agentOpen,
  onAgentOpenChange,
  pendingAgentSkill,
  onPendingAgentSkillConsumed,
  doubaoOpen,
  onDoubaoOpenChange,
  paramsOpen,
  onParamsOpenChange,
  queueOpen,
  onQueueOpenChange,
}: {
  projectId: string
  canvasMeta?: CanvasProjectMeta | null
  saving?: boolean
  exportDialogOpen?: boolean
  onExportDialogOpenChange?: (open: boolean) => void
  agentOpen?: boolean
  onAgentOpenChange?: (open: boolean) => void
  pendingAgentSkill?: CanvasAgentSkillId | null
  onPendingAgentSkillConsumed?: () => void
  doubaoOpen?: boolean
  onDoubaoOpenChange?: (open: boolean) => void
  paramsOpen?: boolean
  onParamsOpenChange?: (open: boolean) => void
  queueOpen?: boolean
  onQueueOpenChange?: (open: boolean) => void
}) {
  return (
    <CanvasFlowSurface
      projectId={projectId}
      canvasMeta={canvasMeta}
      saving={saving}
      exportDialogOpen={exportDialogOpen}
      onExportDialogOpenChange={onExportDialogOpenChange}
      agentOpen={agentOpen}
      onAgentOpenChange={onAgentOpenChange}
      pendingAgentSkill={pendingAgentSkill}
      onPendingAgentSkillConsumed={onPendingAgentSkillConsumed}
      doubaoOpen={doubaoOpen}
      onDoubaoOpenChange={onDoubaoOpenChange}
      paramsOpen={paramsOpen}
      onParamsOpenChange={onParamsOpenChange}
      queueOpen={queueOpen}
      onQueueOpenChange={onQueueOpenChange}
    />
  )
}

export function CanvasWorkflow({
  projectId,
  initialData,
  onPersist,
  saving,
  exportDialogOpen,
  onExportDialogOpenChange,
  agentOpen,
  onAgentOpenChange,
  pendingAgentSkill,
  onPendingAgentSkillConsumed,
  doubaoOpen,
  onDoubaoOpenChange,
  paramsOpen,
  onParamsOpenChange,
  queueOpen,
  onQueueOpenChange,
  canvasMeta,
}: CanvasWorkflowProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ReactFlowProvider>
        <CanvasEditorProvider
          projectId={projectId}
          initialData={initialData}
          onPersist={onPersist}
          coverManual={Boolean(canvasMeta?.coverManual)}
        >
          <CanvasWorkflowInner
          projectId={projectId}
          canvasMeta={canvasMeta}
          saving={saving}
          exportDialogOpen={exportDialogOpen}
          onExportDialogOpenChange={onExportDialogOpenChange}
          agentOpen={agentOpen}
          onAgentOpenChange={onAgentOpenChange}
          pendingAgentSkill={pendingAgentSkill}
          onPendingAgentSkillConsumed={onPendingAgentSkillConsumed}
          doubaoOpen={doubaoOpen}
          onDoubaoOpenChange={onDoubaoOpenChange}
          paramsOpen={paramsOpen}
          onParamsOpenChange={onParamsOpenChange}
          queueOpen={queueOpen}
          onQueueOpenChange={onQueueOpenChange}
        />
      </CanvasEditorProvider>
    </ReactFlowProvider>
    </div>
  )
}
