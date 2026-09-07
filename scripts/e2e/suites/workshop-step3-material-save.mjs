/**
 * E2E Step3：保存/更新到素材库（索引模式）+ 导入选择器可重复导入（同名自动重命名）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  clickTestId,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import { readMaterialsIndex } from '../../lib/canvas-e2e-fixtures.mjs'
import {
  assertMaterialEntryProjectMedia,
  E2E_STEP3_SYNC_CHAR_ID,
  E2E_STEP3_SYNC_CHAR_NAME,
  E2E_STEP3_SYNC_IMAGE_REL,
  prepareWorkshopStep3MaterialSaveWorkspace,
  waitForMaterialsWorkflowEntry,
} from '../../lib/global-libraries-e2e-fixtures.mjs'
import {
  E2E_PROJECT_ID,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopStep3MaterialSaveSuite = {
  name: 'workshop-step3-material-save',
  description: 'Step3：索引模式保存到素材库 → 更新 → 导入选择器可再次导入并重命名',
  prepareWorkspace: prepareWorkshopStep3MaterialSaveWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/3`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '角色设定', 20_000)

    await clickTestId(page, `workshop-asset-item-${E2E_STEP3_SYNC_CHAR_ID}`)
    await page.waitForTimeout(500)

    const indexBefore = await readMaterialsIndex(workspace.dataRoot)
    assert(
      !(indexBefore.characters ?? []).some(
        (item) =>
          item.sourceProjectId === E2E_PROJECT_ID &&
          item.sourceAssetId === E2E_STEP3_SYNC_CHAR_ID,
      ),
      '测试开始前 materials.json 不应已有该角色条目',
    )

    const syncButton = page.getByTestId('workshop-asset-sync-material')
    await syncButton.waitFor({ state: 'visible', timeout: 15_000 })
    assert(
      (await syncButton.textContent())?.includes('保存到素材库'),
      `首次保存前按钮应为「保存到素材库」，当前: ${await syncButton.textContent()}`,
    )

    await clickTestId(page, 'workshop-asset-sync-material')
    await waitForText(page, `「${E2E_STEP3_SYNC_CHAR_NAME}」已写入素材库索引（文件仍在原项目）`, 20_000)

    const entry = await waitForMaterialsWorkflowEntry(
      workspace.dataRoot,
      E2E_PROJECT_ID,
      E2E_STEP3_SYNC_CHAR_ID,
      'characters',
      15_000,
    )
    assert(Boolean(entry), '保存后 materials.json 未写入工坊角色条目')
    assert(entry?.name === E2E_STEP3_SYNC_CHAR_NAME, `素材库条目名称不正确: ${entry?.name}`)
    assert(
      String(entry?.generatedImagePath || '').replace(/\\/g, '/') === E2E_STEP3_SYNC_IMAGE_REL,
      `索引路径应为项目相对路径: ${entry?.generatedImagePath}`,
    )
    await assertMaterialEntryProjectMedia(workspace.dataRoot, entry, assert)

    const globalCopyDir = path.join(workspace.dataRoot, 'materials', 'assets', entry.id)
    let globalCopyExists = false
    try {
      await fs.access(globalCopyDir)
      globalCopyExists = true
    } catch {
      globalCopyExists = false
    }
    assert(!globalCopyExists, `索引模式不应创建全局副本目录: ${globalCopyDir}`)

    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="workshop-asset-sync-material"]')
        return btn?.textContent?.includes('更新到素材库') ?? false
      },
      { timeout: 15_000 },
    )

    await clickTestId(page, 'workshop-asset-sync-material')
    await waitForText(page, `「${E2E_STEP3_SYNC_CHAR_NAME}」已更新到素材库索引`, 20_000)

    const indexAfter = await readMaterialsIndex(workspace.dataRoot)
    const matched = (indexAfter.characters ?? []).filter(
      (item) =>
        item.sourceProjectId === E2E_PROJECT_ID &&
        item.sourceAssetId === E2E_STEP3_SYNC_CHAR_ID,
    )
    assert(matched.length === 1, `更新后应仍只有 1 条素材库记录，当前: ${matched.length}`)

    const dataBeforeImport = await readProjectData(workspace.projectDir)
    const countBeforeImport = dataBeforeImport?.characters?.length ?? 0

    await clickTestId(page, 'workshop-step3-import-from-library')
    await page.getByTestId('material-library-picker-dialog').waitFor({ state: 'visible', timeout: 15_000 })
    await waitForText(page, '从素材库添加资产', 10_000)

    const pickerItem = page.getByTestId(`material-library-picker-item-${entry.id}`)
    await pickerItem.waitFor({ state: 'visible', timeout: 10_000 })
    assert(!(await pickerItem.isDisabled()), '已同步到素材库的角色仍应可再次导入')

    await clickTestId(page, `material-library-picker-item-${entry.id}`)
    await clickTestId(page, 'material-library-picker-confirm')
    await page.waitForTimeout(800)

    const dataAfterImport = await readProjectData(workspace.projectDir)
    assert(
      (dataAfterImport?.characters?.length ?? 0) === countBeforeImport + 1,
      `再次导入应新增 1 个角色，before=${countBeforeImport} after=${dataAfterImport?.characters?.length}`,
    )
    const renamed = dataAfterImport?.characters?.find((item) => item.name === `${E2E_STEP3_SYNC_CHAR_NAME} (2)`)
    assert(Boolean(renamed), '同名再次导入应自动重命名为「名称 (2)」')
  },
}
