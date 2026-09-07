// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

const POPOVER_GAP = 8
const VIEWPORT_PADDING = 8

export type CanvasParamsPopoverStyle = {
  left: number
  top: number
  width: number
  transform?: string
}

export function measureCanvasParamsPopoverStyle(
  trigger: HTMLElement,
  menu: HTMLElement | null,
  minWidth: number,
): CanvasParamsPopoverStyle {
  const rect = trigger.getBoundingClientRect()
  const menuHeight = menu?.offsetHeight ?? 0
  const width = Math.max(minWidth, rect.width)

  let left = rect.left
  const maxLeft = window.innerWidth - width - VIEWPORT_PADDING
  if (left > maxLeft) left = Math.max(VIEWPORT_PADDING, maxLeft)
  if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING

  const anchorAboveTop = rect.top - POPOVER_GAP
  const fitsAbove = menuHeight <= 0 || anchorAboveTop - menuHeight >= VIEWPORT_PADDING

  if (fitsAbove) {
    return { left, top: anchorAboveTop, width, transform: 'translateY(-100%)' }
  }

  return { left, top: rect.bottom + POPOVER_GAP, width }
}

/** 画布节点控制台参数弹窗：紧贴触发按钮，优先向上展开 */
export function useCanvasParamsPopoverPosition(open: boolean, minWidth: number) {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuStyle, setMenuStyle] = useState<CanvasParamsPopoverStyle | null>(null)

  const updateMenuPosition = useCallback(() => {
    const trigger = rootRef.current
    if (!trigger) return
    setMenuStyle(measureCanvasParamsPopoverStyle(trigger, menuRef.current, minWidth))
  }, [minWidth])

  const schedulePositionUpdate = useCallback(() => {
    requestAnimationFrame(() => {
      updateMenuPosition()
      requestAnimationFrame(updateMenuPosition)
    })
  }, [updateMenuPosition])

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(null)
      return
    }
    updateMenuPosition()
  }, [open, updateMenuPosition])

  useEffect(() => {
    if (!open) return

    schedulePositionUpdate()

    const onLayout = () => updateMenuPosition()
    window.addEventListener('resize', onLayout)
    window.addEventListener('scroll', onLayout, true)
    return () => {
      window.removeEventListener('resize', onLayout)
      window.removeEventListener('scroll', onLayout, true)
    }
  }, [open, schedulePositionUpdate, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    const menu = menuRef.current
    if (!menu || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(() => updateMenuPosition())
    observer.observe(menu)
    return () => observer.disconnect()
  }, [open, updateMenuPosition])

  return { rootRef, menuRef, menuStyle }
}
