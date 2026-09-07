// Copyright (c) local-creator. All rights reserved.

import { MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const feedbackButtonClass = cn(
  'flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs sm:text-sm min-w-0',
  'text-muted-foreground hover:text-foreground hover:bg-foreground/6',
  'border border-border/30 transition-colors',
)

const compactFeedbackButtonClass = cn(
  'flex w-full flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5',
  'border border-border/45 bg-card/80 text-muted-foreground shadow-sm backdrop-blur-md',
  'hover:border-border/60 hover:bg-card hover:text-foreground transition-colors',
)

function onFeedbackClick() {
  toast.message('反馈入口已移除', {
    description: '开源版暂不连接公司反馈服务，可后续改为 Issue 链接。',
  })
}

export function SidebarFeedbackButton({
  className,
  variant = 'default',
  testId = 'sidebar-feedback',
}: {
  className?: string
  variant?: 'default' | 'compact'
  testId?: string
}) {
  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onFeedbackClick}
        className={cn(compactFeedbackButtonClass, className)}
        title="建议与反馈"
        data-testid={testId}
      >
        <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
        <span className="text-[9px] leading-[1.2] text-center font-medium">
          <span className="block">建议</span>
          <span className="block">与反馈</span>
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onFeedbackClick}
      className={cn(feedbackButtonClass, className)}
      title="建议与反馈"
      data-testid={testId}
    >
      <MessageSquarePlus className="h-4 w-4 shrink-0" />
      <span className="truncate">建议与反馈</span>
    </button>
  )
}
