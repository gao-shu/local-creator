/**
 * 诊断 canvas-image-material-save E2E 卡在哪一步
 *   node scripts/debug-canvas-material-save-e2e.mjs
 */
import { E2eSession } from './e2e/context.mjs'
import { gotoHash, waitForCanvasEditor, waitForCanvasFlowNode, waitForText } from './lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_MAT_SAVE_ID,
  E2E_CANVAS_MAT_SAVE_NODE_ID,
  E2E_CANVAS_MAT_SAVE_TITLE,
  prepareCanvasImageMaterialSaveWorkspace,
  waitForCanvasNodeCount,
} from './lib/canvas-e2e-fixtures.mjs'

const STEP_TIMEOUT_MS = 45_000

function log(step, detail = '') {
  const ts = new Date().toISOString().slice(11, 19)
  console.log(`[${ts}] ${step}${detail ? ` — ${detail}` : ''}`)
}

async function timed(stepName, fn) {
  log(`▶ ${stepName}`)
  const started = Date.now()
  try {
    const result = await Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`超时 ${STEP_TIMEOUT_MS}ms`)), STEP_TIMEOUT_MS),
      ),
    ])
    log(`✓ ${stepName}`, `${Date.now() - started}ms`)
    return result
  } catch (error) {
    log(`✗ ${stepName}`, `${Date.now() - started}ms · ${error instanceof Error ? error.message : error}`)
    throw error
  }
}

async function probeDom(page, label) {
  const snapshot = await page.evaluate((nodeId) => {
    const shell = Boolean(document.querySelector('[data-testid="canvas-editor-shell"]'))
    const node = document.querySelector(`[data-testid="canvas-node-${nodeId}"]`)
    const preview = document.querySelector(`[data-testid="canvas-node-${nodeId}-preview"]`)
    const toolbar = document.querySelector(`[data-testid="canvas-node-${nodeId}-image-toolbar"]`)
    const saveBtn = document.querySelector(`[data-testid="canvas-node-${nodeId}-save-material"]`)
    const img = node?.querySelector('img')
    return {
      hash: window.location.hash,
      bodySnippet: (document.body.textContent ?? '').slice(0, 200),
      shell,
      node: Boolean(node),
      preview: Boolean(preview),
      toolbar: Boolean(toolbar),
      saveBtn: Boolean(saveBtn),
      saveBtnText: saveBtn?.textContent?.trim() ?? '',
      img: img
        ? {
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            src: String(img.currentSrc || img.src || '').slice(0, 120),
          }
        : null,
    }
  }, E2E_CANVAS_MAT_SAVE_NODE_ID)
  log(`  DOM@${label}`, JSON.stringify(snapshot))
}

const session = new E2eSession({
  label: 'debug-canvas-material-save',
  prepareWorkspace: prepareCanvasImageMaterialSaveWorkspace,
})

try {
  await timed('prepareWorkspace + launch Electron', async () => {
    await session.start()
  })

  const { page, workspace } = session

  await timed('gotoHash canvas editor', async () => {
    await gotoHash(page, `#/canvas/${E2E_CANVAS_MAT_SAVE_ID}`)
  })
  await probeDom(page, 'after-goto')

  await timed('waitForCanvasEditor', async () => {
    await waitForCanvasEditor(page, STEP_TIMEOUT_MS)
  })
  await probeDom(page, 'after-shell')

  await timed('waitForText project title', async () => {
    await waitForText(page, E2E_CANVAS_MAT_SAVE_TITLE, STEP_TIMEOUT_MS)
  })

  await timed('waitForCanvasNodeCount (disk)', async () => {
    const count = await waitForCanvasNodeCount(workspace.dataRoot, E2E_CANVAS_MAT_SAVE_ID, 1, 15_000)
    if (count < 1) throw new Error(`nodes=${count}`)
  })

  await timed('waitForCanvasFlowNode', async () => {
    await waitForCanvasFlowNode(page, E2E_CANVAS_MAT_SAVE_NODE_ID, STEP_TIMEOUT_MS)
  })
  await probeDom(page, 'after-flow-node')

  await timed('waitForCanvasImageNodePreviewReady (img loaded)', async () => {
    const nodeTestId = `canvas-node-${E2E_CANVAS_MAT_SAVE_NODE_ID}`
    const previewTestId = `canvas-node-${E2E_CANVAS_MAT_SAVE_NODE_ID}-preview`
    await page.getByTestId(previewTestId).waitFor({ state: 'attached', timeout: STEP_TIMEOUT_MS })
    await page.waitForFunction(
      (id) => {
        const root = document.querySelector(`[data-testid="${id}"]`)
        const img = root?.querySelector('img')
        return (
          img instanceof HTMLImageElement &&
          img.complete &&
          img.naturalWidth > 0 &&
          Boolean(String(img.currentSrc || img.src || '').trim())
        )
      },
      nodeTestId,
      { timeout: STEP_TIMEOUT_MS },
    )
  })
  await probeDom(page, 'after-preview-ready')

  await timed('open toolbar + save button visible', async () => {
    const saveTestId = `canvas-node-${E2E_CANVAS_MAT_SAVE_NODE_ID}-save-material`
    const toolbarTestId = `canvas-node-${E2E_CANVAS_MAT_SAVE_NODE_ID}-image-toolbar`
    const previewTestId = `canvas-node-${E2E_CANVAS_MAT_SAVE_NODE_ID}-preview`
    const anchor = page.getByTestId(saveTestId)
    if (await anchor.isVisible().catch(() => false)) return

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (await anchor.isVisible().catch(() => false)) return
      const toolbar = page.getByTestId(toolbarTestId)
      if (!(await toolbar.isVisible().catch(() => false))) {
        await page.getByTestId(previewTestId).click({ force: true, position: { x: 24, y: 24 } })
        await toolbar.waitFor({ state: 'visible', timeout: 5_000 }).catch(() => {})
      }
      await page.waitForTimeout(400)
    }
    await anchor.waitFor({ state: 'visible', timeout: 15_000 })
  })
  await probeDom(page, 'after-toolbar')

  log('诊断完成：以上步骤均应 ✓')
} catch (error) {
  log('诊断中止', error instanceof Error ? error.message : String(error))
  if (session.page) {
    await probeDom(session.page, 'on-failure').catch(() => {})
  }
  process.exitCode = 1
} finally {
  await session.stop()
}
