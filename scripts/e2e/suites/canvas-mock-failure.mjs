/**
 * E2E 画布 mock 失败注入：资产生图 429 类错误后 UI 恢复可再次点击
 */
import {
  clickCanvasNodeGenerateImage,
  gotoHash,
  pollUntil,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_IMAGE_NODE_ID,
  E2E_CANVAS_MOCK_FAIL_ID,
  E2E_CANVAS_MOCK_FAIL_TITLE,
  prepareCanvasMockFailureWorkspace,
  readCanvasProjectData,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasMockFailureSuite = {
  name: 'canvas-mock-failure',
  description: 'HAODE_E2E_MOCK_FAIL=asset-image：画布生图失败、节点 error、按钮可重试',
  prepareWorkspace: prepareCanvasMockFailureWorkspace,
  launchEnv: { HAODE_E2E_MOCK_FAIL: 'asset-image' },
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_MOCK_FAIL_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_MOCK_FAIL_TITLE, 15_000)

    await clickCanvasNodeGenerateImage(page, E2E_CANVAS_IMAGE_NODE_ID)

    await pollUntil(
      page,
      async () => {
        const data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_MOCK_FAIL_ID)
        const node = (data?.nodes ?? []).find((item) => item.id === E2E_CANVAS_IMAGE_NODE_ID)
        return node?.data?.status === 'error' ? 1 : 0
      },
      1,
      20_000,
    )

    const data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_MOCK_FAIL_ID)
    const node = (data?.nodes ?? []).find((item) => item.id === E2E_CANVAS_IMAGE_NODE_ID)
    assert(Boolean(node), 'mock 失败后节点丢失')
    assert(node?.data?.status === 'error', `mock 失败后 status 应为 error（实际 ${node?.data?.status}）`)
    assert(
      String(node?.data?.error || '').includes('429') ||
        String(node?.data?.error || '').includes('mock'),
      `mock 失败后 error 文案异常: ${node?.data?.error}`,
    )
    assert(!node?.data?.outputPath, 'mock 失败后不应写入 outputPath')

    await page.getByTestId(`canvas-node-${E2E_CANVAS_IMAGE_NODE_ID}-generate-image`).waitFor({
      state: 'visible',
      timeout: 10_000,
    })
    const busyCount = await page
      .locator(`[data-testid="canvas-node-${E2E_CANVAS_IMAGE_NODE_ID}"][data-image-busy="true"]`)
      .count()
    assert(busyCount === 0, 'mock 失败后图片节点仍显示 busy')
  },
}
