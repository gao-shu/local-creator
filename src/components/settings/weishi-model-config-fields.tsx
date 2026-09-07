// Copyright (c) Haode AI. All rights reserved.

import { useMemo, useState } from 'react'
import { ChevronDown, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ModelConfig } from '@/types/settings'
import {
  modelDialogInputClass,
  SettingsToggleField,
} from '@/components/settings/model-config-dialog-shared'
import {
  buildWeishiCustomModelPatchFromCatalog,
  ensureWeishiVideoModelOption,
  resolveWeishiVideoModelOptions,
} from '@/lib/models/weishi-model-catalog'
import { useSettingsStore } from '@/stores/settings-store'

const inputClass = modelDialogInputClass

interface WeishiModelConfigFieldsProps {
  form: ModelConfig
  onPatch: (patch: Partial<ModelConfig>) => void
  showApiKey?: boolean
  showKey?: boolean
  onToggleShowKey?: () => void
}

export function WeishiModelConfigFields({
  form,
  onPatch,
  showApiKey = true,
  showKey = false,
  onToggleShowKey,
}: WeishiModelConfigFieldsProps) {
  const systemVideoModels = useSettingsStore((state) => state.systemModelsByKind.video)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const weishiModelOptions = useMemo(() => {
    const resolved = resolveWeishiVideoModelOptions(systemVideoModels)
    return ensureWeishiVideoModelOption(resolved, form.model)
  }, [systemVideoModels, form.model])

  const handleModelChange = (modelId: string) => {
    const catalogPatch = buildWeishiCustomModelPatchFromCatalog(modelId, systemVideoModels)
    onPatch({ ...catalogPatch, model: modelId })
  }

  const catalogEmpty = weishiModelOptions.length === 0

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="block text-sm font-medium">
          模型 <span className="text-destructive">*</span>
        </label>
        {catalogEmpty ? (
          <div className={cn(inputClass, 'text-sm text-amber-600 dark:text-amber-400')}>
            管理端暂无启用的微视系统模型（api_format=weishi_api）
          </div>
        ) : (
          <select
            value={form.model || weishiModelOptions[0]?.modelId || ''}
            onChange={(e) => handleModelChange(e.target.value)}
            className={inputClass}
          >
            {weishiModelOptions.map((item) => (
              <option key={item.modelId} value={item.modelId}>
                {item.label}
              </option>
            ))}
          </select>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {catalogEmpty
            ? '请在管理端「系统模型」启用微视 Seedance，或联系管理员配置 api_format=weishi_api'
            : '平台系统模型目录；单价随分辨率变化，请在分镜 Step4 查看；比例与时长亦在 Step4 选择'}
        </p>
      </div>

      {showApiKey ? (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium">
            API 密钥 <span className="text-destructive">*</span>
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.apiKey || ''}
              onChange={(e) => onPatch({ apiKey: e.target.value })}
              placeholder="直接填入微视 API Key"
              className={cn(inputClass, 'pr-10')}
            />
            {onToggleShowKey ? (
              <button
                type="button"
                onClick={onToggleShowKey}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted transition-colors"
              >
                {showKey ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            微视官方通道，直接填入 Key 即可使用
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-border/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40 transition-colors"
        >
          <span className="text-sm font-medium text-muted-foreground">高级选项</span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              advancedOpen && 'rotate-180',
            )}
          />
        </button>
        {advancedOpen ? (
          <div className="space-y-4 border-t border-border/30 px-3.5 py-3.5 bg-muted/10">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">配置名称</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => onPatch({ name: e.target.value })}
                placeholder="微视API"
                className={inputClass}
              />
            </div>
            <SettingsToggleField
              label="是否 URL 上传"
              description="开启后先上传本地素材并改用 URL 请求，避免 base64 请求体过大"
              checked={form.uploadByUrl !== false}
              onCheckedChange={(checked) => onPatch({ uploadByUrl: checked })}
            />
            <SettingsToggleField
              label="微视API 开白"
              description="开启后优先将参考图、音频、视频上传到微视素材接口并改用 asset:// 引用"
              checked={form.weishiAssetWhitelistEnabled === true}
              onCheckedChange={(checked) => onPatch({ weishiAssetWhitelistEnabled: checked })}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function isWeishiModelCatalogReady(systemVideoModels: ModelConfig[]): boolean {
  return resolveWeishiVideoModelOptions(systemVideoModels).length > 0
}
