/**
 * E2E Step2：多集 Tab 切换与脚本预览
 */
import {
  clickTestId,
  clickWorkshopStepNav,
  confirmDialogIfVisible,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_EPISODE_1_SNIPPET,
  E2E_EPISODE_2_SNIPPET,
  E2E_EPISODE_ID,
  E2E_EPISODE_ID_2,
  E2E_PROJECT_ID,
  prepareWorkshopMultiEpisodeWorkspace,
  readProjectData,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopMultiEpisodeSuite = {
  name: 'workshop-multi-episode',
  description: 'Step2：多集 Tab 切换，手动多集提取后仍保留集数',
  prepareWorkspace: prepareWorkshopMultiEpisodeWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/2`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, 'AI 分集并提取资产', 20_000)
    await waitForText(page, '手动分集', 15_000)

    await clickTestId(page, `workshop-episode-tab-${E2E_EPISODE_ID}`)
    await waitForText(page, E2E_EPISODE_1_SNIPPET, 10_000)
    const ep1Preview = await page.getByTestId('workshop-step2-episode-script-textarea').inputValue()
    assert(ep1Preview.includes(E2E_EPISODE_1_SNIPPET), `第 1 集预览不正确: ${ep1Preview.slice(0, 40)}`)

    await clickTestId(page, `workshop-episode-tab-${E2E_EPISODE_ID_2}`)
    await waitForText(page, E2E_EPISODE_2_SNIPPET, 10_000)
    const ep2Preview = await page.getByTestId('workshop-step2-episode-script-textarea').inputValue()
    assert(ep2Preview.includes(E2E_EPISODE_2_SNIPPET), `第 2 集预览不正确: ${ep2Preview.slice(0, 40)}`)

    await clickTestId(page, `workshop-episode-tab-${E2E_EPISODE_ID}`)
    const backEp1 = await page.getByTestId('workshop-step2-episode-script-textarea').inputValue()
    assert(backEp1.includes(E2E_EPISODE_1_SNIPPET), '切回第 1 集后预览未恢复')

    await clickTestId(page, 'workshop-step2-extract')
    await confirmDialogIfVisible(page, '保存并继续', 2_000)
    await confirmDialogIfVisible(page, '继续重建', 5_000)
    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'extract' && task.status === 'completed',
      1,
      30_000,
    )

    const data = await readProjectData(workspace.projectDir)
    assert((data?.episodes?.length ?? 0) === 2, `手动多集提取后集数异常: ${data?.episodes?.length}`)
    assert(data?.episodePlan === 'manual', `手动多集应保持 manual: ${data?.episodePlan}`)

    await clickWorkshopStepNav(page, 'step3')
    await waitForWorkshopProjectReady(page)
    await clickWorkshopStepNav(page, 'step2')
    await waitForText(page, '手动分集', 15_000)
    assert((await page.getByText('第 2 集').count()) > 0, '步骤切换后第 2 集 Tab 丢失')
  },
}
