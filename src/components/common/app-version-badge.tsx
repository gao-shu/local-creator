import { useEffect, useState } from 'react'
import { isElectronApp } from '@/lib/update/app-updater'
import { cn } from '@/lib/utils'

declare const __APP_VERSION__: string

export function AppVersionBadge({ className }: { className?: string }) {
  const [version, setVersion] = useState(() =>
    typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '',
  )

  useEffect(() => {
    if (!isElectronApp()) return
    void window.electronAPI?.getAppVersion().then((res) => {
      const payload = res as { success?: boolean; version?: string }
      if (payload?.success && payload.version) {
        setVersion(payload.version)
      }
    })
  }, [])

  if (!version) return null

  return (
    <span className={cn('text-xs tabular-nums select-none', className)} title={`版本 ${version}`}>
      v{version}
    </span>
  )
}
