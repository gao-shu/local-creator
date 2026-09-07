// Copyright (c) Haode AI. All rights reserved.

/**
 * 工坊 Step2/3/4 AI 主操作按钮与强调色 token。
 *
 * 使用约定：
 * - AI 首次生成 / 推理 / 批量 AI → WorkshopAiButton（默认 Sparkles）
 * - 重新生成（批量或单个重做）→ outline + RefreshCw，不用本组件
 * - 视频生成 → WorkshopAiButton + icon={Play}
 * - 保存 / 上传 / 下载 → outline 或 ghost，保持原图标
 */

import type { LucideIcon } from 'lucide-react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 工坊 AI 强调色（按钮以外的选中态、Tab、badge、空态等复用） */
export const WORKSHOP_AI_TOKENS = {
  solid: 'bg-cyan-600 hover:bg-cyan-500',
  text: 'text-cyan-600 dark:text-cyan-400',
  textAccent: 'text-cyan-400',
  underline: 'bg-cyan-500',
  border: 'border-cyan-500/40',
  borderStrong: 'border-cyan-500/60',
  ring: 'ring-cyan-500/50',
  bgSoft: 'bg-cyan-500/10',
  bgSoftHover: 'hover:bg-cyan-500/10',
  spinner: 'text-cyan-500',
  emptyIcon: 'text-cyan-600 dark:text-cyan-400/80',
} as const

/** 工坊 AI 主操作按钮统一样式（cyan 实心 + 轻阴影） */
export const WORKSHOP_AI_BUTTON_CLASS = cn(
  WORKSHOP_AI_TOKENS.solid,
  'text-white border-0 gap-1.5 shadow-sm shadow-cyan-600/15',
)

export type WorkshopAiButtonSizePreset = 'header' | 'toolbar' | 'compact' | 'default'

const SIZE_PRESET_CLASS: Record<WorkshopAiButtonSizePreset, string> = {
  header: 'h-10 rounded-xl px-5',
  toolbar: 'h-8 text-xs px-3',
  compact: 'h-7 text-[11px] px-2.5',
  default: '',
}

const SIZE_PRESET_ICON_CLASS: Record<WorkshopAiButtonSizePreset, string> = {
  header: 'h-4 w-4',
  toolbar: 'h-3.5 w-3.5',
  compact: 'h-3 w-3',
  default: 'h-4 w-4',
}

interface WorkshopAiButtonProps extends ButtonProps {
  loading?: boolean
  /** 默认 Sparkles；视频类传 Play */
  icon?: LucideIcon
  hideIcon?: boolean
  iconClassName?: string
  sizePreset?: WorkshopAiButtonSizePreset
}

export function WorkshopAiButton({
  loading = false,
  disabled,
  className,
  children,
  icon: Icon = Sparkles,
  hideIcon = false,
  iconClassName,
  sizePreset = 'default',
  size,
  ...props
}: WorkshopAiButtonProps) {
  const resolvedIconClass = cn(SIZE_PRESET_ICON_CLASS[sizePreset], iconClassName)
  const resolvedSize = size ?? (sizePreset === 'default' ? 'sm' : undefined)

  return (
    <Button
      disabled={disabled || loading}
      size={resolvedSize}
      className={cn(WORKSHOP_AI_BUTTON_CLASS, SIZE_PRESET_CLASS[sizePreset], className)}
      {...props}
    >
      {!hideIcon ? (
        loading ? (
          <Loader2 className={cn(resolvedIconClass, 'animate-spin')} />
        ) : (
          <Icon className={resolvedIconClass} />
        )
      ) : null}
      {children}
    </Button>
  )
}
