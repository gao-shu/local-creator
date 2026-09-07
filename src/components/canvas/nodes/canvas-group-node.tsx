// Copyright (c) local-creator contributors. All rights reserved.

import { memo, useCallback, useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { NodeResizer } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import type { CanvasGroupNodeData } from '@/types/canvas-nodes'

function CanvasGroupNodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as CanvasGroupNodeData
  const label = String(nodeData?.label || '分组')
  const { updateNodeData } = useCanvasEditor()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)

  const commit = useCallback(() => {
    updateNodeData(id, { label: draft.trim() || '分组' })
    setEditing(false)
  }, [draft, id, updateNodeData])

  return (
    <>
      <NodeResizer
        minWidth={240}
        minHeight={180}
        isVisible={selected}
        lineClassName="!border-primary/40"
        handleClassName="!w-2 !h-2 !bg-primary"
      />
      <div
        className={cn(
          'w-full h-full rounded-2xl border-2 border-dashed',
          'border-primary/25 bg-primary/5 backdrop-blur-[2px]',
          selected && 'border-primary/45 bg-primary/8',
        )}
        onDoubleClick={() => {
          setDraft(label)
          setEditing(true)
        }}
      >
        <div className="px-3 py-2 border-b border-primary/15 bg-primary/10 rounded-t-2xl">
          {editing ? (
            <input
              value={draft}
              autoFocus
              onChange={(event) => setDraft(event.target.value)}
              onBlur={() => commit()}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commit()
                if (event.key === 'Escape') setEditing(false)
              }}
              className="w-full text-xs font-medium bg-transparent outline-none"
              onPointerDown={(event) => event.stopPropagation()}
            />
          ) : (
            <span className="text-xs font-semibold text-primary/90">{label}</span>
          )}
        </div>
      </div>
    </>
  )
}

export const CanvasGroupNode = memo(CanvasGroupNodeComponent)
