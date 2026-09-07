/**
 * 诊断 canvas-image-edit-toolbar E2E 卡在哪一步
 *   node scripts/debug-canvas-image-edit-toolbar-e2e.mjs
 */
import { E2eSession } from './e2e/context.mjs'
import {
  gotoHash,
  openCanvasImageNodeTopToolbar,
  waitForCanvasEditor,
  waitForCanvasFlowNode,
  waitForText,
} from './lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_IMAGE_EDIT_ID,
  E2E_CANVAS_IMAGE_EDIT_NODE_ID,
  E2E_CANVAS_IMAGE_EDIT_TITLE,
  prepareCanvasImageEditWorkspace,
  waitForCanvasNodeCount,
} from './lib/canvas-e2e-fixtures.mjs'

const STEP_TIMEOUT_MS = 45_000
const nodeId = E2E_CANVAS_IMAGE_EDIT_NODE_ID

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
  const snapshot = await page.evaluate((id) => {
    const shell = Boolean(document.querySelector('[data-testid="canvas-editor-shell"]'))
    const node = document.querySelector(`[data-testid="canvas-node-${id}"]`)
    const preview = document.querySelector(`[data-testid="canvas-node-${id}-preview"]`)
    const previewRole = node?.querySelector('[role="button"]')
    const toolbar = document.querySelector(`[data-testid="canvas-node-${id}-image-toolbar"]`)
    const moreBtn = document.querySelector(`[data-testid="canvas-node-${id}-more"]`)
    const img = node?.querySelector('img')
    return {
      hash: window.location.hash,
      bodySnippet: (document.body.textContent ?? '').slice(0, 200),
      shell,
      node: Boolean(node),
      previewTestId: Boolean(preview),
      previewRole: Boolean(previewRole),
      toolbar: Boolean(toolbar),
      moreBtn: Boolean(moreBtn),
      moreBtnText: moreBtn?.textContent?.trim() ?? '',
      img: img
        ? {
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            src: String(img.currentSrc || img.src || '').slice(0, 120),
          }
        : null,
    }
  }, nodeId)
  log(`  DOM@${label}`, JSON.stringify(snapshot))
}

const session = new E2eSession({
  label: 'debug-canvas-image-edit-toolbar',
  prepareWorkspace: prepareCanvasImageEditWorkspace,
})

try {
  await timed('prepareWorkspace + launch Electron', async () => {
    await session.start()
  })

  const { page, workspace } = session

  await timed('gotoHash canvas editor', async () => {
    await gotoHash(page, `#/canvas/${E2E_CANVAS_IMAGE_EDIT_ID}`)
  })
  await probeDom(page, 'after-goto')

  await timed('waitForCanvasEditor', async () => {
    await waitForCanvasEditor(page, STEP_TIMEOUT_MS)
  })
  await probeDom(page, 'after-shell')

  await timed('waitForText project title', async () => {
    await waitForText(page, E2E_CANVAS_IMAGE_EDIT_TITLE, STEP_TIMEOUT_MS)
  })

  await timed('waitForCanvasNodeCount (disk)', async () => {
    const count = await waitForCanvasNodeCount(workspace.dataRoot, E2E_CANVAS_IMAGE_EDIT_ID, 1, 15_000)
    if (count < 1) throw new Error(`nodes=${count}`)
  })

  await timed('waitForCanvasFlowNode', async () => {
    await waitForCanvasFlowNode(page, nodeId, STEP_TIMEOUT_MS)
  })
  await probeDom(page, 'after-flow-node')

  await timed('openCanvasImageNodeTopToolbar (more visible)', async () => {
    const moreTestId = `canvas-node-${nodeId}-more`
    await openCanvasImageNodeTopToolbar(page, nodeId, moreTestId)
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
