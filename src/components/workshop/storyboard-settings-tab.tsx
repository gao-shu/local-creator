// Copyright (c) haode-ai-client. All rights reserved.

import { useState, type ReactNode } from 'react'
import { ChevronDown, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import {
  resolveStoryboardValidateMode,
  type StoryboardValidateMode,
} from '@/lib/workflow/storyboard-prompt'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import type { PromptAffixPreset } from '@/types/settings'
import { cn } from '@/lib/utils'

interface StoryboardSettingsTabProps {
  affixPresets: PromptAffixPreset[]
  selectedAffixPresetId?: number
  promptPrefix: string
  promptSuffix: string
  onPromptPrefixChange: (value: string) => void
  onPromptSuffixChange: (value: string) => void
  onSelectAffixPreset: (presetId: number) => void
  onOpenPresetManager: () => void
}

function CollapseSection({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string
  hint?: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/5 overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-muted/15 transition-colors"
        onClick={onToggle}
      >
        <span className="text-[12px] font-medium text-foreground">
          {title}
          {hint ? <span className="ml-1 text-[10px] font-normal text-muted-foreground">{hint}</span> : null}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open ? <div className="border-t border-border/30 px-3 py-3 space-y-3">{children}</div> : null}
    </div>
  )
}

export function StoryboardSettingsTab({
  affixPresets,
  selectedAffixPresetId,
  promptPrefix,
  promptSuffix,
  onPromptPrefixChange,
  onPromptSuffixChange,
  onSelectAffixPreset,
  onOpenPresetManager,
}: StoryboardSettingsTabProps) {
  const [affixOpen, setAffixOpen] = useState(true)
  const [validateOpen, setValidateOpen] = useState(true)
  const [presetOpen, setPresetOpen] = useState(false)

  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const isInternal = useAuthStore((s) => s.user?.is_internal === true)
  const savedValidateMode = settings?.storyboardValidateMode
  const effectiveValidateMode = resolveStoryboardValidateMode(savedValidateMode, isInternal)
  const validateModeSelectValue =
    savedValidateMode === 'quick' || savedValidateMode === 'deep' ? savedValidateMode : 'auto'

  const persistValidateMode = (next: 'auto' | StoryboardValidateMode) => {
    if (!settings) return
    if (next === 'auto') {
      useSettingsStore.setState((state) => {
        if (!state.settings) return state
        const { storyboardValidateMode: _removed, ...rest } = state.settings
        return { settings: rest, dirty: true }
      })
      void useSettingsStore.getState().save({ silent: true })
      const fallback = resolveStoryboardValidateMode(undefined, isInternal)
      toast.success(`已设为跟随账号（当前生效：${fallback === 'deep' ? '深度' : '快速'}）`)
      return
    }
    updateSettings({ storyboardValidateMode: next })
    void useSettingsStore.getState().save({ silent: true })
    toast.success(next === 'deep' ? '已切换为深度连续性审查' : '已切换为快速补锚点')
  }

  const presetOptions = affixPresets.map((item) => ({
    value: String(item.id),
    label: `${item.name}${item.isDefault ? ' (默认)' : ''}`,
  }))

  return (
    <div className="space-y-3">
      <CollapseSection
        title="固定前后缀"
        hint="(生图/生视频时自动携带)"
        open={affixOpen}
        onToggle={() => setAffixOpen((value) => !value)}
      >
        <div className="flex items-center gap-2">
          <Select
            className="flex-1 h-8 text-xs"
            value={String(selectedAffixPresetId ?? affixPresets[0]?.id ?? '')}
            options={presetOptions}
            onChange={(value) => onSelectAffixPreset(Number(value))}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 px-2"
            title="前后缀设置"
            onClick={onOpenPresetManager}
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">
            前缀（生图/视频时自动添加）
          </Label>
          <Textarea
            value={promptPrefix}
            onChange={(event) => onPromptPrefixChange(event.target.value)}
            rows={3}
            className="resize-none text-xs"
            placeholder="输入固定前缀，如风格描述..."
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">后缀</Label>
          <Textarea
            value={promptSuffix}
            onChange={(event) => onPromptSuffixChange(event.target.value)}
            rows={3}
            className="resize-none text-xs"
            placeholder="输入固定后缀，如质量要求..."
          />
        </div>
      </CollapseSection>

      <CollapseSection
        title="补空间锚点"
        hint="(快速 / 深度)"
        open={validateOpen}
        onToggle={() => setValidateOpen((value) => !value)}
      >
        <div className="space-y-1.5">
          <Label className="text-[10px] text-muted-foreground">档位</Label>
          <Select
            className="h-8 text-xs"
            value={validateModeSelectValue}
            options={[
              {
                value: 'auto',
                label: `跟随账号（内部深度 / 外部快速 · 当前${effectiveValidateMode === 'deep' ? '深度' : '快速'}）`,
              },
              { value: 'quick', label: '快速补锚点（轻量，控成本）' },
              { value: 'deep', label: '深度连续性审查（硬规则 + 原文摘要）' },
            ]}
            onChange={(value) => {
              if (value === 'quick' || value === 'deep' || value === 'auto') {
                persistValidateMode(value)
              }
            }}
          />
          <p
            className="text-[10px] leading-relaxed text-muted-foreground"
            data-testid="workshop-step4-validate-mode-hint"
          >
            深度档会附带本集原文摘要（截断），并启用人群/姿势/跳切等硬规则；快速档只补一句话锚点。
          </p>
        </div>
      </CollapseSection>

      <CollapseSection
        title="预设管理"
        hint="(点击预设添加到文本框)"
        open={presetOpen}
        onToggle={() => setPresetOpen((value) => !value)}
      >
        <Button
          type="button"
          variant="outline"
          className="w-full h-9 text-xs"
          onClick={onOpenPresetManager}
        >
          <Settings2 className="h-3.5 w-3.5 mr-1.5" />
          打开预设管理
        </Button>
      </CollapseSection>
    </div>
  )
}
