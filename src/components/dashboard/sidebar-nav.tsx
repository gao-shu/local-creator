import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowLeft,
  BookOpen,
  Bot,
  Check,
  Clapperboard,
  Database,
  Images,
  LayoutDashboard,
  MapPin,
  Sparkles,
  ScrollText,
  SlidersHorizontal,
  Users,
  Wrench,
} from 'lucide-react'
import { isCanvasProjectPath, isListReservedSegment, isWorkshopProjectPath } from '@/lib/nav/list-section-paths'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { SidebarFeedbackButton } from '@/components/dashboard/sidebar-feedback-button'
import { isLoginRequired } from '@/lib/auth/login-mode'
import { resolveMaxWorkflowStep } from '@/lib/workflow/step-utils'
import { ensureEpisodesWithScriptPreview } from '@/lib/workflow/episode-utils'
import { getLastWorkflowSaveError, persistWorkflowSession } from '@/lib/workflow/session-persist'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import type { WorkflowStep } from '@/types/workflow'

interface SidebarItem {
  key: string
  label: string
  icon: typeof LayoutDashboard
  href: string
  iconColor: string
}

const dashboardItems: SidebarItem[] = [
  {
    key: 'overview',
    label: '总览',
    icon: LayoutDashboard,
    href: '/dashboard',
    iconColor: 'text-blue-400',
  },
]

const materialsItems: SidebarItem[] = [
  {
    key: 'local',
    label: '本地素材',
    icon: Images,
    href: '/materials',
    iconColor: 'text-orange-400',
  },
  {
    key: 'characters',
    label: '角色库',
    icon: Users,
    href: '/materials/characters',
    iconColor: 'text-blue-400',
  },
  {
    key: 'scenes',
    label: '场景库',
    icon: MapPin,
    href: '/materials/scenes',
    iconColor: 'text-green-400',
  },
  {
    key: 'props',
    label: '道具库',
    icon: Wrench,
    href: '/materials/props',
    iconColor: 'text-amber-400',
  },
]

const toolboxItems: SidebarItem[] = [
  {
    key: 'toolbox',
    label: '实用工具',
    icon: Sparkles,
    href: '/toolbox',
    iconColor: 'text-pink-400',
  },
]

const settingsItems: SidebarItem[] = [
  {
    key: 'paths',
    label: '存储位置',
    icon: Database,
    href: '/settings',
    iconColor: 'text-green-400',
  },
  {
    key: 'models',
    label: '模型配置',
    icon: Bot,
    href: '/settings/models',
    iconColor: 'text-purple-400',
  },
  {
    key: 'templates',
    label: '提示词模板',
    icon: BookOpen,
    href: '/settings/templates',
    iconColor: 'text-cyan-400',
  },
  {
    key: 'system',
    label: '系统参数',
    icon: SlidersHorizontal,
    href: '/settings/system',
    iconColor: 'text-orange-400',
  },
  ...(isLoginRequired()
    ? [{
        key: 'account',
        label: '账户',
        icon: Users,
        href: '/settings/account',
        iconColor: 'text-pink-400',
      } as SidebarItem]
    : []),
  {
    key: 'agreement',
    label: '用户协议',
    icon: ScrollText,
    href: '/settings/agreement',
    iconColor: 'text-muted-foreground',
  },
]

function getWorkshopDetailItems(projectId: string): SidebarItem[] {
  const base = `/workshop/${projectId}`
  return [
    {
      key: 'step1',
      label: 'Step1 剧本',
      icon: BookOpen,
      href: `${base}/step/1`,
      iconColor: 'text-blue-400',
    },
    {
      key: 'step2',
      label: 'Step2 分集',
      icon: BookOpen,
      href: `${base}/step/2`,
      iconColor: 'text-purple-400',
    },
    {
      key: 'step3',
      label: 'Step3 资产',
      icon: Users,
      href: `${base}/step/3`,
      iconColor: 'text-cyan-400',
    },
    {
      key: 'step4',
      label: 'Step4 分镜',
      icon: Clapperboard,
      href: `${base}/step/4`,
      iconColor: 'text-violet-400',
    },
  ]
}

function parseWorkshopProjectId(pathname: string): string | null {
  if (!isWorkshopProjectPath(pathname)) return null
  const match = pathname.match(/^\/workshop\/([^/]+)(?:\/|$)/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return match[1]
  }
}

function parseProjectIdFromPathname(pathname: string): string | null {
  const workshop = pathname.match(/^\/workshop\/([^/]+)/)
  if (workshop?.[1] && !isListReservedSegment(workshop[1])) return workshop[1]
  const canvas = pathname.match(/^\/canvas\/([^/]+)/)
  if (canvas?.[1] && !isListReservedSegment(canvas[1])) return canvas[1]
  return null
}

function parseStepFromHref(href: string): number | null {
  const match = href.match(/\/step\/(\d+)/)
  return match ? Number(match[1]) : null
}

function parseStepFromPathname(pathname: string): number | null {
  const match = pathname.match(/\/step\/(\d+)/)
  return match ? Number(match[1]) : null
}

function parseWorkshopStepLabel(label: string): { step: string; title: string } | null {
  const match = label.match(/^Step(\d+)\s+(.+)$/)
  if (!match) return null
  return { step: `Step${match[1]}`, title: match[2] }
}

function SidebarNavLabel({
  label,
  isActive,
}: {
  label: string
  isActive: boolean
}) {
  const parsed = parseWorkshopStepLabel(label)
  if (!parsed) {
    return <span className="min-w-0 truncate">{label}</span>
  }

  return (
    <span className="min-w-0 flex flex-col gap-0.5 text-left leading-none">
      <span
        className={cn(
          'text-[10px] font-semibold tabular-nums tracking-wide',
          isActive ? 'text-muted-foreground' : 'text-muted-foreground/65',
        )}
      >
        {parsed.step}
      </span>
      <span className={cn('text-[13px] leading-snug', isActive ? 'text-foreground' : 'text-foreground/85')}>
        {parsed.title}
      </span>
    </span>
  )
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { projectId: routeProjectId } = useParams()
  const workshopProjectId = parseWorkshopProjectId(pathname)
  const projectId = workshopProjectId ?? routeProjectId ?? parseProjectIdFromPathname(pathname)
  const maxStep = useWorkflowSessionStore((s) => resolveMaxWorkflowStep(s.meta, s.data))
  const sessionSaving = useWorkflowSessionStore((s) => s.saving)
  const activeStep = parseStepFromPathname(pathname)
  const [navSaving, setNavSaving] = useState(false)

  const isWorkshopProject = Boolean(
    workshopProjectId && isWorkshopProjectPath(pathname),
  )
  const isCanvasProject = isCanvasProjectPath(pathname)

  const { items, sectionTitle, showBack, backLabel } = useMemo(() => {
    if (isWorkshopProject && workshopProjectId) {
      return {
        sectionTitle: '创作项目',
        items: getWorkshopDetailItems(workshopProjectId),
        showBack: true,
        backLabel: '返回项目列表',
      }
    }

    if (isCanvasProject) {
      return {
        sectionTitle: '',
        items: [],
        showBack: false,
        backLabel: '',
      }
    }

    // 工坊 / 画布列表页不展示侧栏导航项（与画布编辑页一致）
    if (pathname.startsWith('/workshop') || pathname.startsWith('/canvas')) {
      return {
        sectionTitle: '',
        items: [],
        showBack: false,
        backLabel: '',
      }
    }

    if (pathname.startsWith('/materials')) {
      return {
        sectionTitle: '素材库',
        items: materialsItems,
        showBack: false,
        backLabel: '',
      }
    }

    if (pathname.startsWith('/toolbox')) {
      return {
        sectionTitle: '工具箱',
        items: toolboxItems,
        showBack: false,
        backLabel: '',
      }
    }

    if (pathname.startsWith('/settings')) {
      return {
        sectionTitle: '系统设置',
        items: settingsItems,
        showBack: false,
        backLabel: '',
      }
    }

    return {
      sectionTitle: '首页',
      items: dashboardItems,
      showBack: false,
      backLabel: '',
    }
  }, [pathname, projectId, workshopProjectId, isWorkshopProject, isCanvasProject])

  const persistBeforeNavigate = async (): Promise<boolean> => {
    if (!isWorkshopProject) return true
    setNavSaving(true)
    try {
      const ok = await persistWorkflowSession({ silent: true })
      if (!ok) {
        const message = getLastWorkflowSaveError() || '保存失败，请重试或点击右上角「保存」'
        toast.error(message)
      }
      return ok
    } finally {
      setNavSaving(false)
    }
  }

  const handleBackToList = async () => {
    if (navSaving || sessionSaving) return
    const stepOnLeave = parseStepFromPathname(pathname)
    if (stepOnLeave != null) {
      const { data, patchData } = useWorkflowSessionStore.getState()
      if (data && data.currentStep !== stepOnLeave) {
        patchData({ currentStep: stepOnLeave as WorkflowStep })
      }
    }
    const ok = await persistBeforeNavigate()
    if (!ok) return
    navigate(isCanvasProject ? '/canvas' : '/workshop')
    onNavigate?.()
  }

  const handleNav = async (href: string) => {
    if (navSaving || sessionSaving) return
    if (href === pathname) return
    const stepNum = parseStepFromHref(href)

    if (isWorkshopProject && stepNum != null) {
      const { data, patchData } = useWorkflowSessionStore.getState()
      if (data && data.currentStep !== stepNum) {
        patchData({ currentStep: stepNum as WorkflowStep })
      }
    }

    if (isWorkshopProject && stepNum != null && stepNum >= 2) {
      const { data, patchData } = useWorkflowSessionStore.getState()
      if (data) {
        const nextEpisodes = ensureEpisodesWithScriptPreview(data)
        if (nextEpisodes !== data.episodes) {
          patchData({ episodes: nextEpisodes })
        }
      }
    }

    const resolvedMaxStep = resolveMaxWorkflowStep(
      useWorkflowSessionStore.getState().meta,
      useWorkflowSessionStore.getState().data,
    )
    if (stepNum != null && stepNum > resolvedMaxStep) return

    if (isWorkshopProject) {
      const ok = await persistBeforeNavigate()
      if (!ok) return
    }

    navigate(href)
    onNavigate?.()
  }

  const navDisabled = navSaving || sessionSaving

  // 列表页已无侧栏菜单项时不渲染空玻璃卡片，避免留下空白「表格」
  if (!isWorkshopProject && items.length === 0 && !showBack && !sectionTitle) {
    return null
  }

  const getIsActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard'
    if (href === '/materials') {
      return pathname === '/materials' || pathname === '/materials/'
    }
    if (href === '/settings') {
      return pathname === '/settings' || pathname === '/settings/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-2',
        'bg-linear-to-b from-background/80 to-background/40',
        'backdrop-blur-lg border border-border/40',
        'shadow-lg',
        isWorkshopProject && 'pb-[4.25rem]',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={
              isCanvasProject
                ? `canvas-${projectId}`
                : isWorkshopProject
                  ? `workshop-${workshopProjectId}`
                  : sectionTitle
            }
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
          <div className={cn('px-3 pt-3 pb-3', isCanvasProject && 'pb-1')}>
            {showBack ? (
              <>
                <button
                  type="button"
                  disabled={navDisabled}
                  onClick={() => void handleBackToList()}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2 group disabled:opacity-50"
                >
                  <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  {backLabel || '返回项目列表'}
                </button>
                <div className="border-b border-border/30 -mx-3 mb-2" />
              </>
            ) : null}
            {!isCanvasProject && sectionTitle ? (
              <h3 className="text-sm font-semibold truncate">{sectionTitle}</h3>
            ) : null}
          </div>

          <nav className="space-y-0.5 px-1 flex-1 min-h-0 overflow-y-auto">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = getIsActive(item.href)
              const isMaterialsNav = pathname.startsWith('/materials')
              const activeAccent =
                isActive && isMaterialsNav ? 'text-orange-400' : isActive ? item.iconColor : ''
              const stepNum = parseStepFromHref(item.href)
              const isLocked = isWorkshopProject && stepNum != null && stepNum > maxStep
              const isCompleted =
                isWorkshopProject &&
                stepNum != null &&
                activeStep != null &&
                stepNum < activeStep
              const isStepNav = stepNum != null

              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={isLocked || navDisabled}
                  onClick={() => void handleNav(item.href)}
                  data-testid={isStepNav ? `workshop-step-nav-${item.key}` : undefined}
                  className={cn(
                    'w-full flex items-center gap-2 rounded-xl text-sm',
                    isStepNav ? 'px-2.5 py-2' : 'px-3 py-2',
                    'transition-all duration-150 relative',
                    isLocked && 'opacity-50 cursor-not-allowed',
                    isActive
                      ? 'font-medium text-foreground bg-foreground/6'
                      : 'text-muted-foreground hover:text-foreground hover:bg-foreground/3',
                    isLocked && 'hover:bg-transparent hover:text-muted-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex shrink-0 items-center self-stretch transition-colors duration-200',
                      isActive ? activeAccent || item.iconColor : 'text-transparent',
                    )}
                  >
                    <div
                      className={cn('w-0.5 rounded-full bg-current', isStepNav ? 'h-9' : 'h-5')}
                    />
                  </span>
                  <span className={cn('shrink-0 transition-colors', activeAccent)}>
                    {isCompleted ? (
                      <Check className="h-[18px] w-[18px] text-primary" />
                    ) : (
                      <Icon className="h-[18px] w-[18px]" />
                    )}
                  </span>
                  <SidebarNavLabel label={item.label} isActive={isActive} />
                </button>
              )
            })}
          </nav>
          </motion.div>
        </AnimatePresence>
      </div>
      {isWorkshopProject ? (
        <div className="absolute inset-x-2 bottom-2 z-20">
          <SidebarFeedbackButton testId="workshop-sidebar-feedback" />
        </div>
      ) : null}
    </div>
  )
}
