import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import {
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

      isAuthenticated: () => true,

      bootstrapLocalSession: () => {
        const token = get().token
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
      },

      validateSession: async () => true,

      fetchUserInfo: async () => {
        /* 开源版无公司云 profile */
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
        get().bootstrapLocalSession()
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
    },
  ),
)

export function selectAuthToken(state: AuthStore): string | null {
  return state.token
}

export function selectIsAuthenticated(_state: AuthStore): boolean {
  return true
}
