// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { MentionTextarea } from '@/components/workshop/mention-textarea'
import type { MentionCandidate } from '@/lib/workflow/mention-utils'
import { CANVAS_INPUT_PLACEHOLDER, CANVAS_NODE_CONSOLE_TEXT, CANVAS_NODE_INPUT } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

export interface EditShotDescriptionDraft {
  dialogue: string
  prompt: string
}

interface EditShotDescriptionModalProps {
  open: boolean
  shotNumber: number
  dialogue: string
  prompt: string
  candidates: MentionCandidate[]
  canvasProjectId: string
  onSave: (draft: EditShotDescriptionDraft) => void
  onClose: () => void
}

/** 分镜视频节点：编辑本镜标题与生成描述 */
export function EditShotDescriptionModal({
  open,
  shotNumber,
  dialogue,
  prompt,
  candidates,
  canvasProjectId,
  onSave,
  onClose,
}: EditShotDescriptionModalProps) {
  const [draftDialogue, setDraftDialogue] = useState(dialogue)
  const [draftPrompt, setDraftPrompt] = useState(prompt)

  useEffect(() => {
    if (!open) return
    setDraftDialogue(dialogue)
    setDraftPrompt(prompt)
  }, [dialogue, open, prompt])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  const handleSave = useCallback(() => {
    onSave({
      dialogue: draftDialogue,
      prompt: draftPrompt,
    })
    onClose()
  }, [draftDialogue, draftPrompt, onClose, onSave])

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
          <div className="fixed inset-0 z-[121] flex items-center justify-center p-6 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.18 }}
              data-testid="canvas-edit-shot-description-modal"
              className="pointer-events-auto flex h-[min(78vh,680px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/40 dark:border-white/10 dark:bg-[#141416]"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4 py-3 dark:border-white/10">
                <div>
                  <p className="text-sm font-medium text-foreground dark:text-white/90">
                    编辑本镜描述 · 镜 {shotNumber}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-white/45">
                    修改标题或画面描述；支持 @ 引用资产。已有成片时将标记待更新。
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                <label className="block space-y-1.5">
                  <span className="text-[12px] font-medium text-foreground/85 dark:text-white/75">
                    镜标题（可选）
                  </span>
                  <input
                    type="text"
                    value={draftDialogue}
                    onChange={(event) => setDraftDialogue(event.target.value)}
                    placeholder="如：她翻动书页的侧影"
                    className={cn(
                      'w-full rounded-xl border border-border/35 bg-muted/20 px-3 py-2 text-[14px] outline-none focus:border-primary/40 dark:border-white/10 dark:bg-white/[0.03]',
                      CANVAS_NODE_INPUT,
                      CANVAS_INPUT_PLACEHOLDER,
                    )}
                  />
                </label>

                <label className="block min-h-0 space-y-1.5">
                  <span className="text-[12px] font-medium text-foreground/85 dark:text-white/75">
                    画面描述
                  </span>
                  <MentionTextarea
                    value={draftPrompt}
                    onChange={setDraftPrompt}
                    candidates={candidates}
                    canvasProjectId={canvasProjectId}
                    embedded
                    tone="canvas"
                    rows={10}
                    scrollBoxHeight={320}
                    maxHeight={320}
                    emptyHint="输入 @ 可引用已标记的人物/场景/道具资产"
                    placeholder="景别、机位、动作、光影等生视频提示词…"
                    className={cn(
                      'min-h-[280px] rounded-xl border border-border/35 bg-muted/20 px-3 py-2.5 text-[14px] leading-relaxed dark:border-white/10 dark:bg-white/[0.03]',
                      CANVAS_NODE_CONSOLE_TEXT,
                    )}
                  />
                </label>
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/30 px-4 py-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-muted/60 hover:text-foreground dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  取消
                </button>
                <button
                  type="button"
                  data-testid="canvas-edit-shot-description-save"
                  onClick={handleSave}
                  className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
