/**
 * E2E 画布：停止 mock 生图
 */
import {
  clickCanvasNodeGenerateImage,
  clickCanvasNodeStopImage,
  gotoHash,
  pollUntil,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_IMAGE_GEN_ID,
  E2E_CANVAS_IMAGE_GEN_TITLE,
  E2E_CANVAS_IMAGE_NODE_ID,
  prepareCanvasGenerationStopWorkspace,
  readCanvasProjectData,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasGenerationStopSuite = {
  name: 'canvas-generation-stop',
  description: '画布图片节点：停止 mock 生图，节点标记 error/已停止',
  prepareWorkspace: prepareCanvasGenerationStopWorkspace,
  launchEnv: { LC_E2E_MOCK_DELAY_MS: '8000' },
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_IMAGE_GEN_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_IMAGE_GEN_TITLE, 15_000)

    await clickCanvasNodeGenerateImage(page, E2E_CANVAS_IMAGE_NODE_ID)

    await pollUntil(
      page,
      () => page.getByTestId(`canvas-node-${E2E_CANVAS_IMAGE_NODE_ID}-stop-image`).count(),
      1,
      15_000,
    )

    await clickCanvasNodeStopImage(page, E2E_CANVAS_IMAGE_NODE_ID)
    await page.waitForTimeout(1200)

    const data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_IMAGE_GEN_ID)
    const node = (data?.nodes ?? []).find((item) => item.id === E2E_CANVAS_IMAGE_NODE_ID)
    assert(Boolean(node), '停止后节点丢失')
    assert(node?.data?.status === 'error', `停止后 status 应为 error（实际 ${node?.data?.status}）`)
    assert(
      String(node?.data?.error || '').includes('停止'),
      `停止后 error 文案异常: ${node?.data?.error}`,
    )
    assert(!node?.data?.outputPath, '停止后不应写入 outputPath')
  },
}
