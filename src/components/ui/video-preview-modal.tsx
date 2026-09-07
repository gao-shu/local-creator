import { useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface VideoPreviewModalProps {
  videoUrl: string
  onClose: () => void
}

export function VideoPreviewModal({ videoUrl, onClose }: VideoPreviewModalProps) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div className="relative max-h-[90vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
        <video
          src={videoUrl}
          controls
          autoPlay
          className="max-h-[88vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
        />
        <button
          type="button"
          title="关闭"
          onClick={onClose}
          className="absolute -top-12 right-0 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>,
    document.body,
  )
}
