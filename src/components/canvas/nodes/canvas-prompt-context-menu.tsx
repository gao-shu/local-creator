// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Clapperboard, Copy, FileStack, Loader2, StickyNote, Trash2, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CanvasPromptContextMenuAnchor {
  x: number
  y: number
}

interface CanvasPromptContextMenuProps {
  anchor: CanvasPromptContextMenuAnchor | null
  menuTitle?: string
  extracting?: boolean
  storyboarding?: boolean
  importingTemplate?: boolean
  promptAiLocked?: boolean
  onClose: () => void
  onAddNote: () => void
  onDelete: () => void
  onDuplicate: () => void
  onExtractAssets: () => void
  onGenerateStoryboard: () => void
  onImportStoryboardTemplate: () => void
}

function MenuRow({
  label,
  icon: Icon,
  danger,
  loading,
  disabled,
  onClick,
}: {
  label: string
  icon: typeof Copy
  danger?: boolean
  loading?: boolean
  disabled?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] transition-colors',
        danger
          ? 'text-red-400 hover:bg-red-500/10'
          : 'text-foreground/90 hover:bg-muted/55',
        (loading || disabled) && 'cursor-not-allowed opacity-45 hover:bg-transparent',
        loading && !disabled && 'cursor-wait',
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

/** 画境风格：文本节点右键菜单 */
export function CanvasPromptContextMenu({
  anchor,
  menuTitle = '文本',
  extracting = false,
  storyboarding = false,
  importingTemplate = false,
  promptAiLocked = false,
  onClose,
  onAddNote,
  onDelete,
  onDuplicate,
  onExtractAssets,
  onGenerateStoryboard,
  onImportStoryboardTemplate,
}: CanvasPromptContextMenuProps) {
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
  }, [anchor, extracting, storyboarding])

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
            'w-[220px] overflow-hidden rounded-2xl border border-border/35',
            'bg-[#1a1b1f]/96 p-2 shadow-2xl backdrop-blur-md',
          )}
        >
          <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground/80">{menuTitle} → 操作</p>

          <MenuRow label="添加批注" icon={StickyNote} onClick={() => run(onAddNote)} />
          <MenuRow label="删除节点" icon={Trash2} danger onClick={() => run(onDelete)} />
          <MenuRow label="复制节点" icon={Copy} onClick={() => run(onDuplicate)} />

          <div className="my-1.5 border-t border-border/25" />

          <MenuRow
            label="提取资产"
            icon={Wand2}
            loading={extracting}
            disabled={promptAiLocked}
            onClick={() => {
              if (promptAiLocked) return
              onExtractAssets()
            }}
          />
          <MenuRow
            label="智能分镜"
            icon={Clapperboard}
            loading={storyboarding}
            disabled={promptAiLocked}
            onClick={() => {
              if (promptAiLocked) return
              onGenerateStoryboard()
            }}
          />
          <MenuRow
            label="导入分镜稿"
            icon={FileStack}
            loading={importingTemplate}
            disabled={promptAiLocked}
            onClick={() => {
              if (promptAiLocked) return
              onImportStoryboardTemplate()
            }}
          />
        </div>
      </div>
    </>,
    document.body,
  )
}
