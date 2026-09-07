import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { isProfileRefreshRoute, refreshUserProfile } from '@/lib/auth/refresh-user-profile'

/** 进入首页时静默刷新用户信息 */
export function useProfileRefreshOnRoute(): void {
  const { pathname } = useLocation()

  useEffect(() => {
    if (!isProfileRefreshRoute(pathname)) return
    void refreshUserProfile()
  }, [pathname])
}
