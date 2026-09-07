// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'
import type { WorkflowShot } from '@/types/workflow'
import {
  getReferenceImagePaths,
  MAX_REFERENCE_IMAGES,
} from '@/lib/workflow/asset-utils'
import { saveProjectMediaFromDataUrl, saveProjectMediaFromLocalFile } from '@/lib/workflow/project-media-save'

export function appendShotReferenceImage(
  shot: WorkflowShot,
  imagePath: string,
): Partial<WorkflowShot> {
  const refs = [...getReferenceImagePaths(shot), imagePath]
  const trimmed = refs.length > MAX_REFERENCE_IMAGES ? refs.slice(-MAX_REFERENCE_IMAGES) : refs
  return {
    referenceImagePaths: trimmed.length ? trimmed : undefined,
    referenceImagePath: trimmed[0],
    selectedReferenceImageIndex: trimmed.length - 1,
    updatedAt: Date.now(),
  }
}

const SHOT_REFERENCE_PATCH_KEYS = new Set([
  'referenceImagePaths',
  'referenceImagePath',
  'selectedReferenceImageIndex',
  'referenceAudioPaths',
  'referenceAudioItems',
])

/** 是否为参考图相关字段变更（需立即落盘） */
export function isShotReferencePatch(patch: Partial<WorkflowShot>): boolean {
  return Object.keys(patch).some((key) => SHOT_REFERENCE_PATCH_KEYS.has(key))
}

/** 是否为视频截图生成的参考图（兼容旧版中文文件名） */
export function isScreenshotReferencePath(path: string): boolean {
  const normalized = String(path || '').replace(/\\/g, '/')
  return normalized.includes('screenshot_ref_') || normalized.includes('截图参考_')
}

/** 保存分镜参考图到 pictures/ 并返回项目内相对路径 */
export async function saveShotReferenceImageFromFile(
  sourcePath: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
    shotId: string
  },
): Promise<string> {
  return saveProjectMediaFromLocalFile({
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    sourcePath,
    entityId: options.shotId,
    target: 'shot',
    purpose: 'ref',
    nameTag: 'upload_ref',
  })
}

/** 保存分镜参考图到 pictures/ 并返回项目内相对路径 */
export async function saveShotReferenceImage(
  dataUrl: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
    shotId: string
  },
): Promise<string> {
  return saveProjectMediaFromDataUrl({
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    dataUrl,
    entityId: options.shotId,
    target: 'shot',
    purpose: 'ref',
    nameTag: 'upload_ref',
  })
}

/** 保存视频截图并返回项目内相对路径 */
export async function saveShotScreenshotReference(
  dataUrl: string,
  options: {
    settings: AppSettings
    appDataDir: string
    projectId: string
    shotId: string
  },
): Promise<string> {
  return saveProjectMediaFromDataUrl({
    settings: options.settings,
    appDataDir: options.appDataDir,
    projectId: options.projectId,
    dataUrl,
    entityId: options.shotId,
    target: 'shot',
    purpose: 'ref',
    nameTag: 'screenshot_ref',
  })
}
