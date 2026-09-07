// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, Package, Search, Square, SquareCheckBig, X } from 'lucide-react'
import { toast } from 'sonner'
import { WORKSHOP_AI_TOKENS } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { materialPreviewKey, MATERIAL_KIND_CONFIG, useMaterialPreviewMap } from '@/components/materials/material-asset-view'
import {
  filterMaterialAssets,
  loadSyncedMaterialLibrary,
  type MaterialLibraryItem,
} from '@/lib/materials/material-library-service'
import { getAssetPreviewPath } from '@/lib/workflow/asset-utils'
import type { AssetKind } from '@/types/workflow'

interface MaterialLibraryPickerDialogProps {
  open: boolean
  defaultKind: AssetKind
  currentProjectId: string
  /** @deprecated 工坊导入不再按 id 拦截重复；保留供旧调用方兼容 */
  existingProjectAssetIds?: ReadonlySet<string>
  /** 当前项目已有资产名称，用于「同名将自动重命名」提示 */
  existingProjectAssetNamesByKind?: Partial<Record<AssetKind, readonly string[]>>
  /** 画布模式：已导入画布的素材库条目 key */
  existingCanvasEntryKeys?: ReadonlySet<string>
  /** 为已有节点选择素材时允许复用已在画布上的条目 */
  allowReuseOnCanvas?: boolean
  /** 最多可选数量；1 表示单选 */
  selectionLimit?: number
  confirmLabel?: string
  /** workflow：添加到创作工坊项目；canvas：添加到画布节点；reference：分镜参考图 */
  mode?: 'workflow' | 'canvas' | 'reference'
  onClose: () => void
  onConfirm: (items: MaterialLibraryItem[]) => Promise<void>
}

const ASSET_KINDS: AssetKind[] = ['character', 'scene', 'prop']

const PAGE_SIZE = 20

function MaterialPickerPagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}) {
  if (totalPages <= 1) {
    return (
      <div className="flex items-center justify-center py-2">
        <p className="text-xs text-muted-foreground/60">共 {total} 个</p>
      </div>
    )
  }

  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)

  return (
    <div className="flex items-center justify-center gap-3 py-2 shrink-0">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs',
          'border border-border/30 hover:bg-muted/30 transition-colors',
          'disabled:opacity-40 disabled:pointer-events-none',
        )}
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        上一页
      </button>
      <span className="text-xs text-muted-foreground tabular-nums">
        {page} / {totalPages}
        <span className="text-muted-foreground/50 ml-1.5">
          ({start}-{end} / {total})
        </span>
      </span>
      <button
        type="button"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        className={cn(
          'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs',
          'border border-border/30 hover:bg-muted/30 transition-colors',
          'disabled:opacity-40 disabled:pointer-events-none',
        )}
      >
        下一页
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function itemKey(item: MaterialLibraryItem): string {
  return item.libraryEntryId || `${item.projectId}:${item.asset.id}`
}

export function MaterialLibraryPickerDialog({
  open,
  defaultKind,
  existingProjectAssetNamesByKind,
  existingCanvasEntryKeys,
  allowReuseOnCanvas = false,
  selectionLimit,
  confirmLabel,
  mode = 'workflow',
  onClose,
  onConfirm,
}: MaterialLibraryPickerDialogProps) {
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [allItems, setAllItems] = useState<MaterialLibraryItem[]>([])
  const [activeKind, setActiveKind] = useState<AssetKind>(defaultKind)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const items = await loadSyncedMaterialLibrary()
      setAllItems(items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setActiveKind(defaultKind)
    setKeyword('')
    setPage(1)
    setSelectedKeys(new Set())
    void loadItems()
  }, [open, defaultKind, loadItems])

  useEffect(() => {
    setPage(1)
  }, [keyword, activeKind])

  const scopedByKeyword = useMemo(
    () => filterMaterialAssets(allItems, { keyword }),
    [allItems, keyword],
  )

  const isItemOnCanvas = useCallback(
    (item: MaterialLibraryItem) => existingCanvasEntryKeys?.has(itemKey(item)) ?? false,
    [existingCanvasEntryKeys],
  )

  const isItemSelectable = useCallback(
    (item: MaterialLibraryItem) => {
      if (mode === 'reference') return Boolean(getAssetPreviewPath(item.asset))
      if (mode === 'canvas' && !allowReuseOnCanvas && isItemOnCanvas(item)) return false
      return true
    },
    [allowReuseOnCanvas, isItemOnCanvas, mode],
  )

  const kindCounts = useMemo(() => {
    const counts: Record<AssetKind, number> = { character: 0, scene: 0, prop: 0 }
    for (const item of scopedByKeyword) {
      counts[item.asset.kind] += 1
    }
    return counts
  }, [scopedByKeyword])

  const filteredByKind = useMemo(
    () => scopedByKeyword.filter((item) => item.asset.kind === activeKind),
    [scopedByKeyword, activeKind],
  )

  const totalPages = Math.max(1, Math.ceil(filteredByKind.length / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const pagedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredByKind.slice(start, start + PAGE_SIZE)
  }, [filteredByKind, page])

  const { previewMap } = useMaterialPreviewMap(pagedItems)

  const toggleItem = (item: MaterialLibraryItem) => {
    if (!isItemSelectable(item)) return
    const key = itemKey(item)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
        return next
      }
      if (selectionLimit === 1) {
        return new Set([key])
      }
      if (selectionLimit && next.size >= selectionLimit) {
        toast.message(`本次最多可选 ${selectionLimit} 项`, {
          description: mode === 'reference' ? '请先取消勾选部分项，或关闭后删除已有参考图。' : undefined,
        })
        return next
      }
      next.add(key)
      return next
    })
  }

  const selectedItems = useMemo(
    () => allItems.filter((item) => selectedKeys.has(itemKey(item)) && isItemSelectable(item)),
    [allItems, selectedKeys, isItemSelectable],
  )

  const selectedCountByKind = useMemo(() => {
    const counts: Record<AssetKind, number> = { character: 0, scene: 0, prop: 0 }
    for (const item of selectedItems) {
      counts[item.asset.kind] += 1
    }
    return counts
  }, [selectedItems])

  const handleConfirm = async () => {
    if (!selectedItems.length) return
    setSubmitting(true)
    try {
      await onConfirm(selectedItems)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const kindLabel = MATERIAL_KIND_CONFIG[activeKind].label
  const remainingSlotsHint =
    typeof selectionLimit === 'number' && selectionLimit > 0
      ? `还可选 ${Math.max(0, selectionLimit - selectedKeys.size)} / ${selectionLimit} 张`
      : null
  const scopeHint =
    mode === 'reference'
      ? `选择${kindLabel}预览图，复制为当前分镜参考图${remainingSlotsHint ? `（${remainingSlotsHint}）` : ''}`
      : mode === 'canvas'
        ? `选择${kindLabel}添加到画布（已在画布上的条目不可重复添加）`
        : `选择${kindLabel}复制到当前项目，同名会自动重命名`

  const handleKindChange = (nextKind: AssetKind) => {
    setActiveKind(nextKind)
    setPage(1)
  }

  const projectNamesForKind = (kind: AssetKind) => existingProjectAssetNamesByKind?.[kind] ?? []

  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto w-full max-w-3xl max-h-[85vh] flex flex-col"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div
                data-testid="material-library-picker-dialog"
                className={cn(
                  'rounded-2xl border border-border/40 bg-card shadow-2xl shadow-black/20',
                  'flex flex-col overflow-hidden min-h-0',
                )}
              >
                <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                      <Package className="h-4 w-4 text-cyan-500" />
                      {mode === 'canvas' ? '从素材库选择' : mode === 'reference' ? '选择参考图' : '从素材库添加资产'}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">{scopeHint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                <div className="flex items-center gap-1 px-5 border-b border-border/30 shrink-0">
                  {ASSET_KINDS.map((kind) => {
                    const conf = MATERIAL_KIND_CONFIG[kind]
                    const KindIcon = conf.icon
                    const selectedInKind = selectedCountByKind[kind]
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => handleKindChange(kind)}
                        className={cn(
                          'flex items-center gap-1.5 px-4 py-2 text-sm transition-colors relative',
                          activeKind === kind
                            ? 'text-cyan-600 dark:text-cyan-400 font-medium'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <KindIcon className="h-3.5 w-3.5" />
                        {conf.label}
                        <span className="text-[10px] opacity-60">({kindCounts[kind]})</span>
                        {selectedInKind > 0 ? (
                          <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-cyan-600 text-[10px] text-white inline-flex items-center justify-center">
                            {selectedInKind}
                          </span>
                        ) : null}
                        {activeKind === kind ? (
                          <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-cyan-500 rounded-full" />
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                <div className="px-5 pb-3 pt-3 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder={`搜索${kindLabel}名称、描述或来源项目…`}
                      className={cn(
                        'w-full h-9 pl-9 pr-3 rounded-lg text-sm',
                        'bg-muted/20 border border-border/40',
                        'focus:outline-none focus:ring-1 focus:ring-cyan-500/40',
                      )}
                    />
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4">
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin mb-2" />
                      <p className="text-sm">正在加载素材库…</p>
                    </div>
                  ) : filteredByKind.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Package className="h-10 w-10 opacity-30 mb-3" />
                      <p className="text-sm">
                        {mode === 'reference'
                          ? `暂无可用${kindLabel}预览图`
                          : `暂无已同步的${kindLabel}`}
                      </p>
                      <p className="text-xs mt-1 opacity-70 max-w-[280px] leading-relaxed">
                        {mode === 'reference'
                          ? '请先在创作工坊「资产」页或无限画布中，将资产保存到素材库索引'
                          : '请先在创作工坊「资产」页或无限画布保存到素材库；来源在回收站的条目仍可选用'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
                        {pagedItems.map((item) => {
                          const key = itemKey(item)
                          const selected = selectedKeys.has(key)
                          const selectable = isItemSelectable(item)
                          const onCanvas = mode === 'canvas' && isItemOnCanvas(item)
                          const nameTaken =
                            mode === 'workflow' &&
                            projectNamesForKind(item.asset.kind).some(
                              (name) =>
                                name.trim().toLowerCase() === item.asset.name.trim().toLowerCase(),
                            )
                          return (
                            <button
                              key={key}
                              type="button"
                              data-testid={`material-library-picker-item-${item.libraryEntryId}`}
                              disabled={!selectable}
                              onClick={() => toggleItem(item)}
                              className={cn(
                                'group relative rounded-lg border overflow-hidden text-left',
                                'bg-card/50 transition-all duration-200',
                                selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-75',
                                selected
                                  ? 'border-cyan-500/60 ring-1 ring-cyan-500/30'
                                  : 'border-border/30',
                                selectable && !selected ? 'hover:border-border/50' : '',
                              )}
                            >
                              <div className="relative aspect-square overflow-hidden bg-muted/5">
                                {previewMap[materialPreviewKey(item)] ? (
                                  <img
                                    src={previewMap[materialPreviewKey(item)]}
                                    alt={item.asset.name}
                                    className={cn(
                                      'w-full h-full object-cover',
                                      !selectable ? 'opacity-60' : '',
                                    )}
                                  />
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/30">
                                    <Package className="h-6 w-6" />
                                  </div>
                                )}
                                {selectable ? (
                                  <div className="absolute top-1.5 right-1.5">
                                    {selected ? (
                                      <SquareCheckBig className="h-4 w-4 text-cyan-400 drop-shadow" />
                                    ) : (
                                      <Square className="h-4 w-4 text-white/70 drop-shadow" />
                                    )}
                                  </div>
                                ) : null}
                                {onCanvas ? (
                                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-muted/90 border border-border/40 text-[9px] text-muted-foreground font-medium">
                                    已在画布
                                  </div>
                                ) : item.sourceInRecycleBin ? (
                                  <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-sky-600/90 text-[9px] text-white font-medium">
                                    回收站
                                  </div>
                                ) : null}
                                {nameTaken ? (
                                  <div className="absolute bottom-0 inset-x-0 bg-amber-500/85 text-[9px] text-center py-0.5 text-white">
                                    同名将自动重命名
                                  </div>
                                ) : null}
                              </div>
                              <div className="px-2 py-1.5">
                                <p className="text-xs font-medium truncate">{item.asset.name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {item.projectTitle}
                                </p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      <MaterialPickerPagination
                        page={page}
                        totalPages={totalPages}
                        total={filteredByKind.length}
                        onPageChange={setPage}
                      />
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-border/20 shrink-0">
                  <p className="text-xs text-muted-foreground">
                    已选 {selectedItems.length} 个
                    {selectedItems.length > 0 ? (
                      <span className="ml-1 opacity-70">
                        （
                        {ASSET_KINDS.filter((k) => selectedCountByKind[k] > 0)
                          .map((k) => `${MATERIAL_KIND_CONFIG[k].label} ${selectedCountByKind[k]}`)
                          .join('、')}
                        ）
                      </span>
                    ) : null}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={onClose}>
                      取消
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      data-testid="material-library-picker-confirm"
                      disabled={!selectedItems.length || submitting}
                      onClick={() => void handleConfirm()}
                      className={cn(WORKSHOP_AI_TOKENS.solid, 'text-white border-0 min-w-[88px]')}
                    >
                      {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        confirmLabel ||
                        `添加${selectedItems.length ? ` (${selectedItems.length})` : ''}`
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
