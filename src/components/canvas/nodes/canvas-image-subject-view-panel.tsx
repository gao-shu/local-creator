// Copyright (c) local-creator contributors. All rights reserved.

import { Loader2 } from 'lucide-react'
import type {
  CanvasImageSubjectView,
  CanvasSubjectHorizontal,
  CanvasSubjectVertical,
} from '@/types/canvas-image-tools'
import { cn } from '@/lib/utils'

interface CanvasImageSubjectViewPanelProps {
  value: CanvasImageSubjectView
  running?: boolean
  onChange: (patch: Partial<CanvasImageSubjectView>) => void
  onGenerate: () => void
  onClose: () => void
}

const HORIZONTAL_OPTIONS: Array<{ value: CanvasSubjectHorizontal; label: string }> = [
  { value: 'front', label: '正面' },
  { value: 'left_side', label: '左侧' },
  { value: 'right_side', label: '右侧' },
  { value: 'back', label: '背面' },
  { value: 'left_three_quarter', label: '左三分' },
  { value: 'right_three_quarter', label: '右三分' },
]

const VERTICAL_OPTIONS: Array<{ value: CanvasSubjectVertical; label: string }> = [
  { value: 'eye_level', label: '平视' },
  { value: 'top_down', label: '俯视' },
  { value: 'low_angle', label: '仰视' },
]

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-2 py-1 text-[11px] transition-colors',
        active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/[0.06] hover:text-white/85',
      )}
    >
      {label}
    </button>
  )
}

/** 主体视角面板（对齐画镜 subjectView） */
export function CanvasImageSubjectViewPanel({
  value,
  running,
  onChange,
  onGenerate,
  onClose,
}: CanvasImageSubjectViewPanelProps) {
  return (
    <div
      className="nodrag nopan absolute left-0 top-full z-30 mt-1 w-[280px] rounded-xl border border-white/10 bg-[#1a1b1f] p-3 shadow-xl"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-white/90">主体视角</span>
        <button type="button" className="text-[11px] text-white/45 hover:text-white/70" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="mb-1 text-[11px] text-white/45">水平角度</div>
          <div className="flex flex-wrap gap-1">
            {HORIZONTAL_OPTIONS.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                active={value.horizontal === item.value}
                onClick={() => onChange({ horizontal: item.value })}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] text-white/45">垂直角度</div>
          <div className="flex flex-wrap gap-1">
            {VERTICAL_OPTIONS.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                active={value.vertical === item.value}
                onClick={() => onChange({ vertical: item.value })}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between text-[11px] text-white/65">
          <span>广角镜头</span>
          <input
            type="checkbox"
            checked={Boolean(value.wideAngle)}
            onChange={(event) => onChange({ wideAngle: event.target.checked })}
            className="accent-primary"
          />
        </label>

        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-white/45">
            <span>主体缩放</span>
            <span className="text-white/70">{(value.subjectScale ?? 1).toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.6}
            max={1.6}
            step={0.1}
            value={value.subjectScale ?? 1}
            onChange={(event) => onChange({ subjectScale: Number(event.target.value) })}
            className="w-full accent-primary"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={running}
        onClick={onGenerate}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/90 py-2 text-[12px] text-white hover:bg-primary disabled:opacity-50"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        生成新视角
      </button>
    </div>
  )
}
