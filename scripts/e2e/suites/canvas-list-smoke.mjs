/**
 * E2E 画布列表：搜索 + 进入编辑器
 */
import {
  countCanvasProjectCards,
  fillCanvasProjectSearch,
  gotoHash,
  waitForCanvasEditor,
  waitForCanvasListReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_LIST_SMOKE_DESC,
  E2E_CANVAS_LIST_SMOKE_ID,
  E2E_CANVAS_LIST_SMOKE_TITLE,
  prepareCanvasListSmokeWorkspace,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const canvasListSmokeSuite = {
  name: 'canvas-list-smoke',
  description: '画布列表：搜索标题/描述、点击进入编辑器',
  prepareWorkspace: prepareCanvasListSmokeWorkspace,
  async run(session) {
    const { page, assert } = session

    await gotoHash(page, '#/canvas')
    await waitForCanvasListReady(page)

    await page.getByText(E2E_CANVAS_LIST_SMOKE_TITLE, { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 10_000,
    })

    await fillCanvasProjectSearch(page, '列表描述')
    await page.waitForTimeout(200)
    let count = await countCanvasProjectCards(page)
    assert(count === 1, `搜索描述应剩 1 张卡片，实际 ${count}`)

    await fillCanvasProjectSearch(page, E2E_CANVAS_LIST_SMOKE_TITLE)
    await page.waitForTimeout(200)
    count = await countCanvasProjectCards(page)
    assert(count === 1, `搜索标题应剩 1 张卡片，实际 ${count}`)

    await page.getByTestId(`canvas-project-card-${E2E_CANVAS_LIST_SMOKE_ID}`).click()
    await waitForCanvasEditor(page)

    const hash = await page.evaluate(() => window.location.hash)
    assert(
      hash.includes(`#/canvas/${E2E_CANVAS_LIST_SMOKE_ID}`),
      `点击卡片后应进入编辑器: ${hash}`,
    )
    await page.getByText(E2E_CANVAS_LIST_SMOKE_TITLE, { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    await page.getByTestId('canvas-workflow-surface').waitFor({ state: 'visible', timeout: 15_000 })

    // 描述字段仅用于搜索断言，编辑器内不必展示
    assert(Boolean(E2E_CANVAS_LIST_SMOKE_DESC), 'fixture 描述应非空')
  },
}
