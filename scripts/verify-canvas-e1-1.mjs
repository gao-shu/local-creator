/**
 * E1-1 UI 验收：remoteJob 已落盘后（F5 之前）节点应显示续接态
 * 需在 dev server 运行后执行：
 *   终端 A: npm run dev
 *   终端 B: npm run verify:canvas-e1-1:ui
 */
import { chromium } from 'playwright'
import {
  E1_API_TASK_ID,
  E1_PROGRESS_MESSAGE,
  NODE_ID,
  PROJECT_ID,
  VERIFY_AUTH_STORAGE,
  VIDEO_REMOTE_JOB_HANG_MS,
  assertCondition,
  buildCanvasDataWithVideoNode,
  buildIdleVideoNodeData,
  buildRemoteJobSnapshot,
  buildResumableCanvasData,
  readVideoNodeFromCanvasJson,
  storageKey,
  applyPersistRemoteJobToCanvasData,
} from './lib/canvas-e1-fixtures.mjs'

const BASE = process.env.UI_BASE_URL || 'http://localhost:15173'

async function main() {
  const errors = []
  const now = Date.now()
  const resumableData = buildResumableCanvasData(now)
  const canvasKey = storageKey(PROJECT_ID)

  const browser = await chromium.launch()
  const context = await browser.newContext()
  await context.addInitScript(
    ({ storageJson, key, canvasJson }) => {
      localStorage.setItem('auth-storage', storageJson)
      localStorage.setItem('token', 'verify-ui-token')
      sessionStorage.setItem(key, canvasJson)
    },
    {
      storageJson: VERIFY_AUTH_STORAGE,
      key: canvasKey,
      canvasJson: JSON.stringify(resumableData),
    },
  )

  const page = await context.newPage()
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))

  // —— E1-1d / E1-1e：落盘数据（F5 前，initScript 注入 ≈ persist 完成）——
  const seededRaw = JSON.stringify(resumableData)
  const seededNode = readVideoNodeFromCanvasJson(seededRaw)
  assertCondition(
    seededNode?.data?.remoteJob?.apiTaskId === E1_API_TASK_ID,
    'E1-1d：remoteJob.apiTaskId 未落盘',
    errors,
  )
  assertCondition(seededNode?.data?.status === 'running', 'E1-1e：节点 status 非 running', errors)
  assertCondition(
    Boolean(seededNode?.data?.progressMessage?.includes('E1验收')),
    'E1-1：progressMessage 未持久化',
    errors,
  )

  const url = `${BASE}/#/canvas/${PROJECT_ID}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByRole('button', { name: '参数设置' }).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1200)

  const sessionOnLoad = await page.evaluate((key) => sessionStorage.getItem(key), canvasKey)
  assertCondition(sessionOnLoad, 'E1-1d：进入画布后 sessionStorage 无项目数据', errors)
  if (sessionOnLoad) {
    const node = readVideoNodeFromCanvasJson(sessionOnLoad)
    assertCondition(
      node?.data?.remoteJob?.apiTaskId === E1_API_TASK_ID,
      'E1-1d：进入画布后 remoteJob.apiTaskId 丢失',
      errors,
    )
    assertCondition(node?.data?.status === 'running', 'E1-1e：进入画布后 status 非 running', errors)
    const age = Date.now() - (node?.data?.remoteJob?.createdAt || 0)
    assertCondition(age < VIDEO_REMOTE_JOB_HANG_MS, 'E1-1：remoteJob 已被判定 stale', errors)
  }

  // —— E1-1b：节点 progress UI ——
  const pageContent = await page.content()
  assertCondition(
    pageContent.includes(E1_PROGRESS_MESSAGE) || pageContent.includes('视频生成中'),
    'E1-1b：节点未显示进行中 progress UI',
    errors,
  )

  // —— E1-1 模拟：idle → persist（契约与存储形状，不要求实时 API）——
  const idleData = buildCanvasDataWithVideoNode(buildIdleVideoNodeData())
  const persisted = applyPersistRemoteJobToCanvasData(
    idleData,
    NODE_ID,
    buildRemoteJobSnapshot(now),
    now,
  )
  const afterPersist = readVideoNodeFromCanvasJson(persisted)
  assertCondition(
    afterPersist?.data?.remoteJob?.apiTaskId === E1_API_TASK_ID,
    'E1-1 模拟 persist：remoteJob 未写入',
    errors,
  )
  assertCondition(afterPersist?.data?.status === 'running', 'E1-1 模拟 persist：status 未变 running', errors)

  await browser.close()

  if (errors.length > 0) {
    console.error('E1-1 UI 验收失败:\n' + errors.map((item) => `  - ${item}`).join('\n'))
    process.exit(1)
  }

  console.log('E1-1 UI 验收通过：remoteJob 落盘 → 节点 running UI（F5 前）')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
