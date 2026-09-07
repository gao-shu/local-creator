import { useCallback, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, ImagePlus, Loader2, MessageSquarePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { resolveApiBase } from '@/lib/auth/api-base'
import { hasPersistedRealToken, isLoginRequired, isRealUserSession } from '@/lib/auth/login-mode'
import {
  buildFeedbackDiagnostics,
  type FeedbackType,
} from '@/lib/feedback/feedback-diagnostics'
import {
  createFeedbackImageDraft,
  MAX_FEEDBACK_IMAGES,
  revokeFeedbackImageDrafts,
  uploadFeedbackImages,
  type FeedbackImageDraft,
} from '@/lib/feedback/feedback-images'
import { submitClientFeedback } from '@/lib/feedback/feedback-service'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string }> = [
  { value: 'bug', label: 'Bug / 异常' },
  { value: 'feature', label: '功能建议' },
  { value: 'general', label: '使用问题' },
  { value: 'other', label: '其他' },
]

interface FeedbackDialogProps {
  open: boolean
  onClose: () => void
}

export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const { pathname } = useLocation()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const projectId = useWorkflowSessionStore((s) => s.projectId)
  const loginRequired = isLoginRequired()
  const canSubmit = isRealUserSession(token)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<FeedbackImageDraft[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submittedId, setSubmittedId] = useState<string | null>(null)

  const apiBase = resolveApiBase()

  const diagnostics = useMemo(
    () =>
      buildFeedbackDiagnostics({
        route: pathname,
        userId: user?.id ?? null,
        projectId,
        apiBase,
        loginRequired,
      }),
    [apiBase, loginRequired, pathname, projectId, user?.id],
  )

  const resetForm = useCallback(() => {
    setFeedbackType('bug')
    setContent('')
    setImages((prev) => {
      revokeFeedbackImageDrafts(prev)
      return []
    })
    setSubmittedId(null)
    setSubmitting(false)
  }, [])

  const handleClose = useCallback(() => {
    if (submitting) return
    resetForm()
    onClose()
  }, [onClose, resetForm, submitting])

  const handlePickImages = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return
      const remaining = MAX_FEEDBACK_IMAGES - images.length
      if (remaining <= 0) {
        toast.error(`最多上传 ${MAX_FEEDBACK_IMAGES} 张截图`)
        return
      }
      const next: FeedbackImageDraft[] = []
      for (const file of Array.from(fileList).slice(0, remaining)) {
        try {
          next.push(createFeedbackImageDraft(file))
        } catch (err) {
          toast.error(err instanceof Error ? err.message : '图片无效')
        }
      }
      if (next.length) setImages((prev) => [...prev, ...next])
    },
    [images.length],
  )

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }, [])

  const handleSubmit = useCallback(async () => {
    const text = content.trim()
    if (!text) {
      toast.error('请填写反馈内容')
      return
    }
    if (!canSubmit || !token) {
      toast.error(loginRequired ? '请先登录后再提交反馈' : '当前为本地模式，请登录账号后提交反馈')
      return
    }

    setSubmitting(true)
    try {
      let imageUrls: string[] = []
      if (images.length) {
        imageUrls = await uploadFeedbackImages(images, apiBase)
      }
      const result = await submitClientFeedback({
        token,
        feedbackType,
        content: text,
        diagnostics,
        imageUrls,
        apiBase,
      })
      setSubmittedId(result.id)
      toast.success('反馈已提交，感谢你的帮助')
    } catch (err) {
      const message = err instanceof Error ? err.message : '提交失败，请稍后重试'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }, [apiBase, canSubmit, content, diagnostics, feedbackType, images, loginRequired, token])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm"
            onClick={submitting ? undefined : handleClose}
          />
          <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-lg"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                className={cn(
                  'rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/30',
                  'flex flex-col overflow-hidden max-h-[min(90vh,720px)]',
                )}
              >
                <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <MessageSquarePlus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold">建议与反馈</h2>
                      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                        描述问题或建议，可附上截图便于排查。我们会自动附带版本与页面信息。
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleClose}
                    className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {submittedId ? (
                  <div className="px-6 pb-6">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-5 text-center">
                      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500 mb-3" />
                      <p className="text-sm font-medium text-foreground">已收到你的反馈</p>
                      <p className="mt-2 text-xs text-muted-foreground break-all">
                        工单编号：{submittedId}
                      </p>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="rounded-xl bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                      >
                        完成
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="px-6 pb-4 space-y-4 overflow-y-auto">
                      {!canSubmit ? (
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                          {loginRequired
                            ? '提交反馈需要先登录账号。'
                            : '本地模式下请登录账号后再提交反馈。'}
                        </div>
                      ) : null}

                      <div>
                        <label className="text-xs font-medium text-muted-foreground">反馈类型</label>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {TYPE_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFeedbackType(opt.value)}
                              className={cn(
                                'rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors',
                                feedbackType === opt.value
                                  ? 'border-primary/50 bg-primary/10 text-primary'
                                  : 'border-border/40 text-muted-foreground hover:bg-foreground/5',
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="feedback-content"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          详细描述
                        </label>
                        <textarea
                          id="feedback-content"
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          rows={5}
                          maxLength={5000}
                          placeholder="例如：在分镜页点击生成时无响应，期望能弹出进度…"
                          className={cn(
                            'mt-2 w-full resize-none rounded-xl border border-border/40 bg-background/60',
                            'px-3 py-2.5 text-sm leading-relaxed outline-none',
                            'focus:border-primary/40 focus:ring-2 focus:ring-primary/15',
                          )}
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground text-right">
                          {content.length}/5000
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs font-medium text-muted-foreground">
                            截图（可选）
                          </label>
                          <span className="text-[11px] text-muted-foreground">
                            {images.length}/{MAX_FEEDBACK_IMAGES}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {images.map((item) => (
                            <div
                              key={item.id}
                              className="relative h-20 w-20 overflow-hidden rounded-xl border border-border/40 bg-muted/30"
                            >
                              <img
                                src={item.previewUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => handleRemoveImage(item.id)}
                                className="absolute right-1 top-1 rounded-full bg-black/55 p-0.5 text-white hover:bg-black/70 disabled:opacity-50"
                                aria-label="移除截图"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          {images.length < MAX_FEEDBACK_IMAGES ? (
                            <button
                              type="button"
                              disabled={submitting || !canSubmit}
                              onClick={() => fileInputRef.current?.click()}
                              className={cn(
                                'flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl',
                                'border border-dashed border-border/50 text-muted-foreground',
                                'hover:border-primary/40 hover:bg-primary/5 hover:text-primary',
                                'disabled:cursor-not-allowed disabled:opacity-50',
                              )}
                            >
                              <ImagePlus className="h-5 w-5" />
                              <span className="text-[10px]">添加</span>
                            </button>
                          ) : null}
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          multiple
                          className="hidden"
                          onChange={(e) => {
                            handlePickImages(e.target.files)
                            e.target.value = ''
                          }}
                        />
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                          支持 JPG / PNG / WebP / GIF，单张不超过 5MB
                        </p>
                      </div>

                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        将附带：v{diagnostics.appVersion} · {diagnostics.route}
                        {hasPersistedRealToken(token) ? '' : ' · 未登录'}
                      </p>
                    </div>

                    <div className="flex justify-end gap-3 border-t border-border/20 px-6 py-4">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={handleClose}
                        className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        disabled={submitting || !canSubmit}
                        onClick={() => void handleSubmit()}
                        className={cn(
                          'inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium',
                          'bg-primary text-primary-foreground hover:opacity-90',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {submitting && images.length ? '上传并提交…' : '提交反馈'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
