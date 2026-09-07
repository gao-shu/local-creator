/**
 * E2E 画布：图片节点保存/更新到素材库（索引模式）
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import {
  clickTestId,
  gotoHash,
  openCanvasImageNodeMaterialToolbar,
  waitForCanvasEditor,
  waitForCanvasFlowNode,
  waitForCanvasImageNodePreviewReady,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  buildCanvasMaterialSourceAssetId,
  E2E_CANVAS_MAT_SAVE_ID,
  E2E_CANVAS_MAT_SAVE_SEED_PATH,
  E2E_CANVAS_MAT_SAVE_SYNC_LABEL,
  E2E_CANVAS_MAT_SAVE_NODE_ID,
  E2E_CANVAS_MAT_SAVE_TITLE,
  prepareCanvasImageMaterialSaveWorkspace,
  readMaterialsIndex,
  waitForCanvasNodeCount,
  waitForMaterialsCanvasEntry,
} from '../../lib/canvas-e2e-fixtures.mjs'
import { assertMaterialEntryProjectMedia } from '../../lib/global-libraries-e2e-fixtures.mjs'

export const canvasImageMaterialSaveSuite = {
  name: 'canvas-image-material-save',
  description: '画布图片节点：索引模式保存到素材库 → 按钮变为更新 → 再次保存 toast',
  prepareWorkspace: prepareCanvasImageMaterialSaveWorkspace,
  async run(session) {
    const { page, workspace, assert } = session
    const saveTestId = `canvas-node-${E2E_CANVAS_MAT_SAVE_NODE_ID}-save-material`
    const sourceAssetId = buildCanvasMaterialSourceAssetId(E2E_CANVAS_MAT_SAVE_NODE_ID)

    await gotoHash(page, `#/canvas/${E2E_CANVAS_MAT_SAVE_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_MAT_SAVE_TITLE, 15_000)

    const nodeCount = await waitForCanvasNodeCount(workspace.dataRoot, E2E_CANVAS_MAT_SAVE_ID, 1, 15_000)
    assert(nodeCount >= 1, `画布 data.json 应至少有 1 个节点，当前: ${nodeCount}`)

    await waitForCanvasFlowNode(page, E2E_CANVAS_MAT_SAVE_NODE_ID)
    await waitForCanvasImageNodePreviewReady(page, E2E_CANVAS_MAT_SAVE_NODE_ID)
    await page.waitForTimeout(300)

    const indexBefore = await readMaterialsIndex(workspace.dataRoot)
    assert(
      !(indexBefore.characters ?? []).some(
        (item) =>
          item.sourceProjectId === E2E_CANVAS_MAT_SAVE_ID &&
          item.sourceAssetId === sourceAssetId,
      ),
      '测试开始前 materials.json 不应已有该画布节点条目',
    )

    await openCanvasImageNodeMaterialToolbar(page, E2E_CANVAS_MAT_SAVE_NODE_ID)
    const saveButton = page.getByTestId(saveTestId)
    await saveButton.waitFor({ state: 'visible', timeout: 15_000 })
    assert(
      (await saveButton.textContent())?.includes('保存到素材库'),
      `首次保存前按钮应为「保存到素材库」，当前: ${await saveButton.textContent()}`,
    )

    await clickTestId(page, saveTestId)
    await waitForText(page, `「${E2E_CANVAS_MAT_SAVE_SYNC_LABEL}」已写入素材库索引（文件仍在原项目）`, 20_000)

    const entry = await waitForMaterialsCanvasEntry(
      workspace.dataRoot,
      E2E_CANVAS_MAT_SAVE_ID,
      E2E_CANVAS_MAT_SAVE_NODE_ID,
      15_000,
    )
    assert(Boolean(entry), '保存后 materials.json 未写入画布节点条目')
    assert(entry?.name === E2E_CANVAS_MAT_SAVE_SYNC_LABEL, `素材库条目名称不正确: ${entry?.name}`)
    assert(
      String(entry?.generatedImagePath || '').replace(/\\/g, '/') === E2E_CANVAS_MAT_SAVE_SEED_PATH,
      `索引路径应为画布项目相对路径: ${entry?.generatedImagePath}`,
    )
    await assertMaterialEntryProjectMedia(workspace.dataRoot, entry, assert)

    const globalCopyDir = path.join(workspace.dataRoot, 'materials', 'assets', entry.id)
    let globalCopyExists = false
    try {
      await fs.access(globalCopyDir)
      globalCopyExists = true
    } catch {
      globalCopyExists = false
    }
    assert(!globalCopyExists, `索引模式不应创建全局副本目录: ${globalCopyDir}`)

    await page.waitForFunction(
      (testId) => {
        const btn = document.querySelector(`[data-testid="${testId}"]`)
        return btn?.textContent?.includes('更新到素材库') ?? false
      },
      saveTestId,
      { timeout: 15_000 },
    )

    await clickTestId(page, saveTestId)
    await waitForText(page, `「${E2E_CANVAS_MAT_SAVE_SYNC_LABEL}」已更新到素材库索引`, 20_000)

    const indexAfter = await readMaterialsIndex(workspace.dataRoot)
    const matched = (indexAfter.characters ?? []).filter(
      (item) =>
        item.sourceProjectId === E2E_CANVAS_MAT_SAVE_ID &&
        item.sourceAssetId === sourceAssetId,
    )
    assert(matched.length === 1, `更新后应仍只有 1 条素材库记录，当前: ${matched.length}`)
  },
}
