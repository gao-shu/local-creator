import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BookOpen,
  Clapperboard,
  Edit2,
  Eye,
  FileText,
  LayoutGrid,
  Palette,
  Plus,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { LayoutTemplateKind, PromptTemplate, SettingsPromptType, TemplateListKey } from '@/types/settings'
import { TEMPLATE_SECTIONS } from '@/lib/storage/settings-defaults'
import { useSettingsStore } from '@/stores/settings-store'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { TemplateConfigDialog } from '@/components/settings/template-config-dialog'
import { SettingsSegmentedControl } from '@/components/settings/settings-segmented-control'

const TEMPLATE_TAB_ICONS = {
  extractTemplates: FileText,
  styleTemplates: Palette,
  storyboardTemplates: Clapperboard,
  layoutTemplates: LayoutGrid,
} as const

const LAYOUT_KIND_LABEL: Record<LayoutTemplateKind, string> = {
  character: '角色',
  scene: '场景',
  prop: '道具',
}

type LayoutKindFilter = 'all' | LayoutTemplateKind

const LAYOUT_KIND_FILTERS: LayoutKindFilter[] = ['all', 'character', 'scene', 'prop']

function resolveTemplateSection(value: string | null): TemplateListKey | null {
  if (!value) return null
  return TEMPLATE_SECTIONS.some((item) => item.key === value) ? (value as TemplateListKey) : null
}

function resolveLayoutKindFilter(value: string | null): LayoutKindFilter | null {
  if (!value) return null
  if (value === 'all' || value === 'character' || value === 'scene' || value === 'prop') {
    return value
  }
  return null
}

export function TemplatesTab() {
  const [searchParams] = useSearchParams()
  const [activeSection, setActiveSection] = useState<TemplateListKey>(
    () => resolveTemplateSection(searchParams.get('section')) ?? 'extractTemplates',
  )
  const [layoutKindFilter, setLayoutKindFilter] = useState<LayoutKindFilter>(
    () => resolveLayoutKindFilter(searchParams.get('layoutKind')) ?? 'all',
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [previewOnly, setPreviewOnly] = useState(false)

  const settings = useSettingsStore((s) => s.settings)
  const addTemplate = useSettingsStore((s) => s.addTemplate)
  const updateTemplate = useSettingsStore((s) => s.updateTemplate)
  const removeTemplate = useSettingsStore((s) => s.removeTemplate)

  const section = useMemo(
    () => TEMPLATE_SECTIONS.find((s) => s.key === activeSection)!,
    [activeSection],
  )

  const list = settings?.[activeSection] ?? []
  const isLayoutSection = activeSection === 'layoutTemplates'

  const layoutKindCounts = useMemo(() => {
    const counts: Record<LayoutKindFilter, number> = {
      all: list.length,
      character: 0,
      scene: 0,
      prop: 0,
    }
    if (!isLayoutSection) return counts
    for (const item of list) {
      const kind = item.layoutKind
      if (kind === 'character' || kind === 'scene' || kind === 'prop') {
        counts[kind] += 1
      }
    }
    return counts
  }, [isLayoutSection, list])

  const filteredList = useMemo(() => {
    if (!isLayoutSection || layoutKindFilter === 'all') return list
    return list.filter((item) => item.layoutKind === layoutKindFilter)
  }, [isLayoutSection, layoutKindFilter, list])

  const existingKeys = useMemo(
    () =>
      list
        .filter((item) => item.id !== editingTemplate?.id)
        .map((item) => item.key.trim())
        .filter(Boolean),
    [list, editingTemplate?.id],
  )

  const defaultLayoutKind: LayoutTemplateKind =
    layoutKindFilter === 'all' ? 'character' : layoutKindFilter

  useEffect(() => {
    const nextSection = resolveTemplateSection(searchParams.get('section'))
    if (nextSection) setActiveSection(nextSection)
    const nextKind = resolveLayoutKindFilter(searchParams.get('layoutKind'))
    if (nextKind) setLayoutKindFilter(nextKind)
  }, [searchParams])

  if (!settings) return null

  const openCreate = () => {
    setEditingTemplate(null)
    setPreviewOnly(false)
    setDialogOpen(true)
  }

  const openTemplate = (template: PromptTemplate, readonly: boolean) => {
    setEditingTemplate(template)
    setPreviewOnly(readonly)
    setDialogOpen(true)
  }

  const handleSave = (template: PromptTemplate) => {
    if (previewOnly) return
    if (editingTemplate) {
      updateTemplate(activeSection, template.id, template)
      toast.success(activeSection === 'layoutTemplates' ? '布局模板已更新' : '模板已更新')
    } else {
      addTemplate(activeSection, template)
      toast.success(activeSection === 'layoutTemplates' ? '布局模板已添加' : '模板已添加')
    }
  }

  const handleRemove = (template: PromptTemplate) => {
    removeTemplate(activeSection, template.id)
    if (activeSection === 'layoutTemplates') {
      toast.message('已删除布局模板', {
        description: '若资产仍选用该布局，生图时会回退到系统默认版式。',
      })
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">提示词模板</h2>
          <p className="text-sm text-muted-foreground mt-1">
            管理提取、风格、分镜与布局生图使用的 Prompt 模板。系统模板仅可查看，自定义模板可编辑。
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          添加模板
        </Button>
      </div>

      <SettingsSegmentedControl
        items={TEMPLATE_SECTIONS.map((item) => ({
          id: item.key,
          label: item.title,
          icon: TEMPLATE_TAB_ICONS[item.key],
          suffix: `(${settings[item.key].length})`,
        }))}
        value={activeSection}
        onChange={(id) => setActiveSection(id as TemplateListKey)}
      />

      {isLayoutSection ? (
        <div className="inline-flex flex-wrap items-center gap-1.5">
          {LAYOUT_KIND_FILTERS.map((filter) => {
            const active = layoutKindFilter === filter
            const label = filter === 'all' ? '全部' : LAYOUT_KIND_LABEL[filter]
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setLayoutKindFilter(filter)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  active
                    ? 'border-foreground/20 bg-foreground text-background'
                    : 'border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                <span>{label}</span>
                <span className={cn(active ? 'text-background/70' : 'opacity-60')}>
                  ({layoutKindCounts[filter]})
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
        {filteredList.length === 0 ? (
          <GlassCard className="py-10 text-center text-sm text-muted-foreground">
            {isLayoutSection && layoutKindFilter !== 'all'
              ? `暂无「${LAYOUT_KIND_LABEL[layoutKindFilter]}」布局模板，点击「添加模板」开始配置`
              : `还没有${section.title}，点击「添加模板」开始配置`}
          </GlassCard>
        ) : (
          filteredList.map((template) => {
            const isSystem = Boolean(template.isBuiltin)
            const layoutKind = template.layoutKind
            return (
              <GlassCard key={template.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                      isSystem ? 'bg-cyan-500/10' : 'bg-violet-500/10',
                    )}
                  >
                    {isLayoutSection ? (
                      <LayoutGrid
                        className={cn('h-4 w-4', isSystem ? 'text-cyan-400' : 'text-violet-400')}
                      />
                    ) : (
                      <BookOpen
                        className={cn('h-4 w-4', isSystem ? 'text-cyan-400' : 'text-violet-400')}
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{template.name}</p>
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded font-medium',
                          isSystem
                            ? 'bg-muted/60 text-muted-foreground'
                            : 'bg-violet-500/15 text-violet-400',
                        )}
                      >
                        {isSystem ? '系统' : '自定义'}
                      </span>
                      {isLayoutSection && layoutKind ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-sky-500/10 text-sky-500">
                          {LAYOUT_KIND_LABEL[layoutKind]}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
                      key: {template.key}
                    </p>
                    {template.description ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {template.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/30">
                  {isSystem ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-2.5 text-xs"
                      onClick={() => openTemplate(template, true)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      查看
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs"
                        onClick={() => openTemplate(template, false)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        编辑
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 px-2.5 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleRemove(template)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </Button>
                    </>
                  )}
                </div>
              </GlassCard>
            )
          })
        )}
      </div>

      <TemplateConfigDialog
        open={dialogOpen}
        promptType={section.promptType as SettingsPromptType}
        initial={editingTemplate}
        previewOnly={previewOnly}
        existingKeys={existingKeys}
        defaultLayoutKind={isLayoutSection ? defaultLayoutKind : undefined}
        onClose={() => {
          setDialogOpen(false)
          setEditingTemplate(null)
          setPreviewOnly(false)
        }}
        onSave={handleSave}
      />
    </div>
  )
}
