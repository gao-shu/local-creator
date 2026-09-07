// Copyright (c) local-creator contributors. All rights reserved.

import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import type { NodeProps } from '@xyflow/react'
import { useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import { Menu } from 'lucide-react'
import { toast } from 'sonner'
import { CanvasImageNameEditor } from '@/components/canvas/nodes/canvas-image-name-editor'
import {
  CanvasPromptContextMenu,
  type CanvasPromptContextMenuAnchor,
} from '@/components/canvas/nodes/canvas-prompt-context-menu'
import { CanvasPromptChatConsole } from '@/components/canvas/nodes/canvas-prompt-chat-console'
import { CanvasPromptTopToolbar } from '@/components/canvas/nodes/canvas-prompt-top-toolbar'
import { CanvasNodeConnector } from '@/components/canvas/nodes/canvas-node-connector'
import { CanvasNodeGeneratingOverlay } from '@/components/canvas/nodes/canvas-node-generating-overlay'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import {
  CANVAS_NODE_CONSOLE_TEXT,
} from '@/lib/canvas/canvas-node-theme'
import {
  CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE,
  CANVAS_NODE_CONSOLE_WIDTH,
  CANVAS_NODE_TOP_TOOLBAR_ANCHOR_STYLE,
} from '@/lib/canvas/canvas-console-layout'
import { CANVAS_PROMPT_NODE_WIDTH } from '@/lib/canvas/canvas-prompt-layout'
import {
  CANVAS_MEDIA_NODE_HEADER_ROW_CLASS,
  CANVAS_MEDIA_NODE_PREVIEW_SQUARE_STYLE,
  CanvasMediaNodeTextPlaceholder,
  CanvasMediaNodeTypeLabel,
  canvasMediaNodePreviewClassName,
} from '@/components/canvas/nodes/canvas-media-node-chrome'
import {
  CANVAS_PROMPT_TEXT_IMPORT_ACCEPT,
  CANVAS_PROMPT_TEXT_MAX_LENGTH,
  importCanvasPromptTextFromFile,
} from '@/lib/canvas/canvas-prompt-text-import'
import { resolveSoftwareLlmModelId } from '@/lib/models/software-model-prefs'
import {
  runCanvasEditorPromptExtract,
  runCanvasEditorPromptStoryboard,
  runCanvasEditorPromptTemplateImport,
  CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM,
  type CanvasPromptAiEditorContext,
} from '@/lib/canvas/canvas-prompt-ai-actions'
import { parseStoryboardTemplateDocument } from '@/lib/canvas/canvas-storyboard-template-parse'
import type { StoryboardTemplateNormalizedShot } from '@/lib/canvas/canvas-storyboard-template-spec'
import { CanvasStoryboardTemplateImportDialog } from '@/components/canvas/dialogs/canvas-storyboard-template-import-dialog'
import {
  mergeCanvasPromptText,
  resolveCanvasPromptGenerateErrorMessage,
  runCanvasPromptTextGenerate,
} from '@/lib/canvas/canvas-prompt-generate-action'
import {
  CANVAS_TEXT_DEFAULT_NAME_COLOR,
  CANVAS_TEXT_NAME_PREFIX,
  formatCanvasTextNodeName,
  resolveCanvasTextDisplayName,
  stripCanvasTextNamePrefix,
} from '@/lib/canvas/canvas-prompt-naming'
import { useSettingsStore } from '@/stores/settings-store'
import { useCanvasNodeQuickAdd } from '@/hooks/use-canvas-node-quick-add'
import { useCanvasConsoleDismissOnOutsidePointerDown } from '@/hooks/use-canvas-console-dismiss'
import type { CanvasPromptNodeData } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import { cn } from '@/lib/utils'

const PROMPT_MAX_LENGTH = CANVAS_PROMPT_TEXT_MAX_LENGTH

/** 预览 / 内联编辑共用，避免双击切换时字号与盒模型跳动（预览不加 nodrag，以便拖节点） */
const CANVAS_PROMPT_BODY_SCROLL_CLASS = cn(
  'nowheel min-h-0 flex-1 w-full overflow-y-auto overscroll-contain',
  /* pr：正文与滚动条间距；滚动容器贴右缘（外层不加 pr） */
  'whitespace-pre-wrap pr-3 text-left text-[13px] leading-relaxed',
  'bg-transparent outline-none',
  CANVAS_NODE_CONSOLE_TEXT,
)

function CanvasPromptNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasPromptNodeData
  const {
    nodes,
    edges,
    projectId,
    promptConsoleNodeId,
    activatePromptConsole,
    openPromptConsole,
    closePromptConsole,
    addCanvasNode,
    appendCanvasGraph,
    deleteNode,
    removeNodesByIds,
    duplicateNode,
    updateNodeData,
    promptAiBusy,
    setPromptAiBusy,
    cancelPromptAi,
  } = useCanvasEditor()
  const { fitView } = useReactFlow()
  const settings = useSettingsStore((state) => state.settings)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const rememberLastUsedLlmModelId = useSettingsStore((state) => state.rememberLastUsedLlmModelId)

  const [contextMenuAnchor, setContextMenuAnchor] = useState<CanvasPromptContextMenuAnchor | null>(
    null,
  )
  const [generating, setGenerating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false)
  const [extractConfirmOpen, setExtractConfirmOpen] = useState(false)
  const [templateImportOpen, setTemplateImportOpen] = useState(false)
  const [templatePreviewShots, setTemplatePreviewShots] = useState<StoryboardTemplateNormalizedShot[]>(
    [],
  )
  const [templatePreviewWarnings, setTemplatePreviewWarnings] = useState<string[]>([])
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null)
  const [inlineEditing, setInlineEditing] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)
  const inlineEditorRef = useRef<HTMLTextAreaElement>(null)
  const previewScrollRef = useRef<HTMLDivElement>(null)
  const pendingScrollTopRef = useRef<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const chatConsoleOpen = promptConsoleNodeId === id
  const nodeRootRef = useCanvasConsoleDismissOnOutsidePointerDown(
    chatConsoleOpen,
    closePromptConsole,
    id,
  )
  const updateNodeInternals = useUpdateNodeInternals()
  const handleConnectorAdd = useCanvasNodeQuickAdd(id, CANVAS_PROMPT_NODE_WIDTH)
  const promptPreview = (nodeData.prompt || '').trim()

  const mergedLlmModels = useMemo(
    () => getMergedModels('llm'),
    [getMergedModels, settings?.llmModels],
  )

  const llmModelId = useMemo(
    () => resolveSoftwareLlmModelId(settings, mergedLlmModels),
    [
      mergedLlmModels,
      settings?.lastUsedLlmModelId,
      settings?.lastUsedStoryboardLlmModelId,
      settings?.lastUsedEpisodeLlmModelId,
      settings?.defaultLlmModelId,
    ],
  )

  const nodeTitle = useMemo(
    () => resolveCanvasTextDisplayName({ label: nodeData.label }).label,
    [nodeData.label],
  )
  const textNickname = useMemo(
    () => stripCanvasTextNamePrefix(nodeData.label),
    [nodeData.label],
  )
  const chatInstruction = nodeData.chatInstruction || ''

  const handleSaveTextName = useCallback(
    (name: string) => {
      updateNodeData(id, { label: formatCanvasTextNodeName(name) })
    },
    [id, updateNodeData],
  )

  const promptAiLocked = Boolean(promptAiBusy)
  const extracting =
    promptAiBusy?.kind === 'extract' && promptAiBusy.nodeId === id
  const storyboarding =
    promptAiBusy?.kind === 'storyboard' && promptAiBusy.nodeId === id
  const importingTemplate =
    promptAiBusy?.kind === 'templateImport' && promptAiBusy.nodeId === id
  const promptGenerating = generating || extracting || storyboarding || importingTemplate
  const promptGeneratingMessage = generating
    ? '文本生成中…'
    : extracting
      ? '资产提取中…'
      : storyboarding
        ? '智能分镜中…'
        : importingTemplate
          ? '导入分镜稿中…'
          : undefined

  useEffect(() => {
    updateNodeInternals(id)
  }, [chatConsoleOpen, id, updateNodeInternals])

  const handleActivate = useCallback(
    (options?: { toggleIfOpen?: boolean }) => {
      activatePromptConsole(id, options)
    },
    [activatePromptConsole, id],
  )

  const handlePointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragStartRef.current = { x: event.clientX, y: event.clientY }
  }, [])

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (promptGenerating) return
      if (inlineEditing) return
      if (event.detail >= 2) return
      const start = dragStartRef.current
      if (start) {
        const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y)
        if (moved > 4) return
      }
      if (event.ctrlKey || event.metaKey) return
      event.stopPropagation()
      handleActivate()
    },
    [handleActivate, inlineEditing, promptGenerating],
  )

  const handleDoubleClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    event.preventDefault()
    pendingScrollTopRef.current = previewScrollRef.current?.scrollTop ?? 0
    setInlineEditing(true)
  }, [])

  const exitInlineEditing = useCallback(() => {
    pendingScrollTopRef.current = inlineEditorRef.current?.scrollTop ?? 0
    setInlineEditing(false)
  }, [])

  useEffect(() => {
    const top = pendingScrollTopRef.current
    if (top == null) return

    const frame = requestAnimationFrame(() => {
      const el = inlineEditing ? inlineEditorRef.current : previewScrollRef.current
      if (el) el.scrollTop = top
      pendingScrollTopRef.current = null
      if (inlineEditing) {
        inlineEditorRef.current?.focus({ preventScroll: true })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [inlineEditing])

  const handleChange = useCallback(
    (prompt: string) => {
      updateNodeData(id, { prompt: prompt.slice(0, PROMPT_MAX_LENGTH) })
    },
    [id, updateNodeData],
  )

  const applyImportedPrompt = useCallback(
    (text: string, fileName: string, truncated: boolean) => {
      updateNodeData(id, { prompt: text })
      if (truncated) {
        toast.error(`文本最多 ${PROMPT_MAX_LENGTH.toLocaleString()} 字，已截断导入内容`)
      }
      toast.success(`已导入：${fileName}`)
    },
    [id, updateNodeData],
  )

  const runImportFile = useCallback(
    async (file: File) => {
      setImporting(true)
      openPromptConsole(id)
      try {
        const { text, truncated } = await importCanvasPromptTextFromFile(file, PROMPT_MAX_LENGTH)
        applyImportedPrompt(text, file.name, truncated)
      } catch (error) {
        toast.error((error as Error).message || '导入失败')
      } finally {
        setImporting(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [applyImportedPrompt, id, openPromptConsole],
  )

  const handleImportFile = useCallback(
    async (file: File) => {
      if (importing) return
      if (nodeData.prompt?.trim()) {
        setPendingImportFile(file)
        setReplaceConfirmOpen(true)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }
      await runImportFile(file)
    },
    [importing, nodeData.prompt, runImportFile],
  )

  const handleUploadText = useCallback(() => {
    if (importing || generating || promptAiLocked) return
    fileInputRef.current?.click()
  }, [generating, importing, promptAiLocked])

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuAnchor({ x: event.clientX, y: event.clientY })
  }, [])

  const handleAddNote = useCallback(() => {
    const self = nodes.find((node) => node.id === id)
    const baseX = self?.position.x ?? 0
    const baseY = self?.position.y ?? 0
    addCanvasNode(
      CANVAS_NODE_TYPES.note,
      { x: baseX + 12, y: baseY + 220 },
      { direction: 'source', nodeId: id, handleId: 'right' },
      { label: '' },
    )
    toast.success('已添加批注')
  }, [addCanvasNode, id, nodes])

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
          nodes: nodeIds.map((nodeId) => ({ id: nodeId })),
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
      setPromptAiBusy,
      removeNodesByIds,
      settings,
      updateNodeData,
    ],
  )

  const runExtract = useCallback(async () => {
    const result = await runCanvasEditorPromptExtract(promptAiContext, { sourceNodeId: id })
    if (result === 'needs_confirm') {
      setExtractConfirmOpen(true)
      return
    }
    if (result === true) setContextMenuAnchor(null)
  }, [id, promptAiContext])

  const runExtractConfirmed = useCallback(async () => {
    const result = await runCanvasEditorPromptExtract(promptAiContext, {
      sourceNodeId: id,
      confirmed: true,
    })
    if (result === true) setContextMenuAnchor(null)
  }, [id, promptAiContext])

  const runStoryboard = useCallback(async () => {
    const ok = await runCanvasEditorPromptStoryboard(promptAiContext, { sourceNodeId: id })
    if (ok) setContextMenuAnchor(null)
  }, [id, promptAiContext])

  const openTemplateImport = useCallback(() => {
    if (promptAiLocked) return
    const content = String(nodeData.prompt || '').trim()
    if (!content) {
      toast.error('请先在文本节点粘贴分镜稿')
      return
    }
    const parsed = parseStoryboardTemplateDocument(content)
    if (!parsed.ok) {
      toast.error(parsed.message)
      return
    }
    setTemplatePreviewShots(parsed.shots)
    setTemplatePreviewWarnings(parsed.warnings)
    setTemplateImportOpen(true)
    setContextMenuAnchor(null)
  }, [nodeData.prompt, promptAiLocked])

  const confirmTemplateImport = useCallback(
    (payload: { createShotPromptNodes: boolean; createVideoNodes: boolean }) => {
      setTemplateImportOpen(false)
      const ok = runCanvasEditorPromptTemplateImport(promptAiContext, {
        sourceNodeId: id,
        createShotPromptNodes: payload.createShotPromptNodes,
        createVideoNodes: payload.createVideoNodes,
      })
      if (ok) setContextMenuAnchor(null)
    },
    [id, promptAiContext],
  )

  const runGenerate = useCallback(async () => {
    const instruction = chatInstruction.trim()
    if (!instruction) {
      toast.error('请先在下方输入创作描述')
      return
    }
    if (!settings) {
      toast.error('设置未加载，请稍后重试')
      return
    }

    setGenerating(true)
    openPromptConsole(id)
    try {
      const generated = await runCanvasPromptTextGenerate({
        instruction,
        existingPrompt: nodeData.prompt,
        settings,
        canvasProjectId: projectId,
      })
      const merged = mergeCanvasPromptText(nodeData.prompt, generated, PROMPT_MAX_LENGTH)
      updateNodeData(id, { prompt: merged })
      toast.success(nodeData.prompt?.trim() ? '已根据描述续写文本' : '已生成文本内容')
    } catch (error) {
      toast.error(resolveCanvasPromptGenerateErrorMessage(error))
    } finally {
      setGenerating(false)
    }
  }, [chatInstruction, id, nodeData.prompt, openPromptConsole, projectId, settings, updateNodeData])

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={CANVAS_PROMPT_TEXT_IMPORT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleImportFile(file)
        }}
      />
      <ConfirmDialog
        open={replaceConfirmOpen}
        onOpenChange={(open) => {
          setReplaceConfirmOpen(open)
          if (!open) setPendingImportFile(null)
        }}
        title="替换当前文本？"
        description="导入文件将覆盖文本节点中的现有内容。"
        confirmLabel="替换"
        onConfirm={() => {
          const file = pendingImportFile
          setReplaceConfirmOpen(false)
          setPendingImportFile(null)
          if (file) void runImportFile(file)
        }}
      />
      <ConfirmDialog
        open={extractConfirmOpen}
        title={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.title}
        description={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.description}
        confirmLabel={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.confirmLabel}
        cancelLabel={CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.cancelLabel}
        variant="destructive"
        onClose={() => setExtractConfirmOpen(false)}
        onConfirm={() => {
          setExtractConfirmOpen(false)
          void runExtractConfirmed()
        }}
      />
      <CanvasStoryboardTemplateImportDialog
        open={templateImportOpen}
        shots={templatePreviewShots}
        warnings={templatePreviewWarnings}
        loading={importingTemplate}
        onClose={() => setTemplateImportOpen(false)}
        onConfirm={confirmTemplateImport}
      />
      <CanvasPromptContextMenu
        anchor={contextMenuAnchor}
        menuTitle={nodeTitle}
        extracting={extracting}
        storyboarding={storyboarding}
        importingTemplate={importingTemplate}
        promptAiLocked={promptAiLocked}
        onClose={() => setContextMenuAnchor(null)}
        onAddNote={handleAddNote}
        onDelete={() => deleteNode(id)}
        onDuplicate={() => duplicateNode(id)}
        onExtractAssets={() => void runExtract()}
        onGenerateStoryboard={() => void runStoryboard()}
        onImportStoryboardTemplate={openTemplateImport}
      />
      <div
        ref={nodeRootRef}
        data-testid={`canvas-node-${id}`}
        className="relative overflow-visible"
        style={{ width: CANVAS_PROMPT_NODE_WIDTH }}
        onContextMenu={handleContextMenu}
      >
        <div
          className={CANVAS_MEDIA_NODE_HEADER_ROW_CLASS}
          style={{ width: CANVAS_PROMPT_NODE_WIDTH }}
        >
          <CanvasMediaNodeTypeLabel
            icon={Menu}
            iconTitle="文本"
            toneClass={CANVAS_TEXT_DEFAULT_NAME_COLOR}
          />
          {!chatConsoleOpen ? (
            <CanvasImageNameEditor
              value={textNickname}
              fixedPrefix={CANVAS_TEXT_NAME_PREFIX}
              fixedPrefixColorClass={CANVAS_TEXT_DEFAULT_NAME_COLOR}
              colorClass={CANVAS_TEXT_DEFAULT_NAME_COLOR}
              onSave={handleSaveTextName}
              placement="above"
              placeholder="名称"
              className="min-w-0 flex-1 justify-start"
            />
          ) : null}
        </div>

        <div className="relative z-0" style={{ width: CANVAS_PROMPT_NODE_WIDTH }}>
          {chatConsoleOpen ? (
            <div
              className="nodrag nopan pointer-events-none absolute z-40"
              style={{
                width: CANVAS_NODE_CONSOLE_WIDTH,
                ...CANVAS_NODE_TOP_TOOLBAR_ANCHOR_STYLE,
              }}
            >
              <div className="pointer-events-auto">
                <CanvasPromptTopToolbar
                  uploading={importing}
                  disabled={promptAiLocked || generating}
                  onUpload={handleUploadText}
                />
              </div>
            </div>
          ) : null}
          <div
            role="button"
            tabIndex={0}
            onPointerDown={handlePointerDown}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                handleActivate()
              }
            }}
            className={cn(
              canvasMediaNodePreviewClassName(selected),
              'transition-[box-shadow,ring-color] duration-300',
              promptGenerating &&
                'ring-2 ring-amber-400/50 shadow-[0_0_0_1px_rgba(251,191,36,0.25),0_0_28px_rgba(251,191,36,0.18)]',
            )}
            style={CANVAS_MEDIA_NODE_PREVIEW_SQUARE_STYLE}
          >
            {inlineEditing || promptPreview ? (
              <div className="flex h-full min-h-0 flex-col py-4 pl-4 text-left">
                {inlineEditing ? (
                  <textarea
                    ref={inlineEditorRef}
                    value={nodeData.prompt || ''}
                    onChange={(event) => handleChange(event.target.value)}
                    onBlur={exitInlineEditing}
                    onPointerDown={(event) => event.stopPropagation()}
                    onWheel={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        exitInlineEditing()
                      }
                    }}
                    placeholder="例：阳光洒在河面上，一只羊在河边吃草……"
                    className={cn(CANVAS_PROMPT_BODY_SCROLL_CLASS, 'nodrag nopan resize-none')}
                  />
                ) : (
                  <div
                    ref={previewScrollRef}
                    className={cn(
                      CANVAS_PROMPT_BODY_SCROLL_CLASS,
                      /* 预览禁选字，避免拖动被当成划选文本；双击进入编辑后可改字 */
                      'select-none cursor-grab active:cursor-grabbing',
                    )}
                    onWheel={(event) => event.stopPropagation()}
                  >
                    {nodeData.prompt}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full w-full">
                <CanvasMediaNodeTextPlaceholder />
              </div>
            )}

            {promptGenerating ? (
              <CanvasNodeGeneratingOverlay
                message={promptGeneratingMessage}
                fallbackMessage="文本生成中…"
                cancelTestId={
                  extracting || storyboarding ? `canvas-node-${id}-cancel-prompt-ai` : undefined
                }
                cancelLabel={
                  extracting
                    ? '取消提取资产'
                    : storyboarding
                      ? '取消智能分镜'
                      : undefined
                }
                onCancel={
                  extracting || storyboarding
                    ? () => {
                        void cancelPromptAi()
                      }
                    : undefined
                }
              />
            ) : null}
          </div>

          <CanvasNodeConnector side="left" anchored onQuickAdd={handleConnectorAdd} />
          <CanvasNodeConnector side="right" anchored onQuickAdd={handleConnectorAdd} />

          {chatConsoleOpen ? (
            <CanvasPromptChatConsole
              promptText={nodeData.prompt || ''}
              chatInstruction={chatInstruction}
              llmModelId={llmModelId}
              extracting={extracting}
              generating={generating}
              storyboarding={storyboarding}
              importingTemplate={importingTemplate}
              promptAiLocked={promptAiLocked}
              onChatInstructionChange={(value) => updateNodeData(id, { chatInstruction: value })}
              onLlmModelIdChange={(value) => {
                rememberLastUsedLlmModelId(value)
              }}
              onExtract={() => void runExtract()}
              onGenerateStoryboard={() => void runStoryboard()}
              onImportStoryboardTemplate={openTemplateImport}
              onGenerate={() => void runGenerate()}
            />
          ) : null}
        </div>
      </div>
    </>
  )
}

export const CanvasPromptNode = memo(CanvasPromptNodeComponent)
