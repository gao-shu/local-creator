import { useState, Fragment } from 'react'

import { Bot, Edit2, ImageIcon, Loader2, MessageSquare, Plus, Trash2, Video, Zap } from 'lucide-react'

import { toast } from 'sonner'

import { cn } from '@/lib/utils'

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
import {
  buildWeishiCustomModelPatchFromCatalog,
  resolveDefaultWeishiUpstreamModelId,
} from '@/lib/models/weishi-model-catalog'
import { createWeishiApiModel, isWeishiApiModel } from '@/lib/models/weishi-model-presets'
import { testModelConnection } from '@/lib/models/model-test-service'
import {
  getSystemModelBillingBadge,
  partitionSystemModelsByBilling,
  systemModelBillingBadgeClass,
} from '@/lib/models/system-model-display'
import {
  formatImageModelListPriceLabel,
  groupImageModelsByGroupName,
} from '@/lib/models/image-model-pricing'
import { formatVideoModelListPriceLabel } from '@/lib/models/video-model-pricing'
import { ImageModelCapabilityTags } from '@/components/models/image-model-capability-tags'
import { VideoModelCapabilityTags } from '@/components/models/video-model-capability-tags'



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



function SystemModelCard({
  model,
  showImagePricing = false,
  showVideoPricing = false,
}: {
  model: ModelConfig
  showImagePricing?: boolean
  showVideoPricing?: boolean
}) {
  const billingBadge = getSystemModelBillingBadge(model)
  const priceLabel = showImagePricing
    ? formatImageModelListPriceLabel(model)
    : showVideoPricing
      ? formatVideoModelListPriceLabel(model)
      : null

  return (
    <GlassCard className="p-3 flex flex-col gap-3 h-full border-primary/20">
      <div className="flex items-start gap-2.5 min-w-0 flex-1">
        <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-medium text-sm truncate">{model.name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary">
              系统
            </span>
            {billingBadge ? (
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-md',
                  systemModelBillingBadgeClass(billingBadge.tone),
                )}
              >
                {billingBadge.text}
              </span>
            ) : null}
          </div>
          {model.model ? (
            <p className="text-xs text-muted-foreground truncate">{model.model}</p>
          ) : null}
          {model.remark ? (
            <p className="text-xs text-muted-foreground/80 truncate">{model.remark}</p>
          ) : null}
          {priceLabel ? (
            <p className="text-[10px] text-primary/80">{priceLabel}</p>
          ) : typeof model.haodouCost === 'number' && model.haodouCost > 0 ? (
            <p className="text-[10px] text-muted-foreground">好豆 {model.haodouCost}/次</p>
          ) : billingBadge?.tone === 'internal' ? (
            <p className="text-[10px] text-muted-foreground">内部配额模型</p>
          ) : null}
          {showImagePricing ? (
            <ImageModelCapabilityTags model={model} className="pt-0.5" />
          ) : null}
          {showVideoPricing ? (
            <VideoModelCapabilityTags model={model} className="pt-0.5" />
          ) : null}
          {model.endpoint ? (
            <p className="text-[10px] text-muted-foreground/70 font-mono truncate">{model.endpoint}</p>
          ) : null}
        </div>
      </div>
    </GlassCard>
  )
}



export function ModelsTab() {

  const [activeKind, setActiveKind] = useState<ModelKind>('llm')

  const [dialogOpen, setDialogOpen] = useState(false)

  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null)

  const [dialogInitial, setDialogInitial] = useState<ModelConfig | null>(null)

  const [testingId, setTestingId] = useState<string | null>(null)



  const settings = useSettingsStore((s) => s.settings)
  const systemModelsByKind = useSettingsStore((s) => s.systemModelsByKind)

  const addModel = useSettingsStore((s) => s.addModel)

  const updateModel = useSettingsStore((s) => s.updateModel)

  const removeModel = useSettingsStore((s) => s.removeModel)
  const { ask, confirmDialog } = useConfirmDialog()

  if (!settings) return null



  const customList =
    activeKind === 'llm'
      ? settings.llmModels.filter((m) => m.source !== 'system')
      : activeKind === 'image'
        ? settings.imageModels.filter((m) => m.source !== 'system')
        : settings.videoModels.filter((m) => m.source !== 'system')

  const systemList = systemModelsByKind[activeKind] || []
  const { external: externalSystemList } = partitionSystemModelsByBilling(systemList)
  const externalImageGroups =
    activeKind === 'image' ? groupImageModelsByGroupName(externalSystemList) : []



  const openCreate = () => {

    setEditingModel(null)

    setDialogInitial(null)

    setDialogOpen(true)

  }



  const openCreateWeishi = () => {
    setEditingModel(null)
    const systemVideoModels = useSettingsStore.getState().systemModelsByKind.video
    const defaultModelId = resolveDefaultWeishiUpstreamModelId(systemVideoModels)
    const catalogPatch = buildWeishiCustomModelPatchFromCatalog(defaultModelId, systemVideoModels)
    setDialogInitial({
      ...createWeishiApiModel('video'),
      ...catalogPatch,
      model: defaultModelId,
    })
    setDialogOpen(true)
  }



  const openEdit = (model: ModelConfig) => {
    if (model.source === 'system') {
      toast.message('系统模型由平台管理，请在管理后台调整定价')
      return
    }

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
          {activeKind === 'video' ? (
            <GradientButton
              type="button"
              className={cn(
                actionButtonClass,
                'from-orange-500 to-rose-600 shadow-orange-500/20 hover:shadow-orange-500/30',
              )}
              onClick={openCreateWeishi}
            >
              <Plus className="h-4 w-4" />
              微视API
            </GradientButton>
          ) : null}

          <GradientButton type="button" className={actionButtonClass} onClick={openCreate}>
            <Plus className="h-4 w-4" />
            添加模型
          </GradientButton>
        </div>
      </div>



      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {externalSystemList.length > 0 ? (
          <>
            <p className="col-span-full text-xs font-medium text-muted-foreground">
              系统模型（平台下发 · 代理调用 · 按好豆或后台定价）
            </p>
            {activeKind === 'image'
              ? externalImageGroups.map((group) => (
                  <Fragment key={group.groupKey}>
                    {group.isMultiChannel && group.groupName ? (
                      <p className="col-span-full text-[11px] font-medium text-muted-foreground/90">
                        {group.groupName}
                      </p>
                    ) : null}
                    {group.models.map((model) => (
                      <SystemModelCard key={model.id} model={model} showImagePricing />
                    ))}
                  </Fragment>
                ))
              : externalSystemList.map((model) => (
                  <SystemModelCard
                    key={model.id}
                    model={model}
                    showVideoPricing={activeKind === 'video'}
                  />
                ))}
          </>
        ) : systemList.some((m) => m.billingMode === 'internal') ? (
          <p className="col-span-full text-xs text-muted-foreground rounded-lg border border-dashed border-border/50 px-3 py-2.5">
            暂无外部系统模型。内部配额模型（如 Seedance）不在此展示；外部模型需管理后台配置
            billing_mode=external。
          </p>
        ) : null}

        <p className="col-span-full text-xs font-medium text-muted-foreground pt-1">
          自定义模型（自备 API Key）
        </p>

        {customList.length === 0 ? (
          <GlassCard className="col-span-full py-10 text-center text-sm text-muted-foreground">
            还没有自定义 {activeTab.label}，点击「添加模型」开始配置
          </GlassCard>
        ) : (
          customList.map((model) => {
            const isWeishi = isWeishiApiModel(model)
            const presetLabel =
              activeKind === 'llm'
                ? getLlmPresetLabel(model)
                : activeKind === 'image'
                  ? getImagePresetLabel(model)
                  : getVideoPresetLabel(model)
            const keySummary = isWeishi ? maskKey(model.apiKey) : maskKey(model.apiKey)

            return (
              <GlassCard
                key={model.id}
                className="p-3 flex flex-col gap-3 h-full"
              >
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

                    {!isWeishi && model.endpoint ? (
                      <p className="text-[10px] text-muted-foreground/70 font-mono truncate">{model.endpoint}</p>
                    ) : null}

                    {!isWeishi && model.remark ? (
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
                    disabled={testingId === model.id || isWeishiApiModel(model)}
                    onClick={() => void handleTest(model)}
                    title={isWeishiApiModel(model) ? '微视 API 暂不支持连接测试' : '测试连接'}
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

        onClose={() => {

          setDialogOpen(false)

          setEditingModel(null)

          setDialogInitial(null)

        }}

        onSave={handleSave}

      />

      {confirmDialog}

    </div>

  )

}


