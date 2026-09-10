// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasImageNodeData } from '@/types/canvas-nodes'

interface CanvasImageCharacterOverlayProps {
  nodeId: string
  projectId: string
  data: CanvasImageNodeData
  hasImage: boolean
  onPatch: (patch: Partial<CanvasImageNodeData>) => void
}

/** 资产图片预览区：远程审核盾牌已移除，不再渲染 */
export function CanvasImageCharacterOverlay(_props: CanvasImageCharacterOverlayProps) {
  return null
}
