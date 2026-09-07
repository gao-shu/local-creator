import { normalizeDataRootPath, joinPathSegments } from '@/lib/storage/storage-path-utils'

/** 启动器目录名（仅存放「数据目录指针」，不存放业务数据） */
export const APP_LAUNCHER_DIR_NAME = 'HaodeAI'

export const STORAGE_ROOT_POINTER_FILE = 'storage-root.json'

export const PORTABLE_SETTINGS_FILE = 'settings.json'

export interface StorageRootPointer {
  dataRootPath: string
}

export function getLauncherDir(documentsPath: string): string {
  return joinPathSegments(documentsPath, APP_LAUNCHER_DIR_NAME)
}

export function getPointerFilePath(launcherDir: string): string {
  return joinPathSegments(launcherDir, STORAGE_ROOT_POINTER_FILE)
}

export function getPortableSettingsPath(dataRoot: string): string {
  return joinPathSegments(dataRoot, PORTABLE_SETTINGS_FILE)
}

export function normalizePortableRoot(inputPath = ''): string {
  return normalizeDataRootPath(inputPath)
}

export function parseStorageRootPointer(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as StorageRootPointer
    return normalizePortableRoot(parsed.dataRootPath || '')
  } catch {
    return ''
  }
}

export function buildStorageRootPointer(dataRoot: string): StorageRootPointer {
  return { dataRootPath: normalizePortableRoot(dataRoot) }
}

/** 数据目录内应包含的便携包标记文件 */
export function isPortableDataRootCandidate(dir: string): boolean {
  const root = normalizePortableRoot(dir)
  if (!root) return false
  return true
}
