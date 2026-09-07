// Copyright (c) local-creator. All rights reserved.

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_OFFICIAL_WEBSITE_URL } from '@/lib/update/official-download-url'
import { SidebarFeedbackButton } from '@/components/dashboard/sidebar-feedback-button'
import { useAuthStore } from '@/stores/auth-store'

const websiteLinkClass = cn(
  'flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs sm:text-sm min-w-0',
  'text-muted-foreground hover:text-foreground hover:bg-foreground/6',
  'border border-border/30 transition-colors',
)

export function SidebarUserDock({ className }: { className?: string }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const officialUrl = DEFAULT_OFFICIAL_WEBSITE_URL

  const goToAccount = useCallback(() => {
    navigate('/settings/account')
  }, [navigate])

  if (!user) return null

  const displayName = user.nickname || '本地模式'

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
            title="账户设置"
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
          </button>
        </div>
      </div>
    </div>
  )
}
