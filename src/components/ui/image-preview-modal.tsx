import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImagePreviewModalProps {
  imageUrl: string
  alt?: string
  onClose: () => void
}

const MIN_SCALE = 0.5
const MAX_SCALE = 4
const SCALE_STEP = 0.25

export function ImagePreviewModal({ imageUrl, alt = '预览', onClose }: ImagePreviewModalProps) {
  const [scale, setScale] = useState(1)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [handleKeyDown])

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(2)))
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, +(s - SCALE_STEP).toFixed(2)))
  const resetZoom = () => setScale(1)

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] max-w-[96vw] flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="max-h-[82vh] max-w-[92vw] rounded-lg border border-white/10 object-contain shadow-2xl transition-transform duration-150"
          style={{ transform: `scale(${scale})` }}
          draggable={false}
        />

        <div className="flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2 py-1.5 shadow-lg backdrop-blur-md">
          <button
            type="button"
            title="缩小"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="放大"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="重置大小"
            onClick={resetZoom}
            className={cn(
              'rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white',
              scale === 1 && 'opacity-60',
            )}
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <span className="mx-1 min-w-[3rem] text-center text-[11px] tabular-nums text-white/60">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            title="关闭"
            onClick={onClose}
            className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
