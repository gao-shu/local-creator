// Copyright (c) local-creator contributors. All rights reserved.

import { useState, type MouseEvent } from 'react'
import { Clock, GitBranch, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { CanvasProjectMeta } from '@/types/canvas'
import { useCanvasImagePreview } from '@/hooks/use-canvas-media-preview'
import {
  CanvasProjectContextMenu,
  type CanvasProjectContextMenuAnchor,
} from '@/components/canvas/canvas-project-context-menu'

interface CanvasProjectCardProps {
  project: CanvasProjectMeta
  deleting?: boolean
  /** recycle：回收站卡片，展示恢复 / 彻底删除 */
  mode?: 'normal' | 'recycle'
  busy?: boolean
  onOpen: () => void
  onEdit?: (e?: MouseEvent) => void
  onDelete?: (e?: MouseEvent) => void
  onRestore?: (e?: MouseEvent) => void
  onPurge?: (e?: MouseEvent) => void
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

export function CanvasProjectCard({
  project,
  deleting,
  mode = 'normal',
  busy = false,
  onOpen,
  onEdit,
  onDelete,
  onRestore,
  onPurge,
}: CanvasProjectCardProps) {
  const [hovered, setHovered] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<CanvasProjectContextMenuAnchor | null>(null)
  const { src: coverSrc } = useCanvasImagePreview(project.coverImagePath, project.id)
  const isRecycle = mode === 'recycle'
  const disabled = Boolean(deleting || busy)

  const handleEdit = (e?: MouseEvent) => {
    e?.stopPropagation()
    onEdit?.(e)
  }

  const handleDelete = (e?: MouseEvent) => {
    e?.stopPropagation()
    onDelete?.(e)
  }

  const handleRestore = (e?: MouseEvent) => {
    e?.stopPropagation()
    onRestore?.(e)
  }

  const handlePurge = (e?: MouseEvent) => {
    e?.stopPropagation()
    onPurge?.(e)
  }

  return (
    <>
    <motion.div
      layout
      data-testid={`canvas-project-card-${project.id}`}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border/40',
        'bg-card/60 backdrop-blur-sm hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5',
        'transition-all duration-300',
        disabled ? 'opacity-50 pointer-events-none' : isRecycle ? '' : 'cursor-pointer',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={disabled || isRecycle ? undefined : onOpen}
      onContextMenu={
        isRecycle
          ? undefined
          : (event) => {
              event.preventDefault()
              event.stopPropagation()
              setMenuAnchor({ x: event.clientX, y: event.clientY })
            }
      }
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-cyan-500/10 via-background to-purple-500/10">
        {coverSrc ? (
          <img src={coverSrc} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <GitBranch className="mb-1.5 h-8 w-8 opacity-30" />
            <span className="text-xs opacity-60">节点画布</span>
          </div>
        )}
        {!isRecycle && project.recovered ? (
          <span className="absolute top-2 left-2 rounded-full border border-amber-500/20 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300">
            已恢复
          </span>
        ) : null}
      </div>

      <div className="px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="truncate pr-2 text-sm font-semibold">{project.title}</h3>
        </div>
        {project.description ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{project.description}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-between gap-2">
          {isRecycle ? (
            <button
              type="button"
              data-testid={`canvas-recycle-restore-${project.id}`}
              onClick={handleRestore}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold',
                'bg-primary text-primary-foreground hover:bg-primary/90 transition-colors',
              )}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              恢复
            </button>
          ) : (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(project.updatedAt)}
            </div>
          )}
          {isRecycle ? (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {formatTime(project.deletedAt ?? project.updatedAt)}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          'absolute top-2 right-2 flex gap-1 transition-opacity',
          hovered ? 'opacity-100' : 'opacity-0',
        )}
      >
        {isRecycle ? (
          <button
            type="button"
            data-testid={`canvas-recycle-purge-${project.id}`}
            onClick={handlePurge}
            title="彻底删除"
            className="p-1.5 rounded-lg bg-background/80 border border-border/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : (
          <>
            <button
              type="button"
              data-testid={`canvas-project-edit-${project.id}`}
              onClick={handleEdit}
              className="p-1.5 rounded-lg bg-background/80 border border-border/40 hover:bg-muted transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              data-testid={`canvas-project-delete-${project.id}`}
              onClick={handleDelete}
              title="移入回收站"
              className="p-1.5 rounded-lg bg-background/80 border border-border/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </>
        )}
      </div>
    </motion.div>

    {!isRecycle ? (
      <CanvasProjectContextMenu
        anchor={menuAnchor}
        title={project.title}
        deleting={deleting}
        onClose={() => setMenuAnchor(null)}
        onOpen={onOpen}
        onEdit={() => handleEdit()}
        onDelete={() => handleDelete()}
      />
    ) : null}
    </>
  )
}
