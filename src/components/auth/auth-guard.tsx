// Copyright (c) local-creator. All rights reserved.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'

function useAuthHydrated() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const unsub = useAuthStore.persist.onFinishHydration(onStoreChange)
      return unsub
    },
    () => useAuthStore.persist.hasHydrated(),
    () => false,
  )
}

function useLocalSessionBootstrap() {
  const hydrated = useAuthHydrated()
  const bootstrapLocalSession = useAuthStore((s) => s.bootstrapLocalSession)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!hydrated) return
    bootstrapLocalSession()
    setReady(true)
  }, [bootstrapLocalSession, hydrated])

  return { hydrated, ready }
}

function BootSpinner({ dark }: { dark?: boolean }) {
  return (
    <div
      className={
        dark
          ? 'min-h-screen flex items-center justify-center bg-black'
          : 'min-h-screen flex items-center justify-center bg-background'
      }
    >
      <Loader2 className={dark ? 'h-8 w-8 animate-spin text-white/50' : 'h-8 w-8 animate-spin text-muted-foreground'} />
    </div>
  )
}

/** 开源版：仅本地会话，永不强制公司登录 */
export function AuthGuard() {
  const { hydrated, ready } = useLocalSessionBootstrap()

  if (!hydrated || !ready) {
    return <BootSpinner />
  }

  return <Outlet />
}

/** 登录路由：一律回工作台（保留书签兼容） */
export function GuestGuard() {
  const { hydrated, ready } = useLocalSessionBootstrap()

  if (!hydrated || !ready) {
    return <BootSpinner dark />
  }

  return <Navigate to="/dashboard" replace />
}

/** 开源版无云会话过期逻辑 */
export function AuthSessionListener() {
  return null
}
