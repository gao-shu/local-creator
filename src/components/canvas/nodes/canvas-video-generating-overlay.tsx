// Copyright (c) local-creator contributors. All rights reserved.

import { splitVideoProgressMessage } from '@/lib/video/video-progress'
import { CanvasNodeGeneratingOverlay } from '@/components/canvas/nodes/canvas-node-generating-overlay'

interface CanvasVideoGeneratingOverlayProps {
  message?: string
  cancelTestId?: string
  onCancel: () => void
}

/** 画布视频节点生成中遮罩 */
export function CanvasVideoGeneratingOverlay({
  message,
  cancelTestId,
  onCancel,
}: CanvasVideoGeneratingOverlayProps) {
  const raw = message?.trim() || '视频生成中，可能需要数分钟…'
  const { shotLabel, statusText } = splitVideoProgressMessage(raw)

  return (
    <CanvasNodeGeneratingOverlay
      message={statusText || raw}
      fallbackMessage="视频生成中，可能需要数分钟…"
      shotLabel={shotLabel}
      cancelTestId={cancelTestId}
      onCancel={onCancel}
      secondaryHint="点击此处可查看提示词"
    />
  )
}
