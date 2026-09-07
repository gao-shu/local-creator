import { ImageIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WorkflowAsset } from '@/types/workflow'

interface AssetCardProps {
  asset: WorkflowAsset
  selected: boolean
  previewUrl?: string | null
  onClick: () => void
}

export function AssetCard({ asset, selected, previewUrl, onClick }: AssetCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border border-border/30 bg-card/50 p-4 flex gap-4 text-left transition-colors',
        'hover:border-border/50',
        selected && 'border-violet-500/30 bg-violet-500/10',
      )}
    >
      <div className="h-16 w-16 shrink-0 rounded-lg border border-border/30 bg-muted/30 overflow-hidden flex items-center justify-center">
        {asset.status === 'generating' ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : previewUrl ? (
          <img src={previewUrl} alt={asset.name} className="h-full w-full object-cover" />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-medium truncate">{asset.name}</div>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {asset.description || '暂无描述'}
        </p>
        <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full border border-border/30 text-muted-foreground">
          {asset.status === 'done'
            ? '已生成'
            : asset.status === 'generating'
              ? '生成中'
              : asset.status === 'failed'
                ? '失败'
                : '待生成'}
        </span>
      </div>
    </button>
  )
}
