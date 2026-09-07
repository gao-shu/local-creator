// Copyright (c) Haode AI. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { AssetKind, WorkflowAsset, WorkflowProjectData, WorkflowShot } from '@/types/workflow'
import { importLocalImageToDir, saveDataUrlImage } from '@/lib/storage/fs-service'
import {
  fromLocalImageUrl,
  isAbsoluteMediaPath,
  isLocalImageUrl,
  isRemoteMediaReference,
  normalizeStoredMediaPath,
  toProjectRelativeMediaPath,
} from '@/lib/storage/media-path-resolver'
import {
  resolveProjectMediaDir,
  resolveProjectRoot,
  type ProjectMediaKind,
} from '@/lib/storage/project-paths'
import { toProjectRelativeVoicePath } from '@/lib/voice/project-voice-library-paths'
import { isProjectShotVoiceRelativePath } from '@/lib/voice/global-voice-library-paths'
import { joinPathSegments } from '@/lib/storage/storage-path-utils'

export type ProjectMediaTarget = AssetKind | 'shot' | 'cover'
export type ProjectMediaPurpose = 'ref' | 'gen'

export interface SaveProjectMediaOptions {
  settings: AppSettings
  appDataDir: string
  projectId: string
  dataUrl: string
  entityId: string
  target: ProjectMediaTarget
  purpose: ProjectMediaPurpose
  /** 覆盖默认 purpose 前缀，如 upload_ref / screenshot_ref */
  nameTag?: string
  ext?: string
}

function inferImageExt(dataUrl: string): string {
  const match = String(dataUrl || '').match(/^data:image\/([\w+.-]+);/i)
  if (!match) return '.jpg'
  const type = match[1].toLowerCase()
  if (type === 'jpeg') return '.jpg'
  if (type === 'svg+xml') return '.svg'
  return `.${type.split('+')[0]}`
}

function buildMediaFilename(
  purpose: ProjectMediaPurpose,
  entityId: string,
  ext: string,
  nameTag?: string,
): string {
  const safeId = String(entityId || 'media').replace(/[^a-zA-Z0-9_-]/g, '_')
  const tag = nameTag?.trim() || purpose
  return `${tag}_${safeId}_${Date.now()}${ext}`
}

function resolveMediaKind(target: ProjectMediaTarget): ProjectMediaKind | null {
  if (target === 'cover') return null
  if (target === 'character') return 'character'
  if (target === 'scene') return 'scene'
  if (target === 'prop') return 'prop'
  if (target === 'shot') return 'shot'
  return null
}

/** 将 data URL 落盘到项目目录，返回项目内相对路径 */
export async function saveProjectMediaFromDataUrl(
  options: SaveProjectMediaOptions,
): Promise<string> {
  const trimmed = String(options.dataUrl || '').trim()
  if (!trimmed) {
    throw new Error('缺少图片数据')
  }

  const projectRoot = resolveProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )

  const ext = options.ext ?? inferImageExt(trimmed)
  const filename =
    options.target === 'cover'
      ? 'cover.jpg'
      : buildMediaFilename(options.purpose, options.entityId, ext, options.nameTag)

  const mediaKind = resolveMediaKind(options.target)
  const saveDir =
    mediaKind === null
      ? projectRoot
      : resolveProjectMediaDir(
          options.settings,
          options.appDataDir,
          options.projectId,
          mediaKind,
        )

  const saved = await saveDataUrlImage(trimmed, { targetDir: saveDir, filename })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '保存图片到项目目录失败')
  }

  const filePath = saved.filePath
  if (filePath.startsWith('data:') || isRemoteMediaReference(filePath)) {
    throw new Error('图片未能保存到本地项目目录，请检查数据根目录权限')
  }

  return toProjectRelativeMediaPath(filePath, projectRoot)
}

/** 将本地图片文件复制到项目目录，返回项目内相对路径 */
export async function saveProjectMediaFromLocalFile(
  options: Omit<SaveProjectMediaOptions, 'dataUrl'> & { sourcePath: string },
): Promise<string> {
  const sourcePath = String(options.sourcePath || '').trim()
  if (!sourcePath) {
    throw new Error('缺少图片文件')
  }

  const projectRoot = resolveProjectRoot(
    options.settings,
    options.appDataDir,
    options.projectId,
  )

  const extMatch = sourcePath.match(/\.(png|jpe?g|webp|gif)$/i)
  const ext = options.ext ?? (extMatch ? extMatch[0].toLowerCase() : '.jpg')
  const filename =
    options.target === 'cover'
      ? 'cover.jpg'
      : buildMediaFilename(options.purpose, options.entityId, ext, options.nameTag)

  const mediaKind = resolveMediaKind(options.target)
  const saveDir =
    mediaKind === null
      ? projectRoot
      : resolveProjectMediaDir(
          options.settings,
          options.appDataDir,
          options.projectId,
          mediaKind,
        )

  const saved = await importLocalImageToDir({
    sourcePath,
    targetDir: saveDir,
    filename,
  })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '保存图片到项目目录失败')
  }

  const filePath = saved.filePath
  if (filePath.startsWith('data:') || isRemoteMediaReference(filePath)) {
    throw new Error('图片未能保存到本地项目目录，请检查数据根目录权限')
  }

  return toProjectRelativeMediaPath(filePath, projectRoot)
}

export async function readFilesAsDataUrls(files: File[]): Promise<string[]> {
  const readers = files.map(
    (file) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result || ''))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      }),
  )
  const results = await Promise.all(readers)
  return results.filter(Boolean)
}

/** 批量上传本地文件到项目媒体目录 */
export async function saveProjectMediaFromFiles(
  files: File[],
  options: Omit<SaveProjectMediaOptions, 'dataUrl'>,
): Promise<string[]> {
  const dataUrls = await readFilesAsDataUrls(files)
  const paths: string[] = []
  for (const dataUrl of dataUrls) {
    paths.push(await saveProjectMediaFromDataUrl({ ...options, dataUrl }))
  }
  return paths
}

function isInlineDataUrl(value: string): boolean {
  return normalizeStoredMediaPath(value).startsWith('data:')
}

async function normalizePathForWorkflowWrite(
  storedPath: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
    entityId: string
    target: ProjectMediaTarget
    purpose: ProjectMediaPurpose
  },
): Promise<string> {
  const text = normalizeStoredMediaPath(storedPath)
  if (!text) return text

  if (isInlineDataUrl(text)) {
    return saveProjectMediaFromDataUrl({
      settings: options.settings,
      appDataDir: options.appDataDir,
      projectId: options.projectId,
      dataUrl: text,
      entityId: options.entityId,
      target: options.target,
      purpose: options.purpose,
    })
  }

  const projectRoot = resolveProjectRoot(options.settings, options.appDataDir, options.projectId)
  if (isLocalImageUrl(text)) {
    return toProjectRelativeMediaPath(fromLocalImageUrl(text), projectRoot)
  }

  return text
}

async function normalizePathListForWorkflowWrite(
  paths: string[] | undefined,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
    entityId: string
    target: ProjectMediaTarget
    purpose: ProjectMediaPurpose
  },
): Promise<string[] | undefined> {
  if (!paths?.length) return paths
  return Promise.all(
    paths.map((item) => normalizePathForWorkflowWrite(item, options)),
  )
}

async function remapAudioPathForWrite(
  storedPath: string,
  options: { settings: AppSettings; appDataDir: string; projectId: string },
): Promise<string> {
  const text = normalizeStoredMediaPath(storedPath)
  if (!text || /^https?:\/\//i.test(text)) return text
  const projectRoot = resolveProjectRoot(options.settings, options.appDataDir, options.projectId)
  const normalized = text.replace(/\\/g, '/')
  if (isProjectShotVoiceRelativePath(normalized) || (isAbsoluteMediaPath(text) && /voices\/shot_/i.test(normalized))) {
    const absolute = isAbsoluteMediaPath(text) ? text : joinPathSegments(projectRoot, normalized)
    return toProjectRelativeVoicePath(absolute, projectRoot)
  }
  return text
}

async function remapAudioPathListForWrite(
  paths: string[] | undefined,
  options: { settings: AppSettings; appDataDir: string; projectId: string },
): Promise<string[] | undefined> {
  if (!paths?.length) return paths
  return Promise.all(paths.map((item) => remapAudioPathForWrite(item, options)))
}

async function sanitizeAssetMediaForWrite(
  asset: WorkflowAsset,
  options: { settings: AppSettings; appDataDir: string; projectId: string },
): Promise<WorkflowAsset> {
  const base = {
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    entityId: asset.id,
    target: asset.kind,
  }

  const referenceImagePaths = await normalizePathListForWorkflowWrite(asset.referenceImagePaths, {
    ...base,
    purpose: 'ref',
  })
  const generatedImagePaths = await normalizePathListForWorkflowWrite(asset.generatedImagePaths, {
    ...base,
    purpose: 'gen',
  })

  const referenceImagePath = asset.referenceImagePath
    ? await normalizePathForWorkflowWrite(asset.referenceImagePath, { ...base, purpose: 'ref' })
    : asset.referenceImagePath
  const generatedImagePath = asset.generatedImagePath
    ? await normalizePathForWorkflowWrite(asset.generatedImagePath, { ...base, purpose: 'gen' })
    : asset.generatedImagePath

  return {
    ...asset,
    referenceImagePath,
    referenceImagePaths,
    generatedImagePath,
    generatedImagePaths,
  }
}

async function sanitizeShotMediaForWrite(
  shot: WorkflowShot,
  options: { settings: AppSettings; appDataDir: string; projectId: string },
): Promise<WorkflowShot> {
  const base = {
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    entityId: shot.id,
    target: 'shot' as const,
  }

  const referenceImagePaths = await normalizePathListForWorkflowWrite(shot.referenceImagePaths, {
    ...base,
    purpose: 'ref',
  })
  const generatedImagePaths = await normalizePathListForWorkflowWrite(shot.generatedImagePaths, {
    ...base,
    purpose: 'gen',
  })
  const generatedVideoPaths = await normalizePathListForWorkflowWrite(shot.generatedVideoPaths, {
    ...base,
    purpose: 'gen',
  })

  const referenceImagePath = shot.referenceImagePath
    ? await normalizePathForWorkflowWrite(shot.referenceImagePath, { ...base, purpose: 'ref' })
    : shot.referenceImagePath
  const generatedImagePath = shot.generatedImagePath
    ? await normalizePathForWorkflowWrite(shot.generatedImagePath, { ...base, purpose: 'gen' })
    : shot.generatedImagePath
  const generatedVideoPath = shot.generatedVideoPath
    ? await normalizePathForWorkflowWrite(shot.generatedVideoPath, { ...base, purpose: 'gen' })
    : shot.generatedVideoPath
  const referenceAudioPaths = await remapAudioPathListForWrite(shot.referenceAudioPaths, base)
  const referenceAudioItems = shot.referenceAudioItems?.length
    ? await Promise.all(
        shot.referenceAudioItems.map(async (item) => ({
          ...item,
          path: await remapAudioPathForWrite(item.path, base),
        })),
      )
    : shot.referenceAudioItems

  return {
    ...shot,
    referenceImagePath,
    referenceImagePaths,
    generatedImagePath,
    generatedImagePaths,
    generatedVideoPath,
    generatedVideoPaths,
    referenceAudioPaths,
    referenceAudioItems,
  }
}

/** 写入前将 data URL / local-image 路径落盘或转为项目相对路径，避免保存失败 */
export async function sanitizeWorkflowDataMediaForWrite(
  data: WorkflowProjectData,
  options: { settings: AppSettings; appDataDir: string; projectId: string },
): Promise<WorkflowProjectData> {
  if (!options.settings.dataRootPath?.trim()) {
    throw new Error('请先在系统设置中配置数据根目录')
  }

  const [characters, scenes, props, shots] = await Promise.all([
    Promise.all(data.characters.map((item) => sanitizeAssetMediaForWrite(item, options))),
    Promise.all(data.scenes.map((item) => sanitizeAssetMediaForWrite(item, options))),
    Promise.all(data.props.map((item) => sanitizeAssetMediaForWrite(item, options))),
    Promise.all(data.shots.map((item) => sanitizeShotMediaForWrite(item, options))),
  ])

  return { ...data, characters, scenes, props, shots }
}
