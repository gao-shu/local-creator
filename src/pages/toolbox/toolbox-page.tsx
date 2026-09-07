// Copyright (c) Haode AI. All rights reserved.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clapperboard, Crop, ScrollText, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/page-header'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { ImageCropTool } from '@/components/toolbox/image-crop-tool'
import { ScriptCreateTool } from '@/components/toolbox/script-create-tool'
import { ToolboxToolCard } from '@/components/toolbox/toolbox-tool-card'
import { ToolboxToolModal } from '@/components/toolbox/toolbox-tool-modal'
import { VideoMergeTool } from '@/components/toolbox/video-merge-tool'

type ToolboxToolId = 'video-merge' | 'image-crop' | 'script-create'

const TOOLBOX_TOOLS: Array<{
  id: ToolboxToolId
  title: string
  description: string
  modalDescription: string
  icon: typeof Clapperboard
  iconClassName: string
  badge?: string
  maxWidthClassName?: string
  maxHeightClassName?: string
}> = [
  {
    id: 'script-create',
    title: '剧本创作',
    description: '一句话生成可拍剧本，一键送进创作工坊',
    modalDescription: '快速出稿；满意后可新建工坊项目继续分集与分镜。',
    icon: ScrollText,
    iconClassName: 'text-fuchsia-400',
    badge: 'AI',
    maxWidthClassName: 'max-w-5xl',
    maxHeightClassName: 'max-h-[min(92vh,900px)]',
  },
  {
    id: 'video-merge',
    title: '视频合并（剪映）',
    description: '多段视频按顺序导出为剪映草稿，在剪映里继续剪辑',
    modalDescription: '将本地视频片段按顺序合并到剪映草稿时间轴，导出成片请在剪映中完成。',
    icon: Clapperboard,
    iconClassName: 'text-violet-400',
  },
  {
    id: 'image-crop',
    title: '图片裁剪',
    description: '按 16:9 / 9:16 等比例居中裁剪，保存到本地',
    modalDescription: '按常用画幅比例裁剪图片，适合分镜参考图、封面与发布物料。',
    icon: Crop,
    iconClassName: 'text-emerald-400',
  },
]

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

export function ToolboxPage() {
  const navigate = useNavigate()
  const [activeTool, setActiveTool] = useState<ToolboxToolId | null>(null)
  const [scriptGenerating, setScriptGenerating] = useState(false)
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false)
  const activeMeta = TOOLBOX_TOOLS.find((tool) => tool.id === activeTool)

  const requestClose = () => {
    if (activeTool === 'script-create' && scriptGenerating) {
      setCloseConfirmOpen(true)
      return
    }
    setActiveTool(null)
    setScriptGenerating(false)
  }

  const forceClose = () => {
    setCloseConfirmOpen(false)
    setActiveTool(null)
    setScriptGenerating(false)
  }

  return (
    <>
      <motion.div
        className="max-w-[960px]"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={itemVariants}>
          <PageHeader title="工具箱" description="点击卡片使用工具" />
        </motion.div>

        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <motion.div variants={itemVariants}>
            <ToolboxToolCard
              title="Skills 池"
              description="查看 Canvas Agent 内置 Skill：改图、改视频、审分镜"
              icon={Sparkles}
              iconClassName="text-amber-400"
              badge="Agent"
              onClick={() => navigate('/toolbox/skills')}
            />
          </motion.div>
          {TOOLBOX_TOOLS.map((tool) => (
            <motion.div key={tool.id} variants={itemVariants}>
              <ToolboxToolCard
                title={tool.title}
                description={tool.description}
                icon={tool.icon}
                iconClassName={tool.iconClassName}
                badge={tool.badge}
                onClick={() => setActiveTool(tool.id)}
              />
            </motion.div>
          ))}
        </div>

        <motion.div variants={itemVariants} className="mt-8" id="tool-wish">
</motion.div>
      </motion.div>

      {activeMeta ? (
        <ToolboxToolModal
          open={activeTool === activeMeta.id}
          title={activeMeta.title}
          description={activeMeta.modalDescription}
          icon={activeMeta.icon}
          iconClassName={activeMeta.iconClassName}
          badge={activeMeta.badge}
          maxWidthClassName={activeMeta.maxWidthClassName}
          maxHeightClassName={activeMeta.maxHeightClassName}
          onClose={requestClose}
        >
          {activeMeta.id === 'video-merge' ? <VideoMergeTool /> : null}
          {activeMeta.id === 'image-crop' ? <ImageCropTool /> : null}
          {activeMeta.id === 'script-create' ? (
            <ScriptCreateTool
              onGeneratingChange={setScriptGenerating}
              onRequestCloseReady={forceClose}
            />
          ) : null}
        </ToolboxToolModal>
      ) : null}

      <ConfirmDialog
        open={closeConfirmOpen}
        title="剧本还在生成"
        description="确定关闭并停止生成吗？"
        confirmLabel="关闭并停止"
        cancelLabel="继续等待"
        variant="destructive"
        overlayClassName="z-[130]"
        contentClassName="z-[131]"
        onClose={() => setCloseConfirmOpen(false)}
        onConfirm={forceClose}
      />
    </>
  )
}
