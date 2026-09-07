// Copyright (c) local-creator contributors. All rights reserved.

import type { Edge, Node } from '@xyflow/react'
import { Map, Minus, Plus, Redo2, Undo2, LocateFixed } from 'lucide-react'
import { useOnViewportChange, useReactFlow } from '@xyflow/react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CanvasViewportToolbarProps {
  canUndo: boolean
  canRedo: boolean
  hasNodes: boolean
  onUndo: () => void
  onRedo: () => void
  minimapOpen: boolean
  onToggleMinimap: () => void
}

export function CanvasViewportToolbar({
  canUndo,
  canRedo,
  hasNodes,
  onUndo,
  onRedo,
  minimapOpen,
  onToggleMinimap,
}: CanvasViewportToolbarProps) {
  const { zoomIn, zoomOut, fitView, getNodes } = useReactFlow()
  const [zoomPercent, setZoomPercent] = useState(90)

  const handleFitContent = useCallback(() => {
    if (!getNodes().length) return
    void fitView({
      padding: 0.28,
      duration: 320,
      maxZoom: 1.2,
      minZoom: 0.2,
    })
  }, [fitView, getNodes])

  useOnViewportChange({
    onChange: (viewport) => {
      setZoomPercent(Math.round(viewport.zoom * 100))
    },
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Home') return
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      handleFitContent()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleFitContent])

  return (
    <div
      className={cn(
        'absolute bottom-3 left-3 z-20 flex items-center gap-0.5 rounded-lg',
        'border border-border/40 bg-card/92 px-1 py-0.5 shadow-md backdrop-blur-md',
      )}
    >
      <ToolbarButton title="缩小" onClick={() => zoomOut({ duration: 120 })}>
        <Minus className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarButton>
      <button
        type="button"
        title="回到全部内容 (Home)"
        disabled={!hasNodes}
        onClick={handleFitContent}
        className={cn(
          'min-w-[40px] rounded-md px-0.5 text-center text-xs font-medium tabular-nums leading-none transition-colors',
          hasNodes
            ? 'text-foreground/85 hover:bg-muted/60 hover:text-foreground'
            : 'cursor-not-allowed text-foreground/40',
        )}
      >
        {zoomPercent}%
      </button>
      <ToolbarButton title="放大" onClick={() => zoomIn({ duration: 120 })}>
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarButton>

      <ToolbarButton title="小地图" active={minimapOpen} onClick={onToggleMinimap}>
        <Map className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarButton>

      <ToolbarButton
        title="回到全部内容 (Home)"
        disabled={!hasNodes}
        onClick={handleFitContent}
      >
        <LocateFixed className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarButton>

      <span className="mx-0.5 h-5 w-px bg-border/45" />

      <ToolbarButton title="撤回 Ctrl+Z" disabled={!canUndo} onClick={onUndo}>
        <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton title="前进 Ctrl+Y" disabled={!canRedo} onClick={onRedo}>
        <Redo2 className="h-3.5 w-3.5" strokeWidth={2} />
      </ToolbarButton>
    </div>
  )
}

function ToolbarButton({
  title,
  disabled,
  active,
  onClick,
  children,
}: {
  title: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-muted/60 hover:text-foreground',
        'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent',
        active && 'bg-muted/70 text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function cloneCanvasGraph(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      data: { ...(node.data as object) },
    })),
    edges: edges.map((edge) => ({ ...edge })),
  }
}

export function isSameCanvasGraph(
  a: { nodes: Node[]; edges: Edge[] },
  b: { nodes: Node[]; edges: Edge[] },
): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
