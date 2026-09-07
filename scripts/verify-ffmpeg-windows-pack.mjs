/**
 * Step 12 验收：Windows 打包后 FFmpeg 是否进入 resources/ffmpeg/win 且可执行。
 *
 *   npm run verify:ffmpeg-win-pack
 *
 * 流程：
 * 1. 校验 electron-builder.yml extraResources
 * 2. 校验 vendor/ffmpeg/win
 * 3. compile（若 out/main 缺失）
 * 4. electron-builder --win dir（仅 win-unpacked，不打 NSIS）
 * 5. 检查 win-unpacked/resources/ffmpeg/win/*.exe 并执行 -version
 */
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  assertElectronBuilderFfmpegExtraResources,
  assertPackagedFfmpegBundle,
  assertVendorFfmpegBundle,
  FFMPEG_REQUIRED_BINARIES,
} from './lib/ffmpeg-pack-contract.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packOutDir = join(projectRoot, '.pack-tmp', 'ffmpeg-verify-step12')
const unpackedRoot = join(packOutDir, 'win-unpacked')

function log(message) {
  console.log(`[verify:ffmpeg-win-pack] ${message}`)
}

function fail(message) {
  console.error(`[verify:ffmpeg-win-pack] ${message}`)
  process.exit(1)
}

function run(command, args, options = {}) {
  const useShell = process.platform === 'win32'
  const result = spawnSync(
    useShell ? 'cmd.exe' : command,
    useShell ? ['/d', '/s', '/c', [command, ...args].join(' ')] : args,
    {
      cwd: projectRoot,
      stdio: 'inherit',
      ...options,
    },
  )
  if (result.error) throw result.error
  if ((result.status ?? 1) !== 0) {
    fail(`命令失败：${[command, ...args].join(' ')}`)
  }
}

function runVersionCheck(exePath, label) {
  const result = spawnSync(exePath, ['-version'], {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim()
  if ((result.status ?? 1) !== 0 || !output) {
    fail(`${label} 无法执行 -version（${exePath}）`)
  }
  const firstLine = output.split(/\r?\n/)[0] || output
  log(`${label}: ${firstLine}`)
}

function ensureCompiled() {
  const mainOut = join(projectRoot, 'out', 'main', 'index.cjs')
  if (existsSync(mainOut)) {
    log('out/main 已存在，跳过 compile')
    return
  }
  log('out/main 缺失，执行 npm run compile …')
  run('npm', ['run', 'compile'])
}

function packWinUnpacked() {
  rmSync(packOutDir, { recursive: true, force: true })
  mkdirSync(packOutDir, { recursive: true })
  log(`electron-builder --win dir → ${packOutDir.replace(projectRoot, '.')}`)
  run('npx', [
    'electron-builder',
    '--win',
    'dir',
    `--config.directories.output=${packOutDir}`,
    '--publish',
    'never',
  ])
}

function main() {
  if (process.platform !== 'win32') {
    fail('Step 12 仅支持在 Windows 上验证 FFmpeg 打包路径')
  }

  log('① 检查 electron-builder.yml extraResources …')
  const configCheck = assertElectronBuilderFfmpegExtraResources(projectRoot)
  if (!configCheck.ok) fail(configCheck.message)
  log('extraResources 配置 OK')

  log('② 检查 vendor/ffmpeg/win …')
  const vendorCheck = assertVendorFfmpegBundle(projectRoot)
  if (!vendorCheck.ok) fail(vendorCheck.message)
  log(`vendor 目录 OK：${vendorCheck.vendorDir}`)

  ensureCompiled()
  packWinUnpacked()

  if (!existsSync(unpackedRoot)) {
    fail(`未生成 win-unpacked：${unpackedRoot}`)
  }

  log('③ 检查 win-unpacked/resources/ffmpeg/win …')
  const packagedCheck = assertPackagedFfmpegBundle(unpackedRoot)
  if (!packagedCheck.ok) fail(packagedCheck.message)
  log(`打包 bundle OK：${packagedCheck.bundleDir}`)

  log('④ 执行打包后 ffmpeg / ffprobe -version …')
  for (const name of FFMPEG_REQUIRED_BINARIES) {
    const exePath = join(packagedCheck.bundleDir, name)
    runVersionCheck(exePath, name)
  }

  log('PASSED — Windows 打包产物已包含可执行的 resources/ffmpeg/win')
  log(`临时目录可删除：${packOutDir.replace(projectRoot, '.')}`)
}

main()
