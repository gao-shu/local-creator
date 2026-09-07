// Copyright (c) Haode AI. All rights reserved.

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Select } from '@/components/ui/select'
import {
  DEFAULT_WORKFLOW_PAGE_SIZE,
  WORKFLOW_PAGE_SIZE_OPTIONS,
} from '@/stores/workflow-project-store'

interface ProjectListPaginationProps {
  total: number
  page: number
  pages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function ProjectListPagination({
  total,
  page,
  pages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: ProjectListPaginationProps) {
  if (total <= 0) return null

  const pageItems = Array.from({ length: pages }, (_, index) => index + 1)

  return (
    <div
      data-testid="workshop-project-pagination"
      className={cn(
        'mt-8 flex items-center justify-between gap-4 px-4 py-3 rounded-xl',
        'border border-border/30 bg-card/40 backdrop-blur-sm',
      )}
    >
      <span className="text-sm text-muted-foreground shrink-0 tabular-nums">
        共 {total} 个项目
      </span>

      <div className="flex items-center gap-1">
        <button
          type="button"
          data-testid="workshop-project-page-prev"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center text-sm',
            'border border-border/30 hover:bg-card/60 transition-colors',
            'disabled:opacity-40 disabled:pointer-events-none',
          )}
          aria-label="上一页"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {pageItems.map((item) => (
          <button
            key={item}
            type="button"
            data-testid={`workshop-project-page-${item}`}
            onClick={() => onPageChange(item)}
            className={cn(
              'h-8 min-w-8 px-2 rounded-lg text-sm tabular-nums transition-colors',
              item === page
                ? 'bg-foreground/10 text-foreground font-medium border border-border/40'
                : 'text-muted-foreground hover:bg-card/60 border border-transparent',
            )}
          >
            {item}
          </button>
        ))}

        <button
          type="button"
          data-testid="workshop-project-page-next"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            'h-8 w-8 rounded-lg flex items-center justify-center text-sm',
            'border border-border/30 hover:bg-card/60 transition-colors',
            'disabled:opacity-40 disabled:pointer-events-none',
          )}
          aria-label="下一页"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <Select
        data-testid="workshop-project-page-size"
        value={String(pageSize)}
        onChange={(value) => onPageSizeChange(Number(value) || DEFAULT_WORKFLOW_PAGE_SIZE)}
        options={WORKFLOW_PAGE_SIZE_OPTIONS.map((size) => ({
          value: String(size),
          label: `${size} / page`,
        }))}
        className="w-[108px] h-8 text-xs shrink-0"
      />
    </div>
  )
}
