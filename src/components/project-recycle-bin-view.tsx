// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Loader2, Search, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ProjectListPagination } from '@/components/workshop/project-list-pagination'
import { CANVAS_INPUT_PLACEHOLDER } from '@/lib/canvas/canvas-node-theme'
import {
  countStaleRecycleBinItems,
  isRecycleBinItemStale,
  RECYCLE_BIN_STALE_DAYS,
} from '@/lib/storage/project-soft-delete'
import { cn } from '@/lib/utils'

export interface RecycleBinListItem {
  id: string
  title: string
  description?: string
  deletedAt?: number
  updatedAt: number
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
}

interface ProjectRecycleBinViewProps<T extends RecycleBinListItem> {
  kindLabel: string
  subtitle: string
  searchPlaceholder: string
  testIdPrefix: string
  gridClassName: string
  listDeleted: () => Promise<T[]>
  restoreProject: (projectId: string) => Promise<unknown>
  purgeProject: (projectId: string) => Promise<void>
  renderCard: (item: T, ctx: { busy: boolean; onRestore: () => void; onPurge: () => void }) => ReactNode
}

export function ProjectRecycleBinView<T extends RecycleBinListItem>({
  kindLabel,
  subtitle,
  searchPlaceholder,
  testIdPrefix,
  gridClassName,
  listDeleted,
  restoreProject,
  purgeProject,
  renderCard,
}: ProjectRecycleBinViewProps<T>) {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<T[]>([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [purgeTarget, setPurgeTarget] = useState<T | null>(null)
  const [purgeAllOpen, setPurgeAllOpen] = useState(false)
  const [purgingAll, setPurgingAll] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const next = await listDeleted()
      setItems(next)
    } catch (error: unknown) {
      toast.error((error as Error).message || '加载回收站失败')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [listDeleted])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    setPage(1)
  }, [search, pageSize])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => {
      const title = (item.title || '').toLowerCase()
      const description = (item.description || '').toLowerCase()
      return title.includes(q) || description.includes(q)
    })
  }, [items, search])

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
  const safePage = Math.min(page, pages)
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)
  const staleCount = useMemo(() => countStaleRecycleBinItems(items), [items])

  const handleRestore = async (item: T) => {
    setBusyId(item.id)
    try {
      await restoreProject(item.id)
      toast.success(`已恢复「${item.title || kindLabel}」`)
      await reload()
    } catch (error: unknown) {
      toast.error((error as Error).message || '恢复失败')
    } finally {
      setBusyId(null)
    }
  }

  const handlePurgeConfirm = async () => {
    if (!purgeTarget) return
    const target = purgeTarget
    setBusyId(target.id)
    try {
      await purgeProject(target.id)
      toast.success(`已彻底删除「${target.title || kindLabel}」`)
      setPurgeTarget(null)
      await reload()
    } catch (error: unknown) {
      toast.error((error as Error).message || '彻底删除失败')
    } finally {
      setBusyId(null)
    }
  }

  const handlePurgeAllConfirm = async () => {
    if (!items.length) return
    setPurgingAll(true)
    try {
      for (const item of items) {
        await purgeProject(item.id)
      }
      toast.success(`已清空回收站（${items.length} 个${kindLabel}）`)
      setPurgeAllOpen(false)
      await reload()
    } catch (error: unknown) {
      toast.error((error as Error).message || '清空回收站失败')
      await reload()
    } finally {
      setPurgingAll(false)
    }
  }

  return (
    <>
      <motion.div
        className="max-w-[1200px]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants} className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">回收站</h1>
            <p className="text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!items.length || loading || purgingAll || Boolean(busyId)}
            className="border-red-500/35 text-red-400 hover:bg-red-500/10"
            data-testid={`${testIdPrefix}-purge-all`}
            onClick={() => setPurgeAllOpen(true)}
          >
            清空回收站
          </Button>
        </motion.div>

        {staleCount > 0 ? (
          <motion.div
            variants={itemVariants}
            className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              有 {staleCount} 个{kindLabel}已在回收站超过 {RECYCLE_BIN_STALE_DAYS}{' '}
              天（不会自动删除）。仍可恢复；如需释放空间可彻底删除或清空回收站。
            </p>
          </motion.div>
        ) : null}

        <motion.div variants={itemVariants} className="mb-6">
          <div
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-xl',
              'border border-border/30 bg-card/50 backdrop-blur-sm',
            )}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              data-testid={`${testIdPrefix}-search`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className={cn(
                'flex-1 bg-transparent text-sm outline-none',
                CANVAS_INPUT_PLACEHOLDER,
              )}
            />
          </div>
        </motion.div>

        {loading ? (
          <motion.div variants={itemVariants} className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground text-sm">加载中...</span>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div variants={itemVariants} className="mt-8">
            <div
              className={cn(
                'w-full rounded-xl border border-dashed border-border/40 p-16',
                'flex flex-col items-center justify-center text-center',
                'bg-card/20',
              )}
            >
              <div className="h-14 w-14 rounded-xl bg-muted/40 flex items-center justify-center mb-4">
                <Trash2 className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-muted-foreground text-sm">
                {items.length === 0 ? '回收站是空的' : `没有找到匹配的${kindLabel}`}
              </p>
            </div>
          </motion.div>
        ) : (
          <>
            <motion.div variants={itemVariants} className={gridClassName}>
              {visible.map((item) =>
                renderCard(item, {
                  busy: busyId === item.id || purgingAll,
                  onRestore: () => void handleRestore(item),
                  onPurge: () => setPurgeTarget(item),
                }),
              )}
            </motion.div>

            <motion.div variants={itemVariants} className="mt-8">
              <ProjectListPagination
                total={filtered.length}
                page={safePage}
                pages={pages}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </motion.div>
          </>
        )}
      </motion.div>

      <ConfirmDialog
        open={Boolean(purgeTarget)}
        title="彻底删除？"
        description={`将永久删除「${purgeTarget?.title || kindLabel}」及其本地文件，此操作不可恢复。素材库中指向该项目的条目可能变为无效，可在素材页清理。${
          purgeTarget && isRecycleBinItemStale(purgeTarget.deletedAt ?? 0)
            ? ` 该项已存放超过 ${RECYCLE_BIN_STALE_DAYS} 天。`
            : ''
        }`}
        confirmLabel="彻底删除"
        cancelLabel="取消"
        variant="destructive"
        loading={Boolean(purgeTarget && busyId === purgeTarget.id)}
        onClose={() => setPurgeTarget(null)}
        onConfirm={() => void handlePurgeConfirm()}
      />

      <ConfirmDialog
        open={purgeAllOpen}
        title="清空回收站？"
        description={`将永久删除回收站内全部 ${items.length} 个${kindLabel}及其本地文件，此操作不可恢复。`}
        confirmLabel="清空回收站"
        cancelLabel="取消"
        variant="destructive"
        loading={purgingAll}
        onClose={() => setPurgeAllOpen(false)}
        onConfirm={() => void handlePurgeAllConfirm()}
      />
    </>
  )
}
