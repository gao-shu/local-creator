import { RefreshCw } from 'lucide-react'
import { requestAppUpdateOpen } from '@/components/update/app-update-host'
import { isElectronApp } from '@/lib/update/app-updater'
import { useUpdateStore } from '@/stores/update-store'
import { cn } from '@/lib/utils'

export function UpdateAvailablePill({ className }: { className?: string }) {
  const currentVersion = useUpdateStore((s) => s.currentVersion)
  const nextVersion = useUpdateStore((s) => s.nextVersion)
  const updateAvailable = useUpdateStore((s) => s.updateAvailable)

  if (!isElectronApp() || !updateAvailable || !nextVersion) return null

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/50',
        'bg-card/80 backdrop-blur-sm px-1.5 py-1 shrink-0',
        className,
      )}
    >
      <span
        className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground"
        title="当前版本"
      >
        {currentVersion}
      </span>
      <button
        type="button"
        onClick={() => requestAppUpdateOpen()}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border/60',
          'bg-background/60 px-2 py-0.5 text-[11px] font-medium',
          'text-foreground hover:bg-amber-500/10 hover:border-amber-500/40 hover:text-amber-600',
          'dark:hover:text-amber-300 transition-colors',
        )}
      >
        <RefreshCw className="h-3 w-3" />
        去更新
      </button>
      <span className="hidden sm:inline text-[11px] text-muted-foreground whitespace-nowrap pr-1">
        新版本 {nextVersion}
      </span>
    </div>
  )
}
