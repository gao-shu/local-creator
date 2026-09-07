/**
 * E2E Step2 分集规划（P3）：dirty 保存提示、单集编辑提取保真、全文预览 Tab
 */
import {
  clickTestId,
  confirmDialogIfVisible,
  fillTestId,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_EPISODE_EDIT_MARKER,
  E2E_EPISODE_ID,
  E2E_PROJECT_ID,
  prepareWorkshopBootstrapEpisodeWorkspace,
  readProjectData,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopStep2EpisodePlanSuite = {
  name: 'workshop-step2-episode-plan',
  description: 'Step2：dirty 保存提示、单集编辑提取保真、全文预览 Tab',
  prepareWorkspace: prepareWorkshopBootstrapEpisodeWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/2`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, 'AI 分集并提取资产', 20_000)
    await waitForText(page, '占位分集', 15_000)

    await clickTestId(page, `workshop-episode-tab-${E2E_EPISODE_ID}`)
    await fillTestId(
      page,
      'workshop-step2-episode-script-textarea',
      `${E2E_EPISODE_EDIT_MARKER}：主角在雨夜街头奔跑。`,
    )

    await clickTestId(page, 'workshop-step2-extract')
    const dirtyConfirmed = await confirmDialogIfVisible(page, '保存并继续', 5_000)
    assert(dirtyConfirmed, '未保存编辑后提取应弹出「保存并继续」确认')

    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'extract' && task.status === 'completed',
      1,
      30_000,
    )

    const data = await readProjectData(workspace.projectDir)
    const ep1Content = data?.episodes?.[0]?.content ?? ''
    assert(
      ep1Content.includes(E2E_EPISODE_EDIT_MARKER),
      `提取后第 1 集 content 未保留编辑: ${ep1Content.slice(0, 80)}`,
    )
    assert(data?.episodePlan === 'manual', `编辑后应为 manual，实际: ${data?.episodePlan}`)

    await clickTestId(page, 'workshop-episode-tab-full')
    await page.getByTestId('workshop-step2-full-script-textarea').waitFor({ state: 'visible' })
    const fullScript = await page.getByTestId('workshop-step2-full-script-textarea').inputValue()
    assert(fullScript.includes('E2E'), '全文预览 Tab 未显示 Step1 剧本')

    await clickTestId(page, `workshop-episode-tab-${E2E_EPISODE_ID}`)
    const episodeScript = await page.getByTestId('workshop-step2-episode-script-textarea').inputValue()
    assert(
      episodeScript.includes(E2E_EPISODE_EDIT_MARKER),
      '全文预览与本集脚本应分离，切回后编辑仍在',
    )
  },
}
