// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AudioLines, Camera, ChevronDown, FolderOpen, Loader2, Upload } from 'lucide-react'
import {
  CANVAS_NODE_DROPDOWN,
  CANVAS_NODE_DROPDOWN_ITEM,
  CANVAS_NODE_TOOLBAR,
} from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

interface CanvasVideoTopToolbarProps {
  previewSrc?: string
  running?: boolean
  uploading?: boolean
  capturingFrame?: boolean
  onUpload: () => void
  onRevealFolder: () => void
  revealingFolder?: boolean
  onCaptureFrame?: () => void
  /** 截取视频最后一帧到画布 */
  onCaptureLastFrame?: () => void
  onExtractAudio?: () => void
  extractAudioDisabled?: boolean
  extractAudioTitle?: string
}

function ToolbarButton({
  title,
  label,
  icon,
  disabled,
  onClick,
  className,
}: {
  title: string
  label?: string
  icon: ReactNode
  disabled?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation()
        if (disabled) return
        onClick()
      }}
      className={cn(
        'nodrag nopan inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5',
        'text-[12px] transition-colors',
        'text-foreground/75 hover:bg-muted/60 hover:text-foreground',
        'dark:text-white/75 dark:hover:bg-white/[0.08] dark:hover:text-white',
        disabled && 'cursor-not-allowed opacity-40',
        className,
      )}
    >
      {icon}
      {label ? <span className="whitespace-nowrap">{label}</span> : null}
    </button>
  )
}

export function CanvasVideoTopToolbar({
  previewSrc,
  running = false,
  uploading = false,
  capturingFrame = false,
  onUpload,
  onRevealFolder,
  revealingFolder = false,
  onCaptureFrame,
  onCaptureLastFrame,
  onExtractAudio,
  extractAudioDisabled = true,
  extractAudioTitle = '提取音频',
}: CanvasVideoTopToolbarProps) {
  const hasVideo = Boolean(previewSrc)
  const busy = running || uploading || capturingFrame
  const [captureMenuOpen, setCaptureMenuOpen] = useState(false)
  const captureMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!captureMenuOpen) return
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node
      if (captureMenuRef.current && !captureMenuRef.current.contains(target)) {
        setCaptureMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [captureMenuOpen])

  return (
    <div
      className={cn(
        'nodrag nopan flex w-full items-center gap-1 px-1.5 py-1',
        CANVAS_NODE_TOOLBAR,
      )}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ToolbarButton
        title="上传视频"
        label={uploading ? '上传中…' : '上传视频'}
        disabled={busy}
        icon={
          uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" strokeWidth={2} />
          )
        }
        onClick={onUpload}
      />
      <ToolbarButton
        title={hasVideo ? '打开所在文件夹' : '打开视频文件夹'}
        label={revealingFolder ? '打开中…' : '打开文件夹'}
        disabled={busy || revealingFolder}
        icon={
          revealingFolder ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FolderOpen className="h-4 w-4" strokeWidth={2} />
          )
        }
        onClick={onRevealFolder}
      />

      <div ref={captureMenuRef} className="relative flex shrink-0 items-center">
        <ToolbarButton
          title={
            hasVideo
              ? capturingFrame
                ? '正在截取…'
                : '截取当前帧到画布'
              : '请先生成或上传视频'
          }
          label={capturingFrame ? '截取中…' : '截图'}
          disabled={!hasVideo || busy || !onCaptureFrame}
          className="rounded-r-none pr-1.5"
          icon={
            capturingFrame ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" strokeWidth={2} />
            )
          }
          onClick={() => {
            setCaptureMenuOpen(false)
            onCaptureFrame?.()
          }}
        />
        <ToolbarButton
          title={hasVideo ? '更多截帧选项' : '请先生成或上传视频'}
          disabled={!hasVideo || busy || !onCaptureLastFrame}
          className="rounded-l-none border-l border-border/40 px-1.5 dark:border-white/10"
          icon={<ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />}
          onClick={() => setCaptureMenuOpen((open) => !open)}
        />
        {captureMenuOpen ? (
          <div
            className={cn(
              'nodrag nopan absolute left-0 top-full z-30 mt-1 min-w-[132px] overflow-hidden',
              CANVAS_NODE_DROPDOWN,
            )}
          >
            <button
              type="button"
              disabled={!hasVideo || busy || !onCaptureLastFrame}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                if (!hasVideo || busy || !onCaptureLastFrame) return
                setCaptureMenuOpen(false)
                onCaptureLastFrame()
              }}
              className={cn(
                'block w-full px-3 py-2 text-left text-[12px] transition-colors',
                CANVAS_NODE_DROPDOWN_ITEM,
                (!hasVideo || busy || !onCaptureLastFrame) && 'cursor-not-allowed opacity-40',
              )}
            >
              截尾帧
            </button>
          </div>
        ) : null}
      </div>

      <ToolbarButton
        title={extractAudioTitle}
        label="提取音频"
        disabled={extractAudioDisabled || busy}
        icon={<AudioLines className="h-4 w-4" strokeWidth={2} />}
        onClick={() => onExtractAudio?.()}
      />
    </div>
  )
}
