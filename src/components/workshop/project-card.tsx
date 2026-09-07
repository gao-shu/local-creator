// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'
import { Clock, FolderKanban, ImageIcon, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { WorkflowProjectMeta } from '@/types/workflow'
import { normalizeWorkflowStep } from '@/lib/workflow/step-utils'

interface ProjectCardProps {
  project: WorkflowProjectMeta
  previewUrls?: string[]
  deleting?: boolean
  /** recycle：回收站卡片，展示恢复 / 彻底删除 */
  mode?: 'normal' | 'recycle'
  busy?: boolean
  onOpen: () => void
  onEdit?: (e: React.MouseEvent) => void
  onDelete?: (e: React.MouseEvent) => void
  onRestore?: (e: React.MouseEvent) => void
  onPurge?: (e: React.MouseEvent) => void
}

function formatTime(timestamp: number) {
  const d = new Date(timestamp)
  const now = Date.now()
  const diff = now - timestamp
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return d.toLocaleDateString('zh-CN')
}

function PreviewImage({ src, className }: { src: string; className?: string }) {
  const [error, setError] = useState(false)

  useEffect(() => {
    setError(false)
  }, [src])

  if (error) return null

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setError(true)}
    />
  )
}

function ProjectPreview({
  urls,
  currentStep,
}: {
  urls: string[]
  currentStep: number
}) {
  const validUrls = urls.filter(Boolean)

  if (validUrls.length === 0) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/20 text-muted-foreground">
        <ImageIcon className="h-8 w-8 opacity-25 mb-2" />
        <span className="text-xs opacity-60">步骤 {currentStep}/4</span>
      </div>
    )
  }

  if (validUrls.length === 1) {
    return (
      <PreviewImage
        src={validUrls[0]}
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
    )
  }

  const gridClass =
    validUrls.length === 2
      ? 'grid-cols-2 grid-rows-1'
      : validUrls.length === 3
        ? 'grid-cols-2 grid-rows-2'
        : 'grid-cols-2 grid-rows-2'

  return (
    <div className={cn('absolute inset-0 grid gap-px bg-border/20', gridClass)}>
      {validUrls.slice(0, 4).map((url, index) => (
        <div
          key={`${url}-${index}`}
          className={cn(
            'relative overflow-hidden bg-muted/10',
            validUrls.length === 3 && index === 0 && 'row-span-2',
          )}
        >
          <PreviewImage src={url} className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  )
}

export function ProjectCard({
  project,
  previewUrls = [],
  deleting = false,
  mode = 'normal',
  busy = false,
  onOpen,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
}: ProjectCardProps) {
  const step = normalizeWorkflowStep(project.currentStep)
  const isRecycle = mode === 'recycle'
  const disabled = deleting || busy

  return (
    <motion.div
      data-testid={`workshop-project-card-${project.id}`}
      whileHover={isRecycle ? undefined : { y: -4, transition: { duration: 0.2 } }}
      onClick={disabled || isRecycle ? undefined : onOpen}
      className={cn(
        'group relative rounded-xl border border-border/30 overflow-hidden',
        'bg-card/50 backdrop-blur-sm',
        'hover:border-border/50 transition-all duration-300',
        disabled ? 'opacity-60 pointer-events-none' : isRecycle ? '' : 'cursor-pointer',
      )}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted/10">
        <ProjectPreview urls={previewUrls} currentStep={step} />
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {isRecycle ? (
            <button
              type="button"
              data-testid={`workshop-recycle-purge-${project.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onPurge?.(e)
              }}
              className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-destructive/80"
              title="彻底删除"
            >
              <Trash2 className="h-3.5 w-3.5 text-white" />
            </button>
          ) : (
            <>
              <button
                type="button"
                data-testid={`workshop-project-edit-${project.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit?.(e)
                }}
                className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-primary/80"
                title="编辑项目"
              >
                <Pencil className="h-3.5 w-3.5 text-white" />
              </button>
              <button
                type="button"
                data-testid={`workshop-project-delete-${project.id}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete?.(e)
                }}
                disabled={deleting}
                className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-destructive/80"
                title="移入回收站"
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 text-white" />
                )}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="px-3 py-2.5">
        <div className="mb-1.5 flex min-w-0 items-center gap-2">
          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-primary/70" />
          <h3 className="truncate text-sm font-semibold">{project.title}</h3>
        </div>
        {project.description ? (
          <p className="mb-1.5 line-clamp-1 text-xs leading-relaxed text-muted-foreground">
            {project.description}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          {isRecycle ? (
            <button
              type="button"
              data-testid={`workshop-recycle-restore-${project.id}`}
              onClick={(e) => {
                e.stopPropagation()
                onRestore?.(e)
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold',
                'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              恢复
            </button>
          ) : (
            <span
              className={cn(
                'text-xs px-2.5 py-1 rounded-lg border',
                'text-blue-400 bg-blue-500/10 border-blue-500/20',
              )}
            >
              Step {step}/4
            </span>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatTime(isRecycle && project.deletedAt ? project.deletedAt : project.updatedAt)}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
