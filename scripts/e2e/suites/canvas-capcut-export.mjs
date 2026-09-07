/**
 * E2E Phase 6-A-b：画布编辑器导出至剪映（HAODE_E2E mock IPC）
 */
import {
  clickTestId,
  gotoHash,
  waitForCanvasEditor,
  waitForCanvasFlowNode,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_CAPCUT_ID,
  E2E_CANVAS_CAPCUT_TITLE,
  prepareCanvasCapcutExportWorkspace,
  waitForE2eCapcutExportMarker,
} from '../../lib/workshop-e2e-fixtures.mjs'

const E2E_CANVAS_CAPCUT_CLIP_COUNT = 2

export const canvasCapcutExportSuite = {
  name: 'canvas-capcut-export',
  description: '画布编辑器：导出至剪映 mock IPC + e2e-capcut-drafts marker',
  prepareWorkspace: prepareCanvasCapcutExportWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_CAPCUT_ID}`)
    await waitForCanvasEditor(page)
    await waitForCanvasFlowNode(page, 'video_capcut_1')
    await waitForCanvasFlowNode(page, 'video_capcut_2')

    await clickTestId(page, 'canvas-export')
    await waitForText(page, '导出成片', 20_000)
    await page.getByText('正在整理成片清单').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
    const capcutBtn = page.getByTestId('canvas-export-capcut')
    await capcutBtn.waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="canvas-export-capcut"]')
        return btn instanceof HTMLButtonElement && !btn.disabled
      },
      { timeout: 30_000 },
    )
    await clickTestId(page, 'canvas-export-capcut')
    await waitForText(page, '已导出至剪映草稿', 20_000)

    const marker = await waitForE2eCapcutExportMarker(
      workspace.launcherDir,
      E2E_CANVAS_CAPCUT_CLIP_COUNT,
      25_000,
    )
    assert(Boolean(marker), 'launcher/e2e-capcut-drafts 未写入 e2e-capcut-marker.json')
    if (!marker) return

    assert(
      marker.clipCount === E2E_CANVAS_CAPCUT_CLIP_COUNT,
      `剪映导出 clip 数应为 ${E2E_CANVAS_CAPCUT_CLIP_COUNT}（实际 ${marker.clipCount}）`,
    )
    assert(
      String(marker.projectName || '').includes(E2E_CANVAS_CAPCUT_TITLE),
      `剪映导出 projectName 应含画布标题: ${marker.projectName}`,
    )

    const labels = (marker.clips ?? []).map((item) => item?.label).filter(Boolean)
    assert(
      labels.some((label) => label.includes('镜 1')),
      `marker 缺少镜 1 标签: ${labels.join(', ')}`,
    )
    assert(
      labels.some((label) => label.includes('镜 2')),
      `marker 缺少镜 2 标签: ${labels.join(', ')}`,
    )
  },
}
