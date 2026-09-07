// Copyright (c) local-creator contributors. All rights reserved.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2, Plus, Save, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { WORKSHOP_AI_TOKENS } from '@/components/workshop/workshop-ai-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
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
  decodeLocalVoiceType,
  encodeLocalVoiceType,
  isLocalVoiceType,
  LOCAL_VOICE_PREFIX,
  type VoiceLibraryEntry,
} from '@/types/voice-library'
import {
  formatVoiceLibrarySavedToast,
  VOICE_LIBRARY_ADD_TITLE,
  VOICE_LIBRARY_ADD_TRIGGER,
  VOICE_LIBRARY_SAVE_BUTTON,
  VOICE_LIBRARY_SAVE_HINT,
} from '@/constants/voice-library-copy'
import { cn } from '@/lib/utils'

interface CharacterVoiceFieldProps {
  projectId: string
  voiceType?: string
  onChange: (voiceType: string | undefined) => void
  /** 画布项目音色库存储在 canvas 目录下 */
  projectKind?: 'workflow' | 'canvas'
}

export function CharacterVoiceField({
  projectId,
  voiceType,
  onChange,
  projectKind = 'workflow',
}: CharacterVoiceFieldProps) {
  const [voices, setVoices] = useState<VoiceLibraryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newVoiceName, setNewVoiceName] = useState('')
  const [selectedAudioPath, setSelectedAudioPath] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selectingAudio, setSelectingAudio] = useState(false)

  const loadVoices = useCallback(async () => {
    setLoading(true)
    try {
      const items = await listVoiceLibraryEntries()
      setVoices(items)
    } catch (error: unknown) {
      toast.error((error as Error).message || '加载音色库失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadVoices()
  }, [loadVoices])

  // 仅支持本地音色；旧数据中的云端绑定自动清空
  useEffect(() => {
    if (!voiceType?.trim()) return
    if (!isLocalVoiceType(voiceType)) {
      onChange(undefined)
    }
  }, [voiceType, onChange])

  const localVoiceType = isLocalVoiceType(voiceType) ? voiceType : undefined

  const voiceOptions = useMemo(
    () =>
      voices.map((item) => ({
        value: encodeLocalVoiceType(item.id),
        label: item.sourceInRecycleBin ? `${item.name}（来源在回收站）` : item.name,
      })),
    [voices],
  )

  const selectedVoice = useMemo(() => {
    const localId = decodeLocalVoiceType(localVoiceType)
    if (!localId) return null
    return voices.find((item) => item.id === localId) ?? null
  }, [localVoiceType, voices])

  const resetAddForm = () => {
    setAdding(false)
    setNewVoiceName('')
    setSelectedAudioPath('')
  }

  const handleSelectAudio = async () => {
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
  }

  const handleSubmitNewVoice = async () => {
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
        projectKind,
      })
      await loadVoices()
      onChange(encodeLocalVoiceType(voice.id))
      resetAddForm()
      toast.success(formatVoiceLibrarySavedToast(voice.name))
    } catch (error: unknown) {
      toast.error((error as Error).message || '保存音色失败')
    } finally {
      setSubmitting(false)
    }
  }

  const canSave = Boolean(newVoiceName.trim() && selectedAudioPath)

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        音色
        <span className="ml-1 text-[10px] text-muted-foreground/70">
          （可选，绑定角色）
        </span>
      </Label>

      {!adding ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <Select
                value={localVoiceType ?? ''}
                onChange={(value) => {
                  if (!value) {
                    onChange(undefined)
                    return
                  }
                  if (!value.startsWith(LOCAL_VOICE_PREFIX)) return
                  onChange(value)
                }}
                options={voiceOptions}
                disabled={loading}
                placeholder={loading ? '加载音色…' : '选择本地音色'}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1 border-border/60"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              {VOICE_LIBRARY_ADD_TRIGGER}
            </Button>
          </div>
          {selectedVoice ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground/80 truncate min-w-0">
                当前：{selectedVoice.name}
              </p>
              <button
                type="button"
                className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => onChange(undefined)}
              >
                清除绑定
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-3 space-y-3">
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">{VOICE_LIBRARY_ADD_TITLE}</p>
            <p className="text-[11px] text-muted-foreground">{VOICE_LIBRARY_SAVE_HINT}</p>
          </div>

          <Input
            value={newVoiceName}
            onChange={(e) => setNewVoiceName(e.target.value)}
            placeholder="音色名称（如：萧炎-愤怒）"
            className="bg-background/60"
          />

          <div className="flex items-center gap-2">
            <Input
              value={selectedAudioPath ? formatVoiceAudioPathLabel(selectedAudioPath) : ''}
              readOnly
              placeholder="未选择参考音频"
              className="flex-1 min-w-0 bg-background/60 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1 border-border/60"
              disabled={selectingAudio}
              onClick={() => void handleSelectAudio()}
            >
              {selectingAudio ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              选择
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground/80">
            仅支持 mp3/wav，时长 {VOICE_AUDIO_MIN_SEC}–{VOICE_AUDIO_MAX_SEC} 秒
          </p>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              className={cn(
                'gap-1.5 border-0',
                canSave
                  ? cn(WORKSHOP_AI_TOKENS.solid, 'text-white')
                  : 'bg-muted text-muted-foreground',
              )}
              disabled={!canSave || submitting}
              onClick={() => void handleSubmitNewVoice()}
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {VOICE_LIBRARY_SAVE_BUTTON}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-border/60"
              disabled={submitting}
              onClick={resetAddForm}
            >
              取消
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
