// Copyright (c) local-creator contributors. All rights reserved.

import { memo, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { formatLocalMediaTimeLabel } from '@/hooks/use-local-media-player'
import {
  clampExtractRangeSec,
  syncRangeFromSlider,
} from '@/lib/media/extract-audio-range-slider'
import { cn } from '@/lib/utils'

export interface CanvasExtractAudioRangeBarProps {
  durationSec: number
  startSec: number
  endSec: number
  disabled?: boolean
  onChange: (startSec: number, endSec: number) => void
  /** 可选：播放头竖线（视频绝对时间） */
  currentTimeSec?: number
  className?: string
}

type ActiveThumb = 'start' | 'end' | null

function secToPercent(sec: number, durationSec: number): number {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 0
  return Math.min(100, Math.max(0, (sec / durationSec) * 100))
}

function pointerXToSec(clientX: number, rect: DOMRect, durationSec: number): number {
  if (rect.width <= 0) return 0
  const ratio = (clientX - rect.left) / rect.width
  return clampExtractRangeSec(ratio * durationSec, 0, durationSec)
}

function formatRangeSummary(startSec: number, endSec: number): string {
  const span = Math.max(0, endSec - startSec)
  return `截取 ${startSec.toFixed(1)}s – ${endSec.toFixed(1)}s（约 ${span.toFixed(1)} 秒）`
}

function CanvasExtractAudioRangeBarComponent({
  durationSec,
  startSec,
  endSec,
  disabled = false,
  onChange,
  currentTimeSec,
  className,
}: CanvasExtractAudioRangeBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const [activeThumb, setActiveThumb] = useState<ActiveThumb>(null)

  const trackReady = Number.isFinite(durationSec) && durationSec > 0
  const interactionDisabled = disabled || !trackReady

  const startPercent = secToPercent(startSec, durationSec)
  const endPercent = secToPercent(endSec, durationSec)
  const playheadPercent =
    currentTimeSec != null && Number.isFinite(currentTimeSec)
      ? secToPercent(currentTimeSec, durationSec)
      : null

  const emitRange = useCallback(
    (nextStart: number, nextEnd: number) => {
      if (!trackReady) return
      const synced = syncRangeFromSlider(nextStart, nextEnd, durationSec)
      if (!synced.ok) return
      onChange(synced.range.startSec, synced.range.endSec)
    },
    [durationSec, onChange, trackReady],
  )

  const handleThumbPointerDown = useCallback(
    (thumb: Exclude<ActiveThumb, null>) => (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (interactionDisabled) return
      event.preventDefault()
      event.stopPropagation()
      setActiveThumb(thumb)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [interactionDisabled],
  )

  const handleThumbPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!activeThumb || interactionDisabled) return
      event.stopPropagation()
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect) return
      const nextSec = pointerXToSec(event.clientX, rect, durationSec)
      if (activeThumb === 'start') {
        emitRange(nextSec, endSec)
      } else {
        emitRange(startSec, nextSec)
      }
    },
    [activeThumb, durationSec, emitRange, endSec, interactionDisabled, startSec],
  )

  const handleThumbPointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setActiveThumb(null)
  }, [])

  if (!trackReady) {
    return (
      <div
        className={cn('space-y-1.5 opacity-50', className)}
        data-testid="canvas-extract-audio-range-bar"
      >
        <div className="h-8 rounded-lg bg-muted/20" />
        <p className="text-[11px] text-muted-foreground">视频时长无效，无法选择区间</p>
      </div>
    )
  }

  return (
    <div
      className={cn('space-y-1.5', interactionDisabled && 'pointer-events-none opacity-50', className)}
      data-testid="canvas-extract-audio-range-bar"
    >
      <div
        ref={trackRef}
        className="relative h-8 select-none"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-border/50" />

        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sky-400/70"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(0, endPercent - startPercent)}%`,
          }}
          aria-hidden
        />

        {playheadPercent != null ? (
          <div
            className="pointer-events-none absolute top-1/2 z-10 h-5 w-px -translate-y-1/2 bg-foreground/55"
            style={{ left: `${playheadPercent}%` }}
            aria-hidden
          />
        ) : null}

        <button
          type="button"
          role="slider"
          aria-label="截取起点"
          aria-valuemin={0}
          aria-valuemax={durationSec}
          aria-valuenow={startSec}
          aria-disabled={interactionDisabled}
          disabled={interactionDisabled}
          className={cn(
            'nodrag nopan absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-300 bg-sky-500 shadow-sm',
            'touch-none transition-transform hover:scale-110',
            activeThumb === 'start' && 'scale-110 ring-2 ring-sky-400/40',
            interactionDisabled ? 'cursor-not-allowed' : 'cursor-ew-resize',
          )}
          style={{ left: `${startPercent}%` }}
          data-testid="canvas-extract-audio-range-start-thumb"
          onPointerDown={handleThumbPointerDown('start')}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
        />

        <button
          type="button"
          role="slider"
          aria-label="截取终点"
          aria-valuemin={0}
          aria-valuemax={durationSec}
          aria-valuenow={endSec}
          aria-disabled={interactionDisabled}
          disabled={interactionDisabled}
          className={cn(
            'nodrag nopan absolute top-1/2 z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-sky-300 bg-sky-500 shadow-sm',
            'touch-none transition-transform hover:scale-110',
            activeThumb === 'end' && 'scale-110 ring-2 ring-sky-400/40',
            interactionDisabled ? 'cursor-not-allowed' : 'cursor-ew-resize',
          )}
          style={{ left: `${endPercent}%` }}
          data-testid="canvas-extract-audio-range-end-thumb"
          onPointerDown={handleThumbPointerDown('end')}
          onPointerMove={handleThumbPointerMove}
          onPointerUp={handleThumbPointerUp}
          onPointerCancel={handleThumbPointerUp}
        />
      </div>

      <div className="flex items-center justify-between gap-2 tabular-nums text-[10px] text-muted-foreground">
        <span>{formatLocalMediaTimeLabel(0)}</span>
        <span>{formatLocalMediaTimeLabel(durationSec)}</span>
      </div>

      <p className="text-center text-[11px] tabular-nums text-muted-foreground">
        {formatRangeSummary(startSec, endSec)}
      </p>
    </div>
  )
}

export const CanvasExtractAudioRangeBar = memo(CanvasExtractAudioRangeBarComponent)
