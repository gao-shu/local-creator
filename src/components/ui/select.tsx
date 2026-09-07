import * as React from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectOption {
  value: string
  label: string
  /** 下拉展开时的展示文案；未设则与 label 相同 */
  menuLabel?: string
  /** 右侧副文案（如单价），与主文案分列展示 */
  suffix?: string
  /** 系统模型：仅渲染微小色点，不展示「外部/内部 API」长文案 */
  systemBadgeTone?: 'internal' | 'external'
  disabled?: boolean
  /** 下拉分组标题（同组连续项只渲染一次标题） */
  group?: string
}

function systemBadgeDotClass(tone: NonNullable<SelectOption['systemBadgeTone']>): string {
  return tone === 'internal' ? 'bg-emerald-500' : 'bg-sky-500'
}

function SelectOptionContent({
  opt,
  compactMenu,
  hideSuffixInMenu = false,
}: {
  opt: SelectOption
  compactMenu?: boolean
  hideSuffixInMenu?: boolean
}) {
  const title = opt.systemBadgeTone === 'internal' ? '内部' : opt.systemBadgeTone === 'external' ? '外部' : undefined
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {opt.systemBadgeTone ? (
          <span
            className={cn('h-1.5 w-1.5 shrink-0 rounded-full', systemBadgeDotClass(opt.systemBadgeTone))}
            title={title}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 truncate">{opt.menuLabel ?? opt.label}</span>
      </span>
      {opt.suffix && !hideSuffixInMenu ? (
        <span
          className={cn(
            'shrink-0 text-muted-foreground',
            compactMenu ? 'text-[10px]' : 'text-xs',
          )}
        >
          {opt.suffix}
        </span>
      ) : null}
    </>
  )
}

const DROPDOWN_MENU_GAP = 4
const DROPDOWN_MENU_MAX_HEIGHT = 224

type DropdownMenuStyle = {
  left: number
  top: number
  minWidth: number
  maxHeight: number
  transform?: string
}

/** 贴近视口底部时向上展开，避免下拉被裁切无法点击 */
function computeDropdownMenuStyle(trigger: HTMLElement): DropdownMenuStyle {
  const rect = trigger.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_MENU_GAP
  const spaceAbove = rect.top - DROPDOWN_MENU_GAP
  const openUpward = spaceBelow < 160 && spaceAbove > spaceBelow

  if (openUpward) {
    return {
      left: rect.left,
      top: rect.top - DROPDOWN_MENU_GAP,
      minWidth: rect.width,
      maxHeight: Math.max(120, Math.min(DROPDOWN_MENU_MAX_HEIGHT, spaceAbove)),
      transform: 'translateY(-100%)',
    }
  }

  return {
    left: rect.left,
    top: rect.bottom + DROPDOWN_MENU_GAP,
    minWidth: rect.width,
    maxHeight: Math.max(120, Math.min(DROPDOWN_MENU_MAX_HEIGHT, spaceBelow)),
  }
}

export interface SelectFooterAction {
  label: string
  onSelect: () => void
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  'onChange'
> {
  options: SelectOption[]
  placeholder?: string
  onChange?: (value: string) => void
  /** 底部操作项（如「去配置」），与选项分区展示 */
  footerAction?: SelectFooterAction
  /** 紧凑菜单：更小字号与行高，适合侧栏窄面板 */
  compactMenu?: boolean
  /** 触发器仅展示主文案（模型名等） */
  hideSuffixInTrigger?: boolean
  /** 下拉菜单也不展示 suffix（画布模型选择等） */
  hideSuffixInMenu?: boolean
}

function SelectMenu({
  className,
  options,
  placeholder,
  value,
  onChange,
  footerAction,
  disabled,
  compactMenu = false,
  hideSuffixInTrigger = false,
  hideSuffixInMenu = false,
  'data-testid': dataTestId,
}: SelectProps) {
  const [open, setOpen] = React.useState(false)
  const [menuStyle, setMenuStyle] = React.useState<DropdownMenuStyle | null>(null)
  const rootRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const stringValue = value != null ? String(value) : ''
  const hasValue = stringValue !== ''
  const selectedOption = options.find((opt) => opt.value === stringValue)
  const hasMatchingOption = Boolean(selectedOption)
  const displayLabel = selectedOption?.label ?? (hasValue ? stringValue : placeholder)

  const updateMenuPosition = React.useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    setMenuStyle(computeDropdownMenuStyle(trigger))
  }, [])

  React.useEffect(() => {
    if (!open) return
    updateMenuPosition()
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onLayout = () => updateMenuPosition()
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, updateMenuPosition])

  React.useLayoutEffect(() => {
    if (open) updateMenuPosition()
  }, [open, options.length, updateMenuPosition])

  const renderItems = React.useMemo(() => {
    const items: Array<{ type: 'header'; label: string } | { type: 'option'; opt: SelectOption }> = []
    let lastGroup: string | undefined
    for (const opt of options) {
      if (opt.group && opt.group !== lastGroup) {
        items.push({ type: 'header', label: opt.group })
        lastGroup = opt.group
      }
      items.push({ type: 'option', opt })
    }
    return items
  }, [options])

  return (
    <div ref={rootRef} className="nodrag nopan relative">
      <button
        ref={triggerRef}
        type="button"
        data-testid={dataTestId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((prev) => !prev)
        }}
        className={cn(
          'nodrag nopan flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border/30 bg-background/40 px-3 py-1 text-sm text-foreground',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span
            className={cn(
              'flex min-w-0 flex-1 items-center gap-1.5 truncate text-left',
              !hasMatchingOption && !hasValue && 'text-muted-foreground',
            )}
          >
            {selectedOption?.systemBadgeTone ? (
              <span
                className={cn(
                  'h-1.5 w-1.5 shrink-0 rounded-full',
                  systemBadgeDotClass(selectedOption.systemBadgeTone),
                )}
                aria-hidden
              />
            ) : null}
            <span className="truncate">{displayLabel}</span>
          </span>
          {selectedOption?.suffix && !hideSuffixInTrigger ? (
            <span className="shrink-0 text-xs text-muted-foreground">{selectedOption.suffix}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              data-canvas-console-aux=""
              onPointerDown={(event) => event.stopPropagation()}
              className={cn(
                'nodrag nopan fixed z-[260] max-w-[min(280px,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-border/40',
                'bg-popover text-popover-foreground shadow-lg shadow-black/20',
              )}
              style={{
                left: menuStyle.left,
                top: menuStyle.top,
                minWidth: menuStyle.minWidth,
                maxHeight: menuStyle.maxHeight,
                transform: menuStyle.transform,
              }}
            >
              <ul className="py-0.5">
                {renderItems.map((item, index) =>
                  item.type === 'header' ? (
                    <li
                      key={`group-${item.label}-${index}`}
                      className={cn(
                        'px-2.5 pb-0.5 pt-1.5 text-[9px] font-normal leading-none tracking-wide text-muted-foreground/70',
                        compactMenu ? 'pt-1' : 'pt-1.5',
                      )}
                    >
                      {item.label}
                    </li>
                  ) : (
                    <li key={item.opt.value}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={item.opt.value === stringValue}
                        disabled={item.opt.disabled}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 px-2.5 text-left transition-colors',
                          compactMenu ? 'py-1 text-xs' : 'py-2 text-sm',
                          item.opt.value === stringValue
                            ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300'
                            : 'text-foreground hover:bg-muted/60',
                          item.opt.disabled && 'cursor-not-allowed opacity-50',
                        )}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => {
                          event.stopPropagation()
                          if (item.opt.disabled) return
                          onChange?.(item.opt.value)
                          setOpen(false)
                        }}
                      >
                        <SelectOptionContent
                          opt={item.opt}
                          compactMenu={compactMenu}
                          hideSuffixInMenu={hideSuffixInMenu}
                        />
                      </button>
                    </li>
                  ),
                )}
              </ul>

              {footerAction ? (
                <>
                  <div className="border-t border-border/40" />
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm transition-colors',
                      'text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/10',
                    )}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation()
                      footerAction.onSelect()
                      setOpen(false)
                    }}
                  >
                    <Settings2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{footerAction.label}</span>
                  </button>
                </>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      options,
      placeholder,
      value,
      onChange,
      footerAction,
      compactMenu,
      hideSuffixInTrigger,
      hideSuffixInMenu,
      ...props
    },
    _ref,
  ) => {
    void _ref
    return (
      <SelectMenu
        className={className}
        options={options}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        footerAction={footerAction}
        compactMenu={compactMenu}
        hideSuffixInTrigger={hideSuffixInTrigger}
        hideSuffixInMenu={hideSuffixInMenu}
        disabled={props.disabled}
        data-testid={props['data-testid']}
      />
    )
  },
)
Select.displayName = 'Select'
