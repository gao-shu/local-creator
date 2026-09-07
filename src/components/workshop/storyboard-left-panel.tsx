import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2, Plus } from 'lucide-react'
import { StoryboardShotCard } from '@/components/workshop/storyboard-shot-card'
import { StoryboardShotScriptDialog } from '@/components/workshop/storyboard-shot-script-dialog'
import { WorkshopAiButton } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { buildMentionCandidates, markMentionCandidatesSynced } from '@/lib/workflow/mention-utils'
import { filterAssetsByEpisode } from '@/lib/workflow/asset-utils'
import { formatEpisodeDisplayLabel } from '@/lib/workflow/episode-utils'
import { collectSyncedAssetIds } from '@/lib/materials/material-library-service'
import { readMaterialsIndex } from '@/lib/materials/materials-index-service'
import type { WorkflowEpisode, WorkflowProjectData, WorkflowShot } from '@/types/workflow'
import type { VoiceLibraryEntry } from '@/types/voice-library'

interface StoryboardLeftPanelProps {
  data: WorkflowProjectData
  episodes: WorkflowEpisode[]
  projectId?: string
  selectedEpisodeId: string | null
  selectedShotId: string | null
  shots: WorkflowShot[]
  previewMap: Record<string, string>
  generatingId: string | null
  validatingShotId?: string | null
  /** 单镜头「生成分镜图」是否进行中 */
  isShotImageBusy?: (shotId: string) => boolean
  /** 单镜头「生成视频」是否禁用（仅正在生成的镜头） */
  isShotVideoBusy?: (shotId: string) => boolean
  inferring: boolean
  /** 全集文本二次验证（空间锚点）进行中 —— 与单镜 validatingShotId 不同 */
  storyboardValidating: boolean
  /** 有待确认的二次验证结果（弹窗打开期间禁止再点） */
  storyboardValidatePending?: boolean
  busy: boolean
  projectRoot?: string
  voiceLibrary?: VoiceLibraryEntry[]
  onEpisodeChange: (id: string) => void
  onEpisodeContentChange: (content: string) => void
  onSelectShot: (id: string) => void
  onShotChange: (shotId: string, patch: Partial<WorkflowShot>) => void
  onUploadShotReference: (shotId: string) => void
  onPickShotReferenceFromLibrary: (shotId: string) => void
  onUploadShotReferenceAudio: (shotId: string) => void
  onGenerateShot: (shotId: string) => void
  onStopGenerateShot: (shotId: string) => void
  onDeleteShot: (shotId: string) => void
  onValidateShot: (shotId: string) => void
  onGenerateVideoShot: (shotId: string) => void
  onStopGenerateVideoShot: (shotId: string) => void
  onInsertAfter: (afterShotId: string | null) => void
  onInfer: () => void
  /** 全集二次验证：补全局空间锚点（与单镜微视审核 onValidateShot 不同） */
  onValidateStoryboard: () => void
  onAdd: () => void
  onClear: () => void
}

export function StoryboardLeftPanel({
  data,
  episodes,
  projectId,
  selectedEpisodeId,
  selectedShotId,
  shots,
  previewMap,
  generatingId,
  validatingShotId = null,
  isShotImageBusy,
  isShotVideoBusy,
  inferring,
  storyboardValidating,
  storyboardValidatePending = false,
  busy,
  projectRoot,
  voiceLibrary = [],
  onEpisodeChange,
  onEpisodeContentChange,
  onSelectShot,
  onShotChange,
  onUploadShotReference,
  onPickShotReferenceFromLibrary,
  onUploadShotReferenceAudio,
  onGenerateShot,
  onStopGenerateShot,
  onDeleteShot,
  onValidateShot,
  onGenerateVideoShot,
  onStopGenerateVideoShot,
  onInsertAfter,
  onInfer,
  onValidateStoryboard,
  onAdd,
  onClear,
}: StoryboardLeftPanelProps) {
  const [scriptOpen, setScriptOpen] = useState(true)
  const [scriptDialogShotId, setScriptDialogShotId] = useState<string | null>(null)
  const [syncedAssetIds, setSyncedAssetIds] = useState<Set<string>>(() => new Set())
  const listRef = useRef<HTMLDivElement>(null)
  const prevShotCountRef = useRef(shots.length)
  const restoreScrollTopRef = useRef<number | null>(null)
  const skipScrollIntoViewRef = useRef(false)
  const episode = episodes.find((ep) => ep.id === selectedEpisodeId) ?? null

  const validateStoryboardDisabled =
    busy ||
    storyboardValidating ||
    storyboardValidatePending ||
    inferring ||
    !episode ||
    shots.length === 0

  useEffect(() => {
    if (!projectId) {
      setSyncedAssetIds(new Set())
      return
    }
    let cancelled = false
    void readMaterialsIndex().then((index) => {
      if (!cancelled) {
        setSyncedAssetIds(collectSyncedAssetIds(index, projectId))
      }
    })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const mentionCandidates = useMemo(() => {
    if (!episode) return []
    const base = buildMentionCandidates(
      {
        characters: filterAssetsByEpisode(data.characters ?? [], episode, 'character'),
        scenes: filterAssetsByEpisode(data.scenes ?? [], episode, 'scene'),
        props: filterAssetsByEpisode(data.props ?? [], episode, 'prop'),
      },
      voiceLibrary,
    )
    return markMentionCandidatesSynced(base, syncedAssetIds)
  }, [data.characters, data.props, data.scenes, episode, syncedAssetIds, voiceLibrary])

  const episodeCharacters = useMemo(() => {
    if (!episode) return []
    return filterAssetsByEpisode(data.characters ?? [], episode, 'character')
  }, [data.characters, episode])

  const scriptDialogShot = useMemo(
    () => (scriptDialogShotId ? shots.find((item) => item.id === scriptDialogShotId) ?? null : null),
    [scriptDialogShotId, shots],
  )

  useEffect(() => {
    if (scriptDialogShotId && !scriptDialogShot) {
      setScriptDialogShotId(null)
    }
  }, [scriptDialogShotId, scriptDialogShot])

  const episodeOptions = episodes.map((ep) => ({
    value: ep.id,
    label: formatEpisodeDisplayLabel(ep),
  }))

  useEffect(() => {
    if (shots.length < prevShotCountRef.current && listRef.current) {
      restoreScrollTopRef.current = listRef.current.scrollTop
      skipScrollIntoViewRef.current = true
    }
    prevShotCountRef.current = shots.length
  }, [shots.length])

  useEffect(() => {
    if (restoreScrollTopRef.current === null || !listRef.current) return
    const top = restoreScrollTopRef.current
    restoreScrollTopRef.current = null
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = top
      skipScrollIntoViewRef.current = false
    })
  }, [shots])

  useEffect(() => {
    if (skipScrollIntoViewRef.current) return
    if (!selectedShotId || !listRef.current) return
    const el = listRef.current.querySelector(`[data-shot-id="${selectedShotId}"]`)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedShotId])

  return (
    <div className="flex flex-col h-full min-h-0 w-[min(100%,520px)] shrink-0 rounded-xl border border-border/60 bg-card/95 overflow-hidden">
      <div className="p-2.5 border-b border-border/50 shrink-0 space-y-2">
        {episodes.length > 1 ? (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-cyan-600/80 dark:text-cyan-400/80 px-0.5">当前分集</p>
            <Select
              value={selectedEpisodeId ?? ''}
              onChange={onEpisodeChange}
              options={episodeOptions}
              className="h-9 text-sm font-medium border-cyan-500/35 bg-cyan-500/10"
            />
          </div>
        ) : episode ? (
          <div className="rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1.5">
            <p className="text-[10px] text-cyan-600/80 dark:text-cyan-400/80 mb-0.5">当前分集</p>
            <p className="text-sm font-semibold text-foreground leading-snug">
              {formatEpisodeDisplayLabel(episode)}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <WorkshopAiButton
            type="button"
            sizePreset="toolbar"
            className="shrink-0"
            data-testid="workshop-step4-infer"
            disabled={busy || storyboardValidating || !episode}
            loading={inferring}
            onClick={onInfer}
          >
            推理分镜
          </WorkshopAiButton>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs px-2.5 shrink-0"
            data-testid="workshop-step4-validate-storyboard"
            disabled={validateStoryboardDisabled}
            title={
              !episode
                ? '请先选择分集'
                : shots.length === 0
                  ? '请先推理或添加分镜'
                  : storyboardValidatePending
                    ? '请先处理当前空间锚点结果'
                    : storyboardValidating
                      ? '正在补充空间锚点…'
                      : inferring || busy
                        ? '请等待当前任务结束'
                        : '补充全局空间锚点（文本场记）。与镜头「审核」分镜图不同'
            }
            onClick={onValidateStoryboard}
          >
            {storyboardValidating ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                补充中…
              </>
            ) : (
              '补空间锚点'
            )}
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={!episode} onClick={onAdd} className="h-8 text-xs px-2.5" data-testid="workshop-step4-add-shot">
            <Plus className="h-3 w-3 mr-1" />
            添加
          </Button>
          <Button type="button" size="sm" variant="outline" disabled className="h-8 text-xs px-2.5" title="分镜导入即将上线">
            导入
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={shots.length === 0} onClick={onClear} className="h-8 text-xs px-2.5">
            清空
          </Button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setScriptOpen((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground border-b border-border/50 shrink-0"
      >
        {scriptOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        剧本参考
        {episode ? ` · 第${episode.episodeIndex}集` : ''}
      </button>

      {scriptOpen ? (
        <div className="px-3 py-2 border-b border-border/50 shrink-0 bg-muted/15">
          <Textarea
            data-testid="workshop-step4-episode-source"
            rows={4}
            value={episode?.content ?? ''}
            onChange={(e) => onEpisodeContentChange(e.target.value)}
            disabled={!episode}
            placeholder="输入或粘贴本集剧本…"
            className="min-h-0 max-h-28 resize-none rounded-lg border-border/40 bg-background/50 px-2.5 py-2 text-[12px] leading-relaxed font-mono"
          />
        </div>
      ) : null}

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-2">
        {shots.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-10 px-2">
            暂无分镜，点击「推理分镜」或手动添加
          </p>
        ) : (
          shots.map((shot) => (
            <div key={shot.id} data-shot-id={shot.id} className="space-y-2 scroll-mt-2">
              <StoryboardShotCard
                shot={shot}
                selected={shot.id === selectedShotId}
                previewUrl={previewMap[shot.id]}
                generating={isShotImageBusy?.(shot.id) ?? generatingId === shot.id}
                validating={validatingShotId === shot.id}
                mentionCandidates={mentionCandidates}
                characters={episodeCharacters}
                voiceLibrary={voiceLibrary}
                projectRoot={projectRoot}
                onSelect={() => onSelectShot(shot.id)}
                onChange={(patch) => onShotChange(shot.id, patch)}
                onGenerate={() => onGenerateShot(shot.id)}
                onStopGenerate={() => onStopGenerateShot(shot.id)}
                onDelete={() => onDeleteShot(shot.id)}
                onInsertAfter={() => onInsertAfter(shot.id)}
                onValidate={() => onValidateShot(shot.id)}
                onGenerateVideo={() => onGenerateVideoShot(shot.id)}
                onStopGenerateVideo={() => onStopGenerateVideoShot(shot.id)}
                videoBusy={isShotVideoBusy?.(shot.id) ?? false}
                onUploadReference={() => onUploadShotReference(shot.id)}
                onPickReferenceFromLibrary={() => onPickShotReferenceFromLibrary(shot.id)}
                onUploadReferenceAudio={() => onUploadShotReferenceAudio(shot.id)}
                onExpandScript={() => {
                  setScriptDialogShotId(shot.id)
                  onSelectShot(shot.id)
                }}
              />
            </div>
          ))
        )}
      </div>

      {scriptDialogShot ? (
        <StoryboardShotScriptDialog
          open
          shot={scriptDialogShot}
          shots={shots}
          mentionCandidates={mentionCandidates}
          characters={episodeCharacters}
          voiceLibrary={voiceLibrary}
          projectRoot={projectRoot}
          onChange={(patch) => {
            if (scriptDialogShotId) onShotChange(scriptDialogShotId, patch)
          }}
          onClose={() => setScriptDialogShotId(null)}
          onNavigate={(shotId) => {
            setScriptDialogShotId(shotId)
            onSelectShot(shotId)
          }}
          onUploadReference={() => {
            if (scriptDialogShotId) onUploadShotReference(scriptDialogShotId)
          }}
          onPickReferenceFromLibrary={() => {
            if (scriptDialogShotId) onPickShotReferenceFromLibrary(scriptDialogShotId)
          }}
          onUploadReferenceAudio={() => {
            if (scriptDialogShotId) onUploadShotReferenceAudio(scriptDialogShotId)
          }}
          imageBusy={
            scriptDialogShotId
              ? (isShotImageBusy?.(scriptDialogShotId) ?? generatingId === scriptDialogShotId)
              : false
          }
          validating={scriptDialogShotId ? validatingShotId === scriptDialogShotId : false}
          videoBusy={scriptDialogShotId ? (isShotVideoBusy?.(scriptDialogShotId) ?? false) : false}
          onGenerate={() => {
            if (scriptDialogShotId) onGenerateShot(scriptDialogShotId)
          }}
          onStopGenerate={() => {
            if (scriptDialogShotId) onStopGenerateShot(scriptDialogShotId)
          }}
          onValidate={() => {
            if (scriptDialogShotId) onValidateShot(scriptDialogShotId)
          }}
          onGenerateVideo={() => {
            if (scriptDialogShotId) onGenerateVideoShot(scriptDialogShotId)
          }}
          onStopGenerateVideo={() => {
            if (scriptDialogShotId) onStopGenerateVideoShot(scriptDialogShotId)
          }}
        />
      ) : null}
    </div>
  )
}
