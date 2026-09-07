/**
 * E2E Step1：导入剧本文件（.txt）
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import {
  clickTestId,
  confirmDialog,
  gotoHash,
  importScriptFile,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  prepareWorkshopEmptyScriptWorkspace,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const E2E_IMPORT_MARKER = 'E2E导入文件剧本内容Alpha'
export const E2E_IMPORT_REPLACE_MARKER = 'E2E导入覆盖剧本内容Beta'

export const workshopStep1ImportSuite = {
  name: 'workshop-step1-import',
  description: 'Step1：导入 .txt 落盘；有内容时确认覆盖',
  prepareWorkspace: prepareWorkshopEmptyScriptWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    const importPath = path.join(workspace.root, 'e2e-script.txt')
    await fs.writeFile(importPath, E2E_IMPORT_MARKER, 'utf-8')

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/1`)
    await waitForWorkshopProjectReady(page)
    await page.getByTestId('workshop-script-textarea').waitFor({ state: 'visible', timeout: 30_000 })
    await waitForText(page, '导入文件', 20_000)

    await importScriptFile(page, importPath)
    await page.waitForFunction(
      (marker) => {
        const el = document.querySelector('[data-testid="workshop-script-textarea"]')
        return el instanceof HTMLTextAreaElement && el.value.includes(marker)
      },
      E2E_IMPORT_MARKER,
      { timeout: 15_000 },
    )

    await clickTestId(page, 'workshop-manual-save')
    await page.waitForTimeout(800)

    let data = await readProjectData(workspace.projectDir)
    assert(data?.script?.includes(E2E_IMPORT_MARKER), '空剧本导入后 data.json 未落盘')

    // --- 有内容时再导入：应弹出「继续导入」确认 ---
    const replacePath = path.join(workspace.root, 'e2e-script-replace.txt')
    await fs.writeFile(replacePath, E2E_IMPORT_REPLACE_MARKER, 'utf-8')
    await importScriptFile(page, replacePath)
    await confirmDialog(page, '继续导入')

    await page.waitForFunction(
      (marker) => {
        const el = document.querySelector('[data-testid="workshop-script-textarea"]')
        return el instanceof HTMLTextAreaElement && el.value.includes(marker)
      },
      E2E_IMPORT_REPLACE_MARKER,
      { timeout: 15_000 },
    )

    await clickTestId(page, 'workshop-manual-save')
    await page.waitForTimeout(800)

    data = await readProjectData(workspace.projectDir)
    assert(
      data?.script?.includes(E2E_IMPORT_REPLACE_MARKER),
      '覆盖导入后 data.json 未更新',
    )
    assert(
      !data?.script?.includes(E2E_IMPORT_MARKER),
      '覆盖导入后旧内容仍残留在 data.json',
    )
  },
}
