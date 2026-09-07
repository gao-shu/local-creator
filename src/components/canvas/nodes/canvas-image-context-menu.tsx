// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Copy, Trash2 } from 'lucide-react'
import type { CanvasImageAssetRole } from '@/types/canvas-nodes'
import { CANVAS_IMAGE_ROLE_LABELS, CANVAS_IMAGE_ROLE_OPTIONS } from '@/lib/canvas/canvas-image-role'
import { cn } from '@/lib/utils'

export interface CanvasImageContextMenuAnchor {
  x: number
  y: number
}

interface CanvasImageContextMenuProps {
  anchor: CanvasImageContextMenuAnchor | null
  onClose: () => void
  onDuplicate: () => void
  onDelete: () => void
  onAddImageRole: (role: CanvasImageAssetRole) => void
  onAddVideo: () => void
  onAddVoice: () => void
}

function MenuRow({
  label,
  icon: Icon,
  danger,
  suffix,
  onClick,
  onMouseEnter,
}: {
  label: string
  icon?: typeof Copy
  danger?: boolean
  suffix?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors',
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-foreground/90 hover:bg-muted/55',
      )}
    >
      {Icon ? (
        <Icon className={cn('h-4 w-4 shrink-0', danger ? 'text-red-400' : 'text-muted-foreground')} />
      ) : (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[11px] text-white/45">
          {label.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1">{label}</span>
      {suffix ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-white/35" /> : null}
    </button>
  )
}

const IMAGE_ROLE_ITEMS = CANVAS_IMAGE_ROLE_OPTIONS

/** 画镜风格：图片节点右键菜单 */
export function CanvasImageContextMenu({
  anchor,
  onClose,
  onDuplicate,
  onDelete,
  onAddImageRole,
  onAddVideo,
  onAddVoice,
}: CanvasImageContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [imageSubOpen, setImageSubOpen] = useState(false)

  useEffect(() => {
    if (!anchor) {
      setImageSubOpen(false)
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [anchor, onClose])

  useEffect(() => {
    if (!anchor || !panelRef.current) return
    const panel = panelRef.current
    const rect = panel.getBoundingClientRect()
    const margin = 12
    let left = anchor.x + 8
    let top = anchor.y + 8
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, anchor.x - rect.width - 8)
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin)
    }
    panel.style.left = `${left}px`
    panel.style.top = `${top}px`
  }, [anchor, imageSubOpen])

  if (!anchor) return null

  const run = (action: () => void) => {
    action()
    onClose()
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="关闭菜单"
        className="fixed inset-0 z-[90] bg-transparent"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault()
          onClose()
        }}
      />
      <div
        ref={panelRef}
        className="fixed z-[91] flex items-start gap-1"
        style={{ left: anchor.x + 8, top: anchor.y + 8 }}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
        onMouseLeave={() => setImageSubOpen(false)}
      >
        <div
          className={cn(
            'w-[220px] overflow-hidden rounded-2xl border border-border/35',
            'bg-[#1a1b1f]/96 p-2 shadow-2xl backdrop-blur-md',
          )}
        >
          <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground/80">图片 → 操作</p>

          <MenuRow label="复制节点" icon={Copy} onMouseEnter={() => setImageSubOpen(false)} onClick={() => run(onDuplicate)} />
          <MenuRow label="删除节点" icon={Trash2} danger onMouseEnter={() => setImageSubOpen(false)} onClick={() => run(onDelete)} />

          <div className="my-1.5 border-t border-border/25" />

          <MenuRow
            label="图片"
            suffix
            onMouseEnter={() => setImageSubOpen(true)}
            onClick={() => setImageSubOpen(true)}
          />
          <MenuRow label="视频" onMouseEnter={() => setImageSubOpen(false)} onClick={() => run(onAddVideo)} />
          <MenuRow label="音色" onMouseEnter={() => setImageSubOpen(false)} onClick={() => run(onAddVoice)} />
        </div>

        {imageSubOpen ? (
          <div
            className={cn(
              'w-[132px] overflow-hidden rounded-2xl border border-border/35',
              'bg-[#1a1b1f]/96 p-2 shadow-2xl backdrop-blur-md',
            )}
            onMouseEnter={() => setImageSubOpen(true)}
          >
            {IMAGE_ROLE_ITEMS.map((role) => (
              <MenuRow
                key={`add-${role}`}
                label={CANVAS_IMAGE_ROLE_LABELS[role]}
                onClick={() => run(() => onAddImageRole(role))}
              />
            ))}
          </div>
        ) : null}
      </div>
    </>,
    document.body,
  )
}
