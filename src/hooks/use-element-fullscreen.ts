// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

export function useElementFullscreen<T extends HTMLElement>(): {
  ref: RefObject<T>
  active: boolean
  toggle: () => Promise<void>
  exit: () => Promise<void>
} {
  const ref = useRef<T>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const onChange = () => {
      const element = ref.current
      setActive(Boolean(element && document.fullscreenElement === element))
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  }, [])

  const toggle = useCallback(async () => {
    const element = ref.current
    if (!element) return
    if (document.fullscreenElement === element) {
      await exit()
      return
    }
    await element.requestFullscreen()
  }, [exit])

  return { ref, active, toggle, exit }
}
