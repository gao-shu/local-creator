// Copyright (c) Haode AI. All rights reserved.

import {
  copyMediaFileToDir,
  ensureDataDirectories,
} from '@/lib/storage/fs-service'
import { joinPathSegments } from '@/lib/storage/storage-path-utils'

export function getToolboxImportDir(dataRoot: string, kind: 'video' | 'image'): string {
  const sub = kind === 'video' ? 'toolbox/video-merge' : 'toolbox/image-crop'
  return joinPathSegments(dataRoot, sub)
}

function isPathUnderRoot(filePath: string, root: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase()
  const rootNorm = root.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
  return normalized === rootNorm || normalized.startsWith(`${rootNorm}/`)
}

/** 将外部视频导入数据目录，供剪映导出等 IPC 使用 */
export async function resolveToolboxVideoPath(
  sourcePath: string,
  dataRoot: string,
): Promise<string> {
  const trimmed = String(sourcePath || '').trim()
  if (!trimmed) throw new Error('缺少视频路径')
  if (dataRoot && isPathUnderRoot(trimmed, dataRoot)) return trimmed

  const targetDir = getToolboxImportDir(dataRoot, 'video')
  await ensureDataDirectories([targetDir])
  const copied = await copyMediaFileToDir({ sourcePath: trimmed, targetDir })
  if (!copied.success || !copied.filePath) {
    throw new Error(copied.error || '导入视频失败')
  }
  return copied.filePath
}
