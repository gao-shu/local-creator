import { Loader2 } from 'lucide-react'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WorkflowEpisodeAiButtonsProps {
  scriptReadyForSplit?: boolean
  scriptReadyForExtract?: boolean
  /** @deprecated 使用 scriptReadyForSplit / scriptReadyForExtract */
  scriptReady?: boolean
  splitBusy: boolean
  extractBusy: boolean
  taskBusy: boolean
  taskMessage?: string
  onSplit: () => void
  onExtract: () => void
  splitSourceHint?: string
  extractSourceHint?: string
  /** Step1 使用短文案 */
  compactLabels?: boolean
  /** @deprecated 使用 splitSourceHint / extractSourceHint */
  singleEpisodeScript?: boolean
  className?: string
  showTaskMessage?: boolean
}

export function WorkflowEpisodeAiButtons({
  scriptReadyForSplit,
  scriptReadyForExtract,
  scriptReady,
  splitBusy,
  extractBusy,
  taskBusy,
  taskMessage,
  onSplit,
  onExtract,
  splitSourceHint,
  extractSourceHint,
  compactLabels = false,
  singleEpisodeScript = false,
  className,
  showTaskMessage = true,
}: WorkflowEpisodeAiButtonsProps) {
  const splitReady = scriptReadyForSplit ?? scriptReady ?? false
  const extractReady = scriptReadyForExtract ?? scriptReady ?? false

  const legacyHint = singleEpisodeScript
    ? '单集时使用本集脚本'
    : '多集时使用各集脚本拼接'
  const resolvedSplitHint = splitSourceHint || legacyHint
  const resolvedExtractHint = extractSourceHint || legacyHint

  const splitLabel = compactLabels
    ? splitBusy
      ? '处理中…'
      : '分集'
    : splitBusy
      ? '处理中…'
      : 'AI 分集并提取资产'

  const extractLabel = compactLabels
    ? extractBusy
      ? '提取中…'
      : '提取资产'
    : extractBusy
      ? '提取中…'
      : '一键提取资产'

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <WorkshopAiButton
        type="button"
        sizePreset={compactLabels ? 'default' : 'header'}
        onClick={onSplit}
        loading={splitBusy}
        disabled={!splitReady || extractBusy}
        title={
          splitReady
            ? `${resolvedSplitHint}；会重新分集并覆盖现有分集与资产草稿`
            : '录入剧本或本集脚本后可 AI 分集并提取资产'
        }
      >
        {splitLabel}
      </WorkshopAiButton>

      <Button
        type="button"
        variant="outline"
        className={cn(
          'rounded-xl gap-1.5 border-cyan-500/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/10',
          compactLabels ? 'h-9' : 'h-10',
        )}
        onClick={onExtract}
        disabled={!extractReady || taskBusy}
        title={
          extractReady
            ? `${resolvedExtractHint}，不修改分集内容`
            : '录入剧本或本集脚本后可提取资产'
        }
      >
        {extractBusy ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : null}
        {extractLabel}
      </Button>

      {showTaskMessage && (taskBusy || taskMessage) ? (
        <span className="text-xs text-muted-foreground">
          {taskMessage || (extractBusy ? '正在提取资产…' : '正在智能分集并同步资产…')}
        </span>
      ) : null}
    </div>
  )
}
