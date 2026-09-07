// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ExternalLink, Loader2, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CanvasProjectContextMenuAnchor {
  x: number
  y: number
}

interface CanvasProjectContextMenuProps {
  anchor: CanvasProjectContextMenuAnchor | null
  title?: string
  deleting?: boolean
  onClose: () => void
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}

function MenuRow({
  label,
  icon: Icon,
  danger,
  disabled,
  loading,
  onClick,
}: {
  label: string
  icon: typeof Pencil
  danger?: boolean
  disabled?: boolean
  loading?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-45',
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-foreground/90 hover:bg-muted/55',
      )}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <Icon className={cn('h-4 w-4 shrink-0', danger ? 'text-red-400' : 'text-muted-foreground')} />
      )}
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  )
}

/** 画布项目卡片右键菜单 */
export function CanvasProjectContextMenu({
  anchor,
  title = '项目操作',
  deleting = false,
  onClose,
  onOpen,
  onEdit,
  onDelete,
}: CanvasProjectContextMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!anchor) return
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
  }, [anchor])

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
        className="fixed z-[91]"
        style={{ left: anchor.x + 8, top: anchor.y + 8 }}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          className={cn(
            'w-[200px] overflow-hidden rounded-2xl border border-border/35',
            'bg-[#1a1b1f]/96 p-2 shadow-2xl backdrop-blur-md',
          )}
        >
          <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground/80">{title}</p>
          <MenuRow label="打开画布" icon={ExternalLink} onClick={() => run(onOpen)} />
          <MenuRow label="编辑项目" icon={Pencil} onClick={() => run(onEdit)} />
          <MenuRow
            label="移入回收站"
            icon={Trash2}
            danger
            loading={deleting}
            disabled={deleting}
            onClick={() => run(onDelete)}
          />
        </div>
      </div>
    </>,
    document.body,
  )
}
