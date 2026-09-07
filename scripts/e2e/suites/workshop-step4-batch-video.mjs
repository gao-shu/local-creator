/**
 * E2E Step4：批量 mock 生视频（E2E mock 模式下启用批量按钮）
 */
import {
  clickStoryboardRightTab,
  clickTestId,
  confirmDialog,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopBatchVideoE2eWorkspace,
  readProjectData,
  readProjectTasks,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

function isCompletedBatchVideoSummaryTask(task) {
  return (
    task.type === 'video' &&
    !task.shotId &&
    task.status === 'completed' &&
    (task.progressMessage?.includes('批量生成视频完成') ||
      task.progressMessage?.includes('批量生视频'))
  )
}

function countCompletedShotVideoTasks(tasks) {
  return tasks.filter(
    (task) =>
      task.type === 'video' &&
      task.status === 'completed' &&
      (Boolean(task.shotId) || task.progressMessage?.includes('视频生成完成')),
  ).length
}

async function waitForShotsWithVideo(projectDir, minCount, timeoutMs = 60_000) {
  const started = Date.now()
  let last = 0
  while (Date.now() - started < timeoutMs) {
    const data = await readProjectData(projectDir)
    last = countShotsWithVideo(data)
    if (last >= minCount) return last
    await new Promise((r) => setTimeout(r, 200))
  }
  return last
}

function countShotsWithVideo(data) {
  return (data?.shots ?? []).filter(
    (shot) => Boolean(shot.generatedVideoPath || shot.generatedVideoPaths?.length),
  ).length
}

export const workshopStep4BatchVideoSuite = {
  name: 'workshop-step4-batch-video',
  description: 'Step4：批量 mock 生视频，3 镜落盘 + 批量任务 completed',
  prepareWorkspace: prepareWorkshopBatchVideoE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({ state: 'visible' })

    await clickStoryboardRightTab(page, 'video')
    const batchBtn = page.getByTestId('workshop-step4-batch-generate-video')
    await batchBtn.waitFor({ state: 'visible', timeout: 15_000 })
    assert(!(await batchBtn.isDisabled()), 'E2E mock 下批量生视频按钮仍被禁用')

    await clickTestId(page, 'workshop-step4-batch-generate-video')
    await confirmDialog(page, '确认生成')

    const batchSummaryDone = await waitForProjectTasks(
      workspace.projectDir,
      isCompletedBatchVideoSummaryTask,
      1,
      60_000,
    )
    assert(batchSummaryDone >= 1, '批量生视频汇总任务未 completed')

    const withVideo = await waitForShotsWithVideo(workspace.projectDir, E2E_SHOT_IDS.length, 60_000)
    assert(
      withVideo >= E2E_SHOT_IDS.length,
      `data.json 含视频分镜不足 ${E2E_SHOT_IDS.length}（实际 ${withVideo}）`,
    )

    const tasks = await readProjectTasks(workspace.projectDir)
    const completedShotVideos = countCompletedShotVideoTasks(tasks)
    assert(
      completedShotVideos >= 1,
      `批量生视频后 tasks.json 无 completed 单镜记录（实际 ${completedShotVideos}）`,
    )

    const data = await readProjectData(workspace.projectDir)
    for (const shotId of E2E_SHOT_IDS) {
      const shot = data?.shots?.find((item) => item.id === shotId)
      assert(
        Boolean(shot?.generatedVideoPath || shot?.generatedVideoPaths?.length),
        `镜 ${shotId} 未写入 generatedVideoPath`,
      )
    }
  },
}
