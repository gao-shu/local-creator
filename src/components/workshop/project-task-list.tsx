import { useMemo, useState } from 'react'
import { CheckCircle2, Loader2, Trash2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  TASK_STATUS_LABEL,
  TASK_TYPE_LABEL,
  formatTaskEpisodeLabel,
  formatTaskTime,
  isActiveTaskStatus,
} from '@/lib/workflow/task-service'
import { isLocalPlaceholderTaskId } from '@/lib/workflow/step4-task-sync'
import type { WorkflowTask, WorkflowTaskStatus } from '@/types/workflow'

type TaskStatusFilterKey = 'all' | 'active' | 'completed' | 'failed'

const TASK_STATUS_FILTERS: Array<{ key: TaskStatusFilterKey; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '成功' },
  { key: 'failed', label: '失败' },
]

function filterTasks(tasks: WorkflowTask[], filter: TaskStatusFilterKey): WorkflowTask[] {
  if (filter === 'all') return tasks
  if (filter === 'active') return tasks.filter((task) => isActiveTaskStatus(task.status))
  return tasks.filter((task) => task.status === filter)
}

function countTasksByFilter(tasks: WorkflowTask[]): Record<TaskStatusFilterKey, number> {
  return {
    all: tasks.length,
    active: tasks.filter((task) => isActiveTaskStatus(task.status)).length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    failed: tasks.filter((task) => task.status === 'failed').length,
  }
}

function StatusIcon({ status }: { status: WorkflowTaskStatus }) {
  if (status === 'running' || status === 'pending') {
    return <Loader2 className="h-3.5 w-3.5 text-violet-400 animate-spin shrink-0" />
  }
  if (status === 'completed') {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
  }
  return <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
}

interface ProjectTaskListProps {
  tasks: WorkflowTask[]
  loading?: boolean
  emptyHint?: string
  className?: string
  onCancelTask?: (taskId: string) => void
  onDeleteTask?: (taskId: string) => void
  cancellingTaskId?: string | null
  deletingTaskId?: string | null
}

export function ProjectTaskList({
  tasks,
  loading = false,
  emptyHint = '暂无任务记录',
  className,
  onCancelTask,
  onDeleteTask,
  cancellingTaskId = null,
  deletingTaskId = null,
}: ProjectTaskListProps) {
  const [filter, setFilter] = useState<TaskStatusFilterKey>('all')
  const sorted = useMemo(
    () =>
      [...tasks].sort(
        (a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
      ),
    [tasks],
  )
  const counts = useMemo(() => countTasksByFilter(sorted), [sorted])
  const filtered = useMemo(() => filterTasks(sorted, filter), [sorted, filter])
  const activeFilterLabel = TASK_STATUS_FILTERS.find((item) => item.key === filter)?.label

  if (sorted.length === 0) {
    return (
      <div className={cn('text-xs text-muted-foreground text-center py-12 leading-relaxed', className)}>
        <p>{emptyHint}</p>
        {loading ? (
          <p className="mt-3 inline-flex items-center justify-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            同步任务中…
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="flex items-center justify-between gap-2 mb-2 px-0.5">
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span>任务历史</span>
          {loading ? <Loader2 className="h-3 w-3 animate-spin shrink-0" /> : null}
        </p>
        <span className="text-[10px] text-muted-foreground/80">共 {sorted.length} 条</span>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2 px-0.5">
        {TASK_STATUS_FILTERS.map((item) => {
          const selected = filter === item.key
          const count = counts[item.key]
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] transition-colors',
                selected
                  ? 'border-cyan-500/45 bg-cyan-500/10 text-cyan-300'
                  : 'border-border/30 text-muted-foreground hover:border-border/50 hover:text-foreground',
              )}
            >
              <span>{item.label}</span>
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

      {filtered.length === 0 ? (
        <div className="text-xs text-muted-foreground text-center py-10 leading-relaxed">
          暂无{filter === 'all' ? '' : activeFilterLabel}任务
        </div>
      ) : (
      <ul className="space-y-1.5 overflow-y-auto min-h-0 flex-1 pr-0.5">
        {filtered.map((task) => {
          const episodeLabel = formatTaskEpisodeLabel(task)
          const canCancel =
            Boolean(onCancelTask) &&
            isActiveTaskStatus(task.status) &&
            !isLocalPlaceholderTaskId(task.id)
          const canDelete = Boolean(onDeleteTask) && !isLocalPlaceholderTaskId(task.id)
          const cancelling = cancellingTaskId === task.id
          const deleting = deletingTaskId === task.id
          const actionBusy = cancelling || deleting
          return (
            <li
              key={task.id}
              className={cn(
                'rounded-xl border px-3 py-2.5',
                isActiveTaskStatus(task.status)
                  ? 'border-violet-500/25 bg-violet-500/5'
                  : 'border-border/20 bg-card/50',
              )}
            >
              <div className="flex items-start gap-2">
                <StatusIcon status={task.status} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium truncate">{TASK_TYPE_LABEL[task.type]}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {canCancel ? (
                        <button
                          type="button"
                          disabled={actionBusy}
                          onClick={() => onCancelTask?.(task.id)}
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
                          onClick={() => onDeleteTask?.(task.id)}
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
                        {TASK_STATUS_LABEL[task.status]}
                      </span>
                    </div>
                  </div>
                  {episodeLabel ? (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{episodeLabel}</p>
                  ) : null}
                  {task.progressMessage ? (
                    <p className="text-[11px] text-muted-foreground/90 mt-1 line-clamp-2">
                      {task.progressMessage}
                    </p>
                  ) : null}
                  {task.errorMessage ? (
                    <p className="mt-1 cursor-text select-text break-words text-[11px] leading-relaxed text-red-400/90">
                      {task.errorMessage}
                    </p>
                  ) : null}
                  <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                    {formatTaskTime(task.updatedAt ?? task.createdAt)}
                  </p>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      )}
    </div>
  )
}
