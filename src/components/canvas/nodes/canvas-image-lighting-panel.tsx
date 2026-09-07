// Copyright (c) local-creator contributors. All rights reserved.

import { Loader2 } from 'lucide-react'
import type { CanvasImageLightingConfig } from '@/types/canvas-image-tools'
import { cn } from '@/lib/utils'

interface CanvasImageLightingPanelProps {
  value: CanvasImageLightingConfig
  running?: boolean
  onChange: (patch: Partial<CanvasImageLightingConfig>) => void
  onGenerate: () => void
  onClose: () => void
}

const SOURCE_OPTIONS: Array<{
  value: NonNullable<CanvasImageLightingConfig['mainSource']>
  label: string
}> = [
  { value: 'left', label: '左侧光' },
  { value: 'right', label: '右侧光' },
  { value: 'top', label: '顶光' },
  { value: 'front', label: '正面光' },
  { value: 'back', label: '背光' },
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

/** 打光面板（对齐画镜 lightingConfig） */
export function CanvasImageLightingPanel({
  value,
  running,
  onChange,
  onGenerate,
  onClose,
}: CanvasImageLightingPanelProps) {
  return (
    <div
      className="nodrag nopan absolute left-0 top-full z-30 mt-1 w-[260px] rounded-xl border border-white/10 bg-[#1a1b1f] p-3 shadow-xl"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-medium text-white/90">打光效果</span>
        <button type="button" className="text-[11px] text-white/45 hover:text-white/70" onClick={onClose}>
          关闭
        </button>
      </div>

      <div className="space-y-2.5">
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-white/45">
            <span>亮度</span>
            <span className="text-white/70">{value.brightness ?? 50}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={value.brightness ?? 50}
            onChange={(event) => onChange({ brightness: Number(event.target.value) })}
            className="w-full accent-primary"
          />
        </div>

        <div>
          <div className="mb-1 text-[11px] text-white/45">色温</div>
          <div className="flex flex-wrap gap-1">
            {(['warm', 'neutral', 'cool'] as const).map((item) => (
              <Chip
                key={item}
                label={item === 'warm' ? '暖色' : item === 'cool' ? '冷色' : '中性'}
                active={(value.colorTemp ?? 'neutral') === item}
                onClick={() => onChange({ colorTemp: item })}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 text-[11px] text-white/45">主光源</div>
          <div className="flex flex-wrap gap-1">
            {SOURCE_OPTIONS.map((item) => (
              <Chip
                key={item.value}
                label={item.label}
                active={value.mainSource === item.value}
                onClick={() => onChange({ mainSource: item.value })}
              />
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between text-[11px] text-white/65">
          <span>轮廓光</span>
          <input
            type="checkbox"
            checked={Boolean(value.rimLight)}
            onChange={(event) => onChange({ rimLight: event.target.checked })}
            className="accent-primary"
          />
        </label>
      </div>

      <button
        type="button"
        disabled={running}
        onClick={onGenerate}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/90 py-2 text-[12px] text-white hover:bg-primary disabled:opacity-50"
      >
        {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        应用打光
      </button>
    </div>
  )
}
