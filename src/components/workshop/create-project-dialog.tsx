import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface CreateProjectSubmitPayload {
  title: string
  description?: string
}

interface CreateProjectDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: CreateProjectSubmitPayload) => Promise<void>
  dialogTitle?: string
  submitLabel?: string
  /** E2E：对话框 testid 前缀，默认 workshop-create */
  testIdPrefix?: string
}

export function CreateProjectDialog({
  open,
  onClose,
  onSubmit,
  dialogTitle = '新建项目',
  submitLabel = '创建项目',
  testIdPrefix = 'workshop-create',
}: CreateProjectDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setError('')
  }, [open])

  const handleClose = useCallback(() => {
    setTitle('')
    setDescription('')
    setError('')
    onClose()
  }, [onClose])

  const handleSubmit = async () => {
    const resolvedTitle = title.trim()
    if (!resolvedTitle) {
      setError('请输入项目名称')
      return
    }

    setLoading(true)
    setError('')
    try {
      await onSubmit({
        title: resolvedTitle,
        description: description.trim() || undefined,
      })
      handleClose()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-lg"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                data-testid={`${testIdPrefix}-dialog`}
                className={cn(
                  'rounded-2xl border border-border/40',
                  'bg-card shadow-2xl shadow-black/20',
                  'flex flex-col overflow-hidden',
                )}
              >
                <div className="flex items-center justify-between px-6 pt-6 pb-4">
                  <h2 className="text-lg font-semibold">{dialogTitle}</h2>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="px-6 space-y-4 pb-2">
                  <div>
                    <label className="block text-sm font-medium mb-1.5">
                      项目名称 <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      data-testid={`${testIdPrefix}-title`}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="例如：都市逆袭漫剧"
                      className={cn(
                        'w-full px-3.5 py-2.5 rounded-xl text-sm',
                        'bg-muted/50 border border-border/40',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                        'placeholder:text-muted-foreground/50 transition-all',
                      )}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && void handleSubmit()}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1.5">项目描述</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="简要描述项目内容和目标..."
                      rows={3}
                      className={cn(
                        'w-full px-3.5 py-2.5 rounded-xl text-sm resize-none',
                        'bg-muted/50 border border-border/40',
                        'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
                        'placeholder:text-muted-foreground/50 transition-all',
                      )}
                    />
                  </div>
                  {error ? <p className="text-sm text-destructive">{error}</p> : null}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/20 mt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    data-testid={`${testIdPrefix}-submit`}
                    onClick={() => void handleSubmit()}
                    disabled={loading}
                    className={cn(
                      'px-5 py-2 rounded-xl text-sm font-medium',
                      'bg-primary text-primary-foreground',
                      'hover:opacity-90 active:scale-[0.98] transition-all',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                    )}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        创建中...
                      </span>
                    ) : (
                      submitLabel
                    )}
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
