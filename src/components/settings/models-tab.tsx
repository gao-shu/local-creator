import { useState } from 'react'
import { Bot, Edit2, ImageIcon, Loader2, MessageSquare, Plus, Trash2, Video, Zap } from 'lucide-react'
import { toast } from 'sonner'
import type { ModelConfig, ModelKind } from '@/types/settings'
import { useSettingsStore } from '@/stores/settings-store'
import { Button } from '@/components/ui/button'
import { GradientButton } from '@/components/ui/gradient-button'
import { GlassCard } from '@/components/ui/glass-card'
import { ModelConfigDialog } from '@/components/settings/model-config-dialog'
import { SettingsSegmentedControl } from '@/components/settings/settings-segmented-control'
import { useConfirmDialog } from '@/hooks/use-confirm-dialog'
import { getLlmPresetLabel } from '@/lib/models/llm-model-presets'
import { getImagePresetLabel } from '@/lib/models/image-model-presets'
import { getVideoPresetLabel } from '@/lib/models/video-model-presets'
import { testModelConnection } from '@/lib/models/model-test-service'

const TABS: { id: ModelKind; label: string; description: string; icon: typeof MessageSquare }[] = [
  {
    id: 'llm',
    label: 'LLM模型',
    description: '配置用于文本生成和对话的 LLM 模型',
    icon: MessageSquare,
  },
  {
    id: 'image',
    label: '图片模型',
    description: '配置用于图片生成的 AI 模型',
    icon: ImageIcon,
  },
  {
    id: 'video',
    label: '视频模型',
    description: '配置用于视频生成的 AI 模型',
    icon: Video,
  },
]

function maskKey(value?: string) {
  if (!value) return '未设置'
  if (value.length <= 8) return '••••••••'
  return `${value.slice(0, 4)}••••${value.slice(-4)}`
}

export function ModelsTab() {
  const [activeKind, setActiveKind] = useState<ModelKind>('llm')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)
  const [dialogInitial, setDialogInitial] = useState<ModelConfig | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)

  const settings = useSettingsStore((s) => s.settings)
  const addModel = useSettingsStore((s) => s.addModel)
  const updateModel = useSettingsStore((s) => s.updateModel)
  const removeModel = useSettingsStore((s) => s.removeModel)
  const { ask, confirmDialog } = useConfirmDialog()

  if (!settings) return null

  const customList = (
    activeKind === 'llm'
      ? settings.llmModels.filter((m) => m.source !== 'system')
      : activeKind === 'image'
        ? settings.imageModels.filter((m) => m.source !== 'system')
        : settings.videoModels.filter((m) => m.source !== 'system')
  )

  const openCreate = () => {
    setEditingModel(null)
    setDialogInitial(null)
    setDialogOpen(true)
  }

  const openEdit = (model: ModelConfig) => {
    setEditingModel(model)
    setDialogInitial(model)
    setDialogOpen(true)
  }

  const handleSave = (config: ModelConfig) => {
    if (editingModel) {
      updateModel(activeKind, config.id, config)
      toast.success('模型配置已更新')
    } else {
      addModel(activeKind, { ...config, source: 'custom' })
      toast.success('模型已添加')
    }
  }

  const handleTest = async (model: ModelConfig) => {
    setTestingId(model.id)
    try {
      const result = await testModelConnection(activeKind, model)
      if (result.success) {
        toast.success(`「${model.name}」${result.message}`)
      } else {
        toast.error(`「${model.name}」${result.message}`)
      }
    } catch (err: unknown) {
      const e = err as Error
      toast.error(e.message || '测试失败')
    } finally {
      setTestingId(null)
    }
  }

  const activeTab = TABS.find((t) => t.id === activeKind) ?? TABS[0]
  const handleRemoveModel = async (model: ModelConfig) => {
    const ok = await ask({
      title: '删除模型',
      description: `确定删除「${model.name || '未命名模型'}」吗？删除后不可恢复。`,
      confirmLabel: '删除',
      variant: 'destructive',
    })
    if (!ok) return
    removeModel(activeKind, model.id)
    toast.success('已删除模型')
  }
  const actionButtonClass = 'h-9 px-4 text-sm'

  return (
    <div className="space-y-5">
      <SettingsSegmentedControl
        items={TABS.map((tab) => ({
          id: tab.id,
          label: tab.label,
          icon: tab.icon,
        }))}
        value={activeKind}
        onChange={(id) => setActiveKind(id as ModelKind)}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{activeTab.description}</p>
        <div className="flex items-center gap-2 shrink-0">
          <GradientButton type="button" className={actionButtonClass} onClick={openCreate}>
            <Plus className="h-4 w-4" />
            添加模型
          </GradientButton>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        <p className="col-span-full text-xs font-medium text-muted-foreground pt-1">
          自定义模型（自备 API Key）
        </p>

        {customList.length === 0 ? (
          <GlassCard className="col-span-full py-10 text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              还没有自定义 {activeTab.label}。本地漫创只使用你自己配置的模型。
            </p>
            <p className="text-xs text-muted-foreground/90 leading-relaxed max-w-md mx-auto">
              {activeKind === 'llm'
                ? '点击「添加模型」，选择 OpenAI 兼容并填写 Endpoint + API Key（推荐 Agnes）。'
                : activeKind === 'image'
                  ? '点击「添加模型」，配置生图 Endpoint + API Key（推荐 Agnes）。'
                  : '点击「添加模型」，配置 OpenAI 兼容等视频 Endpoint + API Key。'}
            </p>
          </GlassCard>
        ) : (
          customList.map((model) => {
            const presetLabel =
              activeKind === 'llm'
                ? getLlmPresetLabel(model)
                : activeKind === 'image'
                  ? getImagePresetLabel(model)
                  : getVideoPresetLabel(model)
            const keySummary = maskKey(model.apiKey)

            return (
              <GlassCard key={model.id} className="p-3 flex flex-col gap-3 h-full">
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium text-sm truncate">{model.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                        自定义
                      </span>
                    </div>
                    <span className="inline-flex text-[10px] px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                      {presetLabel}
                    </span>
                    <p className="text-xs text-muted-foreground truncate">
                      {model.model || '未指定模型名'}
                      {keySummary ? ` · ${keySummary}` : ''}
                    </p>
                    {model.endpoint ? (
                      <p className="text-[10px] text-muted-foreground/70 font-mono truncate">
                        {model.endpoint}
                      </p>
                    ) : null}
                    {model.remark ? (
                      <p className="text-xs text-muted-foreground/80 truncate">{model.remark}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    disabled={testingId === model.id}
                    onClick={() => void handleTest(model)}
                    title="测试连接"
                  >
                    {testingId === model.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    测试
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs"
                    onClick={() => openEdit(model)}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                    编辑
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-2.5 text-xs text-destructive hover:text-destructive"
                    onClick={() => void handleRemoveModel(model)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                </div>
              </GlassCard>
            )
          })
        )}
      </div>

      <ModelConfigDialog
        open={dialogOpen}
        kind={activeKind}
        initial={dialogInitial}
        isEdit={Boolean(editingModel)}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
      />
      {confirmDialog}
    </div>
  )
}
