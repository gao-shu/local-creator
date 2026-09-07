import { SITE_ICP_DOMAIN, SITE_ICP_QUERY_URL, SITE_ICP_RECORD } from '@/constants/site-icp'
import { cn } from '@/lib/utils'

interface IcpFooterProps {
  className?: string
  /** dark：登录页等深色背景；muted：设置页等浅色背景 */
  variant?: 'dark' | 'muted'
  showDomain?: boolean
}

export function IcpFooter({ className, variant = 'muted', showDomain = true }: IcpFooterProps) {
  const linkClass =
    variant === 'dark'
      ? 'text-white/35 hover:text-white/55'
      : 'text-muted-foreground/80 hover:text-muted-foreground'

  return (
    <p className={cn('text-center text-xs leading-relaxed', linkClass, className)}>
      {showDomain ? (
        <>
          <span>{SITE_ICP_DOMAIN}</span>
          <span className="mx-1.5 opacity-50">·</span>
        </>
      ) : null}
      <a
        href={SITE_ICP_QUERY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline-offset-2 hover:underline"
      >
        {SITE_ICP_RECORD}
      </a>
    </p>
  )
}
