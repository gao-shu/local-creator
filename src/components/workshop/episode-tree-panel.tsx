import { WORKSHOP_AI_TOKENS } from '@/components/workshop/workshop-ai-button'
import { Film } from 'lucide-react'
import type { WorkflowEpisode, WorkflowShot } from '@/types/workflow'
import { cn } from '@/lib/utils'

interface EpisodeTreePanelProps {
  episodes: WorkflowEpisode[]
  shots: WorkflowShot[]
  selectedEpisodeId: string | null
  onSelect: (episodeId: string) => void
}

export function EpisodeTreePanel({
  episodes,
  shots,
  selectedEpisodeId,
  onSelect,
}: EpisodeTreePanelProps) {
  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border bg-card">
      <div className="px-3 py-2.5 border-b border-border shrink-0">
        <p className="text-sm font-medium">分集列表</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">共 {episodes.length} 集</p>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {episodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">请先在 Step2 完成分集</div>
        ) : (
          episodes.map((ep) => {
            const count = shots.filter((s) => s.episodeId === ep.id).length
            const selected = ep.id === selectedEpisodeId
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => onSelect(ep.id)}
                className={cn(
                  'w-full flex items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
                  selected
                    ? cn(WORKSHOP_AI_TOKENS.border, WORKSHOP_AI_TOKENS.bgSoft)
                    : 'border-transparent bg-muted/40 hover:bg-accent',
                )}
              >
                <Film className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {ep.title || `第 ${ep.episodeIndex} 集`}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {count > 0 ? `${count} 个镜头` : '暂无分镜'}
                  </p>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
