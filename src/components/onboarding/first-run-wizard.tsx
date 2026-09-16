// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircle2,
  FolderOpen,
  Loader2,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { GradientButton } from '@/components/ui/gradient-button'
import { ModelConfigDialog } from '@/components/settings/model-config-dialog'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import {
  hasReadyLlmOrImageModel,
  isModelConfiguredForUse,
  listConfigurableModels,
  shouldShowFirstRunWizard,
  type FirstRunStep,
} from '@/lib/onboarding/first-run'
import { hasChinesePath } from '@/lib/storage/path-utils'
import { normalizeStorageRoot } from '@/lib/storage/data-layout'
import { selectDirectory } from '@/lib/storage/settings-service'
import { testModelConnection } from '@/lib/models/model-test-service'
import { cn } from '@/lib/utils'
import type { ModelConfig, ModelKind } from '@/types/settings'
import { useSettingsStore } from '@/stores/settings-store'

const STEP_LABELS: Record<FirstRunStep, string> = {
  1: '存储位置',
  2: '配置模型',
  3: '测试连接',
  4: '完成',
}

export function FirstRunWizardHost() {
  const load = useSettingsStore((s) => s.load)
  const loading = useSettingsStore((s) => s.loading)
  const settings = useSettingsStore((s) => s.settings)
  const dataRoot = useSettingsStore((s) => s.dataRoot)
  const saving = useSettingsStore((s) => s.saving)
  const save = useSettingsStore((s) => s.save)
  const updateDataRootPath = useSettingsStore((s) => s.updateDataRootPath)
  const updateModel = useSettingsStore((s) => s.updateModel)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const addModel = useSettingsStore((s) => s.addModel)

  const [step, setStep] = useState<FirstRunStep>(1)
  const [testing, setTesting] = useState(false)
  const [testMessage, setTestMessage] = useState<string>('')
  const [testOk, setTestOk] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogKind, setDialogKind] = useState<ModelKind>('llm')
  const [dialogInitial, setDialogInitial] = useState<ModelConfig | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { ask, confirmDialog } = useConfirmDialog()

  useEffect(() => {
    void load()
  }, [load])

  const open = !loading && shouldShowFirstRunWizard(settings)

  useEffect(() => {
    if (!open || !settings) return
    const root = settings.dataRootPath?.trim() || dataRoot?.trim() || ''
    if (!root) {
      setStep(1)
      return
    }
    if (!hasReadyLlmOrImageModel(settings)) {
      setStep(2)
      return
    }
    setStep((prev) => (prev < 3 ? 3 : prev))
  }, [open, settings, dataRoot])

  const models = useMemo(
    () => (settings ? listConfigurableModels(settings) : []),
    [settings],
  )

  if (!open || !settings) return null

  const rootValue = settings.dataRootPath?.trim() || ''
  const chineseError = hasChinesePath(rootValue)

  const applyAndSaveDataRoot = async (nextPath: string) => {
    const normalized = normalizeStorageRoot(nextPath)
    if (!normalized) {
      toast.error('无效的数据目录')
      return false
    }
    if (hasChinesePath(normalized)) {
      toast.error('路径不能包含中文字符')
      return false
    }
    updateDataRootPath(normalized)
    const ok = await save({ successMessage: '已保存数据目录' })
    if (ok) setStep(2)
    return ok
  }

  const handleBrowse = async () => {
    const res = await selectDirectory({
      defaultPath: rootValue || dataRoot || undefined,
    })
    if (res.canceled) return
    if (!res.success || !res.path) {
      toast.error(res.error || '选择目录失败')
      return
    }
    await applyAndSaveDataRoot(res.path)
  }

  const openEditModel = (kind: ModelKind, model: ModelConfig) => {
    setDialogKind(kind)
    setDialogInitial(model)
    setEditingId(model.id)
    setDialogOpen(true)
  }

  const openCreateModel = (kind: ModelKind) => {
    setDialogKind(kind)
    setDialogInitial(null)
    setEditingId(null)
    setDialogOpen(true)
  }

  const handleModelSave = (config: ModelConfig) => {
    if (editingId) updateModel(dialogKind, editingId, config)
    else addModel(dialogKind, config)
    setDialogOpen(false)
    void save({ successMessage: '模型已保存' })
  }

  const pickTestTarget = (): { kind: ModelKind; model: ModelConfig } | null => {
    const ready = models.find(
      (row) =>
        (row.kind === 'llm' || row.kind === 'image') && isModelConfiguredForUse(row.model),
    )
    return ready ?? null
  }

  const handleTest = async () => {
    const target = pickTestTarget()
    if (!target) {
      setTestOk(false)
      setTestMessage('请先在上一步为 LLM 或图片模型填写 Endpoint 与 API Key')
      toast.error('尚未配置可用的 LLM 或图片模型')
      return
    }
    setTesting(true)
    setTestMessage('')
    try {
      const result = await testModelConnection(target.kind, target.model)
      setTestOk(result.success)
      setTestMessage(result.message || (result.success ? '连接成功' : '连接失败'))
      if (result.success) {
        toast.success('测试通过')
        setStep(4)
      } else {
        toast.error(result.message || '测试失败')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setTestOk(false)
      setTestMessage(message || '测试过程出错')
      toast.error(message || '测试过程出错')
    } finally {
      setTesting(false)
    }
  }

  const handleSkipTest = async () => {
    const confirmed = await ask({
      title: '跳过连接测试？',
      description:
        '未测试通过时，生成可能因 Key/地址错误而失败。建议先点「测试连接」。确定仍要跳过吗？',
      confirmLabel: '仍要跳过',
      cancelLabel: '返回测试',
      variant: 'destructive',
    })
    if (!confirmed) return
    setStep(4)
  }

  const completeOnboarding = async () => {
    updateSettings({ onboardingCompleted: true })
    const ok = await save({ successMessage: '初始设置完成' })
    if (!ok) toast.error('保存失败，请重试')
  }

  return createPortal(
    <>
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] bg-black/65 backdrop-blur-sm"
          data-testid="first-run-wizard-overlay"
        />
        <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="pointer-events-auto w-full max-w-lg"
            data-testid="first-run-wizard"
          >
            <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/30">
              <div className="border-b border-border/20 px-6 py-4">
                <div className="flex items-center gap-2 text-base font-semibold">
                  <Wand2 className="h-5 w-5 text-primary" />
                  首次运行设置
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  完成存储目录与模型配置后即可开始创作。第三方 API 费用自负。
                </p>
                <div className="mt-4 flex gap-2">
                  {([1, 2, 3, 4] as FirstRunStep[]).map((n) => (
                    <div
                      key={n}
                      className={cn(
                        'flex-1 rounded-full px-2 py-1 text-center text-xs',
                        step === n
                          ? 'bg-primary text-primary-foreground'
                          : step > n
                            ? 'bg-primary/20 text-foreground'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {n}. {STEP_LABELS[n]}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
                {step === 1 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      选择一个空目录作为便携数据根（项目、设置、素材均保存在此）。路径不能包含中文。
                    </p>
                    <div className="rounded-xl border border-border/30 bg-muted/30 px-3 py-2 text-sm break-all">
                      {rootValue || '尚未选择'}
                    </div>
                    {chineseError ? (
                      <p className="text-sm text-destructive">路径不能包含中文字符</p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => void handleBrowse()}>
                        <FolderOpen className="mr-2 h-4 w-4" />
                        选择目录
                      </Button>
                      <GradientButton
                        type="button"
                        disabled={!rootValue || chineseError || saving}
                        onClick={() => void applyAndSaveDataRoot(rootValue)}
                      >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        下一步
                      </GradientButton>
                    </div>
                  </>
                ) : null}

                {step === 2 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      请至少为一个 <strong>LLM</strong> 或 <strong>图片</strong> 模型填写 Endpoint 与
                      API Key（可编辑内置 Agnes，或新增）。
                    </p>
                    <div className="max-h-56 space-y-2 overflow-auto">
                      {models
                        .filter((row) => row.kind === 'llm' || row.kind === 'image')
                        .map(({ kind, model }) => {
                          const ready = isModelConfiguredForUse(model)
                          return (
                            <button
                              key={`${kind}-${model.id}`}
                              type="button"
                              className="flex w-full items-center justify-between rounded-xl border border-border/30 px-3 py-2 text-left text-sm hover:bg-muted/40"
                              onClick={() => openEditModel(kind, model)}
                            >
                              <span>
                                <span className="text-muted-foreground">
                                  {kind === 'llm' ? 'LLM' : '图片'} ·{' '}
                                </span>
                                {model.name}
                              </span>
                              <span
                                className={cn(
                                  'text-xs',
                                  ready ? 'text-emerald-600' : 'text-amber-600',
                                )}
                              >
                                {ready ? '已填 Key' : '待配置'}
                              </span>
                            </button>
                          )
                        })}
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={() => openCreateModel('llm')}>
                          新增 LLM
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => openCreateModel('image')}
                        >
                          新增图片
                        </Button>
                      </div>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                          上一步
                        </Button>
                        <GradientButton
                          type="button"
                          disabled={!hasReadyLlmOrImageModel(settings)}
                          onClick={() => setStep(3)}
                        >
                          下一步
                        </GradientButton>
                      </div>
                    </div>
                  </>
                ) : null}

                {step === 3 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      对已配置的 LLM / 图片模型做一次连接测试。失败时会显示可读错误信息。
                    </p>
                    {testMessage ? (
                      <div
                        className={cn(
                          'rounded-xl border px-3 py-2 text-sm',
                          testOk
                            ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                            : 'border-destructive/40 text-destructive',
                        )}
                      >
                        {testMessage}
                      </div>
                    ) : null}
                    <div className="flex flex-wrap justify-between gap-2">
                      <Button type="button" variant="ghost" onClick={() => setStep(2)}>
                        上一步
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={testing}
                          onClick={() => void handleSkipTest()}
                        >
                          跳过测试
                        </Button>
                        <GradientButton
                          type="button"
                          disabled={testing}
                          onClick={() => void handleTest()}
                        >
                          {testing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                          )}
                          测试连接
                        </GradientButton>
                      </div>
                    </div>
                  </>
                ) : null}

                {step === 4 ? (
                  <>
                    <div className="flex items-start gap-3 rounded-xl border border-border/30 bg-muted/20 px-3 py-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                      <div className="text-sm">
                        <p className="font-medium">可以开始使用了</p>
                        <p className="mt-1 text-muted-foreground">
                          可进入创作工坊或无限画布。示例项目将在后续版本提供。
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <Button type="button" variant="outline" disabled title="示例项目将在 OB1 提供">
                        打开示例（即将推出）
                      </Button>
                      <GradientButton
                        type="button"
                        disabled={saving}
                        data-testid="first-run-wizard-finish"
                        onClick={() => void completeOnboarding()}
                      >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        进入首页
                      </GradientButton>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </AnimatePresence>

      <ModelConfigDialog
        open={dialogOpen}
        kind={dialogKind}
        initial={dialogInitial}
        onClose={() => setDialogOpen(false)}
        onSave={handleModelSave}
      />
      {confirmDialog}
    </>,
    document.body,
  )
}
