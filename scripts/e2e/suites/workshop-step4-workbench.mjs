/**
 * E2E Step4 工作台：推理覆盖确认、分集剧本编辑、文案放大编辑窗
 */
import {
  cancelConfirmDialog,
  clickTestId,
  fillTestId,
  gotoHash,
  listStoryboardShotIds,
  waitForManualSaveDone,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_EPISODE_ID,
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

const EPISODE_CONTENT_MARKER = 'E2E Step4分集剧本已改'
const PROMPT_MARKER = 'E2E放大窗prompt已改'

export const workshopStep4WorkbenchSuite = {
  name: 'workshop-step4-workbench',
  description: 'Step4：推理覆盖确认、分集剧本编辑落盘、文案放大编辑窗',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({ state: 'visible' })

    const beforeInferCount = (await listStoryboardShotIds(page)).length
    assert(beforeInferCount > 0, '预置项目 Step4 应已有分镜')

    // --- 已有分镜时推理应弹出覆盖确认；取消后镜头数不变 ---
    await clickTestId(page, 'workshop-step4-infer')
    await page.getByText('重新推理分镜？').waitFor({ state: 'visible', timeout: 20_000 })
    await page.getByText(/已有 .* 个分镜/).waitFor({ state: 'visible', timeout: 15_000 })
    await cancelConfirmDialog(page)
    await page.getByText('重新推理分镜？').waitFor({ state: 'hidden', timeout: 10_000 })
    assert(
      (await listStoryboardShotIds(page)).length === beforeInferCount,
      '取消推理覆盖后分镜数量不应变化',
    )

    // --- 分集剧本可编辑且落盘 ---
    let data = await readProjectData(workspace.projectDir)
    const episodeBefore = data?.episodes?.find((item) => item.id === E2E_EPISODE_ID)
    const sourceContent = episodeBefore?.content ?? ''
    assert(sourceContent.trim().length > 0, '预置分集剧本不应为空')

    await page.getByTestId('workshop-step4-episode-source').waitFor({ state: 'visible' })
    await fillTestId(page, 'workshop-step4-episode-source', `${sourceContent}\n${EPISODE_CONTENT_MARKER}`)
    await clickTestId(page, 'workshop-manual-save')
    await waitForManualSaveDone(page)

    data = await readProjectData(workspace.projectDir)
    const episodeAfterEdit = data?.episodes?.find((item) => item.id === E2E_EPISODE_ID)
    assert(
      episodeAfterEdit?.content?.includes(EPISODE_CONTENT_MARKER),
      '分集剧本编辑应落盘到 episode.content',
    )

    // --- 文案放大编辑窗：展开 → 改 prompt → 落盘 ---
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).getByTestId('storyboard-shot-expand').click()
    await page.getByTestId('storyboard-shot-script-dialog').waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByTestId('storyboard-shot-script-dialog-generate-image').waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByTestId('storyboard-shot-script-dialog').locator('textarea').first().fill(PROMPT_MARKER)
    // 放大窗遮罩会挡住顶栏「手动保存」，先收起再落盘
    await page.keyboard.press('Escape')
    await page.getByTestId('storyboard-shot-script-dialog').waitFor({ state: 'hidden', timeout: 15_000 })
    await clickTestId(page, 'workshop-manual-save')
    await waitForManualSaveDone(page)

    data = await readProjectData(workspace.projectDir)
    const edited = data?.shots?.find((item) => item.id === E2E_SHOT_IDS[0])
    assert(edited?.prompt?.includes(PROMPT_MARKER), `放大窗 prompt 未落盘: ${edited?.prompt?.slice(0, 40)}`)

    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).getByTestId('storyboard-shot-expand').click()
    await page.getByTestId('storyboard-shot-script-dialog').waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByTestId('storyboard-shot-script-dialog').getByRole('button', { name: '下一镜' }).click()
    await page
      .getByTestId('storyboard-shot-script-dialog')
      .getByText('#2', { exact: true })
      .waitFor({ state: 'visible', timeout: 20_000 })

    await page.getByLabel('关闭').click()
    await page.getByTestId('storyboard-shot-script-dialog').waitFor({ state: 'hidden', timeout: 10_000 })
    assert(
      (await page.getByTestId('storyboard-shot-script-dialog').count()) === 0,
      '关闭后放大编辑窗应收起',
    )
  },
}
