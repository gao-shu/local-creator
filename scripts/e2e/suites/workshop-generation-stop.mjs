/**
 * E2E Step4：停止分镜生图 / 生视频
 */
import {
  clickShotGenerateImage,
  clickShotGenerateVideo,
  clickShotStopImage,
  clickShotStopVideo,
  gotoHash,
  pollUntil,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  readProjectData,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

function isStoppedImageTask(task, shotId) {
  return (
    task.type === 'image' &&
    task.shotId === shotId &&
    task.status === 'failed' &&
    (task.progressMessage?.includes('终止') ||
      task.progressMessage?.includes('取消') ||
      task.errorMessage?.includes('取消') ||
      task.errorMessage?.includes('终止'))
  )
}

function isStoppedVideoTask(task, shotId) {
  return (
    task.type === 'video' &&
    task.shotId === shotId &&
    task.status === 'failed' &&
    (task.progressMessage?.includes('终止') ||
      task.progressMessage?.includes('取消') ||
      task.errorMessage?.includes('取消') ||
      task.errorMessage?.includes('终止'))
  )
}

export const workshopGenerationStopSuite = {
  name: 'workshop-generation-stop',
  description: 'Step4：停止 mock 生图与生视频，任务标记为 failed/已终止',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  launchEnv: { HAODE_E2E_MOCK_DELAY_MS: '8000' },
  async run(session) {
    const { page, workspace, assert } = session
    const imageShotId = E2E_SHOT_IDS[0]
    const videoShotId = E2E_SHOT_IDS[1]

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${imageShotId}`).waitFor({ state: 'visible' })

    // --- 停止生图（镜 1）：先等 running 任务落盘再点停止 ---
    const stopImagePoll = pollUntil(
      page,
      () => page.getByTestId(`storyboard-shot-${imageShotId}-stop-image`).count(),
      1,
      15_000,
    )
    const imageRunningPoll = waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'image' &&
        task.shotId === imageShotId &&
        (task.status === 'running' || task.status === 'pending'),
      1,
      15_000,
    )
    await clickShotGenerateImage(page, imageShotId)
    await Promise.all([stopImagePoll, imageRunningPoll])
    await clickShotStopImage(page, imageShotId)

    await page.getByTestId(`storyboard-shot-${imageShotId}-generate-image`).waitFor({
      state: 'visible',
      timeout: 15_000,
    })

    const stoppedImageCount = await waitForProjectTasks(
      workspace.projectDir,
      (task) => isStoppedImageTask(task, imageShotId),
      1,
      15_000,
    )
    assert(stoppedImageCount >= 1, '停止生图后 tasks.json 未找到 failed/已取消 生图任务')

    // --- 停止生视频（镜 2：需先有分镜图）---
    await clickShotGenerateImage(page, videoShotId)
    await waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'image' && task.shotId === videoShotId && task.status === 'completed',
      1,
      35_000,
    )

    const data = await readProjectData(workspace.projectDir)
    const shot2 = data?.shots?.find((item) => item.id === videoShotId)
    assert(
      Boolean(shot2?.generatedImagePath || shot2?.generatedImagePaths?.length),
      '镜 2 生图完成后 data.json 仍无分镜图路径',
    )

    const stopVideoPoll = pollUntil(
      page,
      () => page.getByTestId(`storyboard-shot-${videoShotId}-stop-video`).count(),
      1,
      15_000,
    )
    const videoRunningPoll = waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'video' &&
        task.shotId === videoShotId &&
        (task.status === 'running' || task.status === 'pending'),
      1,
      15_000,
    )
    await clickShotGenerateVideo(page, videoShotId)
    await Promise.all([stopVideoPoll, videoRunningPoll])
    await clickShotStopVideo(page, videoShotId)

    await page.getByTestId(`storyboard-shot-${videoShotId}-generate-video`).waitFor({
      state: 'visible',
      timeout: 15_000,
    })

    const stoppedVideoCount = await waitForProjectTasks(
      workspace.projectDir,
      (task) => isStoppedVideoTask(task, videoShotId),
      1,
      15_000,
    )
    assert(stoppedVideoCount >= 1, '停止生视频后 tasks.json 未找到 failed/已取消 生视频任务')
  },
}
