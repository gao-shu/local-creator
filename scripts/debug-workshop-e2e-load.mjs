/**
 * 诊断 E2E 项目加载（一次性调试脚本）
 */
import { gotoHash, waitForAppBootstrap, waitForElectronReady } from './lib/e2e-helpers.mjs'
import { closeElectronApp, launchElectronApp } from './lib/electron-launcher.mjs'
import { E2E_PROJECT_ID, prepareWorkshopE2eWorkspace } from './lib/workshop-e2e-fixtures.mjs'

const workspace = await prepareWorkshopE2eWorkspace()
let electronApp = null
try {
  ;({ app: electronApp } = await launchElectronApp({ launcherDir: workspace.launcherDir }))
  const page = await electronApp.firstWindow()
  await waitForElectronReady(page)
  await gotoHash(page, '#/dashboard')
  await waitForAppBootstrap(page)
  await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/1`)

  await page.waitForTimeout(5000)

  const snapshot = await page.evaluate(async (projectId) => {
    const list = await window.workflowAPI.listProjects()
    const project = await window.workflowAPI.getProject(projectId)
    const data = await window.workflowAPI.readData(projectId)
    const settings = await window.settingsAPI.read()
    return {
      hash: window.location.hash,
      body: (document.body.innerText || '').slice(0, 800),
      hasTextarea: Boolean(document.querySelector('[data-testid="workshop-script-textarea"]')),
      hasStepNav: Boolean(document.querySelector('[data-testid="workshop-step-nav-step1"]')),
      list,
      project,
      dataOk: Boolean(data?.success),
      settingsOk: Boolean(settings?.success),
      dataRoot: settings?.data?.dataRootPath,
      workflowPath: settings?.data?.workflowDataPath,
    }
  }, E2E_PROJECT_ID)

  console.log(JSON.stringify(snapshot, null, 2))
} finally {
  await closeElectronApp(electronApp)
  if (process.env.LC_E2E_KEEP !== '1') {
    await workspace.cleanup()
  } else {
    console.log('保留目录:', workspace.root)
  }
}
