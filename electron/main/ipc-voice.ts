import path from 'node:path'
import fs from 'node:fs/promises'
import { dialog, ipcMain } from 'electron'
import {
  type VoiceLibraryEntry,
  type VoiceLibraryProjectKind,
} from '../../src/types/voice-library'
import {
  remapVoiceLibraryEntriesForRead,
  remapVoiceLibraryEntriesForWrite,
  resolveGlobalVoiceLibraryIndexPath,
  resolveGlobalVoiceLibraryRoot,
  resolveVoiceMediaReadRoot,
} from '../../src/lib/voice/global-voice-library-paths'
import {
  resolveProjectVoicesDir,
  toProjectRelativeVoicePath,
} from '../../src/lib/voice/project-voice-library-paths'
import { writeJsonAtomic } from './atomic-write'
import { readSettingsMerged } from './ipc-settings'
import {
  readAllCanvasProjects,
  readAllWorkflowProjects,
  readSoftDeletedProjectIds,
} from './project-index-read'
import {
  resolveCanvasStorageDir,
  resolveSafeCanvasProjectDir,
  resolveWorkflowStorageDir,
} from '../../src/lib/storage/storage-path-utils'
import { projectDir, resolveWorkflowRoot } from './ipc-workflow'

function bindVoiceHandler<T extends unknown[]>(
  channel: string,
  handler: (...args: T) => Promise<unknown>,
) {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, handler)
}

async function resolveSourceProjectRoot(
  projectId: string,
  projectKind: VoiceLibraryProjectKind = 'workflow',
): Promise<string> {
  const id = String(projectId || '').trim()
  if (!id) throw new Error('项目 ID 无效')

  const { data, ctx } = await readSettingsMerged()
  const dataRoot = data.dataRootPath || ctx.dataRoot
  if (!dataRoot) throw new Error('请先在系统设置中选择数据根目录')

  if (projectKind === 'canvas') {
    const canvasRoot = resolveCanvasStorageDir(data, dataRoot)
    return resolveSafeCanvasProjectDir(canvasRoot, id)
  }

  const workflowRoot = resolveWorkflowStorageDir(data, dataRoot) || (await resolveWorkflowRoot())
  return projectDir(workflowRoot, id)
}

async function resolveProjectTitle(
  projectId: string,
  projectKind: VoiceLibraryProjectKind,
): Promise<string> {
  const id = String(projectId || '').trim()
  if (!id) return ''
  if (projectKind === 'canvas') {
    const projects = await readAllCanvasProjects()
    return projects.find((item) => item.id === id)?.title?.trim() || id
  }
  const projects = await readAllWorkflowProjects()
  return projects.find((item) => item.id === id)?.title?.trim() || id
}

async function ensureVoiceLibraryLayout(dataRoot: string): Promise<void> {
  const libraryRoot = resolveGlobalVoiceLibraryRoot(dataRoot)
  await fs.mkdir(libraryRoot, { recursive: true })
  const indexPath = resolveGlobalVoiceLibraryIndexPath(libraryRoot)
  try {
    await fs.access(indexPath)
  } catch {
    await writeJsonAtomic(indexPath, [])
  }
}

async function readVoiceLibraryIndex(dataRoot: string): Promise<VoiceLibraryEntry[]> {
  const libraryRoot = resolveGlobalVoiceLibraryRoot(dataRoot)
  const indexPath = resolveGlobalVoiceLibraryIndexPath(libraryRoot)
  try {
    const raw = await fs.readFile(indexPath, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VoiceLibraryEntry[]) : []
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException
    if (err.code === 'ENOENT') return []
    throw error
  }
}

async function writeVoiceLibraryIndex(
  dataRoot: string,
  entries: VoiceLibraryEntry[],
): Promise<void> {
  const libraryRoot = resolveGlobalVoiceLibraryRoot(dataRoot)
  const indexPath = resolveGlobalVoiceLibraryIndexPath(libraryRoot)
  await writeJsonAtomic(indexPath, remapVoiceLibraryEntriesForWrite(entries))
}

export function registerVoiceIpc() {
  bindVoiceHandler('voice-library:select-reference-audio', async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: '音频文件', extensions: ['mp3', 'wav'] }],
      })
      if (result.canceled || !result.filePaths[0]) {
        return { success: true, canceled: true as const }
      }
      return { success: true, filePath: result.filePaths[0] }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  bindVoiceHandler('voice-library:list', async () => {
    try {
      const { data, ctx } = await readSettingsMerged()
      const dataRoot = data.dataRootPath || ctx.dataRoot
      if (!dataRoot) throw new Error('请先在系统设置中选择数据根目录')

      await ensureVoiceLibraryLayout(dataRoot)
      const entries = await readVoiceLibraryIndex(dataRoot)
      const softDeletedProjectIds = await readSoftDeletedProjectIds()
      const remapped = remapVoiceLibraryEntriesForRead(entries, (entry) =>
        resolveVoiceMediaReadRoot(
          entry.sourceProjectId,
          entry.sourceProjectKind,
          data,
          dataRoot,
        ),
      )
      const voices = remapped.map((entry) => ({
        ...entry,
        sourceInRecycleBin: softDeletedProjectIds.has(String(entry.sourceProjectId || '').trim()),
      }))
      return { success: true, voices, softDeletedProjectIds: [...softDeletedProjectIds] }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, voices: [] as VoiceLibraryEntry[], error: err.message }
    }
  })

  bindVoiceHandler(
    'voice-library:add-voice',
    async (
      _event,
      payload: {
        name: string
        sourceAudioPath: string
        projectId: string
        projectTitle?: string
        projectKind?: VoiceLibraryProjectKind
      },
    ) => {
      try {
        const name = String(payload.name || '').trim()
        const sourceAudioPath = String(payload.sourceAudioPath || '').trim()
        const projectId = String(payload.projectId || '').trim()
        const projectKind: VoiceLibraryProjectKind =
          payload.projectKind === 'canvas' ? 'canvas' : 'workflow'
        if (!name) return { success: false, error: '请输入音色名称' }
        if (!sourceAudioPath) return { success: false, error: '请选择参考音频' }
        if (!projectId) return { success: false, error: '项目未就绪，无法保存音色' }
        const ext = path.extname(sourceAudioPath).toLowerCase()
        if (ext !== '.mp3' && ext !== '.wav') {
          return { success: false, error: '仅支持 mp3 / wav 格式' }
        }

        const { data, ctx } = await readSettingsMerged()
        const dataRoot = data.dataRootPath || ctx.dataRoot
        if (!dataRoot) throw new Error('请先在系统设置中选择数据根目录')

        const sourceProjectRoot = await resolveSourceProjectRoot(projectId, projectKind)
        const projectTitle =
          String(payload.projectTitle || '').trim() ||
          (await resolveProjectTitle(projectId, projectKind))

        const voiceId = `voice_${Date.now()}`
        const targetDir = path.join(resolveProjectVoicesDir(sourceProjectRoot), voiceId)
        await fs.mkdir(targetDir, { recursive: true })
        const targetPath = path.join(targetDir, `reference${ext || '.wav'}`)
        await fs.copyFile(sourceAudioPath, targetPath)

        const relativePath = toProjectRelativeVoicePath(targetPath, sourceProjectRoot)
        const newVoice: VoiceLibraryEntry = {
          id: voiceId,
          name,
          createdAt: new Date().toISOString(),
          referenceAudio: relativePath,
          sourceProjectId: projectId,
          sourceProjectTitle: projectTitle,
          sourceProjectKind: projectKind,
        }

        await ensureVoiceLibraryLayout(dataRoot)
        const index = await readVoiceLibraryIndex(dataRoot)
        index.unshift(newVoice)
        await writeVoiceLibraryIndex(dataRoot, index)

        return {
          success: true,
          voice: {
            ...newVoice,
            referenceAudio: targetPath,
          },
        }
      } catch (error: unknown) {
        const err = error as Error
        return { success: false, error: err.message }
      }
    },
  )

  /** @deprecated 全局音色库不再需要跨项目 fork */
  bindVoiceHandler('voice-library:fork-entries', async () => {
    return { success: true, forkedCount: 0 }
  })
}

registerVoiceIpc()
