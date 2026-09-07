// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input, Textarea } from '@/components/ui/input'
import {
  generateScriptFromIdea,
  hasScriptCreateLlmModel,
  resolveScriptCreateErrorMessage,
} from '@/lib/toolbox/script-create/generate'
import {
  loadScriptCreateDraft,
  saveScriptCreateDraft,
} from '@/lib/toolbox/script-create/draft-storage'
import { extractTitleFromScript, parseScriptPreview } from '@/lib/toolbox/script-create/parse-preview'
import {
  downloadTextFile,
  resolveWorkshopProjectTitle,
  sanitizeExportFileName,
  serializeScriptDraft,
  clampScriptText,
} from '@/lib/toolbox/script-create/serialize'
import {
  DEFAULT_SCRIPT_CREATE_PARAMS,
  SCRIPT_CONTENT_TYPE_OPTIONS,
  SCRIPT_DURATION_OPTIONS,
  SCRIPT_EPISODE_OPTIONS,
  SCRIPT_GENRE_OPTIONS,
  SCRIPT_IDEA_EXAMPLES,
  SCRIPT_PLATFORM_OPTIONS,
  buildParamsChipLabel,
  type ScriptCreateParams,
  type ScriptCreateUiStatus,
} from '@/lib/toolbox/script-create/types'
import { hasConfiguredDataRoot, readSettings } from '@/lib/storage/settings-service'
import { createWorkflowProject } from '@/lib/storage/workflow-service'
import { useSettingsStore } from '@/stores/settings-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import { SCRIPT_MAX_LENGTH } from '@/types/workflow'
import { cn } from '@/lib/utils'

interface ScriptCreateToolProps {
  onGeneratingChange?: (generating: boolean) => void
  onRequestCloseReady?: () => void
}

export function ScriptCreateTool({
  onGeneratingChange,
  onRequestCloseReady,
}: ScriptCreateToolProps) {
  const navigate = useNavigate()
  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.load)
  const sessionLoad = useWorkflowSessionStore((s) => s.load)
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const saveSession = useWorkflowSessionStore((s) => s.save)

  const [idea, setIdea] = useState('')
  const [title, setTitle] = useState('')
  const [script, setScript] = useState('')
  const [params, setParams] = useState<ScriptCreateParams>(DEFAULT_SCRIPT_CREATE_PARAMS)
  const [paramsOpen, setParamsOpen] = useState(false)
  const [status, setStatus] = useState<ScriptCreateUiStatus>('empty')
  const [errorMessage, setErrorMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)
  const scriptBeforeGenerateRef = useRef('')

  const hasModel = hasScriptCreateLlmModel(settings)
  const hasScript = script.trim().length > 0
  const preview = useMemo(() => (hasScript ? parseScriptPreview(script) : null), [hasScript, script])
  const chipLabel = useMemo(() => buildParamsChipLabel(params), [params])

  useEffect(() => {
    if (!settings) void loadSettings()
  }, [settings, loadSettings])

  useEffect(() => {
    const draft = loadScriptCreateDraft()
    if (draft) {
      setIdea(draft.idea)
      setTitle(draft.title)
      setScript(draft.script)
      setParams(draft.params)
      setStatus(draft.script.trim() ? 'result' : 'empty')
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const timer = window.setTimeout(() => {
      saveScriptCreateDraft({ idea, title, script, params })
    }, 400)
    return () => window.clearTimeout(timer)
  }, [hydrated, idea, title, script, params])

  useEffect(() => {
    onGeneratingChange?.(status === 'generating')
  }, [onGeneratingChange, status])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  const patchParams = useCallback(<K extends keyof ScriptCreateParams>(key: K, value: ScriptCreateParams[K]) => {
    setParams((prev) => ({ ...prev, [key]: value }))
  }, [])

  const runGenerate = useCallback(async () => {
    if (!idea.trim()) {
      toast.error('先写一句故事想法')
      return
    }
    if (!settings) {
      toast.error('设置加载中，请稍后再试')
      return
    }
    if (!hasScriptCreateLlmModel(settings)) {
      toast.error('请先配置对话模型')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    scriptBeforeGenerateRef.current = script
    setErrorMessage('')
    setStatus('generating')

    try {
      const next = await generateScriptFromIdea({
        idea,
        params,
        settings,
        signal: controller.signal,
      })
      if (controller.signal.aborted || !mountedRef.current) return

      const parsedTitle = extractTitleFromScript(next)
      setScript(next)
      if (parsedTitle) setTitle((prev) => prev.trim() || parsedTitle)
      setStatus('result')
      if (next.length >= SCRIPT_MAX_LENGTH) {
        toast.message(`剧本已截断至 ${SCRIPT_MAX_LENGTH} 字`)
      }
    } catch (error: unknown) {
      if (!mountedRef.current) return
      if (controller.signal.aborted) {
        setStatus(scriptBeforeGenerateRef.current.trim() ? 'result' : 'empty')
        toast.message('已取消')
        return
      }
      const message = resolveScriptCreateErrorMessage(error)
      setErrorMessage(message)
      setStatus(scriptBeforeGenerateRef.current.trim() ? 'result' : 'error')
      if (scriptBeforeGenerateRef.current.trim()) {
        setScript(scriptBeforeGenerateRef.current)
      }
      toast.error(message)
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [idea, params, script, settings])

  const handleGenerateClick = () => {
    void runGenerate()
  }

  const handleCancelGenerate = () => {
    abortRef.current?.abort()
  }

  const handleRegenClick = () => {
    if (hasScript) {
      setRegenConfirmOpen(true)
      return
    }
    void runGenerate()
  }

  const handleCopy = async () => {
    const text = serializeScriptDraft(script)
    if (!text) {
      toast.error('还没有剧本可复制')
      return
    }
    try {
      await navigator.clipboard.writeText(text)
      toast.success('已复制剧本')
    } catch {
      toast.error('复制失败')
    }
  }

  const handleExport = () => {
    const text = serializeScriptDraft(script)
    if (!text) {
      toast.error('还没有剧本可导出')
      return
    }
    const name = sanitizeExportFileName(title || extractTitleFromScript(text) || idea || '剧本')
    downloadTextFile(`${name}.txt`, text)
    toast.success('已导出 txt')
  }

  const handleScriptChange = (value: string) => {
    const { text, truncated } = clampScriptText(value)
    if (truncated) toast.error(`剧本最多 ${SCRIPT_MAX_LENGTH} 字`)
    setScript(text)
    if (text.trim()) setStatus('result')
    else setStatus('empty')
  }

  const handleSendToWorkshop = async () => {
    const text = serializeScriptDraft(script)
    if (!text) {
      toast.error('还没有剧本可送入，请先生成或粘贴')
      return
    }
    if (status === 'generating' || sending) return

    setSending(true)
    try {
      const settingsRes = await readSettings()
      if (!hasConfiguredDataRoot(settingsRes)) {
        toast.error('请先在设置中配置数据根目录')
        navigate('/settings')
        return
      }

      const projectTitle = resolveWorkshopProjectTitle({
        title,
        parsedTitle: extractTitleFromScript(text),
        idea,
      })
      const project = await createWorkflowProject({ title: projectTitle })
      const loaded = await sessionLoad(project.id)
      if (!loaded) {
        throw new Error('项目创建成功但加载失败，请到创作工坊打开')
      }
      patchData({ script: text })
      await saveSession({ silent: true })
      onRequestCloseReady?.()
      toast.success('剧本已就绪。下一步可在分集步骤继续制作。')
      navigate(`/workshop/${project.id}/step/1`)
    } catch (error: unknown) {
      const err = error as Error
      toast.error(err.message || '送入创作工坊失败')
    } finally {
      setSending(false)
    }
  }

  const showResult = hasScript || status === 'result'
  const showGenerating = status === 'generating'

  return (
    <div className="flex flex-col gap-4">
      {!hasModel ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="text-foreground/90">还没有可用的对话模型。请先到 设置 → 模型配置 中添加或启用模型。</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => navigate('/settings/models')}
          >
            去配置模型
          </Button>
        </div>
      ) : null}

      {showGenerating ? (
        <div className="rounded-xl border border-border/30 bg-muted/20 px-4 py-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            正在写分场剧本…
          </div>
          <p className="mt-1 text-sm text-muted-foreground">大约还要半分钟，你可以取消</p>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted/60" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
            <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
            <div className="h-16 animate-pulse rounded-lg bg-muted/40" />
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={handleCancelGenerate}>
            取消
          </Button>
        </div>
      ) : null}

      {!showGenerating ? (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">想拍一个什么故事？</label>
              <Textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                placeholder="例如：女主重生复仇，60 秒里要有三个反转"
                className="mt-2 min-h-[100px] resize-y"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setParamsOpen((v) => !v)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30',
                  'px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span>{chipLabel}</span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', paramsOpen && 'rotate-180')} />
                <span className="text-foreground/70">改条件</span>
              </button>
            </div>

            {paramsOpen ? (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border/30 bg-muted/10 p-3 sm:grid-cols-2">
                <ParamSelect
                  label="内容类型"
                  value={params.contentType}
                  options={SCRIPT_CONTENT_TYPE_OPTIONS}
                  onChange={(v) => patchParams('contentType', v)}
                />
                <ParamSelect
                  label="目标时长"
                  value={params.duration}
                  options={SCRIPT_DURATION_OPTIONS}
                  onChange={(v) => patchParams('duration', v)}
                />
                <ParamSelect
                  label="集数"
                  value={params.episodeCount}
                  options={SCRIPT_EPISODE_OPTIONS}
                  onChange={(v) => patchParams('episodeCount', v)}
                />
                <ParamSelect
                  label="叙事题材"
                  value={params.genre}
                  options={SCRIPT_GENRE_OPTIONS}
                  onChange={(v) => patchParams('genre', v)}
                />
                <ParamSelect
                  label="平台"
                  value={params.platform}
                  options={SCRIPT_PLATFORM_OPTIONS}
                  onChange={(v) => patchParams('platform', v)}
                />
              </div>
            ) : null}

            {!showResult ? (
              <>
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  disabled={!hasModel}
                  onClick={handleGenerateClick}
                >
                  <Sparkles className="h-4 w-4" />
                  生成剧本
                </Button>
                <p className="text-xs text-muted-foreground">
                  使用 AI 生成，大约 15～40 秒；按账号策略可能消耗额度
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">试试：</span>
                  {SCRIPT_IDEA_EXAMPLES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setIdea(item.idea)}
                      className="rounded-full border border-border/40 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          {status === 'error' && errorMessage && !hasScript ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
              <div className="mt-2">
                <Button type="button" size="sm" variant="outline" onClick={handleGenerateClick}>
                  重试
                </Button>
              </div>
            </div>
          ) : null}

          {showResult ? (
            <div className="space-y-3 border-t border-border/30 pt-4">
              {preview ? (
                <div className="rounded-xl border border-border/30 bg-muted/15 px-4 py-3">
                  <div className="text-sm font-semibold">{preview.title || title || '已生成剧本'}</div>
                  {preview.hook ? (
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{preview.hook}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {preview.durationHint ? (
                      <span className="rounded-full bg-muted/50 px-2 py-0.5">{preview.durationHint}</span>
                    ) : null}
                    <span className="rounded-full bg-muted/50 px-2 py-0.5">{preview.sceneTitles.length} 场</span>
                    <span className="rounded-full bg-muted/50 px-2 py-0.5">
                      {preview.characterNames.length} 个角色
                    </span>
                  </div>
                  {preview.sceneTitles.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {preview.sceneTitles.map((scene) => (
                        <li key={scene} className="truncate">
                          · {scene}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <div>
                <label className="text-sm font-medium">标题</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="送入工坊时作为项目名"
                  className="mt-1.5"
                />
              </div>

              <div>
                <label className="text-sm font-medium">剧本文本</label>
                <Textarea
                  value={script}
                  onChange={(e) => handleScriptChange(e.target.value)}
                  className="mt-1.5 min-h-[240px] resize-y font-mono text-[13px] leading-relaxed"
                />
                <div className="mt-1 text-right text-xs text-muted-foreground">
                  {script.length}/{SCRIPT_MAX_LENGTH}
                </div>
              </div>

              <div className="flex flex-col gap-2 border-t border-border/30 pt-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={handleRegenClick} disabled={!hasModel}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    再生成
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleExport}>
                    <Download className="h-3.5 w-3.5" />
                    导出
                  </Button>
                </div>
                <Button
                  type="button"
                  className="sm:min-w-[160px]"
                  disabled={sending || !hasScript}
                  onClick={() => void handleSendToWorkshop()}
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  送入创作工坊
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={regenConfirmOpen}
        title="重新生成将覆盖当前剧本"
        description="当前全文会被新结果替换。若已手动修改，请先复制保存。"
        confirmLabel="再生成"
        cancelLabel="取消"
        overlayClassName="z-[130]"
        contentClassName="z-[131]"
        onClose={() => setRegenConfirmOpen(false)}
        onConfirm={() => {
          setRegenConfirmOpen(false)
          void runGenerate()
        }}
      />
    </div>
  )
}

function ParamSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ id: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      <span className="mb-1 block">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="h-9 w-full rounded-xl border border-border/30 bg-background/40 px-2 text-sm text-foreground"
      >
        {options.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
          </option>
        ))}
      </select>
    </label>
  )
}



