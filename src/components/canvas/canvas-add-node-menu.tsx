// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { CanvasAddNodeConnection } from '@/lib/canvas/canvas-add-node-connection'
import type { CanvasAddNodeMenuItem } from '@/lib/canvas/canvas-add-node-items'
import {
  buildCanvasAddNodeMenuSections,
  CanvasAddNodeMenuPanel,
} from '@/components/canvas/canvas-add-node-menu-panel'
import type { PromptAiBusyState } from '@/lib/canvas/canvas-prompt-ai-actions'
import type { Node } from '@xyflow/react'

export interface CanvasAddNodeAnchor {
  screenX: number
  screenY: number
  flowX: number
  flowY: number
  connection?: CanvasAddNodeConnection
}

interface CanvasAddNodeMenuProps {
  anchor: CanvasAddNodeAnchor | null
  nodes: Node[]
  promptAiBusy?: PromptAiBusyState | null
  runningNodeIds?: ReadonlySet<string> | null
  onSelect: (type: string, position: { x: number; y: number }, data?: Record<string, unknown>) => void
  onClose: () => void
}

export function CanvasAddNodeMenu({
  anchor,
  nodes,
  promptAiBusy = null,
  runningNodeIds = null,
  onSelect,
  onClose,
}: CanvasAddNodeMenuProps) {
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
    let left = anchor.screenX + 8
    let top = anchor.screenY + 8
    if (left + rect.width > window.innerWidth - margin) {
      left = Math.max(margin, anchor.screenX - rect.width - 8)
    }
    if (top + rect.height > window.innerHeight - margin) {
      top = Math.max(margin, window.innerHeight - rect.height - margin)
    }
    panel.style.left = `${left}px`
    panel.style.top = `${top}px`
  }, [anchor])

  if (!anchor) return null

  const menuSections = buildCanvasAddNodeMenuSections(nodes, {
    promptAiBusy,
    addNodeAnchor: anchor,
    runningNodeIds,
  })

  const handleSelect = (item: CanvasAddNodeMenuItem) => {
    onSelect(item.type, { x: anchor.flowX, y: anchor.flowY }, item.data)
    onClose()
  }

  return createPortal(
    <>
      <button
        type="button"
        aria-label="关闭菜单"
        className="fixed inset-0 z-[85] bg-transparent"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className={cn(
          'fixed z-[86] overflow-visible rounded-2xl border border-white/10',
          'bg-[#1a1b1f]/96 shadow-2xl backdrop-blur-md',
        )}
        style={{ left: anchor.screenX + 8, top: anchor.screenY + 8 }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <CanvasAddNodeMenuPanel
          sections={menuSections}
          nodes={nodes}
          promptAiBusy={promptAiBusy}
          addNodeAnchor={anchor}
          runningNodeIds={runningNodeIds}
          onSelect={handleSelect}
        />
      </div>
    </>,
    document.body,
  )
}
