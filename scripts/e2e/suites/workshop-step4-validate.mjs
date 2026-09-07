/**
 * E2E Step4 补空间锚点：mock → 确认弹窗 → 暂不应用 / 应用落盘
 */
import {
  clickTestId,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

/** 与 storyboard-service mock 分支文案一致 */
const MOCK_SPATIAL_ANCHOR = '主场景居中，人物面向镜头，顶侧柔光'

export const workshopStep4ValidateSuite = {
  name: 'workshop-step4-validate',
  description: 'Step4：补空间锚点 mock → 弹窗预览 → 暂不应用 / 应用写入 spatialAnchor',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '补空间锚点', 20_000)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({ state: 'visible' })

    let data = await readProjectData(workspace.projectDir)
    for (const shotId of E2E_SHOT_IDS) {
      const shot = data?.shots?.find((item) => item.id === shotId)
      assert(Boolean(shot), `预置分镜 ${shotId} 应存在`)
      assert(!shot?.spatialAnchor, `预置分镜 ${shotId} 初始不应有空间锚点`)
    }

    // --- 暂不应用：mock 出结果但不落盘（含 passed/summary/issues） ---
    await clickTestId(page, 'workshop-step4-validate-storyboard')
    await page.getByText('空间锚点结果').waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByTestId('workshop-step4-validate-result-list').waitFor({ state: 'visible' })
    await page.getByTestId('workshop-step4-validate-summary').waitFor({ state: 'visible' })
    await page.getByTestId('workshop-step4-validate-issues').waitFor({ state: 'visible' })
    await page.getByText('姿势继承').first().waitFor({ state: 'visible' })
    await page.getByText(MOCK_SPATIAL_ANCHOR).first().waitFor({ state: 'visible', timeout: 5_000 })
    await clickTestId(page, 'workshop-step4-validate-dismiss')
    await page.waitForTimeout(500)
    assert(
      (await page.getByTestId('workshop-step4-validate-result-list').count()) === 0,
      '暂不应用后确认弹窗应收起',
    )

    data = await readProjectData(workspace.projectDir)
    for (const shotId of E2E_SHOT_IDS) {
      const shot = data?.shots?.find((item) => item.id === shotId)
      assert(!shot?.spatialAnchor, `暂不应用后 ${shotId} 不应写入 spatialAnchor`)
    }

    // --- 应用修改：仅写入空间锚点 ---
    await clickTestId(page, 'workshop-step4-validate-storyboard')
    await page.getByText('空间锚点结果').waitFor({ state: 'visible', timeout: 15_000 })
    await clickTestId(page, 'workshop-step4-validate-apply')
    await page.waitForTimeout(1000)

    assert(
      (await page.getByTestId('workshop-step4-validate-result-list').count()) === 0,
      '应用后确认弹窗应收起',
    )

    data = await readProjectData(workspace.projectDir)
    for (const shotId of E2E_SHOT_IDS) {
      const shot = data?.shots?.find((item) => item.id === shotId)
      assert(
        shot?.spatialAnchor === MOCK_SPATIAL_ANCHOR,
        `应用后 ${shotId} 应写入 mock 空间锚点，实为: ${shot?.spatialAnchor ?? '(空)'}`,
      )
      // mention 自动同步可能微调文案；二次验证本身不应整段替换成模型润色稿
      assert(
        typeof shot?.prompt === 'string' && shot.prompt.includes(`E2E测试镜头${shot.shotNumber}`),
        `应用后 ${shotId} 应保留原 prompt 主体`,
      )
    }
  },
}
