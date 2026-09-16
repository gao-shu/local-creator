/**
 * 桌面端打包：compile → out/ → electron-builder → .pack-tmp/ → release/ 安装包
 *
 *   npm run build   # 尽量打全平台（Win 上仅 exe；Mac 上 exe + dmg/zip）
 *
 * release/ 只放最终安装包 + latest.yml + history/，中间文件全部在 .pack-tmp/（可删）
 */
import {
  readFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  renameSync,
  copyFileSync,
  readdirSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEnv } from './lib/read-env.mjs'
import { syncVersionJson } from './lib/sync-version-json.mjs'
import { isTosReleaseEnabled, resolveUpdatePublishUrl } from './lib/tos-release-env.mjs'
import { assertVendorFfmpegBundle } from './lib/ffmpeg-pack-contract.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = resolve(projectRoot, 'release')
const historyDir = resolve(releaseDir, 'history')
const packTmpRoot = resolve(projectRoot, '.pack-tmp')

const DISTRIBUTABLE_FILE = /\.(exe|dmg|zip|yml|blockmap)$/i
const LEGACY_JUNK_DIR = /^(win-unpacked|mac-|linux-|release-staging)$/
const isWin = process.platform === 'win32'
const isMac = process.platform === 'darwin'

/** 每次打包用独立临时目录，避免复用被锁的 app.asar */
function createPackRunDir() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join(packTmpRoot, `build-${stamp}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function sleepMs(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    /* 短等待，便于 Windows 释放文件锁 */
  }
}

/** Windows：结束可能占用 app.asar 的客户端进程 */
function tryStopRunningAppOnWindows() {
  if (!isWin) return
  spawnSync('taskkill', ['/F', '/IM', '本地漫创.exe', '/T'], { stdio: 'ignore' })
}

function isBusyError(error) {
  const code = error && typeof error === 'object' ? error.code : ''
  return code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY'
}

/** 带重试删除路径；失败时仅告警，不中断打包 */
function removePathSafe(targetPath, { label, maxAttempts = 3, quiet = false } = {}) {
  if (!existsSync(targetPath)) return true
  const name = label || targetPath

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      rmSync(targetPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 300 })
      return true
    } catch (error) {
      if (!isBusyError(error) || attempt === maxAttempts) {
        if (!quiet) {
          console.warn(`[build] 无法删除 ${name}，已跳过（${error.code || '未知错误'}）`)
        }
        return false
      }
      if (attempt === 1) tryStopRunningAppOnWindows()
      if (!quiet) console.warn(`[build] ${name} 被占用，重试中…`)
      sleepMs(500)
    }
  }
  return false
}

/** 从安装包文件名提取 x.y.z 版本号 */
function extractVersionFromName(name) {
  const match = name.match(/(\d+\.\d+\.\d+)/)
  return match ? match[1] : null
}

/** 从 yml 或文件名提取版本号 */
function resolveArtifactVersion(name, filePath) {
  const fromName = extractVersionFromName(name)
  if (fromName) return fromName
  if (/\.yml$/i.test(name) && existsSync(filePath)) {
    const text = readFileSync(filePath, 'utf8')
    const match = text.match(/^version:\s*(\S+)/m)
    if (match) return match[1]
  }
  return 'unknown'
}

/** 清理 release/ 里历史遗留的中间目录（旧版脚本曾写入 release/） */
function cleanLegacyReleaseDirs() {
  if (!existsSync(releaseDir)) return

  const legacy = readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && LEGACY_JUNK_DIR.test(entry.name))
    .map((entry) => entry.name)

  if (legacy.length === 0) return

  tryStopRunningAppOnWindows()
  let removed = 0
  for (const name of legacy) {
    if (removePathSafe(join(releaseDir, name), { label: `release/${name}/`, maxAttempts: 1, quiet: true })) {
      removed += 1
    }
  }
  if (removed < legacy.length) {
    console.warn(
      `[build] release/ 有旧中间目录可忽略：${legacy.join('、')}（不影响打包，有空时 npm run clean:release-junk）`,
    )
  }
}

/** 打包前：旧安装包移入 history/<version>/，release/ 根目录只留当前版本位 */
function archiveReleaseInstallers() {
  if (!existsSync(releaseDir)) {
    mkdirSync(releaseDir, { recursive: true })
    return
  }

  cleanLegacyReleaseDirs()

  const entries = readdirSync(releaseDir, { withFileTypes: true })
  let archived = 0

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const name = entry.name
    if (!DISTRIBUTABLE_FILE.test(name)) continue

    const fullPath = join(releaseDir, name)
    const version = resolveArtifactVersion(name, fullPath)
    const targetDir = join(historyDir, version)
    mkdirSync(targetDir, { recursive: true })

    let targetPath = join(targetDir, name)
    if (existsSync(targetPath)) {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      const dot = name.lastIndexOf('.')
      const stampedName = dot > 0 ? `${name.slice(0, dot)}-${stamp}${name.slice(dot)}` : `${name}-${stamp}`
      targetPath = join(targetDir, stampedName)
    }

    renameSync(fullPath, targetPath)
    archived += 1
    console.log(`[build] 归档 → history/${version}/${targetPath.split(/[/\\]/).pop()}`)
  }

  if (archived > 0) {
    console.log(`[build] 已将 ${archived} 个历史安装包移入 release/history/`)
  } else {
    console.log('[build] release/ 无历史安装包，直接生成新版本')
  }
}

function readEnvValue(key) {
  return readEnv(key)
}

/** 开源版：默认无公司后端；空 apiBase 合法；仅警告误配 localhost（可选自建时请改） */
function assertProductionApiBase() {
  const apiBase = readEnvValue('VITE_API_BASE')
  if (!apiBase) {
    console.log('[build] 未设置 VITE_API_BASE（开源本地版默认：不依赖后端，OK）')
    return
  }
  if (/localhost|127\.0\.0\.1/i.test(apiBase)) {
    console.warn(
      '[build] 警告：VITE_API_BASE 为 localhost。安装到其它电脑后该地址不可用；本地自测可忽略。',
    )
  }
  const uploadOrigin = readEnvValue('VITE_UPLOAD_ORIGIN')
  if (uploadOrigin && /localhost|127\.0\.0\.1/i.test(uploadOrigin)) {
    console.warn('[build] 警告：VITE_UPLOAD_ORIGIN 仍为 localhost。')
  }
  console.log(`[build] 可选后端地址：${apiBase}`)
}

function run(command, args) {
  const useShell = process.platform === 'win32'
  const result = spawnSync(
    useShell ? 'cmd.exe' : command,
    useShell ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args,
    { cwd: projectRoot, stdio: 'inherit' },
  )
  if (result.error) throw result.error
  if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1)
}

function npmRun(script) {
  run('npm', ['run', script])
}

/** 从打包临时目录复制最终产物到 release/ */
function copyArtifactsToRelease(outputDir) {
  if (!existsSync(outputDir)) return

  const names = readdirSync(outputDir).filter(
    (name) => DISTRIBUTABLE_FILE.test(name) && !/^builder-.*\.ya?ml$/i.test(name),
  )
  if (names.length === 0) return

  mkdirSync(releaseDir, { recursive: true })
  console.log('[build] 复制安装包到 release/ …')
  for (const name of names) {
    copyFileSync(join(outputDir, name), join(releaseDir, name))
    console.log(`       → release/${name}`)
  }
}

/** 北京时间 YYYY-MM-DD HH:mm:ss — 见 scripts/lib/sync-version-json.mjs */
function syncWebsiteVersionJson(macOnlyBuild) {
  if (!existsSync(releaseDir)) return
  const websiteDir = resolve(projectRoot, 'website')
  if (!existsSync(websiteDir)) {
    console.log('[build] 跳过 website/version.json（目录不存在；W2b 减负后由网盘/Release 分发）')
    return
  }
  const data = syncVersionJson({
    readEnv: readEnvValue,
    touchUpdatedAt: true,
    macOnly: macOnlyBuild,
  })
  console.log(`[build] 已更新 website/version.json（v${data.version}${macOnlyBuild ? '，Mac 合并' : ''}）`)
}

function electronBuilder(args) {
  tryStopRunningAppOnWindows()
  const packRunDir = createPackRunDir()
  console.log(`[build] 打包临时目录：${packRunDir.replace(projectRoot, '.')}`)

  const publishUrl = resolveUpdatePublishUrl(readEnvValue)
  if (isTosReleaseEnabled(readEnvValue) && publishUrl) {
    console.log(`[build] 安装包分发：火山 TOS（${publishUrl}）`)
  }
  const builderArgs = [
    ...args,
    `--config.directories.output=${packRunDir}`,
    '--publish',
    'never',
  ]
  if (publishUrl) {
    builderArgs.push('--config.publish.provider=generic', `--config.publish.url=${publishUrl}`)
    console.log(`[build] 自动更新 feed：${publishUrl}`)
  } else {
    console.log('[build] 未设置 VITE_UPDATE_PUBLISH_URL：仅产出本地安装包，不配置自动更新 feed（P6 再接）')
  }

  run('npx', ['electron-builder', ...builderArgs])
  copyArtifactsToRelease(packRunDir)
  removePathSafe(packRunDir, { label: packRunDir, maxAttempts: 1, quiet: true })
}

function buildMacCiElectronArgsList() {
  const arch = (process.env.BUILD_MAC_ARCH || 'arm64').toLowerCase()
  const skipZip =
    process.env.BUILD_MAC_SKIP_ZIP === '1' ||
    process.env.BUILD_MAC_SKIP_ZIP === 'true' ||
    process.env.UPLOAD_MAC_SKIP_ZIP === '1' ||
    process.env.UPLOAD_MAC_SKIP_ZIP === 'true'
  const macTargets = skipZip ? ['dmg'] : ['dmg', 'zip']
  if (skipZip) {
    console.log('[build] Mac 仅手动更新：只打 .dmg，跳过 .zip')
  }
  const withArch = (flag) => ['--mac', ...macTargets, flag]
  if (arch === 'arm64') return [withArch('--arm64')]
  if (arch === 'x64') return [withArch('--x64')]
  if (arch === 'universal') return [withArch('--universal')]
  return [withArch('--arm64'), withArch('--x64')]
}

function macArchLabel(args) {
  if (args.includes('--arm64')) return 'arm64'
  if (args.includes('--x64')) return 'x64'
  return 'universal'
}

function assertWindowsFfmpegVendorBundle() {
  if (!isWin) return
  const check = assertVendorFfmpegBundle(projectRoot)
  if (!check.ok) {
    console.error(`[build] ${check.message}`)
    process.exit(1)
  }
  console.log(`[build] FFmpeg vendor OK（${check.vendorDir.replace(projectRoot, '.')}）`)
}

function assertReleaseChangelog(version) {
  const file = resolve(projectRoot, 'src/constants/release-changelog.ts')
  if (!existsSync(file)) {
    console.error('[build] 缺少 src/constants/release-changelog.ts，请补充更新日志')
    process.exit(1)
  }
  const text = readFileSync(file, 'utf8')
  const quoted = [`'${version}'`, `"${version}"`]
  if (!quoted.some((q) => text.includes(`version: ${q}`))) {
    console.error(
      `[build] release-changelog.ts 缺少 v${version} 条目，请在小铃铛更新日志中补充后再打包`,
    )
    process.exit(1)
  }
}

console.log('[build] ① 检查生产 API 地址…')
assertProductionApiBase()
const pkgVersion = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).version
assertReleaseChangelog(pkgVersion)
console.log(`[build] 更新日志已包含 v${pkgVersion}`)
console.log('[build] ② 归档历史安装包…')
archiveReleaseInstallers()
console.log('[build] ③ 编译源码 → out/ …')
npmRun('compile')
assertWindowsFfmpegVendorBundle()

const macOnly =
  process.env.BUILD_MAC_ONLY === '1' || process.env.BUILD_MAC_ONLY === 'true'

if (isMac) {
  if (macOnly) {
    const targets = buildMacCiElectronArgsList()
    for (const args of targets) {
      console.log(`[build] ④ 打包 macOS ${macArchLabel(args)}（CI）→ release/ …`)
      electronBuilder(args)
    }
  } else {
    console.log('[build] ④ 打包 macOS + Windows → release/ …')
    electronBuilder(['--mac', 'dmg', 'zip', '--win', 'nsis' /* , 'portable' */])
  }
} else if (isWin) {
  console.log('[build] ④ 打包 Windows → release/ …')
  console.warn('       （macOS 安装包需在 Mac 上再执行一次 npm run build）')
  electronBuilder(['--win', 'nsis' /* , 'portable' */])
} else {
  console.error('[build] 当前仅支持在 Windows 或 macOS 上打包。')
  process.exit(1)
}

syncWebsiteVersionJson(macOnly)

console.log('[build] 完成。release/ 里是要分发的安装包；中间文件在 .pack-tmp/build-*/（可整夹删除）。')
