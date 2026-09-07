import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoModelTagFieldProps {
  label: string
  placeholder: string
  tags: string[]
  onChange: (tags: string[]) => void
  inputMode?: 'text' | 'number'
  formatTag?: (value: string) => string
}

export function VideoModelTagField({
  label,
  placeholder,
  tags,
  onChange,
  inputMode = 'text',
  formatTag,
}: VideoModelTagFieldProps) {
  const [draft, setDraft] = useState('')

  const commit = () => {
    const raw = draft.trim()
    if (!raw) return
    const value = formatTag ? formatTag(raw) : raw
    if (!value || tags.includes(value)) {
      setDraft('')
      return
    }
    onChange([...tags, value])
    setDraft('')
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium">{label}</label>
      <div className="rounded-xl border border-border/40 bg-muted/30 px-2.5 py-2 space-y-2">
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag, index) => (
              <span
                key={`${tag}-${index}`}
                className="inline-flex items-center gap-1 rounded-md bg-background border border-border/40 px-2 py-0.5 text-xs"
              >
                {tag}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onChange(tags.filter((_, i) => i !== index))}
                  aria-label={`移除 ${tag}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <input
          type={inputMode === 'number' ? 'number' : 'text'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            }
          }}
          placeholder={placeholder}
          className={cn(
            'w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/50',
          )}
        />
      </div>
    </div>
  )
}

interface VideoDurationTagFieldProps {
  tags: number[]
  onChange: (tags: number[]) => void
}

export function VideoDurationTagField({ tags, onChange }: VideoDurationTagFieldProps) {
  return (
    <VideoModelTagField
      label="时长（秒）"
      placeholder="输入秒数后回车，如 10"
      inputMode="number"
      tags={tags.map((n) => `${n}秒`)}
      formatTag={(raw) => {
        const num = Number(raw)
        if (!Number.isFinite(num) || num <= 0) return ''
        return `${Math.round(num)}秒`
      }}
      onChange={(labels) => {
        const next = labels
          .map((label) => Number(String(label).replace(/秒$/u, '')))
          .filter((n) => Number.isFinite(n) && n > 0)
        onChange(Array.from(new Set(next)).sort((a, b) => a - b))
      }}
    />
  )
}
