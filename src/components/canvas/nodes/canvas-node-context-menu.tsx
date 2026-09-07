// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Copy, Trash2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CanvasNodeContextMenuAnchor {
  x: number
  y: number
}

export interface CanvasNodeContextMenuItem {
  label: string
  icon?: LucideIcon
  disabled?: boolean
  title?: string
  onClick: () => void
}

interface CanvasNodeContextMenuProps {
  anchor: CanvasNodeContextMenuAnchor | null
  title?: string
  onClose: () => void
  onDuplicate?: () => void
  onDelete: () => void
  extraItems?: CanvasNodeContextMenuItem[]
}

function MenuRow({
  label,
  icon: Icon,
  danger,
  disabled,
  title,
  onClick,
}: {
  label: string
  icon: LucideIcon
  danger?: boolean
  disabled?: boolean
  title?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors',
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-foreground/90 hover:bg-muted/55',
        disabled && 'cursor-not-allowed opacity-45',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', danger ? 'text-red-400' : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1">{label}</span>
    </button>
  )
}

/** 通用画布节点右键菜单（复制 / 删除） */
export function CanvasNodeContextMenu({
  anchor,
  title = '节点操作',
  onClose,
  onDuplicate,
  onDelete,
  extraItems = [],
}: CanvasNodeContextMenuProps) {
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
          {onDuplicate ? (
            <MenuRow label="复制节点" icon={Copy} onClick={() => run(onDuplicate)} />
          ) : null}
          {extraItems.map((item) => (
            <MenuRow
              key={item.label}
              label={item.label}
              icon={item.icon ?? Copy}
              disabled={item.disabled}
              title={item.title}
              onClick={() => {
                if (item.disabled) return
                run(item.onClick)
              }}
            />
          ))}
          <MenuRow label="删除节点" icon={Trash2} danger onClick={() => run(onDelete)} />
        </div>
      </div>
    </>,
    document.body,
  )
}
