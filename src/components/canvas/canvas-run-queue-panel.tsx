// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'
import { Loader2, X, XCircle, CheckCircle2, CircleDashed } from 'lucide-react'
import { useReactFlow } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { countCanvasNodeStats } from '@/lib/canvas/canvas-cover-utils'
import type { CanvasNodeStatus } from '@/types/canvas-nodes'
import { readCanvasTasks } from '@/lib/storage/canvas-service'
import {
  getActiveCanvasPromptExtractTask,
  getActiveCanvasPromptStoryboardTask,
} from '@/lib/canvas/canvas-prompt-ai-task-service'
import {
  buildCanvasRunQueueRows,
  formatCanvasRunQueueTime,
  reconcileStaleCanvasRunHistory,
  applyCanvasRunHistoryNodeSync,
  type CanvasRunQueueRow,
} from '@/lib/canvas/canvas-run-history-service'
import { useTaskStore } from '@/stores/task-store'

function StatusIcon({ status }: { status?: CanvasNodeStatus }) {
  if (status === 'running') return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
  if (status === 'success') return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  if (status === 'error') return <XCircle className="h-3.5 w-3.5 text-destructive" />
  return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
}

export function CanvasRunQueuePanel({ onClose }: { onClose?: () => void }) {
  const { nodes, projectId, promptAiBusy, cancelPromptAi, setNodes, releaseNodeRunSession } =
    useCanvasEditor()
  const { setCenter, getNode } = useReactFlow()
  const taskStoreTick = useTaskStore((s) => s.entries)
  const [promptAiTaskMessage, setPromptAiTaskMessage] = useState('')
  const [cancellingPromptAi, setCancellingPromptAi] = useState(false)
  const [queueRows, setQueueRows] = useState<CanvasRunQueueRow[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const historyResult = await reconcileStaleCanvasRunHistory(projectId, nodes)
        if (cancelled) return
        const syncedGraph = applyCanvasRunHistoryNodeSync(nodes, historyResult.syncedNodes)
        if (historyResult.syncedNodes.length) {
          for (const item of historyResult.syncedNodes) {
            releaseNodeRunSession(item.nodeId)
          }
          setNodes(syncedGraph)
        }
        const tasks = await readCanvasTasks(projectId)
        if (cancelled) return
        const extract = getActiveCanvasPromptExtractTask(tasks, projectId)
        const storyboard = getActiveCanvasPromptStoryboardTask(tasks, projectId)
        const active = extract ?? storyboard
        setPromptAiTaskMessage(active?.progressMessage?.trim() || '')
        setQueueRows(buildCanvasRunQueueRows(syncedGraph, tasks))
      } catch {
        if (!cancelled) {
          setPromptAiTaskMessage('')
          setQueueRows(buildCanvasRunQueueRows(nodes, []))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projectId, promptAiBusy, nodes, taskStoreTick, setNodes, releaseNodeRunSession])

  useEffect(() => {
    if (!promptAiBusy) setCancellingPromptAi(false)
  }, [promptAiBusy])

  const stats = countCanvasNodeStats(nodes)
  const focusNode = (nodeId: string) => {
    const node = getNode(nodeId)
    if (!node) return
    const width =
      typeof node.measured?.width === 'number'
        ? node.measured.width
        : typeof node.width === 'number'
          ? node.width
          : 280
    const height =
      typeof node.measured?.height === 'number'
        ? node.measured.height
        : typeof node.height === 'number'
          ? node.height
          : 200
    setCenter(node.position.x + width / 2, node.position.y + height / 2, {
      zoom: 0.85,
      duration: 300,
    })
  }

  const handleCancelPromptAi = async () => {
    if (cancellingPromptAi) return
    setCancellingPromptAi(true)
    try {
      await cancelPromptAi()
    } finally {
      setCancellingPromptAi(false)
    }
  }

  const promptAiLabel =
    promptAiBusy?.kind === 'extract'
      ? '提取资产'
      : promptAiBusy?.kind === 'templateImport'
        ? '导入分镜稿'
        : '智能分镜'
  const promptAiCancelLabel =
    promptAiBusy?.kind === 'extract'
      ? '取消提取资产'
      : promptAiBusy?.kind === 'templateImport'
        ? '取消导入分镜稿'
        : '取消智能分镜'

  const empty = queueRows.length === 0 && !promptAiBusy

  return (
    <aside
      className={cn(
        'flex w-[272px] shrink-0 flex-col overflow-hidden',
        'border-l border-border/25 bg-card/35 backdrop-blur-md',
      )}
    >
      <div className="flex items-start justify-between gap-2 px-3 py-3 border-b border-border/20">
        <div>
          <h3 className="text-sm font-semibold">运行队列</h3>
          <p className="text-[11px] text-muted-foreground mt-1">
            {stats.success}/{stats.runnable} 完成
            {stats.error ? ` · ${stats.error} 失败` : ''}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="关闭运行队列"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {promptAiBusy ? (
          <div
            data-testid="canvas-run-queue-prompt-ai"
            className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-2.5 py-2"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{promptAiLabel}</p>
                {promptAiTaskMessage ? (
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {promptAiTaskMessage}
                  </p>
                ) : null}
              </div>
              {promptAiBusy.kind !== 'templateImport' ? (
                <button
                  type="button"
                  data-testid="canvas-run-queue-cancel-prompt-ai"
                  title={promptAiCancelLabel}
                  aria-label={promptAiCancelLabel}
                  disabled={cancellingPromptAi}
                  onClick={() => void handleCancelPromptAi()}
                  className={cn(
                    'shrink-0 rounded-md px-2 py-1 text-[11px] font-medium',
                    'border border-amber-400/40 text-amber-100/90',
                    'hover:bg-amber-500/15 disabled:opacity-50',
                  )}
                >
                  {cancellingPromptAi ? '取消中…' : '取消'}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {empty ? (
          <p className="text-xs text-muted-foreground px-2 py-4 text-center">暂无运行记录</p>
        ) : (
          queueRows.map((row) => (
            <div
              key={row.key}
              className={cn(
                'rounded-xl border border-border/30 px-2.5 py-2',
                'bg-background/40 hover:bg-muted/30 transition-colors',
              )}
            >
              <button
                type="button"
                onClick={() => focusNode(row.nodeId)}
                className="flex w-full min-w-0 items-center gap-2 text-left"
              >
                <StatusIcon status={row.status} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  <span className="tabular-nums text-muted-foreground">
                    {formatCanvasRunQueueTime(row.activityAt)}
                  </span>
                  <span className="mx-1.5 text-muted-foreground/50">·</span>
                  <span>{row.label}</span>
                </span>
              </button>
              {row.error ? (
                <p className="mt-1 line-clamp-2 pl-5 text-[10px] text-destructive">{row.error}</p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
