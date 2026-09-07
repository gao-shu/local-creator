/**
 * 阶段 4.2 手测清单（可自动化项）：
 * A1 开侧栏 · A3 关闭 · A5 外开 API · A6 与 Agent 互斥 · A7 resize bounds
 * A2 真人登录 / A4 登录持久化：见探针 1.1/1.2，本套件不扫码
 */
import {
  clickTestId,
  gotoHash,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_AGENT_ID,
  E2E_CANVAS_AGENT_TITLE,
  prepareCanvasAgentSmokeWorkspace,
} from '../../lib/canvas-e2e-fixtures.mjs'

async function doubaoGetState(page) {
  return page.evaluate(async () => {
    const api = window.doubaoWebPanelAPI
    if (!api) return { success: false, error: 'doubaoWebPanelAPI missing', open: false, bounds: null }
    return api.getState()
  })
}

/** 等原生 BrowserView 与 React 壳对齐（api.open 异步） */
async function waitForDoubaoNativeOpen(page, expectOpen, timeoutMs = 15_000) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    last = await doubaoGetState(page)
    if (last?.success && Boolean(last.open) === expectOpen) return last
    await page.waitForTimeout(150)
  }
  return last
}

export const canvasDoubaoWebPanelSuite = {
  name: 'canvas-doubao-web-panel',
  description: '4.2 豆包网页侧栏：开合、外开、与对话互斥、窗口缩放 bounds',
  prepareWorkspace: prepareCanvasAgentSmokeWorkspace,
  async run(session) {
    const { page, assert, electronApp } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_AGENT_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_AGENT_TITLE, 15_000)

    const toggle = page.getByTestId('canvas-doubao-web-toggle')
    await toggle.waitFor({ state: 'visible', timeout: 10_000 })
    assert(await toggle.isEnabled(), 'A1: 豆包按钮应可用（Electron preload）')

    // —— A1：打开 ——
    await clickTestId(page, 'canvas-doubao-web-toggle')
    await page.getByTestId('canvas-doubao-web-panel').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByTestId('canvas-doubao-web-hint').waitFor({ state: 'visible', timeout: 5_000 })
    let state = await waitForDoubaoNativeOpen(page, true, 15_000)
    assert(state?.success && state.open, `A1: getState 应为 open（${JSON.stringify(state)}）`)
    assert(
      Boolean(state.bounds && state.bounds.width > 40 && state.bounds.height > 40),
      `A1: bounds 应贴合宿主区（${JSON.stringify(state.bounds)}）`,
    )

    // —— A7：改窗口大小 ——
    const win = await electronApp.browserWindow(page)
    await win.evaluate((bw, size) => {
      bw.setSize(size.width, size.height)
    }, { width: 1280, height: 820 })
    state = await waitForDoubaoNativeOpen(page, true, 15_000)
    assert(state?.success && state.open, 'A7: resize 后侧栏应仍打开')
    assert(
      Boolean(state.bounds && state.bounds.width > 40 && state.bounds.height > 40),
      `A7: resize 后仍有有效 bounds（${JSON.stringify(state.bounds)}）`,
    )

    // —— A6：开对话 → 豆包应收起 ——
    await clickTestId(page, 'canvas-header-agent')
    await page.getByTestId('canvas-agent-sidebar').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByTestId('canvas-doubao-web-panel').waitFor({ state: 'hidden', timeout: 15_000 })
    state = await waitForDoubaoNativeOpen(page, false, 15_000)
    assert(state?.success && !state.open, `A6: 开对话后豆包应关闭（${JSON.stringify(state)}）`)

    // 再开豆包 → Agent 应收起
    await clickTestId(page, 'canvas-doubao-web-toggle')
    await page.getByTestId('canvas-doubao-web-panel').waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByTestId('canvas-agent-sidebar').waitFor({ state: 'hidden', timeout: 10_000 })
    state = await waitForDoubaoNativeOpen(page, true, 15_000)
    assert(state?.success && state.open, `A6: 再开豆包后应 open（${JSON.stringify(state)}）`)

    // —— A5：外开 ——
    const external = await page.evaluate(async () => {
      const api = window.doubaoWebPanelAPI
      if (!api?.openExternal) return { success: false, error: 'no openExternal' }
      return api.openExternal()
    })
    assert(external.success, `A5: openExternal 应成功（${JSON.stringify(external)}）`)
    state = await waitForDoubaoNativeOpen(page, true, 10_000)
    assert(state?.open, 'A5: 外开后内嵌侧栏仍应保持打开')

    // —— A3：关闭 ——
    await clickTestId(page, 'canvas-doubao-web-close')
    await page.getByTestId('canvas-doubao-web-panel').waitFor({ state: 'hidden', timeout: 15_000 })
    state = await waitForDoubaoNativeOpen(page, false, 15_000)
    assert(state?.success && !state.open, `A3: 关闭后 open=false（${JSON.stringify(state)}）`)
  },
}
