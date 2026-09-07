import { ShieldCheck } from 'lucide-react'

import { ReviewShieldBadge } from '@/components/workshop/review-shield-badge'
import { getGeneratedImagePaths } from '@/lib/workflow/asset-utils'
import type { AssetReviewVisualState } from '@/lib/workflow/asset-review-status'
import { isStoryboardImageValidated } from '@/lib/workflow/shot-video-utils'
import type { WorkflowShot } from '@/types/workflow'

function hasShotGeneratedImage(shot: WorkflowShot): boolean {
  return getGeneratedImagePaths(shot).length > 0
}

export function shotStoryboardImageReviewBadgeMeta(shot: WorkflowShot): {
  kind: 'empty' | 'shield'
  label: string
  state?: AssetReviewVisualState
} {
  if (shot.status === 'generating') {
    return { kind: 'shield', label: '分镜图生成中', state: 'processing' }
  }
  if (shot.status === 'failed') {
    return { kind: 'shield', label: '生成失败', state: 'failed' }
  }
  if (shot.status === 'done' || hasShotGeneratedImage(shot)) {
    if (isStoryboardImageValidated(shot)) {
      return { kind: 'shield', label: '分镜图审核通过', state: 'approved' }
    }
    return { kind: 'shield', label: '分镜图待审核', state: 'processing' }
  }
  return { kind: 'empty', label: '未审核' }
}

export function StoryboardImageReviewBadge({ shot }: { shot: WorkflowShot }) {
  const meta = shotStoryboardImageReviewBadgeMeta(shot)
  if (meta.kind === 'empty') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full border border-border/50 text-[10px] text-muted-foreground px-1.5 py-0.5 leading-none">
        <ShieldCheck className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
        <span className="whitespace-nowrap">{meta.label}</span>
      </span>
    )
  }
  return (
    <ReviewShieldBadge
      state={meta.state!}
      variant="inline"
      size="compact"
      label={meta.label}
    />
  )
}
