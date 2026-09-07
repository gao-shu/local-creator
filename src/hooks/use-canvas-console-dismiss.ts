// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useRef } from 'react'

/** 展开控制台后，在节点外按下指针（含拖曳其他模块）时收起，对齐文本节点行为 */
export function useCanvasConsoleDismissOnOutsidePointerDown(
  open: boolean,
  onClose: () => void,
  nodeId?: string,
) {
  const nodeRootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      if (nodeRootRef.current?.contains(target)) return
      // Portal 下拉/浮层（Select、@资产菜单等）挂在 body，需豁免，否则 capture 阶段会先关掉控制台导致无法点选
      const aux = target.closest('[data-canvas-console-aux]')
      if (aux) {
        // 未指定 nodeId 的共享浮层一律豁免；指定了则仅匹配当前节点
        const auxId = aux.getAttribute('data-canvas-console-aux')
        if (!auxId || !nodeId || auxId === nodeId) return
      }
      onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, onClose, nodeId])

  return nodeRootRef
}
