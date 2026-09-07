// Copyright (c) local-creator contributors. All rights reserved.

import type { AppSettings } from '@/types/settings'

const CHILD_DIR_PATTERN =
  /[\\/]+(projects|workflow|canvas|Roles|Scenes|Items|pictures|videos|characters|scenes|generated)$/i

export function trimTrailingSeparators(inputPath: string): string {
  const text = String(inputPath || '')
  if (/^[a-zA-Z]:[\\/]$/.test(text) || /^[/\\]+$/.test(text)) return text
  return text.replace(/[\\/]+$/g, '')
}

export function normalizeDataRootPath(inputPath = ''): string {
  const normalized = trimTrailingSeparators(String(inputPath || '').trim())
  if (!normalized) return ''
  return trimTrailingSeparators(normalized.replace(CHILD_DIR_PATTERN, ''))
}

export function pathSeparator(inputPath: string): string {
  return String(inputPath || '').includes('\\') ? '\\' : '/'
}

export function joinPathSegments(base: string, child: string): string {
  const root = trimTrailingSeparators(base)
  if (!root) return child
  return `${root}${pathSeparator(root)}${child}`
}

export function resolveStorageRoot(
  settings: Pick<AppSettings, 'dataRootPath'> | null | undefined,
  fallback = '',
): string {
  return normalizeDataRootPath(settings?.dataRootPath || fallback)
}

/** 创作工坊数据子目录名（与 weifan ComicGenerator/workflow 对齐） */
export const WORKFLOW_DATA_SUBDIR = 'workflow'

/** 画布工坊数据子目录名（与画镜 canvas 对齐） */
export const CANVAS_DATA_SUBDIR = 'canvas'

const WORKFLOW_PROJECT_ID_PATTERN = /^wf_/i
/** cv_{uuid} | cv_dev_*；禁止路径分隔符与 .. */
const CANVAS_PROJECT_ID_PATTERN = /^cv_[a-zA-Z0-9_-]+$/i

export function isWorkflowProjectDirName(name: string): boolean {
  return WORKFLOW_PROJECT_ID_PATTERN.test(String(name || '').trim())
}

export function isCanvasProjectDirName(name: string): boolean {
  const id = String(name || '').trim()
  if (!id || id.includes('..')) return false
  return CANVAS_PROJECT_ID_PATTERN.test(id)
}

function normalizePathForCompare(inputPath: string): string {
  return trimTrailingSeparators(String(inputPath || '').trim())
    .replace(/\\/g, '/')
    .toLowerCase()
}

/** 解析画布项目目录并校验不得越出 canvas root（主进程 / 脚本共用） */
export function resolveSafeCanvasProjectDir(canvasRoot: string, projectId: string): string {
  const id = String(projectId || '').trim()
  if (!isCanvasProjectDirName(id)) {
    throw new Error('无效的画布项目 ID')
  }
  const root = trimTrailingSeparators(String(canvasRoot || '').trim())
  if (!root) throw new Error('无效的画布项目路径')
  const dir = joinPathSegments(root, id)
  const rootKey = normalizePathForCompare(root)
  const dirKey = normalizePathForCompare(dir)
  if (dirKey === rootKey || !dirKey.startsWith(`${rootKey}/`)) {
    throw new Error('无效的画布项目路径')
  }
  return dir
}

/** 解析工坊项目目录并校验不得越出 workflow root */
export function resolveSafeWorkflowProjectDir(workflowRoot: string, projectId: string): string {
  const id = String(projectId || '').trim()
  if (!id || id.includes('..') || id.includes('/') || id.includes('\\') || !isWorkflowProjectDirName(id)) {
    throw new Error('无效的项目 ID')
  }
  const root = trimTrailingSeparators(String(workflowRoot || '').trim())
  if (!root) throw new Error('无效的项目路径')
  const dir = joinPathSegments(root, id)
  const rootKey = normalizePathForCompare(root)
  const dirKey = normalizePathForCompare(dir)
  if (dirKey === rootKey || !dirKey.startsWith(`${rootKey}/`)) {
    throw new Error('无效的项目路径')
  }
  return dir
}

export function resolveDefaultCanvasDir(dataRoot: string): string {
  const root = normalizeDataRootPath(dataRoot)
  if (!root) return ''
  return joinPathSegments(root, CANVAS_DATA_SUBDIR)
}

/** 解析画布工坊存储根目录：固定为 {dataRoot}/canvas */
export function resolveCanvasStorageDir(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
): string {
  const root = resolveStorageRoot(settings, dataRoot)
  if (!root) return ''
  return resolveDefaultCanvasDir(root)
}

export function resolveDefaultWorkflowDir(dataRoot: string): string {
  const root = normalizeDataRootPath(dataRoot)
  if (!root) return ''
  return joinPathSegments(root, WORKFLOW_DATA_SUBDIR)
}

export function isLegacyDirectStoragePath(value: string, kind: 'projects' | 'workflow'): boolean {
  const text = String(value || '').trim()
  if (!text) return false
  return new RegExp(`[\\\\/]${kind}$`, 'i').test(text)
}

/** 解析创作工坊存储根目录：固定为 {dataRoot}/workflow */
export function resolveWorkflowStorageDir(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
): string {
  const root = resolveStorageRoot(settings, dataRoot)
  if (!root) return ''
  return resolveDefaultWorkflowDir(root)
}

export function resolveProjectsStorageDir(
  settings: Pick<AppSettings, 'dataRootPath' | 'projectsDataPath'>,
  dataRoot: string,
): string {
  const raw = settings.projectsDataPath?.trim() || ''
  if (isLegacyDirectStoragePath(raw, 'projects')) return raw
  return resolveStorageRoot(settings, dataRoot)
}

export function normalizePathHistory(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.filter(Boolean).map(String).map(normalizeDataRootPath).filter(Boolean)
  }
  if (typeof value === 'string') {
    const normalized = normalizeDataRootPath(value)
    return normalized ? [normalized] : []
  }
  return []
}

export function appendPathHistory(current: string[] | undefined, nextPath: string): string[] {
  const normalized = normalizeDataRootPath(nextPath)
  if (!normalized) return normalizePathHistory(current)
  const list = normalizePathHistory(current).filter((item) => item !== normalized)
  return [normalized, ...list].slice(0, 8)
}
