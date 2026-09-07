// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useState, type MouseEvent, type ReactNode } from 'react'
import { Loader2, Play } from 'lucide-react'
import { CanvasNodeConnector } from '@/components/canvas/nodes/canvas-node-connector'
import {
  CanvasNodeContextMenu,
  type CanvasNodeContextMenuAnchor,
} from '@/components/canvas/nodes/canvas-node-context-menu'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { useCanvasNodeQuickAdd } from '@/hooks/use-canvas-node-quick-add'
import { cn } from '@/lib/utils'
import type { CanvasNodeStatus } from '@/types/canvas-nodes'

interface CanvasNodeShellProps {
  nodeId: string
  nodeWidthPx?: number
  title: string
  accentClass?: string
  selected?: boolean
  children: ReactNode
  status?: CanvasNodeStatus
  error?: string
  showRun?: boolean
  running?: boolean
  onRun?: () => void
  target?: boolean
  source?: boolean
  widthClass?: string
  /** 为 true 时不渲染默认右键菜单（由节点自行提供） */
  hideContextMenu?: boolean
  onNodeContextMenu?: (event: MouseEvent<HTMLDivElement>) => void
}

function CanvasShellConnectors({
  nodeId,
  nodeWidthPx,
  target,
  source,
}: {
  nodeId: string
  nodeWidthPx: number
  target: boolean
  source: boolean
}) {
  const handleQuickAdd = useCanvasNodeQuickAdd(nodeId, nodeWidthPx)
  return (
    <>
      {target ? <CanvasNodeConnector side="left" anchored onQuickAdd={handleQuickAdd} /> : null}
      {source ? <CanvasNodeConnector side="right" anchored onQuickAdd={handleQuickAdd} /> : null}
    </>
  )
}

export function CanvasNodeShell({
  nodeId,
  nodeWidthPx = 280,
  title,
  accentClass = 'text-primary',
  selected,
  children,
  status = 'idle',
  error,
  showRun,
  running,
  onRun,
  target = true,
  source = true,
  widthClass = 'w-[280px]',
  hideContextMenu = false,
  onNodeContextMenu,
}: CanvasNodeShellProps) {
  const { deleteNode, duplicateNode } = useCanvasEditor()
  const [contextMenuAnchor, setContextMenuAnchor] = useState<CanvasNodeContextMenuAnchor | null>(
    null,
  )

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      if (onNodeContextMenu) {
        onNodeContextMenu(event)
        return
      }
      setContextMenuAnchor({ x: event.clientX, y: event.clientY })
    },
    [onNodeContextMenu],
  )

  return (
    <div
      className={cn(
        'relative',
        widthClass,
        'rounded-2xl border shadow-xl backdrop-blur-md',
        'bg-card/95 border-border/50',
        selected && 'ring-2 ring-primary/40 border-primary/40',
      )}
      onContextMenu={handleContextMenu}
    >
      {!hideContextMenu ? (
        <CanvasNodeContextMenu
          anchor={contextMenuAnchor}
          title={`${title} → 操作`}
          onClose={() => setContextMenuAnchor(null)}
          onDuplicate={() => duplicateNode(nodeId)}
          onDelete={() => deleteNode(nodeId)}
        />
      ) : null}
      <CanvasShellConnectors
        nodeId={nodeId}
        nodeWidthPx={nodeWidthPx}
        target={target}
        source={source}
      />

      <div className="overflow-hidden rounded-2xl">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/30 bg-muted/20 cursor-grab active:cursor-grabbing">
          <div className={cn('text-[11px] font-semibold uppercase tracking-wide', accentClass)}>
            {title}
          </div>
          <div className="flex items-center gap-1.5">
            {status === 'success' ? (
              <span className="text-[10px] text-emerald-400">完成</span>
            ) : null}
            {status === 'error' ? (
              <span className="text-[10px] text-destructive">失败</span>
            ) : null}
            {showRun ? (
              <button
                type="button"
                disabled={running}
                onClick={(event) => {
                  event.stopPropagation()
                  onRun?.()
                }}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium',
                  'bg-primary/15 text-primary hover:bg-primary/25 transition-colors',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                运行
              </button>
            ) : null}
          </div>
        </div>

        <div className="p-3 space-y-2">{children}</div>

        {error ? <div className="px-3 pb-3 text-[11px] text-destructive">{error}</div> : null}
      </div>
    </div>
  )
}
