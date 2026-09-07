/**
 * E2E 画布：仅验证图片节点顶栏可展开（不进入 Filerobot）
 */
import {
  gotoHash,
  openCanvasImageNodeTopToolbar,
  waitForCanvasEditor,
  waitForCanvasFlowNode,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_IMAGE_EDIT_ID,
  E2E_CANVAS_IMAGE_EDIT_NODE_ID,
  E2E_CANVAS_IMAGE_EDIT_TITLE,
  prepareCanvasImageEditWorkspace,
  waitForCanvasNodeCount,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasImageEditToolbarSuite = {
  name: 'canvas-image-edit-toolbar',
  description: '画布图片节点：预览加载 → 展开顶栏 → 更多按钮可见',
  prepareWorkspace: prepareCanvasImageEditWorkspace,
  async run(session) {
    const { page, workspace, assert } = session
    const nodeId = E2E_CANVAS_IMAGE_EDIT_NODE_ID
    const editTestId = `canvas-node-${nodeId}-edit-image`
    const toolbarTestId = `canvas-node-${nodeId}-image-toolbar`

    await gotoHash(page, `#/canvas/${E2E_CANVAS_IMAGE_EDIT_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_IMAGE_EDIT_TITLE, 15_000)

    const nodeCount = await waitForCanvasNodeCount(workspace.dataRoot, E2E_CANVAS_IMAGE_EDIT_ID, 1, 15_000)
    assert(nodeCount >= 1, `画布 data.json 应至少有 1 个节点，当前: ${nodeCount}`)

    await waitForCanvasFlowNode(page, nodeId)
    await page.waitForTimeout(800)

    await openCanvasImageNodeTopToolbar(page, nodeId, editTestId)

    assert(
      await page.getByTestId(toolbarTestId).isVisible(),
      '顶栏容器应可见',
    )
    assert(
      await page.getByTestId(editTestId).isVisible(),
      '「编辑」按钮应可见',
    )
  },
}
