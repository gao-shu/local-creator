import path from 'node:path'
import fs from 'node:fs/promises'
import {
  isWorkflowProjectDirName,
  WORKFLOW_DATA_SUBDIR,
} from '../../src/lib/storage/storage-path-utils'

const RESERVED_ROOT_ENTRIES = new Set([
  WORKFLOW_DATA_SUBDIR,
  'canvas',
  'settings.json',
  'projects.json',
  'haode-settings-backup.json',
])

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

async function isProjectDataDir(dirPath: string): Promise<boolean> {
  return pathExists(path.join(dirPath, 'data.json'))
}

async function shouldMoveRootEntry(name: string, dataRoot: string): Promise<boolean> {
  if (RESERVED_ROOT_ENTRIES.has(name)) return false
  if (name.startsWith('.')) return false

  const fullPath = path.join(dataRoot, name)
  let stat
  try {
    stat = await fs.stat(fullPath)
  } catch {
    return false
  }
  if (!stat.isDirectory()) return false

  if (isWorkflowProjectDirName(name)) return true
  return isProjectDataDir(fullPath)
}

/**
 * 将 dataRoot 根目录下的创作工坊数据迁入 dataRoot/workflow/。
 * 搬迁：projects.json、wf_* 目录、以及含 data.json 的项目目录。
 */
export async function migrateFlatWorkflowLayoutToSubdir(
  dataRoot: string,
  workflowDir: string,
): Promise<{ migrated: boolean; movedEntries: number }> {
  if (!dataRoot || !workflowDir) {
    return { migrated: false, movedEntries: 0 }
  }

  await fs.mkdir(workflowDir, { recursive: true })

  let movedEntries = 0
  const destIndex = path.join(workflowDir, 'projects.json')
  const srcIndex = path.join(dataRoot, 'projects.json')

  if (!(await pathExists(destIndex)) && (await pathExists(srcIndex))) {
    await fs.rename(srcIndex, destIndex)
    movedEntries += 1
  }

  let entries: string[] = []
  try {
    entries = await fs.readdir(dataRoot)
  } catch {
    return { migrated: movedEntries > 0, movedEntries }
  }

  for (const entry of entries) {
    if (!(await shouldMoveRootEntry(entry, dataRoot))) continue

    const srcDir = path.join(dataRoot, entry)
    const destDir = path.join(workflowDir, entry)
    if (await pathExists(destDir)) continue

    await fs.rename(srcDir, destDir)
    movedEntries += 1
  }

  return { migrated: movedEntries > 0, movedEntries }
}
