// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  listActiveGenerationWarnings,
  type ActiveGenerationWarning,
} from '@/lib/app/active-generation-tasks'
import { isElectronApp } from '@/lib/update/app-updater'
import { cn } from '@/lib/utils'

const SOURCE_LABEL: Record<ActiveGenerationWarning['source'], string> = {
  workflow: '工坊',
  canvas: '画布',
  memory: '进行中',
}

export function AppCloseGuardHost() {
  const [open, setOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [warnings, setWarnings] = useState<ActiveGenerationWarning[]>([])
  const handlingRef = useRef(false)

  const sendDecision = useCallback((allow: boolean) => {
    window.electronAPI?.sendCloseDecision?.(allow)
  }, [])

  const handleCloseRequest = useCallback(async () => {
    if (handlingRef.current || open) return
    handlingRef.current = true
    setChecking(true)
    try {
      const activeWarnings = await listActiveGenerationWarnings()
      if (activeWarnings.length === 0) {
        sendDecision(true)
        return
      }
      setWarnings(activeWarnings)
      setOpen(true)
    } catch {
      setWarnings([
        {
          id: 'unknown',
          source: 'memory',
          projectTitle: '应用',
          title: '可能有任务仍在进行',
          detail: '无法读取任务列表，建议确认生成完成后再退出',
        },
      ])
      setOpen(true)
    } finally {
      setChecking(false)
      handlingRef.current = false
    }
  }, [open, sendDecision])

  useEffect(() => {
    if (!isElectronApp() || !window.electronAPI?.onCloseRequest) return
    window.electronAPI.onCloseRequest(() => {
      void handleCloseRequest()
    })
  }, [handleCloseRequest])

  const handleCancel = () => {
    setOpen(false)
    setWarnings([])
    sendDecision(false)
  }

  const handleConfirm = () => {
    setOpen(false)
    setWarnings([])
    sendDecision(true)
  }

  if (!isElectronApp()) return null

  return createPortal(
    <>
      {checking ? (
        <div className="fixed bottom-4 right-4 z-[99] flex items-center gap-2 rounded-xl border border-border/40 bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-lg">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在检查进行中的任务…
        </div>
      ) : null}

      <AnimatePresence>
        {open ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
              onClick={handleCancel}
            />
            <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ duration: 0.2 }}
                className="pointer-events-auto w-full max-w-lg"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/30 overflow-hidden">
                  <div className="flex items-start gap-3 px-6 pt-6 pb-4">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold leading-snug">仍有任务进行中</h2>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                        现在关闭应用可能导致以下生成任务中断，无法完成：
                      </p>
                    </div>
                  </div>

                  <div className="mx-6 mb-4 max-h-56 overflow-y-auto rounded-xl border border-border/30 bg-muted/20">
                    <ul className="divide-y divide-border/20">
                      {warnings.map((item) => (
                        <li key={item.id} className="px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="shrink-0 rounded-md bg-foreground/5 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              {SOURCE_LABEL[item.source]}
                            </span>
                            <p className="text-sm font-medium truncate">{item.title}</p>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground truncate">
                            {item.projectTitle}
                            {item.detail ? ` · ${item.detail}` : ''}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex justify-end gap-3 border-t border-border/20 px-6 py-4">
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="rounded-xl px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      继续等待
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirm}
                      className={cn(
                        'rounded-xl px-5 py-2 text-sm font-medium transition-all',
                        'bg-destructive text-destructive-foreground hover:opacity-90 active:scale-[0.98]',
                      )}
                    >
                      仍要退出
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        ) : null}
      </AnimatePresence>
    </>,
    document.body,
  )
}
