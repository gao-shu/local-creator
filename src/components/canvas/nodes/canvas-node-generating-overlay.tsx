// Copyright (c) Haode AI. All rights reserved.

import { useId } from 'react'
import { cn } from '@/lib/utils'

function parseProgressPercent(message: string): number | undefined {
  const match = message.match(/(\d{1,3})\s*%/)
  if (!match) return undefined
  const value = Number(match[1])
  if (!Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(100, Math.round(value)))
}

function stripPercentFromStatus(text: string): string {
  return text.replace(/\s*\d{1,3}\s*%/, '').trim()
}

export interface CanvasNodeGeneratingOverlayProps {
  message?: string
  fallbackMessage?: string
  shotLabel?: string
  cancelTestId?: string
  onCancel?: () => void
  cancelLabel?: string
  /** 进度环下方次要说明（如视频生成中「点击可查看提示词」） */
  secondaryHint?: string
}

/** 画布节点生成中遮罩：暖色渐变 + 圆环进度 + 可选取消 */
export function CanvasNodeGeneratingOverlay({
  message,
  fallbackMessage = '生成中，请稍候…',
  shotLabel,
  cancelTestId,
  onCancel,
  cancelLabel = '取消生成',
  secondaryHint,
}: CanvasNodeGeneratingOverlayProps) {
  const gradientId = `canvasNodeGenRing-${useId().replace(/:/g, '')}`
  const raw = message?.trim() || fallbackMessage
  const percent = parseProgressPercent(raw)
  const hasPercent = percent != null
  const displayPercent = percent ?? 0
  const statusLine = stripPercentFromStatus(raw) || '生成中'

  const ringSize = 76
  const strokeWidth = 4
  const radius = (ringSize - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const progressOffset = circumference * (1 - displayPercent / 100)

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[20] flex flex-col items-center justify-center overflow-hidden rounded-[inherit]"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 70% at 50% 42%, rgba(251,191,36,0.28) 0%, rgba(217,70,239,0.12) 42%, rgba(0,0,0,0.55) 100%)',
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      <div className="relative flex max-w-[90%] flex-col items-center gap-2.5 px-3 py-2">
        {shotLabel ? (
          <p className="text-center text-[11px] font-medium tracking-wide text-fuchsia-200/85">
            {shotLabel}
          </p>
        ) : null}

        <div className="relative" style={{ width: ringSize, height: ringSize }}>
          <svg
            className={cn('h-full w-full -rotate-90', !hasPercent && 'animate-[spin_2.4s_linear_infinite]')}
            viewBox={`0 0 ${ringSize} ${ringSize}`}
            aria-hidden
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={strokeWidth}
            />
            {hasPercent ? (
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={progressOffset}
                className="transition-[stroke-dashoffset] duration-500 ease-out"
              />
            ) : (
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${circumference * 0.22} ${circumference * 0.78}`}
              />
            )}
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="55%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#e879f9" />
              </linearGradient>
            </defs>
          </svg>
          <span
            className={cn(
              'pointer-events-none absolute inset-0 flex items-center justify-center',
              'text-[13px] font-semibold tabular-nums text-amber-50',
            )}
          >
            {hasPercent ? `${displayPercent}%` : '…'}
          </span>
        </div>

        <p className="text-center text-[12px] font-medium leading-snug text-amber-100/95">
          {statusLine}
          {!hasPercent && !statusLine.endsWith('…') ? '…' : ''}
        </p>
        {!hasPercent || secondaryHint ? (
          <p className="text-center text-[10px] leading-snug text-white/55">
            {!hasPercent
              ? onCancel
                ? '通常需数分钟，可随时取消'
                : '通常需数分钟，请稍候'
              : null}
            {!hasPercent && secondaryHint ? '；' : null}
            {secondaryHint || null}
          </p>
        ) : null}

        {onCancel ? (
          <button
            type="button"
            data-testid={cancelTestId}
            title={cancelLabel}
            aria-label={cancelLabel}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              onCancel()
            }}
            className={cn(
              'nodrag nopan pointer-events-auto mt-0.5 inline-flex h-8 items-center justify-center rounded-full px-4',
              'border border-amber-300/45 bg-amber-500/10 text-[12px] font-medium text-amber-100',
              'transition-colors hover:border-amber-200/65 hover:bg-amber-500/20 active:scale-[0.98]',
            )}
          >
            {cancelLabel}
          </button>
        ) : null}
      </div>
    </div>
  )
}
