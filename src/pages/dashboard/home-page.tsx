import { ArrowRight, FolderKanban, GitBranch, Images, Settings, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { DashboardRecentSections } from '@/components/dashboard/dashboard-recent-sections'
import { useCanvasQuickCreate } from '@/components/canvas/canvas-quick-create'
import { useWorkshopQuickCreate } from '@/components/workshop/workshop-quick-create'
import { GlassCard } from '@/components/ui/glass-card'
import { GradientButton } from '@/components/ui/gradient-button'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'

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

const quickLinks = [
  {
    key: 'workshop',
    title: '创作工坊',
    description: '从剧本到分镜的完整生产流程',
    href: '/workshop',
    icon: FolderKanban,
    color: 'text-purple-400',
    gradient: 'from-purple-500/10 via-transparent to-transparent',
  },
  {
    key: 'canvas',
    title: '无限画布',
    description: '节点编排 Prompt、生图与生视频',
    href: '/canvas',
    icon: GitBranch,
    color: 'text-cyan-400',
    gradient: 'from-cyan-500/10 via-transparent to-transparent',
  },
  {
    key: 'materials',
    title: '素材库',
    description: '管理本地角色与场景参考图',
    href: '/materials',
    icon: Images,
    color: 'text-orange-400',
    gradient: 'from-orange-500/10 via-transparent to-transparent',
  },
  {
    key: 'settings',
    title: '系统设置',
    description: '配置路径、模型与提示词模板',
    href: '/settings',
    icon: Settings,
    color: 'text-green-400',
    gradient: 'from-green-500/10 via-transparent to-transparent',
  },
] as const

export function HomePage() {
  const navigate = useNavigate()
  const { openCreate: openWorkshopCreate, dialog: workshopCreateDialog } =
    useWorkshopQuickCreate()
  const { openCreate: openCanvasCreate, dialog: canvasCreateDialog } = useCanvasQuickCreate()
  const handleCreateWorkshop = () => void openWorkshopCreate()
  const handleCreateCanvas = () => void openCanvasCreate()

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible">
      <motion.div variants={itemVariants}>
        <PageHeader
          title="欢迎回来"
          description="AI 驱动的漫剧/短剧创作工作台"
          action={
            <GradientButton onClick={handleCreateWorkshop}>
              <Sparkles className="h-4 w-4" />
              开始创作
            </GradientButton>
          }
        />
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {quickLinks.map((link) => {
          const Icon = link.icon
          return (
            <GlassCard
              key={link.key}
              data-testid={
                link.key === 'workshop'
                  ? 'workshop-open-list'
                  : link.key === 'canvas'
                    ? 'canvas-open-list'
                    : undefined
              }
              onClick={() => navigate(link.href)}
              className={cn(
                'group relative p-5 cursor-pointer overflow-hidden',
                'hover:border-border/50 transition-all duration-300',
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 bg-linear-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                  link.gradient,
                )}
              />
              <div className="relative z-10">
                <Icon className={cn('h-8 w-8 mb-4', link.color)} />
                <h3 className="font-semibold text-lg">{link.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{link.description}</p>
                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-4 group-hover:text-foreground transition-colors">
                  进入
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </GlassCard>
          )
        })}
      </motion.div>

      <motion.div variants={itemVariants}>
        <DashboardRecentSections
          onCreateWorkshop={handleCreateWorkshop}
          onCreateCanvas={handleCreateCanvas}
        />
      </motion.div>
      {workshopCreateDialog}
      {canvasCreateDialog}
    </motion.div>
  )
}
