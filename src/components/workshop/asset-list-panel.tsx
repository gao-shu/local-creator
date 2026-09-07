import { useMemo, useState, type ReactNode } from 'react'
import {
  FolderOpen,
  Library,
  Loader2,
  MapPin,
  Package,
  Plus,
  Search,
  Trash2,
  User,
} from 'lucide-react'
import { WORKSHOP_AI_TOKENS } from '@/components/workshop/workshop-ai-button'
import { ASSET_KIND_UI, assetListStatusText } from '@/components/workshop/asset-kind-labels'
import { ReviewShieldBadge } from '@/components/workshop/review-shield-badge'
import { Input } from '@/components/ui/input'
import { getAssetReviewSnapshot } from '@/lib/workflow/asset-review-status'
import type { AssetKind, WorkflowAsset } from '@/types/workflow'
import { cn } from '@/lib/utils'

const KIND_ICON = {
  character: User,
  scene: MapPin,
  prop: Package,
} as const

interface AssetListPanelProps {
  kind: AssetKind
  assets: WorkflowAsset[]
  selectedId: string | null
  previewMap: Record<string, string>
  /** 已写入素材库索引的资产 ID */
  syncedAssetIds?: ReadonlySet<string>
  emptyContent?: ReactNode
  onSelect: (id: string) => void
  onAdd: () => void
  onImportFromLibrary?: () => void
  onDelete: (id: string) => void
  onOpenFolder: (asset: WorkflowAsset) => void
}

export function AssetListPanel({
  kind,
  assets,
  selectedId,
  previewMap,
  syncedAssetIds,
  emptyContent,
  onSelect,
  onAdd,
  onImportFromLibrary,
  onDelete,
  onOpenFolder,
}: AssetListPanelProps) {
  const [query, setQuery] = useState('')
  const ui = ASSET_KIND_UI[kind]
  const Icon = KIND_ICON[kind]

  const visibleAssets = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.prompt.toLowerCase().includes(q),
    )
  }, [assets, query])

  return (
    <div className="flex flex-col h-full min-h-0 rounded-lg border border-border bg-card">
      <div className="p-3 border-b border-border/30 shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-foreground">{ui.list}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {onImportFromLibrary ? (
              <button
                type="button"
                data-testid="workshop-step3-import-from-library"
                onClick={onImportFromLibrary}
                className="h-8 px-2.5 rounded-md border border-border/50 hover:bg-muted/40 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-xs font-medium transition-colors"
                title="从素材库添加"
              >
                <Library className="h-3.5 w-3.5 shrink-0" />
                <span className="whitespace-nowrap">从素材库添加</span>
              </button>
            ) : null}
            <button
              type="button"
              data-testid="workshop-step3-add-asset"
              onClick={onAdd}
              className="h-8 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white inline-flex items-center gap-1 text-xs font-medium transition-colors"
              title={`新建${ui.list.replace('列表', '')}`}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">新建</span>
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ui.search}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {visibleAssets.length === 0 ? (
          emptyContent ?? (
            <div className="py-10 px-2 text-center text-xs text-muted-foreground leading-relaxed">
              暂无{ui.list.replace('列表', '')}。点{' '}
              <span className="text-foreground font-medium">新建</span> 从零创建，或点{' '}
              <span className="text-foreground font-medium">从素材库添加</span> 复用已有资产。
            </div>
          )
        ) : (
          visibleAssets.map((asset, index) => {
            const selected = asset.id === selectedId
            const previewUrl = previewMap[asset.id]
            const listStatus = assetListStatusText(asset.status)
            const displayName = asset.name.trim() || `新项${index + 1}`
            const reviewSnapshot =
              kind === 'character' ? getAssetReviewSnapshot(asset) : null

            return (
              <div
                key={asset.id}
                className={cn(
                  'group rounded-lg border transition-colors',
                  selected
                    ? cn(WORKSHOP_AI_TOKENS.border, WORKSHOP_AI_TOKENS.bgSoft)
                    : 'border-transparent bg-muted/50 hover:bg-accent',
                )}
              >
                <div className="flex items-stretch gap-2 p-2">
                  <button
                    type="button"
                    data-testid={`workshop-asset-item-${asset.id}`}
                    onClick={() => onSelect(asset.id)}
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                  >
                    <div className="relative h-11 w-11 shrink-0 rounded-md border border-border bg-muted overflow-hidden flex items-center justify-center">
                      {asset.status === 'generating' ? (
                        <Loader2 className={cn('h-4 w-4 animate-spin', WORKSHOP_AI_TOKENS.textAccent)} />
                      ) : previewUrl ? (
                        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Icon className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">{displayName}</p>
                        {reviewSnapshot?.hasSynced ? (
                          <ReviewShieldBadge
                            variant="inline"
                            size="compact"
                            state={reviewSnapshot.visualState}
                            title={reviewSnapshot.title}
                          />
                        ) : null}
                        {syncedAssetIds?.has(asset.id) ? (
                          <span
                            title="已写入素材库索引（图片仍在本项目）"
                            className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium bg-cyan-600/90 text-white"
                          >
                            <Package className="h-2.5 w-2.5" strokeWidth={2.25} />
                            素材库
                          </span>
                        ) : null}
                      </div>
                      <p className={cn('text-[11px] mt-0.5', listStatus.className)}>
                        {listStatus.label}
                      </p>
                    </div>
                  </button>

                  {selected ? (
                    <div className="flex flex-col justify-center gap-1 shrink-0 self-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenFolder(asset)
                        }}
                        className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                        title="打开所在文件夹"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        data-testid={`workshop-asset-delete-${asset.id}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(asset.id)
                        }}
                        className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
