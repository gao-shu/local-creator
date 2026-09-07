import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { ReleaseChangelogPanel } from '@/components/dashboard/release-changelog-panel'
import { getLatestChangelogVersion } from '@/constants/release-changelog'
import {
  getLastReadChangelogVersion,
  setLastReadChangelogVersion,
} from '@/lib/release/changelog-read'
import { cn } from '@/lib/utils'

export function NoticeButton() {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [lastRead, setLastRead] = useState(() => getLastReadChangelogVersion())

  const latestVersion = getLatestChangelogVersion()

  const hasUnread = useMemo(
    () => Boolean(latestVersion && latestVersion !== lastRead),
    [latestVersion, lastRead],
  )

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev)
  }, [])

  const handleAcknowledge = useCallback(() => {
    if (latestVersion) {
      setLastReadChangelogVersion(latestVersion)
      setLastRead(latestVersion)
    }
  }, [latestVersion])

  useEffect(() => {
    setLastRead(getLastReadChangelogVersion())
  }, [])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className={cn(
          'relative p-2 rounded-xl transition-colors',
          open
            ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
            : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5',
        )}
        aria-label="更新日志"
        title="更新日志"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {hasUnread ? (
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-amber-500 ring-2 ring-background" />
        ) : null}
      </button>

      <ReleaseChangelogPanel
        open={open}
        anchorRef={buttonRef}
        onClose={() => setOpen(false)}
        onAcknowledge={handleAcknowledge}
      />
    </>
  )
}
