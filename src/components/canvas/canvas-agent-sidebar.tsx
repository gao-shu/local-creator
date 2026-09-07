// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AudioLines,
  BrushCleaning,
  ClipboardList,
  Copy,
  Grid2X2,
  ImageIcon,
  LayoutGrid,
  Loader2,
  MessageCircleMore,
  SendHorizontal,
  Sparkles,
  Video,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Select } from '@/components/ui/select'
import { HaodouIcon } from '@/components/ui/haodou-icon'
import {
  resolveCanvasGenerateHaodouCost,
  shouldShowCanvasGenerateHaodou,
} from '@/lib/canvas/canvas-generate-haodou-display'
import { buildCanvasVideoModelSwitchPatch } from '@/lib/canvas/canvas-video-params-sync'
import { buildModelSelectOptions } from '@/lib/models/model-select-options'
import { CanvasAgentReferenceChip } from '@/components/canvas/canvas-agent-reference-chip'
import { cn } from '@/lib/utils'
import { useSettingsStore } from '@/stores/settings-store'
import { pickMergedLlmModel } from '@/lib/models/merged-model-picker'
import {
  getLlmModelSelectionError,
} from '@/lib/models/llm-client'
import { resolveSoftwareImageModelId, resolveSoftwareLlmModelId } from '@/lib/models/software-model-prefs'
import { CanvasImageParamsPopover } from '@/components/canvas/nodes/canvas-image-params-popover'
import { useImageGenerationCostPreview } from '@/hooks/use-image-generation-cost-preview'
import {
  normalizeImageGenerationTierParams,
  resolveAssetImageTierPrefs,
} from '@/lib/models/image-generation-tier-params'
import { DEFAULT_IMAGE_SIZE, normalizeImageSizePreset } from '@/lib/workflow/image-size-presets'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import type {
  CanvasAgentMessage,
  CanvasAgentPendingAction,
  CanvasAgentSkillId,
  CanvasAgentSkillMediaType,
} from '@/lib/canvas/canvas-agent-types'
import {
  buildCanvasAgentAssistantReply,
  CANVAS_AGENT_SKILLS,
  chatWithCanvasAgent,
  formatCanvasAgentUserMessageForLlm,
  summarizeCanvasAgentNodes,
} from '@/lib/canvas/canvas-agent-service'
import {
  CANVAS_AGENT_SKILL_MEDIA_TYPES,
  getCanvasAgentSkillDefinition,
  listCanvasAgentSkillDefinitions,
  listCanvasAgentSkillDefinitionsByMediaType,
  toCanvasAgentSkillUi,
} from '@/lib/canvas/canvas-agent-skill-registry'
import {
  executeCanvasAgentSkill,
  formatCanvasStoryboardReviewMessage,
} from '@/lib/canvas/canvas-agent-skill-execute'
import { composeAndAddCanvasImageGrid } from '@/lib/canvas/canvas-image-grid-compose-action'
import {
  CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM,
  runCanvasEditorPromptExtract,
  runCanvasEditorPromptStoryboard,
  type CanvasPromptAiEditorContext,
} from '@/lib/canvas/canvas-prompt-ai-actions'
import { CANVAS_NODE_CONSOLE_TEXT } from '@/lib/canvas/canvas-node-theme'

/** 侧栏筛选 Tab：精选 = 暂时罗列全部 Skill；其余按 mediaType 过滤 */
type CanvasAgentSkillMediaTab = 'featured' | CanvasAgentSkillMediaType

const CANVAS_AGENT_SKILL_MEDIA_TABS: Array<{ id: CanvasAgentSkillMediaTab; label: string }> = [
  { id: 'featured', label: '精选' },
  ...CANVAS_AGENT_SKILL_MEDIA_TYPES,
]

interface CanvasAgentSidebarProps {
  open: boolean
  onClose: () => void
}

function createMessage(
  role: CanvasAgentMessage['role'],
  content: string,
  extras?: Pick<CanvasAgentMessage, 'attachedSummaries' | 'activeSkill'>,
): CanvasAgentMessage {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    role,
    content,
    timestamp: Date.now(),
    ...extras,
  }
}

type CanvasAgentMode = 'chat' | CanvasAgentSkillId

type CanvasAgentMessagesByMode = Record<CanvasAgentMode, CanvasAgentMessage[]>

function createEmptyMessagesByMode(): CanvasAgentMessagesByMode {
  const out = { chat: [] as CanvasAgentMessage[] } as CanvasAgentMessagesByMode
  for (const skill of CANVAS_AGENT_SKILLS) {
    out[skill.id] = []
  }
  return out
}

const EMPTY_MESSAGES_BY_MODE = createEmptyMessagesByMode()

const CHAT_PLACEHOLDER = '直接提问，或先点画布节点引入素材后再问'

const SKILL_PLACEHOLDERS: Record<CanvasAgentSkillId, string> = {
  edit_image: '可先提问；要改图时写好指令后点「运行」',
  edit_video: '可先提问；要改视频时写好指令后点「运行」',
  review_storyboard: '可先提问；要审核时点「运行」（可补充关注点）',
  extract_voice: '可先提问；选好成片视频后点「运行」提取音色',
  extract_assets: '可先提问；选好文本节点后点「运行」提取资产',
  smart_storyboard: '可先提问；选好文本节点后点「运行」生成分镜',
  merge_image_grid: '可先提问；多选至少 2 张图后点「运行」合成宫格',
}

const SKILL_ICONS: Record<CanvasAgentSkillId, typeof ImageIcon> = {
  edit_image: ImageIcon,
  edit_video: Video,
  review_storyboard: ClipboardList,
  extract_voice: AudioLines,
  extract_assets: LayoutGrid,
  smart_storyboard: Sparkles,
  merge_image_grid: Grid2X2,
}

const AGENT_EMPTY_SLOGAN: Record<CanvasAgentMode, { title: string; subtitle: string }> = {
  chat: {
    title: '问创作、问节点、问 Prompt',
    subtitle: '点画布节点可引入素材；发送=对话，不执行 Skill',
  },
  edit_image: {
    title: '已选「改图」Skill',
    subtitle: '发送=继续对话；点「运行」才改写并生图',
  },
  edit_video: {
    title: '已选「改视频」Skill',
    subtitle: '发送=继续对话；点「运行」才改写并生成',
  },
  review_storyboard: {
    title: '已选「审分镜词」Skill',
    subtitle: '发送=继续对话；点「运行」才输出审核报告',
  },
  extract_voice: {
    title: '已选「提取音色」Skill',
    subtitle: '发送=继续对话；点「运行」才打开提取流程',
  },
  extract_assets: {
    title: '已选「提取资产」Skill',
    subtitle: '发送=继续对话；点「运行」才提取角色/场景/物品',
  },
  smart_storyboard: {
    title: '已选「智能分镜」Skill',
    subtitle: '发送=继续对话；点「运行」才生成分镜',
  },
  merge_image_grid: {
    title: '已选「合成九宫格」Skill',
    subtitle: '发送=继续对话；点「运行」才本地合成宫格',
  },
}

export function CanvasAgentSidebar({ open, onClose }: CanvasAgentSidebarProps) {
  const navigate = useNavigate()
  const {
    nodes,
    edges,
    projectId,
    updateNodeData,
    updateCanvasVideoParams,
    runNode,
    hasRunningNodes,
    agentReferencedNodeIds,
    removeAgentReference,
    setAgentReferenceEnabled,
    agentSkillMode,
    setAgentSkillMode,
    canvasVideoParams,
    requestVideoExtractAudio,
    appendCanvasGraph,
    openPromptConsole,
    promptAiBusy,
    setPromptAiBusy,
    removeNodesByIds,
  } = useCanvasEditor()
  const settings = useSettingsStore((state) => state.settings)
  const appDataDir = useSettingsStore((state) => state.appDataDir)
  const systemLlmModels = useSettingsStore((state) => state.systemModelsByKind.llm)
  const systemImageModels = useSettingsStore((state) => state.systemModelsByKind.image)
  const systemVideoModels = useSettingsStore((state) => state.systemModelsByKind.video)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const rememberLastUsedAssetImageModelId = useSettingsStore(
    (state) => state.rememberLastUsedAssetImageModelId,
  )
  const rememberLastUsedAssetImageTierParams = useSettingsStore(
    (state) => state.rememberLastUsedAssetImageTierParams,
  )
  const rememberLastUsedAssetImageSize = useSettingsStore(
    (state) => state.rememberLastUsedAssetImageSize,
  )
  const rememberLastUsedLlmModelId = useSettingsStore((state) => state.rememberLastUsedLlmModelId)

  const mergedLlmModels = useMemo(
    () => getMergedModels('llm'),
    [getMergedModels, settings?.llmModels, systemLlmModels],
  )
  const mergedImageModels = useMemo(
    () => getMergedModels('image'),
    [getMergedModels, settings?.imageModels, systemImageModels],
  )
  const mergedVideoModels = useMemo(
    () => getMergedModels('video'),
    [getMergedModels, settings?.videoModels, systemVideoModels],
  )
  const llmModelId = useMemo(
    () => resolveSoftwareLlmModelId(settings, mergedLlmModels),
    [
      mergedLlmModels,
      settings?.defaultLlmModelId,
      settings?.lastUsedEpisodeLlmModelId,
      settings?.lastUsedLlmModelId,
      settings?.lastUsedStoryboardLlmModelId,
    ],
  )

  const handleLlmModelChange = useCallback(
    (value: string) => {
      rememberLastUsedLlmModelId(value)
    },
    [rememberLastUsedLlmModelId],
  )
  const imageModelId = useMemo(
    () => resolveSoftwareImageModelId(settings, mergedImageModels),
    [
      mergedImageModels,
      settings?.lastUsedAssetImageModelId,
      settings?.lastUsedStoryboardImageModelId,
    ],
  )
  const activeImageModel = useMemo(
    () => mergedImageModels.find((model) => model.id === imageModelId) ?? null,
    [imageModelId, mergedImageModels],
  )
  const imageTierParams = useMemo(
    () =>
      normalizeImageGenerationTierParams(
        activeImageModel,
        null,
        resolveAssetImageTierPrefs(settings),
      ),
    [
      activeImageModel,
      settings?.lastUsedAssetImageQuality,
      settings?.lastUsedAssetImageResolution,
    ],
  )
  const videoModelId =
    canvasVideoParams.videoModelId && mergedVideoModels.some((model) => model.id === canvasVideoParams.videoModelId)
      ? canvasVideoParams.videoModelId
      : mergedVideoModels[0]?.id ?? ''

  const llmModelOptions = useMemo(
    () => buildModelSelectOptions(mergedLlmModels, 'llm'),
    [mergedLlmModels],
  )
  const imageModelOptions = useMemo(
    () => buildModelSelectOptions(mergedImageModels, 'image', { modelPickerOnly: true }),
    [mergedImageModels],
  )
  const videoModelOptions = useMemo(
    () => buildModelSelectOptions(mergedVideoModels, 'video', { modelPickerOnly: true }),
    [mergedVideoModels],
  )
  const assetImageSize = useMemo(
    () => normalizeImageSizePreset(settings?.lastUsedAssetImageSize, DEFAULT_IMAGE_SIZE),
    [settings?.lastUsedAssetImageSize],
  )
  const [messagesByMode, setMessagesByMode] = useState<CanvasAgentMessagesByMode>(EMPTY_MESSAGES_BY_MODE)
  const [input, setInput] = useState('')
  const [agentMode, setAgentMode] = useState<CanvasAgentMode>('chat')
  const [mediaTab, setMediaTab] = useState<CanvasAgentSkillMediaTab>('featured')
  const agentModeRef = useRef<CanvasAgentMode>('chat')
  const { estimate: imageCostEstimate, loading: imageCostLoading } = useImageGenerationCostPreview({
    model: activeImageModel,
    tierParams: imageTierParams,
    apiBase: settings?.apiBaseUrl,
    enabled: agentMode === 'edit_image',
  })
  const [busy, setBusy] = useState(false)
  const [pendingAction, setPendingAction] = useState<CanvasAgentPendingAction | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const prevOpenRef = useRef(false)

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
    }),
    [
      appendCanvasGraph,
      edges,
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

  const skillsForMediaTab = useMemo(() => {
    const defs =
      mediaTab === 'featured'
        ? listCanvasAgentSkillDefinitions()
        : listCanvasAgentSkillDefinitionsByMediaType(mediaTab)
    return defs.map(toCanvasAgentSkillUi)
  }, [mediaTab])

  const handleMediaTabSelect = useCallback(
    (tab: CanvasAgentSkillMediaTab) => {
      setMediaTab(tab)
      if (agentMode === 'chat') return
      const defs =
        tab === 'featured'
          ? listCanvasAgentSkillDefinitions()
          : listCanvasAgentSkillDefinitionsByMediaType(tab)
      if (!defs.some((item) => item.id === agentMode)) {
        setAgentMode('chat')
        setInput('')
      }
    },
    [agentMode],
  )

  useEffect(() => {
    agentModeRef.current = agentMode
  }, [agentMode])

  const messages = messagesByMode[agentMode]

  const scrollMessageList = useCallback(() => {
    window.requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  const appendMessageToMode = useCallback(
    (mode: CanvasAgentMode, message: CanvasAgentMessage) => {
      setMessagesByMode((current) => ({
        ...current,
        [mode]: [...current[mode], message],
      }))
      if (mode === agentModeRef.current) scrollMessageList()
    },
    [scrollMessageList],
  )

  const appendMessage = useCallback(
    (message: CanvasAgentMessage) => {
      appendMessageToMode(agentModeRef.current, message)
    },
    [appendMessageToMode],
  )

  const copyMessageContent = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      toast.success('已复制')
    } catch {
      toast.error('复制失败')
    }
  }, [])

  useEffect(() => {
    if (open && !prevOpenRef.current) {
      if (agentSkillMode) {
        setAgentMode(agentSkillMode)
      } else {
        setAgentMode('chat')
        setInput('')
      }
    }
    prevOpenRef.current = open
  }, [agentSkillMode, open])

  /** Skills 池深链等外部入口切换 Skill 时，侧栏跟进 */
  useEffect(() => {
    if (!open || !agentSkillMode) return
    setAgentMode((current) => (current === agentSkillMode ? current : agentSkillMode))
  }, [agentSkillMode, open])

  useEffect(() => {
    if (!open) return
    // 挂图常开：Chat / Skill 均可点画布引入；关闭侧栏时 context 会清空引用
    setAgentReferenceEnabled(true)
    setAgentSkillMode(agentMode === 'chat' ? null : agentMode)
  }, [agentMode, open, setAgentReferenceEnabled, setAgentSkillMode])

  const llmSelectionError = getLlmModelSelectionError(mergedLlmModels, llmModelId)
  const activeLlmModel = useMemo(() => {
    if (!settings || llmSelectionError) return null
    try {
      return pickMergedLlmModel(settings, llmModelId)
    } catch {
      return null
    }
  }, [llmModelId, llmSelectionError, settings])

  const referencedSummaries = useMemo(
    () => summarizeCanvasAgentNodes(nodes, edges, undefined, agentReferencedNodeIds),
    [agentReferencedNodeIds, nodes, edges],
  )

  const handleClearChat = useCallback(() => {
    if (busy) return
    setMessagesByMode((current) => ({ ...current, [agentMode]: [] }))
    setInput('')
  }, [agentMode, busy])

  const appendEditMessage = useCallback(
    (skill: CanvasAgentSkillId, message: CanvasAgentMessage) => {
      appendMessageToMode(skill, message)
    },
    [appendMessageToMode],
  )

  const formatSkillResultMessage = useCallback(
    (skill: CanvasAgentSkillId, result: Awaited<ReturnType<typeof executeCanvasAgentSkill>>) => {
      if (result.status === 'failed') {
        return result.error || '执行失败'
      }
      if (skill === 'review_storyboard' && result.output && typeof result.output === 'object') {
        const output = result.output as Parameters<typeof formatCanvasStoryboardReviewMessage>[0]
        if ('issues' in output && 'score' in output) {
          return formatCanvasStoryboardReviewMessage(output)
        }
      }
      if (skill === 'merge_image_grid') {
        const out = result.output as { sourceCount?: number } | undefined
        return `已将 ${out?.sourceCount ?? result.targetNodeIds.length} 张图合成宫格并添加到画布。`
      }
      return buildCanvasAgentAssistantReply({
        skill,
        summaries: summarizeCanvasAgentNodes(
          nodes,
          edges,
          undefined,
          result.targetNodeIds,
        ),
      })
    },
    [edges, nodes],
  )

  const requestConfirm = useCallback((action: CanvasAgentPendingAction) => {
    setPendingAction(action)
  }, [])

  const executeSkill = useCallback(
    async (skill: CanvasAgentSkillId, instruction: string, confirmed?: boolean) => {
      const def = getCanvasAgentSkillDefinition(skill)
      if (!def) return

      const needsLlm =
        skill === 'edit_image' || skill === 'edit_video' || skill === 'review_storyboard'
      if (needsLlm && (!settings || !activeLlmModel)) {
        appendEditMessage(
          skill,
          createMessage('assistant', llmSelectionError || '请先在系统设置中配置并选择大语言模型'),
        )
        return
      }

      const userExtras = {
        attachedSummaries: referencedSummaries.length ? referencedSummaries : undefined,
        activeSkill: skill,
      }
      const userLabel =
        instruction.trim() ||
        (def.requiresUserInstruction ? instruction : `运行「${def.name}」`)

      setBusy(true)
      appendEditMessage(skill, createMessage('user', userLabel, userExtras))
      try {
        const result = await executeCanvasAgentSkill({
          skillId: skill,
          model: activeLlmModel || undefined,
          confirmed,
          input: {
            userInstruction: instruction,
            targetNodeIds: agentReferencedNodeIds,
            referencedNodeIds: agentReferencedNodeIds,
            nodes,
            edges,
          },
          deps: {
            updateNodeData,
            runNode,
            prepareVideoNode: (node) => {
              if (skill === 'edit_video' && videoModelId && node.type === CANVAS_NODE_TYPES.storyVideo) {
                updateCanvasVideoParams(
                  buildCanvasVideoModelSwitchPatch(
                    videoModelId,
                    mergedVideoModels,
                    canvasVideoParams,
                  ),
                )
              }
            },
            requestVideoExtractAudio,
            runPromptExtract: async (sourceNodeId, options) =>
              runCanvasEditorPromptExtract(promptAiContext, {
                sourceNodeId,
                confirmed: options?.confirmed,
              }),
            runPromptStoryboard: async (sourceNodeId) =>
              runCanvasEditorPromptStoryboard(promptAiContext, { sourceNodeId }),
            composeImageGrid: async (nodeIds) => {
              if (!settings || !appDataDir) return null
              return composeAndAddCanvasImageGrid({
                nodes,
                nodeIds,
                projectId,
                settings,
                appDataDir,
                appendCanvasGraph,
              })
            },
          },
        })

        if (
          result.status === 'failed' &&
          result.error === 'NEEDS_EXTRACT_CONFIRM'
        ) {
          requestConfirm({
            title: CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.title,
            description: CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.description,
            confirmLabel: CANVAS_REPLACE_EXTRACT_ASSETS_CONFIRM.confirmLabel,
            onConfirm: () => {
              void executeSkill(skill, instruction, true)
            },
          })
          appendEditMessage(
            skill,
            createMessage('assistant', '该文本已绑定资产，确认后将清空并重新提取。'),
          )
          return
        }

        appendEditMessage(skill, createMessage('assistant', formatSkillResultMessage(skill, result)))
      } catch (error: unknown) {
        appendEditMessage(
          skill,
          createMessage('assistant', (error as Error).message || 'Skill 执行失败'),
        )
      } finally {
        setBusy(false)
      }
    },
    [
      activeLlmModel,
      agentReferencedNodeIds,
      appendCanvasGraph,
      appendEditMessage,
      appDataDir,
      canvasVideoParams,
      edges,
      formatSkillResultMessage,
      llmSelectionError,
      mergedVideoModels,
      nodes,
      projectId,
      promptAiContext,
      referencedSummaries,
      requestVideoExtractAudio,
      runNode,
      settings,
      updateCanvasVideoParams,
      updateNodeData,
      videoModelId,
      requestConfirm,
    ],
  )

  const executeChat = useCallback(
    async (text: string) => {
      if (!text.trim()) return
      const threadMode = agentModeRef.current
      const activeSkill = threadMode === 'chat' ? null : threadMode

      if (!settings || !activeLlmModel) {
        appendMessageToMode(threadMode, createMessage('user', text))
        appendMessageToMode(
          threadMode,
          createMessage(
            'assistant',
            llmSelectionError
              ? `${llmSelectionError}。请先在「设置 → 模型配置」中添加大语言模型。`
              : '大语言模型未就绪，请稍后重试。',
          ),
        )
        return
      }

      setBusy(true)
      appendMessageToMode(
        threadMode,
        createMessage('user', text, {
          attachedSummaries: referencedSummaries.length ? referencedSummaries : undefined,
          activeSkill: activeSkill || undefined,
        }),
      )
      try {
        const reply = await chatWithCanvasAgent({
          model: activeLlmModel,
          history: messagesByMode[threadMode],
          userMessage: formatCanvasAgentUserMessageForLlm(
            text,
            referencedSummaries,
            activeSkill,
          ),
          nodes,
          edges,
          referencedNodeIds: agentReferencedNodeIds,
        })
        appendMessageToMode(threadMode, createMessage('assistant', reply))
      } catch (error: unknown) {
        appendMessageToMode(
          threadMode,
          createMessage('assistant', (error as Error).message || '对话失败，请重试'),
        )
      } finally {
        setBusy(false)
      }
    },
    [
      activeLlmModel,
      appendMessageToMode,
      agentReferencedNodeIds,
      edges,
      llmSelectionError,
      messagesByMode,
      nodes,
      referencedSummaries,
      settings,
    ],
  )

  const handleModeSelect = useCallback(
    (mode: CanvasAgentMode) => {
      if (busy || hasRunningNodes) {
        toast.message('请等待当前生成任务完成')
        return
      }

      if (agentMode === mode) {
        if (mode !== 'chat') {
          setAgentMode('chat')
          setInput('')
        }
        return
      }

      setAgentMode(mode)
      if (mode === 'chat') setInput('')
    },
    [agentMode, busy, hasRunningNodes],
  )

  const handleSubmit = useCallback(async () => {
    const text = input.trim()
    if (busy || hasRunningNodes || !text) return
    setInput('')
    await executeChat(text)
  }, [busy, executeChat, hasRunningNodes, input])

  const handleRunSkill = useCallback(() => {
    if (busy || hasRunningNodes) return
    if (agentMode === 'chat') return
    const def = getCanvasAgentSkillDefinition(agentMode)
    if (!def) return
    const text = input.trim()
    if (def.requiresUserInstruction && !text) {
      toast.message('请先填写运行指令')
      return
    }

    const run = () => {
      setInput('')
      void executeSkill(agentMode, text)
    }

    if (def.requiresConfirmation) {
      requestConfirm({
        title: def.id === 'edit_video' ? '确认改视频并生成？' : `确认运行「${def.name}」？`,
        description:
          def.id === 'edit_video'
            ? '将根据你的描述改写节点 prompt 并触发生成任务。'
            : def.description,
        confirmLabel: def.expensive ? '开始生成' : '开始',
        onConfirm: run,
      })
      return
    }

    run()
  }, [
    agentMode,
    busy,
    executeSkill,
    hasRunningNodes,
    input,
    requestConfirm,
  ])

  if (!open) return null

  return (
    <>
      <aside
        data-testid="canvas-agent-sidebar"
        className={cn(
          'relative z-10 flex w-[453px] shrink-0 flex-col overflow-hidden',
          'border-l-2 border-border/70 dark:border-white/18',
          'bg-card/98 dark:bg-[#101218]/98',
          'shadow-[-16px_0_40px_-12px_rgba(0,0,0,0.55)]',
          'backdrop-blur-xl',
          'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-px',
          'before:bg-gradient-to-b before:from-violet-500/70 before:via-violet-400/25 before:to-transparent',
        )}
      >
        <div className="flex items-start justify-between gap-2 border-b border-border/70 bg-muted/25 px-4 py-3 dark:border-white/14 dark:bg-white/[0.04]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 shrink-0 text-violet-500" />
              <h3 className="text-lg font-semibold tracking-tight">画布助手</h3>
            </div>
            {llmSelectionError ? (
              <p className="mt-1 text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
                {llmSelectionError}，请前往
                <button
                  type="button"
                  className="mx-0.5 underline underline-offset-2 hover:opacity-80"
                  onClick={() => navigate('/settings/models')}
                >
                  设置 → 模型配置
                </button>
              </p>
            ) : llmModelOptions.length ? (
              <div className="mt-1.5 flex min-w-0 items-center gap-1.5">
                <span className="shrink-0 text-[10px] text-muted-foreground">文本模型</span>
                <Select
                  className="h-7 min-w-0 flex-1 text-[10px] px-2"
                  options={llmModelOptions}
                  value={llmModelId}
                  disabled={busy}
                  onChange={handleLlmModelChange}
                />
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              disabled={busy}
              onClick={handleClearChat}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
              title="清空对话"
              aria-label="清空对话"
            >
              <BrushCleaning className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              aria-label="关闭助手"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-2 border-b border-border/70 bg-muted/15 px-3 py-2.5 dark:border-white/14 dark:bg-white/[0.02]">
          <div className="flex gap-1">
            {CANVAS_AGENT_SKILL_MEDIA_TABS.map((media) => (
              <button
                key={media.id}
                type="button"
                disabled={busy || hasRunningNodes}
                onClick={() => handleMediaTabSelect(media.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  mediaTab === media.id
                    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-200'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  'disabled:opacity-50',
                )}
              >
                {media.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {agentMode === 'chat'
              ? '发送=对话；点画布节点可引入素材'
              : '发送=对话；「运行」才执行当前 Skill'}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy || hasRunningNodes}
              title="对话模式：不绑定 Skill（仍可挂图提问）"
              onClick={() => handleModeSelect('chat')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all',
                agentMode === 'chat'
                  ? 'border-violet-500/60 bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/35 dark:text-violet-200'
                  : 'border-border/40 bg-background/50 text-foreground/80 hover:border-border/60 hover:bg-muted/30',
                'disabled:opacity-50',
              )}
            >
              <MessageCircleMore className="h-3 w-3 shrink-0 opacity-70" />
              Chat
            </button>
            {skillsForMediaTab.map((skill) => {
              const Icon = SKILL_ICONS[skill.id]
              const selected = agentMode === skill.id
              return (
                <button
                  key={skill.id}
                  type="button"
                  disabled={busy || hasRunningNodes}
                  title={`${skill.label}：${skill.description}`}
                  onClick={() => handleModeSelect(skill.id)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all',
                    selected
                      ? 'border-violet-500/60 bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/35 dark:text-violet-200'
                      : 'border-border/40 bg-background/50 text-foreground/80 hover:border-border/60 hover:bg-muted/30',
                    'disabled:opacity-50',
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0 opacity-70" />
                  {skill.label}
                </button>
              )
            })}
          </div>
        </div>

        <div ref={listRef} className="flex-1 overflow-y-auto bg-background/30 dark:bg-black/20">
          {messages.length === 0 && !busy ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-12 text-center">
              <Sparkles className="mb-4 h-9 w-9 text-violet-500/35 dark:text-violet-400/40" />
              <p className="text-sm text-muted-foreground dark:text-white/45">
                {AGENT_EMPTY_SLOGAN[agentMode].title}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/75 dark:text-white/30">
                {AGENT_EMPTY_SLOGAN[agentMode].subtitle}
              </p>
            </div>
          ) : (
          <div className="divide-y divide-border/70 dark:divide-white/12">
            {messages.map((message) => (
              <div
                key={message.id}
                data-testid={
                  message.role === 'assistant' ? 'canvas-agent-message-assistant' : undefined
                }
                className={cn(
                  'px-3 py-3.5 text-xs leading-relaxed whitespace-pre-wrap',
                  message.role === 'user' ? 'bg-primary/[0.07]' : 'bg-muted/15 dark:bg-white/[0.03]',
                )}
              >
                <div
                  className={cn(
                    'rounded-xl border px-3 py-2.5',
                    message.role === 'user'
                      ? 'ml-4 border-primary/30 bg-primary/10 dark:border-primary/35 dark:bg-primary/15'
                      : 'mr-3 border-border/55 bg-card/70 dark:border-white/14 dark:bg-black/25',
                  )}
                >
                  <div
                    className={cn(
                      'mb-2 flex items-center justify-between gap-2 border-b pb-1.5',
                      message.role === 'user'
                        ? 'border-primary/25 dark:border-primary/30'
                        : 'border-border/50 dark:border-white/12',
                    )}
                  >
                    <p
                      className={cn(
                        'text-[10px] font-semibold tracking-wide',
                        message.role === 'user'
                          ? 'text-primary/80 dark:text-primary/90'
                          : 'text-muted-foreground',
                      )}
                    >
                      {message.role === 'user' ? '你' : '助手'}
                    </p>
                    {message.role === 'user' ? (
                      <button
                        type="button"
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary dark:text-primary/80"
                        aria-label="复制"
                        title="复制"
                        onClick={() => void copyMessageContent(message.content)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    ) : null}
                  </div>
                  {message.activeSkill || message.attachedSummaries?.length ? (
                    <div className="mb-2 flex flex-wrap gap-1 border-b border-border/35 pb-2 dark:border-white/10">
                      {message.activeSkill ? (
                        <span className="rounded-md bg-violet-500/15 px-1.5 py-0.5 text-[10px] text-violet-600 dark:text-violet-300">
                          {CANVAS_AGENT_SKILLS.find((item) => item.id === message.activeSkill)?.label}
                        </span>
                      ) : null}
                      {message.attachedSummaries?.map((item) => (
                        <span
                          key={item.id}
                          className="rounded-md bg-background/60 px-1.5 py-0.5 text-[10px] text-foreground/80"
                        >
                          @{item.displayName || item.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <p className="text-foreground/90 dark:text-foreground/85">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
          )}
          {busy ? (
            <div className="flex items-center gap-2 border-t border-border/55 px-3 py-2.5 text-xs text-muted-foreground dark:border-white/12">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {activeLlmModel ? '正在思考…' : '处理中…'}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border/70 bg-muted/20 p-3 dark:border-white/14 dark:bg-white/[0.03]">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-background/90 shadow-sm focus-within:border-violet-500/35 focus-within:ring-1 focus-within:ring-violet-500/20 dark:border-white/16 dark:bg-black/40">
            {referencedSummaries.length ? (
              <div className="flex flex-wrap gap-1.5 border-b border-border/40 px-2.5 pt-2.5 pb-2 dark:border-white/10">
                {referencedSummaries.map((item) => (
                  <CanvasAgentReferenceChip
                    key={item.id}
                    summary={item}
                    projectId={projectId}
                    onRemove={() => removeAgentReference(item.id)}
                  />
                ))}
              </div>
            ) : null}
            <textarea
              data-testid="canvas-agent-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              rows={10}
              placeholder={
                llmSelectionError
                  ? '请先配置并选择大语言模型'
                  : agentMode === 'chat'
                    ? CHAT_PLACEHOLDER
                    : SKILL_PLACEHOLDERS[agentMode]
              }
              className={cn(
                'min-h-[240px] w-full resize-y bg-transparent px-3 py-2 text-xs leading-relaxed outline-none focus:outline-none',
                CANVAS_NODE_CONSOLE_TEXT,
              )}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void handleSubmit()
                }
              }}
            />
            <div
              className={cn(
                'flex items-center gap-2 border-t border-border/40 px-2 py-2 dark:border-white/10',
                agentMode === 'edit_image' || agentMode === 'edit_video'
                  ? 'justify-between'
                  : 'justify-end',
              )}
            >
              {agentMode === 'edit_image' ? (
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  {imageModelOptions.length ? (
                    <Select
                      value={imageModelId}
                      onChange={(value) => rememberLastUsedAssetImageModelId(value)}
                      options={imageModelOptions}
                      placeholder="选择生图模型"
                      hideSuffixInTrigger
                      hideSuffixInMenu
                      disabled={busy || hasRunningNodes}
                      className="h-8 min-w-0 flex-1 rounded-lg border border-border/40 bg-muted/20 px-2 text-[11px]"
                    />
                  ) : (
                    <span className="flex-1 text-[11px] text-amber-600 dark:text-amber-400">
                      请先在设置中配置生图模型
                    </span>
                  )}
                  <CanvasImageParamsPopover
                    imageSize={assetImageSize}
                    onImageSizeChange={rememberLastUsedAssetImageSize}
                    model={activeImageModel}
                    tierParams={imageTierParams}
                    onTierParamsChange={(next) =>
                      rememberLastUsedAssetImageTierParams({
                        resolution: next.resolution,
                        quality: next.quality,
                      })
                    }
                  />
                </div>
              ) : agentMode === 'edit_video' ? (
                videoModelOptions.length ? (
                  <Select
                    value={videoModelId}
                    onChange={(value) =>
                      updateCanvasVideoParams(
                        buildCanvasVideoModelSwitchPatch(value, mergedVideoModels, canvasVideoParams),
                      )
                    }
                    options={videoModelOptions}
                    placeholder="选择视频模型"
                    hideSuffixInTrigger
                    hideSuffixInMenu
                    disabled={busy || hasRunningNodes}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-border/40 bg-muted/20 px-2 text-[11px]"
                  />
                ) : (
                  <span className="flex-1 text-[11px] text-amber-600 dark:text-amber-400">
                    请先在设置中配置视频模型
                  </span>
                )
              ) : null}

              {agentMode !== 'chat' ? (
                <button
                  type="button"
                  data-testid="canvas-agent-run-skill"
                  disabled={
                    busy ||
                    hasRunningNodes ||
                    (Boolean(getCanvasAgentSkillDefinition(agentMode)?.requiresUserInstruction) &&
                      !input.trim()) ||
                    (agentMode === 'edit_image' && !imageModelOptions.length) ||
                    (agentMode === 'edit_video' && !videoModelOptions.length)
                  }
                  onClick={() => handleRunSkill()}
                  className={cn(
                    'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-xl px-2.5',
                    'border border-violet-500/45 bg-violet-500/15 text-violet-700 dark:text-violet-200',
                    'disabled:opacity-40',
                    agentMode === 'edit_image' || agentMode === 'edit_video' ? 'min-w-[64px]' : 'px-3',
                  )}
                  aria-label="运行 Skill"
                  title="运行当前 Skill"
                >
                  {busy || (agentMode === 'edit_image' && imageCostLoading) ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : agentMode === 'edit_image' &&
                    shouldShowCanvasGenerateHaodou('image', activeImageModel, imageCostEstimate) ? (
                    <>
                      <span className="text-[11px] font-semibold">运行</span>
                      <span className="text-[12px] font-semibold tabular-nums">
                        {resolveCanvasGenerateHaodouCost(imageCostEstimate) ?? 0}
                      </span>
                      <HaodouIcon className="text-violet-700 dark:text-violet-200" />
                    </>
                  ) : (
                    <span className="text-[11px] font-semibold">运行</span>
                  )}
                </button>
              ) : null}

              <button
                type="button"
                data-testid="canvas-agent-send"
                disabled={busy || hasRunningNodes || !input.trim()}
                onClick={() => void handleSubmit()}
                className={cn(
                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                  'bg-primary text-primary-foreground disabled:opacity-40',
                )}
                aria-label="发送对话"
                title="发送对话（不执行 Skill）"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizontal className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        title={pendingAction?.title || ''}
        description={pendingAction?.description}
        confirmLabel={pendingAction?.confirmLabel || '确定'}
        loading={busy}
        onClose={() => {
          if (!busy) setPendingAction(null)
        }}
        onConfirm={() => {
          if (!pendingAction) return
          const action = pendingAction.onConfirm
          setPendingAction(null)
          void action()
        }}
      />
    </>
  )
}
