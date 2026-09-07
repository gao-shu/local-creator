// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useState, type MouseEvent, type PointerEvent } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import { X } from 'lucide-react'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { canvasConnectorCenterX } from '@/lib/canvas/canvas-connector-edge-points'

const HIT_WIDTH = 32

/** 可删除画布连线：悬停/选中时在连线中点显示删除按钮 */
export function CanvasDeletableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
  pathOptions,
}: EdgeProps) {
  const { removeEdge } = useCanvasEditor()
  const [hovered, setHovered] = useState(false)

  const anchorSourceX = canvasConnectorCenterX(sourceX, sourcePosition)
  const anchorTargetX = canvasConnectorCenterX(targetX, targetPosition)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: anchorSourceX,
    sourceY,
    targetX: anchorTargetX,
    targetY,
    sourcePosition,
    targetPosition,
    ...pathOptions,
  })

  const showDelete = hovered || selected

  const handleDelete = useCallback(
    (event: MouseEvent<HTMLButtonElement> | PointerEvent<SVGPathElement>) => {
      event.preventDefault()
      event.stopPropagation()
      removeEdge(id)
    },
    [id, removeEdge],
  )

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} interactionWidth={HIT_WIDTH} />
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(0,0,0,0.001)"
        strokeWidth={HIT_WIDTH}
        className="canvas-edge-hit nodrag nopan"
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onDoubleClick={handleDelete}
      />
      {showDelete ? (
        <EdgeLabelRenderer>
          <div
            className="canvas-edge-delete nodrag nopan pointer-events-auto"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onPointerEnter={() => setHovered(true)}
            onPointerLeave={() => setHovered(false)}
          >
            <button
              type="button"
              aria-label="删除连线"
              title="删除连线"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-red-400/80 bg-red-500 text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] transition-transform hover:scale-105"
              onClick={handleDelete}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} />
            </button>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
