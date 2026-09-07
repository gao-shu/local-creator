// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { recordThemeToggleForEasterEgg } from '@/lib/easter-eggs/theme-flicker-easter-egg'
import { cn } from '@/lib/utils'

const RAIN_MS = 2000
const DROP_COUNT = 18

type RainDrop = {
  id: number
  left: string
  delay: string
  duration: string
  size: number
  drift: string
}

/** T1 文案 + T2 光影雨：连续狂切主题时触发一次（有冷却） */
export function maybeTriggerThemeFlickerEasterEgg() {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (recordThemeToggleForEasterEgg()) {
      toast.message('导演在对光？', { description: '主题稳一点，眼睛也舒服。' })
    }
    return
  }
  if (!recordThemeToggleForEasterEgg()) return

  toast.message('导演在对光？', { description: '光影雨过一遍，先选定影调吧。' })
  window.dispatchEvent(new CustomEvent('haode:theme-flicker-easter-egg'))
}

export function ThemeFlickerEasterEggHost() {
  const [visible, setVisible] = useState(false)
  const drops = useMemo<RainDrop[]>(
    () =>
      Array.from({ length: DROP_COUNT }, (_, index) => ({
        id: index,
        left: `${4 + ((index * 17) % 92)}%`,
        delay: `${(index % 7) * 0.08}s`,
        duration: `${1.2 + (index % 5) * 0.12}s`,
        size: 12 + (index % 4) * 2,
        drift: `${(index % 2 === 0 ? -1 : 1) * (8 + (index % 5) * 3)}px`,
      })),
    [],
  )

  useEffect(() => {
    const onTrigger = () => {
      setVisible(true)
      window.setTimeout(() => setVisible(false), RAIN_MS)
    }
    window.addEventListener('haode:theme-flicker-easter-egg', onTrigger)
    return () => window.removeEventListener('haode:theme-flicker-easter-egg', onTrigger)
  }, [])

  if (!visible || typeof document === 'undefined') return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-x-0 top-0 h-px bg-amber-400/40 shadow-[0_0_24px_6px_rgba(251,191,36,0.35)]" />
      {drops.map((drop) => (
        <span
          key={drop.id}
          className={cn(
            'absolute top-[-24px] inline-flex animate-[theme-flicker-fall_var(--fall-duration)_ease-in_forwards]',
            'opacity-90',
          )}
          style={
            {
              left: drop.left,
              animationDelay: drop.delay,
              '--fall-duration': drop.duration,
              '--fall-drift': drop.drift,
            } as CSSProperties
          }
        >
          <Sparkles className="h-4 w-4 text-amber-300 drop-shadow-sm" />
        </span>
      ))}
      <style>{`
        @keyframes theme-flicker-fall {
          0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0; }
          12% { opacity: 1; }
          100% { transform: translate3d(var(--fall-drift), 110vh, 0) rotate(28deg); opacity: 0.15; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
