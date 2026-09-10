/**
 * 一键发版编排：升版本 → build → commit → upload → push
 *
 *   node scripts/release.mjs --patch
 *   node scripts/release.mjs --version 0.0.22
 *   node scripts/release.mjs --skip-push
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function parseArgs(argv) {
  const opts = {
    version: '',
    patch: false,
    skipBuild: false,
    skipUpload: false,
    skipPush: false,
    skipCommit: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--patch') opts.patch = true
    else if (arg === '--skip-build') opts.skipBuild = true
    else if (arg === '--skip-upload') opts.skipUpload = true
    else if (arg === '--skip-push') opts.skipPush = true
    else if (arg === '--skip-commit') opts.skipCommit = true
    else if (arg === '--version' && argv[i + 1]) {
      opts.version = argv[++i]
    }
  }
  return opts
}

function run(cmd, args, { env = process.env, allowFail = false, shell } = {}) {
  console.log(`\n[release] $ ${cmd} ${args.join(' ')}`)
  const result = spawnSync(cmd, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: shell ?? process.platform === 'win32',
    env,
  })
  if ((result.status ?? 1) !== 0 && !allowFail) {
    process.exit(result.status ?? 1)
  }
  return result.status ?? 0
}

function readPkgVersion() {
  return JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version
}

function bumpPatch(version) {
  const parts = version.split('.').map((n) => Number.parseInt(n, 10))
  parts[2] = (parts[2] || 0) + 1
  return parts.join('.')
}

function assertChangelog(version) {
  const file = resolve(projectRoot, 'src/constants/release-changelog.ts')
  const text = readFileSync(file, 'utf8')
  if (!text.includes(`version: '${version}'`) && !text.includes(`version: "${version}"`)) {
    console.error(
      `[release] 请先在 src/constants/release-changelog.ts 添加 v${version} 条目后再发版`,
    )
    process.exit(1)
  }
}

const RELEASE_COMMIT_PATHS = [
  'package.json',
  'package-lock.json',
  'website/version.json',
  'src/constants/release-changelog.ts',
]

function productionEnv() {
  return {
    ...process.env,
    // 本地/开源版：无公司默认；需自建时再设环境变量
    VITE_API_BASE: process.env.VITE_API_BASE || '',
    VITE_UPLOAD_ORIGIN: process.env.VITE_UPLOAD_ORIGIN || '',
    VITE_UPDATE_PUBLISH_URL: process.env.VITE_UPDATE_PUBLISH_URL || '',
    VITE_APP_ENV: 'production',
  }
}

const opts = parseArgs(process.argv.slice(2))
let targetVersion = opts.version

if (opts.patch || !targetVersion) {
  targetVersion = bumpPatch(readPkgVersion())
}

console.log(`[release] 目标版本 v${targetVersion}`)
assertChangelog(targetVersion)

if (readPkgVersion() !== targetVersion) {
  run('npm', ['version', targetVersion, '--no-git-tag-version'])
}

if (!opts.skipBuild) {
  run('npm', ['run', 'build'], { env: productionEnv() })
} else if (!existsSync(resolve(projectRoot, 'release'))) {
  console.error('[release] --skip-build 但 release/ 不存在')
  process.exit(1)
}

if (!opts.skipUpload) {
  run('npm', ['run', 'upload'])
}

if (!opts.skipCommit) {
  run('git', ['add', ...RELEASE_COMMIT_PATHS])
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'local-creator',
    GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'local-creator@users.noreply.github.com',
    GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'local-creator',
    GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'local-creator@users.noreply.github.com',
  }
  run(
    'git',
    ['commit', '-m', `chore: release v${targetVersion}`, '-m', 'Automated via scripts/release.mjs'],
    { env: gitEnv, allowFail: true, shell: false },
  )
}

if (!opts.skipPush) {
  run('git', ['push', 'origin', 'main'])
}

console.log(`\n[release] v${targetVersion} 发版流程完成`)
