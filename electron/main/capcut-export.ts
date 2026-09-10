// Copyright (c) local-creator contributors. All rights reserved.

import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { ipcMain, shell } from 'electron'
import { assertPathUnderDataRoot } from './ipc-path-security'
import { getLauncherAppDir } from './portable-storage-runtime'

const require = createRequire(__filename)

export interface CapcutExportClipInput {
  label: string
  absolutePath: string
}

export interface CapcutExportEpisodePayload {
  projectName: string
  clips: CapcutExportClipInput[]
  /** 剪映草稿根目录（com.lveditor.draft）；不传则自动探测 */
  draftsDir?: string
}

export interface CapcutExportEpisodeResult {
  success: boolean
  error?: string
  code?: 'NO_CLIPS' | 'DRAFTS_DIR_NOT_FOUND' | 'EXPORT_FAILED'
  draftPath?: string
  draftName?: string
  draftsDir?: string
  clipCount?: number
  registered?: boolean
  /** 导出时剪映/ CapCut 是否在运行（需提示用户重启才能看到新草稿） */
  editorRunning?: boolean
}

const DEFAULT_CLIP_DURATION_US = 5_000_000

/** Electron E2E：隔离目录内写入 marker，不依赖本机剪映 / capcut-cli */
export const E2E_CAPCUT_DRAFTS_DIR_NAME = 'e2e-capcut-drafts'
export const E2E_CAPCUT_MARKER_FILE = 'e2e-capcut-marker.json'

function resolveE2eCapcutDraftsDir(): string {
  return path.join(getLauncherAppDir(), E2E_CAPCUT_DRAFTS_DIR_NAME)
}

type CapcutModules = {
  draftDirs: () => Array<{ label: string; path: string }>
  initDraft: (opts: {
    name: string
    templateDir: string
    draftsDir: string
  }) => { filePath: string; registered: boolean }
  addVideo: (
    draft: unknown,
    draftFilePath: string,
    opts: {
      path: string
      start: number
      duration: number
      width: number
      height: number
      trackName: string
    },
  ) => void
  loadDraft: (filePath: string) => { draft: unknown; filePath: string }
  saveDraft: (filePath: string, draft: unknown) => void
  probeMedia: (
    filePath: string,
    ffprobeCmd?: string,
    useCache?: boolean,
  ) => { durationUs: number | null; width: number | null; height: number | null } | null
  setForceWrite: (value: boolean) => void
  editorProcesses: () => string[]
}

let capcutModulesPromise: Promise<CapcutModules> | null = null

/** capcut-cli 仅导出主入口，子路径需用 file URL 动态加载，避免启动时 ERR_PACKAGE_PATH_NOT_EXPORTED */
async function getCapcutModules(): Promise<CapcutModules> {
  if (!capcutModulesPromise) {
    capcutModulesPromise = (async () => {
      const root = path.dirname(require.resolve('capcut-cli/package.json'))
      const importDist = (file: string) =>
        import(pathToFileURL(path.join(root, 'dist', file)).href) as Promise<Record<string, unknown>>

      const [doctor, factory, probe, lib, draft, store] = await Promise.all([
        importDist('doctor.js'),
        importDist('factory.js'),
        importDist('probe.js'),
        import('capcut-cli'),
        importDist('draft.js'),
        importDist('store.js'),
      ])

      return {
        draftDirs: doctor.draftDirs as CapcutModules['draftDirs'],
        initDraft: factory.initDraft as CapcutModules['initDraft'],
        addVideo: factory.addVideo as CapcutModules['addVideo'],
        loadDraft: lib.loadDraft as CapcutModules['loadDraft'],
        saveDraft: lib.saveDraft as CapcutModules['saveDraft'],
        probeMedia: probe.probeMedia as CapcutModules['probeMedia'],
        setForceWrite: draft.setForceWrite as CapcutModules['setForceWrite'],
        editorProcesses: store.editorProcesses as CapcutModules['editorProcesses'],
      }
    })()
  }
  return capcutModulesPromise
}

function resolveCapcutCliTemplateDir(): string {
  const capcutCliRoot = path.dirname(require.resolve('capcut-cli/package.json'))
  return path.join(capcutCliRoot, 'templates', '_init')
}

function sanitizeCapcutDraftName(name: string): string {
  const trimmed = String(name || '').trim().slice(0, 72) || '漫创导出'
  return trimmed.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ')
}

async function resolveDefaultJianyingDraftsDir(): Promise<string | null> {
  const { draftDirs } = await getCapcutModules()
  const candidates = draftDirs()
  const preferred = candidates.find((item) => /JianYing|Jianying/i.test(item.label))
  if (preferred?.path && fs.existsSync(preferred.path)) return preferred.path
  for (const item of candidates) {
    if (item.path && fs.existsSync(item.path)) return item.path
  }
  return preferred?.path || candidates[0]?.path || null
}

async function assertReadableVideoPath(filePath: string): Promise<string> {
  const trimmed = String(filePath || '').trim()
  if (!trimmed) throw new Error('缺少视频路径')
  if (/^https?:\/\//i.test(trimmed)) throw new Error('暂不支持远程视频导出剪映草稿')
  const safePath = await assertPathUnderDataRoot(trimmed)
  if (!fs.existsSync(safePath)) throw new Error(`视频文件不存在：${safePath}`)
  return safePath
}

function buildUniqueDraftName(baseName: string, draftsDir: string): string {
  let candidate = sanitizeCapcutDraftName(baseName)
  if (!fs.existsSync(path.join(draftsDir, candidate))) return candidate
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  candidate = sanitizeCapcutDraftName(`${baseName} ${stamp}`)
  if (!fs.existsSync(path.join(draftsDir, candidate))) return candidate
  return sanitizeCapcutDraftName(`${baseName} ${Date.now()}`)
}

function formatCapcutExportError(message: string): string {
  const trimmed = String(message || '').trim()
  if (!trimmed) return '导出剪映草稿失败'
  if (/JianyingPro\.exe|JianyingPro/i.test(trimmed) && /running|is running/i.test(trimmed)) {
    return '剪映正在运行，无法写入草稿。请完全退出剪映后重试。'
  }
  if (/CapCut\.exe|CapCut/i.test(trimmed) && /running|is running/i.test(trimmed)) {
    return 'CapCut 正在运行，无法写入草稿。请完全退出 CapCut 后重试。'
  }
  if (/Draft changed on disk/i.test(trimmed)) {
    return '草稿文件在导出过程中被其他程序修改，请关闭剪映后重试。'
  }
  return trimmed
}

async function exportEpisodeToCapcutDraftE2eMock(
  payload: CapcutExportEpisodePayload,
): Promise<CapcutExportEpisodeResult> {
  const clips = (payload.clips || []).filter((item) => String(item.absolutePath || '').trim())
  if (!clips.length) {
    return { success: false, code: 'NO_CLIPS', error: '没有可导出的本地视频文件' }
  }

  const draftsDir = String(payload.draftsDir || '').trim() || resolveE2eCapcutDraftsDir()
  await fsPromises.mkdir(draftsDir, { recursive: true })

  for (const clip of clips) {
    await assertReadableVideoPath(clip.absolutePath)
  }

  const draftName = buildUniqueDraftName(payload.projectName, draftsDir)
  const draftPath = path.join(draftsDir, draftName)
  await fsPromises.mkdir(draftPath, { recursive: true })
  await fsPromises.writeFile(
    path.join(draftPath, E2E_CAPCUT_MARKER_FILE),
    JSON.stringify(
      {
        projectName: payload.projectName,
        clipCount: clips.length,
        clips: clips.map((item) => ({ label: item.label, absolutePath: item.absolutePath })),
        exportedAt: Date.now(),
      },
      null,
      2,
    ),
    'utf-8',
  )

  return {
    success: true,
    draftPath,
    draftName,
    draftsDir,
    clipCount: clips.length,
    registered: true,
    editorRunning: false,
  }
}

export async function exportEpisodeToCapcutDraft(
  payload: CapcutExportEpisodePayload,
): Promise<CapcutExportEpisodeResult> {
  if (process.env.LC_E2E === '1') {
    return exportEpisodeToCapcutDraftE2eMock(payload)
  }

  const clips = (payload.clips || []).filter((item) => String(item.absolutePath || '').trim())
  if (!clips.length) {
    return { success: false, code: 'NO_CLIPS', error: '没有可导出的本地视频文件' }
  }

  const draftsDir = String(payload.draftsDir || '').trim() || (await resolveDefaultJianyingDraftsDir())
  if (!draftsDir) {
    return {
      success: false,
      code: 'DRAFTS_DIR_NOT_FOUND',
      error: '未找到剪映草稿目录，请手动选择「com.lveditor.draft」文件夹',
    }
  }
  if (!fs.existsSync(draftsDir)) {
    return {
      success: false,
      code: 'DRAFTS_DIR_NOT_FOUND',
      error: `剪映草稿目录不存在：${draftsDir}`,
      draftsDir,
    }
  }

  try {
    const { initDraft, loadDraft, saveDraft, addVideo, probeMedia, setForceWrite, editorProcesses } =
      await getCapcutModules()

    const editorRunning = editorProcesses().length > 0
    // 新建草稿不会被剪映载入内存，允许在剪映运行时写入（等同 capcut-cli --force-write）
    setForceWrite(true)

    const templateDir = resolveCapcutCliTemplateDir()
    if (!fs.existsSync(templateDir)) {
      throw new Error('缺少剪映草稿模板，请重新安装应用依赖')
    }

    const draftName = buildUniqueDraftName(payload.projectName, draftsDir)
    const { filePath, registered } = initDraft({
      name: draftName,
      templateDir,
      draftsDir,
    })

    const { draft } = loadDraft(filePath)
    let cursorUs = 0

    for (const clip of clips) {
      const safePath = await assertReadableVideoPath(clip.absolutePath)
      const probe = probeMedia(safePath)
      const durationUs =
        typeof probe?.durationUs === 'number' && probe.durationUs > 0
          ? probe.durationUs
          : DEFAULT_CLIP_DURATION_US
      const width = probe?.width && probe.width > 0 ? probe.width : 1920
      const height = probe?.height && probe.height > 0 ? probe.height : 1080

      addVideo(draft, filePath, {
        path: safePath,
        start: cursorUs,
        duration: durationUs,
        width,
        height,
        trackName: 'video',
      })
      cursorUs += durationUs
    }

    saveDraft(filePath, draft)

    return {
      success: true,
      draftPath: path.dirname(filePath),
      draftName,
      draftsDir,
      clipCount: clips.length,
      registered,
      editorRunning,
    }
  } catch (error: unknown) {
    const err = error as Error
    return {
      success: false,
      code: 'EXPORT_FAILED',
      error: formatCapcutExportError(err.message),
      draftsDir,
    }
  } finally {
    try {
      const { setForceWrite } = await getCapcutModules()
      setForceWrite(false)
    } catch {
      // 重置模块级 forceWrite 标志，避免影响后续导出
    }
  }
}

export function registerCapcutExportIpc(): void {
  ipcMain.removeHandler('capcut:export-episode')
  ipcMain.removeHandler('capcut:resolve-default-drafts-dir')

  ipcMain.handle('capcut:resolve-default-drafts-dir', async () => {
    const draftsDir = await resolveDefaultJianyingDraftsDir()
    return { success: Boolean(draftsDir), draftsDir: draftsDir || undefined }
  })

  ipcMain.handle('capcut:export-episode', async (_event, payload: CapcutExportEpisodePayload) => {
    return exportEpisodeToCapcutDraft(payload)
  })

  ipcMain.removeHandler('capcut:open-drafts-dir')
  ipcMain.handle('capcut:open-drafts-dir', async (_event, draftsDir: string) => {
    const target = String(draftsDir || '').trim()
    if (!target) return { success: false, error: '缺少草稿目录' }
    try {
      await shell.openPath(target)
      return { success: true }
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message || '打开目录失败' }
    }
  })
}
