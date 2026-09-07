// Copyright (c) Haode AI. All rights reserved.

import { resolveCanvasMediaProjectRoot } from '@/lib/canvas/canvas-media-resolve'
import {
  resolveCanvasAssetDir,
  resolveCanvasProjectRoot,
} from '@/lib/canvas/canvas-project-paths'
import { isCanvasApiAvailable } from '@/lib/storage/canvas-service'
import { readStoredMediaAsDataUrl, saveDataUrlImage } from '@/lib/storage/fs-service'
import { toProjectRelativeMediaPath } from '@/lib/storage/media-path-resolver'
import { readSettings } from '@/lib/storage/settings-service'
import type { CanvasMediaOwnerKind } from '@/types/canvas-nodes'
import type { AppSettings } from '@/types/settings'

export interface LoadCanvasImageForEditOptions {
  projectId: string
  nodeId: string
  outputPath: string
  outputOwnerKind?: CanvasMediaOwnerKind
  outputOwnerProjectId?: string
}

export interface LoadCanvasImageForEditResult {
  dataUrl: string
}

export interface SaveCanvasEditedImageOptions {
  projectId: string
  nodeId: string
  dataUrl: string
}

function buildEditFilename(nodeId: string): string {
  const safeId = String(nodeId || 'node').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `edit_${safeId}_${Date.now()}.png`
}

/** 从存储路径提取文件名（不含扩展名），供编辑保存对话框默认名称 */
export function resolveCanvasImageEditDefaultName(options: {
  outputPath?: string
  /** 节点上展示/编辑的图片名称（优先于文件路径名） */
  imageName?: string
}): string {
  const imageName = String(options.imageName || '').trim()
  if (imageName) return imageName

  const storedPath = String(options.outputPath || '').trim()
  if (storedPath && !storedPath.startsWith('data:') && !storedPath.startsWith('preview:')) {
    const normalized = storedPath.replace(/\\/g, '/')
    const fileName = normalized.split('/').pop() || normalized
    const stem = fileName.replace(/\.(png|jpe?g|webp|gif|bmp|svg)$/i, '').trim()
    if (stem) return stem
  }

  return 'canvas-edit'
}

function toCanvasRelativePath(
  absolutePath: string,
  settings: AppSettings,
  appDataDir: string,
  projectId: string,
): string {
  const projectRoot = resolveCanvasProjectRoot(settings, appDataDir, projectId)
  return toProjectRelativeMediaPath(absolutePath, projectRoot)
}

/** 从节点 outputPath 加载可编辑 dataURL */
export async function loadCanvasImageForEdit(
  options: LoadCanvasImageForEditOptions,
): Promise<LoadCanvasImageForEditResult> {
  const storedPath = String(options.outputPath || '').trim()
  if (!storedPath) {
    throw new Error('当前节点没有可编辑的图片')
  }

  const projectRoot = await resolveCanvasMediaProjectRoot(options.projectId, {
    ownerKind: options.outputOwnerKind,
    ownerProjectId: options.outputOwnerProjectId,
  })
  const dataUrl = await readStoredMediaAsDataUrl(storedPath, projectRoot)
  if (!dataUrl) {
    throw new Error('图片无法加载，请确认文件是否存在')
  }

  return { dataUrl }
}

/** 保存编辑结果到 canvas/images，返回新的相对 outputPath */
export async function saveCanvasEditedImage(options: SaveCanvasEditedImageOptions): Promise<string> {
  const trimmed = String(options.dataUrl || '').trim()
  if (!trimmed) {
    throw new Error('缺少编辑后的图片数据')
  }

  const settingsRes = await readSettings()
  const { data: settings, appDataDir } = settingsRes
  const targetDir = resolveCanvasAssetDir(settings, appDataDir, options.projectId, 'images')
  const filename = buildEditFilename(options.nodeId)
  const saved = await saveDataUrlImage(trimmed, { targetDir, filename })
  if (!saved.success || !saved.filePath) {
    throw new Error(saved.error || '编辑图片保存失败')
  }
  if (!isCanvasApiAvailable()) {
    return saved.filePath
  }
  return toCanvasRelativePath(saved.filePath, settings, appDataDir, options.projectId)
}
