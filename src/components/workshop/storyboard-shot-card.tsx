import { Maximize2, Plus, Trash2 } from 'lucide-react'
import { MentionTextarea } from '@/components/workshop/mention-textarea'
import { StoryboardImageReviewBadge } from '@/components/workshop/storyboard-image-review-badge'
import { StoryboardShotQuickActions } from '@/components/workshop/storyboard-shot-quick-actions'
import { StoryboardShotReferencePanel } from '@/components/workshop/storyboard-shot-reference-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useStoryboardShotEditor } from '@/hooks/use-storyboard-shot-editor'
import { getGeneratedImagePaths } from '@/lib/workflow/asset-utils'
import type { MentionCandidate } from '@/lib/workflow/mention-utils'
import type { WorkflowAsset, WorkflowShot } from '@/types/workflow'
import type { VoiceLibraryEntry } from '@/types/voice-library'
import { cn } from '@/lib/utils'

function hasShotGeneratedImage(shot: WorkflowShot): boolean {
  return getGeneratedImagePaths(shot).length > 0
}

/** 左侧：待生成 / 已生成（对齐画镜分镜卡片） */
function shotGenerationStateLabel(shot: WorkflowShot): string {
  if (shot.status === 'generating') return '生成中'
  if (shot.status === 'done' || hasShotGeneratedImage(shot)) return '已生成'
  return '待生成'
}

interface StoryboardShotCardProps {
  shot: WorkflowShot
  selected: boolean
  previewUrl?: string | null
  generating: boolean
  validating?: boolean
  mentionCandidates: MentionCandidate[]
  characters?: WorkflowAsset[]
  voiceLibrary?: VoiceLibraryEntry[]
  projectRoot?: string
  onSelect: () => void
  onChange: (patch: Partial<WorkflowShot>) => void
  onGenerate: () => void
  onStopGenerate: () => void
  onDelete: () => void
  onInsertAfter: () => void
  onValidate: () => void
  onGenerateVideo: () => void
  onStopGenerateVideo: () => void
  /** 当前镜头生视频进行中 */
  videoBusy?: boolean
  onUploadReference?: () => void
  onPickReferenceFromLibrary?: () => void
  onUploadReferenceAudio?: () => void
  onExpandScript?: () => void
}

export function StoryboardShotCard({
  shot,
  selected,
  generating,
  validating = false,
  mentionCandidates,
  characters = [],
  voiceLibrary = [],
  projectRoot,
  onSelect,
  onChange,
  onGenerate,
  onStopGenerate,
  onDelete,
  onInsertAfter,
  onValidate,
  onGenerateVideo,
  onStopGenerateVideo,
  videoBusy = false,
  onUploadReference,
  onPickReferenceFromLibrary,
  onUploadReferenceAudio,
  onExpandScript,
}: StoryboardShotCardProps) {
  const isGenerating = generating || shot.status === 'generating'
  const generationLabel = isGenerating ? '生成中' : shotGenerationStateLabel(shot)

  const editor = useStoryboardShotEditor({
    shot,
    mentionCandidates,
    characters,
    voiceLibrary,
    projectRoot,
    onChange,
  })

  const handleActivate = () => {
    if (!selected) onSelect()
  }

  return (
    <div
      data-testid={`storyboard-shot-${shot.id}`}
      data-shot-number={shot.shotNumber}
      data-image-busy={isGenerating ? 'true' : 'false'}
      data-video-busy={videoBusy ? 'true' : 'false'}
      className={cn(
        'rounded-xl border bg-card/90 transition-colors',
        selected ? 'border-cyan-500/50 ring-1 ring-cyan-500/25' : 'border-border/60',
      )}
      onPointerDownCapture={handleActivate}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-border/50">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm font-semibold text-cyan-500 shrink-0">#{shot.shotNumber}</span>
          <Input
            value={shot.dialogue}
            onChange={(e) => editor.handleDialogueChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="h-7 text-xs border-transparent bg-transparent px-1 focus-visible:ring-1"
            placeholder="分镜标题"
          />
        </div>
        {onExpandScript ? (
          <button
            type="button"
            data-testid="storyboard-shot-expand"
            title="展开编辑分镜文案"
            onClick={(e) => {
              e.stopPropagation()
              onExpandScript()
            }}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-cyan-500 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5 px-2.5 py-1.5 border-b border-border/40" onClick={(e) => e.stopPropagation()}>
        <StoryboardShotQuickActions
          shot={shot}
          imageBusy={isGenerating}
          validating={validating}
          videoBusy={videoBusy}
          onGenerate={onGenerate}
          onStopGenerate={onStopGenerate}
          onValidate={onValidate}
          onGenerateVideo={onGenerateVideo}
          onStopGenerateVideo={onStopGenerateVideo}
          videoFirst
        />
      </div>

      <div className="px-2.5 py-2 space-y-1.5" onClick={(e) => e.stopPropagation()}>
        <MentionTextarea
          value={editor.promptText}
          onChange={editor.handlePromptChange}
          candidates={editor.promptMentionCandidates}
          projectRoot={projectRoot}
          characters={characters}
          rows={6}
          placeholder={'例：近景，爷爷坐在河岸边的石墩子上，小孙子在一旁抚摸山羊…（会自动转为 @引用）'}
        />

        <StoryboardShotReferencePanel
          shot={shot}
          variant="compact"
          includeVideoSection
          characters={characters}
          mentionCandidates={mentionCandidates}
          projectRoot={projectRoot}
          editor={editor}
          onUploadReference={onUploadReference}
          onPickReferenceFromLibrary={onPickReferenceFromLibrary}
          onUploadReferenceAudio={onUploadReferenceAudio}
          referenceLibraryTestId={`storyboard-shot-${shot.id}-reference-library`}
        />

        <div className="flex items-center justify-between gap-2 pt-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] text-muted-foreground shrink-0">{generationLabel}</span>
            <StoryboardImageReviewBadge shot={shot} />
            {isGenerating ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 text-red-400 border-red-500/30 hover:text-red-300"
                onClick={onStopGenerate}
              >
                停止生成
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2 text-red-400 border-red-500/30 hover:text-red-300"
              data-testid={`storyboard-shot-${shot.id}-delete`}
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
              删除分镜
            </Button>
            <button
              type="button"
              onClick={onInsertAfter}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md border border-dashed border-border/60 text-[10px] text-muted-foreground hover:text-cyan-500 hover:border-cyan-500/40 transition-colors"
            >
              <Plus className="h-3 w-3" />
              插入分镜
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
