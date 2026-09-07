import { Loader2 } from 'lucide-react'
import { useVideoDrag } from '@/hooks/use-video-drag'

interface VideoDragChipProps {
  storedPath: string
  projectRoot?: string
  filename?: string
  className?: string
  label?: string
}

export function VideoDragChip({
  storedPath,
  projectRoot,
  filename,
  className,
  label = '拖',
}: VideoDragChipProps) {
  const {
    hasVideoDragBridge,
    isPreparingDragFile,
    handleVideoDragStart,
    revealVideoFile,
  } = useVideoDrag(storedPath, { projectRoot, filename })

  if (!hasVideoDragBridge || !storedPath || storedPath.startsWith('preview:')) {
    return null
  }

  const dragTitle = isPreparingDragFile
    ? '正在准备可拖拽视频文件'
    : '按住后拖到剪映，点击可定位文件'

  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        event.stopPropagation()
        void handleVideoDragStart(event)
      }}
      onClick={(event) => {
        event.stopPropagation()
        void revealVideoFile()
      }}
      title={dragTitle}
      className={
        className ??
        'absolute top-1 right-1 z-10 inline-flex h-5 min-w-5 items-center justify-center rounded bg-cyan-600 px-1 text-[10px] font-medium text-white hover:bg-cyan-500 disabled:opacity-60'
      }
      disabled={isPreparingDragFile}
    >
      {isPreparingDragFile ? <Loader2 className="h-3 w-3 animate-spin" /> : label}
    </button>
  )
}
