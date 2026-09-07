// Copyright (c) Haode AI. All rights reserved.

import type { LucideIcon } from 'lucide-react'
import { Image as ImageIcon, Loader2, Menu, Upload, Video as VideoIcon } from 'lucide-react'
import {
  CANVAS_NODE_PLACEHOLDER_TEXT,
  CANVAS_NODE_PREVIEW_FRAME,
  CANVAS_NODE_PREVIEW_HOVER_BORDER,
} from '@/lib/canvas/canvas-node-theme'
import { CANVAS_MEDIA_NODE_SQUARE_ASPECT } from '@/lib/canvas/canvas-image-node-layout'
import { cn } from '@/lib/utils'

/** 文本 / 图片节点收起态：类型标签行高度（与视频节点标题区对齐） */
export const CANVAS_MEDIA_NODE_TITLE_ROW_MIN_HEIGHT_PX = 13

export const CANVAS_MEDIA_NODE_PREVIEW_SQUARE_STYLE = {
  aspectRatio: CANVAS_MEDIA_NODE_SQUARE_ASPECT,
} as const

/** 文本 / 图片节点：标题行（类型标签 + 可选右侧名称） */
export const CANVAS_MEDIA_NODE_HEADER_ROW_CLASS = cn(
  'relative mb-0.5 flex h-[14px] w-full shrink-0 items-center gap-1',
  'cursor-grab active:cursor-grabbing',
)

export function canvasMediaNodePreviewClassName(selected?: boolean) {
  return cn(
    'group/preview relative z-[1] block w-full cursor-pointer transition-[border-color,box-shadow]',
    CANVAS_NODE_PREVIEW_FRAME,
    CANVAS_NODE_PREVIEW_HOVER_BORDER,
    selected && 'ring-2 ring-primary/35 border-primary/30 dark:border-primary/25',
  )
}

export function CanvasMediaNodeTypeLabel({
  icon: Icon,
  label,
  iconTitle,
  className,
  toneClass,
}: {
  icon: LucideIcon
  label?: string
  /** 无 label 时给图标 hover 提示 */
  iconTitle?: string
  className?: string
  /** 类型图标 / 文案色（文本节点等与标题色对齐） */
  toneClass?: string
}) {
  return (
    <div className={cn('flex min-w-0 shrink-0 items-center gap-0.5', className)}>
      <Icon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          toneClass ?? 'text-muted-foreground/90 dark:text-white/40',
        )}
        strokeWidth={1.75}
        aria-hidden={!iconTitle}
        title={iconTitle}
      />
      {label ? (
        <span
          className={cn(
            'text-[12px] font-medium tracking-wide',
            toneClass ?? 'text-muted-foreground dark:text-white/50',
          )}
        >
          {label}
        </span>
      ) : null}
    </div>
  )
}

/** 图片节点空预览：居中图片图标 */
export function CanvasMediaNodeImagePlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center" aria-hidden>
      <ImageIcon
        className="h-16 w-16 text-muted-foreground/30 dark:text-white/[0.12]"
        strokeWidth={1.1}
      />
    </div>
  )
}

/**
 * 图片节点空态（定稿）：
 * - 点虚线空白区 → 打开控制台（由外层预览 click 处理）
 * - 点「上传图片」→ 直接选图
 * - 拖放图片到此处 → 直接上传
 */
export function CanvasMediaNodeImageEmptyState({
  uploading = false,
  dragActive = false,
  onUpload,
  uploadTestId,
}: {
  uploading?: boolean
  dragActive?: boolean
  onUpload: () => void
  uploadTestId?: string
}) {
  return (
    <div
      className={cn(
        'absolute inset-2 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2',
        dragActive
          ? 'border-violet-400/70 bg-violet-500/10'
          : 'border-border/45 bg-muted/10 dark:border-white/15 dark:bg-white/[0.03]',
      )}
    >
      <ImageIcon
        className="h-10 w-10 shrink-0 text-muted-foreground/35 dark:text-white/[0.14]"
        strokeWidth={1.15}
        aria-hidden
      />
      <p className="text-center text-[11px] leading-snug text-muted-foreground/85">
        拖放图片到此处
        <br />
        或点击打开控制台
      </p>
      <button
        type="button"
        data-testid={uploadTestId}
        disabled={uploading}
        className={cn(
          'nodrag nopan inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-medium',
          'bg-foreground text-background hover:opacity-90',
          'disabled:pointer-events-none disabled:opacity-55',
        )}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onUpload()
        }}
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {uploading ? '上传中…' : '上传图片'}
      </button>
    </div>
  )
}

/** 视频节点空预览 / 屏外占位：优先封面，否则灰底 + 图标 */
export function CanvasMediaNodeVideoPlaceholder({
  hint,
  posterSrc,
}: {
  hint?: string
  posterSrc?: string
}) {
  if (posterSrc) {
    return (
      <div className="relative h-full w-full bg-muted/30 dark:bg-[#12131a]" aria-hidden>
        <img
          src={posterSrc}
          alt=""
          className="h-full w-full object-contain object-center"
          draggable={false}
        />
        {hint ? (
          <p className="pointer-events-none absolute inset-x-2 bottom-2 rounded bg-black/45 px-2 py-1 text-center text-[10px] text-white/85">
            {hint}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/45 dark:bg-white/[0.05]"
      aria-hidden
    >
      <VideoIcon
        className="h-14 w-14 text-muted-foreground/35 dark:text-white/[0.14]"
        strokeWidth={1.1}
      />
      {hint ? (
        <p className="max-w-[90%] text-center text-[10px] leading-snug text-muted-foreground/70">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** 节点已记录输出路径但本地文件无法加载 */
export function CanvasMediaNodeMissingOverlay({
  mediaKind = 'media',
}: {
  mediaKind?: 'image' | 'video' | 'media'
}) {
  const kindLabel = mediaKind === 'image' ? '图片' : mediaKind === 'video' ? '视频' : '媒体'
  return (
    <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-1.5 bg-black/55 px-3 text-center">
      <p className="text-[12px] font-medium text-amber-100">{kindLabel}文件丢失</p>
      <p className="text-[10px] leading-relaxed text-white/70">
        可能因更换过数据目录、项目被移走或文件被删。请重新生成，或通过节点菜单上传替换；亦可在设置 → 路径中核对数据根目录。
      </p>
    </div>
  )
}

/** 视频节点：排队 / 加载首帧中 */
export function CanvasMediaNodeVideoLoadOverlay({
  phase,
}: {
  phase: 'queued' | 'loading'
}) {
  return (
    <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2 bg-black/50 px-3 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-white/85" strokeWidth={1.75} />
      <p className="text-[11px] text-white/80">
        {phase === 'queued' ? '排队加载…' : '视频加载中…'}
      </p>
    </div>
  )
}

/** 视频节点：预览加载失败，可重试 */
export function CanvasMediaNodeVideoLoadErrorOverlay({
  message,
  onRetry,
}: {
  message?: string
  onRetry: () => void
}) {
  return (
    <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-2.5 bg-black/60 px-3 text-center">
      <p className="text-[12px] font-medium text-red-100">
        {message?.trim() || '视频预览加载失败'}
      </p>
      <button
        type="button"
        className="rounded-md border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] text-white/90 transition-colors hover:bg-white/20"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onRetry()
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        重试
      </button>
    </div>
  )
}

/** 文本节点空预览：居中文本图标（对齐图片 / 视频空态） */
export function CanvasMediaNodeTextPlaceholder({ text = '双击开始编辑…' }: { text?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2" aria-hidden>
      <Menu
        className="h-16 w-16 text-muted-foreground/30 dark:text-white/[0.12]"
        strokeWidth={1.1}
      />
      <p className={cn('text-[12px] leading-none', CANVAS_NODE_PLACEHOLDER_TEXT)}>{text}</p>
    </div>
  )
}
