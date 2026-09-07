/**
 * Electron E2E 共用工具
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const REPO_ROOT = path.resolve(__dirname, '../..')
export const MAIN_ENTRY = path.join(REPO_ROOT, 'out/main/index.cjs')
export const E2E_SCREENSHOT_DIR = path.join(REPO_ROOT, '.tmp-e2e')

export function assertCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

export async function ensureCompiled() {
  try {
    await fs.access(MAIN_ENTRY)
  } catch {
    throw new Error('未找到 out/main/index.cjs，请先运行 npm run compile')
  }
}

export async function captureFailureScreenshot(page, label) {
  try {
    await fs.mkdir(E2E_SCREENSHOT_DIR, { recursive: true })
    const safe = label.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 80)
    const filePath = path.join(E2E_SCREENSHOT_DIR, `${Date.now()}-${safe}.png`)
    await page.screenshot({ path: filePath, fullPage: true })
    console.error(`已保存截图: ${filePath}`)
  } catch (error) {
    console.error('截图失败:', error)
  }
}

export async function gotoHash(page, hash) {
  const route = hash.startsWith('#') ? hash : `#${hash}`
  await page.evaluate((target) => {
    window.location.hash = target
  }, route)
}

export async function waitForElectronReady(page, timeoutMs = 60_000) {
  await page.waitForFunction(
    () =>
      Boolean(window.electronAPI?.isElectron) &&
      Boolean(window.workflowAPI?.listProjects),
    { timeout: timeoutMs },
  )
}

/** 等待 Auth/Settings 引导完成（本地模式进入壳层） */
export async function waitForAppBootstrap(page, timeoutMs = 60_000) {
  await page.waitForFunction(
    () => {
      const body = document.body.textContent ?? ''
      if (body.includes('欢迎回来')) return true
      if (body.includes('项目管理')) return true
      if (body.includes('创作工坊')) return true
      if (document.querySelector('[data-testid="workshop-script-textarea"]')) return true
      if (document.querySelector('[data-testid="workshop-step-nav-step1"]')) return true
      return false
    },
    { timeout: timeoutMs },
  )
}

/** 等待工坊项目页加载完成（跳过「加载项目…」） */
export async function waitForWorkshopProjectReady(page, timeoutMs = 60_000) {
  await page.waitForFunction(
    () => {
      const body = document.body.textContent ?? ''
      if (body.includes('加载项目')) return false
      return Boolean(
        document.querySelector('[data-testid="workshop-script-textarea"]') ||
          document.querySelector('[data-testid^="storyboard-shot-"]') ||
          document.querySelector('[data-testid="workshop-step-nav-step1"]'),
      )
    },
    { timeout: timeoutMs },
  )
}

export async function waitForText(page, text, timeoutMs = 20_000) {
  await page.getByText(text, { exact: false }).first().waitFor({
    state: 'visible',
    timeout: timeoutMs,
  })
}

export async function clickTestId(page, testId, options) {
  const locator = page.getByTestId(testId)
  await locator.waitFor({ state: 'visible', timeout: options?.timeoutMs ?? 20_000 })
  await locator.click(options)
}

export async function fillTestId(page, testId, value) {
  const locator = page.getByTestId(testId)
  await locator.waitFor({ state: 'visible', timeout: 20_000 })
  await locator.fill(value)
}

export async function clickWorkshopStepNav(page, stepKey) {
  await clickTestId(page, `workshop-step-nav-${stepKey}`)
}

export async function clickStoryboardRightTab(page, tabKey) {
  await clickTestId(page, `storyboard-right-tab-${tabKey}`)
}

export async function clickShotGenerateImage(page, shotId) {
  await clickTestId(page, `storyboard-shot-${shotId}-generate-image`)
}

export async function clickShotGenerateVideo(page, shotId) {
  await clickTestId(page, `storyboard-shot-${shotId}-generate-video`)
}

export async function clickShotStopImage(page, shotId) {
  await clickTestId(page, `storyboard-shot-${shotId}-stop-image`)
}

export async function clickShotStopVideo(page, shotId) {
  await clickTestId(page, `storyboard-shot-${shotId}-stop-video`)
}

export async function hoverProjectCard(page, projectId) {
  await page.getByTestId(`workshop-project-card-${projectId}`).hover()
}

/** 等待工坊项目列表加载完成（非「加载中…」） */
export async function waitForProjectListReady(page, timeoutMs = 30_000) {
  await waitForText(page, '项目管理', timeoutMs)
  await page.waitForFunction(
    () => {
      const body = document.body.textContent ?? ''
      if (body.includes('加载中...')) return false
      return Boolean(
        document.querySelector('[data-testid^="workshop-project-card-"]') ||
          document.querySelector('[data-testid="workshop-project-search"]'),
      )
    },
    { timeout: timeoutMs },
  )
}

/** 等待画布编辑器加载（#/canvas/:id） */
export async function waitForCanvasEditor(page, timeoutMs = 45_000) {
  await page.getByTestId('canvas-editor-shell').waitFor({ state: 'visible', timeout: timeoutMs })
}

/** 等待画布节点挂载到 React Flow（避免仅 data.json 已写入但 DOM 未渲染） */
export async function waitForCanvasFlowNode(page, nodeId, timeoutMs = 45_000) {
  const testId = `canvas-node-${nodeId}`
  await page.waitForFunction(
    (id) => Boolean(document.querySelector(`[data-testid="${id}"]`)),
    testId,
    { timeout: timeoutMs },
  )
  const node = page.getByTestId(testId)
  await node.waitFor({ state: 'visible', timeout: timeoutMs })
  await node.scrollIntoViewIfNeeded().catch(() => {})
}

/** 等待画布项目列表加载完成 */
export async function waitForCanvasListReady(page, timeoutMs = 30_000) {
  await page.getByTestId('canvas-create-project').waitFor({ state: 'visible', timeout: timeoutMs })
  await page.waitForFunction(
    () => {
      const body = document.body.textContent ?? ''
      if (!document.querySelector('[data-testid="canvas-project-search"]')) return false
      if (body.includes('加载中...')) return false
      return Boolean(document.querySelector('[data-testid^="canvas-project-card-"]'))
    },
    { timeout: timeoutMs },
  )
}

export async function fillCanvasProjectSearch(page, query) {
  await fillTestId(page, 'canvas-project-search', query)
}

export async function countCanvasProjectCards(page) {
  return page.locator('[data-testid^="canvas-project-card-"]').count()
}

export async function hoverCanvasProjectCard(page, projectId) {
  const card = page.getByTestId(`canvas-project-card-${projectId}`)
  await card.scrollIntoViewIfNeeded()
  await card.hover()
}

export async function clickCanvasProjectEdit(page, projectId) {
  await hoverCanvasProjectCard(page, projectId)
  await clickTestId(page, `canvas-project-edit-${projectId}`)
}

export async function clickCanvasProjectDelete(page, projectId) {
  await hoverCanvasProjectCard(page, projectId)
  await clickTestId(page, `canvas-project-delete-${projectId}`)
}

export async function clickCanvasAddNodeType(page, nodeType) {
  await clickTestId(page, 'canvas-floating-add-node')
  await clickTestId(page, `canvas-add-node-${nodeType}`)
}

export async function waitForCanvasImageNodePreviewReady(page, nodeId, timeoutMs = 45_000) {
  const nodeTestId = `canvas-node-${nodeId}`
  await waitForCanvasFlowNode(page, nodeId)
  const node = page.getByTestId(nodeTestId)
  await node.scrollIntoViewIfNeeded().catch(() => {})
  const previewImg = node.locator('img').first()
  await previewImg.waitFor({ state: 'attached', timeout: timeoutMs })
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
    { timeout: timeoutMs },
  )
}

/** 在节点 DOM 内触发预览点击（不依赖 -preview testId，与 openCanvasImageNodeConsole 一致） */
async function dispatchCanvasImageNodePreviewClick(page, nodeId) {
  const nodeTestId = `canvas-node-${nodeId}`
  await page.evaluate((id) => {
    const root = document.querySelector(`[data-testid="${id}"]`)
    if (!root) throw new Error(`canvas node missing: ${id}`)
    const preview = root.querySelector('[role="button"]')
    if (preview instanceof HTMLElement) {
      preview.click()
      return
    }
    const img = root.querySelector('img')
    if (img instanceof HTMLElement) {
      img.click()
      return
    }
    root.click()
  }, nodeTestId)
}

/** 点击预览区展开顶栏/控制台（调用方应已确认节点与图片就绪，避免重复 waitForCanvasFlowNode） */
async function clickCanvasImageNodePreviewSurface(page, nodeId) {
  const nodeTestId = `canvas-node-${nodeId}`
  const node = page.getByTestId(nodeTestId)
  await node.scrollIntoViewIfNeeded().catch(() => {})

  const previewTestId = `${nodeTestId}-preview`
  const previewByTestId = page.getByTestId(previewTestId)
  if ((await previewByTestId.count()) > 0) {
    try {
      await previewByTestId.click({ force: true, position: { x: 24, y: 24 }, timeout: 3_000 })
      return
    } catch {
      /* testId 存在但 Playwright 点不到时走 DOM click */
    }
  }

  const previewByRole = node.locator('[role="button"]').first()
  if ((await previewByRole.count()) > 0) {
    try {
      await previewByRole.click({ force: true, position: { x: 24, y: 24 }, timeout: 3_000 })
      return
    } catch {
      /* 同上 */
    }
  }

  await dispatchCanvasImageNodePreviewClick(page, nodeId)
}

export async function openCanvasImageNodeTopToolbar(page, nodeId, anchorTestId) {
  const toolbarTestId = `canvas-node-${nodeId}-image-toolbar`

  await waitForCanvasFlowNode(page, nodeId)
  await waitForCanvasImageNodePreviewReady(page, nodeId)

  const anchor = page.getByTestId(anchorTestId)
  const toolbar = page.getByTestId(toolbarTestId)

  if (await anchor.isVisible().catch(() => false)) {
    return
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await anchor.isVisible().catch(() => false)) {
      return
    }

    const toolbarVisible = await toolbar.isVisible().catch(() => false)
    if (!toolbarVisible) {
      await clickCanvasImageNodePreviewSurface(page, nodeId)
      await toolbar.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {})
      await page.waitForTimeout(200)
      continue
    }

    // 控制台已展开：勿再点预览（会 toggle 关闭），只等待顶栏按钮挂载
    await anchor.waitFor({ state: 'visible', timeout: 4_000 }).catch(() => {})
    if (await anchor.isVisible().catch(() => false)) {
      return
    }
    await page.waitForTimeout(300)
  }

  await anchor.waitFor({ state: 'visible', timeout: 15_000 })
}

async function clickCanvasImageNodePreview(page, nodeId) {
  const testId = `canvas-node-${nodeId}`
  await waitForCanvasFlowNode(page, nodeId)
  await page.waitForFunction(
    (id) => {
      const root = document.querySelector(`[data-testid="${id}"]`)
      if (!root) return false
      return Boolean(root.querySelector('[role="button"]') || root.querySelector('img'))
    },
    testId,
    { timeout: 20_000 },
  )
  await dispatchCanvasImageNodePreviewClick(page, nodeId)
}

export async function openCanvasImageNodeConsole(page, nodeId) {
  await waitForCanvasFlowNode(page, nodeId)
  await clickCanvasImageNodePreview(page, nodeId)
  await page.waitForTimeout(400)
  const generate = page.getByTestId(`canvas-node-${nodeId}-generate-image`)
  if (!(await generate.isVisible().catch(() => false))) {
    await clickCanvasImageNodePreview(page, nodeId)
    await page.waitForTimeout(400)
  }
  await generate.waitFor({ state: 'visible', timeout: 15_000 })
}

export async function clickCanvasNodeGenerateImage(page, nodeId) {
  await openCanvasImageNodeConsole(page, nodeId)
  await clickTestId(page, `canvas-node-${nodeId}-generate-image`)
}

export async function clickCanvasNodeStopImage(page, nodeId) {
  await clickTestId(page, `canvas-node-${nodeId}-stop-image`)
}

export async function openCanvasImageNodeMaterialToolbar(page, nodeId) {
  await openCanvasImageNodeTopToolbar(page, nodeId, `canvas-node-${nodeId}-save-material`)
}

export async function openCanvasImageNodeEditDialog(page, nodeId) {
  const editTestId = `canvas-node-${nodeId}-edit-image`
  await openCanvasImageNodeTopToolbar(page, nodeId, editTestId)
  await page.waitForFunction(
    (testId) => {
      const btn = document.querySelector(`[data-testid="${testId}"]`)
      return btn instanceof HTMLButtonElement && !btn.disabled
    },
    editTestId,
    { timeout: 15_000 },
  )
  await page.getByTestId(editTestId).click({ force: true })
  await page.getByTestId('canvas-image-edit-dialog').waitFor({ state: 'attached', timeout: 15_000 })
}

export async function waitForCanvasImageEditEditorReady(page, timeoutMs = 45_000) {
  const dialog = page.getByTestId('canvas-image-edit-dialog')
  await dialog.getByText('正在加载图片…').waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {})
  await dialog.getByText('调整', { exact: true }).waitFor({ state: 'visible', timeout: timeoutMs })
}

/** 点击 Filerobot 顶栏「保存」→ 确认「保存为」弹窗（portal 在 body）→ 等待保存结束 */
export async function clickCanvasImageEditDialogSave(page, timeoutMs = 45_000) {
  const dialog = page.getByTestId('canvas-image-edit-dialog')
  await dialog.waitFor({ state: 'visible', timeout: 15_000 })

  const exactSaveButtons = page.locator('button').filter({ hasText: /^保存$/ })
  await exactSaveButtons.first().click({ force: true, timeout: 15_000 })

  await page.getByText('保存为', { exact: true }).waitFor({ state: 'visible', timeout: 8_000 })
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll('button')].filter(
        (btn) => (btn.textContent || '').trim() === '保存' && !btn.disabled,
      ).length >= 2,
    { timeout: 8_000 },
  )
  await exactSaveButtons.nth(1).click({ force: true, timeout: 15_000 })

  await dialog.getByText('正在保存…').waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {})
  await dialog.getByText('正在保存…').waitFor({ state: 'hidden', timeout: timeoutMs }).catch(() => {})
}

export async function openCanvasVideoNodeConsole(page, nodeId) {
  const node = page.getByTestId(`canvas-node-${nodeId}`)
  await node.scrollIntoViewIfNeeded()
  const toolbarHint = node.getByText('点击展开工具栏')
  if (await toolbarHint.count()) {
    await toolbarHint.click()
  } else {
    await node.click()
  }
  await page.getByTestId(`canvas-node-${nodeId}-generate-video`).waitFor({
    state: 'visible',
    timeout: 10_000,
  })
}

export async function clickCanvasNodeGenerateVideo(page, nodeId) {
  await openCanvasVideoNodeConsole(page, nodeId)
  await clickTestId(page, `canvas-node-${nodeId}-generate-video`)
}

export async function fillProjectSearch(page, query) {
  const input = page.getByTestId('workshop-project-search')
  await input.waitFor({ state: 'visible', timeout: 20_000 })
  await input.fill(query)
}

export async function countProjectCards(page) {
  return page.locator('[data-testid^="workshop-project-card-"]').count()
}

export async function setProjectPageSize(page, size) {
  const locator = page.getByTestId('workshop-project-page-size')
  await locator.waitFor({ state: 'visible', timeout: 30_000 })
  await locator.click()
  await page.getByRole('option', { name: `${size} / page`, exact: true }).click()
  await page.waitForTimeout(300)
}

export async function clickProjectListPage(page, pageNum) {
  const btn = page.getByTestId(`workshop-project-page-${pageNum}`)
  await btn.scrollIntoViewIfNeeded()
  await btn.click({ force: true })
}

export async function clickProjectEdit(page, projectId) {
  await hoverProjectCard(page, projectId)
  await clickTestId(page, `workshop-project-edit-${projectId}`)
}

export async function clickProjectDelete(page, projectId) {
  await hoverProjectCard(page, projectId)
  await clickTestId(page, `workshop-project-delete-${projectId}`)
}

/** Step1：通过隐藏 file input 导入本地剧本文件 */
export async function importScriptFile(page, filePath) {
  await page.getByTestId('workshop-step1-import-input').setInputFiles(filePath)
}

/** 等待设置页加载完成（paths 输入框可见） */
export async function waitForSettingsReady(page, timeoutMs = 45_000) {
  await page.waitForFunction(
    () => {
      const body = document.body.textContent ?? ''
      if (body.includes('加载设置')) return false
      const input = document.querySelector('[data-testid="settings-portable-data-root-input"]')
      return input instanceof HTMLInputElement
    },
    { timeout: timeoutMs },
  )
  await page.getByTestId('settings-portable-data-root-input').waitFor({
    state: 'visible',
    timeout: 10_000,
  })
}

/** 点击 ConfirmDialog 取消按钮 */
export async function cancelConfirmDialog(page, timeoutMs = 15_000) {
  const byTestId = page.getByTestId('confirm-dialog-cancel')
  try {
    await byTestId.waitFor({ state: 'visible', timeout: timeoutMs })
    await byTestId.click()
    return
  } catch {
    /* 兼容旧弹窗 */
  }
  const btn = page.getByRole('button', { name: '取消', exact: true }).last()
  await btn.waitFor({ state: 'visible', timeout: timeoutMs })
  await btn.click()
}

/** 点击 ConfirmDialog 确认按钮 */
export async function confirmDialog(page, confirmLabel, timeoutMs = 10_000) {
  const byTestId = page.getByTestId('confirm-dialog-confirm')
  try {
    await byTestId.waitFor({ state: 'visible', timeout: timeoutMs })
    await byTestId.click()
    return
  } catch {
    /* 兼容旧弹窗 */
  }
  const btn = page.getByRole('button', { name: confirmLabel, exact: true }).last()
  await btn.waitFor({ state: 'visible', timeout: timeoutMs })
  await btn.click()
}

/** 读取 Step4 镜头卡片 id 列表（仅根卡片，排除删除/生图等子按钮 testid） */
export async function listStoryboardShotIds(page) {
  return page.$$eval('[data-testid^="storyboard-shot-"][data-shot-number]', (elements) =>
    elements.map((el) => (el.getAttribute('data-testid') ?? '').replace(/^storyboard-shot-/, '')),
  )
}

/** 等待手动保存完成（按钮进入「已保存」态） */
export async function waitForManualSaveDone(page, timeoutMs = 15_000) {
  await page.getByTestId('workshop-manual-save').getByText('已保存').waitFor({
    state: 'visible',
    timeout: timeoutMs,
  })
}

/** 若出现 ConfirmDialog，点击确认（如「继续重建」） */
export async function confirmDialogIfVisible(page, confirmLabel = '继续重建', timeoutMs = 3_000) {
  const btn = page.getByRole('button', { name: confirmLabel })
  try {
    await btn.waitFor({ state: 'visible', timeout: timeoutMs })
    await btn.click()
    return true
  } catch {
    return false
  }
}

export async function openTaskStatusPanel(page) {
  await clickTestId(page, 'task-status-button')
  await page.getByTestId('task-status-panel').waitFor({ state: 'visible', timeout: 10_000 })
}

export async function closeTaskStatusPanel(page) {
  await clickTestId(page, 'task-status-close')
  await page.getByTestId('task-status-panel').waitFor({ state: 'hidden', timeout: 10_000 })
}

export async function clickTaskEntryCancel(page, taskId, options) {
  const locator = page.getByTestId(`task-entry-${taskId}-cancel`)
  await locator.waitFor({ state: 'visible', timeout: options?.timeoutMs ?? 12_000 })
  await locator.click()
}

export async function clickTaskEntryDelete(page, taskId, options) {
  const locator = page.getByTestId(`task-entry-${taskId}-delete`)
  await locator.waitFor({ state: 'visible', timeout: options?.timeoutMs ?? 12_000 })
  await locator.click()
}

/** 从任务面板摘要解析「进行中 N」 */
export async function readActiveTaskCountFromPanel(page) {
  const summary = page.getByTestId('task-status-active-summary')
  await summary.waitFor({ state: 'visible', timeout: 10_000 })
  const text = (await summary.textContent()) ?? ''
  const match = text.match(/进行中\s+(\d+)/)
  return match ? Number(match[1]) : 0
}

export async function waitForActiveTaskCount(page, minCount, timeoutMs = 15_000) {
  await openTaskStatusPanel(page)
  const started = Date.now()
  let count = 0
  while (Date.now() - started < timeoutMs) {
    count = await readActiveTaskCountFromPanel(page)
    if (count >= minCount) {
      await closeTaskStatusPanel(page)
      return count
    }
    await page.waitForTimeout(300)
    await clickTestId(page, 'task-filter-active')
  }
  await closeTaskStatusPanel(page)
  return count
}

/** 统计 Step4 镜头卡片上 data-image-busy=true 的数量 */
export async function countShotImageBusy(page, minCount, timeoutMs = 15_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const count = await page.locator('[data-image-busy="true"]').count()
    if (count >= minCount) return count
    await page.waitForTimeout(250)
  }
  return page.locator('[data-image-busy="true"]').count()
}

/** 统计 Step4 镜头卡片上 data-video-busy=true 的数量 */
export async function countShotVideoBusy(page, minCount, timeoutMs = 15_000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const count = await page.locator('[data-video-busy="true"]').count()
    if (count >= minCount) return count
    await page.waitForTimeout(250)
  }
  return page.locator('[data-video-busy="true"]').count()
}

/** 在 timeout 内轮询直到 fn 返回值 >= minCount（用于点击前启动监听，避免瞬态 UI 漏检） */
export async function pollUntil(page, fn, minCount, timeoutMs = 20_000) {
  const started = Date.now()
  let last = 0
  while (Date.now() - started < timeoutMs) {
    last = await fn()
    if (last >= minCount) return last
    await page.waitForTimeout(100)
  }
  return last
}

export async function countTaskEntries(page, options = {}) {
  let selector = '[data-testid^="task-entry-"]'
  if (options.status) selector += `[data-task-status="${options.status}"]`
  if (options.type) selector += `[data-task-type="${options.type}"]`
  return page.locator(selector).count()
}

export async function readDataJson(projectDir) {
  const filePath = path.join(projectDir, 'data.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw)
}

export async function dumpFailureArtifacts(page, projectDir, label) {
  await captureFailureScreenshot(page, label)
  try {
    await fs.mkdir(E2E_SCREENSHOT_DIR, { recursive: true })
    const safe = label.replace(/[^\w\u4e00-\u9fff-]+/g, '_').slice(0, 80)
    const dumpPath = path.join(E2E_SCREENSHOT_DIR, `${Date.now()}-${safe}-dump.json`)
    const tasksPath = path.join(projectDir, 'tasks.json')
    let tasks = []
    try {
      tasks = JSON.parse(await fs.readFile(tasksPath, 'utf-8'))
    } catch {
      /* ignore */
    }
    let data = null
    try {
      data = await readDataJson(projectDir)
    } catch {
      /* ignore */
    }
    const panelOpen = await page.getByTestId('task-status-panel').isVisible().catch(() => false)
    let panelText = ''
    if (panelOpen) {
      panelText = await page.getByTestId('task-status-panel').innerText()
    }
    await fs.writeFile(
      dumpPath,
      JSON.stringify({ label, tasks, dataScriptPreview: data?.script?.slice(0, 200), panelText }, null, 2),
      'utf-8',
    )
    console.error(`已保存诊断: ${dumpPath}`)
  } catch (error) {
    console.error('诊断 dump 失败:', error)
  }
}
