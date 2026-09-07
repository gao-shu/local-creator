/**
 * E2E 工坊项目列表：新建项目 → 落盘 → 进入 Step1
 */
import {
  clickTestId,
  fillTestId,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  prepareMinimalE2eWorkspace,
  readProjectsList,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const E2E_CREATE_PROJECT_TITLE = 'E2E新建项目测试'

export const workshopProjectCreateSuite = {
  name: 'workshop-project-create',
  description: '工坊列表：新建项目对话框 → projects.json 落盘 → 进入 Step1',
  prepareWorkspace: prepareMinimalE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, '#/workshop')
    await waitForText(page, '创作工坊', 20_000)

    await clickTestId(page, 'workshop-create-project')
    await page.getByTestId('workshop-create-dialog').waitFor({ state: 'visible', timeout: 10_000 })

    await fillTestId(page, 'workshop-create-title', E2E_CREATE_PROJECT_TITLE)
    await clickTestId(page, 'workshop-create-submit')

    await page.getByTestId('workshop-create-dialog').waitFor({ state: 'hidden', timeout: 15_000 })

    const projects = await readProjectsList(workspace.workflowDir)
    const created = projects.find((item) => item?.title === E2E_CREATE_PROJECT_TITLE)
    assert(Boolean(created?.id), `projects.json 未找到新建项目「${E2E_CREATE_PROJECT_TITLE}」`)

    // 创建成功后会 navigate 到 Step1，无需等待列表卡片
    await waitForWorkshopProjectReady(page)
    await page.getByTestId('workshop-script-textarea').waitFor({ state: 'visible', timeout: 30_000 })
    await waitForText(page, '导入文件', 20_000)

    const titleOnPage = await page.getByTestId('workshop-project-title').innerText()
    assert(titleOnPage.includes(E2E_CREATE_PROJECT_TITLE), `顶栏标题未显示新建项目: ${titleOnPage}`)
  },
}
