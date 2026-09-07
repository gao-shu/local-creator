/**
 * E2E Step4：从素材库选择分镜参考图（索引模式来源）
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
  E2E_STEP4_REF_MAT_ENTRY_ID,
  prepareWorkshopStep4MaterialReferenceWorkspace,
} from '../../lib/global-libraries-e2e-fixtures.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopStep4MaterialReferenceSuite = {
  name: 'workshop-step4-material-reference',
  description: 'Step4：从素材库选择参考图并落盘到分镜',
  prepareWorkspace: prepareWorkshopStep4MaterialReferenceWorkspace,
  async run(session) {
    const { page, workspace, assert } = session
    const shotId = E2E_SHOT_IDS[0]
    const refLibraryTestId = `storyboard-shot-${shotId}-reference-library`

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${shotId}`).waitFor({ state: 'visible' })

    const dataBefore = await readProjectData(workspace.projectDir)
    const shotBefore = dataBefore?.shots?.find((item) => item.id === shotId)
    assert(
      !(shotBefore?.referenceImagePath || shotBefore?.referenceImagePaths?.length),
      '预置分镜不应已有参考图',
    )

    await clickTestId(page, refLibraryTestId)
    await page.getByTestId('material-library-picker-dialog').waitFor({ state: 'visible', timeout: 15_000 })
    await waitForText(page, '选择参考图', 10_000)

    await clickTestId(page, `material-library-picker-item-${E2E_STEP4_REF_MAT_ENTRY_ID}`)
    await clickTestId(page, 'material-library-picker-confirm')
    await waitForText(page, '参考图已从素材库添加', 20_000)
    await page.waitForTimeout(800)

    const dataAfter = await readProjectData(workspace.projectDir)
    const shotAfter = dataAfter?.shots?.find((item) => item.id === shotId)
    const refPath = shotAfter?.referenceImagePath || shotAfter?.referenceImagePaths?.[0]
    assert(Boolean(refPath), 'data.json 未写入分镜参考图路径')

    const absPath = path.join(workspace.projectDir, refPath.replace(/\//g, path.sep))
    try {
      await fs.access(absPath)
    } catch {
      assert(false, `参考图未复制到项目目录: ${refPath}`)
    }
  },
}
