import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { EpisodeTabKey, WorkflowEpisode } from '@/types/workflow'

interface EpisodeTabsProps {
  episodes: WorkflowEpisode[]
  activeKey: EpisodeTabKey
  onChange: (key: EpisodeTabKey) => void
  onAdd: () => void
  onDelete: (episodeId: string) => void
  onClear: () => void
}

export function EpisodeTabs({
  episodes,
  activeKey,
  onChange,
  onAdd,
  onDelete,
  onClear,
}: EpisodeTabsProps) {
  return (
    <div className="flex flex-col h-full min-h-0 rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm">
      <div className="p-3 border-b border-border/20 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">分集列表</span>
            {episodes.length > 0 ? (
              <span className="text-[11px] px-1.5 py-0.5 rounded-md bg-violet-500/10 text-violet-400 font-medium shrink-0">
                共 {episodes.length} 集
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onAdd}
            className="p-1.5 rounded-lg hover:bg-foreground/5 text-muted-foreground hover:text-foreground"
            title="新增分集"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClear}
            disabled={episodes.length === 0}
            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive disabled:opacity-40"
            title="清空分集"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <button
          type="button"
          data-testid="workshop-episode-tab-full"
          onClick={() => onChange('full')}
          className={cn(
            'w-full text-left px-3 py-2.5 rounded-xl text-sm transition-colors border',
            activeKey === 'full'
              ? 'bg-violet-500/10 border-violet-500/15 text-foreground font-medium'
              : 'border-transparent text-muted-foreground hover:bg-foreground/3 hover:text-foreground',
          )}
        >
          全文预览
        </button>

        {episodes.map((episode) => (
          <div key={episode.id} className="group flex items-center gap-1">
            <button
              type="button"
              data-testid={`workshop-episode-tab-${episode.id}`}
              onClick={() => onChange(episode.id)}
              className={cn(
                'flex-1 min-w-0 text-left px-3 py-2.5 rounded-xl text-sm transition-colors border',
                activeKey === episode.id
                  ? 'bg-violet-500/10 border-violet-500/15 text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:bg-foreground/3 hover:text-foreground',
              )}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold tabular-nums',
                    activeKey === episode.id
                      ? 'bg-violet-500/20 text-violet-300'
                      : 'bg-foreground/5 text-muted-foreground',
                  )}
                >
                  {String(episode.episodeIndex).padStart(2, '0')}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    {(() => {
                      const title = episode.title?.trim()
                      if (title && !/^第\s*\d+\s*集$/.test(title)) return title
                      return `第 ${episode.episodeIndex} 集`
                    })()}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {episode.content?.trim().slice(0, 40) || '暂无内容'}
                  </div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => onDelete(episode.id)}
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
              title="删除此集"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}

        {episodes.length === 0 ? (
          <p className="px-3 py-6 text-xs text-muted-foreground text-center leading-relaxed">
            暂无分集，可手动新增；录入剧本后还可 AI 智能分集
          </p>
        ) : null}
      </div>
    </div>
  )
}
