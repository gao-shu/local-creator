/**
 * E2E：素材库/音色库 IPC（索引模式）+ 软删仍可见 + 素材页无效条目清理
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { confirmDialog, gotoHash, waitForText } from '../../lib/e2e-helpers.mjs'
import {
  E2E_GLOBAL_MAT_BROKEN_ID,
  E2E_GLOBAL_MAT_VALID_ID,
  E2E_GLOBAL_MAT_VALID_IMAGE_REL,
  E2E_LEGACY_VOICE_ID,
  E2E_LEGACY_VOICE_NAME,
  E2E_SOFT_DELETE_MAT_ENTRY_ID,
  E2E_SOFT_DELETE_MAT_PROJECT_ID,
  prepareGlobalLibrariesE2eWorkspace,
} from '../../lib/global-libraries-e2e-fixtures.mjs'

export const globalLibrariesSmokeSuite = {
  name: 'global-libraries-smoke',
  description: '素材库/音色库索引 IPC、软删来源仍可见、无效条目清理 UI',
  prepareWorkspace: prepareGlobalLibrariesE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await waitForText(page, '欢迎回来', 30_000)

    // --- materials IPC ---
    const materialsRead = await page.evaluate(async () => {
      const res = await window.materialsAPI.read()
      return {
        success: res.success,
        fileExists: res.fileExists,
        characterCount: res.data?.characters?.length ?? 0,
        ids: (res.data?.characters ?? []).map((item) => item.id),
        softDeletedProjectIds: res.softDeletedProjectIds ?? [],
        firstPath: res.data?.characters?.[0]?.generatedImagePath ?? '',
      }
    })
    assert(materialsRead.success === true, `materials:read 失败: ${JSON.stringify(materialsRead)}`)
    assert(
      materialsRead.characterCount === 3,
      `可见素材条目应为 3（有效+无效+软删来源），实际: ${materialsRead.characterCount}`,
    )
    assert(
      materialsRead.ids.includes(E2E_SOFT_DELETE_MAT_ENTRY_ID),
      `软删来源项目条目应出现在 materials:read: ${materialsRead.ids.join(', ')}`,
    )
    assert(
      materialsRead.softDeletedProjectIds.includes(E2E_SOFT_DELETE_MAT_PROJECT_ID),
      `softDeletedProjectIds 应包含软删项目: ${materialsRead.softDeletedProjectIds.join(', ')}`,
    )
    assert(
      materialsRead.firstPath.replace(/\\/g, '/') === E2E_GLOBAL_MAT_VALID_IMAGE_REL,
      `有效条目路径应为项目相对路径: ${materialsRead.firstPath}`,
    )

    // --- voice IPC（索引模式） ---
    const voiceList = await page.evaluate(async () => {
      const res = await window.voiceAPI.list()
      return {
        success: res.success,
        count: res.voices?.length ?? 0,
        names: (res.voices ?? []).map((item) => item.name),
        firstAudio: res.voices?.[0]?.referenceAudio ?? '',
      }
    })
    assert(voiceList.success === true, `voice-library:list 失败`)
    assert(
      voiceList.names.includes(E2E_LEGACY_VOICE_NAME),
      `索引模式音色未列出: ${voiceList.names.join(', ')}`,
    )
    assert(
      /reference\.wav$/i.test(voiceList.firstAudio),
      `音色参考音频未解析为绝对路径: ${voiceList.firstAudio}`,
    )

    const voiceIndexPath = path.join(workspace.dataRoot, 'voice-library', 'voice-library.json')
    const voiceIndexRaw = await fs.readFile(voiceIndexPath, 'utf-8')
    const voiceIndex = JSON.parse(voiceIndexRaw)
    assert(
      Array.isArray(voiceIndex) && voiceIndex.some((item) => item.id === E2E_LEGACY_VOICE_ID),
      'voice-library.json 未包含索引条目',
    )

    // --- 素材页 UI：软删来源标回收站 + 无效条目清理 ---
    await gotoHash(page, '#/materials')
    await waitForText(page, '素材库', 20_000)
    await waitForText(page, 'E2E软删项目素材', 20_000)
    assert(
      (await page.getByText('回收站', { exact: true }).count()) >= 1,
      '软删来源素材应显示「回收站」角标',
    )
    await waitForText(page, '发现 1 个无效素材条目', 20_000)
    await waitForText(page, '清理无效条目', 10_000)

    await page.getByRole('button', { name: '清理无效条目' }).click()
    await confirmDialog(page, '确认清理')
    await page.waitForTimeout(1200)

    const afterRead = await page.evaluate(async () => {
      const res = await window.materialsAPI.read()
      const ids = (res.data?.characters ?? []).map((item) => item.id)
      return { success: res.success, ids }
    })
    assert(afterRead.success === true, '清理后 materials:read 失败')
    assert(
      afterRead.ids.includes(E2E_GLOBAL_MAT_VALID_ID),
      `有效条目被误删: ${afterRead.ids.join(', ')}`,
    )
    assert(
      !afterRead.ids.includes(E2E_GLOBAL_MAT_BROKEN_ID),
      `无效条目未删除: ${afterRead.ids.join(', ')}`,
    )

    // 清理后 banner 应消失
    assert(
      (await page.getByText('发现 1 个无效素材条目').count()) === 0,
      '清理后无效条目 banner 仍显示',
    )
  },
}
