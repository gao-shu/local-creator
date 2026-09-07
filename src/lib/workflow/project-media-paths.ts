import {
  fromLocalImageUrl,
  isLocalImageUrl,
  isAbsoluteMediaPath,
  normalizeStoredMediaPath,
  resolveProjectMediaPath,
  toProjectRelativeMediaPath,
} from '@/lib/storage/media-path-resolver'
import {
  resolveProjectVoicePath,
  toProjectRelativeVoicePath,
} from '@/lib/voice/project-voice-library-paths'
import { isProjectShotVoiceRelativePath } from '@/lib/voice/global-voice-library-paths'
import type { WorkflowAsset, WorkflowProjectData, WorkflowShot } from '@/types/workflow'

function resolveStoredPathForRemap(value: string): string {
  const normalized = normalizeStoredMediaPath(value)
  if (isLocalImageUrl(normalized)) {
    return fromLocalImageUrl(normalized)
  }
  return normalized
}

function remapStringPath(
  value: string | undefined,
  projectRoot: string,
  mode: 'read' | 'write',
): string | undefined {
  if (!value) return value
  const normalized = resolveStoredPathForRemap(value)
  if (mode === 'write' && normalized.startsWith('data:')) {
    throw new Error('项目数据包含未落盘的图片，请重试保存')
  }
  return mode === 'read'
    ? resolveProjectMediaPath(normalized, projectRoot)
    : toProjectRelativeMediaPath(normalized, projectRoot)
}

function isProjectShotVoiceStoredPath(value: string): boolean {
  return isProjectShotVoiceRelativePath(value)
}

function remapAudioStoredPath(
  value: string | undefined,
  projectRoot: string,
  mode: 'read' | 'write',
): string | undefined {
  if (!value) return value
  const trimmed = normalizeStoredMediaPath(value)
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (isProjectShotVoiceStoredPath(trimmed)) {
    return mode === 'read'
      ? resolveProjectVoicePath(trimmed, projectRoot)
      : toProjectRelativeVoicePath(trimmed, projectRoot)
  }
  return remapStringPath(value, projectRoot, mode)
}

function remapAudioStoredList(
  values: string[] | undefined,
  projectRoot: string,
  mode: 'read' | 'write',
): string[] | undefined {
  if (!values?.length) return values
  return values.map((item) => remapAudioStoredPath(item, projectRoot, mode)!)
}

function remapStringList(
  values: string[] | undefined,
  projectRoot: string,
  mode: 'read' | 'write',
): string[] | undefined {
  if (!values?.length) return values
  return values.map((item) => {
    const normalized = normalizeStoredMediaPath(item)
    return mode === 'read'
      ? resolveProjectMediaPath(normalized, projectRoot)
      : toProjectRelativeMediaPath(normalized, projectRoot)
  })
}

function remapAssetPaths(
  asset: WorkflowAsset,
  projectRoot: string,
  mode: 'read' | 'write',
): WorkflowAsset {
  return {
    ...asset,
    referenceImagePath: remapStringPath(asset.referenceImagePath, projectRoot, mode),
    referenceImagePaths: remapStringList(asset.referenceImagePaths, projectRoot, mode),
    generatedImagePath: remapStringPath(asset.generatedImagePath, projectRoot, mode),
    generatedImagePaths: remapStringList(asset.generatedImagePaths, projectRoot, mode),
    reviewImagePath: remapStringPath(asset.reviewImagePath, projectRoot, mode),
  }
}

function remapShotPaths(
  shot: WorkflowShot,
  projectRoot: string,
  mode: 'read' | 'write',
): WorkflowShot {
  const weishiUploadedMedia = shot.weishiUploadedMedia?.length
    ? shot.weishiUploadedMedia.map((entry) => ({
        ...entry,
        localPath:
          remapStringPath(entry.localPath, projectRoot, mode) ?? entry.localPath,
      }))
    : shot.weishiUploadedMedia

  return {
    ...shot,
    referenceImagePath: remapStringPath(shot.referenceImagePath, projectRoot, mode),
    referenceImagePaths: remapStringList(shot.referenceImagePaths, projectRoot, mode),
    referenceAudioPaths: remapAudioStoredList(shot.referenceAudioPaths, projectRoot, mode),
    referenceAudioItems: shot.referenceAudioItems?.length
      ? shot.referenceAudioItems.map((item) => ({
          ...item,
          path: remapAudioStoredPath(item.path, projectRoot, mode) ?? item.path,
        }))
      : shot.referenceAudioItems,
    generatedImagePath: remapStringPath(shot.generatedImagePath, projectRoot, mode),
    generatedImagePaths: remapStringList(shot.generatedImagePaths, projectRoot, mode),
    generatedVideoPath: remapStringPath(shot.generatedVideoPath, projectRoot, mode),
    generatedVideoPaths: remapStringList(shot.generatedVideoPaths, projectRoot, mode),
    validatedImagePath: remapStringPath(shot.validatedImagePath, projectRoot, mode),
    validatedImagePaths: remapStringList(shot.validatedImagePaths, projectRoot, mode),
    weishiUploadedMedia,
  }
}

/** 修复 data.json 中误存为 http://roles/... 等媒体路径 */
export function repairProjectDataMediaPaths(data: WorkflowProjectData): {
  data: WorkflowProjectData
  changed: boolean
} {
  let changed = false

  const repairAsset = (asset: WorkflowAsset): WorkflowAsset => {
    const repair = (value?: string) => {
      if (!value) return value
      const next = normalizeStoredMediaPath(value)
      if (next !== value) changed = true
      return next
    }
    const repairList = (list?: string[]) => {
      if (!list?.length) return list
      return list.map((item) => repair(item)!)
    }
    return {
      ...asset,
      referenceImagePath: repair(asset.referenceImagePath),
      referenceImagePaths: repairList(asset.referenceImagePaths),
      generatedImagePath: repair(asset.generatedImagePath),
      generatedImagePaths: repairList(asset.generatedImagePaths),
    }
  }

  const repairShot = (shot: WorkflowShot): WorkflowShot => {
    const repair = (value?: string) => {
      if (!value) return value
      const next = normalizeStoredMediaPath(value)
      if (next !== value) changed = true
      return next
    }
    const repairList = (list?: string[]) => {
      if (!list?.length) return list
      return list.map((item) => repair(item)!)
    }
    return {
      ...shot,
      referenceImagePath: repair(shot.referenceImagePath),
      referenceImagePaths: repairList(shot.referenceImagePaths),
      referenceAudioPaths: repairList(shot.referenceAudioPaths),
      generatedImagePath: repair(shot.generatedImagePath),
      generatedImagePaths: repairList(shot.generatedImagePaths),
      generatedVideoPath: repair(shot.generatedVideoPath),
      generatedVideoPaths: repairList(shot.generatedVideoPaths),
      weishiUploadedMedia: shot.weishiUploadedMedia?.length
        ? shot.weishiUploadedMedia.map((entry) => ({
            ...entry,
            localPath: repair(entry.localPath)!,
          }))
        : shot.weishiUploadedMedia,
    }
  }

  return {
    data: {
      ...data,
      characters: data.characters.map(repairAsset),
      scenes: data.scenes.map(repairAsset),
      props: data.props.map(repairAsset),
      shots: data.shots.map(repairShot),
    },
    changed,
  }
}

/** 读取项目数据后，将媒体路径解析到当前项目目录 */
export function remapProjectDataMediaPathsForRead(
  data: WorkflowProjectData,
  projectRoot: string,
): WorkflowProjectData {
  return {
    ...data,
    characters: data.characters.map((item) => remapAssetPaths(item, projectRoot, 'read')),
    scenes: data.scenes.map((item) => remapAssetPaths(item, projectRoot, 'read')),
    props: data.props.map((item) => remapAssetPaths(item, projectRoot, 'read')),
    shots: data.shots.map((item) => remapShotPaths(item, projectRoot, 'read')),
  }
}

function collectMediaPathValues(
  data: WorkflowProjectData,
): string[] {
  const values: string[] = []
  const push = (value?: string) => {
    if (value) values.push(value)
  }
  const pushList = (list?: string[]) => {
    if (list?.length) values.push(...list)
  }

  for (const asset of [...data.characters, ...data.scenes, ...data.props]) {
    push(asset.referenceImagePath)
    pushList(asset.referenceImagePaths)
    push(asset.generatedImagePath)
    pushList(asset.generatedImagePaths)
  }
  for (const shot of data.shots) {
    push(shot.referenceImagePath)
    pushList(shot.referenceImagePaths)
    pushList(shot.referenceAudioPaths)
    push(shot.generatedImagePath)
    pushList(shot.generatedImagePaths)
    push(shot.generatedVideoPath)
    pushList(shot.generatedVideoPaths)
  }
  return values
}

/** 是否仍包含需迁移的绝对磁盘路径 */
export function projectDataHasLegacyAbsoluteMediaPaths(data: WorkflowProjectData): boolean {
  return collectMediaPathValues(data).some((value) => isAbsoluteMediaPath(value))
}

/** 写入项目数据前，将媒体路径存为项目内相对路径 */
export function remapProjectDataMediaPathsForWrite(
  data: WorkflowProjectData,
  projectRoot: string,
): WorkflowProjectData {
  return {
    ...data,
    characters: data.characters.map((item) => remapAssetPaths(item, projectRoot, 'write')),
    scenes: data.scenes.map((item) => remapAssetPaths(item, projectRoot, 'write')),
    props: data.props.map((item) => remapAssetPaths(item, projectRoot, 'write')),
    shots: data.shots.map((item) => remapShotPaths(item, projectRoot, 'write')),
  }
}
