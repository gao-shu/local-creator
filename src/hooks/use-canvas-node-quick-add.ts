// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, type MouseEvent } from 'react'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'

/** 节点两侧 + 号：打开添加菜单并预置连线 */
export function useCanvasNodeQuickAdd(nodeId: string, nodeWidthPx: number) {
  const { nodes, openAddNodeMenu } = useCanvasEditor()

  return useCallback(
    (side: 'left' | 'right', event: MouseEvent<HTMLButtonElement>) => {
      const self = nodes.find((node) => node.id === nodeId)
      const baseX = self?.position.x ?? 0
      const baseY = self?.position.y ?? 0
      const offsetX = side === 'right' ? nodeWidthPx + 72 : -300
      openAddNodeMenu({
        screenX: event.clientX,
        screenY: event.clientY,
        flowX: baseX + offsetX,
        flowY: baseY + 160,
        connection:
          side === 'right'
            ? { direction: 'source', nodeId, handleId: 'right' }
            : { direction: 'target', nodeId, handleId: 'left' },
      })
    },
    [nodeId, nodeWidthPx, nodes, openAddNodeMenu],
  )
}
