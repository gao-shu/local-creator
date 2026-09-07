/**
 * E2E Step3：批量重新生成（含已完成资产）
 */
import {
  clickTestId,
  clickWorkshopStepNav,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  prepareWorkshopE2eWorkspace,
  readProjectData,
  waitForProjectAssetsDone,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopStep3RegenerateSuite = {
  name: 'workshop-step3-regenerate',
  description: 'Step3：批量生图后批量重新生成，资产保持 done',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/3`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '角色设定', 20_000)

    await clickTestId(page, 'workshop-step3-batch-generate')
    const firstDone = await waitForProjectAssetsDone(workspace.projectDir, 1, 60_000)
    assert(firstDone >= 1, `首次批量生图未完成（done=${firstDone}）`)

    let data = await readProjectData(workspace.projectDir)
    const doneBefore = [...(data?.characters ?? []), ...(data?.scenes ?? [])].filter(
      (item) => item.status === 'done',
    ).length
    assert(doneBefore >= 1, '首次批量生图后 data.json 无 done 资产')

    await clickTestId(page, 'workshop-step3-batch-regenerate')
    const afterRegen = await waitForProjectAssetsDone(workspace.projectDir, 1, 60_000)
    assert(afterRegen >= 1, `批量重新生成后 done 资产不足 1（${afterRegen}）`)

    data = await readProjectData(workspace.projectDir)
    const doneAfter = [...(data?.characters ?? []), ...(data?.scenes ?? [])].filter(
      (item) => item.status === 'done',
    ).length
    assert(doneAfter >= 1, '批量重新生成后 data.json 无 done 资产')

    await clickWorkshopStepNav(page, 'step3')
    await waitForText(page, '批量重新生成', 10_000)
  },
}
