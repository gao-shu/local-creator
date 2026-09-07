import type { AppSettings } from '@/types/settings'
import {
  joinPathSegments,
  normalizeDataRootPath,
  resolveStorageRoot,
  resolveDefaultWorkflowDir,
  WORKFLOW_DATA_SUBDIR,
} from '@/lib/storage/storage-path-utils'

export const DATA_SUBFOLDERS = {
  canvas: 'canvas',
  workflow: WORKFLOW_DATA_SUBDIR,
} as const

export function normalizeStorageRoot(inputPath = ''): string {
  return normalizeDataRootPath(inputPath)
}

export interface AssembledDataPaths {
  dataRoot: string
  canvasDir: string
  workflowDir: string
}

export function assembleDataPaths(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
): AssembledDataPaths {
  const root = resolveStorageRoot(settings, dataRoot)
  return {
    dataRoot: root,
    canvasDir: joinPathSegments(root, DATA_SUBFOLDERS.canvas),
    workflowDir: resolveDefaultWorkflowDir(root),
  }
}

export function applyStorageRootToSettings(
  settings: AppSettings,
  root: string,
): AppSettings {
  const dataRoot = normalizeStorageRoot(root)
  const workflowDir = resolveDefaultWorkflowDir(dataRoot)
  return {
    ...settings,
    dataRootPath: dataRoot,
    projectsDataPath: dataRoot,
    workflowDataPath: workflowDir,
    characterLibraryPath: '',
    sceneLibraryPath: '',
    generatedImagesPath: '',
    videoSavePath: '',
  }
}

export function formatStorageRootHint(): string {
  return '请选择或新建一个文件夹作为便携数据包根目录'
}
