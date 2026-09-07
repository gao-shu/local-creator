import { resolveApiBase } from '@/lib/auth/api-base'
import { hasPersistedRealToken, isLoginRequired } from '@/lib/auth/login-mode'
import { useAuthStore } from '@/stores/auth-store'

const PROFILE_REFRESH_DEBOUNCE_MS = 30_000

const PROFILE_REFRESH_ROUTES = new Set(['/dashboard'])

let lastRefreshAt = 0
let inflightRefresh: Promise<void> | null = null

export function isProfileRefreshRoute(pathname: string): boolean {
  return PROFILE_REFRESH_ROUTES.has(pathname)
}

export async function refreshUserProfile(options?: { force?: boolean }): Promise<void> {
  if (!isLoginRequired()) return

  const token = useAuthStore.getState().token
  if (!hasPersistedRealToken(token)) return

  const force = options?.force ?? false
  const now = Date.now()
  if (!force && now - lastRefreshAt < PROFILE_REFRESH_DEBOUNCE_MS) {
    if (inflightRefresh) return inflightRefresh
    return
  }

  if (inflightRefresh) return inflightRefresh

  inflightRefresh = (async () => {
    try {
      const { useSettingsStore } = await import('@/stores/settings-store')
      const apiBase = resolveApiBase(useSettingsStore.getState().settings?.apiBaseUrl)
      await useAuthStore.getState().fetchUserInfo(apiBase)
      lastRefreshAt = Date.now()
    } finally {
      inflightRefresh = null
    }
  })()

  return inflightRefresh
}
