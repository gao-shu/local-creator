/**

 * 全局素材库 / 音色库回归（纯逻辑，无需 Electron / dev server）

 *

 * 用法：npm run test:global-libraries

 */

import assert from 'node:assert/strict'



import {

  remapMaterialEntryMediaForRead,

  remapMaterialEntryMediaForWrite,

  remapMaterialsIndexForRead,

  resolveMaterialsIndexPath,

  resolveMaterialsLibraryRoot,

} from '@/lib/materials/global-materials-paths'

import { isMaterialIndexStoredMediaPath } from '@/lib/materials/material-index-media-paths'

import {

  collectBrokenMaterialEntriesFromIndex,

  isBrokenMaterialLibraryEntry,

  isBrokenMaterialLibraryItemAfterPreview,

} from '@/lib/materials/material-library-health'

import { materialPreviewKey } from '@/components/materials/material-asset-view'

import {

  filterMaterialsIndexExcludingProjects,

  isAssetSyncedToLibrary,

  isMaterialSourceInRecycleBin,

  isSourceAssetSyncedToLibrary,

  materialLibrarySyncButtonLabel,

  materialLibrarySyncButtonTip,

  materialLibrarySyncSuccessMessage,

  MaterialLibraryItem,

} from '@/lib/materials/material-library-service'

import {

  buildCanvasMaterialAssetId,

  isCanvasImageNodeSyncedToMaterialLibrary,

} from '@/lib/canvas/canvas-image-material-save'

import {
  filterVoiceLibraryExcludingProjects,
  isGlobalVoiceLibraryEntryId,
  isVoiceIndexStoredMediaPath,
  resolveGlobalVoiceLibraryIndexPath,
  resolveGlobalVoiceLibraryRoot,
} from '@/lib/voice/global-voice-library-paths'
import { createEmptyMaterialsIndex, type SyncedMaterialEntry } from '@/types/material-library'
import type { VoiceLibraryEntry } from '@/types/voice-library'

import type { WorkflowAsset } from '@/types/workflow'



const DATA_ROOT = 'D:/lc-data'

const VOICE_ROOT = resolveGlobalVoiceLibraryRoot(DATA_ROOT)



function ok(name: string, fn: () => void) {

  try {

    fn()

    console.log(`  ✓ ${name}`)

  } catch (err) {

    const message = err instanceof Error ? err.message : String(err)

    console.error(`  ✗ ${name}`)

    console.error(`    ${message}`)

    process.exitCode = 1

  }

}



function makeEntry(partial: Partial<SyncedMaterialEntry> & Pick<SyncedMaterialEntry, 'id'>): SyncedMaterialEntry {

  const now = Date.now()

  return {

    id: partial.id,

    kind: partial.kind ?? 'character',

    name: partial.name ?? '测试资产',

    description: partial.description ?? '',

    prompt: partial.prompt ?? '',

    status: partial.status ?? 'ready',

    sourceProjectId: partial.sourceProjectId ?? 'wf_test',

    sourceProjectTitle: partial.sourceProjectTitle ?? '测试项目',

    sourceAssetId: partial.sourceAssetId ?? 'char_test',

    syncedAt: partial.syncedAt ?? now,

    updatedAt: partial.updatedAt ?? now,

    ...partial,

  }

}



console.log('\n全局素材库 / 音色库 · 纯逻辑回归\n')



ok('resolveMaterialsIndexPath 指向 dataRoot 根级 materials.json', () => {

  assert.equal(resolveMaterialsIndexPath(DATA_ROOT).replace(/\\/g, '/'), 'D:/lc-data/materials.json')

})



ok('resolveMaterialsLibraryRoot 指向 dataRoot/materials（遗留目录名）', () => {

  assert.equal(resolveMaterialsLibraryRoot(DATA_ROOT).replace(/\\/g, '/'), 'D:/lc-data/materials')

})



ok('isMaterialIndexStoredMediaPath 识别项目相对路径', () => {

  assert.equal(isMaterialIndexStoredMediaPath('pictures/hero.png'), true)

  assert.equal(isMaterialIndexStoredMediaPath('assets/char_1/gen/001.png'), true)

  assert.equal(isMaterialIndexStoredMediaPath('C:/fake/absolute.png'), false)

})



ok('remapMaterialEntryMediaForRead/Write 索引模式原样透传', () => {

  const entry = makeEntry({

    id: 'lib_rw',

    generatedImagePath: 'pictures/char_1.png',

  })

  const read = remapMaterialEntryMediaForRead(entry)

  assert.equal(read.generatedImagePath, 'pictures/char_1.png')

  const written = remapMaterialEntryMediaForWrite(read)

  assert.equal(written.generatedImagePath, 'pictures/char_1.png')

})



ok('remapMaterialsIndexForRead 原样透传三类列表', () => {

  const index = createEmptyMaterialsIndex()

  index.characters.push(makeEntry({ id: 'lib_1', generatedImagePath: 'pictures/a.png' }))

  const remapped = remapMaterialsIndexForRead(index)

  assert.equal(remapped.characters[0]?.generatedImagePath, 'pictures/a.png')

})



ok('isMaterialSourceInRecycleBin：软删来源标回收站', () => {
  assert.equal(isMaterialSourceInRecycleBin('wf_deleted', new Set(['wf_deleted'])), true)
  assert.equal(isMaterialSourceInRecycleBin('wf_active', new Set(['wf_deleted'])), false)
  assert.equal(isMaterialSourceInRecycleBin('', new Set(['wf_deleted'])), false)
})

ok('filterMaterialsIndexExcludingProjects 可按需排除指定项目', () => {

  const index = createEmptyMaterialsIndex()

  index.characters.push(

    makeEntry({ id: 'lib_active', sourceProjectId: 'wf_active', sourceAssetId: 'char_a' }),

    makeEntry({ id: 'lib_deleted', sourceProjectId: 'wf_deleted', sourceAssetId: 'char_b' }),

  )

  index.scenes.push(

    makeEntry({

      id: 'lib_canvas_deleted',

      kind: 'scene',

      sourceProjectId: 'cv_deleted',

      sourceAssetId: 'scene_a',

    }),

  )

  const filtered = filterMaterialsIndexExcludingProjects(

    index,

    new Set(['wf_deleted', 'cv_deleted']),

  )

  assert.equal(filtered.characters.length, 1)

  assert.equal(filtered.characters[0]?.id, 'lib_active')

  assert.equal(filtered.scenes.length, 0)

  assert.equal(filtered.props.length, 0)

})



ok('isBrokenMaterialLibraryEntry：无图片 / 无效路径视为无效', () => {

  assert.equal(isBrokenMaterialLibraryEntry(makeEntry({ id: 'lib_empty' })), true)

  assert.equal(

    isBrokenMaterialLibraryEntry(

      makeEntry({ id: 'lib_invalid', generatedImagePath: 'C:/fake/absolute.png' }),

    ),

    true,

  )

  assert.equal(

    isBrokenMaterialLibraryEntry(

      makeEntry({ id: 'lib_valid', generatedImagePath: 'pictures/char_1.png' }),

    ),

    false,

  )

})



ok('isBrokenMaterialLibraryItemAfterPreview：预览成功则视为有效', () => {

  const item: MaterialLibraryItem = {

    libraryEntryId: 'lib_legacy',

    projectId: 'wf_demo',

    projectTitle: '演示',

    asset: {

      id: 'char_1',

      kind: 'character',

      name: '角色',

      description: '',

      prompt: '',

      generatedImagePath: 'D:/data/materials/assets/lib_legacy/gen/001.png',

      status: 'ready',

      updatedAt: Date.now(),

    },

  }

  const key = materialPreviewKey(item)

  assert.equal(isBrokenMaterialLibraryItemAfterPreview(item, {}), true)

  assert.equal(

    isBrokenMaterialLibraryItemAfterPreview(item, { [key]: 'local-image://preview' }),

    false,

  )

})



ok('collectBrokenMaterialEntriesFromIndex 汇总三类列表', () => {

  const index = createEmptyMaterialsIndex()

  index.characters.push(makeEntry({ id: 'lib_broken' }))

  index.scenes.push(

    makeEntry({ id: 'lib_ok', kind: 'scene', generatedImagePath: 'assets/scene_1/gen/1.png' }),

  )

  const broken = collectBrokenMaterialEntriesFromIndex(index)

  assert.equal(broken.length, 1)

  assert.equal(broken[0]?.id, 'lib_broken')

})



ok('materialLibrarySyncButtonLabel / SuccessMessage 区分保存与更新', () => {

  assert.equal(materialLibrarySyncButtonLabel(false), '保存到素材库')

  assert.equal(materialLibrarySyncButtonLabel(true), '更新到素材库')

  assert.equal(
    materialLibrarySyncSuccessMessage('主角', false),
    '「主角」已写入素材库索引（文件仍在原项目）',
  )

  assert.equal(
    materialLibrarySyncSuccessMessage('主角', true),
    '「主角」已更新到素材库索引',
  )

  assert.equal(
    materialLibrarySyncButtonTip({ synced: false, hasMedia: false }),
    '请先有参考图或生成图后再保存到素材库',
  )
  assert.equal(
    materialLibrarySyncButtonTip({ synced: false, hasMedia: true, needsAssetRoleMark: true }),
    '请先标记为人物/场景/道具后再保存到素材库',
  )
})



ok('isAssetSyncedToLibrary / isSourceAssetSyncedToLibrary', () => {

  const index = createEmptyMaterialsIndex()

  index.characters.push(

    makeEntry({ id: 'lib_1', sourceProjectId: 'wf_a', sourceAssetId: 'char_1' }),

  )

  const asset: WorkflowAsset = {

    id: 'char_1',

    kind: 'character',

    name: '主角',

    description: '',

    prompt: '',

    status: 'ready',

    updatedAt: 0,

  }

  assert.equal(isAssetSyncedToLibrary(asset, 'wf_a', index), true)

  assert.equal(isAssetSyncedToLibrary(asset, 'wf_b', index), false)

  assert.equal(isSourceAssetSyncedToLibrary('wf_a', 'char_1', index), true)

  assert.equal(isSourceAssetSyncedToLibrary('wf_a', 'char_2', index), false)

})



ok('isCanvasImageNodeSyncedToMaterialLibrary 按 canvas_asset_{nodeId} 匹配', () => {

  const index = createEmptyMaterialsIndex()

  index.characters.push(

    makeEntry({

      id: 'lib_canvas',

      sourceProjectId: 'cv_proj',

      sourceAssetId: buildCanvasMaterialAssetId('img_node_1'),

    }),

  )

  assert.equal(

    isCanvasImageNodeSyncedToMaterialLibrary({

      nodeId: 'img_node_1',

      projectId: 'cv_proj',

      role: 'character',

      index,

    }),

    true,

  )

  assert.equal(

    isCanvasImageNodeSyncedToMaterialLibrary({

      nodeId: 'img_node_2',

      projectId: 'cv_proj',

      role: 'character',

      index,

    }),

    false,

  )

})



ok('resolveGlobalVoiceLibraryRoot / IndexPath', () => {
  assert.equal(resolveGlobalVoiceLibraryRoot(DATA_ROOT).replace(/\\/g, '/'), 'D:/lc-data/voice-library')
  assert.equal(
    resolveGlobalVoiceLibraryIndexPath(VOICE_ROOT).replace(/\\/g, '/'),
    'D:/lc-data/voice-library/voice-library.json',
  )
})

ok('isVoiceIndexStoredMediaPath / isGlobalVoiceLibraryEntryId', () => {
  assert.equal(isGlobalVoiceLibraryEntryId('voice_1739000000'), true)
  assert.equal(isGlobalVoiceLibraryEntryId('shot_abc'), false)
  assert.equal(isVoiceIndexStoredMediaPath('voices/voice_123/reference.wav'), true)
  assert.equal(isVoiceIndexStoredMediaPath('voices/shot_1/ref.wav'), false)
})

ok('filterVoiceLibraryExcludingProjects 可按需排除指定项目', () => {
  const voices: VoiceLibraryEntry[] = [
    {
      id: 'voice_active',
      name: '有效音色',
      createdAt: '2026-01-01T00:00:00.000Z',
      referenceAudio: 'voices/voice_active/reference.wav',
      sourceProjectId: 'wf_active',
    },
    {
      id: 'voice_deleted',
      name: '已删项目音色',
      createdAt: '2026-01-01T00:00:00.000Z',
      referenceAudio: 'voices/voice_deleted/reference.wav',
      sourceProjectId: 'wf_deleted',
    },
  ]
  const filtered = filterVoiceLibraryExcludingProjects(voices, new Set(['wf_deleted']))
  assert.equal(filtered.length, 1)
  assert.equal(filtered[0]?.id, 'voice_active')
})



if (process.exitCode) {

  console.error('\n❌ 全局库纯逻辑回归失败\n')

  process.exit(process.exitCode)

}



console.log('\n✅ 全局库纯逻辑回归全部通过\n')

