/**
 * E2E 重启级持久化：编辑落盘 → 生图 → 关闭 Electron → 重开 → 校验 data/tasks/UI
 */
import {
  clickShotGenerateImage,
  clickTestId,
  clickWorkshopStepNav,
  fillTestId,
  gotoHash,
  openTaskStatusPanel,
  closeTaskStatusPanel,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_PROJECT_TITLE,
  E2E_SCRIPT_SNIPPET,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  readProjectData,
  readProjectTasks,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

const EDITED_SCRIPT = `${E2E_SCRIPT_SNIPPET}（重启 E2E 持久化）`

export const workshopRestartPersistenceSuite = {
  name: 'workshop-restart-persistence',
  description: '关闭 Electron 再打开：剧本、分镜、已完成任务与 UI 应保持一致',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/1`)
    await waitForWorkshopProjectReady(page)
    await fillTestId(page, 'workshop-script-textarea', EDITED_SCRIPT)
    await clickTestId(page, 'workshop-manual-save')
    await page.waitForTimeout(600)

    let data = await readProjectData(workspace.projectDir)
    assert(data?.script?.includes('重启 E2E 持久化'), '保存后 data.json 未写入剧本')

    await clickWorkshopStepNav(page, 'step4')
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({ state: 'visible' })

    await clickShotGenerateImage(page, E2E_SHOT_IDS[0])
    await waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'image' &&
        task.shotId === E2E_SHOT_IDS[0] &&
        task.status === 'completed',
      1,
      30_000,
    )

    data = await readProjectData(workspace.projectDir)
    const shot = (data?.shots ?? []).find((item) => item.id === E2E_SHOT_IDS[0])
    assert(Boolean(shot), '生图后 data.json 缺少目标镜头')
    const tasksBefore = await readProjectTasks(workspace.projectDir)
    const completedImage = tasksBefore.filter(
      (task) => task.type === 'image' && task.shotId && task.status === 'completed',
    )
    assert(completedImage.length >= 1, '重启前应存在 completed 生图任务')

    await session.relaunch()

    const relaunchedPage = session.page
    if (!relaunchedPage || relaunchedPage.isClosed()) {
      assert(false, 'relaunch 后 Electron 页面不可用')
      return
    }

    await gotoHash(relaunchedPage, `#/workshop/${E2E_PROJECT_ID}/step/1`)
    await waitForWorkshopProjectReady(relaunchedPage)
    const scriptValue = await relaunchedPage.getByTestId('workshop-script-textarea').inputValue()
    assert(scriptValue.includes('重启 E2E 持久化'), `重启后 Step1 剧本丢失: ${scriptValue.slice(0, 80)}`)

    await clickWorkshopStepNav(relaunchedPage, 'step4')
    await waitForText(relaunchedPage, '推理分镜', 20_000)
    await relaunchedPage.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({ state: 'visible' })
    await relaunchedPage.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}-generate-image`).waitFor({
      state: 'visible',
      timeout: 10_000,
    })

    data = await readProjectData(workspace.projectDir)
    assert((data?.shots?.length ?? 0) >= 3, `重启后 shots 数量不足: ${data?.shots?.length ?? 0}`)
    assert(data?.script?.includes('重启 E2E 持久化'), '重启后磁盘 data.json 剧本丢失')

    const tasksAfter = await readProjectTasks(workspace.projectDir)
    assert(
      tasksAfter.some((task) => task.type === 'image' && task.shotId && task.status === 'completed'),
      '重启后 tasks.json 丢失已完成生图任务',
    )

    await openTaskStatusPanel(relaunchedPage)
    await clickTestId(relaunchedPage, 'task-filter-completed')
    const panelText = await relaunchedPage.getByTestId('task-status-panel').innerText()
    assert(
      panelText.includes('生图') || panelText.includes(E2E_PROJECT_TITLE),
      `重启后任务面板缺少已完成生图:\n${panelText.slice(0, 400)}`,
    )
    await closeTaskStatusPanel(relaunchedPage)
  },
}
