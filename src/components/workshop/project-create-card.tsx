// Copyright (c) Haode AI. All rights reserved.

import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProjectCreateCardProps {
  label: string
  testId: string
  onClick: () => void
  disabled?: boolean
}

/** 列表网格首卡：新建入口（外形与项目卡同高，内容居中铺满整卡） */
export function ProjectCreateCard({
  label,
  testId,
  onClick,
  disabled = false,
}: ProjectCreateCardProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group relative flex w-full flex-col overflow-hidden rounded-xl',
        'border border-dashed border-border/50 bg-card/30 backdrop-blur-sm',
        'transition-all duration-300',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:border-primary/40 hover:bg-card/50',
      )}
    >
      {/* 与项目卡同结构占位：封面区 + 信息区，保证网格行高一致 */}
      <div className="aspect-[16/10] w-full bg-muted/10" aria-hidden />
      <div className="px-3 py-2.5" aria-hidden>
        <div className="h-5" />
        <div className="mt-2 h-[11px]" />
      </div>

      {/* 内容铺满整卡并居中 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full',
            'border border-border/40 bg-muted/30',
            'transition-colors group-hover:border-primary/40 group-hover:bg-primary/10',
          )}
        >
          <Plus className="h-7 w-7 text-muted-foreground transition-colors group-hover:text-primary" />
        </div>
        <span className="text-sm font-medium text-muted-foreground transition-colors group-hover:text-foreground">
          {label}
        </span>
      </div>
    </button>
  )
}
