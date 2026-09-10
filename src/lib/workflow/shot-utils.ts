import type { WorkflowEpisode, WorkflowProjectData, WorkflowShot } from '@/types/workflow'
import { filterAssetsByEpisode } from '@/lib/workflow/asset-utils'
import {
  buildImageFieldsFromPaths,
  getPrimaryGeneratedImagePath,
} from '@/lib/workflow/asset-utils'
import { buildVideoFieldsFromPaths } from '@/lib/workflow/shot-video-utils'
import {
  buildMentionCandidates,
  syncReferencedAssetIdsFromMentions,
  type MentionCandidate,
} from '@/lib/workflow/mention-utils'
import { generateUUID } from '@/lib/utils'

export function normalizeShot(raw: unknown, episode?: WorkflowEpisode): WorkflowShot | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const refPaths = Array.isArray(row.referenceImagePaths)
    ? row.referenceImagePaths.map((p) => String(p)).filter(Boolean)
    : Array.isArray(row.referenceImages)
      ? row.referenceImages.map((p) => String(p)).filter(Boolean)
      : row.referenceImagePath
        ? [String(row.referenceImagePath)]
        : row.referenceImage
          ? [String(row.referenceImage)]
          : []
  const genPaths = Array.isArray(row.generatedImagePaths)
    ? row.generatedImagePaths.map((p) => String(p)).filter(Boolean)
    : row.generatedImagePath
      ? [String(row.generatedImagePath)]
      : []
  const primaryGenIdx =
    typeof row.primaryGeneratedImageIndex === 'number' ? row.primaryGeneratedImageIndex : 0
  const validatedImagePaths = Array.isArray(row.validatedImagePaths)
    ? row.validatedImagePaths.map((p) => String(p)).filter(Boolean)
    : row.validatedImagePath
      ? [String(row.validatedImagePath)]
      : undefined
  const legacyValidated = Boolean(row.validated)
  // 旧数据 validated=true 但未记录路径时，绑定到当时的主分镜图
  const migratedValidatedPaths =
    validatedImagePaths?.length
      ? validatedImagePaths
      : legacyValidated && genPaths.length
        ? [genPaths[Math.min(Math.max(0, primaryGenIdx), genPaths.length - 1)]]
        : undefined
  const videoPaths = Array.isArray(row.generatedVideoPaths)
    ? row.generatedVideoPaths.map((p) => String(p)).filter(Boolean)
    : row.generatedVideoPath
      ? [String(row.generatedVideoPath)]
      : []

  const shotNumber = Number(row.shotNumber ?? row.shot_number ?? 0)
  if (!shotNumber) return null

  return {
    id: String(row.id || `shot_${generateUUID()}`),
    episodeId: String(row.episodeId || episode?.id || ''),
    episodeIndex: Number(row.episodeIndex ?? episode?.episodeIndex ?? 1),
    shotNumber,
    dialogue: String(row.dialogue || row.title || '').trim(),
    prompt: String(row.prompt || row.description || row.content || '').trim(),
    sound: row.sound ? String(row.sound) : undefined,
    remark: row.remark ? String(row.remark) : undefined,
    spatialAnchor: row.spatialAnchor
      ? String(row.spatialAnchor)
      : row.spatial_anchor
        ? String(row.spatial_anchor)
        : undefined,
    referencedAssetIds: Array.isArray(row.referencedAssetIds)
      ? row.referencedAssetIds.map((id) => String(id)).filter(Boolean)
      : Array.isArray(row.referenced_asset_ids)
        ? row.referenced_asset_ids.map((id) => String(id)).filter(Boolean)
        : undefined,
    validated: legacyValidated || Boolean(migratedValidatedPaths?.length),
    validatedImagePaths: migratedValidatedPaths?.length ? migratedValidatedPaths : undefined,
    validatedImagePath: row.validatedImagePath
      ? String(row.validatedImagePath)
      : migratedValidatedPaths?.length === 1
        ? migratedValidatedPaths[0]
        : undefined,
    ...buildImageFieldsFromPaths(
      refPaths,
      genPaths,
      primaryGenIdx,
    ),
    selectedReferenceImageIndex:
      typeof row.selectedReferenceImageIndex === 'number'
        ? row.selectedReferenceImageIndex
        : undefined,
    status: (row.status as WorkflowShot['status']) || 'draft',
    ...buildVideoFieldsFromPaths(
      videoPaths,
      typeof row.primaryGeneratedVideoIndex === 'number' ? row.primaryGeneratedVideoIndex : 0,
    ),
    videoStatus: (row.videoStatus as WorkflowShot['videoStatus']) || undefined,
    videoValidated: row.videoValidated != null ? Boolean(row.videoValidated) : undefined,
    referenceAudioPaths: Array.isArray(row.referenceAudioPaths)
      ? row.referenceAudioPaths.map((p) => String(p)).filter(Boolean)
      : undefined,
    referenceAudioItems: Array.isArray(row.referenceAudioItems)
      ? row.referenceAudioItems
          .map((entry) => {
            if (!entry || typeof entry !== 'object') return null
            const rowEntry = entry as Record<string, unknown>
            const path = String(rowEntry.path || rowEntry.url || rowEntry.audioUrl || '').trim()
            const name = String(rowEntry.name || rowEntry.label || '').trim()
            if (!path) return null
            return { path, name: name || path }
          })
          .filter((item): item is NonNullable<typeof item> => item != null)
      : undefined,
    updatedAt: Number(row.updatedAt) || Date.now(),
  }
}

export function normalizeShotList(raw: unknown, episode?: WorkflowEpisode): WorkflowShot[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => normalizeShot(item, episode))
    .filter((item): item is WorkflowShot => item != null)
    .sort((a, b) => a.shotNumber - b.shotNumber)
}

export function getShotsForEpisode(shots: WorkflowShot[], episodeId: string): WorkflowShot[] {
  return shots
    .filter((s) => s.episodeId === episodeId)
    .sort((a, b) => a.shotNumber - b.shotNumber)
}

export function getShotPreviewPath(shot: WorkflowShot): string | undefined {
  return getPrimaryGeneratedImagePath(shot as Parameters<typeof getPrimaryGeneratedImagePath>[0])
}

export function updateShotList(
  shots: WorkflowShot[],
  shotId: string,
  patch: Partial<WorkflowShot>,
): WorkflowShot[] {
  return shots.map((shot) =>
    shot.id === shotId ? { ...shot, ...patch, updatedAt: Date.now() } : shot,
  )
}

export function findWorkflowShot(
  shots: WorkflowShot[],
  shotId: string,
): WorkflowShot | undefined {
  return shots.find((shot) => shot.id === shotId)
}

/** 删除当前选中分镜时，优先保留相邻分镜选中，避免回退到第 1 镜并触发滚动 */
export function resolveSelectedShotAfterDelete(
  shots: WorkflowShot[],
  deletedShotId: string,
  currentSelectedId: string | null,
): string | null {
  if (currentSelectedId !== deletedShotId) return currentSelectedId

  const target = shots.find((s) => s.id === deletedShotId)
  if (!target) return currentSelectedId

  const episodeShots = getShotsForEpisode(shots, target.episodeId)
  const idx = episodeShots.findIndex((s) => s.id === deletedShotId)
  if (idx < 0) return null

  if (idx > 0) return episodeShots[idx - 1].id
  if (idx < episodeShots.length - 1) return episodeShots[idx + 1].id
  return null
}

/** 删除分镜后按顺序重新编号（同集内 12→11、13→12） */
export function removeShotFromList(shots: WorkflowShot[], shotId: string): WorkflowShot[] {
  const target = shots.find((s) => s.id === shotId)
  if (!target) return shots

  const filtered = shots.filter((s) => s.id !== shotId)
  const episodeShots = getShotsForEpisode(filtered, target.episodeId)
  const renumbered = episodeShots.map((s, i) => {
    const shotNumber = i + 1
    const prevDefault = `镜头 ${s.shotNumber}`
    const dialogue = s.dialogue === prevDefault ? `镜头 ${shotNumber}` : s.dialogue
    if (s.shotNumber === shotNumber && dialogue === s.dialogue) return s
    return { ...s, shotNumber, dialogue, updatedAt: Date.now() }
  })
  return replaceEpisodeShots(filtered, target.episodeId, renumbered)
}

export function replaceEpisodeShots(
  allShots: WorkflowShot[],
  episodeId: string,
  episodeShots: WorkflowShot[],
): WorkflowShot[] {
  const others = allShots.filter((s) => s.episodeId !== episodeId)
  return [...others, ...episodeShots].sort(
    (a, b) => a.episodeIndex - b.episodeIndex || a.shotNumber - b.shotNumber,
  )
}

export function createEmptyShot(episode: WorkflowEpisode, shotNumber: number): WorkflowShot {
  return {
    id: `shot_${generateUUID()}`,
    episodeId: episode.id,
    episodeIndex: episode.episodeIndex,
    shotNumber,
    dialogue: `镜头 ${shotNumber}`,
    prompt: '',
    status: 'draft',
    updatedAt: Date.now(),
  }
}

export function appendShot(
  shots: WorkflowShot[],
  episode: WorkflowEpisode,
): WorkflowShot[] {
  const episodeShots = getShotsForEpisode(shots, episode.id)
  const nextNum = episodeShots.length
    ? Math.max(...episodeShots.map((s) => s.shotNumber)) + 1
    : 1
  return [...shots, createEmptyShot(episode, nextNum)]
}

/** 在指定分镜后插入新镜，并重新编号 */
export function insertShotAfter(
  shots: WorkflowShot[],
  episode: WorkflowEpisode,
  afterShotId: string | null,
): WorkflowShot[] {
  const episodeShots = getShotsForEpisode(shots, episode.id)
  let insertAt = episodeShots.length
  if (afterShotId) {
    const idx = episodeShots.findIndex((s) => s.id === afterShotId)
    if (idx >= 0) insertAt = idx + 1
  }
  const nextEpisodeShots = [...episodeShots]
  nextEpisodeShots.splice(insertAt, 0, createEmptyShot(episode, 0))
  const renumbered = nextEpisodeShots.map((s, i) => ({ ...s, shotNumber: i + 1 }))
  return replaceEpisodeShots(shots, episode.id, renumbered)
}

export function collectEpisodeAssets(data: WorkflowProjectData, episode: WorkflowEpisode) {
  return {
    characters: filterAssetsByEpisode(data.characters ?? [], episode, 'character'),
    scenes: filterAssetsByEpisode(data.scenes ?? [], episode, 'scene'),
    props: filterAssetsByEpisode(data.props ?? [], episode, 'prop'),
  }
}

/** 将提示词中的 @ 引用同步到分镜参考内容（referencedAssetIds） */
export function syncShotReferencedAssets(
  shot: WorkflowShot,
  candidates: MentionCandidate[],
): WorkflowShot {
  const mentionText = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
  const referencedAssetIds = syncReferencedAssetIdsFromMentions(mentionText, candidates)
  return {
    ...shot,
    referencedAssetIds: referencedAssetIds.length ? referencedAssetIds : undefined,
  }
}

export function syncEpisodeShotsReferencedAssets(
  shots: WorkflowShot[],
  data: WorkflowProjectData,
  episode: WorkflowEpisode,
): WorkflowShot[] {
  const candidates = buildMentionCandidates(collectEpisodeAssets(data, episode))
  return shots.map((shot) =>
    shot.episodeId === episode.id ? syncShotReferencedAssets(shot, candidates) : shot,
  )
}

/** 资产全量替换后，按 @ 提及重新绑定分镜引用 ID */
export function syncProjectShotsReferencedAssets(
  shots: WorkflowShot[],
  data: Pick<WorkflowProjectData, 'characters' | 'scenes' | 'props'>,
): WorkflowShot[] {
  const candidates = buildMentionCandidates({
    characters: data.characters ?? [],
    scenes: data.scenes ?? [],
    props: data.props ?? [],
  })
  return shots.map((shot) => syncShotReferencedAssets(shot, candidates))
}

export interface AssetShotReference {
  shot: WorkflowShot
  episodeTitle: string
  episodeIndex: number
}

/** 查找引用指定资产的分镜（含 referencedAssetIds 与提示词 @ 引用） */
export function findShotsReferencingAsset(
  data: Pick<WorkflowProjectData, 'shots' | 'episodes' | 'characters' | 'scenes' | 'props'>,
  assetId: string,
): AssetShotReference[] {
  const shots = data.shots ?? []
  if (!shots.length || !assetId) return []

  const candidates = buildMentionCandidates({
    characters: data.characters ?? [],
    scenes: data.scenes ?? [],
    props: data.props ?? [],
  })
  const episodeById = new Map((data.episodes ?? []).map((ep) => [ep.id, ep]))
  const seen = new Set<string>()
  const results: AssetShotReference[] = []

  for (const shot of shots) {
    const byId = shot.referencedAssetIds?.includes(assetId)
    const mentionText = [shot.spatialAnchor, shot.prompt].filter(Boolean).join('\n')
    const byMention = syncReferencedAssetIdsFromMentions(mentionText, candidates).includes(assetId)
    if (!byId && !byMention) continue
    if (seen.has(shot.id)) continue
    seen.add(shot.id)

    const episode = episodeById.get(shot.episodeId)
    results.push({
      shot,
      episodeTitle: episode?.title?.trim() || `第${shot.episodeIndex}集`,
      episodeIndex: shot.episodeIndex,
    })
  }

  return results.sort(
    (a, b) => a.episodeIndex - b.episodeIndex || a.shot.shotNumber - b.shot.shotNumber,
  )
}

export function getAssetDeleteConfirmContent(
  refs: AssetShotReference[],
  assetName?: string,
): { title: string; description: string } {
  const label = assetName?.trim()
  const title = label ? `删除「${label}」` : '删除资产'

  if (!refs.length) {
    return {
      title,
      description: '此资产将从整部剧中移除，且不可恢复。',
    }
  }

  const preview = refs
    .slice(0, 3)
    .map((ref) => `${ref.episodeTitle} · 镜头 ${ref.shot.shotNumber}`)
    .join('、')
  const suffix = refs.length > 3 ? ` 等 ${refs.length} 个镜头` : ''

  return {
    title,
    description: `该资产已被分镜引用（${preview}${suffix}）。删除后将从相关镜头中移除引用，且不可恢复。`,
  }
}

/** @deprecated 使用 getAssetDeleteConfirmContent */
export function formatAssetDeleteConfirmMessage(refs: AssetShotReference[]): string {
  const { description } = getAssetDeleteConfirmContent(refs)
  return description
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function stripMentionFromText(text: string, mentionName: string): string {
  const name = mentionName.trim()
  if (!text || !name) return text
  const escaped = escapeRegExp(name)
  return text
    .replace(/\uFF20/g, '@')
    .replace(new RegExp(`@${escaped}`, 'g'), name)
    .replace(/[ \t]{2,}/g, ' ')
}

/** 删除资产时，从分镜中移除 ID 引用与 @ 提及 */
export function stripAssetFromShots(
  shots: WorkflowShot[],
  assetId: string,
  mentionName?: string,
): WorkflowShot[] {
  const name = mentionName?.trim()
  return shots.map((shot) => {
    const nextIds = shot.referencedAssetIds?.filter((id) => id !== assetId)
    const prompt = name ? stripMentionFromText(shot.prompt, name) : shot.prompt
    const spatialAnchor = name && shot.spatialAnchor
      ? stripMentionFromText(shot.spatialAnchor, name)
      : shot.spatialAnchor

    const idsChanged = (shot.referencedAssetIds?.length ?? 0) !== (nextIds?.length ?? 0)
    const textChanged = prompt !== shot.prompt || spatialAnchor !== shot.spatialAnchor
    if (!idsChanged && !textChanged) return shot

    return {
      ...shot,
      prompt,
      spatialAnchor: spatialAnchor?.trim() || undefined,
      referencedAssetIds: nextIds?.length ? nextIds : undefined,
      updatedAt: Date.now(),
    }
  })
}

export const SHOT_STORYBOARD_IMAGE_GENERATED_LABEL = '分镜图已生成'
export const SHOT_STORYBOARD_IMAGE_FAILED_LABEL = '分镜图生成失败'

/** 单张分镜图生成成功 toast / 任务文案 */
export function formatShotStoryboardImageGeneratedToast(
  shot: Pick<WorkflowShot, 'shotNumber'>,
): string {
  return `镜号 ${shot.shotNumber}：${SHOT_STORYBOARD_IMAGE_GENERATED_LABEL}`
}

/** 单张分镜图生成失败 toast / 任务文案 */
export function formatShotStoryboardImageFailedToast(
  shot: Pick<WorkflowShot, 'shotNumber'>,
  errorMessage?: string,
): string {
  const base = `镜号 ${shot.shotNumber}：${SHOT_STORYBOARD_IMAGE_FAILED_LABEL}`
  return withGenerationToastErrorDetail(base, errorMessage)
}

export const SHOT_VIDEO_GENERATED_LABEL = '视频生成完成'
export const SHOT_VIDEO_FAILED_LABEL = '视频生成失败'

function withGenerationToastErrorDetail(base: string, errorMessage?: string): string {
  const detail = errorMessage?.trim()
  if (!detail || detail === base || base.endsWith(`：${detail}`)) return base
  return `${base}（${detail}）`
}

/** 单镜视频生成成功 toast / 任务文案 */
export function formatShotVideoGeneratedToast(
  shot: Pick<WorkflowShot, 'shotNumber'>,
): string {
  return `镜号 ${shot.shotNumber}：${SHOT_VIDEO_GENERATED_LABEL}`
}

/** 单镜视频生成失败 toast / 任务文案 */
export function formatShotVideoFailedToast(
  shot: Pick<WorkflowShot, 'shotNumber'>,
  errorMessage?: string,
): string {
  const base = `镜号 ${shot.shotNumber}：${SHOT_VIDEO_FAILED_LABEL}`
  return withGenerationToastErrorDetail(base, errorMessage)
}

export function formatShotNumberList(
  shots: Array<Pick<WorkflowShot, 'shotNumber'>>,
  maxNames = 4,
): string {
  if (!shots.length) return ''
  const nums = shots.map((shot) => shot.shotNumber)
  if (nums.length === 1) return `镜号 ${nums[0]}`
  if (nums.length <= maxNames) return nums.map((num) => `镜号 ${num}`).join('、')
  return `${nums.slice(0, maxNames).map((num) => `镜号 ${num}`).join('、')} 等 ${nums.length} 个`
}

export function formatBatchShotVideoToast(
  successShots: Array<Pick<WorkflowShot, 'shotNumber'>>,
  failedShots: Array<Pick<WorkflowShot, 'shotNumber'>>,
): string {
  const prefix = '批量生成视频完成'
  if (failedShots.length === 0) {
    return `${prefix}：${formatShotNumberList(successShots)}`
  }
  if (successShots.length > 0) {
    return `${prefix}：成功 ${formatShotNumberList(successShots)}，失败 ${formatShotNumberList(failedShots)}`
  }
  return `批量生成视频失败：${formatShotNumberList(failedShots)}`
}
