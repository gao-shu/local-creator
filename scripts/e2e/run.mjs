/**
 * Electron E2E 统一入口
 *
 * 用法：
 *   npm run test:e2e              # 全部套件
 *   npm run test:e2e:smoke        # 仅 smoke（快）
 *   npm run test:e2e:workshop     # 仅 workshop-flow
 *
 * 环境变量：
 *   E2E_SUITE=smoke,workshop-flow   指定套件（逗号分隔）
 *   HAODE_E2E_KEEP=1                失败/成功后保留临时数据目录
 *
 * 前置：npm run compile
 */
import './register-suites.mjs'
import { listSuites, resolveSuiteNames, runSuites } from './runner.mjs'

async function main() {
  const arg = process.argv[2]

  if (arg === '--list') {
    console.log('可用 E2E 套件：')
    for (const item of listSuites()) {
      console.log(`  ${item.name.padEnd(16)} ${item.description}`)
    }
    return
  }

  const suiteInput = arg ?? process.env.E2E_SUITE ?? 'all'
  const suiteNames = resolveSuiteNames(suiteInput)

  console.log(`Electron E2E 开始（${suiteNames.join(', ')}）`)
  const { passed, failed } = await runSuites(suiteNames)

  console.log('\n── 汇总 ──')
  console.log(`  通过: ${passed.length}/${suiteNames.length}`)
  if (passed.length) console.log(`    ✓ ${passed.join(', ')}`)
  if (failed.length) {
    console.error(`  失败: ${failed.length}`)
    for (const item of failed) {
      console.error(`    ✗ ${item.name}`)
      for (const err of item.errors) console.error(`      - ${err}`)
    }
    process.exit(1)
  }

  console.log('Electron E2E 全部通过')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
