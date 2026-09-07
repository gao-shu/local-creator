// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CanvasVideoPreviewDialogProps {
  open: boolean
  src: string
  initialTime?: number
  onClose: () => void
}

function toggleVideoPlayPause(video: HTMLVideoElement) {
  if (video.paused) {
    void video.play().catch(() => {})
    return
  }
  video.pause()
}

function isVideoControlBarClick(event: MouseEvent<HTMLVideoElement>): boolean {
  const rect = event.currentTarget.getBoundingClientRect()
  if (rect.height <= 0) return false
  const yFromBottom = rect.bottom - event.clientY
  return yFromBottom <= 48 && yFromBottom >= 0
}

/** 画布视频放大预览：适中弹窗，非浏览器全屏 */
export function CanvasVideoPreviewDialog({
  open,
  src,
  initialTime = 0,
  onClose,
}: CanvasVideoPreviewDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [visible, setVisible] = useState(false)
  const [videoReady, setVideoReady] = useState(false)

  useEffect(() => {
    if (!open) {
      setVisible(false)
      setVideoReady(false)
      return
    }

    const frameId = requestAnimationFrame(() => {
      setVisible(true)
    })
    return () => cancelAnimationFrame(frameId)
  }, [open])

  useEffect(() => {
    if (!open) return
    const video = videoRef.current
    if (!video) return

    setVideoReady(false)
    let started = false

    const startPlayback = () => {
      if (started) return
      started = true
      if (initialTime > 0 && Number.isFinite(initialTime)) {
        try {
          video.currentTime = initialTime
        } catch {
          /* ignore seek errors */
        }
      }
      void video.play().catch(() => {})
      setVideoReady(true)
    }

    const onCanPlay = () => {
      startPlayback()
    }

    video.addEventListener('canplay', onCanPlay, { once: true })
    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback()
    }

    return () => {
      video.removeEventListener('canplay', onCanPlay)
    }
  }, [open, initialTime, src])

  if (!open || !src) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[220] flex items-center justify-center bg-black/72 p-8 sm:p-10',
        'transition-opacity duration-200 ease-out',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          'relative w-full max-w-[920px] overflow-hidden rounded-xl border border-white/10',
          'bg-black shadow-2xl transition-opacity duration-200 ease-out',
          videoReady ? 'opacity-100' : 'opacity-0',
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="关闭预览"
          title="关闭"
          className={cn(
            'absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg',
            'bg-black/60 text-white/90 backdrop-blur-sm hover:bg-black/80',
          )}
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          preload="auto"
          disablePictureInPicture
          controlsList="nofullscreen noremoteplayback"
          className="block max-h-[78vh] w-full bg-black object-contain"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            const target = event.target
            if (!(target instanceof HTMLVideoElement)) return
            if (isVideoControlBarClick(event)) return
            toggleVideoPlayPause(target)
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
