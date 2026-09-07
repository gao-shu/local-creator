/**
 * E2E 画布：首页新建项目 → 落盘 → 进入编辑器
 */
import {
  clickTestId,
  fillTestId,
  gotoHash,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_CREATE_TITLE,
  readCanvasProjectsList,
} from '../../lib/canvas-e2e-fixtures.mjs'
import { prepareMinimalE2eWorkspace } from '../../lib/workshop-e2e-fixtures.mjs'

export const canvasProjectCreateSuite = {
  name: 'canvas-project-create',
  description: '画布列表：新建画布对话框 → projects.json 落盘 → 进入编辑器',
  prepareWorkspace: prepareMinimalE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, '#/canvas')
    await waitForText(page, '无限画布', 20_000)

    await clickTestId(page, 'canvas-create-project')
    await page.getByTestId('canvas-create-dialog').waitFor({ state: 'visible', timeout: 10_000 })

    await fillTestId(page, 'canvas-create-title', E2E_CANVAS_CREATE_TITLE)
    await clickTestId(page, 'canvas-create-submit')

    await page.getByTestId('canvas-create-dialog').waitFor({ state: 'hidden', timeout: 15_000 })

    const projects = await readCanvasProjectsList(workspace.dataRoot)
    const created = projects.find((item) => item?.title === E2E_CANVAS_CREATE_TITLE)
    assert(Boolean(created?.id), `canvas/projects.json 未找到新建项目「${E2E_CANVAS_CREATE_TITLE}」`)
    if (!created?.id) return

    await waitForCanvasEditor(page)
    const hash = await page.evaluate(() => window.location.hash)
    assert(
      hash.includes(`#/canvas/${created.id}`),
      `创建后应进入编辑器: ${hash}`,
    )
    await waitForText(page, E2E_CANVAS_CREATE_TITLE, 15_000)
    await page.getByTestId('canvas-workflow-surface').waitFor({ state: 'visible', timeout: 15_000 })
  },
}
