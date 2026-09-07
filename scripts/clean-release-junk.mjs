/**
 * 删除 release/ 遗留中间目录 + .pack-tmp/ 打包缓存
 * 若 app.asar 被占用，请先关闭客户端和 Cursor，在外部终端执行：
 *   npm run clean:release-junk
 */
import { existsSync, rmSync, readdirSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = resolve(projectRoot, 'release')
const packTmpRoot = resolve(projectRoot, '.pack-tmp')
const junkDirs = ['win-unpacked', 'release-staging']

function tryStopApp() {
  if (process.platform !== 'win32') return
  spawnSync('taskkill', ['/F', '/IM', '好的漫创.exe', '/T'], { stdio: 'ignore' })
}

function removeDir(target) {
  if (!existsSync(target)) return true
  try {
    rmSync(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 })
    return true
  } catch (error) {
    console.error(`[clean] 无法删除 ${target}`)
    console.error(`        ${error.code || error.message}`)
    return false
  }
}

tryStopApp()

let ok = true
for (const name of junkDirs) {
  const dir = join(releaseDir, name)
  if (!existsSync(dir)) continue
  console.log(`[clean] 删除 release/${name}/ …`)
  if (!removeDir(dir)) ok = false
}

if (existsSync(packTmpRoot)) {
  console.log('[clean] 删除 .pack-tmp/ …')
  if (!removeDir(packTmpRoot)) ok = false
}

if (ok) {
  console.log('[clean] 完成。release/ 已清理干净。')
  if (existsSync(releaseDir)) {
    const left = readdirSync(releaseDir)
    console.log('[clean] 当前 release/ 内容：', left.join(', ') || '(空)')
  }
} else {
  console.error(
    '[clean] 部分目录仍被占用。\n' +
      '       请关闭「好的漫创」客户端、关闭 Cursor/资源管理器中的 release 文件夹，\n' +
      '       然后在外部 PowerShell 再执行：npm run clean:release-junk',
  )
  process.exit(1)
}
