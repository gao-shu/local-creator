// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useMemo, useState } from 'react'
import { Loader2, MessageSquarePlus, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { resolveApiBase } from '@/lib/auth/api-base'
import { isLoginRequired, isRealUserSession } from '@/lib/auth/login-mode'
import { buildFeedbackDiagnostics } from '@/lib/feedback/feedback-diagnostics'
import { submitClientFeedback } from '@/lib/feedback/feedback-service'
import { CANVAS_INPUT_PLACEHOLDER } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

export function ToolboxWishForm() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const loginRequired = isLoginRequired()
  const canSubmit = isRealUserSession(token)
  const apiBase = resolveApiBase()

  const [wish, setWish] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const diagnostics = useMemo(
    () =>
      buildFeedbackDiagnostics({
        route: '/toolbox',
        userId: user?.id ?? null,
        projectId: null,
        apiBase,
        loginRequired,
      }),
    [apiBase, loginRequired, user?.id],
  )

  const handleSubmit = useCallback(async () => {
    const trimmed = wish.trim()
    if (!trimmed) {
      toast.error('请描述你希望增加的工具')
      return
    }
    if (!canSubmit) {
      toast.error(loginRequired ? '请先登录后再提交' : '请登录账号后再提交工具心愿')
      return
    }

    setSubmitting(true)
    try {
      const result = await submitClientFeedback({
        token: token!,
        feedbackType: 'feature',
        content: `[工具箱心愿]\n${trimmed}`,
        diagnostics: {
          ...diagnostics,
          route: '/toolbox#tool-wish',
        },
        apiBase,
      })
      setSubmitted(true)
      setWish('')
      toast.success(`已提交，工单编号 ${result.id}`)
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '提交失败，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }, [apiBase, canSubmit, diagnostics, loginRequired, token, wish])

  return (
    <div className="rounded-2xl border border-border/30 bg-card/40 backdrop-blur-sm p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center shrink-0">
          <MessageSquarePlus className="h-5 w-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold">还想要什么工具？</h2>
          <p className="text-sm text-muted-foreground mt-0.5">说说你的场景，我们会参考安排。</p>
        </div>
      </div>

      {!canSubmit ? (
        <p className="text-xs text-amber-600 dark:text-amber-400">登录后可提交</p>
      ) : null}

      {submitted ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          已收到，感谢反馈。
        </div>
      ) : null}

      <textarea
        value={wish}
        onChange={(e) => setWish(e.target.value)}
        placeholder="例如：分镜台词导出配音稿、批量压缩参考图……"
        rows={4}
        disabled={submitting}
        className={cn(
          'w-full rounded-xl px-3 py-2.5 text-sm resize-y',
          'bg-muted/40 border border-border/40 outline-none',
          'focus:ring-2 focus:ring-primary/20',
          CANVAS_INPUT_PLACEHOLDER,
          'disabled:opacity-60',
        )}
      />

      <div>
        <button
          type="button"
          disabled={submitting || !wish.trim()}
          onClick={() => void handleSubmit()}
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm',
            'bg-violet-600 text-white hover:bg-violet-500 transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <SendHorizontal className="h-4 w-4" />
          )}
          提交
        </button>
      </div>
    </div>
  )
}
