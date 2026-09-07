import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import {
  RELEASE_CHANGELOG,
  type ReleaseChangelogEntry,
} from '@/constants/release-changelog'
import { cn } from '@/lib/utils'

interface ReleaseChangelogPanelProps {
  open: boolean
  anchorRef: React.RefObject<HTMLElement | null>
  onClose: () => void
  onAcknowledge: () => void
}

function ChangelogEntry({ entry }: { entry: ReleaseChangelogEntry }) {
  return (
    <section className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2 mb-1.5">
        <span className="inline-flex items-center rounded-md bg-foreground/10 px-2 py-0.5 text-xs font-semibold tabular-nums">
          {entry.version}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums">{entry.date}</span>
        {entry.windowsModule ? (
          <span className="text-[10px] text-amber-600/90 dark:text-amber-300/90 rounded-md bg-amber-500/10 px-1.5 py-0.5">
            {entry.windowsModule}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1 text-[13px] text-foreground/80 leading-relaxed list-disc pl-4">
        {entry.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function resolvePanelPosition(anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect()
  const panelWidth = Math.min(380, window.innerWidth - 16)
  const left = Math.min(
    Math.max(8, rect.right - panelWidth),
    window.innerWidth - panelWidth - 8,
  )
  return {
    top: rect.bottom + 8,
    left,
    width: panelWidth,
  }
}

export function ReleaseChangelogPanel({
  open,
  anchorRef,
  onClose,
  onAcknowledge,
}: ReleaseChangelogPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0, width: 380 })

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      setPosition(resolvePanelPosition(anchor))
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, open])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onAcknowledge()
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onAcknowledge()
        onClose()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [anchorRef, onAcknowledge, onClose, open])

  if (!open) return null

  return createPortal(
    <div
      ref={panelRef}
      style={{ top: position.top, left: position.left, width: position.width }}
      className={cn(
        'fixed z-[120] max-h-[min(70vh,520px)] flex flex-col',
        'rounded-xl border border-border/60 bg-popover/95 backdrop-blur-md shadow-2xl shadow-black/25 overflow-hidden',
      )}
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/50 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-foreground">更新日志</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">版本变更说明</p>
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
          onClick={() => {
            onAcknowledge()
            onClose()
          }}
          aria-label="关闭更新日志"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2 min-h-0">
        {RELEASE_CHANGELOG.map((entry) => (
          <ChangelogEntry key={entry.version} entry={entry} />
        ))}
      </div>
    </div>,
    document.body,
  )
}
