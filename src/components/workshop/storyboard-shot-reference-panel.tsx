import type { ReactNode } from 'react'
import { Mic, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HoverImagePreviewPortal } from '@/components/workshop/hover-image-preview'
import { ShotEntityChip } from '@/components/workshop/shot-entity-chip'
import { getApprovedCharacterImageReviewSnapshot } from '@/lib/workflow/asset-review-status'
import { getSelectedReferenceImageIndex } from '@/lib/workflow/asset-utils'
import { MAX_REFERENCE_AUDIOS } from '@/lib/workflow/shot-audio-reference-utils'
import { isScreenshotReferencePath } from '@/lib/workflow/shot-reference-utils'
import type { useStoryboardShotEditor } from '@/hooks/use-storyboard-shot-editor'
import { resolveMentionCandidatesByIds, type MentionCandidate } from '@/lib/workflow/mention-utils'
import { getGeneratedVideoPaths } from '@/lib/workflow/shot-video-utils'
import type { WorkflowAsset, WorkflowShot } from '@/types/workflow'
import { cn } from '@/lib/utils'

type StoryboardShotEditorState = ReturnType<typeof useStoryboardShotEditor>

interface StoryboardShotReferencePanelProps {
  shot: WorkflowShot
  variant?: 'compact' | 'expanded'
  /** 卡片与编辑窗均展示「上传视频」入口 */
  includeVideoSection?: boolean
  characters: WorkflowAsset[]
  mentionCandidates: MentionCandidate[]
  projectRoot?: string
  editor: StoryboardShotEditorState
  onUploadReference?: () => void
  onPickReferenceFromLibrary?: () => void
  onUploadReferenceAudio?: () => void
  referenceLibraryTestId?: string
}

interface ReferencePanelRowProps {
  label: string
  count: string
  countTitle?: string
  expanded: boolean
  children: ReactNode
}

function ReferencePanelRow({
  label,
  count,
  countTitle,
  expanded,
  children,
}: ReferencePanelRowProps) {
  const countMuted = count === '0' || count.startsWith('0/')

  return (
    <div
      className={cn(
        'flex items-start gap-1.5 border-t border-border/40 first:border-t-0',
        expanded ? 'py-2 first:pt-0' : 'py-1 first:pt-0',
      )}
    >
      <div
        className={cn(
          'shrink-0 leading-none',
          expanded ? 'w-[4.5rem] pt-0.5' : 'w-[3.25rem] pt-px',
        )}
      >
        <span
          className={cn(
            'font-medium text-muted-foreground',
            expanded ? 'text-xs' : 'text-[10px]',
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            'ml-1 tabular-nums',
            expanded ? 'text-[11px]' : 'text-[10px]',
            countMuted ? 'text-muted-foreground/45' : 'text-muted-foreground/75',
          )}
          title={countTitle}
        >
          {count}
        </span>
      </div>
      <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1">{children}</div>
    </div>
  )
}

export function StoryboardShotReferencePanel({
  shot,
  variant = 'compact',
  includeVideoSection = true,
  characters,
  mentionCandidates,
  projectRoot,
  editor,
  onUploadReference,
  onPickReferenceFromLibrary,
  onUploadReferenceAudio,
  referenceLibraryTestId,
}: StoryboardShotReferencePanelProps) {
  const expanded = variant === 'expanded'
  const thumbClass = expanded ? 'h-16 w-16' : 'h-10 w-10'
  const btnClass = expanded ? 'h-8 text-[11px] px-2.5' : 'h-6 text-[10px] px-1.5'
  const voiceTagClass = expanded ? 'text-[11px] px-1.5 py-0.5' : 'text-[10px] px-1 py-0'
  const assetChipSize = expanded ? 'md' : 'sm'
  const assetChipMaxW = expanded ? 'max-w-[150px]' : 'max-w-[118px]'

  const {
    refPaths,
    refPreviewUrls,
    boundVoiceDisplayItems,
    uploadedVoiceItems,
    activeVoiceAudioItems,
    voiceUsedCount,
    voiceTotalCount,
    refHoverPreview,
    showRefPreview,
    hideRefPreview,
    isCharacterVoiceInUse,
    handleRemoveReferenceAt,
    handleSelectReference,
    handleRemoveAudioAt,
  } = editor

  const assetItems = resolveMentionCandidatesByIds(shot.referencedAssetIds ?? [], mentionCandidates)
  const videoCount = getGeneratedVideoPaths(shot).length
  const voiceCountLabel =
    voiceTotalCount > 0 ? `${voiceUsedCount}/${voiceTotalCount}` : String(voiceUsedCount)
  const voiceCountTitle =
    voiceTotalCount > 0
      ? `生视频将使用 ${voiceUsedCount} 个音色（共 ${voiceTotalCount} 个可用）`
      : '暂无可用音色'

  return (
    <>
      <div
        className={cn(
          'rounded-lg border border-border/40 bg-muted/20',
          expanded ? 'p-3' : 'px-1.5 py-1',
        )}
      >
        <ReferencePanelRow
          label="资产"
          count={String(assetItems.length)}
          countTitle={`已引用 ${assetItems.length} 个资产`}
          expanded={expanded}
        >
          {assetItems.length > 0 ? (
            assetItems.map((item) => (
              <ShotEntityChip
                key={item.id}
                item={item}
                size={assetChipSize}
                projectRoot={projectRoot}
                characters={characters}
                className={cn('gap-1 px-1 py-0.5', assetChipMaxW)}
              />
            ))
          ) : (
            <span className="text-[10px] text-muted-foreground/65 leading-snug">
              撰写提示词后将自动识别并 @ 引用角色/场景/物品
            </span>
          )}
        </ReferencePanelRow>

        <ReferencePanelRow
          label="参考图"
          count={String(refPaths.length)}
          countTitle={`已添加 ${refPaths.length} 张参考图`}
          expanded={expanded}
        >
          {refPaths.map((path, index) => {
            const url = refPreviewUrls[index]
            const selected = getSelectedReferenceImageIndex(shot, refPaths.length) === index
            return (
              <div
                key={`${path}-${index}`}
                className={cn(
                  'relative rounded-md border overflow-hidden bg-muted/40 shrink-0',
                  thumbClass,
                  selected ? 'border-cyan-500 ring-1 ring-cyan-500/40' : 'border-border/50',
                )}
              >
                <button
                  type="button"
                  title={isScreenshotReferencePath(path) ? '视频截图' : '参考图'}
                  onClick={() => handleSelectReference(index)}
                  onMouseEnter={(e) => {
                    if (!url) return
                    const snapshot = getApprovedCharacterImageReviewSnapshot(path, characters)
                    showRefPreview(
                      url,
                      e.currentTarget.getBoundingClientRect(),
                      snapshot
                        ? { reviewTitle: snapshot.title, reviewLabel: snapshot.badgeLabel }
                        : undefined,
                    )
                  }}
                  onMouseLeave={hideRefPreview}
                  className="absolute inset-0"
                >
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full animate-pulse bg-muted" />
                  )}
                </button>
                <button
                  type="button"
                  title="移除"
                  onClick={() => handleRemoveReferenceAt(index)}
                  className="absolute top-0.5 right-0.5 z-10 rounded bg-black/60 p-0.5 text-white hover:bg-black/80"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            )
          })}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={btnClass}
            onClick={onUploadReference}
          >
            上传参考图
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={btnClass}
            disabled={!onPickReferenceFromLibrary}
            title={onPickReferenceFromLibrary ? '从素材库选择参考图' : undefined}
            data-testid={referenceLibraryTestId}
            onClick={onPickReferenceFromLibrary}
          >
            素材库
          </Button>
        </ReferencePanelRow>

        <ReferencePanelRow
          label="音色"
          count={voiceCountLabel}
          countTitle={voiceCountTitle}
          expanded={expanded}
        >
          {boundVoiceDisplayItems.map((item) => {
            const inUse = isCharacterVoiceInUse(item.characterId, item.mentionName)
            return (
              <span
                key={`voice-bound-${item.characterId}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border text-foreground/90',
                  voiceTagClass,
                  inUse
                    ? 'border-cyan-500/30 bg-cyan-500/10'
                    : 'border-border/50 bg-muted/20 opacity-70',
                )}
                title={
                  inUse
                    ? '角色已引用且绑定音色，生视频时将上传'
                    : '角色已绑定音色，在提示词 @ 或资产中引用后才会使用'
                }
              >
                <Mic className="h-3 w-3 text-cyan-500 shrink-0" />
                <span className={cn('truncate', expanded ? 'max-w-[120px]' : 'max-w-[88px]')}>
                  {item.label}
                </span>
                <span className="text-cyan-600 dark:text-cyan-400 shrink-0">@{item.mentionName}</span>
              </span>
            )
          })}
          {uploadedVoiceItems.map((item, index) => {
            const inUse = activeVoiceAudioItems.some(
              (audio) => audio.source === 'upload' && audio.path === item.path,
            )
            return (
              <span
                key={`${item.path}-${index}`}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border text-foreground/90',
                  voiceTagClass,
                  inUse
                    ? 'border-cyan-500/30 bg-cyan-500/10'
                    : 'border-border/50 bg-muted/30 opacity-70',
                )}
                title={
                  inUse ? '提示词已 @ 引用，生视频时将上传' : '未在提示词 @ 引用，生视频时不会上传'
                }
              >
                <Mic className="h-3 w-3 text-cyan-500 shrink-0" />
                <span
                  className={cn('truncate', expanded ? 'max-w-[140px]' : 'max-w-[100px]')}
                  title={item.path}
                >
                  {item.name}
                </span>
                <button
                  type="button"
                  title="移除"
                  onClick={() => handleRemoveAudioAt(index)}
                  className="rounded p-0.5 hover:bg-muted"
                >
                  <X className="h-2.5 w-2.5 text-muted-foreground" />
                </button>
              </span>
            )
          })}
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={btnClass}
            onClick={onUploadReferenceAudio}
            disabled={!onUploadReferenceAudio || uploadedVoiceItems.length >= MAX_REFERENCE_AUDIOS}
          >
            上传音色
          </Button>
        </ReferencePanelRow>

        {includeVideoSection ? (
          <ReferencePanelRow
            label="视频"
            count={String(videoCount)}
            countTitle={
              videoCount > 0 ? `已有 ${videoCount} 个分镜视频` : '暂无分镜视频，可上传参考视频'
            }
            expanded={expanded}
          >
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={btnClass}
              disabled
              title="上传参考视频即将上线，请使用「生成视频」"
            >
              上传视频
            </Button>
          </ReferencePanelRow>
        ) : null}
      </div>

      <HoverImagePreviewPortal preview={refHoverPreview} />
    </>
  )
}
