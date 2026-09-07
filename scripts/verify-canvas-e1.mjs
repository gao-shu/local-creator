/**
 * E1 验收：画布 video remoteJob 落盘后 F5，节点仍 running、续接态 UI 可见
 * 需在 dev server 运行后执行：npm run dev && npm run verify:canvas-e1
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
  buildResumableCanvasData,
  readVideoNodeFromCanvasJson,
  storageKey,
} from './lib/canvas-e1-fixtures.mjs'

const BASE = process.env.UI_BASE_URL || 'http://localhost:15173'

async function main() {
  const errors = []
  const resumableData = buildResumableCanvasData()
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

  const url = `${BASE}/#/canvas/${PROJECT_ID}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.getByRole('button', { name: '参数设置' }).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1000)

  const sessionBeforeReload = await page.evaluate((key) => sessionStorage.getItem(key), canvasKey)
  assertCondition(sessionBeforeReload, 'E1-1d：F5 前 sessionStorage 无画布数据', errors)
  if (sessionBeforeReload) {
    const node = readVideoNodeFromCanvasJson(sessionBeforeReload)
    assertCondition(
      node?.data?.remoteJob?.apiTaskId === E1_API_TASK_ID,
      'E1-1d：F5 前 remoteJob.apiTaskId 未落盘',
      errors,
    )
    assertCondition(node?.data?.status === 'running', 'E1-1e：F5 前节点 status 非 running', errors)
  }

  const beforeReload = await page.content()
  assertCondition(
    beforeReload.includes(E1_PROGRESS_MESSAGE) || beforeReload.includes('视频生成中'),
    'E1-1b：首次进入节点未显示 persisted progress UI',
    errors,
  )

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '参数设置' }).first().waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(1000)

  const afterReload = await page.content()
  assertCondition(
    afterReload.includes(E1_PROGRESS_MESSAGE) || afterReload.includes('视频生成中'),
    'E1-2：F5 后节点 progress UI 消失',
    errors,
  )

  const sessionAfterReload = await page.evaluate((key) => sessionStorage.getItem(key), canvasKey)
  assertCondition(sessionAfterReload, 'E1-2：F5 后 sessionStorage 中 remoteJob 数据丢失', errors)
  if (sessionAfterReload) {
    const node = readVideoNodeFromCanvasJson(sessionAfterReload)
    assertCondition(
      node?.data?.remoteJob?.apiTaskId === E1_API_TASK_ID,
      'E1-2：F5 后 remoteJob.apiTaskId 未保留',
      errors,
    )
    assertCondition(node?.data?.status === 'running', 'E1-2：F5 后节点 status 非 running', errors)
    const age = Date.now() - (node?.data?.remoteJob?.createdAt || 0)
    assertCondition(age < VIDEO_REMOTE_JOB_HANG_MS, 'E1-2：F5 后 remoteJob 被判定 stale', errors)
  }

  await browser.close()

  if (errors.length > 0) {
    console.error('E1 验收失败:\n' + errors.map((item) => `  - ${item}`).join('\n'))
    process.exit(1)
  }

  console.log('E1 验收通过：E1-1 落盘态 + F5 后续接 UI 可见')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
