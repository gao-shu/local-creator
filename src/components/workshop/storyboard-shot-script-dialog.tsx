import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { MentionTextarea } from '@/components/workshop/mention-textarea'
import { StoryboardImageReviewBadge } from '@/components/workshop/storyboard-image-review-badge'
import { StoryboardShotQuickActions } from '@/components/workshop/storyboard-shot-quick-actions'
import { StoryboardShotReferencePanel } from '@/components/workshop/storyboard-shot-reference-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStoryboardShotEditor } from '@/hooks/use-storyboard-shot-editor'
import { resolveShotWorkflowStatusHint } from '@/lib/workflow/storyboard-shot-status-hint'
import type { MentionCandidate } from '@/lib/workflow/mention-utils'
import type { WorkflowAsset, WorkflowShot } from '@/types/workflow'
import type { VoiceLibraryEntry } from '@/types/voice-library'

interface StoryboardShotScriptDialogProps {
  open: boolean
  shot: WorkflowShot
  shots: WorkflowShot[]
  mentionCandidates: MentionCandidate[]
  characters?: WorkflowAsset[]
  voiceLibrary?: VoiceLibraryEntry[]
  projectRoot?: string
  onChange: (patch: Partial<WorkflowShot>) => void
  onClose: () => void
  onNavigate: (shotId: string) => void
  onUploadReference?: () => void
  onPickReferenceFromLibrary?: () => void
  onUploadReferenceAudio?: () => void
  imageBusy?: boolean
  validating?: boolean
  videoBusy?: boolean
  onGenerate?: () => void
  onStopGenerate?: () => void
  onValidate?: () => void
  onGenerateVideo?: () => void
  onStopGenerateVideo?: () => void
}

/** Step4 分镜文案编辑窗：大窗编辑提示词与资产/参考，底部含生图生视频审核快捷操作 */
export function StoryboardShotScriptDialog({
  open,
  shot,
  shots,
  mentionCandidates,
  characters = [],
  voiceLibrary = [],
  projectRoot,
  onChange,
  onClose,
  onNavigate,
  onUploadReference,
  onPickReferenceFromLibrary,
  onUploadReferenceAudio,
  imageBusy = false,
  validating = false,
  videoBusy = false,
  onGenerate,
  onStopGenerate,
  onValidate,
  onGenerateVideo,
  onStopGenerateVideo,
}: StoryboardShotScriptDialogProps) {
  const editorAreaRef = useRef<HTMLDivElement>(null)
  const [editorAreaHeight, setEditorAreaHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setEditorAreaHeight(null)
      return
    }
    const el = editorAreaRef.current
    if (!el) return

    const updateHeight = () => {
      const next = Math.floor(el.getBoundingClientRect().height)
      if (next > 0) setEditorAreaHeight(next)
    }

    updateHeight()
    const observer = new ResizeObserver(() => updateHeight())
    observer.observe(el)
    return () => observer.disconnect()
  }, [open, shot.id])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const shotIndex = shots.findIndex((item) => item.id === shot.id)
  const prevShot = shotIndex > 0 ? shots[shotIndex - 1] : null
  const nextShot = shotIndex >= 0 && shotIndex < shots.length - 1 ? shots[shotIndex + 1] : null

  const editor = useStoryboardShotEditor({
    shot,
    mentionCandidates,
    characters,
    voiceLibrary,
    projectRoot,
    onChange,
  })

  const workflowStatusHint = resolveShotWorkflowStatusHint(shot, {
    imageBusy,
    videoBusy,
    validating,
  })

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
              data-testid="storyboard-shot-script-dialog"
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 10 }}
              transition={{ duration: 0.18 }}
              className="pointer-events-auto flex h-[85vh] w-[min(88vw,1200px)] flex-col overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/40"
              onMouseDown={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/30 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cyan-500 shrink-0">#{shot.shotNumber}</span>
                    <Input
                      value={shot.dialogue}
                      onChange={(e) => editor.handleDialogueChange(e.target.value)}
                      className="h-8 max-w-md text-sm border-transparent bg-transparent px-1 focus-visible:ring-1"
                      placeholder="分镜标题"
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    改文案后可直接生成视频 · 分镜图与审核为可选步骤
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  aria-label="关闭"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-[1fr_340px]">
                <div className="flex min-h-0 flex-col border-b border-border/30 p-4 lg:border-b-0 lg:border-r">
                  <p className="mb-2 shrink-0 text-xs font-medium text-muted-foreground">分镜提示词</p>
                  <div ref={editorAreaRef} className="min-h-0 flex-1">
                    <MentionTextarea
                      value={editor.promptText}
                      onChange={editor.handlePromptChange}
                      candidates={editor.promptMentionCandidates}
                      projectRoot={projectRoot}
                      characters={characters}
                      rows={12}
                      scrollBoxHeight={editorAreaHeight ?? undefined}
                      maxHeight={editorAreaHeight ?? undefined}
                      placeholder={'例：[全局空间锚点: 以 @场景名 正面为基准…]\n近景，@角色名 坐在 @物品名 上…'}
                      className="h-full rounded-xl border border-border/35 bg-muted/15 px-3 py-2.5 text-[14px] leading-relaxed"
                    />
                  </div>
                </div>

                <div className="min-h-0 overflow-y-auto p-4">
                  <StoryboardShotReferencePanel
                    shot={shot}
                    variant="expanded"
                    includeVideoSection
                    characters={characters}
                    mentionCandidates={mentionCandidates}
                    projectRoot={projectRoot}
                    editor={editor}
                    onUploadReference={onUploadReference}
                    onPickReferenceFromLibrary={onPickReferenceFromLibrary}
                    onUploadReferenceAudio={onUploadReferenceAudio}
                  />
                </div>
              </div>

              <div className="flex shrink-0 flex-col gap-2 border-t border-border/30 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {onGenerate && onStopGenerate && onValidate && onGenerateVideo && onStopGenerateVideo ? (
                      <>
                        <StoryboardShotQuickActions
                          shot={shot}
                          imageBusy={imageBusy}
                          validating={validating}
                          videoBusy={videoBusy}
                          onGenerate={onGenerate}
                          onStopGenerate={onStopGenerate}
                          onValidate={onValidate}
                          onGenerateVideo={onGenerateVideo}
                          onStopGenerateVideo={onStopGenerateVideo}
                          testIdScope="dialog"
                          videoFirst
                        />
                        <StoryboardImageReviewBadge shot={shot} />
                      </>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-muted-foreground shrink-0">{workflowStatusHint}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground tabular-nums">
                    第 {shotIndex + 1} / {shots.length} 镜
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={!prevShot}
                      onClick={() => prevShot && onNavigate(prevShot.id)}
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                      上一镜
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={!nextShot}
                      onClick={() => nextShot && onNavigate(nextShot.id)}
                    >
                      下一镜
                      <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                  </div>
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
