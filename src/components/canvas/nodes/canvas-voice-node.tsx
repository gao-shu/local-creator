// Copyright (c) Haode AI. All rights reserved.

import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent } from 'react'
import { type NodeProps } from '@xyflow/react'
import { Loader2, Mic, Pause, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  CanvasNodeContextMenu,
  type CanvasNodeContextMenuAnchor,
} from '@/components/canvas/nodes/canvas-node-context-menu'
import { CanvasNodeConnector } from '@/components/canvas/nodes/canvas-node-connector'
import { useCanvasEditor } from '@/components/canvas/canvas-editor-context'
import {
  formatLocalMediaTimeLabel,
  useLocalMediaPlayer,
} from '@/hooks/use-local-media-player'
import {
  addVoiceLibraryEntry,
  listVoiceLibraryEntries,
  selectVoiceReferenceAudio,
} from '@/lib/voice/voice-library-service'
import {
  formatVoiceAudioPathLabel,
  isAllowedVoiceAudioPath,
  probeLocalAudioDurationSec,
  validateVoiceAudioDuration,
  VOICE_AUDIO_MAX_SEC,
  VOICE_AUDIO_MIN_SEC,
} from '@/lib/voice/voice-audio-utils'
import {
  CANVAS_IMAGE_ROLE_LABELS,
  resolveCanvasImageTitle,
} from '@/lib/canvas/canvas-image-role'
import {
  formatVoiceLibrarySavedToast,
  VOICE_LIBRARY_SAVE_BUTTON,
  VOICE_LIBRARY_SAVE_HINT,
} from '@/constants/voice-library-copy'
import type { CanvasImageNodeData, CanvasVoiceNodeData } from '@/types/canvas-nodes'
import { CANVAS_NODE_TYPES } from '@/types/canvas-nodes'
import {
  decodeLocalVoiceType,
  encodeLocalVoiceType,
  isLocalVoiceType,
  resolveVoiceLabel,
  type VoiceLibraryEntry,
} from '@/types/voice-library'
import { cn } from '@/lib/utils'
import {
  CANVAS_NODE_INPUT,
  CANVAS_NODE_SHELL,
  CANVAS_NODE_SHELL_HEADER,
  CANVAS_NODE_SOFT_BTN,
  CANVAS_NODE_SUBTEXT,
} from '@/lib/canvas/canvas-node-theme'

const VOICE_NODE_WIDTH_PX = 260

function CanvasVoiceNodeComponent({ id, data }: NodeProps) {
  const nodeData = data as CanvasVoiceNodeData
  const { projectId, nodes, edges, updateNodeData, deleteNode, duplicateNode } = useCanvasEditor()
  const [voices, setVoices] = useState<VoiceLibraryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [uploadExpanded, setUploadExpanded] = useState(false)
  const [newVoiceName, setNewVoiceName] = useState('')
  const [selectedAudioPath, setSelectedAudioPath] = useState('')
  const [selectingAudio, setSelectingAudio] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [contextMenuAnchor, setContextMenuAnchor] = useState<CanvasNodeContextMenuAnchor | null>(
    null,
  )

  const boundImage = useMemo(() => {
    const inbound = edges.find((edge) => edge.target === id)
    if (inbound) {
      const source = nodes.find((node) => node.id === inbound.source)
      if (source?.type === CANVAS_NODE_TYPES.imageNode) return source
    }
    const outbound = edges.find((edge) => edge.source === id)
    if (outbound) {
      const target = nodes.find((node) => node.id === outbound.target)
      if (target?.type === CANVAS_NODE_TYPES.imageNode) return target
    }
    return null
  }, [edges, id, nodes])

  const boundImageData = boundImage?.data as CanvasImageNodeData | undefined
  const boundTitle = boundImageData
    ? resolveCanvasImageTitle({
        assetRole: boundImageData.assetRole,
        importShotNumber: boundImageData.importShotNumber,
        imageName: boundImageData.imageName,
      }).label
    : null

  const syncVoiceToBoundImage = useCallback(
    (voiceType?: string, voiceName?: string) => {
      if (!boundImage?.id || !voiceType || !isLocalVoiceType(voiceType)) return
      updateNodeData(boundImage.id, {
        voiceType,
        voiceName: voiceName || undefined,
      })
    },
    [boundImage?.id, updateNodeData],
  )

  useEffect(() => {
    if (!boundImage?.id || !isLocalVoiceType(nodeData.voiceType)) return
    if (boundImageData?.voiceType === nodeData.voiceType) return
    syncVoiceToBoundImage(nodeData.voiceType, nodeData.voiceName)
  }, [
    boundImage?.id,
    boundImageData?.voiceType,
    nodeData.voiceType,
    nodeData.voiceName,
    syncVoiceToBoundImage,
  ])

  const loadVoices = useCallback(async () => {
    setLoading(true)
    try {
      const items = await listVoiceLibraryEntries()
      setVoices(items)
    } catch {
      setVoices([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVoices()
  }, [loadVoices])

  const voiceOptions = useMemo(
    () =>
      voices.map((item) => ({
        value: encodeLocalVoiceType(item.id),
        label: item.sourceInRecycleBin ? `${item.name}（来源在回收站）` : item.name,
      })),
    [voices],
  )

  const voiceValue = isLocalVoiceType(nodeData.voiceType) ? nodeData.voiceType! : ''
  const selectedVoiceLabel = resolveVoiceLabel(voiceValue, voices)
  const nodeTitle = selectedVoiceLabel || '音色节点'

  const selectedVoice = useMemo(() => {
    const voiceId = decodeLocalVoiceType(nodeData.voiceType)
    if (!voiceId) return null
    return voices.find((item) => item.id === voiceId) ?? null
  }, [nodeData.voiceType, voices])

  const previewAudioPath = String(selectedVoice?.referenceAudio || '').trim()
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
    src: previewAudioPath || undefined,
    kind: 'audio',
  })
  const canPlay = Boolean(previewAudioPath) && playerReady

  const resetUploadForm = useCallback(() => {
    setUploadExpanded(false)
    setNewVoiceName('')
    setSelectedAudioPath('')
  }, [])

  const handleToggleUpload = useCallback(() => {
    if (uploadExpanded) {
      resetUploadForm()
      return
    }
    setNewVoiceName(boundTitle ? `${boundTitle}音色` : '')
    setSelectedAudioPath('')
    setUploadExpanded(true)
  }, [boundTitle, resetUploadForm, uploadExpanded])

  const handleSelectAudio = useCallback(async () => {
    setSelectingAudio(true)
    try {
      const filePath = await selectVoiceReferenceAudio()
      if (!filePath) return
      if (!isAllowedVoiceAudioPath(filePath)) {
        toast.error('仅支持 mp3 / wav 格式')
        return
      }
      const duration = await probeLocalAudioDurationSec(filePath)
      const durationError = validateVoiceAudioDuration(duration)
      if (durationError) {
        toast.error(durationError)
        return
      }
      setSelectedAudioPath(filePath)
    } catch (error: unknown) {
      toast.error((error as Error).message || '选择音频失败')
    } finally {
      setSelectingAudio(false)
    }
  }, [])

  const handleSaveVoice = useCallback(async () => {
    const name = newVoiceName.trim()
    if (!name) {
      toast.error('请输入音色名称')
      return
    }
    if (!selectedAudioPath) {
      toast.error('请先选择参考音频')
      return
    }
    setSubmitting(true)
    try {
      const duration = await probeLocalAudioDurationSec(selectedAudioPath)
      const durationError = validateVoiceAudioDuration(duration)
      if (durationError) {
        toast.error(durationError)
        return
      }
      const voice = await addVoiceLibraryEntry(name, selectedAudioPath, {
        projectId,
        projectKind: 'canvas',
      })
      await loadVoices()
      updateNodeData(id, {
        voiceType: encodeLocalVoiceType(voice.id),
        voiceName: voice.name,
      })
      syncVoiceToBoundImage(encodeLocalVoiceType(voice.id), voice.name)
      resetUploadForm()
      toast.success(formatVoiceLibrarySavedToast(voice.name))
    } catch (error: unknown) {
      toast.error((error as Error).message || '保存音色失败')
    } finally {
      setSubmitting(false)
    }
  }, [
    id,
    projectId,
    loadVoices,
    newVoiceName,
    resetUploadForm,
    selectedAudioPath,
    syncVoiceToBoundImage,
    updateNodeData,
  ])

  const canSave = Boolean(newVoiceName.trim() && selectedAudioPath)

  const handleContextMenu = useCallback((event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setContextMenuAnchor({ x: event.clientX, y: event.clientY })
  }, [])

  return (
    <div
      className={cn('relative', CANVAS_NODE_SHELL)}
      style={{ width: VOICE_NODE_WIDTH_PX }}
      onContextMenu={handleContextMenu}
    >
      <CanvasNodeContextMenu
        anchor={contextMenuAnchor}
        title="音色 → 操作"
        onClose={() => setContextMenuAnchor(null)}
        onDuplicate={() => duplicateNode(id)}
        onDelete={() => deleteNode(id)}
      />
      {/* 轻薄方案 L2：仅左侧 target 可接入；禁止发起连线 / quick-add */}
      <CanvasNodeConnector
        side="left"
        silent
        connectableStart={false}
        disableQuickAdd
        onQuickAdd={() => {}}
      />
      <div className={cn('flex items-center gap-2 px-3 py-2.5 cursor-grab active:cursor-grabbing', CANVAS_NODE_SHELL_HEADER)}>
        <Mic className="h-4 w-4 text-violet-400" />
        <span className="text-[13px] font-medium">音色</span>
      </div>

      <div className="space-y-2.5 px-3 py-3">
        <p className={cn('text-[11px]', CANVAS_NODE_SUBTEXT)}>{nodeTitle}</p>

        {boundTitle ? (
          <p className="text-[10px] text-pink-400/80">
            已关联{boundImageData?.assetRole ? CANVAS_IMAGE_ROLE_LABELS[boundImageData.assetRole] : '图片'}：{boundTitle}
          </p>
        ) : null}

        <Select
          value={voiceValue}
          onChange={(value) => {
            const voiceType = value || undefined
            const voiceName = voiceType ? resolveVoiceLabel(voiceType, voices) : undefined
            updateNodeData(id, { voiceType, voiceName: voiceName || undefined })
            syncVoiceToBoundImage(voiceType, voiceName)
          }}
          options={voiceOptions}
          placeholder={loading ? '加载音色…' : '选择本地音色'}
          className="h-8 w-full text-xs"
        />

        {voiceValue ? (
          !previewAudioPath ? (
            <p className="text-[11px] text-amber-400/90">未找到参考音频</p>
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
                  data-testid="canvas-voice-node-play"
                  title={playing ? '暂停试听' : '试听音色'}
                >
                  {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={playerDuration && playerDuration > 0 ? playerDuration : 100}
                    step={0.05}
                    value={Math.min(currentTime, playerDuration ?? currentTime)}
                    disabled={!canPlay || !playerDuration}
                    onChange={(event) => seek(Number(event.target.value))}
                    className="nodrag nopan h-1.5 w-full cursor-pointer accent-violet-400"
                    data-testid="canvas-voice-node-seek"
                  />
                  <div className="flex justify-between tabular-nums text-[10px] text-muted-foreground">
                    <span>{formatLocalMediaTimeLabel(currentTime)}</span>
                    <span>{formatLocalMediaTimeLabel(playerDuration)}</span>
                  </div>
                </div>
              </div>
              {playerError ? (
                <p className="text-[11px] text-destructive">{playerError}</p>
              ) : null}
            </div>
          )
        ) : null}

        <button
          type="button"
          onClick={handleToggleUpload}
          className={cn(
            'flex h-8 w-full items-center justify-center rounded-xl text-[12px] transition-colors',
            CANVAS_NODE_SOFT_BTN,
          )}
        >
          {uploadExpanded ? '收起上传' : '上传音色'}
        </button>

        {uploadExpanded ? (
          <div className={cn('space-y-2.5 rounded-xl border p-2.5', 'border-border/35 bg-muted/20 dark:border-white/[0.08] dark:bg-[#1a1b1f]/90')}>
            <p className={cn('text-[10px]', CANVAS_NODE_SUBTEXT)}>{VOICE_LIBRARY_SAVE_HINT}</p>

            <Input
              value={newVoiceName}
              onChange={(event) => setNewVoiceName(event.target.value)}
              placeholder="音色名称，如：男主-激昂"
              className={cn('h-8 text-xs', CANVAS_NODE_INPUT)}
            />

            <div className="flex items-center gap-2">
              <Input
                value={selectedAudioPath ? formatVoiceAudioPathLabel(selectedAudioPath) : ''}
                readOnly
                placeholder="未选择参考音频"
                className={cn('h-8 min-w-0 flex-1 text-xs', CANVAS_NODE_INPUT)}
              />
              <button
                type="button"
                disabled={selectingAudio}
                onClick={() => void handleSelectAudio()}
                className={cn(
                  'nodrag nopan shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] disabled:opacity-50',
                  CANVAS_NODE_SOFT_BTN,
                )}
              >
                {selectingAudio ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '选择'}
              </button>
            </div>

            <p className={cn('text-[10px]', CANVAS_NODE_SUBTEXT)}>
              仅支持 mp3/wav，时长 {VOICE_AUDIO_MIN_SEC}–{VOICE_AUDIO_MAX_SEC} 秒
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!canSave || submitting}
                onClick={() => void handleSaveVoice()}
                className={cn(
                  'nodrag nopan flex h-8 flex-1 items-center justify-center rounded-lg text-[12px] transition-colors',
                  canSave
                    ? 'border border-emerald-400/60 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-300'
                    : cn('border', CANVAS_NODE_SOFT_BTN, 'text-muted-foreground dark:text-white/35'),
                  'disabled:opacity-50',
                )}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  VOICE_LIBRARY_SAVE_BUTTON
                )}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={resetUploadForm}
                className={cn(
                  'nodrag nopan h-8 shrink-0 rounded-lg border px-3 text-[12px] disabled:opacity-50',
                  CANVAS_NODE_SOFT_BTN,
                )}
              >
                取消
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const CanvasVoiceNode = memo(CanvasVoiceNodeComponent)
