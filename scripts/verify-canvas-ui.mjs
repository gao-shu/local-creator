/**
 * 画布模块 UI 验收（computed style + 布局结构）
 *
 * 前置：npm run dev 已启动
 *   终端 A: npm run dev
 *   终端 B: npm run verify:canvas-ui
 *   PowerShell: $env:UI_BASE_URL="http://localhost:<端口>"; npm run verify:canvas-ui
 */
import { chromium } from 'playwright'
import { VERIFY_AUTH_STORAGE } from './lib/canvas-e1-fixtures.mjs'

const BASE = (process.env.UI_BASE_URL || 'http://localhost:15173').replace(/\/+$/, '')

function fail(msg) {
  console.error(`[FAIL] ${msg}`)
  process.exit(1)
}

function ok(msg) {
  console.log(`[OK] ${msg}`)
}

function assertCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

async function readComputedStyle(page, selector) {
  return page.locator(selector).first().evaluate((el) => {
    const cs = getComputedStyle(el)
    return {
      backgroundColor: cs.backgroundColor,
      borderRadius: cs.borderRadius,
      backdropFilter: cs.backdropFilter,
      display: cs.display,
      visibility: cs.visibility,
    }
  })
}

function borderRadiusAtLeast(actual, minPx, tolerance = 1) {
  const value = parseFloat(actual)
  if (Number.isNaN(value)) return false
  return value + tolerance >= minPx
}

function isVisibleStyle(style) {
  return style.display !== 'none' && style.visibility !== 'hidden'
}

async function main() {
  const errors = []
  console.log(`\n=== Canvas UI Verify: ${BASE} ===\n`)

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript((storageJson) => {
    localStorage.setItem('auth-storage', storageJson)
    localStorage.setItem('token', 'verify-ui-token')
  }, VERIFY_AUTH_STORAGE)
  const page = await context.newPage()

  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (text.includes('Maximum update depth')) return
    errors.push(`console: ${text}`)
  })

  // —— 画布列表新建入口 ——
  await page.goto(`${BASE}/#/canvas`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(1200)

  await page.getByTestId('canvas-create-project').waitFor({ state: 'visible', timeout: 15_000 })
  assertCondition(
    (await page.getByText('无限画布').count()) > 0,
    '画布列表页缺少「无限画布」标题',
    errors,
  )
  ok('画布列表：新建入口可见')

  const createBtnStyle = await readComputedStyle(page, '[data-testid="canvas-create-project"]')
  assertCondition(
    borderRadiusAtLeast(createBtnStyle.borderRadius, 8),
    `新建入口圆角不足: ${createBtnStyle.borderRadius}`,
    errors,
  )
  ok(`画布列表：新建入口圆角 ${createBtnStyle.borderRadius}`)

  // —— 编辑器 dev preview ——
  await page.goto(`${BASE}/#/canvas/cv_dev_preview`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(1500)

  await page.getByTestId('canvas-editor-shell').waitFor({ state: 'visible', timeout: 20_000 })
  await page.getByTestId('canvas-workflow-surface').waitFor({ state: 'visible', timeout: 20_000 })
  ok('编辑器：shell / workflow 表面可见')

  for (const label of ['导出至剪映草稿', '导出成片', '参数设置', '对话']) {
    assertCondition(
      (await page.getByRole('button', { name: label }).count()) > 0,
      `编辑器顶栏缺少「${label}」按钮`,
      errors,
    )
  }
  ok('编辑器：顶栏导出 / 参数 / 对话按钮可见')

  const workflowStyle = await readComputedStyle(page, '[data-testid="canvas-workflow-surface"]')
  assertCondition(
    borderRadiusAtLeast(workflowStyle.borderRadius, 10),
    `画布 workflow 圆角不足: ${workflowStyle.borderRadius}`,
    errors,
  )
  ok(`编辑器：workflow 圆角 ${workflowStyle.borderRadius}`)

  await page.getByTestId('canvas-header-params').click()
  await page.waitForTimeout(600)
  await page.getByTestId('canvas-params-panel').waitFor({ state: 'visible', timeout: 10_000 })
  const paramsStyle = await readComputedStyle(page, '[data-testid="canvas-params-panel"]')
  assertCondition(isVisibleStyle(paramsStyle), '参数面板不可见', errors)
  ok('编辑器：参数设置侧栏打开正常')

  await page.getByTestId('canvas-header-agent').click()
  await page.waitForTimeout(600)
  await page.getByTestId('canvas-agent-sidebar').waitFor({ state: 'visible', timeout: 10_000 })
  assertCondition(
    (await page.getByText('画布助手').count()) > 0,
    'Agent 侧栏缺少「画布助手」标题',
    errors,
  )
  ok('编辑器：画布助手侧栏打开正常')

  await browser.close()

  if (errors.length) {
    console.error('\n── 失败项 ──')
    for (const item of errors) console.error(`  ✗ ${item}`)
    fail(`Canvas UI 验收失败（${errors.length} 项）`)
  }

  console.log('\nCanvas UI 验收全部通过\n')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
