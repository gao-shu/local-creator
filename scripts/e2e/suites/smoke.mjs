/**
 * E2E 冒烟：Electron 真环境 + IPC + 壳层路由
 */
import { gotoHash, waitForText } from '../../lib/e2e-helpers.mjs'
import { prepareMinimalE2eWorkspace } from '../../lib/workshop-e2e-fixtures.mjs'

export const smokeSuite = {
  name: 'smoke',
  description: 'Electron 启动、IPC 就绪、Dashboard / 设置页',
  prepareWorkspace: prepareMinimalE2eWorkspace,
  async run(session) {
    const { page } = session

    await waitForText(page, '欢迎回来', 30_000)
    await waitForText(page, '最近项目', 20_000)

    await gotoHash(page, '#/settings')
    await waitForText(page, '便携数据目录', 20_000)

    await gotoHash(page, '#/dashboard')
    await waitForText(page, '欢迎回来', 20_000)
  },
}
