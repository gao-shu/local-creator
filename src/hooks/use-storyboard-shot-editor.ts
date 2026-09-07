/**
 * Step4 分镜卡片 / 文案编辑窗：共享提示词、参考图、音色编辑逻辑
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useHoverImagePreview } from '@/components/workshop/hover-image-preview'
import { readImageAsDataUrl } from '@/lib/storage/fs-service'
import {
  adjustPrimaryAfterRemove,
  buildImageFieldsFromPaths,
  getGeneratedImagePaths,
  getReferenceImagePaths,
  getSelectedReferenceImageIndex,
} from '@/lib/workflow/asset-utils'
import {
  buildUploadedVoiceMentionCandidates,
  getReferenceAudioItems,
  removeShotReferenceAudioAt,
  buildShotVideoReferenceAudioItems,
} from '@/lib/workflow/shot-audio-reference-utils'
import {
  autoSyncShotReferencedAssets,
  shotAssetSyncEqual,
} from '@/lib/workflow/shot-asset-matcher'
import {
  resolveMentionCandidatesByIds,
  resolveMentionsInText,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'
import { isLocalVoiceType, resolveVoiceLabel, type VoiceLibraryEntry } from '@/types/voice-library'
import type { WorkflowAsset, WorkflowShot } from '@/types/workflow'

export interface UseStoryboardShotEditorOptions {
  shot: WorkflowShot
  mentionCandidates: MentionCandidate[]
  characters?: WorkflowAsset[]
  voiceLibrary?: VoiceLibraryEntry[]
  projectRoot?: string
  onChange: (patch: Partial<WorkflowShot>) => void
}

export function useStoryboardShotEditor({
  shot,
  mentionCandidates,
  characters = [],
  voiceLibrary = [],
  projectRoot,
  onChange,
}: UseStoryboardShotEditorOptions) {
  const refPaths = useMemo(() => getReferenceImagePaths(shot), [shot.referenceImagePath, shot.referenceImagePaths])

  const uploadedVoiceItems = useMemo(
    () => getReferenceAudioItems(shot),
    [shot.referenceAudioItems, shot.referenceAudioPaths],
  )

  const promptMentionCandidates = useMemo(
    () => [...mentionCandidates, ...buildUploadedVoiceMentionCandidates(shot)],
    [mentionCandidates, shot.referenceAudioItems, shot.referenceAudioPaths],
  )

  const boundVoiceDisplayItems = useMemo(() => {
    const mentionText = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
    const items: Array<{ label: string; mentionName: string; characterId: string }> = []
    const seen = new Set<string>()

    const pushBoundVoice = (characterId: string, mentionName: string) => {
      if (!characterId || seen.has(characterId)) return
      const asset = characters.find((item) => item.id === characterId)
      if (!asset?.voiceType || !isLocalVoiceType(asset.voiceType)) return
      seen.add(characterId)
      items.push({
        label: resolveVoiceLabel(asset.voiceType, voiceLibrary) || `${mentionName}的音色`,
        mentionName,
        characterId,
      })
    }

    for (const mention of resolveMentionsInText(mentionText, mentionCandidates)) {
      if (mention.kind !== 'character') continue
      pushBoundVoice(mention.id, mention.mentionName)
    }

    for (const candidate of resolveMentionCandidatesByIds(shot.referencedAssetIds ?? [], mentionCandidates)) {
      if (candidate.kind !== 'character') continue
      pushBoundVoice(candidate.id, candidate.mentionName)
    }

    return items
  }, [characters, mentionCandidates, shot.prompt, shot.referencedAssetIds, shot.spatialAnchor, voiceLibrary])

  const isCharacterVoiceInUse = useCallback(
    (characterId: string, mentionName: string) => {
      const mentionText = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
      if ((shot.referencedAssetIds ?? []).includes(characterId)) return true
      return resolveMentionsInText(mentionText, mentionCandidates).some(
        (item) => item.id === characterId || item.mentionName === mentionName,
      )
    },
    [mentionCandidates, shot.prompt, shot.referencedAssetIds, shot.spatialAnchor],
  )

  const activeVoiceAudioItems = useMemo(
    () =>
      buildShotVideoReferenceAudioItems(shot, {
        mentionCandidates: promptMentionCandidates,
        characters,
        voiceLibrary,
      }),
    [shot, promptMentionCandidates, characters, voiceLibrary],
  )

  const voiceUsedCount = useMemo(() => {
    let count = activeVoiceAudioItems.filter((item) => item.source === 'upload').length
    for (const item of boundVoiceDisplayItems) {
      if (isCharacterVoiceInUse(item.characterId, item.mentionName)) {
        count += 1
      }
    }
    return count
  }, [activeVoiceAudioItems, boundVoiceDisplayItems, isCharacterVoiceInUse])

  const voiceTotalCount = boundVoiceDisplayItems.length + uploadedVoiceItems.length

  const [refPreviewUrls, setRefPreviewUrls] = useState<string[]>([])
  const { preview: refHoverPreview, show: showRefPreview, hide: hideRefPreview } = useHoverImagePreview()

  useEffect(() => {
    let active = true
    const load = async () => {
      const urls = await Promise.all(
        refPaths.map(async (path) => (path ? await readImageAsDataUrl(path, projectRoot) : null)),
      )
      if (active) setRefPreviewUrls(urls.map((url) => url ?? ''))
    }
    void load()
    return () => {
      active = false
    }
  }, [refPaths, projectRoot])

  useEffect(() => {
    hideRefPreview()
  }, [refPaths, hideRefPreview])

  const assetSyncFingerprint = useMemo(
    () =>
      [
        shot.dialogue,
        shot.spatialAnchor,
        shot.prompt,
        (shot.referencedAssetIds ?? []).join(','),
      ].join('\u0001'),
    [shot.dialogue, shot.prompt, shot.referencedAssetIds, shot.spatialAnchor],
  )

  const mentionCandidatesFingerprint = useMemo(
    () => mentionCandidates.map((item) => `${item.id}:${item.mentionName}`).join('\u0001'),
    [mentionCandidates],
  )

  const shotRef = useRef(shot)
  shotRef.current = shot
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  /** 推理分镜 / 资产库就绪后，将提示词中的纯文本资产名自动转为 @引用 */
  useEffect(() => {
    if (!mentionCandidates.length) return
    const current = shotRef.current
    const synced = autoSyncShotReferencedAssets(current, mentionCandidates)
    if (shotAssetSyncEqual(current, synced)) return
    onChangeRef.current({
      dialogue: synced.dialogue,
      prompt: synced.prompt,
      spatialAnchor: synced.spatialAnchor,
      referencedAssetIds: synced.referencedAssetIds,
      updatedAt: synced.updatedAt,
    })
  }, [assetSyncFingerprint, mentionCandidates.length, mentionCandidatesFingerprint, mentionCandidates])

  const patchWithReferencedAssets = useCallback(
    (patch: Partial<WorkflowShot>) => {
      const merged = { ...shot, ...patch }
      const synced = autoSyncShotReferencedAssets(merged, mentionCandidates)
      onChange({
        ...patch,
        dialogue: synced.dialogue,
        prompt: synced.prompt,
        spatialAnchor: synced.spatialAnchor,
        referencedAssetIds: synced.referencedAssetIds,
        updatedAt: Date.now(),
      })
    },
    [mentionCandidates, onChange, shot],
  )

  const handlePromptChange = useCallback(
    (raw: string) => {
      const anchorMatch = raw.match(/^\[全局空间锚点:\s*([\s\S]*?)\]\s*\n?/)
      if (anchorMatch) {
        patchWithReferencedAssets({
          spatialAnchor: anchorMatch[1]?.trim() ?? '',
          prompt: raw.slice(anchorMatch[0].length),
        })
        return
      }
      if (raw.startsWith('[全局空间锚点:')) {
        patchWithReferencedAssets({
          spatialAnchor: raw.replace(/^\[全局空间锚点:\s*/, '').replace(/\]?$/, ''),
          prompt: '',
        })
        return
      }
      patchWithReferencedAssets({ prompt: raw })
    },
    [patchWithReferencedAssets],
  )

  const handleRemoveReferenceAt = useCallback(
    (index: number) => {
      hideRefPreview()
      const nextRefs = refPaths.filter((_, i) => i !== index)
      const nextSelected = adjustPrimaryAfterRemove(
        getSelectedReferenceImageIndex(shot, refPaths.length),
        index,
        nextRefs.length,
      )
      const imageFields = buildImageFieldsFromPaths(
        nextRefs,
        getGeneratedImagePaths(shot),
        shot.primaryGeneratedImageIndex ?? 0,
      )
      onChange({
        referenceImagePaths: imageFields.referenceImagePaths,
        referenceImagePath: imageFields.referenceImagePath,
        selectedReferenceImageIndex: nextRefs.length ? nextSelected : undefined,
        updatedAt: Date.now(),
      })
    },
    [hideRefPreview, onChange, refPaths, shot],
  )

  const handleSelectReference = useCallback(
    (index: number) => {
      onChange({ selectedReferenceImageIndex: index })
    },
    [onChange],
  )

  const handleRemoveAudioAt = useCallback(
    (index: number) => {
      onChange(removeShotReferenceAudioAt(shot, index))
    },
    [onChange, shot],
  )

  const handleDialogueChange = useCallback(
    (dialogue: string) => {
      patchWithReferencedAssets({ dialogue })
    },
    [patchWithReferencedAssets],
  )

  const promptText = useMemo(
    () =>
      [shot.spatialAnchor ? `[全局空间锚点: ${shot.spatialAnchor}]` : '', shot.prompt]
        .filter(Boolean)
        .join('\n'),
    [shot.prompt, shot.spatialAnchor],
  )

  return {
    refPaths,
    refPreviewUrls,
    promptMentionCandidates,
    boundVoiceDisplayItems,
    uploadedVoiceItems,
    activeVoiceAudioItems,
    voiceUsedCount,
    voiceTotalCount,
    refHoverPreview,
    showRefPreview,
    hideRefPreview,
    isCharacterVoiceInUse,
    promptText,
    handlePromptChange,
    handleDialogueChange,
    handleRemoveReferenceAt,
    handleSelectReference,
    handleRemoveAudioAt,
  }
}
