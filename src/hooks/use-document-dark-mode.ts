// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'

/** 同步 document.documentElement 的 dark class（与 AnimatedThemeToggler 一致） */
export function useDocumentDarkMode() {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' ? document.documentElement.classList.contains('dark') : true,
  )

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return dark
}
