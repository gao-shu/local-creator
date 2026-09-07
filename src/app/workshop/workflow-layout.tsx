import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Check, Loader2, Pencil, Save } from 'lucide-react'
import { toast } from 'sonner'
import { TaskStatusButton } from '@/components/dashboard/task-status-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ensureEpisodesWithScriptPreview } from '@/lib/workflow/episode-utils'
import { flushWorkflowSessionStep } from '@/lib/workflow/session-persist'
import { normalizeWorkflowStep, resolveMaxWorkflowStep } from '@/lib/workflow/step-utils'
import { useSettingsStore } from '@/stores/settings-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import type { WorkflowStep } from '@/types/workflow'
import { cn } from '@/lib/utils'

function parseStep(value: string | undefined): WorkflowStep {
  return normalizeWorkflowStep(value)
}

/** 每次 WorkflowLayout 挂载递增，用于区分 Strict Mode 伪卸载与真实离开 */
let layoutSessionSeq = 0

export function WorkflowLayout() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { projectId } = useParams()
  const stepMatch = pathname.match(/\/step\/(\d+)/)
  const step = parseStep(stepMatch?.[1])

  const meta = useWorkflowSessionStore((s) => s.meta)
  const data = useWorkflowSessionStore((s) => s.data)
  const loading = useWorkflowSessionStore((s) => s.loading)
  const save = useWorkflowSessionStore((s) => s.save)
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const renameTitle = useWorkflowSessionStore((s) => s.renameTitle)

  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.load)

  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [manualSavePhase, setManualSavePhase] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [loadFailed, setLoadFailed] = useState(false)
  const manualSaveTimerRef = useRef<number | null>(null)
  const reloadAttemptRef = useRef(0)
  const stepRef = useRef(step)
  stepRef.current = step

  useEffect(() => {
    if (!settings) loadSettings()
  }, [settings, loadSettings])

  useEffect(() => {
    return () => {
      if (manualSaveTimerRef.current != null) {
        window.clearTimeout(manualSaveTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!projectId) return
    setLoadFailed(false)
    reloadAttemptRef.current = 0
    const closedProjectId = projectId
    const sessionId = ++layoutSessionSeq

    void useWorkflowSessionStore.getState().load(closedProjectId).then((ok) => {
      if (!ok && sessionId === layoutSessionSeq) {
        setLoadFailed(true)
      }
    })

    return () => {
      const snapshot = useWorkflowSessionStore.getState()
      const shouldPersist =
        snapshot.projectId === closedProjectId && snapshot.data != null

      void (async () => {
        if (shouldPersist) {
          await flushWorkflowSessionStep(stepRef.current, { silent: true })
        }
        // 已有新挂载（Strict Mode / 切换项目）时，不要 reset 新会话
        if (sessionId !== layoutSessionSeq) return
        if (useWorkflowSessionStore.getState().projectId !== closedProjectId) return
        useWorkflowSessionStore.getState().reset()
      })()
    }
  }, [projectId])

  // 会话被误清空时（如竞态 reset）自动恢复，避免卡在「项目不存在」
  useEffect(() => {
    if (!projectId || loading || meta) return
    if (reloadAttemptRef.current >= 3) return
    reloadAttemptRef.current += 1
    setLoadFailed(false)
    void useWorkflowSessionStore.getState().load(projectId).then((ok) => {
      if (!ok) setLoadFailed(true)
    })
  }, [projectId, loading, meta])

  useEffect(() => {
    if (meta) setTitleDraft(meta.title)
  }, [meta])

  useEffect(() => {
    if (!data || step < 2) return
    const nextEpisodes = ensureEpisodesWithScriptPreview(data)
    if (nextEpisodes !== data.episodes) {
      patchData({ episodes: nextEpisodes })
    }
  }, [data?.script, data?.episodes?.length, data, patchData, step])

  useEffect(() => {
    if (!data || loading) return
    if (data.currentStep === step) return
    patchData({ currentStep: step })
  }, [data, loading, patchData, step])

  useEffect(() => {
    const handleBeforeUnload = () => {
      void flushWorkflowSessionStep(stepRef.current, { silent: true })
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const maxStep = resolveMaxWorkflowStep(meta, data)

  const commitTitle = useCallback(async () => {
    setEditingTitle(false)
    await renameTitle(titleDraft)
  }, [renameTitle, titleDraft])

  const handleManualSave = useCallback(async () => {
    if (!projectId || !data) {
      toast.error('项目数据加载中，请稍后再试')
      return
    }

    if (manualSaveTimerRef.current != null) {
      window.clearTimeout(manualSaveTimerRef.current)
      manualSaveTimerRef.current = null
    }

    setManualSavePhase('saving')
    try {
      if (data.currentStep !== step) {
        patchData({ currentStep: step })
      }

      const ok = await save({ silent: true })
      if (ok) {
        setManualSavePhase('saved')
        toast.success('保存成功')
        manualSaveTimerRef.current = window.setTimeout(() => {
          setManualSavePhase('idle')
          manualSaveTimerRef.current = null
        }, 2000)
      } else {
        setManualSavePhase('idle')
        const message =
          useWorkflowSessionStore.getState().lastSaveError ||
          '保存失败，请检查系统设置中的存储目录'
        toast.error(message)
      }
    } catch {
      setManualSavePhase('idle')
      toast.error('保存失败，请稍后重试')
    }
  }, [data, patchData, projectId, save, step])

  const handleRetryLoad = useCallback(() => {
    if (!projectId) return
    reloadAttemptRef.current = 0
    setLoadFailed(false)
    void useWorkflowSessionStore.getState().load(projectId).then((ok) => {
      if (!ok) setLoadFailed(true)
    })
  }, [projectId])

  if (!projectId) {
    return <Navigate to="/dashboard" replace />
  }

  if (loading || !meta || !data) {
    if (!loading && loadFailed && reloadAttemptRef.current >= 3) {
      return (
        <div className="py-24 text-center space-y-4">
          <p className="text-muted-foreground text-sm">项目加载失败，请检查存储目录或项目是否已被删除</p>
          <div className="flex items-center justify-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleRetryLoad}>
              重新加载
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
              返回首页
            </Button>
          </div>
        </div>
      )
    }
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        加载项目...
      </div>
    )
  }

  if (step > maxStep) {
    return <Navigate to={`/workshop/${projectId}/step/${maxStep}`} replace />
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-2 flex items-center justify-between gap-3 min-w-0 shrink-0">
        {editingTitle ? (
          <Input
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => commitTitle()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTitle()
              if (e.key === 'Escape') {
                setTitleDraft(meta.title)
                setEditingTitle(false)
              }
            }}
            className="text-xl font-semibold h-10 border-transparent bg-transparent focus-visible:ring-1 max-w-md"
            autoFocus
          />
        ) : (
          <div className="group flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              data-testid="workshop-project-title"
              className="flex items-center gap-2 min-w-0 text-left"
            >
              <h1 className="text-xl font-semibold truncate">{meta.title}</h1>
              <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0">
          <TaskStatusButton
            panelAnchorClassName="top-14 right-3"
            buttonClassName="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/40 p-0"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="workshop-manual-save"
            onClick={() => void handleManualSave()}
            disabled={manualSavePhase === 'saving'}
            className={cn(
              manualSavePhase === 'saved' &&
                'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
            )}
          >
            {manualSavePhase === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : manualSavePhase === 'saved' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {manualSavePhase === 'saving'
              ? '保存中…'
              : manualSavePhase === 'saved'
                ? '已保存'
                : '手动保存'}
          </Button>
        </div>
      </div>

      <div className={cn('flex-1 min-h-0')}>
        <Outlet />
      </div>
    </div>
  )
}
