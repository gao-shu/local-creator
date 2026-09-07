/**
 * E2E 画布重启级持久化：seed 节点 → 再添加节点 → 关 Electron → 重开 → 校验 data.json / UI
 */
import {
  clickCanvasAddNodeType,
  gotoHash,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_RESTART_ID,
  E2E_CANVAS_RESTART_SEED_NODE_ID,
  E2E_CANVAS_RESTART_TITLE,
  prepareCanvasRestartWorkspace,
  readCanvasProjectData,
  waitForCanvasNodeCount,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasRestartPersistenceSuite = {
  name: 'canvas-restart-persistence',
  description: '关闭 Electron 再打开：画布节点与编辑器 UI 应保持一致',
  prepareWorkspace: prepareCanvasRestartWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_RESTART_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_RESTART_TITLE, 15_000)
    await waitForText(page, '重启种子节点', 15_000)

    await clickCanvasAddNodeType(page, 'imageNode')
    const nodeCountBefore = await waitForCanvasNodeCount(
      workspace.dataRoot,
      E2E_CANVAS_RESTART_ID,
      2,
      20_000,
    )
    assert(nodeCountBefore >= 2, `重启前应至少有 2 个节点（实际 ${nodeCountBefore}）`)

    let data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_RESTART_ID)
    const seedNode = (data?.nodes ?? []).find((node) => node.id === E2E_CANVAS_RESTART_SEED_NODE_ID)
    assert(Boolean(seedNode), '重启前缺少 seed 节点')

    await session.relaunch()

    const relaunchedPage = session.page
    if (!relaunchedPage || relaunchedPage.isClosed()) {
      assert(false, 'relaunch 后 Electron 页面不可用')
      return
    }

    await gotoHash(relaunchedPage, `#/canvas/${E2E_CANVAS_RESTART_ID}`)
    await waitForCanvasEditor(relaunchedPage)
    await waitForText(relaunchedPage, E2E_CANVAS_RESTART_TITLE, 20_000)
    await waitForText(relaunchedPage, '重启种子节点', 20_000)

    data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_RESTART_ID)
    assert(
      (data?.nodes ?? []).length >= 2,
      `重启后 data.json 节点数不足: ${(data?.nodes ?? []).length}`,
    )
    const seedAfter = (data?.nodes ?? []).find((node) => node.id === E2E_CANVAS_RESTART_SEED_NODE_ID)
    assert(Boolean(seedAfter), '重启后 seed 节点丢失')
    assert(
      (data?.nodes ?? []).some((node) => node.type === 'imageNode'),
      '重启后 imageNode 丢失',
    )
  },
}
