// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useMemo, useState } from 'react'
import { Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Select } from '@/components/ui/select'
import { HaodouIcon } from '@/components/ui/haodou-icon'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { CanvasBatchGenerateConfirmDialog } from '@/components/canvas/dialogs/canvas-batch-generate-confirm-dialog'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { useVideoBatchBillingPreview } from '@/hooks/use-video-batch-billing-preview'
import {
  collectPendingStoryboardShotItems,
  collectPendingStoryboardShots,
} from '@/lib/canvas/canvas-shot-utils'
import { buildCanvasVideoModelSwitchPatch } from '@/lib/canvas/canvas-video-params-sync'
import { buildVideoModelSelectOptions } from '@/lib/models/model-select-options'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

interface CanvasAiBarProps {
  projectId: string
}

export function CanvasAiBar({ projectId: _projectId }: CanvasAiBarProps) {
  const {
    nodes,
    canvasVideoParams,
    updateCanvasVideoParams,
    requestBatchStoryboardVideos,
    batchVideoGenerating,
  } = useCanvasEditor()
  const settings = useSettingsStore((state) => state.settings)
  const getMergedModels = useSettingsStore((state) => state.getMergedModels)
  const systemVideoCatalog = useSettingsStore((state) => state.systemModelsByKind.video)
  const authToken = useAuthStore((state) => state.token)

  const [batchConfirmOpen, setBatchConfirmOpen] = useState(false)

  const videoModels = useMemo(() => getMergedModels('video'), [getMergedModels, settings?.videoModels])
  const videoModelOptions = useMemo(
    () => buildVideoModelSelectOptions(videoModels, systemVideoCatalog, authToken, { modelPickerOnly: true }),
    [authToken, systemVideoCatalog, videoModels],
  )
  const videoModelId =
    canvasVideoParams.videoModelId && videoModels.some((model) => model.id === canvasVideoParams.videoModelId)
      ? canvasVideoParams.videoModelId
      : videoModels[0]?.id ?? ''
  const selectedVideoModel = useMemo(
    () => videoModels.find((model) => model.id === videoModelId) ?? null,
    [videoModelId, videoModels],
  )

  const pendingShots = useMemo(() => collectPendingStoryboardShots(nodes), [nodes])
  const pendingShotItems = useMemo(() => collectPendingStoryboardShotItems(nodes), [nodes])
  const pendingShotCount = pendingShots.length
  const { barPreview: batchCostPreview, loading: batchCostLoading } = useVideoBatchBillingPreview({
    videoModel: selectedVideoModel,
    shotCount: pendingShotCount,
    durationSec: canvasVideoParams.durationSec ?? 5,
    resolution: canvasVideoParams.resolution,
    apiBase: settings?.apiBaseUrl,
    enabled: pendingShotCount > 0,
  })

  const handleBatchGenerate = useCallback(() => {
    if (!pendingShotCount) {
      toast.message('暂无待处理的视频节点')
      return
    }
    if (batchVideoGenerating) {
      toast.info('批量生成进行中…')
      return
    }
    setBatchConfirmOpen(true)
  }, [batchVideoGenerating, pendingShotCount])

  const handleBatchConfirm = useCallback(
    (nodeIds: string[]) => {
      setBatchConfirmOpen(false)
      void requestBatchStoryboardVideos(nodeIds)
    },
    [requestBatchStoryboardVideos],
  )

  const handleVideoModelChange = useCallback(
    (value: string) => {
      updateCanvasVideoParams(
        buildCanvasVideoModelSwitchPatch(value, videoModels, canvasVideoParams),
      )
    },
    [canvasVideoParams, updateCanvasVideoParams, videoModels],
  )

  const batchButtonDisabled = batchVideoGenerating || pendingShotCount === 0 || !videoModelOptions.length
  const showBatchCost = pendingShotCount > 0 && (batchCostLoading || batchCostPreview)

  const formatHaodouAmount = (value: number) =>
    Number.isInteger(value) ? String(value) : value.toFixed(1)

  return (
    <div
      data-testid="canvas-ai-bar"
      className={cn(
        'pointer-events-auto absolute bottom-3 left-1/2 z-30 flex max-w-[min(960px,calc(100%-24px))] -translate-x-1/2 items-center gap-2',
        'rounded-xl border border-border/40 bg-card/94 px-2.5 py-1.5 shadow-lg backdrop-blur-md',
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 text-[11px] text-muted-foreground">视频模型</span>
        {videoModelOptions.length ? (
          <Select
            value={videoModelId}
            onChange={handleVideoModelChange}
            options={videoModelOptions}
            placeholder="模型"
            hideSuffixInTrigger
            hideSuffixInMenu
            className="h-7 min-w-[140px] max-w-[220px] border-0 bg-muted/30 px-2 text-[11px] shadow-none"
          />
        ) : (
          <span className="text-[10px] text-red-400">请配置视频模型</span>
        )}
      </div>

      <span className="h-5 w-px shrink-0 bg-border/45" aria-hidden />

      {showBatchCost ? (
        <>
          <div
            data-testid="canvas-ai-bar-batch-cost"
            className="inline-flex shrink-0 items-center gap-0.5 text-amber-600/90 dark:text-amber-400/90"
            title={batchCostPreview?.kind === 'haodou' ? batchCostPreview.tooltip : undefined}
          >
            {batchCostLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : batchCostPreview?.kind === 'haodou' ? (
              <>
                <span className="text-[12px] font-semibold tabular-nums">
                  需{formatHaodouAmount(batchCostPreview.amount)}
                </span>
                <HaodouIcon />
              </>
            ) : batchCostPreview?.kind === 'project' ? (
              <span className="text-[10px]">{batchCostPreview.text}</span>
            ) : null}
          </div>
          <span className="h-5 w-px shrink-0 bg-border/45" aria-hidden />
        </>
      ) : null}

      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <button
              type="button"
              data-testid="canvas-ai-bar-batch-generate"
              disabled={batchButtonDisabled}
              onClick={handleBatchGenerate}
              className={cn(
                'inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-medium transition-colors',
                'text-foreground/85 hover:bg-muted/60 hover:text-foreground',
                'disabled:cursor-not-allowed disabled:opacity-45',
              )}
            >
              {batchVideoGenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              <span className="whitespace-nowrap">
                {batchVideoGenerating
                  ? '生成中…'
                  : pendingShotCount
                    ? `生成全部待处理视频 (${pendingShotCount})`
                    : '生成全部待处理视频'}
              </span>
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          className="max-w-[280px] px-3 py-2"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {pendingShotCount > 0 ? (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-popover-foreground/90">
                待处理视频
              </p>
              <ul className="space-y-0.5">
                {pendingShotItems.map((item, index) => (
                  <li key={item.nodeId} className="text-[11px] leading-relaxed text-popover-foreground/75">
                    {index + 1}. {item.title}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[11px] text-popover-foreground/75">暂无待处理的视频节点</p>
          )}
        </TooltipContent>
      </Tooltip>

      <CanvasBatchGenerateConfirmDialog
        open={batchConfirmOpen}
        items={pendingShotItems}
        videoModel={selectedVideoModel}
        durationSec={canvasVideoParams.durationSec ?? 5}
        resolution={canvasVideoParams.resolution}
        aspectRatio={canvasVideoParams.aspectRatio}
        referenceMode={canvasVideoParams.referenceMode}
        loading={batchVideoGenerating}
        onClose={() => setBatchConfirmOpen(false)}
        onConfirm={handleBatchConfirm}
      />
    </div>
  )
}
