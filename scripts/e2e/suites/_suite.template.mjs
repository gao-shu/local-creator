/**
 * 新 E2E 套件模板（复制本文件并重命名，勿直接 import）
 *
 * 步骤：
 * 1. 复制为 scripts/e2e/suites/my-feature.mjs
 * 2. 修改 name / description / run 逻辑
 * 3. 在 register-suites.mjs 中 import 并 registerSuite
 * 4. npm run test:e2e my-feature
 */
import { gotoHash, waitForText } from '../../lib/e2e-helpers.mjs'
import { prepareMinimalE2eWorkspace } from '../../lib/workshop-e2e-fixtures.mjs'

export const myFeatureSuite = {
  name: 'my-feature',
  description: '一句话描述本套件覆盖范围',
  prepareWorkspace: prepareMinimalE2eWorkspace,
  async run(session) {
    const { page, assert } = session

    await gotoHash(page, '#/dashboard')
    await waitForText(page, '欢迎回来', 20_000)

    assert(true, '在此替换为真实断言')
  },
}
