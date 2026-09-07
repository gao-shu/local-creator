import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus, Search, FolderInput } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { CANVAS_INPUT_PLACEHOLDER } from '@/lib/canvas/canvas-node-theme'
import { cn } from '@/lib/utils'
import { CreateProjectDialog } from '@/components/workshop/create-project-dialog'
import { EditProjectDialog, type EditProjectPayload } from '@/components/workshop/edit-project-dialog'
import { ProjectCard } from '@/components/workshop/project-card'
import { ProjectCreateCard } from '@/components/workshop/project-create-card'
import { ProjectListPagination } from '@/components/workshop/project-list-pagination'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { listDeletedWorkflowProjects } from '@/lib/storage/workflow-service'
import {
  countStaleRecycleBinItems,
  RECYCLE_BIN_STALE_DAYS,
} from '@/lib/storage/project-soft-delete'
import { readImageAsDataUrl, selectReferenceImage } from '@/lib/storage/fs-service'
import { resolveProjectRoot } from '@/lib/storage/project-paths'
import { ensureDataRootConfigured } from '@/lib/storage/data-root-guard'
import { readSettings } from '@/lib/storage/settings-service'
import { readWorkflowData } from '@/lib/storage/workflow-service'
import {
  collectProjectCoverCandidates,
  referenceProjectCoverPath,
  resolveProjectCardPreviews,
  saveProjectCoverImage,
  type ProjectCoverCandidate,
} from '@/lib/workflow/project-cover-utils'
import { collectProjectPreviewPaths } from '@/lib/workflow/project-preview-utils'
import { normalizeWorkflowStep } from '@/lib/workflow/step-utils'
import {
  exportWorkflowProject,
  importWorkflowProject,
} from '@/lib/workflow/project-portable-service'
import { useWorkflowProjectStore } from '@/stores/workflow-project-store'
import type { CreateProjectSubmitPayload } from '@/components/workshop/create-project-dialog'
import type { WorkflowProjectMeta } from '@/types/workflow'

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

export function ProjectListPage() {
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState<WorkflowProjectMeta | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [staleRecycleCount, setStaleRecycleCount] = useState(0)
  const [previewMap, setPreviewMap] = useState<Record<string, string[]>>({})
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const [importing, setImporting] = useState(false)
  const [editContextLoading, setEditContextLoading] = useState(false)
  const [editContext, setEditContext] = useState<{
    autoPreviewUrls: string[]
    manualPreviewUrl: string | null
    hasManualCover: boolean
    assetCandidates: ProjectCoverCandidate[]
    assetPreviewUrls: Record<string, string>
  } | null>(null)

  const {
    projects,
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
    pageProjects,
    totalPages,
    filteredProjects,
  } = useWorkflowProjectStore()

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const deleted = await listDeletedWorkflowProjects()
        if (!cancelled) setStaleRecycleCount(countStaleRecycleBinItems(deleted))
      } catch {
        if (!cancelled) setStaleRecycleCount(0)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [projects])

  const refreshPreviews = useCallback(() => {
    setPreviewRefreshKey((value) => value + 1)
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshPreviews()
    }
    window.addEventListener('focus', refreshPreviews)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', refreshPreviews)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refreshPreviews])

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
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
      navigate(`/workshop/${project.id}/step/${normalizeWorkflowStep(project.currentStep)}`)
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

  const handleImportProject = async () => {
    setImporting(true)
    try {
      const res = await importWorkflowProject()
      if (res.canceled) return
      if (!res.success) {
        toast.error(res.error || '导入失败')
        return
      }
      toast.success('项目已导入，音色与媒体文件已随项目目录一并复制')
      await load()
      refreshPreviews()
    } finally {
      setImporting(false)
    }
  }

  const handleExportProject = async (projectId: string) => {
    const res = await exportWorkflowProject(projectId)
    if (res.canceled) return
    if (!res.success) {
      toast.error(res.error || '导出失败')
      return
    }
    toast.success(`项目已导出到：${res.targetDir}`)
  }

  const handleEditSubmit = async (payload: EditProjectPayload) => {
    if (!editingProject) return
    const settingsRes = await readSettings()
    const patch: Partial<WorkflowProjectMeta> = {
      title: payload.title,
      description: payload.description,
    }

    const coverChange = payload.coverChange ?? 'keep'
    if (coverChange === 'auto') {
      patch.coverImagePath = undefined
    } else if (coverChange !== 'keep') {
      if (coverChange.source === 'upload') {
        patch.coverImagePath = await saveProjectCoverImage(coverChange.dataUrl, {
          settings: settingsRes.data,
          appDataDir: settingsRes.appDataDir,
          projectId: editingProject.id,
        })
      } else {
        patch.coverImagePath = referenceProjectCoverPath(coverChange.path, {
          settings: settingsRes.data,
          appDataDir: settingsRes.appDataDir,
          projectId: editingProject.id,
        })
      }
    }

    const updated = await update(editingProject.id, patch)
    if (updated) {
      setEditingProject(null)
      setEditContext(null)
      refreshPreviews()
    }
  }

  const visible = pageProjects()
  const pages = totalPages()
  const filteredCount = filteredProjects().length
  const visibleIds = useMemo(() => visible.map((p) => p.id).join(','), [visible])

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
        const data = await readWorkflowData(editingProject.id)
        const projectRoot = resolveProjectRoot(
          settingsRes.data,
          settingsRes.appDataDir,
          editingProject.id,
        )
        const autoPaths = collectProjectPreviewPaths(data)
        const autoPreviewUrls = (
          await Promise.all(autoPaths.map((filePath) => readImageAsDataUrl(filePath, projectRoot)))
        ).filter((url): url is string => Boolean(url))

        const assetCandidates = collectProjectCoverCandidates(data)
        const assetPreviewEntries = await Promise.all(
          assetCandidates.map(async (candidate) => {
            const url = await readImageAsDataUrl(candidate.path, projectRoot)
            return url ? ([candidate.path, url] as const) : null
          }),
        )

        let manualPreviewUrl: string | null = null
        if (editingProject.coverImagePath) {
          manualPreviewUrl = await readImageAsDataUrl(
            editingProject.coverImagePath,
            projectRoot,
          )
        }

        if (!cancelled) {
          setEditContext({
            autoPreviewUrls,
            manualPreviewUrl,
            hasManualCover: Boolean(editingProject.coverImagePath && manualPreviewUrl),
            assetCandidates,
            assetPreviewUrls: Object.fromEntries(
              assetPreviewEntries.filter((entry): entry is [string, string] => entry != null),
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!visible.length) {
        setPreviewMap({})
        return
      }
      const settingsRes = await readSettings()
      const entries = await Promise.all(
        visible.map(async (project) => {
          try {
            const { urls } = await resolveProjectCardPreviews(project, {
              settings: settingsRes.data,
              appDataDir: settingsRes.appDataDir,
            })
            return [project.id, urls] as const
          } catch {
            return [project.id, []] as const
          }
        }),
      )
      if (!cancelled) {
        setPreviewMap(Object.fromEntries(entries))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [visibleIds, visible, previewRefreshKey])

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
            <h1 className="text-2xl font-bold tracking-tight">项目管理</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">管理你的漫画创作项目</p>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md sm:justify-end">
            <button
              type="button"
              disabled={importing}
              onClick={() => void handleImportProject()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-border/40 px-3 py-2 text-sm transition-colors hover:bg-muted/40 disabled:opacity-50"
            >
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderInput className="h-4 w-4" />}
              导入
            </button>
            <div
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-xl px-3 py-2',
                'border border-border/30 bg-card/50 backdrop-blur-sm',
              )}
            >
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                data-testid="workshop-project-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索项目..."
                className={cn(
                  'min-w-0 flex-1 bg-transparent text-sm outline-none',
                  CANVAS_INPUT_PLACEHOLDER,
                )}
              />
            </div>
          </div>
        </motion.div>

        {missingDataRoot ? (
          <motion.div
            variants={itemVariants}
            data-testid="workshop-missing-data-root-banner"
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
            中选择数据根目录，才能创建和管理项目。
          </motion.div>
        ) : null}

        {!missingDataRoot && staleRecycleCount > 0 ? (
          <motion.div
            variants={itemVariants}
            className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90"
          >
            回收站中有 {staleRecycleCount} 个项目已存放超过 {RECYCLE_BIN_STALE_DAYS}{' '}
            天（不会自动删除）。可在{' '}
            <button
              type="button"
              className="font-medium underline underline-offset-2 hover:text-amber-50"
              onClick={() => navigate('/workshop/recycle')}
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
                label="新建项目"
                testId="workshop-create-project"
                disabled={missingDataRoot}
                onClick={openCreateDialog}
              />
              {visible.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  previewUrls={previewMap[project.id]}
                  deleting={deletingId === project.id}
                  onOpen={() =>
                    navigate(
                      `/workshop/${project.id}/step/${normalizeWorkflowStep(project.currentStep)}`,
                    )
                  }
                  onEdit={(e) => {
                    e.stopPropagation()
                    setEditingProject(project)
                  }}
                  onDelete={(e) => handleDeleteClick(e, project.id)}
                />
              ))}
            </motion.div>

            {filteredCount > 0 ? (
              <motion.div variants={itemVariants}>
                <ProjectListPagination
                  total={filteredCount}
                  page={page}
                  pages={pages}
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
              <p className="text-sm text-muted-foreground">没有找到匹配的项目</p>
            </div>
          </motion.div>
        )}
      </motion.div>

      <CreateProjectDialog
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={handleCreate}
      />

      <EditProjectDialog
        open={Boolean(editingProject)}
        project={editingProject}
        loadingContext={editContextLoading}
        autoPreviewUrls={editContext?.autoPreviewUrls ?? []}
        manualPreviewUrl={editContext?.manualPreviewUrl ?? null}
        hasManualCover={editContext?.hasManualCover ?? Boolean(editingProject?.coverImagePath)}
        assetCandidates={editContext?.assetCandidates ?? []}
        assetPreviewUrls={editContext?.assetPreviewUrls ?? {}}
        onClose={() => {
          setEditingProject(null)
          setEditContext(null)
        }}
        onSubmit={handleEditSubmit}
        onPickCoverFile={handlePickCover}
        onExportProject={
          editingProject
            ? () => handleExportProject(editingProject.id)
            : undefined
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        title="移入回收站？"
        description="项目将从列表中隐藏，文件仍保留；其中的素材在彻底删除前仍可在素材库使用。可随时在回收站恢复。不会自动过期删除。"
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
