// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useState, type CSSProperties, type MouseEvent } from 'react'
import { Handle, Position, useConnection } from '@xyflow/react'
import { Plus } from 'lucide-react'
import {
  CANVAS_CONNECTOR_HIT_PX,
  CANVAS_CONNECTOR_VISUAL_PX,
} from '@/lib/canvas/canvas-edge-utils'
import { cn } from '@/lib/utils'

interface CanvasNodeConnectorProps {
  side: 'left' | 'right'
  onQuickAdd: (side: 'left' | 'right', event: MouseEvent<HTMLButtonElement>) => void
  className?: string
  style?: CSSProperties
  /** 为 true 时不显示 + 号（仅保留连线锚点，如音色节点） */
  silent?: boolean
  /** 图片/视频等：锚定在父级 relative 容器左右边中点（非整节点外框） */
  anchored?: boolean
  /**
   * 是否允许从该锚点发起连线（React Flow isConnectableStart）。
   * 音色等仅接入节点应设为 false。
   */
  connectableStart?: boolean
  /** 为 true 时点击锚点不打开添加菜单 */
  disableQuickAdd?: boolean
}

/** 画镜风格：2× 半径热区（框边居中）；靠近显示圆圈；连线锚点 = 圆圈十字中心 */
export function CanvasNodeConnector({
  side,
  onQuickAdd,
  className,
  style,
  silent = false,
  anchored = false,
  connectableStart = true,
  disableQuickAdd = false,
}: CanvasNodeConnectorProps) {
  const isSource = side === 'right'
  const [hovered, setHovered] = useState(false)
  const connecting = useConnection((state) => state.inProgress)
  /** 本侧热区 / 连线中：强制显示；其余靠节点 hover（见 index.css） */
  const forceShowVisual = hovered || connecting

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation()
    if (disableQuickAdd) return
    onQuickAdd(side, event as unknown as MouseEvent<HTMLButtonElement>)
  }

  const setHoverOn = useCallback(() => setHovered(true), [])
  const setHoverOff = useCallback(() => setHovered(false), [])

  const connector = (
    <div
      className={cn('relative z-[10]', className)}
      style={{
        width: CANVAS_CONNECTOR_HIT_PX,
        height: CANVAS_CONNECTOR_HIT_PX,
        ...style,
      }}
      onPointerEnter={setHoverOn}
      onPointerLeave={setHoverOff}
    >
      {!silent ? (
        <div
          aria-hidden
          data-active={forceShowVisual ? 'true' : undefined}
          className="canvas-node-connector-plus pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-zinc-500/55 bg-[rgba(8,8,10,0.94)] opacity-0 shadow-[0_0_0_3px_rgba(255,255,255,0.05),0_2px_12px_rgba(0,0,0,0.55)] transition-opacity duration-150 dark:border-zinc-500/45"
          style={{ width: CANVAS_CONNECTOR_VISUAL_PX, height: CANVAS_CONNECTOR_VISUAL_PX }}
        >
          <Plus className="h-3.5 w-3.5 text-zinc-300" strokeWidth={1.6} />
        </div>
      ) : null}

      <Handle
        type={isSource ? 'source' : 'target'}
        position={isSource ? Position.Right : Position.Left}
        id={side}
        isConnectable
        isConnectableStart={connectableStart}
        onClick={handleClick}
        aria-label={
          isSource
            ? '向右连线或添加节点'
            : connectableStart
              ? '向左连线或添加节点'
              : '接收连线'
        }
        className={cn(
          'canvas-node-handle nodrag nopan connectionindicator !absolute !left-0 !top-0 !border-0 !bg-transparent !opacity-0',
          isSource ? 'canvas-node-handle-right' : 'canvas-node-handle-left',
          connectableStart ? '!cursor-crosshair' : '!cursor-default',
        )}
        style={{
          width: CANVAS_CONNECTOR_HIT_PX,
          height: CANVAS_CONNECTOR_HIT_PX,
          minWidth: CANVAS_CONNECTOR_HIT_PX,
          minHeight: CANVAS_CONNECTOR_HIT_PX,
          transform: 'none',
        }}
      />
    </div>
  )

  if (!anchored) return connector

  return (
    <div
      className={cn(
        'absolute top-1/2 z-[10] -translate-y-1/2',
        isSource ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2',
      )}
    >
      {connector}
    </div>
  )
}
