/**
 * E2E 画布：视频节点 mock 生视频 → data.json success + outputPath
 */
import {
  clickCanvasNodeGenerateVideo,
  gotoHash,
  waitForCanvasEditor,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_CANVAS_VIDEO_GEN_ID,
  E2E_CANVAS_VIDEO_GEN_TITLE,
  E2E_CANVAS_VIDEO_NODE_ID,
  prepareCanvasVideoGenerateWorkspace,
  readCanvasProjectData,
  waitForCanvasVideoNodeSuccess,
} from '../../lib/canvas-e2e-fixtures.mjs'

export const canvasVideoGenerateSuite = {
  name: 'canvas-video-generate',
  description: '画布视频节点：mock 生视频 → 节点 success + outputPath 落盘',
  prepareWorkspace: prepareCanvasVideoGenerateWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/canvas/${E2E_CANVAS_VIDEO_GEN_ID}`)
    await waitForCanvasEditor(page)
    await waitForText(page, E2E_CANVAS_VIDEO_GEN_TITLE, 15_000)

    let data = await readCanvasProjectData(workspace.dataRoot, E2E_CANVAS_VIDEO_GEN_ID)
    const seedNode = (data?.nodes ?? []).find((node) => node.id === E2E_CANVAS_VIDEO_NODE_ID)
    assert(Boolean(seedNode), '预置视频节点缺失')
    assert(!seedNode?.data?.outputPath, '预置节点不应已有 outputPath')

    await clickCanvasNodeGenerateVideo(page, E2E_CANVAS_VIDEO_NODE_ID)

    const doneNode = await waitForCanvasVideoNodeSuccess(
      workspace.dataRoot,
      E2E_CANVAS_VIDEO_GEN_ID,
      E2E_CANVAS_VIDEO_NODE_ID,
      45_000,
    )
    assert(Boolean(doneNode), 'mock 生视频后 data.json 未写入 success 节点')
    assert(Boolean(doneNode?.data?.outputPath), 'mock 生视频后缺少 outputPath')

    await waitForText(page, '视频生成完成', 15_000).catch(() => {})
  },
}
