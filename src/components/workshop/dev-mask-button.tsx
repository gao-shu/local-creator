import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface DevMaskButtonProps {
  label: string
  /** toast 提示用，默认与 label 相同 */
  stubLabel?: string
  variant?: 'primary' | 'outline'
  tone?: 'cyan' | 'neutral'
  icon?: LucideIcon
  className?: string
  onStub: (label: string) => void
}

/** 开发中占位：保留按钮底色，蒙版覆盖表示暂不可点 */
export function DevMaskButton({
  label,
  stubLabel,
  variant = 'primary',
  tone = 'cyan',
  icon: Icon,
  className,
  onStub,
}: DevMaskButtonProps) {
  const toastLabel = stubLabel ?? label

  return (
    <div className="relative w-full">
      <Button
        type="button"
        disabled
        variant={variant === 'outline' ? 'outline' : undefined}
        className={cn(
          'w-full gap-1.5 disabled:opacity-100 disabled:pointer-events-none',
          variant === 'primary'
            ? 'h-9 bg-cyan-600 text-white border-0'
            : tone === 'neutral'
              ? 'h-8 text-xs border-border/60 text-foreground/85 bg-transparent'
              : 'h-9 border-cyan-500/45 text-cyan-700 dark:text-cyan-300 bg-transparent',
          className,
        )}
      >
        {Icon ? <Icon className={variant === 'outline' && tone === 'neutral' ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> : null}
        {label}
      </Button>
      <button
        type="button"
        aria-label={`${toastLabel}（开发中）`}
        title="功能开发中"
        className="absolute inset-0 z-10 rounded-xl bg-background/55 cursor-not-allowed"
        onClick={() => onStub(toastLabel)}
      />
    </div>
  )
}
