/**
 * E2E Phase 6-A-a：Step4 导出至剪映（HAODE_E2E mock IPC，不依赖本机剪映）
 */
import {
  clickTestId,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_PROJECT_TITLE,
  E2E_SHOT_IDS,
  prepareWorkshopCapcutExportWorkspace,
  waitForE2eCapcutExportMarker,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopCapcutExportSuite = {
  name: 'workshop-capcut-export',
  description: 'Step4 导出至剪映：mock capcut IPC + launcher/e2e-capcut-drafts marker',
  prepareWorkspace: prepareWorkshopCapcutExportWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    const data = await readProjectData(workspace.projectDir)
    const withVideo = (data?.shots ?? []).filter(
      (shot) => Boolean(shot.generatedVideoPath || shot.generatedVideoPaths?.length),
    ).length
    assert(
      withVideo === E2E_SHOT_IDS.length,
      `预置成片视频不足（${withVideo}/${E2E_SHOT_IDS.length}）`,
    )

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/4`)
    await waitForWorkshopProjectReady(page)
    await page.getByTestId(`storyboard-shot-${E2E_SHOT_IDS[0]}`).waitFor({
      state: 'visible',
      timeout: 30_000,
    })

    await clickTestId(page, 'workshop-step4-export-capcut')

    await waitForText(page, '已导出至剪映草稿', 15_000)

    const marker = await waitForE2eCapcutExportMarker(
      workspace.launcherDir,
      E2E_SHOT_IDS.length,
    )
    assert(Boolean(marker), 'launcher/e2e-capcut-drafts 未写入 e2e-capcut-marker.json')
    if (!marker) return

    assert(
      marker.clipCount === E2E_SHOT_IDS.length,
      `剪映导出 clip 数应为 ${E2E_SHOT_IDS.length}（实际 ${marker.clipCount}）`,
    )
    assert(
      String(marker.projectName || '').includes(E2E_PROJECT_TITLE),
      `剪映导出 projectName 应含项目标题: ${marker.projectName}`,
    )

    const labels = (marker.clips ?? []).map((item) => item?.label).filter(Boolean)
    assert(labels.includes('镜 1'), `marker 缺少镜 1 标签: ${labels.join(', ')}`)
  },
}
