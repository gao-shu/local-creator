import type { AppSettings } from '@/types/settings'
import type { AssetKind } from '@/types/workflow'
import {
  joinPathSegments,
  resolveWorkflowStorageDir,
  WORKFLOW_DATA_SUBDIR,
  CANVAS_DATA_SUBDIR,
} from '@/lib/storage/storage-path-utils'
import {
  VOICE_LIBRARY_DIR_NAME,
  VOICE_LIBRARY_INDEX_FILENAME,
} from '@/types/voice-library'

/** 每个项目文件夹内的子目录（与画境命名对齐） */
export const PROJECT_MEDIA_FOLDERS = {
  character: 'Roles',
  scene: 'Scenes',
  prop: 'Items',
  shot: 'pictures',
  video: 'videos',
  voice: 'voices',
} as const

export type ProjectMediaKind = keyof typeof PROJECT_MEDIA_FOLDERS

export const PROJECT_LAYOUT_FOLDER_NAMES = [
  'Roles',
  'Scenes',
  'Items',
  'pictures',
  'videos',
  'voices',
] as const

/** 每个项目文件夹内的数据文件 */
export const PROJECT_DATA_FILE_NAMES = ['data.json', 'tasks.json'] as const

/** 便携数据包根目录下的文件 */
export const PORTABLE_ROOT_FILE_NAMES = ['settings.json', 'materials.json'] as const

/** 创作工坊目录下的索引文件 */
export const WORKFLOW_INDEX_FILE_NAMES = ['projects.json'] as const

/** 生成便携数据目录结构预览文本 */
export function formatPortableDataLayoutPreview(
  dataRoot: string,
  projectId = 'wf_项目ID',
): string {
  return [
    dataRoot,
    ...PORTABLE_ROOT_FILE_NAMES,
    `${VOICE_LIBRARY_DIR_NAME}/`,
    `  ${VOICE_LIBRARY_INDEX_FILENAME}`,
    `${WORKFLOW_DATA_SUBDIR}/`,
    ...WORKFLOW_INDEX_FILE_NAMES.map((name) => `  ${name}`),
    `  ${projectId}/`,
    ...PROJECT_DATA_FILE_NAMES.map((name) => `    ${name}`),
    ...PROJECT_LAYOUT_FOLDER_NAMES.map((name) => `    ${name}/`),
    `${CANVAS_DATA_SUBDIR}/`,
    '  projects.json',
    '  cv_项目ID/',
  ].join('\n')
}

export function resolveWorkflowProjectsRoot(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
): string {
  return resolveWorkflowStorageDir(settings, dataRoot)
}

export function resolveProjectRoot(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
  projectId: string,
): string {
  return joinPathSegments(resolveWorkflowProjectsRoot(settings, dataRoot), projectId)
}

export function resolveProjectMediaDir(
  settings: Pick<AppSettings, 'dataRootPath'>,
  dataRoot: string,
  projectId: string,
  kind: ProjectMediaKind,
): string {
  return joinPathSegments(
    resolveProjectRoot(settings, dataRoot, projectId),
    PROJECT_MEDIA_FOLDERS[kind],
  )
}

export function resolveAssetImageDir(
  settings: AppSettings,
  dataRoot: string,
  projectId: string,
  assetKind: AssetKind,
): string {
  return resolveProjectMediaDir(settings, dataRoot, projectId, assetKind)
}

export function formatProjectLayoutExample(dataRoot: string, projectId = 'wf_xxx'): string {
  const workflowRoot = joinPathSegments(dataRoot, WORKFLOW_DATA_SUBDIR)
  const root = joinPathSegments(workflowRoot, projectId)
  return [
    joinPathSegments(root, 'data.json'),
    joinPathSegments(root, 'tasks.json'),
    ...PROJECT_LAYOUT_FOLDER_NAMES.map((name) => joinPathSegments(root, name)),
  ].join('\n')
}
