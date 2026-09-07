/**
 * E2E 工坊项目列表：编辑标题落盘、移入回收站
 */
import {
  clickProjectEdit,
  clickProjectDelete,
  confirmDialog,
  fillTestId,
  gotoHash,
  waitForProjectListReady,
  clickTestId,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  E2E_PROJECT_TITLE,
  prepareWorkshopE2eWorkspace,
  readProjectsList,
} from '../../lib/workshop-e2e-fixtures.mjs'

const E2E_EDITED_TITLE = 'E2E编辑后项目标题'

export const workshopProjectLifecycleSuite = {
  name: 'workshop-project-lifecycle',
  description: '工坊列表：编辑标题落盘、移入回收站',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, '#/workshop')
    await waitForProjectListReady(page)

    await clickProjectEdit(page, E2E_PROJECT_ID)
    await page.getByTestId('workshop-edit-dialog').waitFor({ state: 'visible', timeout: 10_000 })
    await fillTestId(page, 'workshop-edit-title', E2E_EDITED_TITLE)
    await clickTestId(page, 'workshop-edit-submit')
    await page.getByTestId('workshop-edit-dialog').waitFor({ state: 'hidden', timeout: 15_000 })

    let projects = await readProjectsList(workspace.workflowDir)
    let meta = projects.find((item) => item?.id === E2E_PROJECT_ID)
    assert(meta?.title === E2E_EDITED_TITLE, `projects.json 标题未更新: ${meta?.title}`)

    await page.getByText(E2E_EDITED_TITLE, { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 10_000,
    })

    await clickProjectDelete(page, E2E_PROJECT_ID)
    await confirmDialog(page, '移入回收站')
    await page.waitForTimeout(500)

    projects = await readProjectsList(workspace.workflowDir)
    meta = projects.find((item) => item?.id === E2E_PROJECT_ID)
    assert(
      meta?.deletedAt != null && Number(meta.deletedAt) > 0,
      `删除后 projects.json 应标记 deletedAt（软删除）: ${JSON.stringify(meta)}`,
    )

    const card = page.getByTestId(`workshop-project-card-${E2E_PROJECT_ID}`)
    assert((await card.count()) === 0, '列表 UI 仍显示已删除项目卡片')

    // 避免影响同 workspace 其它套件：确认原预置标题已不再可见
    const oldTitleVisible = await page.getByText(E2E_PROJECT_TITLE, { exact: false }).count()
    assert(oldTitleVisible === 0, '原项目标题仍出现在列表')
  },
}
