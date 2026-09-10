/**
 * E2E F1：画布文本节点智能分镜遮罩取消 → 不落盘新分镜
 */
import {
  gotoHash,
  pollUntil,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_PROMPT_AI_CANCEL_ID,
  E2E_CANVAS_PROMPT_AI_CANCEL_TITLE,
  E2E_CANVAS_PROMPT_AI_NODE_ID,
  prepareCanvasPromptAiCancelWorkspace,
  readCanvasProjectData,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasPromptAiCancelSuite = {
  name: 'canvas-prompt-ai-cancel',
  description: '画布智能分镜：遮罩取消后不写入分镜节点（F1）',
  prepareWorkspace: prepareCanvasPromptAiCancelWorkspace,
  launchEnv: {
    LC_E2E_MOCK_AI: '1',
    LC_E2E_MOCK_DELAY_MS: '8000',
  },
  async run(session) {
    const { page, workspace, assert } = session
    const nodeId = E2E_CANVAS_PROMPT_AI_NODE_ID
    const cancelTestId = `canvas-node-${nodeId}-cancel-prompt-ai`

    await gotoHash(page, `#/canvas/${E2E_CANVAS_PROMPT_AI_CANCEL_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_PROMPT_AI_CANCEL_TITLE, 15_000)

    const before = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_PROMPT_AI_CANCEL_ID)
    const beforeCount = (before?.nodes ?? []).length
    assert(beforeCount === 1, `预置应仅 1 个文本节点（实际 ${beforeCount}）`)

    await page.getByTestId(`canvas-node-${nodeId}`).waitFor({ state: 'visible', timeout: 15_000 })
    await page.getByTestId(`canvas-node-${nodeId}`).click()
    await page.waitForTimeout(500)

    await page.getByTestId('canvas-prompt-generate-storyboard').waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    await page.getByTestId('canvas-prompt-generate-storyboard').click()

    await pollUntil(page, () => page.getByTestId(cancelTestId).count(), 1, 15_000)
    await page.getByTestId(cancelTestId).click()

    await pollUntil(page, () => page.getByTestId(cancelTestId).count(), 0, 10_000)

    // mock 延迟 8s：等待迟到结果窗口结束，确认未落盘
    await page.waitForTimeout(9000)

    const after = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_PROMPT_AI_CANCEL_ID)
    const nodes = after?.nodes ?? []
    const storyVideos = nodes.filter(
      (node) =>
        node.type === 'storyVideo' ||
        (node.data && (node.data.shotNumber != null || node.data.importShotNumber != null)),
    )
    assert(nodes.length === beforeCount, `取消后节点数应仍为 ${beforeCount}（实际 ${nodes.length}）`)
    assert(storyVideos.length === 0, `取消后不应写入分镜节点（实际 ${storyVideos.length}）`)
  },
}
