/**
 * 诊断 canvas-image-edit 保存按钮 DOM
 *   node scripts/debug-canvas-image-edit-save-e2e.mjs
 */
import { E2eSession } from './e2e/context.mjs'
import {
  clickCanvasImageEditDialogSave,
  gotoHash,
  openCanvasImageNodeEditDialog,
  waitForCanvasEditor,
  waitForCanvasFlowNode,
  waitForCanvasImageEditEditorReady,
} from './lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_IMAGE_EDIT_ID,
  E2E_CANVAS_IMAGE_EDIT_NODE_ID,
  prepareCanvasImageEditWorkspace,
  readCanvasProjectData,
} from './lib/canvas-e2e-fixtures.mjs'

const session = new E2eSession({
  label: 'debug-canvas-image-edit-save',
  prepareWorkspace: prepareCanvasImageEditWorkspace,
})

try {
  await session.start()
  const { page } = session

  await gotoHash(page, `#/canvas/${E2E_CANVAS_IMAGE_EDIT_ID}`)
  await waitForCanvasEditor(page)
  await waitForCanvasFlowNode(page, E2E_CANVAS_IMAGE_EDIT_NODE_ID)
  await openCanvasImageNodeEditDialog(page, E2E_CANVAS_IMAGE_EDIT_NODE_ID)
  await waitForCanvasImageEditEditorReady(page)

  const snapBefore = await page.evaluate(() => {
    const root = document.querySelector('[data-testid="canvas-image-edit-dialog"]')
    const save = [...(root?.querySelectorAll('button') ?? [])].find((b) => (b.textContent || '').trim() === '保存')
    return { saveDisabled: save instanceof HTMLButtonElement ? save.disabled : null }
  })
  console.log('before save:', snapBefore)

  await clickCanvasImageEditDialogSave(page)

  await page.waitForTimeout(2000)

  const snapAfter = await page.evaluate(() => ({
    dialogOpen: Boolean(document.querySelector('[data-testid="canvas-image-edit-dialog"]')),
    savingText: Boolean(document.body.textContent?.includes('正在保存')),
    toasts: [...document.querySelectorAll('[data-sonner-toast], [role="status"]')].map((el) =>
      (el.textContent || '').trim().slice(0, 80),
    ),
  }))
  console.log('after save:', JSON.stringify(snapAfter, null, 2))

  const data = await readCanvasProjectData(session.workspace.dataRoot, E2E_CANVAS_IMAGE_EDIT_ID)
  const node = (data?.nodes ?? []).find((n) => n.id === E2E_CANVAS_IMAGE_EDIT_NODE_ID)
  console.log('data.json outputPath:', node?.data?.outputPath)
} finally {
  await session.stop()
}
