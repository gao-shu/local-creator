// Copyright (c) Haode AI. All rights reserved.

import { GripVertical, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMultiVideoDrag } from '@/hooks/use-multi-video-drag'
import type { CanvasVideoDragItem } from '@/lib/canvas/canvas-video-drag-items'
import { cn } from '@/lib/utils'

interface CanvasSelectionToolbarProps {
  count: number
  /** 选中节点中是否有正在生成的（仅提示，不整栏禁用删除） */
  selectedBusy?: boolean
  videoDragItems?: CanvasVideoDragItem[]
  selectedVideoCount?: number
  onDelete: () => void
}

function hasMultiVideoDragBridge(): boolean {
  return Boolean(
    window.electronAPI?.isElectron
    && window.electronAPI?.prepareVideoDragSources
    && window.electronAPI?.startVideoDrag,
  )
}

/** 多选节点时顶部浮动操作条（选中含视频节点时可拖到剪映） */
export function CanvasSelectionToolbar({
  count,
  selectedBusy = false,
  videoDragItems = [],
  selectedVideoCount = 0,
  onDelete,
}: CanvasSelectionToolbarProps) {
  const {
    draggableCount,
    isPreparingDragFile,
    prepareVideoDragFiles,
    handleVideoDragStart,
  } = useMultiVideoDrag(videoDragItems)

  if (count < 2) return null

  const hasBridge = hasMultiVideoDragBridge()
  const showVideoDrag = selectedVideoCount > 0
  const canDragVideos = hasBridge && draggableCount > 0
  const displayCount = draggableCount > 0 ? draggableCount : selectedVideoCount

  const dragTitle = !draggableCount
    ? '选中的视频节点暂无可拖拽文件，请确认视频已生成或上传完成'
    : !hasBridge
      ? '请使用桌面客户端，并完全重启应用后再试'
      : isPreparingDragFile
        ? '正在准备可拖拽视频文件'
        : `按住按钮拖到剪映时间轴（${draggableCount} 个视频）`

  const handleDragPointerDown = (event: React.PointerEvent) => {
    event.stopPropagation()
    if (!draggableCount) {
      toast.warning('选中的视频暂无可拖拽文件，请确认已生成或上传完成')
      return
    }
    if (!hasBridge) {
      toast.warning('当前环境不支持拖到剪映，请使用桌面客户端并重启应用')
      return
    }
    void prepareVideoDragFiles({ silent: true })
  }

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-1/2 top-3 z-[40] flex max-w-[min(92vw,720px)] -translate-x-1/2 items-center gap-2',
        'rounded-xl border border-border/50 bg-card/95 px-3 py-2 shadow-xl backdrop-blur-md',
        'dark:border-white/10 dark:bg-[#1a1b1f]/95',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <span className="shrink-0 px-1 text-[12px] text-muted-foreground dark:text-white/65">
        已选择 {count} 个节点
        {selectedBusy ? '（含生成中）' : ''}
      </span>

      {showVideoDrag ? (
        <>
          <div className="h-4 w-px shrink-0 bg-border/50 dark:bg-white/10" />
          <button
            type="button"
            draggable={canDragVideos && !isPreparingDragFile}
            onPointerDown={handleDragPointerDown}
            onDragStart={(event) => {
              event.stopPropagation()
              void handleVideoDragStart(event)
            }}
            title={dragTitle}
            className={cn(
              'inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2.5 text-[10px] font-medium transition-colors',
              canDragVideos
                ? 'bg-cyan-600/90 text-white hover:bg-cyan-500 cursor-grab active:cursor-grabbing'
                : 'border border-border/40 text-muted-foreground opacity-70 hover:opacity-100',
            )}
          >
            {isPreparingDragFile ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <GripVertical className="h-3 w-3" />
            )}
            拖拽到剪映
            <span className="opacity-80">({displayCount})</span>
          </button>
        </>
      ) : null}

      <div className="h-4 w-px shrink-0 bg-border/50 dark:bg-white/10" />
      <button
        type="button"
        title={
          selectedBusy
            ? '选中项含生成中节点时，生成中的节点不会被删除'
            : '删除选中节点'
        }
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
        className={cn(
          'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] transition-colors',
          'text-red-500 hover:bg-red-500/10 dark:text-red-400',
        )}
      >
        <Trash2 className="h-3.5 w-3.5" />
        删除
      </button>
    </div>
  )
}
