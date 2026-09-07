/**
 * E2E 画布编辑器：添加节点 → 自动保存落盘
 */
import {
  clickCanvasAddNodeType,
  gotoHash,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_EDITOR_ID,
  E2E_CANVAS_EDITOR_TITLE,
  prepareCanvasEditorFlowWorkspace,
  readCanvasProjectData,
  waitForCanvasNodeCount,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasEditorFlowSuite = {
  name: 'canvas-editor-flow',
  description: '画布编辑器：浮动工具栏添加文本节点 → data.json 自动保存',
  prepareWorkspace: prepareCanvasEditorFlowWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_EDITOR_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_EDITOR_TITLE, 15_000)

    let data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_EDITOR_ID)
    assert(Array.isArray(data?.nodes) && data.nodes.length === 0, '预置项目应无节点')

    await clickCanvasAddNodeType(page, 'shotPrompt')
    await page.waitForTimeout(400)
    await page.getByText('双击或右键画布添加节点').waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {})

    const nodeCount = await waitForCanvasNodeCount(workspace.dataRoot, E2E_CANVAS_EDITOR_ID, 1, 20_000)
    assert(nodeCount >= 1, `添加节点后 data.json 节点数应 >= 1（实际 ${nodeCount}）`)

    data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_EDITOR_ID)
    const promptNode = (data?.nodes ?? []).find((node) => node.type === 'shotPrompt')
    assert(Boolean(promptNode), 'data.json 应包含 shotPrompt 节点')
  },
}
