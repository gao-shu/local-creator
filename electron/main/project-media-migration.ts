import path from 'node:path'
import fs from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import type { WorkflowAsset, WorkflowProjectData, WorkflowShot } from '../../src/types/workflow'
import { PROJECT_MEDIA_FOLDERS } from '../../src/lib/storage/project-paths'
import {
  isRemoteMediaReference,
  normalizeRemoteMediaUrl,
  normalizeStoredMediaPath,
  toProjectRelativeMediaPath,
} from '../../src/lib/storage/media-path-resolver'

async function fetchAsBuffer(source: string): Promise<Buffer> {
  const trimmed = String(source || '').trim()
  if (trimmed.startsWith('data:')) {
    const base64 = trimmed.split(',')[1] || ''
    return Buffer.from(base64, 'base64')
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const res = await fetch(trimmed)
    if (!res.ok) throw new Error(`下载图片失败 (${res.status})`)
    return Buffer.from(await res.arrayBuffer())
  }
  return fs.readFile(trimmed)
}

function inferImageExt(source: string): string {
  try {
    const pathname = new URL(normalizeRemoteMediaUrl(source)).pathname
    const match = pathname.match(/\.(png|jpe?g|webp|gif)$/i)
    if (match) return match[0].toLowerCase()
  } catch {
    /* ignore */
  }
  return '.png'
}

/** 需要落盘的远程媒体（排除 data URL / preview / 项目相对路径） */
function shouldPersistRemoteMedia(value: string): boolean {
  const text = normalizeStoredMediaPath(value)
  if (!text || text.startsWith('data:') || text.startsWith('preview:')) return false
  if (text.startsWith('local-image:')) return false
  return isRemoteMediaReference(text)
}

function shouldPersistDataUrlMedia(value: string): boolean {
  return normalizeStoredMediaPath(value).startsWith('data:')
}

async function persistDataUrlMediaToProject(
  dataUrl: string,
  projectRoot: string,
  folder: string,
): Promise<string> {
  const dir = path.join(projectRoot, folder)
  await fs.mkdir(dir, { recursive: true })
  const filename = `inline_${randomUUID()}${inferImageExt(dataUrl)}`
  const filePath = path.join(dir, filename)
  const buffer = await fetchAsBuffer(dataUrl)
  await fs.writeFile(filePath, buffer)
  return toProjectRelativeMediaPath(filePath, projectRoot)
}

async function persistRemoteMediaToProject(
  remoteSource: string,
  projectRoot: string,
  folder: string,
): Promise<string> {
  const dir = path.join(projectRoot, folder)
  await fs.mkdir(dir, { recursive: true })
  const filename = `gen_${randomUUID()}${inferImageExt(remoteSource)}`
  const filePath = path.join(dir, filename)
  const buffer = await fetchAsBuffer(normalizeRemoteMediaUrl(remoteSource))
  await fs.writeFile(filePath, buffer)
  return toProjectRelativeMediaPath(filePath, projectRoot)
}

async function migratePathList(
  values: string[] | undefined,
  projectRoot: string,
  folder: string,
): Promise<{ values?: string[]; changed: boolean }> {
  if (!values?.length) return { values, changed: false }
  let changed = false
  const next = await Promise.all(
    values.map(async (item) => {
      if (shouldPersistDataUrlMedia(item)) {
        try {
          const local = await persistDataUrlMediaToProject(item, projectRoot, folder)
          changed = true
          return local
        } catch {
          return item
        }
      }
      if (!shouldPersistRemoteMedia(item)) return item
      try {
        const local = await persistRemoteMediaToProject(item, projectRoot, folder)
        changed = true
        return local
      } catch {
        return item
      }
    }),
  )
  return { values: next, changed }
}

async function migrateAssetPaths(
  asset: WorkflowAsset,
  projectRoot: string,
): Promise<{ asset: WorkflowAsset; changed: boolean }> {
  const folder = PROJECT_MEDIA_FOLDERS[asset.kind]
  const ref = await migratePathList(asset.referenceImagePaths, projectRoot, folder)
  const gen = await migratePathList(asset.generatedImagePaths, projectRoot, folder)
  let referenceImagePath = asset.referenceImagePath
  if (referenceImagePath && shouldPersistDataUrlMedia(referenceImagePath)) {
    try {
      referenceImagePath = await persistDataUrlMediaToProject(referenceImagePath, projectRoot, folder)
      ref.changed = true
    } catch {
      /* keep original */
    }
  } else if (referenceImagePath && shouldPersistRemoteMedia(referenceImagePath)) {
    try {
      referenceImagePath = await persistRemoteMediaToProject(referenceImagePath, projectRoot, folder)
      ref.changed = true
    } catch {
      /* keep original */
    }
  }
  let generatedImagePath = asset.generatedImagePath
  if (generatedImagePath && shouldPersistDataUrlMedia(generatedImagePath)) {
    try {
      generatedImagePath = await persistDataUrlMediaToProject(generatedImagePath, projectRoot, folder)
      gen.changed = true
    } catch {
      /* keep original */
    }
  } else if (generatedImagePath && shouldPersistRemoteMedia(generatedImagePath)) {
    try {
      generatedImagePath = await persistRemoteMediaToProject(generatedImagePath, projectRoot, folder)
      gen.changed = true
    } catch {
      /* keep original */
    }
  }
  const changed = ref.changed || gen.changed
  if (!changed) return { asset, changed: false }
  return {
    asset: {
      ...asset,
      referenceImagePath,
      referenceImagePaths: ref.values,
      generatedImagePath,
      generatedImagePaths: gen.values,
    },
    changed: true,
  }
}

async function migrateShotPaths(
  shot: WorkflowShot,
  projectRoot: string,
): Promise<{ shot: WorkflowShot; changed: boolean }> {
  const folder = PROJECT_MEDIA_FOLDERS.shot
  const gen = await migratePathList(shot.generatedImagePaths, projectRoot, folder)
  const video = await migratePathList(shot.generatedVideoPaths, projectRoot, PROJECT_MEDIA_FOLDERS.video)
  let generatedImagePath = shot.generatedImagePath
  if (generatedImagePath && shouldPersistDataUrlMedia(generatedImagePath)) {
    try {
      generatedImagePath = await persistDataUrlMediaToProject(generatedImagePath, projectRoot, folder)
      gen.changed = true
    } catch {
      /* keep original */
    }
  } else if (generatedImagePath && shouldPersistRemoteMedia(generatedImagePath)) {
    try {
      generatedImagePath = await persistRemoteMediaToProject(generatedImagePath, projectRoot, folder)
      gen.changed = true
    } catch {
      /* keep original */
    }
  }
  let generatedVideoPath = shot.generatedVideoPath
  if (generatedVideoPath && shouldPersistDataUrlMedia(generatedVideoPath)) {
    try {
      generatedVideoPath = await persistDataUrlMediaToProject(
        generatedVideoPath,
        projectRoot,
        PROJECT_MEDIA_FOLDERS.video,
      )
      video.changed = true
    } catch {
      /* keep original */
    }
  } else if (generatedVideoPath && shouldPersistRemoteMedia(generatedVideoPath)) {
    try {
      generatedVideoPath = await persistRemoteMediaToProject(
        generatedVideoPath,
        projectRoot,
        PROJECT_MEDIA_FOLDERS.video,
      )
      video.changed = true
    } catch {
      /* keep original */
    }
  }
  const changed = gen.changed || video.changed
  if (!changed) return { shot, changed: false }
  return {
    shot: {
      ...shot,
      generatedImagePath,
      generatedImagePaths: gen.values,
      generatedVideoPath,
      generatedVideoPaths: video.values,
    },
    changed: true,
  }
}

/** 打开项目时将仍保存在数据里的远程 URL 落盘到项目目录 */
export async function migrateRemoteMediaInProjectData(
  data: WorkflowProjectData,
  projectRoot: string,
): Promise<{ data: WorkflowProjectData; changed: boolean }> {
  let changed = false

  const characters: WorkflowAsset[] = []
  for (const item of data.characters) {
    const res = await migrateAssetPaths(item, projectRoot)
    characters.push(res.asset)
    changed ||= res.changed
  }

  const scenes: WorkflowAsset[] = []
  for (const item of data.scenes) {
    const res = await migrateAssetPaths(item, projectRoot)
    scenes.push(res.asset)
    changed ||= res.changed
  }

  const props: WorkflowAsset[] = []
  for (const item of data.props) {
    const res = await migrateAssetPaths(item, projectRoot)
    props.push(res.asset)
    changed ||= res.changed
  }

  const shots: WorkflowShot[] = []
  for (const item of data.shots) {
    const res = await migrateShotPaths(item, projectRoot)
    shots.push(res.shot)
    changed ||= res.changed
  }

  if (!changed) return { data, changed: false }
  return {
    data: {
      ...data,
      characters,
      scenes,
      props,
      shots,
    },
    changed: true,
  }
}
