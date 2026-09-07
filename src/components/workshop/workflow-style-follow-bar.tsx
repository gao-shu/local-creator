// Copyright (c) local-creator contributors. All rights reserved.

import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface WorkflowStyleFollowBarProps {
  label: string
  following: boolean
  projectStyleLabel: string
  styleKey: string
  styleOptions: Array<{ value: string; label: string }>
  onFollowChange: (following: boolean) => void
  onStyleChange: (styleKey: string) => void
  className?: string
}

/** Step3/4 生图风格：跟随项目 or 单独覆盖 */
export function WorkflowStyleFollowBar({
  label,
  following,
  projectStyleLabel,
  styleKey,
  styleOptions,
  onFollowChange,
  onStyleChange,
  className,
}: WorkflowStyleFollowBarProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label className="flex items-start gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-primary"
          checked={following}
          data-testid="workflow-style-follow-project"
          onChange={(event) => onFollowChange(event.target.checked)}
        />
        <span className="text-[11px] leading-relaxed text-muted-foreground">
          跟随项目风格
          <span className="ml-1 text-foreground/90">({projectStyleLabel})</span>
        </span>
      </label>

      {!following ? (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">{label}</Label>
          <Select
            value={styleKey}
            onChange={onStyleChange}
            options={styleOptions}
            data-testid="workflow-style-override-select"
          />
        </div>
      ) : null}
    </div>
  )
}
