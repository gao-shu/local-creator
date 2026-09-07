// Copyright (c) local-creator contributors. All rights reserved.

import { useMemo, useState, type ReactNode } from 'react'
import { BrushCleaning, Package, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SidebarFeedbackButton } from '@/components/dashboard/sidebar-feedback-button'
import type { CanvasAddNodeMenuItem, CanvasAddNodeMenuSection } from '@/lib/canvas/canvas-add-node-items'
import {
  buildCanvasAddNodeMenuSections,
  CanvasAddNodeMenuPanel,
} from '@/components/canvas/canvas-add-node-menu-panel'
import type { PromptAiBusyState } from '@/lib/canvas/canvas-prompt-ai-actions'
import type { Node } from '@xyflow/react'

interface CanvasFloatingToolbarProps {
  saving?: boolean
  canClear?: boolean
  nodes: Node[]
  promptAiBusy?: PromptAiBusyState | null
  onAddNode: (type: string, data?: Record<string, unknown>) => void
  onClearCanvas?: () => void
  onOpenMaterialLibrary?: () => void
}

export function CanvasFloatingToolbar({
  saving,
  canClear = false,
  nodes,
  promptAiBusy = null,
  onAddNode,
  onClearCanvas,
  onOpenMaterialLibrary,
}: CanvasFloatingToolbarProps) {
  const [addOpen, setAddOpen] = useState(false)

  const menuSections = useMemo(
    () =>
      buildCanvasAddNodeMenuSections(nodes, {
        promptAiBusy,
        showScriptSection: false,
        showVideoSection: false,
      }),
    [nodes, promptAiBusy],
  )

  const handleSelect = (item: CanvasAddNodeMenuItem) => {
    onAddNode(item.type, item.data)
    setAddOpen(false)
  }

  return (
    <aside
      data-testid="canvas-floating-toolbar"
      className={cn(
        'relative z-30 h-full min-h-0 w-[52px] shrink-0 self-stretch',
        'border-r border-border/25 bg-card/30 backdrop-blur-md',
      )}
    >
      <div className="flex flex-col items-center gap-2 py-3 pb-[5.5rem]">
        <div className="relative">
          <button
            type="button"
            data-testid="canvas-floating-add-node"
            title="添加节点"
            aria-label="添加节点"
            onClick={() => setAddOpen((open) => !open)}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-full transition-transform',
              addOpen
                ? 'bg-white text-[#1a1b1f] shadow-lg'
                : 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:scale-105 active:scale-95',
            )}
          >
            <Plus className={cn('h-5 w-5 transition-transform', addOpen && 'rotate-45')} />
          </button>

          {addOpen ? (
            <>
              <button
                type="button"
                aria-label="关闭"
                className="fixed inset-0 z-10"
                onClick={() => setAddOpen(false)}
              />
              <div
                className={cn(
                  'absolute left-[calc(100%+10px)] top-0 z-20 overflow-visible',
                  'rounded-2xl border border-white/10 bg-[#1a1b1f]/96 shadow-2xl backdrop-blur-md',
                )}
              >
                <CanvasAddNodeMenuPanel
                  sections={menuSections}
                  promptAiBusy={promptAiBusy}
                  onSelect={handleSelect}
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="my-0.5 h-px w-6 bg-border/30" />

        <ToolbarIconButton
          title="素材库"
          onClick={() => onOpenMaterialLibrary?.()}
        >
          <Package className="h-4 w-4" />
        </ToolbarIconButton>

        <ToolbarIconButton
          title="清空画布"
          disabled={!canClear}
          onClick={() => onClearCanvas?.()}
        >
          <BrushCleaning className="h-4 w-4" />
        </ToolbarIconButton>
      </div>

      <div className="absolute inset-x-1 bottom-2 z-40 flex flex-col items-center gap-1">
        {saving ? <span className="text-[9px] text-muted-foreground">保存中</span> : null}
        <SidebarFeedbackButton variant="compact" testId="canvas-sidebar-feedback" />
      </div>
    </aside>
  )
}

function ToolbarIconButton({
  title,
  disabled,
  onClick,
  className,
  children,
}: {
  title: string
  disabled?: boolean
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-40',
        'border-border/30 bg-background/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground',
        className,
      )}
    >
      {children}
    </button>
  )
}
