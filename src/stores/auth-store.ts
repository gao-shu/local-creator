import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { fetchClientProfile } from '@/lib/auth/auth-service'
import { resolveApiBase } from '@/lib/auth/api-base'
import {
  hasPersistedRealToken,
  isLoginRequired,
  isOfflineLocalToken,
  OFFLINE_LOCAL_TOKEN,
  OFFLINE_LOCAL_USER,
} from '@/lib/auth/login-mode'
import type { AuthUser } from '@/types/auth'

interface AuthStore {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  isAuthenticated: () => boolean
  bootstrapLocalSession: () => void
  setSession: (accessToken: string, user: AuthUser) => void
  validateSession: (apiBase?: string) => Promise<boolean>
  fetchUserInfo: (apiBase?: string) => Promise<void>
  logout: () => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,

      isAuthenticated: () => {
        if (!isLoginRequired()) return true
        return hasPersistedRealToken(get().token)
      },

      bootstrapLocalSession: () => {
        if (isLoginRequired()) return
        const token = get().token
        // 已有真实 Session，或已是本地占位 Token，勿重复 set（避免 AuthGuard effect 抖动）
        if (token && !isOfflineLocalToken(token)) return
        if (isOfflineLocalToken(token) && get().user?.id === OFFLINE_LOCAL_USER.id) return
        const user = OFFLINE_LOCAL_USER
        set({ token: OFFLINE_LOCAL_TOKEN, refreshToken: '', user })
        try {
          localStorage.setItem('token', OFFLINE_LOCAL_TOKEN)
          localStorage.setItem('user', JSON.stringify(user))
        } catch {
          /* ignore */
        }
      },

      setSession: (accessToken, user) => {
        set({ token: accessToken, refreshToken: '', user })
        try {
          localStorage.setItem('token', accessToken)
          localStorage.setItem('user', JSON.stringify(user))
        } catch {
          /* ignore */
        }
        void import('@/stores/settings-store').then(({ useSettingsStore }) => {
          void useSettingsStore.getState().syncSystemModels()
        })
      },

      validateSession: async (apiBase) => {
        const token = get().token
        if (!token || isOfflineLocalToken(token)) return false
        try {
          // 冷启动校验失败只静默清会话，避免一打开就 Toast
          const user = await fetchClientProfile(token, apiBase ?? resolveApiBase(), {
            reportSessionExpired: false,
          })
          if (!user) {
            get().clearAuth()
            return false
          }
          set({ user })
          void import('@/stores/settings-store').then(({ useSettingsStore }) => {
            void useSettingsStore.getState().syncSystemModels(apiBase)
          })
          return true
        } catch {
          // 超时/网络失败：保留本地会话，不阻断冷启动
          return hasPersistedRealToken(get().token)
        }
      },

      fetchUserInfo: async (apiBase) => {
        const token = get().token
        if (!token || isOfflineLocalToken(token)) return
        try {
          const user = await fetchClientProfile(token, apiBase ?? resolveApiBase(), {
            reportSessionExpired: true,
          })
          if (user) set({ user })
        } catch {
          /* 刷新资料失败时保留现有 user */
        }
      },

      logout: () => {
        set({ token: null, refreshToken: null, user: null })
        try {
          localStorage.removeItem('token')
          localStorage.removeItem('refresh_token')
          localStorage.removeItem('user')
        } catch {
          /* ignore */
        }
      },

      clearAuth: () => {
        get().logout()
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.token || !hasPersistedRealToken(state.token)) return
        void import('@/stores/settings-store').then(({ useSettingsStore }) => {
          void useSettingsStore.getState().syncSystemModels()
        })
      },
    },
  ),
)

/** 供路由守卫订阅：token 变化会触发重渲染 */
export function selectAuthToken(state: AuthStore): string | null {
  return state.token
}

export function selectIsAuthenticated(state: AuthStore): boolean {
  if (!isLoginRequired()) return true
  return hasPersistedRealToken(state.token)
}
