import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe, LogIn, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  hasPersistedRealToken,
  isLoginRequired,
  OPTIONAL_LOGIN_PATH,
} from '@/lib/auth/login-mode'
import { DEFAULT_OFFICIAL_WEBSITE_URL } from '@/lib/update/official-download-url'
import { SidebarFeedbackButton } from '@/components/dashboard/sidebar-feedback-button'
import { HaodouIcon } from '@/components/ui/haodou-icon'
import { useAuthStore } from '@/stores/auth-store'

const websiteLinkClass = cn(
  'flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs sm:text-sm min-w-0',
  'text-muted-foreground hover:text-foreground hover:bg-foreground/6',
  'border border-border/30 transition-colors',
)

export function SidebarUserDock({ className }: { className?: string }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const logout = useAuthStore((s) => s.logout)
  const bootstrapLocalSession = useAuthStore((s) => s.bootstrapLocalSession)
  const loginRequired = isLoginRequired()
  const hasRealSession = hasPersistedRealToken(token)
  const showLogout = hasRealSession
  const showOptionalLogin = !loginRequired && !hasRealSession
  const officialUrl = DEFAULT_OFFICIAL_WEBSITE_URL

  const handleLogout = useCallback(() => {
    logout()
    if (loginRequired) {
      navigate('/login', { replace: true })
    } else {
      bootstrapLocalSession()
    }
  }, [bootstrapLocalSession, loginRequired, logout, navigate])

  const goToAccount = useCallback(() => {
    navigate(loginRequired || hasRealSession ? '/settings/account' : '/settings')
  }, [hasRealSession, loginRequired, navigate])

  const handleOptionalLogin = useCallback(() => {
    navigate(OPTIONAL_LOGIN_PATH)
  }, [navigate])

  if (!user) return null

  const displayName = loginRequired
    ? user.nickname || user.username || '用户'
    : user.nickname || '本地模式'

  const haodouBalance = user.bells ?? user.remaining_quota ?? 0
  const showHaodou = hasRealSession

  return (
    <div
      className={cn(
        'rounded-2xl p-2',
        'bg-linear-to-b from-background/80 to-background/40',
        'backdrop-blur-lg border border-border/40 shadow-lg',
        className,
      )}
    >
      <div className="mb-2 space-y-2">
        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(websiteLinkClass, 'w-full justify-center')}
          title={officialUrl}
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className="truncate">官网</span>
        </a>
        <SidebarFeedbackButton />
      </div>
      <div className="rounded-xl bg-foreground/4 border border-border/30 px-2 py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToAccount}
            className={cn(
              'flex flex-1 min-w-0 items-center gap-2 rounded-lg -my-0.5 py-0.5 -ml-0.5 pl-0.5 pr-1',
              'text-left transition-colors hover:bg-foreground/6',
            )}
            title={loginRequired || hasRealSession ? '账户设置' : '系统设置'}
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full object-cover ring-1 ring-border/60 shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                {displayName.slice(0, 1)}
              </div>
            )}
            <span className="flex-1 min-w-0 text-sm text-foreground truncate">{displayName}</span>
            {showHaodou ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 shrink-0 rounded-md px-1.5 py-0.5',
                  'text-xs font-medium tabular-nums',
                  'text-amber-700 dark:text-amber-300 bg-amber-500/10',
                )}
                title="好豆余额"
              >
                <HaodouIcon size={13} />
                {haodouBalance}
              </span>
            ) : null}
          </button>
          {showOptionalLogin ? (
            <button
              type="button"
              onClick={handleOptionalLogin}
              className={cn(
                'p-1.5 rounded-lg shrink-0 transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-foreground/8',
              )}
              aria-label="账号登录"
              title="账号登录"
            >
              <LogIn className="h-4 w-4" />
            </button>
          ) : null}
          {showLogout ? (
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                'p-1.5 rounded-lg shrink-0 transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-foreground/8',
              )}
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
