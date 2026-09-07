/**
 * E2E 工坊从零流水线：仅剧本 → AI 分集 → 批量生图 → 推理分镜 → 生图/生视频
 */
import {
  clickShotGenerateImage,
  clickShotGenerateVideo,
  clickTestId,
  clickWorkshopStepNav,
  confirmDialogIfVisible,
  fillTestId,
  gotoHash,
  listStoryboardShotIds,
  openTaskStatusPanel,
  closeTaskStatusPanel,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SCRIPT_SNIPPET,
  prepareWorkshopScriptOnlyWorkspace,
  readProjectData,
  waitForProjectAssetsDone,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopFromScratchSuite = {
  name: 'workshop-from-scratch',
  description: '仅剧本起点：AI 分集 → Step3 批量生图 → 推理分镜 → 首镜生图/生视频',
  prepareWorkspace: prepareWorkshopScriptOnlyWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/1`)
    await waitForWorkshopProjectReady(page)
    await page.getByTestId('workshop-script-textarea').waitFor({ state: 'visible', timeout: 45_000 })
    await waitForText(page, E2E_SCRIPT_SNIPPET)

    await fillTestId(page, 'workshop-script-textarea', `${E2E_SCRIPT_SNIPPET}（从零 E2E）`)
    await clickTestId(page, 'workshop-step1-next')
    await waitForText(page, 'AI 分集并提取资产', 20_000)

    // --- Step 2：AI 分集（mock） ---
    await clickTestId(page, 'workshop-step2-split')
    await confirmDialogIfVisible(page, '保存并继续', 2_000)
    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'episode_split' && task.status === 'completed',
      1,
      45_000,
    )

    let data = await readProjectData(workspace.projectDir)
    assert((data?.episodes?.length ?? 0) >= 1, 'AI 分集后 episodes 为空')
    assert((data?.characters?.length ?? 0) >= 1, 'AI 分集后 characters 为空')
    await waitForText(page, '第 1 集', 20_000)
    await waitForText(page, '主角', 20_000)

    // --- Step 3：批量生图 ---
    await clickWorkshopStepNav(page, 'step3')
    await waitForText(page, '角色设定', 20_000)
    await clickTestId(page, 'workshop-step3-batch-generate')
    const assetsDone = await waitForProjectAssetsDone(workspace.projectDir, 1, 60_000)
    assert(assetsDone >= 1, `从零流水线 Step3 资产生图未完成（done=${assetsDone}）`)

    // --- Step 4：推理分镜（mock） ---
    await clickWorkshopStepNav(page, 'step4')
    await waitForText(page, '推理分镜', 20_000)
    await clickTestId(page, 'workshop-step4-infer')
    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'storyboard' && task.status === 'completed',
      1,
      45_000,
    )

    await page.locator('[data-testid^="storyboard-shot-"]').first().waitFor({
      state: 'visible',
      timeout: 30_000,
    })
    const shotIds = await listStoryboardShotIds(page)
    assert(shotIds.length >= 1 && shotIds[0], `推理分镜后未生成镜头卡片（ids=${shotIds.join(',')}）`)

    const firstShotId = shotIds[0]
    await clickShotGenerateImage(page, firstShotId)
    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'image' && task.shotId === firstShotId && task.status === 'completed',
      1,
      30_000,
    )

    await clickShotGenerateVideo(page, firstShotId)
    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'video' && task.shotId === firstShotId && task.status === 'completed',
      1,
      45_000,
    )

    await openTaskStatusPanel(page)
    await clickTestId(page, 'task-filter-completed')
    const panelText = await page.getByTestId('task-status-panel').innerText()
    assert(panelText.includes('分集') || panelText.includes('分镜') || panelText.includes('生图'), 
      `任务面板缺少从零流水线任务:\n${panelText.slice(0, 500)}`)
    await closeTaskStatusPanel(page)

    data = await readProjectData(workspace.projectDir)
    assert((data?.shots?.length ?? 0) >= 1, 'data.json shots 为空')
    assert(data?.script?.includes('从零 E2E'), '剧本编辑未持久化')
  },
}
