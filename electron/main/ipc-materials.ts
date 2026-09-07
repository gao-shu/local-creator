import path from 'node:path'

import fs from 'node:fs/promises'

import { ipcMain } from 'electron'

import {

  createEmptyMaterialsIndex,

  normalizeMaterialsIndex,

  type MaterialsIndexFile,

  type SyncedMaterialEntry,

} from '../../src/types/material-library'

import type { MaterialsSyncAssetPayload } from '../../src/lib/materials/materials-sync-types'

import { remapMaterialsIndexForRead } from '../../src/lib/materials/global-materials-paths'
import {
  ensureMaterialsLibraryLayout,
  removeMaterialLibraryEntries,
  syncAssetToGlobalMaterialsLibrary,
} from './materials-sync'
import { readSoftDeletedProjectIds } from './project-index-read'
import { readSettingsMerged } from './ipc-settings'
import { readModifyWriteJsonAtomic, writeJsonAtomic } from './atomic-write'



function materialsFilePath(dataRoot: string) {

  return path.join(dataRoot, 'materials.json')

}



export function registerMaterialsIpc() {

  ipcMain.handle('materials:read', async () => {

    try {

      const { ctx } = await readSettingsMerged()

      await ensureMaterialsLibraryLayout(ctx.dataRoot)

      const filePath = materialsFilePath(ctx.dataRoot)

      try {

        const raw = await fs.readFile(filePath, 'utf-8')

        const normalized = normalizeMaterialsIndex(JSON.parse(raw))

        const softDeletedProjectIds = [...(await readSoftDeletedProjectIds())]

        return {

          success: true,

          fileExists: true,

          data: remapMaterialsIndexForRead(normalized),

          softDeletedProjectIds,

        }

      } catch (error: unknown) {

        const err = error as NodeJS.ErrnoException

        if (err.code === 'ENOENT') {

          return { success: true, fileExists: false, data: createEmptyMaterialsIndex(), softDeletedProjectIds: [] }

        }

        throw error

      }

    } catch (error: unknown) {

      const err = error as Error

      return { success: false, data: createEmptyMaterialsIndex(), softDeletedProjectIds: [], error: err.message }

    }

  })



  ipcMain.handle('materials:write', async (_event, data: MaterialsIndexFile) => {

    try {

      const { ctx } = await readSettingsMerged()

      const filePath = materialsFilePath(ctx.dataRoot)

      const normalized = normalizeMaterialsIndex(data)

      await writeJsonAtomic(filePath, normalized)

      return { success: true }

    } catch (error: unknown) {

      const err = error as Error

      return { success: false, error: err.message }

    }

  })



  ipcMain.handle(

    'materials:upsert-entry',

    async (_event, payload: { kind: keyof MaterialsIndexFile; entry: SyncedMaterialEntry }) => {

      try {

        const { ctx } = await readSettingsMerged()

        const filePath = materialsFilePath(ctx.dataRoot)

        const listKey = payload.kind

        if (!['characters', 'scenes', 'props'].includes(listKey)) {

          return { success: false, error: `无效的素材分类: ${String(listKey)}` }

        }

        const entry = payload.entry



        await readModifyWriteJsonAtomic<MaterialsIndexFile>(

          filePath,

          createEmptyMaterialsIndex(),

          async (index) => {

            const normalized = normalizeMaterialsIndex(index)

            const list = [...(normalized[listKey] ?? [])]

            const idx = list.findIndex(

              (item) =>

                item.sourceProjectId === entry.sourceProjectId &&

                item.sourceAssetId === entry.sourceAssetId,

            )

            if (idx >= 0) {

              list[idx] = { ...entry, id: list[idx].id, syncedAt: list[idx].syncedAt }

            } else {

              list.unshift(entry)

            }

            return { ...normalized, [listKey]: list }

          },

        )

        return { success: true }

      } catch (error: unknown) {

        const err = error as Error

        return { success: false, error: err.message }

      }

    },

  )



  ipcMain.handle('materials:sync-asset', async (_event, payload: MaterialsSyncAssetPayload) => {

    try {

      const entry = await syncAssetToGlobalMaterialsLibrary(payload)

      return { success: true, entry }

    } catch (error: unknown) {

      const err = error as Error

      return { success: false, error: err.message }

    }

  })



  ipcMain.handle(

    'materials:remove-entries',

    async (_event, payload: { entryIds: string[] }) => {

      try {

        const { ctx } = await readSettingsMerged()

        await ensureMaterialsLibraryLayout(ctx.dataRoot)

        const removedCount = await removeMaterialLibraryEntries(ctx.dataRoot, payload.entryIds ?? [])

        return { success: true, removedCount }

      } catch (error: unknown) {

        const err = error as Error

        return { success: false, error: err.message }

      }

    },

  )

}

