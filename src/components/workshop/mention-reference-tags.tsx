import {
  resolveMentionCandidatesByIds,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'
import { ShotEntityStrip } from '@/components/workshop/shot-entity-chip'
import type { WorkflowAsset } from '@/types/workflow'
import { cn } from '@/lib/utils'

interface MentionReferenceTagsProps {
  /** 分镜已绑定的 @ 引用资产 ID */
  assetIds: string[]
  candidates: MentionCandidate[]
  projectRoot?: string
  characters?: WorkflowAsset[]
  className?: string
}

/** 资产：与提示词 @ 同步绑定的角色/场景/物品 */
export function MentionReferenceTags({
  assetIds,
  candidates,
  projectRoot,
  characters,
  className,
}: MentionReferenceTagsProps) {
  const items = resolveMentionCandidatesByIds(assetIds, candidates)

  return (
    <ShotEntityStrip
      items={items}
      label="资产"
      emptyHint="在分镜提示词中输入 @ 引用角色/场景/物品"
      size="md"
      projectRoot={projectRoot}
      characters={characters}
      className={cn('rounded-lg border border-border/40 bg-muted/15 px-2.5 py-2 min-h-[52px]', className)}
    />
  )
}
