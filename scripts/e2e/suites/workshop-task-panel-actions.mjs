/**
 * E2E 全局任务浮层：终止进行中任务、删除历史任务
 */
import {
  clickShotGenerateImage,
  clickShotGenerateVideo,
  clickTaskEntryCancel,
  clickTaskEntryDelete,
  clickTestId,
  closeTaskStatusPanel,
  gotoHash,
  openTaskStatusPanel,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  readProjectTasks,
  waitForNewProjectTaskId,
  waitForProjectTaskId,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopTaskPanelActionsSuite = {
  name: 'workshop-task-panel-actions',
  description: '任务浮层：终止进行中生视频、删除已完成生图任务',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  launchEnv: { LC_E2E_MOCK_DELAY_MS: '12000' },
  async run(session) {
    const { page, workspace, assert } = session
    const shotId = E2E_SHOT_IDS[0]

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${shotId}`).waitFor({ state: 'visible' })

    // 全能多参模式需先有分镜图，否则生视频会立刻 failed
    await clickShotGenerateImage(page, shotId)
    const firstImageTaskId = await waitForProjectTaskId(
      workspace.projectDir,
      (task) =>
        task.type === 'image' &&
        task.shotId === shotId &&
        task.status === 'completed',
      35_000,
    )
    assert(Boolean(firstImageTaskId), '首镜生图完成后 tasks.json 无 completed 任务')

    // --- 终止进行中的生视频（mock 延迟 12s，留足浮层操作窗口）---
    await clickShotGenerateVideo(page, shotId)
    await page.getByTestId(`storyboard-shot-${shotId}-stop-video`).waitFor({
      state: 'visible',
      timeout: 15_000,
    })

    const runningVideoTaskId = await waitForProjectTaskId(
      workspace.projectDir,
      (task) =>
        task.type === 'video' &&
        task.shotId === shotId &&
        (task.status === 'running' || task.status === 'pending'),
      12_000,
    )
    assert(Boolean(runningVideoTaskId), '生视频开始后 tasks.json 无进行中任务')

    await openTaskStatusPanel(page)
    await clickTestId(page, 'task-filter-active')
    await clickTaskEntryCancel(page, runningVideoTaskId)
    await page.waitForTimeout(600)
    await closeTaskStatusPanel(page)

    await page.getByTestId(`storyboard-shot-${shotId}-generate-video`).waitFor({
      state: 'visible',
      timeout: 12_000,
    })

    await waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.id === runningVideoTaskId &&
        task.status === 'failed' &&
        (task.progressMessage?.includes('终止') || task.errorMessage?.includes('取消')),
      1,
      12_000,
    )

    // --- 删除新一轮已完成生图任务 ---
    await clickShotGenerateImage(page, shotId)
    const secondImageTaskId = await waitForNewProjectTaskId(
      workspace.projectDir,
      (task) =>
        task.type === 'image' &&
        task.shotId === shotId &&
        task.status === 'completed',
      [firstImageTaskId, runningVideoTaskId],
      35_000,
    )
    assert(Boolean(secondImageTaskId), '第二轮生图完成后 tasks.json 无新的 completed 任务')

    await openTaskStatusPanel(page)
    await clickTestId(page, 'task-filter-completed')
    await clickTaskEntryDelete(page, secondImageTaskId)
    await page.waitForTimeout(600)
    await closeTaskStatusPanel(page)

    const tasksAfterDelete = await readProjectTasks(workspace.projectDir)
    assert(
      !tasksAfterDelete.some((task) => task.id === secondImageTaskId),
      '删除后 tasks.json 仍包含已删任务',
    )
    assert(
      tasksAfterDelete.some((task) => task.id === runningVideoTaskId && task.status === 'failed'),
      '终止后的 failed 任务应保留直至用户删除',
    )
    assert(
      tasksAfterDelete.some((task) => task.id === firstImageTaskId && task.status === 'completed'),
      '首轮 completed 生图任务应仍在列表中',
    )
  },
}
