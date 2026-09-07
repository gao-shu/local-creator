// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  AudioLines,
  ClipboardList,
  Grid2X2,
  ImageIcon,
  LayoutGrid,
  Plus,
  Sparkles,
  Video,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { ToolboxToolModal } from '@/components/toolbox/toolbox-tool-modal'
import { cn } from '@/lib/utils'
import type {
  CanvasAgentSkillDefinition,
  CanvasAgentSkillId,
} from '@/lib/canvas/canvas-agent-types'
import {
  buildCanvasAgentSkillEditorPath,
  filterToolboxSkillsByMediaType,
  formatCanvasAgentSkillCategoryLabel,
  formatCanvasAgentSkillKindLabel,
  formatCanvasAgentSkillMediaTypeLabel,
  formatCanvasAgentSkillModeLabel,
  formatCanvasAgentSkillNodeTypes,
  getCanvasAgentSkillCategoryMeta,
  listToolboxSkillDefinitions,
  listToolboxSkillMediaTypes,
  resolveCanvasProjectIdForSkillLaunch,
  type ToolboxSkillMediaFilter,
} from '@/lib/toolbox/skills-pool'
import { useCanvasProjectStore } from '@/stores/canvas-project-store'

const SKILL_ICONS: Record<CanvasAgentSkillId, typeof ImageIcon> = {
  edit_image: ImageIcon,
  edit_video: Video,
  review_storyboard: ClipboardList,
  extract_voice: AudioLines,
  extract_assets: LayoutGrid,
  smart_storyboard: Sparkles,
  merge_image_grid: Grid2X2,
}

const SKILL_ICON_CLASS: Record<CanvasAgentSkillId, string> = {
  edit_image: 'text-emerald-400',
  edit_video: 'text-violet-400',
  review_storyboard: 'text-amber-400',
  extract_voice: 'text-sky-400',
  extract_assets: 'text-teal-400',
  smart_storyboard: 'text-fuchsia-400',
  merge_image_grid: 'text-orange-400',
}

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

export function SkillsPoolPage() {
  const navigate = useNavigate()
  const allSkills = useMemo(() => listToolboxSkillDefinitions(), [])
  const mediaTypes = useMemo(() => listToolboxSkillMediaTypes(), [])
  const [mediaFilter, setMediaFilter] = useState<ToolboxSkillMediaFilter>('all')
  const [detailSkill, setDetailSkill] = useState<CanvasAgentSkillDefinition | null>(null)
  const [launchingId, setLaunchingId] = useState<CanvasAgentSkillId | null>(null)

  const skills = useMemo(
    () => filterToolboxSkillsByMediaType(allSkills, mediaFilter),
    [allSkills, mediaFilter],
  )

  const loadProjects = useCanvasProjectStore((s) => s.loadProjects)
  const projects = useCanvasProjectStore((s) => s.projects)
  const activeEditorMeta = useCanvasProjectStore((s) => s.activeEditorMeta)

  const launchInCanvas = useCallback(
    async (skill: CanvasAgentSkillDefinition) => {
      setLaunchingId(skill.id)
      try {
        if (!projects.length) {
          await loadProjects()
        }
        const latest = useCanvasProjectStore.getState()
        const projectId = resolveCanvasProjectIdForSkillLaunch({
          projects: latest.projects,
          preferredProjectId: latest.activeEditorMeta?.id ?? activeEditorMeta?.id,
        })
        if (!projectId) {
          toast.message('请先创建一个画布项目，再使用该 Skill')
          navigate('/canvas')
          return
        }
        navigate(buildCanvasAgentSkillEditorPath(projectId, skill.id))
      } finally {
        setLaunchingId(null)
      }
    },
    [activeEditorMeta?.id, loadProjects, navigate, projects.length],
  )

  const countByMedia = useMemo(() => {
    const map = new Map<string, number>()
    for (const skill of allSkills) {
      map.set(skill.mediaType, (map.get(skill.mediaType) || 0) + 1)
    }
    return map
  }, [allSkills])

  return (
    <>
      <motion.div
        className="max-w-[960px]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <button
            type="button"
            onClick={() => navigate('/toolbox')}
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            返回工具箱
          </button>
          <PageHeader
            title="Skills 池"
            description="按文本 / 图片 / 视频组织的画布 Agent 能力目录"
            action={
              <button
                type="button"
                disabled
                title="即将支持自定义 Skill"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs text-muted-foreground opacity-60"
              >
                <Plus className="h-3.5 w-3.5" />
                创建 Skill
              </button>
            }
          />
        </motion.div>

        <motion.p variants={itemVariants} className="mb-3 text-xs text-muted-foreground">
          数据来自 Canvas Agent Skill Registry（系统内置 · 只读）。Chat 不是 Skill；改图/改视频是兜底能力。
        </motion.p>

        <motion.div
          variants={itemVariants}
          className="mb-5 flex gap-1.5 overflow-x-auto pb-1"
          data-testid="skills-pool-category-tabs"
        >
          <button
            type="button"
            data-testid="skills-pool-category-all"
            onClick={() => setMediaFilter('all')}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              mediaFilter === 'all'
                ? 'border-primary/45 bg-primary/12 text-primary'
                : 'border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
            )}
          >
            精选
            <span className="ml-1 tabular-nums opacity-70">{allSkills.length}</span>
          </button>
          {mediaTypes.map((media) => {
            const count = countByMedia.get(media.id) || 0
            const active = mediaFilter === media.id
            return (
              <button
                key={media.id}
                type="button"
                data-testid={`skills-pool-category-${media.id}`}
                onClick={() => setMediaFilter(media.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                  active
                    ? 'border-primary/45 bg-primary/12 text-primary'
                    : 'border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                  count === 0 && !active ? 'opacity-55' : null,
                )}
              >
                {media.label}
                <span className="ml-1 tabular-nums opacity-70">{count}</span>
              </button>
            )
          })}
        </motion.div>

        {skills.length === 0 ? (
          <motion.div
            variants={itemVariants}
            className="rounded-2xl border border-dashed border-border/40 bg-muted/15 px-6 py-12 text-center"
            data-testid="skills-pool-empty"
          >
            <p className="text-sm text-muted-foreground">
              「{mediaFilter === 'all' ? '全部' : formatCanvasAgentSkillMediaTypeLabel(mediaFilter)}」下暂无
              Skill
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="skills-pool-grid">
            {skills.map((skill) => {
              const Icon = SKILL_ICONS[skill.id]
              return (
                <motion.div key={skill.id} variants={itemVariants}>
                  <article
                    data-testid={`skills-pool-card-${skill.id}`}
                    className={cn(
                      'flex min-h-[168px] flex-col gap-3 rounded-2xl border border-border/30',
                      'bg-card/40 p-5 backdrop-blur-sm',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={cn(
                          'flex h-11 w-11 items-center justify-center rounded-2xl bg-muted/40',
                          SKILL_ICON_CLASS[skill.id],
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {formatCanvasAgentSkillMediaTypeLabel(skill.mediaType)}
                        </span>
                        <span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {formatCanvasAgentSkillCategoryLabel(skill.category)}
                        </span>
                        <span className="rounded-full border border-border/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {formatCanvasAgentSkillModeLabel(skill.mode)}
                        </span>
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          {formatCanvasAgentSkillKindLabel(skill)}
                        </span>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-semibold">{skill.name}</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {skill.description}
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-border/40 px-3 py-1.5 text-xs hover:bg-muted/40"
                        onClick={() => setDetailSkill(skill)}
                      >
                        查看详情
                      </button>
                      <button
                        type="button"
                        data-testid={`skills-pool-use-${skill.id}`}
                        disabled={launchingId === skill.id}
                        className="inline-flex items-center gap-1 rounded-xl border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15 disabled:opacity-50"
                        onClick={() => void launchInCanvas(skill)}
                      >
                        <Sparkles className="h-3 w-3" />
                        在画布中使用
                      </button>
                    </div>
                  </article>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {detailSkill ? (
        <ToolboxToolModal
          open
          title={detailSkill.name}
          description={detailSkill.description}
          icon={SKILL_ICONS[detailSkill.id]}
          iconClassName={SKILL_ICON_CLASS[detailSkill.id]}
          badge="System"
          onClose={() => setDetailSkill(null)}
        >
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">媒体类型</dt>
              <dd className="mt-0.5">
                {formatCanvasAgentSkillMediaTypeLabel(detailSkill.mediaType)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">生产步骤</dt>
              <dd className="mt-0.5">
                {formatCanvasAgentSkillCategoryLabel(detailSkill.category)}
                {getCanvasAgentSkillCategoryMeta(detailSkill.category)?.pipeline
                  ? `（${getCanvasAgentSkillCategoryMeta(detailSkill.category)?.pipeline}）`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">类型</dt>
              <dd className="mt-0.5">
                {formatCanvasAgentSkillModeLabel(detailSkill.mode)} ·{' '}
                {formatCanvasAgentSkillKindLabel(detailSkill)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">适用节点</dt>
              <dd className="mt-0.5">
                {formatCanvasAgentSkillNodeTypes(detailSkill.supportedNodeTypes)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">是否需要确认</dt>
              <dd className="mt-0.5">
                {detailSkill.requiresConfirmation ? '是（执行前确认）' : '否'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Skill ID</dt>
              <dd className="mt-0.5 font-mono text-xs text-muted-foreground">{detailSkill.id}</dd>
            </div>
            <div className="pt-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-xl border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/15"
                onClick={() => {
                  const skill = detailSkill
                  setDetailSkill(null)
                  void launchInCanvas(skill)
                }}
              >
                <Sparkles className="h-3 w-3" />
                在画布中使用
              </button>
            </div>
          </dl>
        </ToolboxToolModal>
      ) : null}
    </>
  )
}
