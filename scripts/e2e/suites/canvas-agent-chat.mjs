/**
 * E2E 画布 Agent 对话 mock
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
  prepareCanvasAgentSmokeWorkspace,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasAgentChatSuite = {
  name: 'canvas-agent-chat',
  description: '画布助手：mock LLM 对话 → 助手回复落 UI',
  prepareWorkspace: prepareCanvasAgentSmokeWorkspace,
  async run(session) {
    const { page, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_AGENT_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_AGENT_TITLE, 15_000)

    await clickTestId(page, 'canvas-header-agent')
    await page.getByTestId('canvas-agent-sidebar').waitFor({ state: 'visible', timeout: 10_000 })

    const userText = 'E2E画布助手对话 mock 测试'
    await fillTestId(page, 'canvas-agent-input', userText)
    await clickTestId(page, 'canvas-agent-send')

    const assistant = page.getByTestId('canvas-agent-message-assistant').last()
    await assistant.waitFor({ state: 'visible', timeout: 15_000 })
    const reply = (await assistant.textContent())?.trim() ?? ''
    assert(reply.includes('E2E mock 画布助手'), `助手回复不符合 mock 预期: ${reply}`)
    assert(reply.includes(userText.slice(0, 20)), `助手回复未回显用户输入: ${reply}`)
  },
}
