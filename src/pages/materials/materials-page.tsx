// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  Grid3X3,
  LayoutGrid,
  List,
  Loader2,
  Package,
  Search,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { CANVAS_INPUT_PLACEHOLDER } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Select } from '@/components/ui/select'
import {
  MATERIAL_KIND_CONFIG,
  MaterialAssetGrid,
  MaterialAssetList,
  materialPreviewKey,
  useMaterialPreviewMap,
} from '@/components/materials/material-asset-view'
import { collectBrokenMaterialLibraryItemsAfterPreview } from '@/lib/materials/material-library-health'
import {
  countAssetsByKind,
  filterMaterialAssets,
  groupMaterialAssetsByProject,
  loadSyncedMaterialLibrary,
  resolveRouteKind,
  type MaterialLibraryItem,
} from '@/lib/materials/material-library-service'
import { restoreCanvasProject } from '@/lib/storage/canvas-service'
import { restoreWorkflowProject } from '@/lib/storage/workflow-service'
import { isCanvasProjectDirName } from '@/lib/storage/storage-path-utils'
import { removeMaterialLibraryEntriesByIds } from '@/lib/materials/materials-index-service'
import { toast } from 'sonner'
import type { AssetKind } from '@/types/workflow'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
}

const ASSET_KINDS: AssetKind[] = ['character', 'scene', 'prop']
const GRID_PAGE_SIZE = 24
const LIST_PAGE_SIZE = 15

type GroupViewMode = 'category' | 'project'
type DisplayMode = 'grid' | 'list'

function MaterialPagination({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-xs text-muted-foreground/50">共 {total} 个资产</p>
      </div>
    )
  }

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
          'border border-border/30 hover:bg-card/50 transition-colors',
          'disabled:opacity-40 disabled:pointer-events-none',
        )}
      >
        <ChevronLeft className="h-4 w-4" />
        上一页
      </button>
      <span className="text-sm text-muted-foreground tabular-nums">
        {page} / {totalPages}
        <span className="text-muted-foreground/50 ml-2">
          （{start}-{end} / {total}）
        </span>
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm',
          'border border-border/30 hover:bg-card/50 transition-colors',
          'disabled:opacity-40 disabled:pointer-events-none',
        )}
      >
        下一页
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export function MaterialsPage() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const routeKind = resolveRouteKind(pathname)

  const [loading, setLoading] = useState(true)
  const [allItems, setAllItems] = useState<MaterialLibraryItem[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('all')
  const [selectedKind, setSelectedKind] = useState<AssetKind | 'all'>(routeKind)
  const [groupViewMode, setGroupViewMode] = useState<GroupViewMode>('category')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('grid')
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [cleanupBrokenOpen, setCleanupBrokenOpen] = useState(false)
  const [cleaningBroken, setCleaningBroken] = useState(false)
  const [removeTarget, setRemoveTarget] = useState<MaterialLibraryItem | null>(null)
  const [removingEntry, setRemovingEntry] = useState(false)

  const [previewReady, setPreviewReady] = useState(false)

  const reloadItems = async () => {
    setPreviewReady(false)
    const items = await loadSyncedMaterialLibrary()
    setAllItems(items)
  }

  useEffect(() => {
    setSelectedKind(routeKind)
    setPage(1)
  }, [routeKind])

  useEffect(() => {
    setPage(1)
  }, [selectedKind, selectedProjectId, debouncedKeyword, groupViewMode, displayMode])

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [keyword])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setPreviewReady(false)
      try {
        const items = await loadSyncedMaterialLibrary()
        if (!cancelled) setAllItems(items)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const { previewMap, previewLoading } = useMaterialPreviewMap(allItems)

  useEffect(() => {
    if (loading || previewLoading || allItems.length === 0) {
      setPreviewReady(false)
      return
    }
    setPreviewReady(true)
  }, [loading, previewLoading, allItems.length])

  const filteredItems = useMemo(
    () =>
      filterMaterialAssets(allItems, {
        kind: selectedKind,
        projectId: selectedProjectId,
        keyword: debouncedKeyword,
      }),
    [allItems, selectedKind, selectedProjectId, debouncedKeyword],
  )

  const pageSize = displayMode === 'grid' ? GRID_PAGE_SIZE : LIST_PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page !== safePage) setPage(safePage)
  }, [page, safePage])

  const pagedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, safePage, pageSize])

  const pagedPreviewMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const item of pagedItems) {
      const key = materialPreviewKey(item)
      if (previewMap[key]) map[key] = previewMap[key]
    }
    return map
  }, [pagedItems, previewMap])

  const typeCounts = useMemo(() => countAssetsByKind(allItems), [allItems])
  const brokenItems = useMemo(() => {
    if (!previewReady) return []
    return collectBrokenMaterialLibraryItemsAfterPreview(allItems, previewMap)
  }, [allItems, previewMap, previewReady])
  const brokenEntryKeys = useMemo(
    () => new Set(brokenItems.map((item) => materialPreviewKey(item))),
    [brokenItems],
  )
  const projectGroups = useMemo(
    () => groupMaterialAssetsByProject(pagedItems),
    [pagedItems],
  )

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const item of allItems) {
      seen.set(item.projectId, item.projectTitle)
    }
    return [
      { value: 'all', label: '全部项目' },
      ...[...seen.entries()].map(([value, label]) => ({ value, label })),
    ]
  }, [allItems])

  const navigateToSourceProject = (projectId: string) => {
    if (isCanvasProjectDirName(projectId)) {
      navigate(`/canvas/${projectId}`)
      return
    }
    navigate(`/workshop/${projectId}/step/3`)
  }

  const restoreSourceProject = async (projectId: string, projectTitle?: string) => {
    const id = String(projectId || '').trim()
    if (!id) return
    try {
      if (isCanvasProjectDirName(id)) {
        await restoreCanvasProject(id)
      } else {
        await restoreWorkflowProject(id)
      }
      await reloadItems()
      toast.success(`已恢复「${projectTitle || '来源项目'}」`)
    } catch (error: unknown) {
      toast.error((error as Error).message || '恢复来源项目失败')
    }
  }

  const openAsset = (item: MaterialLibraryItem) => {
    if (brokenEntryKeys.has(materialPreviewKey(item))) {
      toast.message('无效素材条目', {
        description: '来源图片无法读取，可移除索引记录（不删除项目内文件）。',
        action: {
          label: '移除索引',
          onClick: () => {
            void (async () => {
              try {
                const removed = await removeMaterialLibraryEntriesByIds([item.libraryEntryId])
                await reloadItems()
                toast.success(removed > 0 ? '已移除该无效条目' : '没有可清理的条目')
              } catch (error: unknown) {
                toast.error((error as Error).message || '移除失败')
              }
            })()
          },
        },
      })
      return
    }
    if (item.sourceInRecycleBin) {
      toast.message('来源项目在回收站', {
        description: '素材仍可选用；打开原项目前请先恢复。',
        action: {
          label: '恢复项目',
          onClick: () => void restoreSourceProject(item.projectId, item.projectTitle),
        },
      })
      return
    }
    navigateToSourceProject(item.projectId)
  }

  const openProject = (projectId: string) => {
    const recycled = allItems.find(
      (item) => item.projectId === projectId && item.sourceInRecycleBin,
    )
    if (recycled) {
      toast.message('来源项目在回收站', {
        description: '恢复后可重新打开项目。',
        action: {
          label: '恢复项目',
          onClick: () => void restoreSourceProject(projectId, recycled.projectTitle),
        },
      })
      return
    }
    navigateToSourceProject(projectId)
  }

  const hasFilters =
    debouncedKeyword.trim().length > 0 || selectedKind !== 'all' || selectedProjectId !== 'all'

  const handleCleanupBrokenEntries = async () => {
    if (!brokenItems.length) return
    setCleaningBroken(true)
    try {
      const removedCount = await removeMaterialLibraryEntriesByIds(
        brokenItems.map((item) => item.libraryEntryId),
      )
      await reloadItems()
      setCleanupBrokenOpen(false)
      toast.success(removedCount > 0 ? `已清理 ${removedCount} 个无效素材条目` : '没有可清理的条目')
    } catch (error: unknown) {
      toast.error((error as Error).message || '清理失败')
    } finally {
      setCleaningBroken(false)
    }
  }

  const handleRemoveEntryConfirm = async () => {
    if (!removeTarget) return
    setRemovingEntry(true)
    try {
      const removed = await removeMaterialLibraryEntriesByIds([removeTarget.libraryEntryId])
      await reloadItems()
      setRemoveTarget(null)
      toast.success(removed > 0 ? '已从素材库索引移除' : '没有可清理的条目')
    } catch (error: unknown) {
      toast.error((error as Error).message || '移除失败')
    } finally {
      setRemovingEntry(false)
    }
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants}>
        <PageHeader
          title="素材库"
          description="各项目素材索引汇总；图片保存在来源项目内。来源项目在回收站时条目仍保留，彻底删除后可能变为无效。"
        />
      </motion.div>

      {brokenItems.length > 0 ? (
        <motion.div variants={itemVariants} className="mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  发现 {brokenItems.length} 个无效素材条目
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  通常因来源项目已彻底删除或项目内图片无法读取。来源仅在回收站时条目仍可用。清理仅移除索引记录，不删除项目内文件。
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 border-amber-500/40 hover:bg-amber-500/10"
              onClick={() => setCleanupBrokenOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              清理无效条目
            </Button>
          </div>
        </motion.div>
      ) : null}

      <motion.div variants={itemVariants} className="mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setSelectedKind('all')}
            className={cn(
              'rounded-xl border p-4 text-left transition-all bg-card/50 backdrop-blur-sm',
              selectedKind === 'all'
                ? 'border-orange-500/40 ring-1 ring-orange-500/20'
                : 'border-border/30 hover:border-border/50',
            )}
          >
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Package className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <p className="text-xl font-bold">{typeCounts.total}</p>
                <p className="text-[10px] text-muted-foreground">全部资产</p>
              </div>
            </div>
          </button>

          {ASSET_KINDS.map((kind) => {
            const conf = MATERIAL_KIND_CONFIG[kind]
            const Icon = conf.icon
            return (
              <button
                key={kind}
                type="button"
                onClick={() => setSelectedKind(selectedKind === kind ? 'all' : kind)}
                className={cn(
                  'rounded-xl border p-3.5 text-left transition-all bg-card/50 backdrop-blur-sm',
                  selectedKind === kind
                    ? 'border-orange-500/40 ring-1 ring-orange-500/20'
                    : 'border-border/30 hover:border-border/50',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', conf.bg)}>
                    <Icon className={cn('h-3.5 w-3.5', conf.color)} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-none">{typeCounts[kind]}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{conf.label}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="w-44 shrink-0">
          <Select
            value={selectedProjectId}
            options={projectOptions}
            onChange={setSelectedProjectId}
          />
        </div>

        <div
          className={cn(
            'flex-1 min-w-[220px] flex items-center gap-2.5 px-3.5 py-2 rounded-xl',
            'border border-border/30 bg-card/50 backdrop-blur-sm',
          )}
        >
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            placeholder="搜索资产名称或描述..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className={cn('flex-1 bg-transparent text-sm outline-none', CANVAS_INPUT_PLACEHOLDER)}
          />
        </div>

        <div className="flex rounded-xl border border-border/30 bg-card/50 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setGroupViewMode('category')}
            className={cn(
              'px-3 py-2 text-xs transition-colors flex items-center gap-1.5',
              groupViewMode === 'category'
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            分类
          </button>
          <button
            type="button"
            onClick={() => setGroupViewMode('project')}
            className={cn(
              'px-3 py-2 text-xs transition-colors flex items-center gap-1.5',
              groupViewMode === 'project'
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <FolderKanban className="h-3.5 w-3.5" />
            项目
          </button>
        </div>

        <div className="flex rounded-xl border border-border/30 bg-card/50 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setDisplayMode('grid')}
            className={cn(
              'p-2.5 transition-colors',
              displayMode === 'grid'
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label="网格视图"
          >
            <Grid3X3 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setDisplayMode('list')}
            className={cn(
              'p-2.5 transition-colors',
              displayMode === 'list'
                ? 'bg-foreground/10 text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
            aria-label="列表视图"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </motion.div>

      <motion.div variants={itemVariants}>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3 text-muted-foreground/40" />
            <p className="text-sm">加载素材中...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mb-4">
              <Package className="h-8 w-8 text-orange-400/60" />
            </div>
            <h3 className="text-lg font-semibold mb-1">暂无素材</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {hasFilters
                ? '没有找到匹配的素材，试试调整筛选条件'
                : '在创作工坊或画布中保存资产到素材库后，这里会集中展示；来源在回收站的条目会标注「回收站」'}
            </p>
          </div>
        ) : groupViewMode === 'project' ? (
          <div className="space-y-6">
            {projectGroups.map((group) => (
              <section key={group.projectId}>
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() => openProject(group.projectId)}
                    className="flex items-center gap-2 text-sm font-semibold hover:text-primary transition-colors"
                  >
                    <FolderKanban className="h-4 w-4 text-orange-400" />
                    {group.projectTitle}
                    <span className="text-xs font-normal text-muted-foreground">
                      {group.assets.length} 个资产
                    </span>
                  </button>
                </div>
                {displayMode === 'grid' ? (
                  <MaterialAssetGrid
                    items={group.assets}
                    previewMap={pagedPreviewMap}
                    brokenKeys={brokenEntryKeys}
                    onOpen={openAsset}
                    onRemoveFromIndex={setRemoveTarget}
                  />
                ) : (
                  <MaterialAssetList
                    items={group.assets}
                    previewMap={pagedPreviewMap}
                    brokenKeys={brokenEntryKeys}
                    onOpen={openAsset}
                    onRemoveFromIndex={setRemoveTarget}
                  />
                )}
              </section>
            ))}
          </div>
        ) : displayMode === 'grid' ? (
          <MaterialAssetGrid
            items={pagedItems}
            previewMap={previewMap}
            brokenKeys={brokenEntryKeys}
            onOpen={openAsset}
            onRemoveFromIndex={setRemoveTarget}
          />
        ) : (
          <MaterialAssetList
            items={pagedItems}
            previewMap={previewMap}
            brokenKeys={brokenEntryKeys}
            onOpen={openAsset}
            onRemoveFromIndex={setRemoveTarget}
          />
        )}

        {!loading && filteredItems.length > 0 ? (
          <MaterialPagination
            page={safePage}
            totalPages={totalPages}
            total={filteredItems.length}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        ) : null}
      </motion.div>

      <ConfirmDialog
        open={cleanupBrokenOpen}
        title="清理无效素材条目"
        description={`将仅从素材库索引中移除 ${brokenItems.length} 个无效条目（不删除来源项目内的图片文件）。此操作不可恢复。`}
        confirmLabel="确认清理"
        cancelLabel="取消"
        variant="destructive"
        loading={cleaningBroken}
        onClose={() => {
          if (!cleaningBroken) setCleanupBrokenOpen(false)
        }}
        onConfirm={() => void handleCleanupBrokenEntries()}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title="从素材库索引移除？"
        description={`仅移除「${removeTarget?.asset.name || '该条目'}」的索引记录，不会删除来源项目内的图片文件。`}
        confirmLabel="移除索引"
        cancelLabel="取消"
        variant="destructive"
        loading={removingEntry}
        onClose={() => {
          if (!removingEntry) setRemoveTarget(null)
        }}
        onConfirm={() => void handleRemoveEntryConfirm()}
      />
    </motion.div>
  )
}
