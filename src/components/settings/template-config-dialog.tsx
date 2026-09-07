import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Loader2, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { cn, generateUUID } from '@/lib/utils'
import type { LayoutTemplateKind, PromptTemplate, SettingsPromptType } from '@/types/settings'
import { createEmptyTemplate } from '@/lib/storage/settings-defaults'
import { Select } from '@/components/ui/select'

interface TemplateConfigDialogProps {
  open: boolean
  promptType: SettingsPromptType
  initial?: PromptTemplate | null
  previewOnly?: boolean
  /** 同列表已有 key（编辑时不含自身），用于冲突校验 */
  existingKeys?: string[]
  /** 新建布局模板时的默认适用类型 */
  defaultLayoutKind?: LayoutTemplateKind
  onClose: () => void
  onSave: (template: PromptTemplate) => void
}

const SECTION_LABEL: Record<SettingsPromptType, string> = {
  extract: '提取模板',
  style: '风格模板',
  storyboard: '分镜模板',
  layout: '布局模板',
}

const LAYOUT_KIND_OPTIONS: Array<{ value: LayoutTemplateKind; label: string }> = [
  { value: 'character', label: '角色' },
  { value: 'scene', label: '场景' },
  { value: 'prop', label: '道具' },
]

const LAYOUT_KIND_LABEL: Record<LayoutTemplateKind, string> = {
  character: '角色',
  scene: '场景',
  prop: '道具',
}

const inputClass = cn(
  'w-full px-3.5 py-2.5 rounded-xl text-sm',
  'bg-muted/50 border border-border/40',
  'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
  'placeholder:text-muted-foreground/50 transition-all',
  'disabled:opacity-70 disabled:cursor-not-allowed',
)

export function TemplateConfigDialog({
  open,
  promptType,
  initial,
  previewOnly = false,
  existingKeys = [],
  defaultLayoutKind,
  onClose,
  onSave,
}: TemplateConfigDialogProps) {
  const isEdit = Boolean(initial?.id)
  const readonly = previewOnly || Boolean(initial?.isBuiltin)
  const isLayout = promptType === 'layout'
  const [form, setForm] = useState<PromptTemplate>(() => createEmptyTemplate(promptType))
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    if (initial) {
      setForm({ ...initial })
    } else {
      const empty = createEmptyTemplate(promptType)
      if (promptType === 'layout' && defaultLayoutKind) {
        empty.layoutKind = defaultLayoutKind
        empty.key = `layout_${defaultLayoutKind}_custom_${Date.now()}`
      }
      setForm(empty)
    }
    setError('')
    setCopied(false)
  }, [open, initial, promptType, defaultLayoutKind])

  const patch = useCallback(
    (next: Partial<PromptTemplate>) => {
      if (readonly) return
      setForm((prev) => ({ ...prev, ...next }))
    },
    [readonly],
  )

  const handleClose = useCallback(() => {
    setError('')
    setCopied(false)
    onClose()
  }, [onClose])

  const handleCopyContent = useCallback(async () => {
    const text = form.content
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('已复制到剪贴板')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('复制失败')
    }
  }, [form.content])

  const validate = () => {
    if (readonly) return true
    if (!form.name.trim()) {
      setError('请填写模板名称')
      return false
    }
    if (!form.key.trim()) {
      setError('请填写模板 Key')
      return false
    }
    if (existingKeys.includes(form.key.trim())) {
      setError('Key 已存在，请换一个')
      return false
    }
    if (isLayout && !form.layoutKind) {
      setError('请选择适用类型（角色 / 场景 / 道具）')
      return false
    }
    if (!form.content.trim()) {
      setError(isLayout ? '请填写布局 Prompt 内容' : '请填写 Prompt 内容')
      return false
    }
    return true
  }

  const handleSubmit = async () => {
    if (readonly) {
      handleClose()
      return
    }
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      onSave({
        ...form,
        id: form.id || generateUUID(),
        name: form.name.trim(),
        key: form.key.trim(),
        content: form.content.trim(),
        promptType,
        ...(isLayout
          ? { layoutKind: form.layoutKind ?? 'character' }
          : { layoutKind: undefined }),
      })
      handleClose()
    } catch (err: unknown) {
      const e = err as Error
      setError(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const title = readonly
    ? isLayout
      ? '查看布局模板'
      : '查看提示词模板'
    : isEdit
      ? isLayout
        ? '编辑布局模板'
        : '编辑提示词模板'
      : isLayout
        ? '新建布局模板'
        : '新建提示词模板'

  const subtitle = isLayout
    ? `${SECTION_LABEL[promptType]} · 拼入资产生图 Prompt，决定参考图版式`
    : `${SECTION_LABEL[promptType]} · 用于 AI 推理时的 Prompt 内容`

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-4xl h-[min(88vh,900px)] flex flex-col"
            >
              <div
                className={cn(
                  'rounded-2xl border border-border/40',
                  'bg-card shadow-2xl shadow-black/20',
                  'flex flex-col overflow-hidden h-full min-h-0',
                )}
              >
                <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                    {readonly ? (
                      <p className="text-xs text-muted-foreground mt-1">
                        系统模板不可修改，仅供查看
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="px-6 flex-1 min-h-0 flex flex-col gap-4 pb-2 overflow-hidden">
                  <div className="grid gap-4 sm:grid-cols-2 shrink-0">
                    <div>
                      <label className="block text-sm font-medium mb-1.5">模板名称</label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => patch({ name: e.target.value })}
                        placeholder={isLayout ? '例如：自定义三视图' : '例如：标准提取模板'}
                        className={inputClass}
                        disabled={readonly}
                        autoFocus={!readonly}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1.5">Key</label>
                      <input
                        type="text"
                        value={form.key}
                        onChange={(e) => patch({ key: e.target.value })}
                        placeholder={
                          isLayout
                            ? '例如：layout_character_custom_01'
                            : '例如：extract_standard'
                        }
                        className={inputClass}
                        disabled={readonly}
                      />
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {isLayout
                          ? '建议以 layout_ 开头，且勿与系统布局 Key 重复'
                          : '创作流程中通过 Key 引用此模板'}
                      </p>
                    </div>
                  </div>

                  {isLayout ? (
                    <div className="shrink-0 max-w-xs">
                      <label className="block text-sm font-medium mb-1.5">适用类型</label>
                      {readonly ? (
                        <p className="text-sm text-muted-foreground px-1 py-2">
                          {form.layoutKind
                            ? LAYOUT_KIND_LABEL[form.layoutKind]
                            : '未指定'}
                        </p>
                      ) : (
                        <Select
                          value={form.layoutKind ?? 'character'}
                          onChange={(value) =>
                            patch({ layoutKind: value as LayoutTemplateKind })
                          }
                          options={LAYOUT_KIND_OPTIONS}
                        />
                      )}
                    </div>
                  ) : null}

                  {form.description ? (
                    <div className="shrink-0">
                      <label className="block text-sm font-medium mb-1.5">描述</label>
                      <p className="text-sm text-muted-foreground px-1">{form.description}</p>
                    </div>
                  ) : null}

                  {!readonly && isLayout ? (
                    <div className="shrink-0">
                      <label className="block text-sm font-medium mb-1.5">描述（可选）</label>
                      <input
                        type="text"
                        value={form.description ?? ''}
                        onChange={(e) => patch({ description: e.target.value })}
                        placeholder="简要说明此布局的用途"
                        className={inputClass}
                      />
                    </div>
                  ) : null}

                  <div className="flex flex-1 min-h-0 flex-col">
                    <label className="block text-sm font-medium mb-1.5 shrink-0">
                      {isLayout ? '布局 Prompt' : 'Prompt 内容'}
                    </label>
                    {readonly && !form.content.trim() ? (
                      <div className="flex-1 min-h-[320px] rounded-xl border border-dashed border-border/50 bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground flex items-center justify-center">
                        该模板在生成分镜时由系统自动组合提示词，暂无固定 Prompt 可预览。
                      </div>
                    ) : (
                      <div className="relative flex flex-1 min-h-0 flex-col">
                        <textarea
                          value={form.content}
                          onChange={(e) => patch({ content: e.target.value })}
                          placeholder={
                            isLayout
                              ? '布局 prompt，将拼在资产描述后用于生图…'
                              : '输入 Prompt 模板内容，可使用 {content} 等占位符'
                          }
                          className={cn(
                            inputClass,
                            'w-full flex-1 min-h-[320px] font-mono text-xs leading-relaxed resize-none pr-11',
                          )}
                          disabled={readonly}
                          readOnly={readonly}
                        />
                        {form.content.trim() ? (
                          <button
                            type="button"
                            aria-label="Copy prompt content"
                            title="Copy"
                            onClick={() => void handleCopyContent()}
                            className={cn(
                              'absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg',
                              'border border-border/40 bg-background/80 text-muted-foreground backdrop-blur-sm',
                              'transition-colors hover:bg-muted hover:text-foreground',
                            )}
                          >
                            {copied ? (
                              <Check className="h-4 w-4 text-emerald-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {error ? <p className="text-sm text-destructive shrink-0">{error}</p> : null}
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-border/20 shrink-0">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="px-4 py-2 rounded-xl text-sm font-medium hover:bg-muted transition-colors"
                  >
                    {readonly ? '关闭' : '取消'}
                  </button>
                  {!readonly ? (
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      disabled={saving}
                      className={cn(
                        'px-5 py-2 rounded-xl text-sm font-medium',
                        'bg-primary text-primary-foreground',
                        'hover:opacity-90 active:scale-[0.98] transition-all',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {saving ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          保存中...
                        </span>
                      ) : isEdit ? (
                        '保存'
                      ) : (
                        '创建'
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
