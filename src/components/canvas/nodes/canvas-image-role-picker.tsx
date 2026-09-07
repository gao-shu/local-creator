// Copyright (c) local-creator contributors. All rights reserved.

import type { CanvasImageAssetRole } from '@/types/canvas-nodes'
import {
  CANVAS_IMAGE_ROLE_BG,
  CANVAS_IMAGE_ROLE_COLORS,
  CANVAS_IMAGE_ROLE_LABELS,
  CANVAS_IMAGE_ROLE_OPTIONS,
} from '@/lib/canvas/canvas-image-role'
import { cn } from '@/lib/utils'

interface CanvasImageRolePickerProps {
  value?: CanvasImageAssetRole
  onChange: (role: CanvasImageAssetRole) => void
  className?: string
  compact?: boolean
}

/** 图片节点类型：角色 / 场景 / 道具 */
export function CanvasImageRolePicker({
  value = 'character',
  onChange,
  className,
  compact = false,
}: CanvasImageRolePickerProps) {
  return (
    <div
      className={cn('nodrag nopan inline-flex items-center gap-1 rounded-xl bg-muted/40 p-0.5 dark:bg-black/25', className)}
      role="radiogroup"
      aria-label="图片类型"
    >
      {CANVAS_IMAGE_ROLE_OPTIONS.map((role) => {
        const active = value === role
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(role)}
            className={cn(
              'rounded-lg border font-medium transition-colors',
              compact ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]',
              active
                ? cn(CANVAS_IMAGE_ROLE_BG[role], CANVAS_IMAGE_ROLE_COLORS[role])
                : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground dark:text-white/45 dark:hover:bg-white/[0.05] dark:hover:text-white/70',
            )}
          >
            {CANVAS_IMAGE_ROLE_LABELS[role]}
          </button>
        )
      })}
    </div>
  )
}
