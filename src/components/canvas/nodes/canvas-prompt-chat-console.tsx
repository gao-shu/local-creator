// Copyright (c) local-creator contributors. All rights reserved.

import { buildCanvasLlmModelOptions } from '@/lib/canvas/canvas-llm-model-options'
import { CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE, CANVAS_NODE_CONSOLE_WIDTH } from '@/lib/canvas/canvas-console-layout'
import { assessStoryboardTemplateLikeness } from '@/lib/canvas/canvas-storyboard-template-parse'
import { getLlmModelSelectionError } from '@/lib/models/llm-client'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'
import {
  CANVAS_NODE_COMPACT_SELECT,
  CANVAS_NODE_CONSOLE,
  CANVAS_NODE_CONSOLE_TEXT,
  CANVAS_NODE_INLINE_INPUT,
} from '@/lib/canvas/canvas-node-theme'

interface CanvasPromptChatConsoleProps {
  promptText: string
  chatInstruction: string
  llmModelId: string
  extracting?: boolean
  generating?: boolean
  storyboarding?: boolean
  importingTemplate?: boolean
  promptAiLocked?: boolean
  onChatInstructionChange: (value: string) => void
  onLlmModelIdChange: (value: string) => void
  onExtract: () => void
  onGenerateStoryboard: () => void
  onImportStoryboardTemplate: () => void
  onGenerate: () => void
}

export function CanvasPromptChatConsole({
  promptText,
  chatInstruction,
  llmModelId,
  extracting = false,
  generating = false,
  storyboarding = false,
  importingTemplate = false,
  promptAiLocked = false,
  onChatInstructionChange,
  onLlmModelIdChange,
  onExtract,
  onGenerateStoryboard,
  onImportStoryboardTemplate,
  onGenerate,
}: CanvasPromptChatConsoleProps) {
  const settings = useSettingsStore((state) => state.settings)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const rememberLastUsedLlmModelId = useSettingsStore((state) => state.rememberLastUsedLlmModelId)

  const mergedLlmModels = useMemo(
    () => getMergedModels('llm'),
    [getMergedModels, settings?.llmModels],
  )

  const llmOptions = useMemo(
    () => buildCanvasLlmModelOptions(mergedLlmModels),
    [mergedLlmModels],
  )

  const activeLlmModel = useMemo(
    () => mergedLlmModels.find((model) => model.id === llmModelId) ?? null,
    [mergedLlmModels, llmModelId],
  )

  const llmCostEstimate = useMemo(
    () => null,
    [activeLlmModel],
  )

  const llmSelectionError = getLlmModelSelectionError(mergedLlmModels, llmModelId)
  const busy = promptAiLocked || generating
  const canExtract = Boolean(promptText.trim()) && !busy && !llmSelectionError
  const canStoryboard = Boolean(promptText.trim()) && !busy && !llmSelectionError
  /** 导入分镜稿不依赖 LLM */
  const canImportTemplate = Boolean(promptText.trim()) && !busy
  const canGenerate = Boolean(chatInstruction.trim()) && !busy && !llmSelectionError

  const templateLikeness = useMemo(
    () => assessStoryboardTemplateLikeness(promptText),
    [promptText],
  )

  const compactSelectClass = cn(
    'nodrag nopan h-8 w-[130px] shrink-0 rounded-lg border px-2 text-[11px]',
    CANVAS_NODE_COMPACT_SELECT,
    CANVAS_NODE_INLINE_INPUT,
  )

  const actionBtnClass = cn(
    'nodrag nopan inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors',
    'border border-border/40 bg-muted/30 text-foreground/85 hover:bg-muted/50',
    'disabled:cursor-not-allowed disabled:opacity-45',
    'dark:border-white/10 dark:bg-white/[0.04] dark:text-white/80 dark:hover:bg-white/[0.08]',
  )

  const importTemplateBtnClass = cn(
    actionBtnClass,
    templateLikeness.looksLike &&
      canImportTemplate &&
      'border-violet-400/55 bg-violet-500/12 text-violet-800 hover:bg-violet-500/18 dark:border-violet-400/40 dark:bg-violet-500/15 dark:text-violet-200 dark:hover:bg-violet-500/25',
  )

  return (
    <div
      className="nodrag nopan pointer-events-none absolute z-30"
      style={{
        width: CANVAS_NODE_CONSOLE_WIDTH,
        ...CANVAS_NODE_BOTTOM_CONSOLE_ANCHOR_STYLE,
      }}
    >
      <div
        className={cn(
          CANVAS_NODE_CONSOLE,
          'nodrag nopan pointer-events-auto flex flex-col px-3.5 pt-3 pb-2.5 overflow-visible',
        )}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <textarea
          value={chatInstruction}
          onChange={(event) => onChatInstructionChange(event.target.value)}
          placeholder="描述任何你想要生成的内容"
          rows={4}
          className={cn(
            'nodrag nopan min-h-[88px] w-full flex-1 resize-none border-0 bg-transparent px-0 py-0 text-[14px] leading-relaxed',
            'focus:outline-none focus:ring-0',
            CANVAS_NODE_CONSOLE_TEXT,
          )}
          onPointerDown={(event) => event.stopPropagation()}
        />

        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-1.5 pt-1">
          <Select
            value={llmModelId}
            onChange={(value) => {
              onLlmModelIdChange(value)
              rememberLastUsedLlmModelId(value)
            }}
            options={llmOptions}
            placeholder="选择 LLM"
            disabled={llmOptions.length === 0 || busy}
            className={compactSelectClass}
          />

          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <button
              type="button"
              data-testid="canvas-prompt-generate-extract"
              disabled={!canExtract}
              onClick={onExtract}
              className={actionBtnClass}
            >
              {extracting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5 opacity-80" />
              )}
              提取资产
            </button>

            <button
              type="button"
              data-testid="canvas-prompt-generate-storyboard"
              disabled={!canStoryboard}
              onClick={onGenerateStoryboard}
              className={actionBtnClass}
            >
              {storyboarding ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Clapperboard className="h-3.5 w-3.5 opacity-80" />
              )}
              智能分镜
            </button>

            <button
              type="button"
              data-testid="canvas-prompt-import-storyboard-template"
              disabled={!canImportTemplate}
              onClick={onImportStoryboardTemplate}
              title={
                templateLikeness.looksLike
                  ? `检测到 ${templateLikeness.shotBoundaryCount} 个镜头号分段，推荐导入分镜稿（不走 LLM）`
                  : '按「镜头号」模板解析，不走 LLM'
              }
              className={importTemplateBtnClass}
            >
              {importingTemplate ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileStack className="h-3.5 w-3.5 opacity-80" />
              )}
              导入分镜稿
            </button>

            <CanvasGeneratePill
              running={generating}
              disabled={!canGenerate}
              showGenerateCost={false}
              generateCost={null}
              className="h-8 gap-1 px-3"
              onClick={onGenerate}
            />
          </div>
        </div>

        {templateLikeness.looksLike && !llmSelectionError ? (
          <p className="mt-2 text-[10px] leading-snug text-violet-600/90 dark:text-violet-300/90">
            检测到镜头号模板
            {templateLikeness.shotBoundaryCount > 1
              ? `（${templateLikeness.shotBoundaryCount} 段）`
              : ''}
            ，推荐用「导入分镜稿」本地拆镜
            {templateLikeness.strong ? '；点「智能分镜」仍可用 LLM' : ''}
          </p>
        ) : null}

        {llmSelectionError ? (
          <p className="mt-2 text-[10px] leading-snug text-amber-600 dark:text-amber-400">
            {llmSelectionError}
          </p>
        ) : null}
      </div>
    </div>
  )
}
