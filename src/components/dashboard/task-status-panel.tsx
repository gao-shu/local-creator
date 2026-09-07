import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ListTodo, Loader2, Trash2, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
  formatTaskTime,
  isActiveTaskStatus,
  type UnifiedTaskEntry,
} from '@/lib/workflow/task-service'
import { IMAGE_BATCH_CONCURRENCY, VIDEO_BATCH_CONCURRENCY } from '@/constants/batch-concurrency'
import { isLocalPlaceholderTaskId } from '@/lib/workflow/step4-task-sync'
import { useTaskStore } from '@/stores/task-store'
import { cancelUnifiedTask, deleteUnifiedTask } from '@/lib/workflow/unified-task-actions'
import { toast } from 'sonner'
import type { WorkflowTaskStatus, WorkflowTaskType } from '@/types/workflow'

type FilterKey = 'all' | WorkflowTaskStatus | 'active'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '成功' },
  { key: 'failed', label: '失败' },
]

const SOURCE_LABEL: Record<UnifiedTaskEntry['source'], string> = {
  workflow: '工坊',
  canvas: '画布',
}

function StatusIcon({ status }: { status: WorkflowTaskStatus }) {
  if (status === 'running' || status === 'pending') {
    return <Loader2 className="h-4 w-4 text-violet-400 animate-spin shrink-0" />
  }
  if (status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
  }
  return <XCircle className="h-4 w-4 text-red-400 shrink-0" />
}

function filterEntries(entries: UnifiedTaskEntry[], filter: FilterKey) {
  if (filter === 'all') return entries
  if (filter === 'active') return entries.filter((e) => isActiveTaskStatus(e.task.status))
  return entries.filter((e) => e.task.status === filter)
}

function resolveUnifiedTaskTitle(entry: UnifiedTaskEntry): string {
  if (entry.source === 'canvas') {
    return entry.task.label?.trim() ? `生视频 · ${entry.task.label}` : '画布生视频'
  }
  const type = entry.task.type as WorkflowTaskType
  return TASK_TYPE_LABEL[type] ?? entry.task.type
}

function resolveTaskNavigatePath(entry: UnifiedTaskEntry): string | null {
  if (entry.source === 'canvas') return `/canvas/${entry.projectId}`
  if (entry.task.type === 'image' && entry.task.assetId) {
    return `/workshop/${entry.projectId}/step/3`
  }
  if (entry.task.type === 'video' || entry.task.type === 'image') {
    return `/workshop/${entry.projectId}/step/4`
  }
  return `/workshop/${entry.projectId}`
}

function taskEntryKey(entry: UnifiedTaskEntry): string {
  return `${entry.source}:${entry.projectId}:${entry.task.id}`
}

export function TaskStatusButton({
  panelAnchorClassName = 'top-16 right-4',
  buttonClassName,
}: {
  panelAnchorClassName?: string
  buttonClassName?: string
} = {}) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterKey>('all')
  const [cancellingKey, setCancellingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const entries = useTaskStore((s) => s.entries)
  const activeCount = useTaskStore((s) => s.activeCount)
  const loading = useTaskStore((s) => s.loading)
  const refresh = useTaskStore((s) => s.refresh)
  const startPolling = useTaskStore((s) => s.startPolling)
  const stopPolling = useTaskStore((s) => s.stopPolling)

  useEffect(() => {
    startPolling()
    return () => stopPolling()
  }, [startPolling, stopPolling])

  useEffect(() => {
    if (!open) return
    void refresh()

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return
      }
      setOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, refresh])

  const filtered = useMemo(() => filterEntries(entries, filter), [entries, filter])
  const videoConcurrencyLimit = VIDEO_BATCH_CONCURRENCY
  const imageConcurrencyLimit = IMAGE_BATCH_CONCURRENCY

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const handleOpenTask = useCallback(
    (entry: UnifiedTaskEntry) => {
      const path = resolveTaskNavigatePath(entry)
      if (!path) return
      setOpen(false)
      navigate(path)
    },
    [navigate],
  )

  const handleCancelTask = useCallback(
    async (entry: UnifiedTaskEntry) => {
      const key = taskEntryKey(entry)
      setCancellingKey(key)
      try {
        const ok = await cancelUnifiedTask(entry)
        if (ok) toast.message('任务已终止')
        else toast.error('任务无法终止')
        await refresh()
      } catch (error: unknown) {
        toast.error((error as Error).message || '终止任务失败')
      } finally {
        setCancellingKey(null)
      }
    },
    [refresh],
  )

  const handleDeleteTask = useCallback(
    async (entry: UnifiedTaskEntry) => {
      const key = taskEntryKey(entry)
      setDeletingKey(key)
      try {
        const removed = await deleteUnifiedTask(entry)
        if (removed) toast.message('任务已删除')
        else toast.error('任务不存在或已删除')
        await refresh()
      } catch (error: unknown) {
        toast.error((error as Error).message || '删除任务失败')
      } finally {
        setDeletingKey(null)
      }
    },
    [refresh],
  )

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={cn(
          'relative p-2 rounded-xl transition-colors',
          open
            ? 'bg-violet-500/15 text-violet-400'
            : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
          buttonClassName,
        )}
        aria-label="任务状态"
        title="任务状态"
        data-testid="task-status-button"
      >
        <ListTodo className="h-5 w-5" />
        {activeCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-violet-500 text-[10px] font-medium text-white flex items-center justify-center">
            {activeCount > 9 ? '9+' : activeCount}
          </span>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={panelRef}
              data-canvas-shortcut-lock
              data-testid="task-status-panel"
              className={cn(
                'fixed z-[120] w-[min(420px,calc(100vw-2rem))]',
                panelAnchorClassName,
                'rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/25',
                'flex flex-col overflow-hidden',
              )}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border/20">
                <div>
                  <h3 className="text-sm font-semibold">任务状态</h3>
                  <p
                    className="text-xs text-muted-foreground mt-0.5"
                    data-testid="task-status-active-summary"
                  >
                    进行中 {activeCount}（生图 {imageConcurrencyLimit} 路 · 视频 {videoConcurrencyLimit} 路）
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="task-status-close"
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-border/10">
                {FILTERS.map((item) => {
                  const count =
                    item.key === 'all'
                      ? entries.length
                      : item.key === 'active'
                        ? entries.filter((e) => isActiveTaskStatus(e.task.status)).length
                        : entries.filter((e) => e.task.status === item.key).length
                  const selected = filter === item.key
                  return (
                  <button
                    key={item.key}
                    type="button"
                    data-testid={`task-filter-${item.key}`}
                    onClick={() => setFilter(item.key)}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs transition-colors',
                      selected
                        ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-300'
                        : 'border-transparent text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
                    )}
                  >
                    {item.label}
                    <span
                      className={cn(
                        'min-w-[16px] rounded-full px-1 text-[10px] leading-4 text-center',
                        selected ? 'bg-cyan-500/20 text-cyan-200' : 'bg-muted/60 text-muted-foreground',
                      )}
                    >
                      {count}
                    </span>
                  </button>
                  )
                })}
              </div>

              <div className="max-h-[min(420px,50vh)] overflow-y-auto p-2">
                {loading && entries.length === 0 ? (
                  <div className="py-10 flex items-center justify-center text-sm text-muted-foreground gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    加载中…
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="py-10 text-center text-sm text-muted-foreground">
                    暂无{filter === 'all' ? '' : FILTERS.find((f) => f.key === filter)?.label}任务
                  </div>
                ) : (
                  <ul className="space-y-1.5">
                    {filtered.map((entry) => {
                      const entryKey = taskEntryKey(entry)
                      const isPlaceholder = isLocalPlaceholderTaskId(entry.task.id)
                      const canCancel =
                        !isPlaceholder && isActiveTaskStatus(entry.task.status)
                      const canDelete = !isPlaceholder
                      const cancelling = cancellingKey === entryKey
                      const deleting = deletingKey === entryKey
                      const actionBusy = cancelling || deleting
                      return (
                      <li
                        key={entryKey}
                        data-testid={`task-entry-${entry.task.id}`}
                        data-task-type={entry.task.type}
                        data-task-status={entry.task.status}
                        className={cn(
                          'rounded-xl border px-3 py-2.5',
                          isActiveTaskStatus(entry.task.status)
                            ? 'border-violet-500/25 bg-violet-500/5'
                            : 'border-border/20 bg-card/50',
                        )}
                      >
                        <div className="flex items-start gap-2.5">
                          <StatusIcon status={entry.task.status} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleOpenTask(entry)}
                                className="min-w-0 flex-1 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-foreground/5 transition-colors"
                              >
                                <p className="text-sm font-medium truncate">
                                  {resolveUnifiedTaskTitle(entry)}
                                </p>
                              </button>
                              <div className="flex items-center gap-1 shrink-0">
                                {canCancel ? (
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={() => void handleCancelTask(entry)}
                                    data-testid={`task-entry-${entry.task.id}-cancel`}
                                    className="inline-flex items-center gap-0.5 rounded-md border border-red-500/30 px-1.5 py-0.5 text-[10px] text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                                    title="终止任务"
                                  >
                                    {cancelling ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <XCircle className="h-3 w-3" />
                                    )}
                                    终止
                                  </button>
                                ) : null}
                                {canDelete ? (
                                  <button
                                    type="button"
                                    disabled={actionBusy}
                                    onClick={() => void handleDeleteTask(entry)}
                                    data-testid={`task-entry-${entry.task.id}-delete`}
                                    className="inline-flex items-center gap-0.5 rounded-md border border-border/40 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                                    title="删除任务记录"
                                  >
                                    {deleting ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                    删除
                                  </button>
                                ) : null}
                                <span className="text-[10px] text-muted-foreground">
                                  {TASK_STATUS_LABEL[entry.task.status]}
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenTask(entry)}
                              className="block w-full text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-foreground/5 transition-colors"
                            >
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                <span className="text-[10px] text-muted-foreground/80 mr-1.5">
                                  {SOURCE_LABEL[entry.source]}
                                </span>
                                {entry.projectTitle}
                              </p>
                              {entry.task.progressMessage ? (
                                <p className="text-xs text-muted-foreground/90 mt-1 line-clamp-2">
                                  {entry.task.progressMessage}
                                </p>
                              ) : null}
                              {entry.task.errorMessage ? (
                                <p className="mt-1 cursor-text select-text break-words text-xs leading-relaxed text-red-400/90">
                                  {entry.task.errorMessage}
                                </p>
                              ) : null}
                              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                                {formatTaskTime(entry.task.updatedAt ?? entry.task.createdAt)}
                              </p>
                            </button>
                          </div>
                        </div>
                      </li>
                    )})}
                  </ul>
                )}
              </div>

              <div className="px-4 py-2.5 border-t border-border/10 text-[11px] text-muted-foreground leading-relaxed">
                生图最多 {imageConcurrencyLimit} 路、生视频最多 {videoConcurrencyLimit} 路并发；进行中可终止，历史记录可删除；点击任务可跳转。
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
