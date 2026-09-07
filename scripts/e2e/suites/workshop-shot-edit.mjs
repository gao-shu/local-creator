/**
 * E2E Step4：分镜增删与改 prompt
 */
import {
  clickTestId,
  confirmDialog,
  gotoHash,
  listStoryboardShotIds,
  waitForManualSaveDone,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

const PROMPT_MARKER = 'E2E分镜prompt已改'

export const workshopShotEditSuite = {
  name: 'workshop-shot-edit',
  description: 'Step4：改 prompt 落盘、工具栏添加分镜、删除分镜',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session
    const deleteShotId = E2E_SHOT_IDS[2]

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({ state: 'visible' })

    // --- 改 prompt + 手动保存 ---
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).locator('textarea').fill(PROMPT_MARKER)
    await clickTestId(page, 'workshop-manual-save')
    await waitForManualSaveDone(page)

    let data = await readProjectData(workspace.projectDir)
    const edited = data?.shots?.find((item) => item.id === E2E_SHOT_IDS[0])
    assert(edited?.prompt?.includes(PROMPT_MARKER), `prompt 未落盘，当前: ${edited?.prompt?.slice(0, 40)}`)

    // --- 添加分镜 ---
    const beforeCount = data?.shots?.length ?? 0
    await clickTestId(page, 'workshop-step4-add-shot')
    const started = Date.now()
    let afterAddCount = beforeCount
    while (Date.now() - started < 10_000) {
      afterAddCount = (await listStoryboardShotIds(page)).length
      if (afterAddCount >= beforeCount + 1) break
      await page.waitForTimeout(200)
    }
    assert(afterAddCount >= beforeCount + 1, `添加分镜后镜头数未增加（${beforeCount} → ${afterAddCount}）`)

    await clickTestId(page, 'workshop-manual-save')
    await waitForManualSaveDone(page)

    const saveStarted = Date.now()
    while (Date.now() - saveStarted < 10_000) {
      data = await readProjectData(workspace.projectDir)
      if ((data?.shots?.length ?? 0) >= beforeCount + 1) break
      await page.waitForTimeout(200)
    }
    assert((data?.shots?.length ?? 0) >= beforeCount + 1, '添加分镜后 data.json shots 未增加')

    // --- 删除预置镜 3 ---
    await clickTestId(page, `storyboard-shot-${deleteShotId}-delete`)
    await confirmDialog(page, '删除')
    await clickTestId(page, 'workshop-manual-save')
    await waitForManualSaveDone(page)

    data = await readProjectData(workspace.projectDir)
    assert(
      !data?.shots?.some((item) => item.id === deleteShotId),
      '删除后 data.json 仍包含该镜头',
    )
    assert(
      (await page.getByTestId(`storyboard-shot-${deleteShotId}`).count()) === 0,
      '删除后 UI 仍显示该镜头卡片',
    )
  },
}
