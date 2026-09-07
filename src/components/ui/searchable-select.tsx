import * as React from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CANVAS_INPUT_PLACEHOLDER } from '@/lib/canvas/canvas-node-theme'
import { fuzzyMatchText } from '@/lib/utils/fuzzy-match'

export interface SearchableSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface SearchableSelectProps {
  options: SearchableSelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyHint?: string
  disabled?: boolean
  className?: string
  /** 受控展开（用于同一表单内多个下拉互斥） */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** E2E / 自动化：触发按钮 test id */
  triggerTestId?: string
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = '请选择',
  searchPlaceholder = '输入关键字搜索…',
  emptyHint = '无匹配项',
  disabled = false,
  className,
  open: openControlled,
  onOpenChange,
  triggerTestId,
}: SearchableSelectProps) {
  const [openInternal, setOpenInternal] = React.useState(false)
  const open = openControlled ?? openInternal
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (openControlled === undefined) {
        setOpenInternal(next)
      }
      onOpenChange?.(next)
    },
    [openControlled, onOpenChange],
  )

  const [query, setQuery] = React.useState('')
  const [menuStyle, setMenuStyle] = React.useState<{
    left: number
    top: number
    minWidth: number
    maxHeight: number
    transform?: string
  } | null>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const searchRef = React.useRef<HTMLInputElement>(null)

  const selected = options.find((opt) => opt.value === value)
  const filtered = React.useMemo(
    () => options.filter((opt) => fuzzyMatchText(opt.label, query)),
    [options, query],
  )

  const closeMenu = React.useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [setOpen])

  const updateMenuPosition = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 4
    const maxHeight = 224
    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap
    const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow
    if (openUpward) {
      setMenuStyle({
        left: rect.left,
        top: rect.top - gap,
        minWidth: rect.width,
        maxHeight: Math.max(120, Math.min(maxHeight, spaceAbove)),
        transform: 'translateY(-100%)',
      })
      return
    }
    setMenuStyle({
      left: rect.left,
      top: rect.bottom + gap,
      minWidth: rect.width,
      maxHeight: Math.max(120, Math.min(maxHeight, spaceBelow)),
    })
  }, [])

  React.useEffect(() => {
    if (!open) return
    updateMenuPosition()
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0)
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      closeMenu()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const onLayout = () => updateMenuPosition()
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, updateMenuPosition, closeMenu])

  const pick = (next: string) => {
    onChange(next)
    closeMenu()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid={triggerTestId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setOpen(!open)
        }}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/50 px-3.5 py-2 text-sm',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus:border-primary/50',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className={cn('truncate text-left', !selected && 'text-muted-foreground')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className={cn(
                'fixed z-[260] overflow-hidden rounded-xl border border-border/40',
                'bg-popover text-popover-foreground shadow-lg shadow-black/20',
              )}
              style={{
                left: menuStyle.left,
                top: menuStyle.top,
                minWidth: menuStyle.minWidth,
                width: menuStyle.minWidth,
                maxHeight: menuStyle.maxHeight,
                transform: menuStyle.transform,
              }}
            >
              <div className="flex items-center gap-2 border-b border-border/30 px-3 py-2">
                <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className={cn('min-w-0 flex-1 bg-transparent text-sm outline-none', CANVAS_INPUT_PLACEHOLDER)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filtered[0] && !filtered[0].disabled) {
                      pick(filtered[0].value)
                    }
                  }}
                />
              </div>
              <ul className="max-h-[calc(100%-3rem)] overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">{emptyHint}</li>
                ) : (
                  filtered.map((opt) => (
                    <li key={opt.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={opt.value === value}
                        disabled={opt.disabled}
                        className={cn(
                          'flex w-full px-3 py-2 text-left text-sm transition-colors',
                          opt.value === value
                            ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                            : 'text-foreground hover:bg-muted/60',
                          opt.disabled && 'cursor-not-allowed opacity-50',
                        )}
                        onClick={() => {
                          if (opt.disabled) return
                          pick(opt.value)
                        }}
                      >
                        <span className="truncate">{opt.label}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
