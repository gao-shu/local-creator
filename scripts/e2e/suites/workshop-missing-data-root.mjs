/**
 * E2E 未绑定数据根：首页创建拦截 + 便携存储设置页
 */
import {
  gotoHash,
  waitForSettingsReady,
  waitForText,
} from '../../lib/e2e-helpers.mjs'
import { prepareWorkshopMissingDataRootWorkspace } from '../../lib/workshop-e2e-fixtures.mjs'

export const workshopMissingDataRootSuite = {
  name: 'workshop-missing-data-root',
  description: '未绑定数据根：禁止从工坊列表新建、便携存储设置可访问',
  prepareWorkspace: prepareWorkshopMissingDataRootWorkspace,
  async run(session) {
    const { page, assert } = session

    await gotoHash(page, '#/workshop')
    await waitForText(page, '创作工坊', 20_000)

    const createBtn = page.getByTestId('workshop-create-project')
    await createBtn.waitFor({ state: 'visible', timeout: 20_000 })
    assert(await createBtn.isDisabled(), '未绑定数据根时新建项目按钮应禁用')
    assert(
      (await page.getByTestId('workshop-create-dialog').count()) === 0,
      '未绑定数据根时不应打开新建项目对话框',
    )

    await gotoHash(page, '#/settings')
    await waitForSettingsReady(page)
    await waitForText(page, '便携数据目录', 10_000)
    const rootInput = await page.getByTestId('settings-portable-data-root-input').inputValue()
    assert(!rootInput.trim(), '未绑定数据根时设置页输入框应为空')

    assert(
      (await page.getByTestId('settings-portable-layout-preview').count()) === 0,
      '未绑定数据根时不应显示目录结构预览',
    )
  },
}
