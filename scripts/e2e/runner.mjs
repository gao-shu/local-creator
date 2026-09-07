/**
 * Electron E2E 套件注册与执行
 */
import { E2eSession } from './context.mjs'

/** @type {Map<string, { name: string, description: string, run: (session: E2eSession) => Promise<void> }>} */
const suites = new Map()

export function registerSuite(suite) {
  if (suites.has(suite.name)) {
    throw new Error(`E2E 套件已注册: ${suite.name}`)
  }
  suites.set(suite.name, suite)
}

export function listSuites() {
  return [...suites.values()].map(({ name, description }) => ({ name, description }))
}

export function resolveSuiteNames(input) {
  if (!input || input === 'all') {
    return [...suites.keys()]
  }
  const names = input.split(',').map((item) => item.trim()).filter(Boolean)
  for (const name of names) {
    if (!suites.has(name)) {
      throw new Error(`未知 E2E 套件: ${name}（可用: ${[...suites.keys()].join(', ')}）`)
    }
  }
  return names
}

/**
 * @param {string[]} suiteNames
 * @returns {Promise<{ passed: string[], failed: { name: string, errors: string[] }[] }>}
 */
export async function runSuites(suiteNames) {
  const passed = []
  const failed = []

  for (const name of suiteNames) {
    const suite = suites.get(name)
    const session = new E2eSession({
      label: name,
      prepareWorkspace: suite.prepareWorkspace,
    })

    console.log(`\n▶ E2E 套件: ${name} — ${suite.description}`)
    const started = Date.now()

    try {
      await session.start(suite.launchEnv)
      await suite.run(session)

      if (session.hasErrors) {
        failed.push({ name, errors: [...session.errors] })
        console.error(`✗ ${name} 失败 (${Date.now() - started}ms):\n${session.formatErrors()}`)
      } else {
        passed.push(name)
        console.log(`✓ ${name} 通过 (${Date.now() - started}ms)`)
      }
    } catch (error) {
      if (session.page) {
        const dumpDir = session.workspace?.projectDir ?? session.workspace?.dataRoot ?? ''
        const { dumpFailureArtifacts } = await import('../lib/e2e-helpers.mjs')
        await dumpFailureArtifacts(session.page, dumpDir, `${name}-exception`)
      }
      failed.push({ name, errors: [error instanceof Error ? error.message : String(error)] })
      console.error(`✗ ${name} 异常 (${Date.now() - started}ms):`, error)
    } finally {
      await session.stop()
    }
  }

  return { passed, failed }
}
