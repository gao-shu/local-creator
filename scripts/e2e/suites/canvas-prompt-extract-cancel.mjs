/**
 * E2E F3：提取资产遮罩取消不落盘，随后智能分镜可再跑完成
 */
import {
  gotoHash,
  pollUntil,
  waitForCanvasEditor,
  waitForCanvasFlowNode,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_PROMPT_EXTRACT_CANCEL_ID,
  E2E_CANVAS_PROMPT_EXTRACT_CANCEL_TITLE,
  E2E_CANVAS_PROMPT_EXTRACT_NODE_ID,
  prepareCanvasPromptExtractCancelWorkspace,
  readCanvasProjectData,
} from '../../lib/canvas-e2e-fixtures.mjs'

function countAssetNodes(nodes) {
  return (nodes ?? []).filter((node) => node.type === 'imageNode').length
}

function countStoryVideos(nodes) {
  return (nodes ?? []).filter(
    (node) =>
      node.type === 'storyVideo' ||
      (node.data && (node.data.shotNumber != null || node.data.importShotNumber != null)),
  ).length
}

/** 遮罩取消按钮可能因动画/重挂载不稳定，force + 短重试 */
async function clickPromptAiCancel(page, cancelTestId, timeoutMs = 20_000) {
  const started = Date.now()
  let lastError = null
  while (Date.now() - started < timeoutMs) {
    const locator = page.getByTestId(cancelTestId)
    try {
      if ((await locator.count()) === 0) {
        await page.waitForTimeout(100)
        continue
      }
      await locator.click({ force: true, timeout: 3_000 })
      return
    } catch (error) {
      lastError = error
      await page.waitForTimeout(150)
    }
  }
  throw lastError ?? new Error(`无法点击取消按钮: ${cancelTestId}`)
}

export const canvasPromptExtractCancelSuite = {
  name: 'canvas-prompt-extract-cancel',
  description: '画布提取资产：取消不落盘，之后智能分镜可再跑（F3）',
  prepareWorkspace: prepareCanvasPromptExtractCancelWorkspace,
  launchEnv: {
    HAODE_E2E_MOCK_AI: '1',
    HAODE_E2E_MOCK_DELAY_MS: '8000',
  },
  async run(session) {
    const { page, workspace, assert } = session
    const nodeId = E2E_CANVAS_PROMPT_EXTRACT_NODE_ID
    const cancelTestId = `canvas-node-${nodeId}-cancel-prompt-ai`
    const projectId = E2E_CANVAS_PROMPT_EXTRACT_CANCEL_ID

    await gotoHash(page, `#/canvas/${projectId}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_PROMPT_EXTRACT_CANCEL_TITLE, 15_000)
    await waitForCanvasFlowNode(page, nodeId)

    const before = await readCanvasProjectData(workspace.dataRoot, projectId)
    const beforeCount = (before?.nodes ?? []).length
    assert(beforeCount === 1, `预置应仅 1 个文本节点（实际 ${beforeCount}）`)

    await page.getByTestId(`canvas-node-${nodeId}`).click()
    await page.getByTestId('canvas-prompt-generate-extract').waitFor({
      state: 'visible',
      timeout: 20_000,
    })
    await page.getByTestId('canvas-prompt-generate-extract').click()

    await pollUntil(page, () => page.getByTestId(cancelTestId).count(), 1, 25_000)
    await clickPromptAiCancel(page, cancelTestId)
    await pollUntil(page, () => page.getByTestId(cancelTestId).count(), 0, 20_000)

    // 等待 mock 迟到结果窗口（略长于 HAODE_E2E_MOCK_DELAY_MS）
    await page.waitForTimeout(9000)

    const afterCancel = await readCanvasProjectData(workspace.dataRoot, projectId)
    const afterCancelNodes = afterCancel?.nodes ?? []
    assert(
      afterCancelNodes.length === beforeCount,
      `取消提取后节点数应仍为 ${beforeCount}（实际 ${afterCancelNodes.length}）`,
    )
    assert(
      countAssetNodes(afterCancelNodes) === 0,
      `取消提取后不应写入资产节点（实际 ${countAssetNodes(afterCancelNodes)}）`,
    )

    // 可再跑：确保文本控制台打开（取消后可能仍开着，再点节点会 toggle 关掉）
    const storyboardBtn = page.getByTestId('canvas-prompt-generate-storyboard')
    if ((await storyboardBtn.count()) === 0) {
      await page.getByTestId(`canvas-node-${nodeId}`).click()
      await storyboardBtn.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    }
    if ((await storyboardBtn.count()) === 0) {
      await page.getByTestId(`canvas-node-${nodeId}`).click()
    }
    await storyboardBtn.waitFor({ state: 'visible', timeout: 20_000 })
    await storyboardBtn.click()
    await pollUntil(page, () => page.getByTestId(cancelTestId).count(), 1, 25_000)

    await pollUntil(
      page,
      async () => {
        const data = await readCanvasProjectData(workspace.dataRoot, projectId)
        return countStoryVideos(data?.nodes ?? [])
      },
      1,
      45_000,
    )

    const afterStoryboard = await readCanvasProjectData(workspace.dataRoot, projectId)
    const storyCount = countStoryVideos(afterStoryboard?.nodes ?? [])
    assert(storyCount > 0, `取消后再跑智能分镜应写入分镜（实际 ${storyCount}）`)
  },
}
