/**
 * E2E 画布：图片节点 mock 生图 → data.json success + outputPath
 */
import {
  clickCanvasNodeGenerateImage,
  gotoHash,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_IMAGE_GEN_ID,
  E2E_CANVAS_IMAGE_GEN_TITLE,
  E2E_CANVAS_IMAGE_NODE_ID,
  prepareCanvasImageGenerateWorkspace,
  readCanvasProjectData,
  waitForCanvasImageNodeSuccess,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasImageGenerateSuite = {
  name: 'canvas-image-generate',
  description: '画布图片节点：mock 生图 → 节点 success + outputPath 落盘',
  prepareWorkspace: prepareCanvasImageGenerateWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_IMAGE_GEN_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_IMAGE_GEN_TITLE, 15_000)

    let data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_IMAGE_GEN_ID)
    const seedNode = (data?.nodes ?? []).find((node) => node.id === E2E_CANVAS_IMAGE_NODE_ID)
    assert(Boolean(seedNode), '预置图片节点缺失')
    assert(!seedNode?.data?.outputPath, '预置节点不应已有 outputPath')

    await clickCanvasNodeGenerateImage(page, E2E_CANVAS_IMAGE_NODE_ID)

    const doneNode = await waitForCanvasImageNodeSuccess(
      workspace.dataRoot,
      E2E_CANVAS_IMAGE_GEN_ID,
      E2E_CANVAS_IMAGE_NODE_ID,
      30_000,
    )
    assert(Boolean(doneNode), 'mock 生图后 data.json 未写入 success 节点')
    assert(Boolean(doneNode?.data?.outputPath), 'mock 生图后缺少 outputPath')

    await waitForText(page, '图片生成完成', 15_000).catch(() => {})
  },
}
