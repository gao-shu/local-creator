// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { Check, Palette } from 'lucide-react'
import type { AppSettings } from '@/types/settings'
import type { EpisodeStyle } from '@/types/workflow'
import {
  buildStylePackGroups,
  inferStyleCategoryFromPresetKey,
  resolveProjectStylePresetKey,
  STYLE_PACK_META,
  type StylePackGroup,
} from '@/lib/workflow/project-visual-style'
import { cn } from '@/lib/utils'

interface ProjectVisualStylePickerProps {
  settings: AppSettings | null | undefined
  presetKey: string
  onChange: (presetKey: string) => void
  compact?: boolean
  className?: string
}

export function ProjectVisualStylePicker({
  settings,
  presetKey,
  onChange,
  compact = false,
  className,
}: ProjectVisualStylePickerProps) {
  const groups = useMemo(() => buildStylePackGroups(settings), [settings])
  const resolvedKey = resolveProjectStylePresetKey({ projectStylePresetKey: presetKey }, settings)
  const activeCategory = inferStyleCategoryFromPresetKey(resolvedKey, settings)
  const [selectedCategory, setSelectedCategory] = useState<EpisodeStyle>(activeCategory)

  useEffect(() => {
    setSelectedCategory(activeCategory)
  }, [activeCategory, resolvedKey])

  const activeGroup = groups.find((group) => group.meta.category === selectedCategory) ?? groups[0]

  return (
    <div className={cn('space-y-3', className)} data-testid="project-visual-style-picker">
      {!compact ? (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary/80" />
            <p className="text-sm font-medium">作品视觉风格</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            选定后全程影响资产描述语气与 Step3/4 默认生图画风；可在后续步骤单独覆盖。
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {groups.map((group) => (
          <CategoryCard
            key={group.meta.category}
            group={group}
            selected={selectedCategory === group.meta.category}
            onSelect={() => setSelectedCategory(group.meta.category)}
          />
        ))}
      </div>

      {activeGroup ? (
        <div className="rounded-xl border border-border/40 bg-muted/5 p-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            {STYLE_PACK_META[activeGroup.meta.category].label} · 选择具体画风
          </p>
          <div className="flex flex-wrap gap-2">
            {activeGroup.presets.map((preset) => {
              const selected = preset.key === resolvedKey
              return (
                <button
                  key={preset.key}
                  type="button"
                  data-testid={`project-style-preset-${preset.key}`}
                  onClick={() => onChange(preset.key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    selected
                      ? 'border-primary/50 bg-primary/10 text-primary'
                      : 'border-border/50 bg-background/40 text-foreground hover:bg-muted/30',
                  )}
                >
                  {selected ? <Check className="h-3 w-3 shrink-0" /> : null}
                  <span>{preset.name}</span>
                  {preset.recommended ? (
                    <span className="text-[10px] text-muted-foreground/80">推荐</span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function CategoryCard({
  group,
  selected,
  onSelect,
}: {
  group: StylePackGroup
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      data-testid={`project-style-category-${group.meta.category}`}
      onClick={onSelect}
      className={cn(
        'rounded-xl border px-3 py-2.5 text-left transition-colors',
        selected
          ? 'border-primary/45 bg-primary/8 ring-1 ring-primary/15'
          : 'border-border/45 bg-card/30 hover:bg-muted/20',
      )}
    >
      <p className="text-sm font-medium">{group.meta.label}</p>
      <p className="mt-0.5 text-[10px] text-muted-foreground leading-snug">{group.meta.hint}</p>
    </button>
  )
}
