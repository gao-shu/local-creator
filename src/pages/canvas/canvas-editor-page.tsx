// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Film, LayoutList, Loader2, Maximize2, MessageCircleMore, Minimize2, SlidersHorizontal, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { CanvasEditorTitleField } from '@/components/canvas/canvas-editor-title-field'
import { CanvasWorkflow } from '@/components/canvas/canvas-workflow'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { DOUBAO_WEB_PANEL_BUTTON_TITLE, DOUBAO_WEB_PANEL_LABEL } from '@/constants/doubao-web-panel'
import {
  getCanvasProject,
  isCanvasApiAvailable,
  persistCanvasDataMerged,
  readCanvasData,
  seedDevCanvasPreview,
} from '@/lib/storage/canvas-service'
import { useElementFullscreen } from '@/hooks/use-element-fullscreen'
import { useSettingsStore } from '@/stores/settings-store'
import { resolveCanvasStoryboardTemplateKey } from '@/lib/workflow/storyboard-prompt'
import { useCanvasProjectStore } from '@/stores/canvas-project-store'
import type { CanvasProjectData, CanvasProjectMeta } from '@/types/canvas'
import { parseCanvasAgentSkillQuery } from '@/lib/toolbox/skills-pool'
import { cn } from '@/lib/utils'

function CanvasHeaderIconButton({
  title,
  active,
  onClick,
  children,
}: {
  title: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border transition-colors',
        active
          ? 'border-primary/35 bg-primary/15 text-primary'
          : 'border-border/35 bg-card/50 text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function CanvasHeaderThemeButton() {
  return (
    <AnimatedThemeToggler
      className={cn(
        'h-8 w-8 rounded-xl border border-border/35 bg-card/50 p-0',
        'text-violet-500 hover:bg-violet-500/10 hover:text-violet-600',
        'dark:text-violet-300 dark:hover:bg-violet-400/10 dark:hover:text-violet-200',
        'transition-colors',
      )}
    />
  )
}

function CanvasHeaderDialogueButton({
  active,
  onClick,
}: {
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid="canvas-header-agent"
      title="对话"
      aria-label="对话"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3',
        'border text-xs font-medium transition-colors',
        active
          ? 'border-primary/35 bg-primary/15 text-primary'
          : 'border-border/25 bg-[#ececee] text-[#374151] hover:bg-white dark:border-border/35 dark:bg-muted/70 dark:text-foreground/90 dark:hover:bg-muted',
      )}
    >
      <MessageCircleMore className="h-3.5 w-3.5" strokeWidth={2} />
      对话
    </button>
  )
}

function CanvasHeaderParamsButton({
  active,
  onClick,
}: {
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid="canvas-header-params"
      title="参数设置"
      aria-label="参数设置"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3',
        'border text-xs font-medium transition-colors',
        active
          ? 'border-cyan-500/40 bg-cyan-500/12 text-cyan-700 dark:text-cyan-200'
          : 'border-border/25 bg-[#ececee] text-[#374151] hover:bg-white dark:border-border/35 dark:bg-muted/70 dark:text-foreground/90 dark:hover:bg-muted',
      )}
    >
      <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
      参数设置
    </button>
  )
}

/** 阶段 3.2：顶栏仅「豆包」网页入口；右侧布局壳见 3.3 */
function CanvasHeaderDoubaoButton({
  active,
  disabled,
  onClick,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid="canvas-doubao-web-toggle"
      title={DOUBAO_WEB_PANEL_BUTTON_TITLE}
      aria-label={DOUBAO_WEB_PANEL_BUTTON_TITLE}
      aria-pressed={Boolean(active)}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3',
        'border text-xs font-medium transition-colors',
        active
          ? 'border-sky-500/45 bg-sky-500/12 text-sky-700 dark:text-sky-200'
          : 'border-border/25 bg-[#ececee] text-[#374151] hover:bg-white dark:border-border/35 dark:bg-muted/70 dark:text-foreground/90 dark:hover:bg-muted',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
      {DOUBAO_WEB_PANEL_LABEL}
    </button>
  )
}

function CanvasHeaderQueueButton({
  active,
  onClick,
}: {
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-testid="canvas-header-queue"
      title="运行队列"
      aria-label="运行队列"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3',
        'border text-xs font-medium transition-colors',
        active
          ? 'border-amber-500/40 bg-amber-500/12 text-amber-700 dark:text-amber-200'
          : 'border-border/25 bg-[#ececee] text-[#374151] hover:bg-white dark:border-border/35 dark:bg-muted/70 dark:text-foreground/90 dark:hover:bg-muted',
      )}
    >
      <LayoutList className="h-3.5 w-3.5" strokeWidth={2} />
      队列
    </button>
  )
}

export function CanvasEditorPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const pendingAgentSkill = useMemo(
    () => parseCanvasAgentSkillQuery(searchParams.get('agentSkill')),
    [searchParams],
  )
  const settings = useSettingsStore((state) => state.settings)
  const loadSettings = useSettingsStore((state) => state.load)
  const rememberLastUsedCanvasStoryboardTemplateKey = useSettingsStore(
    (state) => state.rememberLastUsedCanvasStoryboardTemplateKey,
  )
  const setActiveEditorMeta = useCanvasProjectStore((s) => s.setActiveEditorMeta)
  const activeEditorMeta = useCanvasProjectStore((s) => s.activeEditorMeta)
  const [meta, setMeta] = useState<CanvasProjectMeta | null>(null)
  const [data, setData] = useState<CanvasProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [agentOpen, setAgentOpen] = useState(false)
  const [paramsOpen, setParamsOpen] = useState(false)
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [doubaoOpen, setDoubaoOpen] = useState(false)
  const { ref: fullscreenRef, active: fullscreen, toggle: toggleFullscreen } =
    useElementFullscreen<HTMLDivElement>()

  useEffect(() => {
    if (!settings) void loadSettings()
  }, [loadSettings, settings])

  /** 旧 settings 若存了空壳分镜模板 key，进入画布时写回可用 key（与 Step4 项目字段迁移一致） */
  useEffect(() => {
    if (!settings) return
    const resolved = resolveCanvasStoryboardTemplateKey(settings)
    const stored = settings.lastUsedCanvasStoryboardTemplateKey?.trim()
    if (stored !== resolved) {
      rememberLastUsedCanvasStoryboardTemplateKey(resolved)
    }
  }, [rememberLastUsedCanvasStoryboardTemplateKey, settings])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      if (!projectId) {
        setError('无效的项目 ID')
        setLoading(false)
        return
      }

      setLoading(true)
      setError('')
      try {
        if (!isCanvasApiAvailable()) {
          const preview = seedDevCanvasPreview(projectId)
          const nextData = await readCanvasData(projectId)
          if (!cancelled) {
            setMeta(preview.meta)
            setData(nextData)
            setActiveEditorMeta(preview.meta)
          }
          return
        }

        const [rawMeta, nextData] = await Promise.all([
          getCanvasProject(projectId),
          readCanvasData(projectId),
        ])
        if (!cancelled) {
          setMeta(rawMeta)
          setData(nextData)
          setActiveEditorMeta(rawMeta)
        }
      } catch (err: unknown) {
        const e = err as Error
        if (!cancelled) setError(e.message || '加载失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [projectId, setActiveEditorMeta])

  useEffect(() => {
    return () => setActiveEditorMeta(null)
  }, [setActiveEditorMeta])

  useEffect(() => {
    const api = window.doubaoWebPanelAPI
    if (!api) return
    void api.getState().then((res) => {
      if (res.success) setDoubaoOpen(res.open)
    })
    return () => {
      void api.close().finally(() => setDoubaoOpen(false))
    }
  }, [])

  const toggleDoubaoOpen = useCallback(async () => {
    const api = window.doubaoWebPanelAPI
    if (!api) {
      toast.error('豆包侧栏仅桌面客户端可用，请用 Electron 启动应用')
      return
    }
    if (doubaoOpen) {
      const res = await api.close()
      if (!res.success) {
        toast.error(res.error || '关闭豆包侧栏失败')
        return
      }
      setDoubaoOpen(false)
      return
    }
    // 先展开侧栏壳并推 bounds，再挂 BrowserView；避免等 doubao.com 加载完才有 UI 反馈
    setDoubaoOpen(true)
    setAgentOpen(false)
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    const res = await api.open()
    if (!res.success) {
      setDoubaoOpen(false)
      void api.close()
      toast.error(res.error || '打开豆包侧栏失败，可稍后重试或用侧栏「浏览器打开」')
    }
  }, [doubaoOpen])

  const displayMeta =
    activeEditorMeta?.id === projectId ? activeEditorMeta : meta

  const handlePersist = useCallback(
    async (next: CanvasProjectData) => {
      if (!projectId) return
      setSaving(true)
      try {
        await persistCanvasDataMerged(projectId, next)
      } catch (err: unknown) {
        const e = err as Error
        setError(e.message || '保存失败')
      } finally {
        setSaving(false)
      }
    },
    [projectId],
  )

  const closeDoubaoForPeerPanel = useCallback(() => {
    setDoubaoOpen(false)
    void window.doubaoWebPanelAPI?.close()
  }, [])

  const toggleAgentOpen = useCallback(() => {
    setAgentOpen((open) => {
      if (!open) {
        setParamsOpen(false)
        setQueueOpen(false)
        // 3.4：开 Agent → 收起豆包网页
        setDoubaoOpen(false)
        void window.doubaoWebPanelAPI?.close()
      }
      return !open
    })
  }, [])

  const handleAgentOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        setParamsOpen(false)
        setQueueOpen(false)
        closeDoubaoForPeerPanel()
      }
      setAgentOpen(open)
    },
    [closeDoubaoForPeerPanel],
  )

  const clearPendingAgentSkill = useCallback(() => {
    if (!searchParams.has('agentSkill')) return
    const next = new URLSearchParams(searchParams)
    next.delete('agentSkill')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const toggleParamsOpen = useCallback(() => {
    setParamsOpen((open) => {
      if (!open) {
        setAgentOpen(false)
        setQueueOpen(false)
      }
      return !open
    })
  }, [])

  const toggleQueueOpen = useCallback(() => {
    setQueueOpen((open) => {
      if (!open) {
        setAgentOpen(false)
        setParamsOpen(false)
      }
      return !open
    })
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        加载画布…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-16 text-center">
        <p className="text-destructive">{error || '画布数据不可用'}</p>
        <button
          type="button"
          onClick={() => navigate('/canvas')}
          className="inline-flex items-center gap-2 rounded-xl border border-border/40 px-4 py-2 text-sm hover:bg-muted/40"
        >
          <ArrowLeft className="h-4 w-4" />
          返回列表
        </button>
      </div>
    )
  }

  return (
    <div
      ref={fullscreenRef}
      data-testid="canvas-editor-shell"
      className={cn(
        'relative flex h-full min-h-0 flex-col',
        fullscreen && 'bg-[var(--canvas-workflow-bg)] p-2',
      )}
    >
      {fullscreen ? (
        <div className="pointer-events-none absolute right-4 top-4 z-30 flex items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-2">
            <CanvasHeaderIconButton
              title="退出全屏"
              onClick={() => void toggleFullscreen()}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </CanvasHeaderIconButton>
            <CanvasHeaderThemeButton />
            <CanvasHeaderDoubaoButton
              active={doubaoOpen}
              onClick={() => void toggleDoubaoOpen()}
            />
            <CanvasHeaderParamsButton
              active={paramsOpen}
              onClick={toggleParamsOpen}
            />
            <CanvasHeaderQueueButton active={queueOpen} onClick={toggleQueueOpen} />
            <CanvasHeaderDialogueButton
              active={agentOpen}
              onClick={toggleAgentOpen}
            />
          </div>
        </div>
      ) : (
        <div className="mb-2 flex shrink-0 items-center gap-2 min-w-0">
          <button
            type="button"
          onClick={() => navigate('/canvas')}
          className="group flex shrink-0 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          返回
        </button>
          <CanvasEditorTitleField projectId={projectId} />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              title="导出成片（含剪映草稿与预检）"
              aria-label="导出成片"
              data-testid="canvas-export"
              onClick={() => setExportDialogOpen(true)}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3',
                'border border-violet-500/30 bg-violet-500/10 text-violet-700',
                'text-xs font-medium transition-colors hover:bg-violet-500/15',
                'dark:text-violet-200',
              )}
            >
              <Film className="h-3.5 w-3.5" strokeWidth={2} />
              导出
            </button>
            <CanvasHeaderIconButton
              title="全屏"
              onClick={() => void toggleFullscreen()}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </CanvasHeaderIconButton>
            <CanvasHeaderThemeButton />
            <CanvasHeaderDoubaoButton
              active={doubaoOpen}
              onClick={() => void toggleDoubaoOpen()}
            />
            <CanvasHeaderParamsButton
              active={paramsOpen}
              onClick={toggleParamsOpen}
            />
            <CanvasHeaderQueueButton active={queueOpen} onClick={toggleQueueOpen} />
            <CanvasHeaderDialogueButton
              active={agentOpen}
              onClick={toggleAgentOpen}
            />
          </div>
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <CanvasWorkflow
          key={projectId}
          projectId={projectId}
          initialData={data}
          onPersist={handlePersist}
          saving={saving}
          exportDialogOpen={exportDialogOpen}
          onExportDialogOpenChange={setExportDialogOpen}
          agentOpen={agentOpen}
          onAgentOpenChange={handleAgentOpenChange}
          pendingAgentSkill={pendingAgentSkill}
          onPendingAgentSkillConsumed={clearPendingAgentSkill}
          doubaoOpen={doubaoOpen}
          onDoubaoOpenChange={setDoubaoOpen}
          paramsOpen={paramsOpen}
          onParamsOpenChange={setParamsOpen}
          queueOpen={queueOpen}
          onQueueOpenChange={setQueueOpen}
          canvasMeta={displayMeta}
        />
      </div>
    </div>
  )
}
