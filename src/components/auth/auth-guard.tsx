import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { resolveApiBase } from '@/lib/auth/api-base'
import {
  hasPersistedRealToken,
  isLoginRequired,
  isOptionalLoginIntent,
} from '@/lib/auth/login-mode'
import { AUTH_SESSION_EXPIRED_EVENT } from '@/lib/auth/session-expired'
import { useSettingsStore } from '@/stores/settings-store'
import { selectIsAuthenticated, useAuthStore } from '@/stores/auth-store'

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

function useSessionBootstrap() {
  const hydrated = useAuthHydrated()
  const token = useAuthStore((s) => s.token)
  const bootstrapLocalSession = useAuthStore((s) => s.bootstrapLocalSession)
  const validateSession = useAuthStore((s) => s.validateSession)
  const settings = useSettingsStore((s) => s.settings)
  const apiBase = resolveApiBase(settings?.apiBaseUrl)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!hydrated) return

    let cancelled = false

    async function run() {
      try {
        if (!isLoginRequired()) {
          bootstrapLocalSession()
          return
        }

        if (!hasPersistedRealToken(token)) return

        await validateSession(apiBase)
      } catch {
        /* validateSession 已兜底；此处防止未预期异常卡住启动 */
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [apiBase, bootstrapLocalSession, hydrated, token, validateSession])

  return { hydrated, ready }
}

export function AuthGuard() {
  const location = useLocation()
  const { hydrated, ready } = useSessionBootstrap()
  const isAuthenticated = useAuthStore(selectIsAuthenticated)

  if (!hydrated || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isLoginRequired() && !isAuthenticated) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?redirect=${redirect}`} replace />
  }

  return <Outlet />
}

/** 登录页：已登录时跳回工作台；本地模式默认不进登录页，intent=login 时允许 */
export function GuestGuard() {
  const { hydrated, ready } = useSessionBootstrap()
  const token = useAuthStore((s) => s.token)
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  const redirect = params.get('redirect') || '/dashboard'
  const sessionExpired = params.get('reason') === 'session_expired'
  const loginRequired = isLoginRequired()
  const hasRealSession = hasPersistedRealToken(token)
  const optionalLogin = !loginRequired && isOptionalLoginIntent(location.search)

  if (!hydrated || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  if (loginRequired) {
    // 会话过期重登：即使本地仍残留 Token，也允许停留在登录页
    if (hasRealSession && !sessionExpired) {
      return <Navigate to={redirect.startsWith('/') ? redirect : '/dashboard'} replace />
    }
    return <Outlet />
  }

  if (optionalLogin && !hasRealSession) {
    return <Outlet />
  }

  if (hasRealSession) {
    return <Navigate to={redirect.startsWith('/') ? redirect : '/dashboard'} replace />
  }

  return <Navigate to={redirect.startsWith('/') ? redirect : '/dashboard'} replace />
}

/** 监听全局会话过期事件（仅登录开启时生效） */
export function AuthSessionListener() {
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const handled = useRef(false)

  const onExpired = useCallback(() => {
    if (!isLoginRequired()) return
    if (handled.current) return
    handled.current = true
    clearAuth()
    toast.error('登录已过期，请重新登录')

    const rawHash = window.location.hash.replace(/^#/, '') || '/'
    const pathOnly = rawHash.split('?')[0] || '/'
    const redirect =
      pathOnly.startsWith('/login') || pathOnly === '/'
        ? '/dashboard'
        : pathOnly.startsWith('/')
          ? pathOnly
          : `/${pathOnly}`
    window.location.hash = `#/login?reason=session_expired&redirect=${encodeURIComponent(redirect)}`

    window.setTimeout(() => {
      handled.current = false
    }, 500)
  }, [clearAuth])

  useEffect(() => {
    if (!isLoginRequired()) return
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired)
  }, [onExpired])

  return null
}
