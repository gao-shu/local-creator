// Copyright (c) local-creator contributors. All rights reserved.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, Search } from 'lucide-react'
import { motion } from 'framer-motion'
import { CreateProjectDialog, type CreateProjectSubmitPayload } from '@/components/workshop/create-project-dialog'
import { ProjectListPagination } from '@/components/workshop/project-list-pagination'
import { ProjectCreateCard } from '@/components/workshop/project-create-card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CanvasProjectCard } from '@/components/canvas/canvas-project-card'
import {
  EditCanvasProjectDialog,
  type EditCanvasProjectPayload,
} from '@/components/canvas/edit-canvas-project-dialog'
import { CANVAS_INPUT_PLACEHOLDER } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'
import type { CanvasProjectMeta } from '@/types/canvas'
import { useCanvasProjectStore } from '@/stores/canvas-project-store'
import {
  collectCanvasCoverCandidates,
  collectCanvasPreviewPaths,
  pickCanvasCoverFromNodes,
  referenceCanvasCoverPath,
  saveCanvasCoverImage,
  type CanvasCoverCandidate,
} from '@/lib/canvas/canvas-cover-utils'
import { resolveCanvasProjectRoot } from '@/lib/canvas/canvas-project-paths'
import { listDeletedCanvasProjects, readCanvasData } from '@/lib/storage/canvas-service'
import {
  countStaleRecycleBinItems,
  RECYCLE_BIN_STALE_DAYS,
} from '@/lib/storage/project-soft-delete'
import { ensureDataRootConfigured } from '@/lib/storage/data-root-guard'
import { readImageAsDataUrl, selectReferenceImage } from '@/lib/storage/fs-service'
import { readSettings } from '@/lib/storage/settings-service'

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

export function CanvasListPage() {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState<CanvasProjectMeta | null>(null)
  const [editContextLoading, setEditContextLoading] = useState(false)
  const [editContext, setEditContext] = useState<{
    autoPreviewUrls: string[]
    manualPreviewUrl: string | null
    hasManualCover: boolean
    nodeCandidates: CanvasCoverCandidate[]
    nodePreviewUrls: Record<string, string>
  } | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [staleRecycleCount, setStaleRecycleCount] = useState(0)

  const {
    loading,
    missingDataRoot,
    search,
    page,
    pageSize,
    load,
    setSearch,
    setPage,
    setPageSize,
    create,
    update,
    remove,
    projects,
    pageProjects,
    totalPages,
    filteredProjects,
  } = useCanvasProjectStore()

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const deleted = await listDeletedCanvasProjects()
        if (!cancelled) setStaleRecycleCount(countStaleRecycleBinItems(deleted))
      } catch {
        if (!cancelled) setStaleRecycleCount(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projects])

  useEffect(() => {
    if (!editingProject) {
      setEditContext(null)
      setEditContextLoading(false)
      return
    }

    let cancelled = false
    setEditContextLoading(true)

    ;(async () => {
      try {
        const settingsRes = await readSettings()
        const data = await readCanvasData(editingProject.id)
        const projectRoot = resolveCanvasProjectRoot(
          settingsRes.data,
          settingsRes.appDataDir,
          editingProject.id,
        )
        const autoPaths = collectCanvasPreviewPaths(data.nodes)
        const autoPreviewUrls = (
          await Promise.all(autoPaths.map((filePath) => readImageAsDataUrl(filePath, projectRoot)))
        ).filter((url): url is string => Boolean(url))

        const nodeCandidates = collectCanvasCoverCandidates(data.nodes)
        const nodePreviewEntries = await Promise.all(
          nodeCandidates.map(async (candidate) => {
            const url = await readImageAsDataUrl(candidate.path, projectRoot)
            return url ? ([candidate.path, url] as const) : null
          }),
        )

        let manualPreviewUrl: string | null = null
        if (editingProject.coverManual && editingProject.coverImagePath) {
          manualPreviewUrl = await readImageAsDataUrl(
            editingProject.coverImagePath,
            projectRoot,
          )
        }

        if (!cancelled) {
          setEditContext({
            autoPreviewUrls,
            manualPreviewUrl,
            hasManualCover: Boolean(editingProject.coverManual && manualPreviewUrl),
            nodeCandidates,
            nodePreviewUrls: Object.fromEntries(
              nodePreviewEntries.filter((entry): entry is [string, string] => entry != null),
            ),
          })
        }
      } finally {
        if (!cancelled) setEditContextLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [editingProject])

  const visible = pageProjects()

  const handleDeleteClick = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setDeleteTargetId(id)
  }

  const handleDeleteConfirm = async () => {
    const id = deleteTargetId
    setDeleteTargetId(null)
    if (!id) return

    setDeletingId(id)
    try {
      await remove(id)
    } finally {
      setDeletingId(null)
    }
  }

  const handleCreate = async (payload: CreateProjectSubmitPayload) => {
    const project = await create(payload.title, payload.description)
    if (project) {
      navigate(`/canvas/${project.id}`)
    }
  }

  const openCreateDialog = async () => {
    if (!(await ensureDataRootConfigured())) {
      return
    }
    setShowCreate(true)
  }

  const handlePickCover = async () => {
    const picked = await selectReferenceImage({ includeDataUrl: true })
    if (picked.canceled) return null
    if (!picked.success || !picked.dataUrl) {
      throw new Error(picked.error || '选择图片失败')
    }
    return picked.dataUrl
  }

  const handleEdit = async (payload: EditCanvasProjectPayload) => {
    if (!editingProject) return
    const settingsRes = await readSettings()
    const patch: Partial<CanvasProjectMeta> = {
      title: payload.title,
      description: payload.description,
    }

    const coverChange = payload.coverChange ?? 'keep'
    if (coverChange === 'auto') {
      patch.coverManual = false
      const data = await readCanvasData(editingProject.id)
      patch.coverImagePath = pickCanvasCoverFromNodes(data.nodes)
    } else if (coverChange !== 'keep') {
      patch.coverManual = true
      if (coverChange.source === 'upload') {
        patch.coverImagePath = await saveCanvasCoverImage(coverChange.dataUrl, {
          settings: settingsRes.data,
          appDataDir: settingsRes.appDataDir,
          projectId: editingProject.id,
        })
      } else {
        patch.coverImagePath = referenceCanvasCoverPath(coverChange.path, {
          settings: settingsRes.data,
          appDataDir: settingsRes.appDataDir,
          projectId: editingProject.id,
        })
      }
    }

    await update(editingProject.id, patch)
    setEditingProject(null)
    setEditContext(null)
  }

  const filteredCount = filteredProjects().length
  const showCreateInGrid = !loading && (projects.length === 0 || filteredCount > 0)

  return (
    <>
      <motion.div
        className="mx-auto w-full max-w-[1280px]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div
          variants={itemVariants}
          className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">无限画布</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">自由编排 Prompt、生图与生视频</p>
          </div>
          <div
            className={cn(
              'flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2 sm:max-w-md',
              'border border-border/30 bg-card/50 backdrop-blur-sm',
            )}
          >
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              type="text"
              data-testid="canvas-project-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索画布项目..."
              className={cn(
                'min-w-0 flex-1 bg-transparent text-sm outline-none',
                CANVAS_INPUT_PLACEHOLDER,
              )}
            />
          </div>
        </motion.div>

        {missingDataRoot ? (
          <motion.div
            variants={itemVariants}
            className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
          >
            请先在{' '}
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:text-amber-50"
              onClick={() => navigate('/settings')}
            >
              系统设置 → 存储位置
            </button>{' '}
            中选择数据根目录，才能创建和管理画布项目。
          </motion.div>
        ) : null}

        {!missingDataRoot && staleRecycleCount > 0 ? (
          <motion.div
            variants={itemVariants}
            className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
          >
            回收站中有 {staleRecycleCount} 个画布已存放超过 {RECYCLE_BIN_STALE_DAYS}{' '}
            天（不会自动删除）。可在{' '}
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:text-amber-50"
              onClick={() => navigate('/canvas/recycle')}
            >
              回收站
            </button>{' '}
            恢复或彻底删除以释放空间。
          </motion.div>
        ) : null}

        {loading ? (
          <motion.div variants={itemVariants} className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground text-sm">加载中...</span>
          </motion.div>
        ) : showCreateInGrid ? (
          <>
            <motion.div
              variants={itemVariants}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              <ProjectCreateCard
                label="新建画布"
                testId="canvas-create-project"
                disabled={missingDataRoot}
                onClick={openCreateDialog}
              />
              {visible.map((project) => (
                <CanvasProjectCard
                  key={project.id}
                  project={project}
                  deleting={deletingId === project.id}
                  onOpen={() => navigate(`/canvas/${project.id}`)}
                  onEdit={(e) => {
                    e?.stopPropagation()
                    setEditingProject(project)
                  }}
                  onDelete={(e) => handleDeleteClick(project.id, e)}
                />
              ))}
            </motion.div>

            {filteredCount > 0 ? (
              <motion.div variants={itemVariants} className="mt-6">
                <ProjectListPagination
                  total={filteredCount}
                  page={page}
                  pages={totalPages()}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </motion.div>
            ) : null}
          </>
        ) : (
          <motion.div variants={itemVariants} className="mt-8">
            <div
              className={cn(
                'flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-border/40 p-16 text-center',
                'bg-card/20',
              )}
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-muted/40">
                <Plus className="h-7 w-7 text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground">没有找到匹配的画布项目</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
        dialogTitle="新建画布"
        submitLabel="创建画布"
        testIdPrefix="canvas-create"
      />

      <EditCanvasProjectDialog
        open={Boolean(editingProject)}
        project={editingProject}
        loadingContext={editContextLoading}
        autoPreviewUrls={editContext?.autoPreviewUrls ?? []}
        manualPreviewUrl={editContext?.manualPreviewUrl ?? null}
        hasManualCover={editContext?.hasManualCover ?? Boolean(editingProject?.coverManual)}
        nodeCandidates={editContext?.nodeCandidates ?? []}
        nodePreviewUrls={editContext?.nodePreviewUrls ?? {}}
        onClose={() => {
          setEditingProject(null)
          setEditContext(null)
        }}
        onSubmit={handleEdit}
        onPickCoverFile={handlePickCover}
      />

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="移入回收站？"
        description="画布项目将从列表中隐藏，文件仍保留；其中的素材在彻底删除前仍可在素材库使用。可随时在回收站恢复。不会自动过期删除。"
        confirmLabel="移入回收站"
        cancelLabel="取消"
        variant="destructive"
        loading={Boolean(deleteTargetId && deletingId === deleteTargetId)}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => void handleDeleteConfirm()}
      />

    </>
  )
}
