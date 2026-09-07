// Copyright (c) Haode AI. All rights reserved.

import type { DragEvent } from 'react'
import { AudioLines, Download, FolderOpen, Loader2, Maximize2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { downloadVideoPreview } from '@/lib/canvas/canvas-video-actions'
import { useVideoDrag } from '@/hooks/use-video-drag'
import { cn } from '@/lib/utils'

/** 视频预览角标：比通用 overlay 缩小约三分之一 */
const VIDEO_OVERLAY_ACTION =
  'canvas-node-sharp-ui flex h-[21px] w-[21px] items-center justify-center rounded-md border border-white/12 bg-[#1c1c1e] text-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-colors hover:bg-[#2c2c30]'

const VIDEO_OVERLAY_ACTION_TEXT =
  'canvas-node-sharp-ui inline-flex h-[21px] items-center rounded-md border border-white/12 bg-[#1c1c1e] px-1.5 text-[9px] font-medium leading-none text-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-colors hover:bg-[#2c2c30]'

const VIDEO_OVERLAY_ACTION_PRIMARY =
  'canvas-node-sharp-ui flex h-[21px] w-[21px] items-center justify-center rounded-md border border-sky-400/45 bg-sky-500 text-white shadow-[0_2px_6px_rgba(14,165,233,0.35)] transition-colors hover:bg-sky-400'

const VIDEO_OVERLAY_ACTION_DANGER =
  'canvas-node-sharp-ui flex h-[21px] w-[21px] items-center justify-center rounded-md border border-white/12 bg-[#1c1c1e] text-white shadow-[0_2px_6px_rgba(0,0,0,0.4)] transition-colors hover:border-red-400/50 hover:bg-red-600'

const VIDEO_OVERLAY_ICON = 'h-2.5 w-2.5'

interface CanvasVideoCornerActionsProps {
  previewSrc: string
  capcutStoredPath?: string
  capcutProjectRoot?: string
  capcutFilename?: string
  running?: boolean
  uploading?: boolean
  revealingFolder?: boolean
  visible?: boolean
  onPreview: () => void
  onDelete: () => void
  onRevealFolder: () => void
  onExtractAudio?: () => void
  extractAudioDisabled?: boolean
  extractAudioTitle?: string
}

export function CanvasVideoCornerActions({
  previewSrc,
  capcutStoredPath = '',
  capcutProjectRoot,
  capcutFilename,
  running = false,
  uploading = false,
  revealingFolder = false,
  visible = false,
  onPreview,
  onDelete,
  onRevealFolder,
  onExtractAudio,
  extractAudioDisabled = true,
  extractAudioTitle = '提取音频',
}: CanvasVideoCornerActionsProps) {
  if (!previewSrc) return null

  const videoActionsDisabled = running || uploading || revealingFolder
  const capcutPathReady = Boolean(capcutStoredPath.trim()) && !capcutStoredPath.startsWith('preview:')
  const {
    hasVideoDragBridge,
    isPreparingDragFile,
    handleVideoDragStart,
    revealVideoFile,
  } = useVideoDrag(capcutStoredPath, { projectRoot: capcutProjectRoot, filename: capcutFilename })
  const capcutDisabled = videoActionsDisabled || !capcutPathReady || isPreparingDragFile
  const capcutTitle = !capcutPathReady
    ? '请先生成或上传视频'
    : isPreparingDragFile
      ? '正在准备可拖拽视频文件'
      : hasVideoDragBridge
        ? '按住后拖到剪映，点击可定位文件'
        : '当前环境不支持直接拖到剪映，点击打开文件夹'

  const handleCapcutClick = () => {
    if (!capcutPathReady) return
    if (hasVideoDragBridge) {
      void revealVideoFile()
      return
    }
    toast.warning('当前环境不支持直接拖到剪映，已打开文件夹')
    onRevealFolder()
  }

  const handleDownload = () => {
    if (!previewSrc || videoActionsDisabled) return
    try {
      downloadVideoPreview(previewSrc)
    } catch {
      toast.error('下载失败')
    }
  }

  return (
    <div
      className={cn(
        'absolute right-2 top-2 z-[15] flex items-center gap-1 nodrag nopan',
        'transition-opacity duration-150',
        visible
          ? 'pointer-events-auto opacity-100'
          : 'pointer-events-none opacity-0',
      )}
    >
      {capcutPathReady ? (
        <button
          type="button"
          title={capcutTitle}
          disabled={capcutDisabled}
          draggable={hasVideoDragBridge && !capcutDisabled}
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event: DragEvent<HTMLButtonElement>) => {
            event.stopPropagation()
            void handleVideoDragStart(event)
          }}
          onClick={(event) => {
            event.stopPropagation()
            handleCapcutClick()
          }}
          className={cn(
            VIDEO_OVERLAY_ACTION_TEXT,
            'disabled:pointer-events-none disabled:opacity-40',
          )}
        >
          {isPreparingDragFile ? (
            <Loader2 className={cn(VIDEO_OVERLAY_ICON, 'animate-spin')} />
          ) : (
            '拖剪映'
          )}
        </button>
      ) : null}

      <button
        type="button"
        title="下载"
        disabled={videoActionsDisabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          handleDownload()
        }}
        className={cn(
          VIDEO_OVERLAY_ACTION_PRIMARY,
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Download className={VIDEO_OVERLAY_ICON} strokeWidth={2.25} />
      </button>

      <button
        type="button"
        title={revealingFolder ? '打开中…' : '打开所在文件夹'}
        disabled={videoActionsDisabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onRevealFolder()
        }}
        className={cn(
          VIDEO_OVERLAY_ACTION,
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        {revealingFolder ? (
          <Loader2 className={cn(VIDEO_OVERLAY_ICON, 'animate-spin')} strokeWidth={2.25} />
        ) : (
          <FolderOpen className={VIDEO_OVERLAY_ICON} strokeWidth={2.25} />
        )}
      </button>

      <button
        type="button"
        title={extractAudioTitle}
        disabled={videoActionsDisabled || extractAudioDisabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          if (videoActionsDisabled || extractAudioDisabled) return
          onExtractAudio?.()
        }}
        className={cn(
          VIDEO_OVERLAY_ACTION,
          'disabled:pointer-events-none disabled:opacity-40',
        )}
        data-testid="canvas-video-extract-audio-trigger"
      >
        <AudioLines className={VIDEO_OVERLAY_ICON} strokeWidth={2.25} />
      </button>

      <button
        type="button"
        title="放大预览"
        disabled={videoActionsDisabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onPreview()
        }}
        className={cn(
          VIDEO_OVERLAY_ACTION,
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Maximize2 className={VIDEO_OVERLAY_ICON} strokeWidth={2.25} />
      </button>

      <button
        type="button"
        title="删除视频"
        disabled={videoActionsDisabled}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onDelete()
        }}
        className={cn(
          VIDEO_OVERLAY_ACTION_DANGER,
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        <Trash2 className={VIDEO_OVERLAY_ICON} strokeWidth={2.25} />
      </button>
    </div>
  )
}
