import { cn } from '@/lib/utils'

type EntityKind = 'character' | 'scene' | 'prop'

const kindStyles: Record<EntityKind, string> = {
  character: 'bg-blue-500/15 text-blue-300 border-blue-500/20',
  scene: 'bg-green-500/15 text-green-300 border-green-500/20',
  prop: 'bg-orange-500/15 text-orange-300 border-orange-500/20',
}

interface EntityTagProps {
  kind: EntityKind
  label: string
  className?: string
}

export function EntityTag({ kind, label, className }: EntityTagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border',
        kindStyles[kind],
        className,
      )}
    >
      {label}
    </span>
  )
}
