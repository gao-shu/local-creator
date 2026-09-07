import path from 'node:path'
import fs from 'node:fs/promises'
import type { AssembledDataPaths } from '../../src/lib/storage/data-layout'
import { createEmptyMaterialsIndex } from '../../src/types/material-library'
import { VOICE_LIBRARY_DIR_NAME } from '../../src/types/voice-library'
import { writeJsonAtomic } from './atomic-write'
import { ensureMaterialsLibraryLayout } from './materials-sync'

/** 新建/切换数据根目录时，补齐预览中的根级文件与子目录（已存在的不覆盖） */
export async function ensurePortableDataLayout(assembled: AssembledDataPaths): Promise<void> {
  const { dataRoot, canvasDir, workflowDir } = assembled

  await fs.mkdir(dataRoot, { recursive: true })
  await fs.mkdir(canvasDir, { recursive: true })
  await fs.mkdir(workflowDir, { recursive: true })

  const materialsPath = path.join(dataRoot, 'materials.json')
  try {
    await fs.access(materialsPath)
  } catch {
    await writeJsonAtomic(materialsPath, createEmptyMaterialsIndex())
  }

  await ensureMaterialsLibraryLayout(dataRoot)

  const workflowIndexPath = path.join(workflowDir, 'projects.json')
  try {
    await fs.access(workflowIndexPath)
  } catch {
    await writeJsonAtomic(workflowIndexPath, [])
  }

  const canvasIndexPath = path.join(canvasDir, 'projects.json')
  try {
    await fs.access(canvasIndexPath)
  } catch {
    await writeJsonAtomic(canvasIndexPath, [])
  }

  const voiceLibraryDir = path.join(dataRoot, VOICE_LIBRARY_DIR_NAME)
  await fs.mkdir(voiceLibraryDir, { recursive: true })
  const voiceLibraryIndexPath = path.join(voiceLibraryDir, 'voice-library.json')
  try {
    await fs.access(voiceLibraryIndexPath)
  } catch {
    await writeJsonAtomic(voiceLibraryIndexPath, [])
  }
}
