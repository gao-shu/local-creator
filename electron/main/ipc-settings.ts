import path from 'node:path'

import fs from 'node:fs/promises'

import { BrowserWindow, dialog, ipcMain } from 'electron'

import type { AppSettings, ModelConfig } from '../../src/types/settings'

import { mergeSettings } from '../../src/lib/storage/settings-defaults'
import { migrateApiBaseUrl, normalizeApiBase } from '../../src/lib/auth/api-base'

import { assembleDataPaths, applyStorageRootToSettings } from '../../src/lib/storage/data-layout'

import {

  getPortableSettingsPath,

  normalizePortableRoot,

} from '../../src/lib/storage/portable-storage'

import { writeFileAtomic } from './atomic-write'

import { decryptSettingsSecrets, encryptSettingsSecrets } from './settings-secrets'

import {

  bindPortableDataRoot,

  getLauncherAppDir,

  resolvePortableStorageContext,

  writeStorageRootPointer,

} from './portable-storage-runtime'

import { migrateFlatWorkflowLayoutToSubdir } from './workflow-layout-migration'

import { zipDirectoryToFile } from './export-data-root-zip'
import { ensurePortableDataLayout } from './portable-data-init'
import { applyOpenAtLogin, resolveOpenAtLogin } from './login-item'



export function getAppDataDir(): string {

  return getLauncherAppDir()

}



export async function readSettingsMerged(): Promise<{

  data: AppSettings

  ctx: Awaited<ReturnType<typeof resolvePortableStorageContext>>

  fileExists: boolean

}> {

  const ctx = await resolvePortableStorageContext()

  let partial: Partial<AppSettings> | null = null

  let fileExists = false

  try {

    const raw = await fs.readFile(ctx.settingsPath, 'utf-8')

    partial = JSON.parse(raw) as Partial<AppSettings>

    fileExists = true

  } catch (error: unknown) {

    const err = error as NodeJS.ErrnoException

    if (err.code !== 'ENOENT') throw error

  }

  const data = mergeSettings(partial, ctx.dataRoot)

  const applied = ctx.dataRoot ? applyStorageRootToSettings(data, ctx.dataRoot) : data

  const rawApiBase = typeof partial?.apiBaseUrl === 'string' ? partial.apiBaseUrl.trim() : ''
  const apiBaseMigrated =
    fileExists &&
    rawApiBase.length > 0 &&
    applied.apiBaseUrl !== normalizeApiBase(rawApiBase)

  // mergeSettings 已在内存合并设置；对照磁盘原文决定是否因 apiBase 迁移落盘
  if (ctx.dataRoot) {
    const assembled = assembleDataPaths(applied, ctx.dataRoot)
    await migrateFlatWorkflowLayoutToSubdir(ctx.dataRoot, assembled.workflowDir)
    if (
      fileExists &&
      (applied.workflowDataPath !== assembled.workflowDir || apiBaseMigrated)
    ) {
      const synced = applyStorageRootToSettings(applied, ctx.dataRoot)
      await writeFileAtomic(ctx.settingsPath, JSON.stringify(encryptSettingsSecrets(synced), null, 2))
      return { data: synced, ctx, fileExists }
    }
  }

  if (apiBaseMigrated) {
    await writeFileAtomic(ctx.settingsPath, JSON.stringify(encryptSettingsSecrets(applied), null, 2))
    return { data: applied, ctx, fileExists }
  }

  return { data: applied, ctx, fileExists }

}



export function registerSettingsIpc() {

  ipcMain.handle('settings:read', async () => {

    try {

      const { data, ctx, fileExists } = await readSettingsMerged()
      const decrypted = decryptSettingsSecrets(data)
      applyOpenAtLogin(resolveOpenAtLogin(decrypted.openAtLogin))

      return {

        success: true,

        fileExists,

        data: decrypted,

        filePath: ctx.settingsPath,

        launcherDir: ctx.launcherDir,

        dataRoot: ctx.dataRoot,

        appDataDir: ctx.dataRoot || ctx.launcherDir,

      }

    } catch (error: unknown) {

      const err = error as Error

      const ctx = await resolvePortableStorageContext()
      const fallback = mergeSettings(null, ctx.dataRoot)
      applyOpenAtLogin(resolveOpenAtLogin(fallback.openAtLogin))

      return {

        success: false,

        fileExists: false,

        data: fallback,

        filePath: ctx.settingsPath,

        launcherDir: ctx.launcherDir,

        dataRoot: ctx.dataRoot,

        appDataDir: ctx.dataRoot || ctx.launcherDir,

        error: err.message || '读取设置失败',

      }

    }

  })



  ipcMain.handle('settings:write', async (_event, data: AppSettings) => {

    try {

      const root = normalizePortableRoot(data.dataRootPath || '')

      if (!root) {

        return { success: false, error: '请先选择数据根目录' }

      }

      const applied = applyStorageRootToSettings(data, root)
      applied.apiBaseUrl = migrateApiBaseUrl(applied.apiBaseUrl)

      const settingsPath = getPortableSettingsPath(root)

      await fs.mkdir(root, { recursive: true })

      await writeFileAtomic(settingsPath, JSON.stringify(encryptSettingsSecrets(applied), null, 2))

      await writeStorageRootPointer(root)

      const assembled = assembleDataPaths(applied, root)

      await ensurePortableDataLayout(assembled)
      applyOpenAtLogin(resolveOpenAtLogin(applied.openAtLogin))

      return { success: true, filePath: settingsPath, dataRoot: root }

    } catch (error: unknown) {

      const err = error as Error

      return { success: false, error: err.message || '保存设置失败' }

    }

  })



  ipcMain.handle('settings:bind-data-root', async (_event, dataRoot: string) => {

    try {

      const normalized = normalizePortableRoot(dataRoot)

      if (!normalized) {

        return { success: false, error: '无效的数据目录' }

      }

      const ctx = await bindPortableDataRoot(normalized)

      let partial: Partial<AppSettings> | null = null

      let fileExists = false

      try {

        const raw = await fs.readFile(ctx.settingsPath, 'utf-8')

        partial = JSON.parse(raw) as Partial<AppSettings>

        fileExists = true

      } catch {

        /* 新目录，稍后写入默认配置 */

      }

      const data = mergeSettings(partial, normalized)

      const applied = applyStorageRootToSettings(data, normalized)

      await writeFileAtomic(ctx.settingsPath, JSON.stringify(encryptSettingsSecrets(applied), null, 2))

      const assembled = assembleDataPaths(applied, normalized)
      await ensurePortableDataLayout(assembled)
      await migrateFlatWorkflowLayoutToSubdir(normalized, assembled.workflowDir)
      applyOpenAtLogin(resolveOpenAtLogin(applied.openAtLogin))

      return {

        success: true,

        fileExists,

        data: applied,

        dataRoot: normalized,

        filePath: ctx.settingsPath,

        launcherDir: ctx.launcherDir,

      }

    } catch (error: unknown) {

      const err = error as Error

      return { success: false, error: err.message || '绑定数据目录失败' }

    }

  })



  ipcMain.handle('settings:get-file-path', async () => {

    const ctx = await resolvePortableStorageContext()

    return {

      success: true,

      filePath: ctx.settingsPath,

      launcherDir: ctx.launcherDir,

      dataRoot: ctx.dataRoot,

      appDataDir: ctx.dataRoot || ctx.launcherDir,

    }

  })



  ipcMain.handle('dialog:select-directory', async (event, options?: { defaultPath?: string }) => {
    try {
      const parent = BrowserWindow.fromWebContents(event.sender)
      const defaultPath = options?.defaultPath?.trim()
      const result = await dialog.showOpenDialog({
        parent: parent && !parent.isDestroyed() ? parent : undefined,
        modal: true,
        defaultPath: defaultPath && defaultPath.length > 0 ? defaultPath : undefined,
        properties: ['openDirectory', 'createDirectory'],
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: true, canceled: true }
      }

      return { success: true, path: result.filePaths[0] }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('settings:export-data-root-package', async (event) => {
    try {
      const { data, ctx } = await readSettingsMerged()
      const root = normalizePortableRoot(data.dataRootPath || ctx.dataRoot)
      if (!root) {
        return { success: false, error: '请先选择并保存数据根目录' }
      }

      try {
        await fs.access(root)
      } catch {
        return { success: false, error: '数据根目录不存在' }
      }

      const parent = BrowserWindow.fromWebContents(event.sender)
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const folderName = path.basename(root) || 'lc-data'
      const defaultName = `本地漫创-${folderName}-${stamp}.zip`

      const save = await dialog.showSaveDialog({
        parent: parent && !parent.isDestroyed() ? parent : undefined,
        title: '打包导出便携数据',
        defaultPath: defaultName,
        filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
      })

      if (save.canceled || !save.filePath) {
        return { success: true, canceled: true }
      }

      let outPath = save.filePath
      if (!/\.zip$/i.test(outPath)) outPath += '.zip'

      await zipDirectoryToFile(root, outPath)
      return { success: true, filePath: outPath }
    } catch (error: unknown) {
      const err = error as Error
      return { success: false, error: err.message || '打包失败' }
    }
  })

}


