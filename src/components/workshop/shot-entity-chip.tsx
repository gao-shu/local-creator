import { useEffect, useRef, useState } from 'react'
import { MapPin, Package, User } from 'lucide-react'
import { useHoverImagePreview, HoverImagePreviewPortal } from '@/components/workshop/hover-image-preview'
import { getApprovedCharacterImageReviewSnapshot } from '@/lib/workflow/asset-review-status'
import { resolveImagePreviewSrc } from '@/lib/storage/fs-service'
import { mentionKindLabel, type MentionCandidate } from '@/lib/workflow/mention-utils'
import type { WorkflowAsset } from '@/types/workflow'
import { cn } from '@/lib/utils'

function resolveMentionPreviewPath(item: MentionCandidate): string | undefined {
  const paths = item.previewPaths?.length
    ? item.previewPaths
    : item.thumbnailPath
      ? [item.thumbnailPath]
      : []
  return paths.map((path) => path?.trim()).find(Boolean)
}

async function resolveMentionPreviewUrl(
  item: MentionCandidate,
  projectRoot?: string,
): Promise<string | null> {
  const paths = item.previewPaths?.length
    ? item.previewPaths
    : item.thumbnailPath
      ? [item.thumbnailPath]
      : []
  for (const path of paths) {
    const trimmed = path?.trim()
    if (!trimmed) continue
    const url = await resolveImagePreviewSrc(trimmed, projectRoot)
    if (url) return url
  }
  return null
}

function kindIcon(kind: MentionCandidate['kind']) {
  if (kind === 'character') return User
  if (kind === 'scene') return MapPin
  return Package
}

function EntityThumb({
  item,
  size,
  className,
  projectRoot,
}: {
  item: MentionCandidate
  size: 'sm' | 'md' | 'lg'
  className?: string
  projectRoot?: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const previewPath = resolveMentionPreviewPath(item)
  const sizeClass =
    size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-9 w-9' : 'h-7 w-7'
  const Icon = kindIcon(item.kind)

  useEffect(() => {
    if (!previewPath) {
      setUrl(null)
      return
    }
    let active = true
    void resolveImagePreviewSrc(previewPath, projectRoot).then((u) => {
      if (active) setUrl(u)
    })
    return () => {
      active = false
    }
  }, [previewPath, projectRoot])

  return (
    <span
      className={cn(
        'shrink-0 rounded-full border border-border/50 bg-muted overflow-hidden flex items-center justify-center',
        sizeClass,
        className,
      )}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <Icon className={cn('text-muted-foreground/70', size === 'lg' ? 'h-5 w-5' : 'h-3.5 w-3.5')} />
      )}
    </span>
  )
}

interface ShotEntityChipProps {
  item: MentionCandidate
  size?: 'sm' | 'md' | 'lg'
  showKind?: boolean
  enableHoverPreview?: boolean
  projectRoot?: string
  characters?: WorkflowAsset[]
  className?: string
}

export function ShotEntityChip({
  item,
  size = 'md',
  showKind = false,
  enableHoverPreview = true,
  projectRoot,
  characters,
  className,
}: ShotEntityChipProps) {
  const chipRef = useRef<HTMLSpanElement>(null)
  const { preview, show: showHoverPreview, hide: hideHoverPreview } = useHoverImagePreview(200)

  const showPreview = () => {
    const previewPath = resolveMentionPreviewPath(item)
    if (!enableHoverPreview || !previewPath) return
    const el = chipRef.current
    if (!el) return
    void resolveMentionPreviewUrl(item, projectRoot).then((url) => {
      if (!url || !chipRef.current) return
      const snapshot =
        item.kind === 'character'
          ? getApprovedCharacterImageReviewSnapshot(previewPath, characters ?? [])
          : null
      showHoverPreview(
        url,
        chipRef.current.getBoundingClientRect(),
        snapshot
          ? { reviewTitle: snapshot.title, reviewLabel: snapshot.badgeLabel }
          : undefined,
      )
    })
  }

  const hidePreview = () => {
    hideHoverPreview()
  }

  return (
    <>
      <span
        ref={chipRef}
        title={`${mentionKindLabel(item.kind)} · @${item.mentionName}`}
        onMouseEnter={showPreview}
        onMouseLeave={hidePreview}
        className={cn(
          'inline-flex items-center gap-2 max-w-[160px] rounded-full border border-border/50 bg-muted/25 px-1.5 py-1',
          size === 'lg' && 'px-2 py-1.5 max-w-[180px]',
          className,
        )}
      >
        <EntityThumb item={item} size={size} projectRoot={projectRoot} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 min-w-0">
            <span className="text-[11px] font-medium truncate">{item.mentionName}</span>
          </span>
          {showKind ? (
            <span className="block text-[9px] text-muted-foreground truncate">
              {mentionKindLabel(item.kind)}
            </span>
          ) : null}
        </span>
      </span>

      <HoverImagePreviewPortal preview={preview} />
    </>
  )
}

interface ShotEntityStripProps {
  items: MentionCandidate[]
  label?: string
  emptyHint?: string
  size?: 'sm' | 'md' | 'lg'
  showKind?: boolean
  projectRoot?: string
  characters?: WorkflowAsset[]
  className?: string
}

export function ShotEntityStrip({
  items,
  label,
  emptyHint,
  size = 'md',
  showKind = false,
  projectRoot,
  characters,
  className,
}: ShotEntityStripProps) {
  if (items.length === 0) {
    if (!emptyHint) return null
    return (
      <div className={cn('space-y-1.5', className)}>
        {label ? <p className="text-[10px] text-muted-foreground">{label}</p> : null}
        <p className="text-[10px] text-muted-foreground/70">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? <p className="text-[10px] text-muted-foreground">{label}</p> : null}
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <ShotEntityChip
            key={item.id}
            item={item}
            size={size}
            showKind={showKind}
            projectRoot={projectRoot}
            characters={characters}
          />
        ))}
      </div>
    </div>
  )
}
