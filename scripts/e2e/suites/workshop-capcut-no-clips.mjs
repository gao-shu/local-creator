/**
 * E2E Phase 6-A-c：Step4 无成片时剪映导出被拦截
 */
import {
  clickTestId,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_SHOT_IDS,
  prepareWorkshopE2eWorkspace,
  readE2eCapcutExportMarker,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopCapcutNoClipsSuite = {
  name: 'workshop-capcut-no-clips',
  description: 'Step4 无成片视频：剪映导出 toast 拦截、不写 e2e-capcut marker',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    const data = await readProjectData(workspace.projectDir)
    const withVideo = (data?.shots ?? []).filter(
      (shot) => Boolean(shot.generatedVideoPath || shot.generatedVideoPaths?.length),
    ).length
    assert(withVideo === 0, `本套件预置项目不应含成片视频（实际 ${withVideo}）`)

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({
      state: 'visible',
      timeout: 30_000,
    })

    await clickTestId(page, 'workshop-step4-export-capcut')
    await waitForText(page, '本集还没有可导出的成片视频', 10_000)

    await page.waitForTimeout(400)
    const marker = await readE2eCapcutExportMarker(workspace.launcherDir)
    assert(!marker, '无成片时不应写入 e2e-capcut-marker.json')

    assert(
      (await page.getByText('已导出至剪映草稿', { exact: false }).count()) === 0,
      '无成片时不应出现剪映导出成功提示',
    )
  },
}
