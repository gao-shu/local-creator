// Copyright (c) local-creator contributors. All rights reserved.

import { memo, useCallback, useMemo, useState, type MouseEvent } from 'react'
import { type NodeProps } from '@xyflow/react'
import { AudioLines, FolderOpen, Loader2, Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import {
  CanvasNodeContextMenu,
  type CanvasNodeContextMenuAnchor,
} from '@/components/canvas/nodes/canvas-node-context-menu'
import { CanvasNodeConnector } from '@/components/canvas/nodes/canvas-node-connector'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import { useCanvasNodeQuickAdd } from '@/hooks/use-canvas-node-quick-add'
import { useCanvasAudioPreview } from '@/hooks/use-canvas-media-preview'
import {
  formatLocalMediaTimeLabel,
  useLocalMediaPlayer,
} from '@/hooks/use-local-media-player'
import { resolveCanvasAudioMediaProjectRoot } from '@/lib/canvas/canvas-media-resolve'
import { revealPathInExplorer } from '@/lib/storage/fs-service'
import { resolveProjectVoiceExtractAbsolutePath } from '@/lib/voice/project-voice-extract-paths'
import type { CanvasAudioNodeData } from '@/types/canvas-nodes'
import { cn } from '@/lib/utils'
import {
  CANVAS_NODE_SHELL,
  CANVAS_NODE_SHELL_HEADER,
  CANVAS_NODE_SOFT_BTN,
  CANVAS_NODE_SUBTEXT,
} from '@/lib/canvas/canvas-node-theme'

export const CANVAS_AUDIO_NODE_WIDTH_PX = 260

/** 原视频时间轴上的截取区间文案；整段提取返回 null */
function formatAudioExtractRangeLabel(data: CanvasAudioNodeData): string | null {
  const start = data.extractStartSec
  const end = data.extractEndSec
  if (start == null && end == null) return null
  const startLabel = start != null && Number.isFinite(start) ? `${start.toFixed(1)}s` : '0.0s'
  const endLabel = end != null && Number.isFinite(end) ? `${end.toFixed(1)}s` : '片尾'
  return `${startLabel} – ${endLabel}`
}

function CanvasAudioNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as CanvasAudioNodeData
  const { projectId, deleteNode, duplicateNode } = useCanvasEditor()
  const [contextMenuAnchor, setContextMenuAnchor] = useState<CanvasNodeContextMenuAnchor | null>(
    null,
  )
  const [revealingFolder, setRevealingFolder] = useState(false)

  const audioRelativePath = String(nodeData.audioRelativePath || '').trim()
  const { src: audioSrc, mediaMissing } = useCanvasAudioPreview(
    audioRelativePath,
    projectId,
    nodeData.mediaOwnerKind,
    nodeData.mediaOwnerProjectId,
  )

  const {
    ready: playerReady,
    playing,
    currentTime,
    duration: playerDuration,
    error: playerError,
    play,
    pause,
    seek,
  } = useLocalMediaPlayer({
    src: audioSrc || undefined,
    kind: 'audio',
  })

  const sourceLabel = String(nodeData.sourceVideoLabel || '').trim()
  const rangeLabel = useMemo(() => formatAudioExtractRangeLabel(nodeData), [nodeData])
  const displayDuration = playerDuration ?? nodeData.durationSec ?? null
  const showOriginMeta =
    Boolean(sourceLabel) ||
    Boolean(String(nodeData.sourceVideoNodeId || '').trim()) ||
    rangeLabel != null

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuAnchor({ x: event.clientX, y: event.clientY })
  }, [])

  const handleConnectorAdd = useCanvasNodeQuickAdd(id, CANVAS_AUDIO_NODE_WIDTH_PX)

  const handleRevealFolder = useCallback(async () => {
    if (!audioRelativePath) {
      toast.error('缺少音频路径')
      return
    }
    setRevealingFolder(true)
    try {
      const projectRoot = await resolveCanvasAudioMediaProjectRoot(
        projectId,
        audioRelativePath,
        {
          ownerKind: nodeData.mediaOwnerKind,
          ownerProjectId: nodeData.mediaOwnerProjectId,
        },
      )
      if (!projectRoot) {
        toast.error('无法解析项目路径')
        return
      }
      const outputAbs = resolveProjectVoiceExtractAbsolutePath(projectRoot, audioRelativePath)
      const result = await revealPathInExplorer(outputAbs, { revealFile: true })
      if (!result.success) {
        toast.error(result.error || '无法打开文件夹')
      }
    } finally {
      setRevealingFolder(false)
    }
  }, [audioRelativePath, nodeData.mediaOwnerKind, nodeData.mediaOwnerProjectId, projectId])

  const canPlay = Boolean(audioSrc) && playerReady && !mediaMissing

  return (
    <div
      className={cn('relative', CANVAS_NODE_SHELL)}
      style={{ width: CANVAS_AUDIO_NODE_WIDTH_PX }}
      onContextMenu={handleContextMenu}
      data-testid="canvas-audio-node"
    >
      <CanvasNodeContextMenu
        anchor={contextMenuAnchor}
        title="音频 → 操作"
        onClose={() => setContextMenuAnchor(null)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      />
      <CanvasNodeConnector side="left" silent onQuickAdd={handleConnectorAdd} />
      <CanvasNodeConnector side="right" silent onQuickAdd={handleConnectorAdd} />

      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing',
          CANVAS_NODE_SHELL_HEADER,
        )}
      >
        <AudioLines className="h-4 w-4 text-sky-400" />
        <span className="text-[13px] font-medium">音频片段</span>
      </div>

      <div className="space-y-2.5 px-3 pb-3">
        {sourceLabel ? (
          <p
            className={cn('truncate text-[11px]', CANVAS_NODE_SUBTEXT)}
            title={sourceLabel}
          >
            来自：{sourceLabel}
          </p>
        ) : null}
        {showOriginMeta ? (
          <p className="truncate text-[10px] text-muted-foreground/80">
            {rangeLabel ? `原视频 ${rangeLabel}` : '整段提取'}
          </p>
        ) : null}

        {!audioRelativePath ? (
          <p className="text-[11px] text-amber-400/90">未绑定音频文件</p>
        ) : mediaMissing ? (
          <p className="text-[11px] text-amber-400/90">音频文件不存在或无法加载</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canPlay}
                onClick={() => (playing ? pause() : play())}
                className={cn(
                  'nodrag nopan flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors',
                  CANVAS_NODE_SOFT_BTN,
                  !canPlay && 'cursor-not-allowed opacity-50',
                )}
                data-testid="canvas-audio-node-play"
              >
                {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              </button>
              <div className="min-w-0 flex-1 space-y-1">
                <input
                  type="range"
                  min={0}
                  max={displayDuration && displayDuration > 0 ? displayDuration : 100}
                  step={0.05}
                  value={Math.min(currentTime, displayDuration ?? currentTime)}
                  disabled={!canPlay || !displayDuration}
                  onChange={(event) => seek(Number(event.target.value))}
                  className="nodrag nopan h-1.5 w-full cursor-pointer accent-sky-400"
                  data-testid="canvas-audio-node-seek"
                />
                <div className="flex justify-between tabular-nums text-[10px] text-muted-foreground">
                  <span>
                    片段 {formatLocalMediaTimeLabel(currentTime)}
                  </span>
                  <span>{formatLocalMediaTimeLabel(displayDuration)}</span>
                </div>
              </div>
            </div>
            {playerError ? (
              <p className="text-[11px] text-destructive">{playerError}</p>
            ) : null}
          </div>
        )}

        <button
          type="button"
          disabled={!audioRelativePath || revealingFolder}
          onClick={() => void handleRevealFolder()}
          className={cn(
            'nodrag nopan flex h-8 w-full items-center justify-center gap-1.5 rounded-xl text-[12px] transition-colors',
            CANVAS_NODE_SOFT_BTN,
            (!audioRelativePath || revealingFolder) && 'cursor-not-allowed opacity-50',
          )}
          data-testid="canvas-audio-node-reveal"
        >
          {revealingFolder ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <FolderOpen className="h-3.5 w-3.5" />
          )}
          打开文件夹
        </button>
      </div>
    </div>
  )
}

export const CanvasAudioNode = memo(CanvasAudioNodeComponent)
