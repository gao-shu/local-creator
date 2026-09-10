import path from 'node:path'
import fs from 'node:fs/promises'
import { app } from 'electron'
import {
  buildStorageRootPointer,
  getLauncherDir,
  getPointerFilePath,
  getPortableSettingsPath,
  normalizePortableRoot,
  parseStorageRootPointer,
  PORTABLE_SETTINGS_FILE,
} from '../../src/lib/storage/portable-storage'
import { writeFileAtomic } from './atomic-write'

function resolveDocumentsPath(): string {
  try {
    return app.getPath('documents')
  } catch {
    return process.env.USERPROFILE
      ? path.join(process.env.USERPROFILE, 'Documents')
      : app.getPath('home')
  }
}

export function getLauncherAppDir(): string {
  const override = process.env.LC_E2E_LAUNCHER_DIR?.trim()
  if (override) return override
  return getLauncherDir(resolveDocumentsPath())
}

export async function readStorageRootPointer(): Promise<string> {
  const pointerPath = getPointerFilePath(getLauncherAppDir())
  try {
    const raw = await fs.readFile(pointerPath, 'utf-8')
    return parseStorageRootPointer(raw)
  } catch {
    return ''
  }
}

export async function writeStorageRootPointer(dataRoot: string): Promise<void> {
  const launcherDir = getLauncherAppDir()
  await fs.mkdir(launcherDir, { recursive: true })
  const pointerPath = getPointerFilePath(launcherDir)
  await writeFileAtomic(
    pointerPath,
    JSON.stringify(buildStorageRootPointer(dataRoot), null, 2),
  )
}

export interface PortableStorageContext {
  launcherDir: string
  dataRoot: string
  settingsPath: string
  legacySettingsPath: string
}

export async function resolvePortableStorageContext(): Promise<PortableStorageContext> {
  const launcherDir = getLauncherAppDir()
  const legacySettingsPath = path.join(launcherDir, PORTABLE_SETTINGS_FILE)
  let dataRoot = await readStorageRootPointer()

  if (!dataRoot) {
    try {
      const legacyRaw = await fs.readFile(legacySettingsPath, 'utf-8')
      const legacyParsed = JSON.parse(legacyRaw) as { dataRootPath?: string }
      const legacyRoot = normalizePortableRoot(legacyParsed.dataRootPath || '')
      if (legacyRoot) {
        dataRoot = legacyRoot
        await writeStorageRootPointer(dataRoot)
        const portablePath = getPortableSettingsPath(dataRoot)
        try {
          await fs.access(portablePath)
        } catch {
          await fs.mkdir(dataRoot, { recursive: true })
          await writeFileAtomic(portablePath, legacyRaw)
        }
      }
    } catch {
      /* no legacy settings */
    }
  }

  const settingsPath = dataRoot
    ? getPortableSettingsPath(dataRoot)
    : legacySettingsPath

  return {
    launcherDir,
    dataRoot,
    settingsPath,
    legacySettingsPath,
  }
}

export async function bindPortableDataRoot(dataRoot: string): Promise<PortableStorageContext> {
  const normalized = normalizePortableRoot(dataRoot)
  if (!normalized) throw new Error('无效的数据目录')
  await fs.mkdir(normalized, { recursive: true })
  await writeStorageRootPointer(normalized)
  return resolvePortableStorageContext()
}
