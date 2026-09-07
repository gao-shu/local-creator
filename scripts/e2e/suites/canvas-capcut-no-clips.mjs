/**
 * E2E Phase 6-A-d：画布无成功视频时剪映导出被拦截
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
  prepareCanvasCapcutNoClipsWorkspace,
  readE2eCapcutExportMarker,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const canvasCapcutNoClipsSuite = {
  name: 'canvas-capcut-no-clips',
  description: '画布无成功视频：剪映导出 toast 拦截、不写 e2e-capcut marker',
  prepareWorkspace: prepareCanvasCapcutNoClipsWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_CAPCUT_ID}`)
    await waitForCanvasEditor(page)
    await waitForCanvasFlowNode(page, 'prompt_capcut_no_clips')

    await clickTestId(page, 'canvas-export')
    await waitForText(page, '导出成片', 20_000)
    await page.getByText('正在整理成片清单').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {})
    await waitForText(page, '暂无可导出视频', 15_000)

    const capcutButton = page.getByTestId('canvas-export-capcut')
    await capcutButton.waitFor({ state: 'visible', timeout: 20_000 })
    await page.waitForFunction(
      () => {
        const btn = document.querySelector('[data-testid="canvas-export-capcut"]')
        return btn instanceof HTMLButtonElement && btn.disabled
      },
      { timeout: 15_000 },
    )
    assert(await capcutButton.isDisabled(), '无成功视频时剪映导出按钮应禁用')

    const marker = await readE2eCapcutExportMarker(workspace.launcherDir)
    assert(!marker, '无成功视频时不应写入 e2e-capcut-marker.json')

    assert(
      (await page.getByText('已导出至剪映草稿', { exact: false }).count()) === 0,
      '无成功视频时不应出现剪映导出成功提示',
    )
  },
}
