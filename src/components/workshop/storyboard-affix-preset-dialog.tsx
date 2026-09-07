// Copyright (c) haode-ai-client. All rights reserved.

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Star, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/input'
import type { PromptAffixPreset } from '@/types/settings'
import { cn } from '@/lib/utils'

interface StoryboardAffixPresetDialogProps {
  open: boolean
  presets: PromptAffixPreset[]
  selectedPresetId: number
  onClose: () => void
  onSave: (presets: PromptAffixPreset[], selectedPresetId: number) => void
}

export function StoryboardAffixPresetDialog({
  open,
  presets,
  selectedPresetId,
  onClose,
  onSave,
}: StoryboardAffixPresetDialogProps) {
  const [draftPresets, setDraftPresets] = useState<PromptAffixPreset[]>(presets)
  const [draftSelectedId, setDraftSelectedId] = useState(selectedPresetId)
  const [draftPrefix, setDraftPrefix] = useState('')
  const [draftSuffix, setDraftSuffix] = useState('')

  useEffect(() => {
    if (!open) return
    setDraftPresets(presets)
    setDraftSelectedId(selectedPresetId)
  }, [open, presets, selectedPresetId])

  const currentPreset = useMemo(
    () => draftPresets.find((item) => item.id === draftSelectedId) ?? draftPresets[0],
    [draftPresets, draftSelectedId],
  )

  useEffect(() => {
    if (!currentPreset) return
    setDraftPrefix(currentPreset.prefix)
    setDraftSuffix(currentPreset.suffix)
  }, [currentPreset?.id, currentPreset?.prefix, currentPreset?.suffix])

  const syncCurrentPreset = (prefix: string, suffix: string) => {
    if (!currentPreset) return
    setDraftPresets((list) =>
      list.map((item) =>
        item.id === currentPreset.id ? { ...item, prefix, suffix } : item,
      ),
    )
  }

  const handleSelectPreset = (id: number) => {
    setDraftSelectedId(id)
    const preset = draftPresets.find((item) => item.id === id)
    if (preset) {
      setDraftPrefix(preset.prefix)
      setDraftSuffix(preset.suffix)
    }
  }

  const handleAddPreset = () => {
    const nextId = Math.max(0, ...draftPresets.map((item) => item.id)) + 1
    const next: PromptAffixPreset = {
      id: nextId,
      name: `预设 ${draftPresets.length + 1}`,
      prefix: '',
      suffix: '',
      isDefault: false,
    }
    setDraftPresets((list) => [...list, next])
    setDraftSelectedId(nextId)
    setDraftPrefix('')
    setDraftSuffix('')
  }

  const handleDeletePreset = () => {
    if (!currentPreset || draftPresets.length <= 1) return
    const nextList = draftPresets.filter((item) => item.id !== currentPreset.id)
    const fallback = nextList[0]
    setDraftPresets(nextList)
    setDraftSelectedId(fallback.id)
    setDraftPrefix(fallback.prefix)
    setDraftSuffix(fallback.suffix)
  }

  const handleSetDefault = () => {
    if (!currentPreset) return
    setDraftPresets((list) =>
      list.map((item) => ({ ...item, isDefault: item.id === currentPreset.id })),
    )
  }

  const handleRename = (name: string) => {
    if (!currentPreset) return
    setDraftPresets((list) =>
      list.map((item) => (item.id === currentPreset.id ? { ...item, name } : item)),
    )
  }

  const handleSave = () => {
    if (!currentPreset) return
    const synced = draftPresets.map((item) =>
      item.id === currentPreset.id
        ? { ...item, prefix: draftPrefix, suffix: draftSuffix }
        : item,
    )
    onSave(synced, draftSelectedId)
    onClose()
  }

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-stretch justify-end bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-[480px] flex-col border-l border-border/60 bg-[#0d0f14] shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <h2 className="text-sm font-medium text-foreground">前后缀预设管理</h2>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-foreground">选择预设</Label>
              <Button type="button" size="sm" variant="primary-gradient" className="h-7 text-[11px]" onClick={handleAddPreset}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                新增预设
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Select
                className="flex-1 h-8 text-xs"
                value={String(draftSelectedId)}
                options={draftPresets.map((item) => ({
                  value: String(item.id),
                  label: `${item.name}${item.isDefault ? ' (默认)' : ''}`,
                }))}
                onChange={(value) => handleSelectPreset(Number(value))}
              />
              {currentPreset && !currentPreset.isDefault ? (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2" title="设为默认" onClick={handleSetDefault}>
                  <Star className="h-3.5 w-3.5" />
                </Button>
              ) : null}
              {draftPresets.length > 1 ? (
                <Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-destructive" title="删除当前预设" onClick={handleDeletePreset}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

          {currentPreset ? (
            <>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">预设名称</Label>
                <input
                  value={currentPreset.name}
                  onChange={(event) => handleRename(event.target.value)}
                  className="h-8 w-full rounded-md border border-border/60 bg-background/40 px-2.5 text-xs"
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                编辑「{currentPreset.name}」
              </p>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  前缀（生图/视频时自动添加在描述前面）
                </Label>
                <Textarea
                  value={draftPrefix}
                  onChange={(event) => {
                    setDraftPrefix(event.target.value)
                    syncCurrentPreset(event.target.value, draftSuffix)
                  }}
                  rows={3}
                  className="resize-none text-xs"
                  placeholder="输入固定前缀，如风格描述..."
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  后缀（生图/视频时自动添加在描述后面）
                </Label>
                <Textarea
                  value={draftSuffix}
                  onChange={(event) => {
                    setDraftSuffix(event.target.value)
                    syncCurrentPreset(draftPrefix, event.target.value)
                  }}
                  rows={3}
                  className="resize-none text-xs"
                  placeholder="输入固定后缀，如质量要求..."
                />
              </div>

              <div className="space-y-2 rounded-lg border border-border/40 bg-muted/10 p-3">
                <p className="text-[11px] text-muted-foreground">效果预览</p>
                <p className="text-xs leading-relaxed break-words">
                  <span className="text-emerald-400">{draftPrefix.trim() || '(无前缀)'}</span>
                  {draftPrefix.trim() ? ' ' : ''}
                  <span className="text-foreground/90">[角色/场景描述]</span>
                  {draftSuffix.trim() ? ' ' : ''}
                  <span className={cn(draftSuffix.trim() ? 'text-amber-400' : 'text-muted-foreground')}>
                    {draftSuffix.trim() || '(无后缀)'}
                  </span>
                </p>
              </div>
            </>
          ) : null}
        </div>

        <div className="border-t border-border/40 px-5 py-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button type="button" variant="primary-gradient" size="sm" onClick={handleSave}>
            保存
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
