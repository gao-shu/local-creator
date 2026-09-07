/**
 * E2E Step3：单资产编辑 / 新增 / 删除
 */
import {
  clickTestId,
  confirmDialog,
  gotoHash,
  waitForText,
  waitForWorkshopProjectReady,
} from '../../lib/e2e-helpers.mjs'
import {
  E2E_PROJECT_ID,
  prepareWorkshopE2eWorkspace,
  readProjectData,
} from '../../lib/workshop-e2e-fixtures.mjs'

const E2E_CHAR_ID = 'char_e2e_1'
const E2E_CHAR_EDIT_NAME = 'E2E主角已改名'
const E2E_CHAR_EDIT_DESC = 'E2E角色描述已修改'
const E2E_PROP_NAME = 'E2E测试道具'
const E2E_PROP_DESC = 'E2E道具描述用于删除测试'

export const workshopStep3AssetCrudSuite = {
  name: 'workshop-step3-asset-crud',
  description: 'Step3：编辑角色、新增道具、删除道具并落盘',
  prepareWorkspace: prepareWorkshopE2eWorkspace,
  async run(session) {
    const { page, workspace, assert } = session

    await gotoHash(page, `#/workshop/${E2E_PROJECT_ID}/step/3`)
    await waitForWorkshopProjectReady(page)
    await waitForText(page, '角色设定', 20_000)
    await page.getByTestId(`workshop-asset-item-${E2E_CHAR_ID}`).waitFor({ state: 'visible' })

    // --- 编辑已有角色 ---
    await clickTestId(page, `workshop-asset-item-${E2E_CHAR_ID}`)
    await page.getByTestId('workshop-asset-name').fill(E2E_CHAR_EDIT_NAME)
    await page.getByTestId('workshop-asset-description').fill(E2E_CHAR_EDIT_DESC)
    await clickTestId(page, 'workshop-manual-save')
    await page.waitForTimeout(800)

    let data = await readProjectData(workspace.projectDir)
    const editedChar = data?.characters?.find((item) => item.id === E2E_CHAR_ID)
    assert(editedChar?.name === E2E_CHAR_EDIT_NAME, `角色名称未落盘，当前: ${editedChar?.name}`)
    assert(
      editedChar?.description === E2E_CHAR_EDIT_DESC,
      `角色描述未落盘，当前: ${editedChar?.description?.slice(0, 40)}`,
    )

    // --- 物品 Tab 新增道具 ---
    await clickTestId(page, 'workshop-step3-tab-prop')
    await waitForText(page, '物品设定', 10_000)
    await clickTestId(page, 'workshop-step3-add-asset')
    await page.getByTestId('workshop-asset-name').waitFor({ state: 'visible', timeout: 10_000 })

    const propItem = page.locator('[data-testid^="workshop-asset-item-"]').first()
    const propTestId = await propItem.getAttribute('data-testid')
    assert(propTestId?.startsWith('workshop-asset-item-'), '新增道具后未找到资产列表项')
    const propId = propTestId.replace('workshop-asset-item-', '')

    await page.getByTestId('workshop-asset-name').fill(E2E_PROP_NAME)
    await page.getByTestId('workshop-asset-description').fill(E2E_PROP_DESC)
    await clickTestId(page, 'workshop-manual-save')
    await page.waitForTimeout(800)

    data = await readProjectData(workspace.projectDir)
    const addedProp = data?.props?.find((item) => item.id === propId)
    assert(addedProp?.name === E2E_PROP_NAME, `道具名称未落盘，当前: ${addedProp?.name}`)
    assert(addedProp?.description === E2E_PROP_DESC, '道具描述未落盘')

    // --- 删除刚新增的道具 ---
    await clickTestId(page, `workshop-asset-delete-${propId}`)
    await confirmDialog(page, '删除')
    await clickTestId(page, 'workshop-manual-save')
    await page.waitForTimeout(800)

    data = await readProjectData(workspace.projectDir)
    assert(
      !data?.props?.some((item) => item.id === propId),
      '删除后 data.json 仍包含该道具',
    )
    assert(
      (await page.getByTestId(`workshop-asset-item-${propId}`).count()) === 0,
      '删除后 UI 仍显示该道具',
    )
  },
}
