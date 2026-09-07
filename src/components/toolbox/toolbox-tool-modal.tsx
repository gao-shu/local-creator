// Copyright (c) Haode AI. All rights reserved.

import { createPortal } from 'react-dom'
import type { LucideIcon } from 'lucide-react'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ToolboxToolModalProps {
  open: boolean
  title: string
  description?: string
  icon: LucideIcon
  iconClassName?: string
  onClose: () => void
  children: React.ReactNode
  maxWidthClassName?: string
  maxHeightClassName?: string
  badge?: string
}

export function ToolboxToolModal({
  open,
  title,
  description,
  icon: Icon,
  iconClassName,
  onClose,
  children,
  maxWidthClassName = 'max-w-2xl',
  maxHeightClassName = 'max-h-[min(90vh,760px)]',
  badge,
}: ToolboxToolModalProps) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className={cn('pointer-events-auto w-full', maxWidthClassName)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className={cn(
                  'rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/30',
                  'flex flex-col overflow-hidden',
                  maxHeightClassName,
                )}
              >
                <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-border/30">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/40',
                        iconClassName,
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold">{title}</h2>
                        {badge ? (
                          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {badge}
                          </span>
                        ) : null}
                      </div>
                      {description ? (
                        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{description}</p>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
                <div className="overflow-y-auto px-6 py-5">{children}</div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
