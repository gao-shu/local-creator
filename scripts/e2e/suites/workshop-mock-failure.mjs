/**
 * E2E mock 失败注入：429 类错误后 UI 恢复可再次点击
 */
import {
  clickShotGenerateImage,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopMockFailureSuite = {
  name: 'workshop-mock-failure',
  description: 'HAODE_E2E_MOCK_FAIL=shot-image：生图失败、任务 failed、按钮可重试',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  launchEnv: { HAODE_E2E_MOCK_FAIL: 'shot-image' },
  async run(session) {
    const { page, workspace, assert } = session
    const shotId = E2E_SHOT_IDS[0]

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '推理分镜', 20_000)

    await clickShotGenerateImage(page, shotId)
    await waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'image' &&
        task.shotId === shotId &&
        task.status === 'failed' &&
        (task.errorMessage?.includes('429') || task.errorMessage?.includes('mock')),
      1,
      20_000,
    )

    await page.getByTestId(`storyboard-shot-${shotId}-generate-image`).waitFor({
      state: 'visible',
      timeout: 10_000,
    })
    const busyCount = await page.locator(`[data-testid="storyboard-shot-${shotId}"][data-image-busy="true"]`).count()
    assert(busyCount === 0, 'mock 失败后镜头仍显示生图 busy')
  },
}
