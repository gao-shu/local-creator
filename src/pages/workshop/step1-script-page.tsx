import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileText, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Textarea } from '@/components/ui/input'
import {
  extractScriptTextFromFile,
  supportedScriptFormatsLabel,
} from '@/lib/script/script-file-import'
import { WORKSHOP_AUTO_SAVE_INTERVAL_MS } from '@/constants/batch-concurrency'
import { ensureEpisodesWithScriptPreview } from '@/lib/workflow/episode-utils'
import {
  DEFAULT_PROJECT_STYLE_PRESET_KEY,
  resolveProjectStylePresetKey,
} from '@/lib/workflow/project-visual-style'
import { ProjectVisualStyleField } from '@/components/workshop/project-visual-style-field'
import { useSettingsStore } from '@/stores/settings-store'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import { SCRIPT_MAX_LENGTH } from '@/types/workflow'
import { cn } from '@/lib/utils'

const ACCEPT = '.txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export function Step1ScriptPage() {
  const navigate = useNavigate()
  const projectId = useWorkflowSessionStore((s) => s.projectId)
  const data = useWorkflowSessionStore((s) => s.data)
  const dirty = useWorkflowSessionStore((s) => s.dirty)
  const patchData = useWorkflowSessionStore((s) => s.patchData)
  const save = useWorkflowSessionStore((s) => s.save)

  const settings = useSettingsStore((s) => s.settings)
  const loadSettings = useSettingsStore((s) => s.load)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [replaceConfirmOpen, setReplaceConfirmOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)

  useEffect(() => {
    if (!settings) loadSettings()
  }, [settings, loadSettings])

  const script = data?.script ?? ''
  const charCount = script.length
  const projectStylePresetKey = resolveProjectStylePresetKey(data, settings)

  useEffect(() => {
    if (!data || data.projectStylePresetKey) return
    patchData({ projectStylePresetKey: DEFAULT_PROJECT_STYLE_PRESET_KEY })
  }, [data, patchData])

  useEffect(() => {
    if (!dirty) return

    const timer = window.setTimeout(() => {
      save({ silent: true })
    }, WORKSHOP_AUTO_SAVE_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [dirty, script, save])

  const applyScript = useCallback(
    (value: string, source?: string) => {
      if (value.length > SCRIPT_MAX_LENGTH) {
        toast.error(`剧本最多 ${SCRIPT_MAX_LENGTH} 字，已截断导入内容`)
        patchData({ script: value.slice(0, SCRIPT_MAX_LENGTH) })
        return
      }
      patchData({ script: value })
      if (source) toast.success(`已导入：${source}`)
    },
    [patchData],
  )

  const handleScriptChange = (value: string) => {
    if (value.length > SCRIPT_MAX_LENGTH) {
      toast.error(`剧本最多 ${SCRIPT_MAX_LENGTH} 字`)
      return
    }
    patchData({ script: value })
  }

  const runImport = useCallback(
    async (file: File) => {
      setImporting(true)
      try {
        const text = await extractScriptTextFromFile(file)
        if (!text) {
          toast.error('文件内容为空')
          return
        }
        applyScript(text, file.name)
      } catch (error: unknown) {
        const err = error as Error
        toast.error(err.message || '导入失败')
      } finally {
        setImporting(false)
      }
    },
    [applyScript],
  )

  const importFile = useCallback(
    async (file: File) => {
      if (importing) return

      if (script.trim()) {
        setPendingFile(file)
        setReplaceConfirmOpen(true)
        return
      }

      await runImport(file)
    },
    [importing, runImport, script],
  )

  const handleReplaceConfirm = () => {
    const file = pendingFile
    setReplaceConfirmOpen(false)
    setPendingFile(null)
    if (file) void runImport(file)
  }

  const handleReplaceCancel = () => {
    setReplaceConfirmOpen(false)
    setPendingFile(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) void importFile(file)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!importing) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    if (importing) return

    const file = e.dataTransfer.files?.[0]
    if (!file) return
    void importFile(file)
  }

  if (!data) return null

  const handleNextStep = async () => {
    if (!projectId || !data) return
    const nextEpisodes = ensureEpisodesWithScriptPreview(data)
    patchData({ currentStep: 2, episodes: nextEpisodes })
    await save({ silent: true })
    navigate(`/workshop/${projectId}/step/2`)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mx-auto w-full max-w-4xl pt-1 space-y-4">
        <ProjectVisualStyleField
          settings={settings}
          presetKey={projectStylePresetKey}
          onApply={(patch) => patchData(patch)}
        />

        <div
          className={cn(
            'relative flex flex-col rounded-xl border transition-colors',
            dragging
              ? 'border-primary/50 bg-primary/5 ring-2 ring-primary/20'
              : 'border-border/55 bg-card/45',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragging ? (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-primary/5">
              <Upload className="h-8 w-8 text-primary/70" />
              <p className="text-sm font-medium text-primary/80">松开即可导入文件</p>
            </div>
          ) : null}

          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/25 px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground/80">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              <span>支持拖拽 {supportedScriptFormatsLabel()} 到编辑区</span>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              disabled={importing}
              data-testid="workshop-step1-import"
              onClick={() => fileInputRef.current?.click()}
            >
              {importing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              导入文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              data-testid="workshop-step1-import-input"
              onChange={handleFileChange}
            />
          </div>

          <Textarea
            value={script}
            onChange={(e) => handleScriptChange(e.target.value)}
            data-testid="workshop-script-textarea"
            placeholder="在此粘贴或输入小说/剧本原文..."
            className={cn(
              'min-h-[clamp(420px,52vh,560px)] max-h-[min(680px,calc(100vh-220px))] resize-y',
              'border-0 bg-transparent shadow-none focus-visible:ring-0',
              'rounded-none px-4 py-3.5 text-[15px] leading-relaxed',
              'placeholder:text-muted-foreground/50',
            )}
          />

          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border/20 px-4 py-3">
            <p className="text-xs text-muted-foreground tabular-nums">
              {charCount}/{SCRIPT_MAX_LENGTH}
            </p>
            <Button
              type="button"
              className="shrink-0 gap-2 rounded-xl px-6"
              data-testid="workshop-step1-next"
              onClick={() => void handleNextStep()}
            >
              下一步
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={replaceConfirmOpen}
        title="替换当前剧本？"
        description="导入将覆盖编辑区已有内容，此操作不可撤销，请确认是否继续。"
        confirmLabel="继续导入"
        cancelLabel="取消"
        variant="destructive"
        loading={importing}
        onClose={handleReplaceCancel}
        onConfirm={handleReplaceConfirm}
      />
    </div>
  )
}
