// Copyright (c) local-creator contributors. All rights reserved.

import { memo, useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Handle, Position } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'

export interface CanvasNoteNodeData {
  label: string
}

function CanvasNoteNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasNoteNodeData
  const label = String(nodeData?.label || '备注节点')
  const { updateNodeData } = useCanvasEditor()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)

  const commit = useCallback(() => {
    updateNodeData(id, { label: draft.trim() || '备注' })
    setEditing(false)
  }, [draft, id, updateNodeData])

  return (
    <div
      className={cn(
        'min-w-[180px] max-w-[260px] rounded-xl border px-3 py-2.5 shadow-lg backdrop-blur-sm',
        'bg-card/90 border-border/50 text-sm',
        selected && 'ring-2 ring-primary/40 border-primary/40',
      )}
      onDoubleClick={() => {
        setDraft(label)
        setEditing(true)
      }}
    >
      <Handle type="target" position={Position.Left} className="!bg-primary !w-2 !h-2" />
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">备注</div>
      {editing ? (
        <textarea
          value={draft}
          autoFocus
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => commit()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') setEditing(false)
          }}
          className="w-full text-sm bg-muted/40 border border-border/30 rounded-lg px-2 py-1 resize-none"
          onPointerDown={(event) => event.stopPropagation()}
        />
      ) : (
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">{label}</div>
      )}
      <Handle type="source" position={Position.Right} className="!bg-primary !w-2 !h-2" />
    </div>
  )
}

export const CanvasNoteNode = memo(CanvasNoteNodeComponent)
