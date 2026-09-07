/**
 * E2E 画布：图片节点就地编辑 → Filerobot 加载 → 保存回写 outputPath
 */
import {
  clickCanvasImageEditDialogSave,
  gotoHash,
  openCanvasImageNodeEditDialog,
  waitForCanvasEditor,
  waitForCanvasFlowNode,
  waitForCanvasImageEditEditorReady,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_IMAGE_EDIT_ID,
  E2E_CANVAS_IMAGE_EDIT_NODE_ID,
  E2E_CANVAS_IMAGE_EDIT_SEED_PATH,
  E2E_CANVAS_IMAGE_EDIT_TITLE,
  prepareCanvasImageEditWorkspace,
  readCanvasProjectData,
  waitForCanvasImageEditSaved,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasImageEditSuite = {
  name: 'canvas-image-edit',
  description: '画布图片节点：打开编辑对话框 → Filerobot 加载 → 保存回写 outputPath',
  prepareWorkspace: prepareCanvasImageEditWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_IMAGE_EDIT_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_IMAGE_EDIT_TITLE, 15_000)

    let data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_IMAGE_EDIT_ID)
    const seedNode = (data?.nodes ?? []).find((node) => node.id === E2E_CANVAS_IMAGE_EDIT_NODE_ID)
    assert(Boolean(seedNode), '预置图片节点缺失')
    assert(seedNode?.data?.outputPath === E2E_CANVAS_IMAGE_EDIT_SEED_PATH, '预置 outputPath 不正确')

    await waitForCanvasFlowNode(page, E2E_CANVAS_IMAGE_EDIT_NODE_ID)
    await page.waitForTimeout(800)

    await openCanvasImageNodeEditDialog(page, E2E_CANVAS_IMAGE_EDIT_NODE_ID)
    await waitForCanvasImageEditEditorReady(page)

    await clickCanvasImageEditDialogSave(page)

    const dialog = page.getByTestId('canvas-image-edit-dialog')
    const [updatedNode, dialogHidden] = await Promise.all([
      waitForCanvasImageEditSaved(
        workspace.dataRoot,
        E2E_CANVAS_IMAGE_EDIT_ID,
        E2E_CANVAS_IMAGE_EDIT_NODE_ID,
        E2E_CANVAS_IMAGE_EDIT_SEED_PATH,
        45_000,
      ),
      dialog
        .waitFor({ state: 'hidden', timeout: 30_000 })
        .then(() => true)
        .catch(() => false),
    ])
    assert(Boolean(updatedNode), '保存后 data.json 未回写 edit_ outputPath')
    assert(
      String(updatedNode?.data?.outputPath || '').includes('assets/images/edit_'),
      '保存后 outputPath 应位于 assets/images/edit_*',
    )
    assert(dialogHidden, '保存成功后编辑对话框应关闭')
  },
}
