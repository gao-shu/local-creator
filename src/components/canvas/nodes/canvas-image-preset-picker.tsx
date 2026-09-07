// Copyright (c) local-creator contributors. All rights reserved.

import { ChevronDown } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CANVAS_NODE_COMPACT_SELECT,
  CANVAS_NODE_DROPDOWN,
  CANVAS_NODE_DROPDOWN_ITEM,
  CANVAS_NODE_SUBTEXT,
} from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'

export interface CanvasImagePresetOption {
  value: string
  label: string
}

interface CanvasImagePresetPickerProps {
  options: CanvasImagePresetOption[]
  value: string
  onChange: (value: string) => void
  /** 未选中时按钮文案 */
  emptyLabel?: string
  title?: string
  className?: string
  triggerClassName?: string
  menuMinWidth?: number
}

/** 画布控制台向上展开下拉（风格 / 布局格式等），菜单挂到 body 避免被控制台 overflow 裁切 */
export function CanvasImagePresetPicker({
  options,
  value,
  onChange,
  emptyLabel = '风格',
  title,
  className,
  triggerClassName,
  menuMinWidth = 188,
}: CanvasImagePresetPickerProps) {
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<{ left: number; top: number; minWidth: number } | null>(
    null,
  )
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const selected = options.find((item) => item.value === value)
  const triggerLabel = selected?.label || emptyLabel

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuHeight = menuRef.current?.offsetHeight ?? 240
    const gap = 6
    let top = rect.top - menuHeight - gap
    if (top < 8) top = rect.bottom + gap
    setMenuStyle({
      left: rect.left,
      top,
      minWidth: Math.max(menuMinWidth, rect.width),
    })
  }, [menuMinWidth])

  useEffect(() => {
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

  useEffect(() => {
    if (open) updateMenuPosition()
  }, [open, options.length, updateMenuPosition])

  if (!options.length) {
    return <span className={cn('px-1.5 text-[12px]', CANVAS_NODE_SUBTEXT, className)}>{emptyLabel}</span>
  }

  return (
    <>
      <div ref={rootRef} className={cn('relative shrink-0 nodrag nopan', className)}>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          title={title || (selected ? `${emptyLabel}：${selected.label}` : emptyLabel)}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation()
            setOpen((prev) => !prev)
          }}
          className={cn(
            'flex h-7 max-w-[108px] items-center gap-0.5 rounded-md px-1.5 text-[12px]',
            CANVAS_NODE_COMPACT_SELECT,
            selected && 'text-foreground/90',
            triggerClassName,
          )}
        >
          <span className="min-w-0 truncate">{triggerLabel}</span>
          <ChevronDown
            className={cn('h-3 w-3 shrink-0 opacity-60 transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>

      {open && menuStyle
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className={cn(
                'fixed z-[260] max-h-[300px] overflow-y-auto py-1 shadow-xl nodrag nopan',
                CANVAS_NODE_DROPDOWN,
              )}
              style={{
                left: menuStyle.left,
                top: menuStyle.top,
                minWidth: menuStyle.minWidth,
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {options.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={item.value === value}
                  className={cn(
                    'block w-full px-3 py-2 text-left text-[12px] transition-colors',
                    CANVAS_NODE_DROPDOWN_ITEM,
                    item.value === value
                      ? 'bg-muted/70 text-foreground/90 dark:bg-white/10 dark:text-white/90'
                      : undefined,
                  )}
                  onClick={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
