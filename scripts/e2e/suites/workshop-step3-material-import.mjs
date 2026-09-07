/**
 * E2E Step3：从素材库导入资产到当前项目（索引模式来源）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  clickTestId,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_IMPORT_MAT_ENTRY_ID,
  E2E_IMPORT_MAT_NAME,
  prepareWorkshopStep3MaterialImportWorkspace,
} from '../../lib/global-libraries-e2e-fixtures.mjs'
import {
  E2E_PROJECT_ID,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopStep3MaterialImportSuite = {
  name: 'workshop-step3-material-import',
  description: 'Step3：从素材库（索引）选择资产并复制导入到当前项目',
  prepareWorkspace: prepareWorkshopStep3MaterialImportWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/3`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '角色设定', 20_000)

    const dataBefore = await readProjectData(workspace.projectDir)
    const countBefore = dataBefore?.characters?.length ?? 0
    assert(countBefore >= 1, `预置项目应至少有 1 个角色，当前: ${countBefore}`)
    assert(
      !dataBefore?.characters?.some((item) => item.name === E2E_IMPORT_MAT_NAME),
      '导入前不应已存在待导入角色',
    )

    await clickTestId(page, 'workshop-step3-import-from-library')
    await page.getByTestId('material-library-picker-dialog').waitFor({ state: 'visible', timeout: 15_000 })
    await waitForText(page, '从素材库添加资产', 10_000)

    await clickTestId(page, `material-library-picker-item-${E2E_IMPORT_MAT_ENTRY_ID}`)
    await clickTestId(page, 'material-library-picker-confirm')
    await waitForText(page, E2E_IMPORT_MAT_NAME, 20_000)
    await page.waitForTimeout(800)

    const dataAfter = await readProjectData(workspace.projectDir)
    const imported = dataAfter?.characters?.find((item) => item.name === E2E_IMPORT_MAT_NAME)
    assert(imported?.name === E2E_IMPORT_MAT_NAME, 'data.json 未写入导入角色')
    assert(
      (dataAfter?.characters?.length ?? 0) === countBefore + 1,
      `角色数量未 +1，before=${countBefore} after=${dataAfter?.characters?.length}`,
    )
    assert(
      Boolean(imported?.generatedImagePath || imported?.generatedImagePaths?.length),
      '导入角色应包含生成图路径',
    )

    const relPath = imported?.generatedImagePath || imported?.generatedImagePaths?.[0]
    if (relPath) {
      const absPath = path.join(workspace.projectDir, relPath.replace(/\//g, path.sep))
      try {
        await fs.access(absPath)
      } catch {
        assert(false, `导入图片未复制到项目目录: ${relPath}`)
      }
    }

    assert(
      (await page.getByTestId(`workshop-asset-item-${imported.id}`).count()) === 1,
      '导入后左侧列表应显示新角色',
    )
  },
}
