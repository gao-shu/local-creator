import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  content?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'destructive'
  loading?: boolean
  confirmDisabled?: boolean
  onClose: () => void
  onConfirm: () => void
  /** 叠在工具箱 Modal(z-120) 之上时用 */
  overlayClassName?: string
  contentClassName?: string
  panelClassName?: string
}

export function ConfirmDialog({
  open,
  title,
  description,
  content,
  confirmLabel = '确定',
  cancelLabel = '取消',
  variant = 'default',
  loading = false,
  confirmDisabled = false,
  onClose,
  onConfirm,
  overlayClassName,
  contentClassName,
  panelClassName,
}: ConfirmDialogProps) {
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={cn("fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm", overlayClassName)}
            onClick={loading ? undefined : onClose}
          />
          <div className={cn("fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none", contentClassName)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className={cn('pointer-events-auto w-full max-w-md', panelClassName)}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className={cn(
                  'rounded-2xl border border-border/40',
                  'bg-card shadow-2xl shadow-black/30',
                  'flex flex-col overflow-hidden',
                )}
              >
                <div className="flex items-start gap-3 px-6 pt-6 pb-4">
                  <div
                    className={cn(
                      'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      variant === 'destructive' ? 'bg-destructive/15' : 'bg-primary/10',
                    )}
                  >
                    <AlertTriangle
                      className={cn(
                        'h-5 w-5',
                        variant === 'destructive' ? 'text-destructive' : 'text-primary',
                      )}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="text-base font-semibold leading-snug">{title}</h2>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                    {content ? (
                      <div className="mt-3">{content}</div>
                    ) : description ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        {description}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-border/20 px-6 py-4">
                  <button
                    type="button"
                    data-testid="confirm-dialog-cancel"
                    disabled={loading}
                    onClick={onClose}
                    className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    data-testid="confirm-dialog-confirm"
                    disabled={loading || confirmDisabled}
                    onClick={onConfirm}
                    className={cn(
                      'rounded-xl px-5 py-2 text-sm font-medium transition-all',
                      'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
                      variant === 'destructive'
                        ? 'bg-destructive text-destructive-foreground hover:opacity-90'
                        : 'bg-primary text-primary-foreground hover:opacity-90',
                    )}
                  >
                    {confirmLabel}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}

