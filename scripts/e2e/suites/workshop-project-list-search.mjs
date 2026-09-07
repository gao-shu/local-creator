/**
 * E2E 工坊项目列表：搜索 / 分页 / 每页条数
 */
import {
  clickProjectListPage,
  countProjectCards,
  fillProjectSearch,
  gotoHash,
  setProjectPageSize,
  waitForProjectListReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_LIST_ALPHA_ID,
  E2E_LIST_ALPHA_TITLE,
  E2E_LIST_BETA_DESC,
  E2E_LIST_DEFAULT_PAGE_SIZE,
  E2E_LIST_PROJECT_COUNT,
  prepareWorkshopProjectListWorkspace,
} from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopProjectListSearchSuite = {
  name: 'workshop-project-list-search',
  description: '工坊列表：搜索标题/描述、分页、每页条数',
  prepareWorkspace: prepareWorkshopProjectListWorkspace,
  async run(session) {
    const { page, assert } = session

    await gotoHash(page, '#/workshop')
    await waitForProjectListReady(page)

    const page1Count = await countProjectCards(page)
    assert(
      page1Count === E2E_LIST_DEFAULT_PAGE_SIZE,
      `第 1 页应显示 ${E2E_LIST_DEFAULT_PAGE_SIZE} 个项目，实际 ${page1Count}`,
    )

    await fillProjectSearch(page, 'Alpha')
    await page.waitForTimeout(200)
    let filtered = await countProjectCards(page)
    assert(filtered === 1, `搜索 Alpha 应剩 1 张卡片，实际 ${filtered}`)
    await page.getByTestId(`workshop-project-card-${E2E_LIST_ALPHA_ID}`).waitFor({
      state: 'visible',
      timeout: 10_000,
    })

    await fillProjectSearch(page, E2E_LIST_BETA_DESC)
    await page.waitForTimeout(200)
    filtered = await countProjectCards(page)
    assert(filtered === 1, `搜索描述应剩 1 张卡片，实际 ${filtered}`)

    await fillProjectSearch(page, '')
    await page.waitForTimeout(200)
    await clickProjectListPage(page, 2)
    await page.waitForTimeout(200)
    const page2Count = await countProjectCards(page)
    const expectedPage2 = E2E_LIST_PROJECT_COUNT - E2E_LIST_DEFAULT_PAGE_SIZE
    assert(
      page2Count === expectedPage2,
      `第 2 页应显示 ${expectedPage2} 个项目，实际 ${page2Count}`,
    )

    await setProjectPageSize(page, 24)
    await page.waitForTimeout(200)
    const allVisible = await countProjectCards(page)
    assert(
      allVisible === E2E_LIST_PROJECT_COUNT,
      `每页 24 条应显示全部 ${E2E_LIST_PROJECT_COUNT} 个项目，实际 ${allVisible}`,
    )

    await page.getByText(E2E_LIST_ALPHA_TITLE, { exact: false }).first().waitFor({
      state: 'visible',
      timeout: 10_000,
    })
  },
}
