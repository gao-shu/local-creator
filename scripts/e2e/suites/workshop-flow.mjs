/**
 * E2E 工坊全流程（预置项目）：Step1~4 全步骤 + 资产批量生图 + 分镜生图/生视频 + 任务面板
 */
import {
  clickShotGenerateImage,
  clickShotGenerateVideo,
  clickTestId,
  clickWorkshopStepNav,
  confirmDialogIfVisible,
  countTaskEntries,
  fillTestId,
  gotoHash,
  openTaskStatusPanel,
  closeTaskStatusPanel,
  pollUntil,
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
  waitForProjectAssetsDone,
  waitForProjectTasks,
} from '../../lib/workshop-e2e-fixtures.mjs'

const EDITED_SCRIPT = `${E2E_SCRIPT_SNIPPET}（E2E 已编辑）`

export const workshopFlowSuite = {
  name: 'workshop-flow',
  description: '预置项目：Step1~4、手动保存、Step3 批量生图、分镜生图/生视频、任务面板、持久化',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/1`)
    await waitForWorkshopProjectReady(page)
    await page.getByTestId('workshop-script-textarea').waitFor({ state: 'visible', timeout: 45_000 })

    const titleText = await page.getByTestId('workshop-project-title').innerText()
    assert(titleText.includes(E2E_PROJECT_TITLE), `项目标题不正确: ${titleText}`)

    await waitForText(page, E2E_SCRIPT_SNIPPET)
    await fillTestId(page, 'workshop-script-textarea', EDITED_SCRIPT)
    await clickTestId(page, 'workshop-manual-save')
    await page.waitForTimeout(800)

    let data = await readProjectData(workspace.projectDir)
    assert(data?.script?.includes('E2E 已编辑'), '手动保存后 data.json 未更新剧本')

    await clickTestId(page, 'workshop-step1-next')
    await waitForText(page, 'AI 分集并提取资产', 20_000)

    // --- Step 2：分集页 ---
    assert((await page.getByText('第 1 集').count()) > 0, 'Step2 未显示第 1 集')

    await clickTestId(page, 'workshop-step2-extract')
    const dirtyConfirmed = await confirmDialogIfVisible(page, '保存并继续', 2_000)
    if (dirtyConfirmed) {
      /* Step1 编辑后进入 Step2 可能仍有 dirty */
    }
    await confirmDialogIfVisible(page, '继续重建')
    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'extract' && task.status === 'completed',
      1,
      30_000,
    )

    // --- Step 3：资产批量生图 ---
    await clickWorkshopStepNav(page, 'step3')
    await waitForText(page, '角色设定', 20_000)
    await waitForText(page, '主角', 20_000)

    const assetDonePoll = waitForProjectAssetsDone(workspace.projectDir, 1, 60_000)
    await clickTestId(page, 'workshop-step3-batch-generate')
    const assetsDone = await assetDonePoll
    assert(assetsDone >= 1, `Step3 批量生图后 done 资产不足 1（实际 ${assetsDone}）`)

    data = await readProjectData(workspace.projectDir)
    const doneAsset = [...(data?.characters ?? []), ...(data?.scenes ?? [])].find(
      (item) => item.status === 'done',
    )
    assert(Boolean(doneAsset), 'Step3 批量生图后未找到 status=done 的资产')

    // --- Step 4：分镜生图 + 生视频 ---
    await clickWorkshopStepNav(page, 'step4')
    await waitForText(page, '推理分镜', 20_000)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({ state: 'visible' })

    const busyPoll = pollUntil(
      page,
      () => page.locator('[data-image-busy="true"]').count(),
      1,
      20_000,
    )
    const shotImagePoll = waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'image' &&
        task.shotId &&
        (task.status === 'running' || task.status === 'pending'),
      1,
      20_000,
    )

    await clickShotGenerateImage(page, E2E_SHOT_IDS[0])
    await clickShotGenerateImage(page, E2E_SHOT_IDS[1])
    const [busyCount, shotActive] = await Promise.all([busyPoll, shotImagePoll])
    assert(busyCount >= 1 || shotActive >= 1, '分镜 mock 生图未进入进行中')

    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'image' && task.shotId && task.status === 'completed',
      2,
      30_000,
    )

    const videoPoll = waitForProjectTasks(
      workspace.projectDir,
      (task) =>
        task.type === 'video' &&
        (task.status === 'running' || task.status === 'pending' || task.status === 'completed'),
      1,
      30_000,
    )
    await clickShotGenerateVideo(page, E2E_SHOT_IDS[0])
    await videoPoll

    await waitForProjectTasks(
      workspace.projectDir,
      (task) => task.type === 'video' && task.status === 'completed',
      1,
      45_000,
    )

    // --- 任务面板：进行中 → 已完成 ---
    await openTaskStatusPanel(page)
    await clickTestId(page, 'task-filter-completed')
    const completedEntries = await countTaskEntries(page, { status: 'completed' })
    assert(completedEntries >= 3, `任务面板已完成条目不足 3（实际 ${completedEntries}）`)
    const completedPanel = await page.getByTestId('task-status-panel').innerText()
    assert(
      completedPanel.includes('生图') || completedPanel.includes('生视频') || completedPanel.includes('提取'),
      `已完成筛选未包含预期任务类型:\n${completedPanel.slice(0, 500)}`,
    )
    await closeTaskStatusPanel(page)

    // --- 步骤往返 + 持久化 ---
    for (const step of ['step2', 'step3', 'step1']) {
      await clickWorkshopStepNav(page, step)
      await waitForWorkshopProjectReady(page)
    }

    const scriptValue = await page.getByTestId('workshop-script-textarea').inputValue()
    assert(scriptValue.includes('E2E 已编辑'), `Step1 剧本未持久化，当前: ${scriptValue.slice(0, 80)}`)

    const finalData = await readProjectData(workspace.projectDir)
    assert((finalData?.shots?.length ?? 0) >= 3, `data.json 镜头数量不足（${finalData?.shots?.length ?? 0}）`)
  },
}
