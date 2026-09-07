// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  ChevronRight,
  FolderKanban,
  GitBranch,
  ImageIcon,
  Images,
  Loader2,
  MapPin,
  Plus,
  Users,
  Wrench,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { materialPreviewKey, useMaterialPreviewMap } from '@/components/materials/material-asset-view'
import { normalizeWorkflowStep } from '@/lib/workflow/step-utils'
import {
  formatRelativeTime,
  loadRecentAssets,
  loadRecentProjects,
  type RecentAssetItem,
  type RecentProjectItem,
} from '@/lib/dashboard/recent-items-service'
import type { AssetKind } from '@/types/workflow'

const RECENT_PROJECT_KIND_CONFIG = {
  workshop: {
    label: '创作工坊',
    icon: FolderKanban,
    iconClass: 'text-purple-400',
    iconBgClass: 'bg-purple-500/10 group-hover:bg-purple-500/15',
  },
  canvas: {
    label: '无限画布',
    icon: GitBranch,
    iconClass: 'text-cyan-400',
    iconBgClass: 'bg-cyan-500/10 group-hover:bg-cyan-500/15',
  },
} as const

const ASSET_TYPE_CONFIG: Record<
  AssetKind,
  { label: string; icon: typeof Users; color: string; bg: string }
> = {
  character: { label: '角色', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  scene: { label: '场景', icon: MapPin, color: 'text-green-400', bg: 'bg-green-500/10' },
  prop: { label: '道具', icon: Wrench, color: 'text-amber-400', bg: 'bg-amber-500/10' },
}

function SectionHeader({
  title,
  icon,
  action,
  actions,
}: {
  title: string
  icon: React.ReactNode
  action?: { label: string; onClick: () => void }
  actions?: { label: string; onClick: () => void }[]
}) {
  const actionItems = actions ?? (action ? [action] : [])

  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold flex items-center gap-2 text-foreground/80">
        {icon}
        {title}
      </h2>
      {actionItems.length ? (
        <div className="flex items-center gap-1.5">
          {actionItems.map((item, index) => (
            <span key={item.label} className="flex items-center gap-1.5">
              {index > 0 ? <span className="text-muted-foreground/25">·</span> : null}
              <button
                type="button"
                onClick={item.onClick}
                className="text-xs text-muted-foreground/50 hover:text-foreground flex items-center gap-0.5 transition-colors"
              >
                {item.label}
                <ArrowRight className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function RecentProjectList({
  projects,
  onOpenProject,
  onCreateProject,
}: {
  projects: RecentProjectItem[]
  onOpenProject: (item: RecentProjectItem) => void
  onCreateProject: () => void
}) {
  if (projects.length === 0) {
    return (
      <button
        type="button"
        data-testid="workshop-create-project"
        onClick={onCreateProject}
        className={cn(
          'w-full rounded-xl border border-dashed border-border/40 p-10',
          'flex flex-col items-center justify-center text-center',
          'bg-card/20 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-all',
        )}
      >
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
          <Plus className="h-6 w-6 text-primary/60" />
        </div>
        <p className="text-sm font-medium mb-0.5">创建你的第一个项目</p>
        <p className="text-xs text-muted-foreground">可从创作工坊或无限画布列表新建项目</p>
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm overflow-hidden divide-y divide-border/15">
      {projects.map((item) => {
        const conf = RECENT_PROJECT_KIND_CONFIG[item.kind]
        const Icon = conf.icon
        const { project } = item

        return (
          <button
            key={`${item.kind}-${project.id}`}
            type="button"
            onClick={() => onOpenProject(item)}
            className="group w-full flex items-center gap-4 px-4 py-3.5 text-left cursor-pointer hover:bg-muted/20 transition-colors"
          >
            <div
              className={cn(
                'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                conf.iconBgClass,
              )}
            >
              <Icon className={cn('h-4 w-4', conf.iconClass)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                  {project.title}
                </p>
                <span className="shrink-0 rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {conf.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground/60 truncate mt-0.5">
                {project.description || '暂无描述'}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] text-muted-foreground/40 tabular-nums">
                {formatRelativeTime(project.updatedAt)}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors" />
            </div>
          </button>
        )
      })}
    </div>
  )
}

function RecentAssetCard({
  item,
  previewSrc,
  onClick,
}: {
  item: RecentAssetItem
  previewSrc?: string
  onClick: () => void
}) {
  const typeConf = ASSET_TYPE_CONFIG[item.asset.kind]
  const TypeIcon = typeConf.icon
  const [imgError, setImgError] = useState(false)
  const showImage = Boolean(previewSrc) && !imgError

  useEffect(() => {
    setImgError(false)
  }, [previewSrc])

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group rounded-xl border border-border/30 bg-card/50 backdrop-blur-sm',
        'w-36 shrink-0 cursor-pointer overflow-hidden text-left',
        'hover:border-border/50 hover:shadow-lg hover:shadow-black/5 transition-all duration-200',
      )}
    >
      <div className={cn('aspect-[3/4] relative overflow-hidden', typeConf.bg)}>
        {showImage ? (
          <img
            src={previewSrc}
            alt={item.asset.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <TypeIcon className={cn('h-10 w-10 opacity-20', typeConf.color)} />
          </div>
        )}

        {showImage ? (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-black/70 to-transparent pointer-events-none" />
        ) : null}

        <div
          className={cn(
            'absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md',
            'bg-black/40 backdrop-blur-sm text-white/80 text-[9px] font-medium',
          )}
        >
          <TypeIcon className="h-2.5 w-2.5" />
          {typeConf.label}
        </div>

        <div className="absolute bottom-0 inset-x-0 px-2.5 pb-2">
          <p
            className={cn(
              'text-[11px] font-medium truncate',
              showImage ? 'text-white' : 'text-foreground',
            )}
          >
            {item.asset.name}
          </p>
          <p
            className={cn(
              'text-[10px] truncate mt-0.5',
              showImage ? 'text-white/60' : 'text-muted-foreground/60',
            )}
          >
            {item.projectTitle}
          </p>
        </div>
      </div>
    </button>
  )
}

export function DashboardRecentSections({
  onCreateWorkshop,
  onCreateCanvas,
}: {
  onCreateWorkshop: () => void
  onCreateCanvas: () => void
}) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<RecentProjectItem[]>([])
  const [assets, setAssets] = useState<RecentAssetItem[]>([])
  const { previewMap } = useMaterialPreviewMap(assets)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [recentProjects, recentAssets] = await Promise.all([
          loadRecentProjects(3),
          loadRecentAssets(10),
        ])
        if (cancelled) return
        setProjects(recentProjects)
        setAssets(recentAssets)
      } catch (error: unknown) {
        if (cancelled) return
        const message = (error as Error).message || '加载最近项目失败'
        if (message.includes('数据根目录')) {
          toast.message('请先在系统设置中选择数据根目录', { id: 'missing-data-root' })
        }
        setProjects([])
        setAssets([])
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const openProject = (item: RecentProjectItem) => {
    if (item.kind === 'canvas') {
      navigate(`/canvas/${item.project.id}`)
      return
    }
    navigate(
      `/workshop/${item.project.id}/step/${normalizeWorkflowStep(item.project.currentStep)}`,
    )
  }

  const openAsset = (item: RecentAssetItem) => {
    navigate(`/workshop/${item.projectId}/step/3`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8 mt-8">
      <section>
        <SectionHeader
          title="最近项目"
          icon={<FolderKanban className="h-4 w-4 text-purple-400" />}
          actions={
            projects.length > 0
              ? [
                  { label: '新建工坊', onClick: onCreateWorkshop },
                  { label: '新建画布', onClick: onCreateCanvas },
                ]
              : undefined
          }
        />
        <RecentProjectList
          projects={projects}
          onOpenProject={openProject}
          onCreateProject={onCreateWorkshop}
        />
      </section>

      {assets.length > 0 ? (
        <section>
          <SectionHeader
            title="最近资产"
            icon={<Images className="h-4 w-4 text-orange-400" />}
            action={{ label: '全部资产', onClick: () => navigate('/materials') }}
          />
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
            {assets.map((item) => (
              <RecentAssetCard
                key={`${item.projectId}-${item.asset.id}`}
                item={item}
                previewSrc={previewMap[materialPreviewKey(item)]}
                onClick={() => openAsset(item)}
              />
            ))}
          </div>
        </section>
      ) : projects.length > 0 ? (
        <section>
          <SectionHeader
            title="最近资产"
            icon={<Images className="h-4 w-4 text-orange-400" />}
            action={{ label: '新建项目', onClick: onCreateWorkshop }}
          />
          <div className="rounded-xl border border-dashed border-border/40 p-8 flex flex-col items-center text-center bg-card/20">
            <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center mb-2">
              <ImageIcon className="h-5 w-5 text-orange-400/70" />
            </div>
            <p className="text-sm text-muted-foreground">暂无资产，进入项目完成提取后可在此快速访问</p>
          </div>
        </section>
      ) : null}
    </div>
  )
}
