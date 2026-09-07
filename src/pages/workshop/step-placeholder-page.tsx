import { useParams } from 'react-router-dom'
import { GlassCard } from '@/components/ui/glass-card'

const stepLabels: Record<string, string> = {
  '2': '分集规划',
  '3': '资产',
  '4': '分镜生成',
}

export function StepPlaceholderPage() {
  const { stepNumber } = useParams()
  const label = stepLabels[stepNumber ?? ''] ?? `Step ${stepNumber}`

  return (
    <div className="flex flex-col h-full min-h-0">
      <GlassCard className="p-8 text-center flex-1 flex items-center justify-center">
        <p className="text-muted-foreground text-sm">
          {label} 将在后续 Phase 实现
        </p>
      </GlassCard>
    </div>
  )
}
