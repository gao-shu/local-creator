/**
 * E2E Step4：生图进行中切换 Step 导航，后台任务应继续并完成落盘
 */
import {
  clickShotGenerateImage,
  clickWorkshopStepNav,
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
  readProjectTasks,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

async function getWorkshopStepFromHash(page) {
  return page.evaluate(() => {
    const match = window.location.hash.match(/\/step\/(\d+)/)
    return match ? Number(match[1]) : null
  })
}

function isCancelledImageTask(task) {
  return (
    task.status === 'failed' &&
    (task.progressMessage?.includes('终止') ||
      task.progressMessage?.includes('取消') ||
      task.errorMessage?.includes('取消') ||
      task.errorMessage?.includes('终止'))
  )
}

export const workshopStepNavDuringGenerationSuite = {
  name: 'workshop-step-nav-during-generation',
  description: 'Step4 mock 生图进行中切 Step1/3，返回后任务完成并落盘',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  launchEnv: { LC_E2E_MOCK_DELAY_MS: '10000' },
  async run(session) {
    const { page, workspace, assert } = session
    const shotId = E2E_SHOT_IDS[0]

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${shotId}`).waitFor({ state: 'visible' })

    const stopButtonPoll = pollUntil(
      page,
      () => page.getByTestId(`storyboard-shot-${shotId}-stop-image`).count(),
      1,
      15_000,
    )
    const imageRunningPoll = waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'image' &&
        task.shotId === shotId &&
        (task.status === 'running' || task.status === 'pending'),
      1,
      15_000,
    )

    await clickShotGenerateImage(page, shotId)
    await Promise.all([stopButtonPoll, imageRunningPoll])

    // --- 生图进行中：Step4 → Step3 → Step1 ---
    await clickWorkshopStepNav(page, 'step3')
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '角色设定', 20_000)

    let step = await getWorkshopStepFromHash(page)
    assert(step === 3, `生图进行中切 Step3 失败，当前 step=${step}`)

    let tasksWhileAway = await readProjectTasks(workspace.projectDir)
    const imageTasksWhileAway = tasksWhileAway.filter(
      (task) => task.type === 'image' && task.shotId === shotId,
    )
    assert(imageTasksWhileAway.length >= 1, '切 Step3 后生图任务记录丢失')
    const latestWhileAway = imageTasksWhileAway[imageTasksWhileAway.length - 1]
    assert(
      !isCancelledImageTask(latestWhileAway),
      `切 Step 后生图任务被误取消: ${latestWhileAway.progressMessage ?? latestWhileAway.errorMessage ?? latestWhileAway.status}`,
    )

    await clickWorkshopStepNav(page, 'step1')
    await waitForWorkshopProjectReady(page)
    await page.getByTestId('workshop-script-textarea').waitFor({ state: 'visible', timeout: 20_000 })

    step = await getWorkshopStepFromHash(page)
    assert(step === 1, `生图进行中切 Step1 失败，当前 step=${step}`)

    // --- 返回 Step4，等待后台生图完成 ---
    await clickWorkshopStepNav(page, 'step4')
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${shotId}`).waitFor({ state: 'visible' })

    step = await getWorkshopStepFromHash(page)
    assert(step === 4, `返回 Step4 失败，当前 step=${step}`)

    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'image' && task.shotId === shotId && task.status === 'completed',
      1,
      25_000,
    )

    const data = await readProjectData(workspace.projectDir)
    const shot = data?.shots?.find((item) => item.id === shotId)
    assert(
      Boolean(shot?.generatedImagePath || shot?.generatedImagePaths?.length),
      '切 Step 后返回 Step4，data.json 仍无分镜图路径',
    )

    tasksWhileAway = await readProjectTasks(workspace.projectDir)
    const completedImage = tasksWhileAway.filter(
      (task) => task.type === 'image' && task.shotId === shotId && task.status === 'completed',
    )
    assert(completedImage.length >= 1, '切 Step 后生图任务未标记 completed')

    await page.getByTestId(`storyboard-shot-${shotId}-generate-image`).waitFor({
      state: 'visible',
      timeout: 15_000,
    })
  },
}
