/**
 * E2E 画布 Agent 侧栏 smoke
 */
import {
  clickTestId,
  fillTestId,
  gotoHash,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_AGENT_ID,
  E2E_CANVAS_AGENT_TITLE,
  E2E_CANVAS_IMAGE_NODE_ID,
  prepareCanvasAgentSmokeWorkspace,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasAgentSmokeSuite = {
  name: 'canvas-agent-smoke',
  description: '画布助手：打开侧栏、切换模式、输入框与发送按钮可用',
  prepareWorkspace: prepareCanvasAgentSmokeWorkspace,
  async run(session) {
    const { page, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_AGENT_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_AGENT_TITLE, 15_000)

    await clickTestId(page, 'canvas-header-agent')
    await page.getByTestId('canvas-agent-sidebar').waitFor({ state: 'visible', timeout: 10_000 })
    await waitForText(page, '画布助手', 10_000)

    await waitForText(page, '对话', 10_000)
    await waitForText(page, '改图', 10_000)

    await fillTestId(page, 'canvas-agent-input', 'E2E画布助手 smoke 测试输入')
    const sendBtn = page.getByTestId('canvas-agent-send')
    assert(await sendBtn.isEnabled(), '有输入时发送按钮应可用')

    await page.getByTestId(`canvas-node-${E2E_CANVAS_IMAGE_NODE_ID}`).click()
    await page.waitForTimeout(400)

    await clickTestId(page, 'canvas-header-params')
    await page.getByTestId('canvas-params-panel').waitFor({ state: 'visible', timeout: 10_000 })
  },
}
