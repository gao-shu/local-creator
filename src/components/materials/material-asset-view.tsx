// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useState } from 'react'
import { ImageIcon, MapPin, Trash2, Users, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import { readSettings } from '@/lib/storage/settings-service'
import {
  resolveProjectMediaPath,
  toLocalImageUrl,
} from '@/lib/storage/media-path-resolver'
import { resolveMaterialMediaReadRoot } from '@/lib/materials/global-materials-paths'
import { getAssetPreviewPath } from '@/lib/workflow/asset-utils'
import { formatRelativeTime } from '@/lib/dashboard/recent-items-service'
import type { MaterialLibraryItem } from '@/lib/materials/material-library-service'
import type { AssetKind } from '@/types/workflow'

export const MATERIAL_KIND_CONFIG: Record<
  AssetKind,
  { label: string; icon: typeof Users; color: string; bg: string }
> = {
  character: { label: '角色', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  scene: { label: '场景', icon: MapPin, color: 'text-green-400', bg: 'bg-green-500/10' },
  prop: { label: '道具', icon: Wrench, color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

export function materialPreviewKey(item: MaterialLibraryItem): string {
  return item.libraryEntryId || `${item.projectId}-${item.asset.id}`
}

/** 读盘校验后再返回预览地址（避免 local-image:// 对缺失文件仍视为有效） */
async function loadVerifiedMaterialPreviewSrc(
  storedPath: string,
  readRoot: string | undefined,
): Promise<string | null> {
  const trimmed = String(storedPath || '').trim()
  if (!trimmed) return null
  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('preview:') ||
    /^https?:\/\//i.test(trimmed)
  ) {
    return (await readImageAsDataUrl(trimmed, readRoot)) || null
  }
  if (!readRoot) {
    return (await readImageAsDataUrl(trimmed, readRoot)) || null
  }

  const resolved = resolveProjectMediaPath(trimmed, readRoot)
  if (!resolved || !window.fsAPI?.readImageDataUrl) return null
  const res = await window.fsAPI.readImageDataUrl(resolved)
  if (!res.success || !res.dataUrl) return null
  return toLocalImageUrl(resolved)
}

export function useMaterialPreviewMap(items: MaterialLibraryItem[]) {
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const itemKey = items.map((item) => materialPreviewKey(item)).join('|')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!items.length) {
        setPreviewMap({})
        setPreviewLoading(false)
        return
      }

      setPreviewLoading(true)
      const settingsRes = await readSettings()
      const dataRoot = settingsRes.dataRoot || settingsRes.appDataDir

      const entries = await Promise.all(
        items.map(async (item) => {
          const path = getAssetPreviewPath(item.asset)
          if (!path) return [materialPreviewKey(item), ''] as const
          const readRoot = resolveMaterialMediaReadRoot(
            path,
            settingsRes.data,
            dataRoot,
            item.projectId,
          )
          const previewSrc = await loadVerifiedMaterialPreviewSrc(path, readRoot)
          return [materialPreviewKey(item), previewSrc || ''] as const
        }),
      )
      if (!cancelled) {
        setPreviewMap(Object.fromEntries(entries.filter(([, src]) => src)))
        setPreviewLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [itemKey, items])

  return { previewMap, previewLoading }
}

function MaterialAssetThumbnail({
  item,
  previewSrc,
  className,
}: {
  item: MaterialLibraryItem
  previewSrc?: string
  className?: string
}) {
  const typeConf = MATERIAL_KIND_CONFIG[item.asset.kind]
  const TypeIcon = typeConf.icon
  const [imgError, setImgError] = useState(false)
  const showImage = Boolean(previewSrc) && !imgError

  useEffect(() => {
    setImgError(false)
  }, [previewSrc])

  return (
    <div className={cn('relative overflow-hidden bg-muted/5', className)}>
      {showImage ? (
        <img
          src={previewSrc}
          alt={item.asset.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={cn('absolute inset-0 flex items-center justify-center', typeConf.bg)}>
          <TypeIcon className={cn('h-5 w-5 opacity-25', typeConf.color)} />
        </div>
      )}
      <div
        className={cn(
          'absolute top-1 left-1 flex items-center gap-0.5 px-1 py-0.5 rounded-md',
          'bg-black/40 backdrop-blur-sm text-white/80 text-[9px] font-medium',
        )}
      >
        <TypeIcon className="h-2.5 w-2.5" />
        {typeConf.label}
      </div>
    </div>
  )
}

export function MaterialAssetGridCard({
  item,
  previewSrc,
  broken,
  onClick,
  onRemoveFromIndex,
}: {
  item: MaterialLibraryItem
  previewSrc?: string
  broken?: boolean
  onClick: () => void
  onRemoveFromIndex?: (item: MaterialLibraryItem) => void
}) {
  return (
    <div
      className={cn(
        'group relative rounded-lg border border-border/30 overflow-hidden text-left',
        'bg-card/50 backdrop-blur-sm',
        'hover:border-border/50 hover:shadow-md hover:shadow-black/5 transition-all duration-200',
        broken ? 'border-amber-500/40 opacity-80' : '',
        !broken && item.sourceInRecycleBin ? 'border-sky-500/35' : '',
      )}
    >
      <button type="button" onClick={onClick} className="block w-full cursor-pointer text-left">
        <MaterialAssetThumbnail
          item={item}
          previewSrc={previewSrc}
          className="aspect-square"
        />
        {broken ? (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-amber-600/90 text-[9px] text-white font-medium">
            无效
          </div>
        ) : item.sourceInRecycleBin ? (
          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-sky-600/90 text-[9px] text-white font-medium">
            回收站
          </div>
        ) : null}
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium truncate">{item.asset.name}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{item.projectTitle}</p>
        </div>
      </button>
      {onRemoveFromIndex ? (
        <button
          type="button"
          title="从素材库索引移除（不删除项目内文件）"
          aria-label="从素材库索引移除"
          onClick={(event) => {
            event.stopPropagation()
            onRemoveFromIndex(item)
          }}
          className={cn(
            'absolute right-1.5 top-1.5 z-[5] flex h-6 w-6 items-center justify-center rounded-md',
            'border border-border/40 bg-black/50 text-white/90 opacity-0 transition-opacity',
            'hover:bg-red-500/80 group-hover:opacity-100',
          )}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}

export function MaterialAssetListRow({
  item,
  previewSrc,
  broken,
  onClick,
  onRemoveFromIndex,
}: {
  item: MaterialLibraryItem
  previewSrc?: string
  broken?: boolean
  onClick: () => void
  onRemoveFromIndex?: (item: MaterialLibraryItem) => void
}) {
  const typeConf = MATERIAL_KIND_CONFIG[item.asset.kind]

  return (
    <div
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg px-3 py-2',
        'border border-border/30 bg-card/50',
        'hover:border-border/50 hover:bg-card/80 transition-all',
        broken ? 'border-amber-500/40' : '',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
      >
        <div className="h-10 w-10 rounded-md overflow-hidden bg-muted/10 shrink-0 flex items-center justify-center">
          {previewSrc ? (
            <img src={previewSrc} alt={item.asset.name} className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className={cn('h-5 w-5 opacity-40', typeConf.color)} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.asset.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={cn(
                'px-1.5 py-0.5 rounded-md text-[10px] font-medium',
                typeConf.bg,
                typeConf.color,
              )}
            >
              {typeConf.label}
            </span>
            <span className="text-xs text-muted-foreground truncate">{item.projectTitle}</span>
            {broken ? (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300">
                无效
              </span>
            ) : item.sourceInRecycleBin ? (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-sky-500/15 text-sky-700 dark:text-sky-300">
                来源在回收站
              </span>
            ) : null}
          </div>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {formatRelativeTime(item.asset.updatedAt)}
        </span>
      </button>
      {onRemoveFromIndex ? (
        <button
          type="button"
          title="从素材库索引移除（不删除项目内文件）"
          aria-label="从素材库索引移除"
          onClick={() => onRemoveFromIndex(item)}
          className={cn(
            'shrink-0 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity',
            'hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100',
          )}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}

export function MaterialAssetGrid({
  items,
  previewMap,
  brokenKeys,
  onOpen,
  onRemoveFromIndex,
}: {
  items: MaterialLibraryItem[]
  previewMap: Record<string, string>
  brokenKeys?: Set<string>
  onOpen: (item: MaterialLibraryItem) => void
  onRemoveFromIndex?: (item: MaterialLibraryItem) => void
}) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5">
      {items.map((item) => (
        <MaterialAssetGridCard
          key={materialPreviewKey(item)}
          item={item}
          previewSrc={previewMap[materialPreviewKey(item)]}
          broken={brokenKeys?.has(materialPreviewKey(item))}
          onClick={() => onOpen(item)}
          onRemoveFromIndex={onRemoveFromIndex}
        />
      ))}
    </div>
  )
}

export function MaterialAssetList({
  items,
  previewMap,
  brokenKeys,
  onOpen,
  onRemoveFromIndex,
}: {
  items: MaterialLibraryItem[]
  previewMap: Record<string, string>
  brokenKeys?: Set<string>
  onOpen: (item: MaterialLibraryItem) => void
  onRemoveFromIndex?: (item: MaterialLibraryItem) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <MaterialAssetListRow
          key={materialPreviewKey(item)}
          item={item}
          previewSrc={previewMap[materialPreviewKey(item)]}
          broken={brokenKeys?.has(materialPreviewKey(item))}
          onClick={() => onOpen(item)}
          onRemoveFromIndex={onRemoveFromIndex}
        />
      ))}
    </div>
  )
}
