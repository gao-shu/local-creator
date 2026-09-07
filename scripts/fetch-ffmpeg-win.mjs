/**
 * 下载 Windows FFmpeg essentials 到 vendor/ffmpeg/win/（开发态 + electron-builder 源目录）
 *
 *   npm run fetch:ffmpeg-win
 *
 * 来源：gyan.dev ffmpeg-release-essentials（GPL，体积较 full build 更小）
 */
import {
  createWriteStream,
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import https from 'node:https'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const targetDir = join(projectRoot, 'vendor', 'ffmpeg', 'win')
const tmpRoot = join(projectRoot, '.tmp-ffmpeg')
const zipPath = join(tmpRoot, 'ffmpeg-release-essentials.zip')
const extractDir = join(tmpRoot, 'extract')

/** @type {readonly string[]} */
const FFMPEG_DOWNLOAD_URLS = [
  'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip',
  'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
]

const REQUIRED_BINARIES = ['ffmpeg.exe', 'ffprobe.exe']

function log(message) {
  console.log(`[fetch:ffmpeg-win] ${message}`)
}

function fail(message) {
  console.error(`[fetch:ffmpeg-win] ${message}`)
  process.exit(1)
}

function ensureWinPlatform() {
  if (process.platform !== 'win32') {
    fail('当前脚本仅支持 Windows；Mac/Linux 捆绑包待后续 Step 补充')
  }
}

function downloadFile(url, destPath, timeoutMs = 120_000) {
  return new Promise((resolvePromise, reject) => {
    let settled = false
    const finish = (error) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (error) reject(error)
      else resolvePromise(undefined)
    }
    const timer = setTimeout(() => finish(new Error(`下载超时（${timeoutMs}ms）`)), timeoutMs)

    const request = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 8) {
        finish(new Error('重定向次数过多'))
        return
      }
      const req = https
        .get(currentUrl, (response) => {
          const status = response.statusCode || 0
          if (status >= 300 && status < 400 && response.headers.location) {
            response.resume()
            request(response.headers.location, redirectCount + 1)
            return
          }
          if (status !== 200) {
            response.resume()
            finish(new Error(`HTTP ${status}`))
            return
          }
          mkdirSync(dirname(destPath), { recursive: true })
          const file = createWriteStream(destPath)
          response.pipe(file)
          file.on('finish', () => file.close(() => finish()))
          file.on('error', finish)
        })
        .on('error', finish)
      req.on('error', finish)
    }
    request(url)
  })
}

function extractZipWindows(zipFile, destination) {
  mkdirSync(destination, { recursive: true })
  const ps = spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath '${zipFile.replace(/'/g, "''")}' -DestinationPath '${destination.replace(/'/g, "''")}' -Force`,
    ],
    { stdio: 'inherit' },
  )
  if (ps.status !== 0) {
    fail('解压失败（PowerShell Expand-Archive）')
  }
}

function findFileRecursive(rootDir, filename) {
  const stack = [rootDir]
  while (stack.length) {
    const current = stack.pop()
    if (!current) continue
    let entries = []
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (entry.name.toLowerCase() === filename.toLowerCase()) {
        return full
      }
    }
  }
  return ''
}

function sha256File(filePath) {
  const hash = createHash('sha256')
  return new Promise((resolvePromise, reject) => {
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolvePromise(hash.digest('hex')))
    stream.on('error', reject)
  })
}

async function copyBinaries() {
  const copied = new Map()
  for (const name of REQUIRED_BINARIES) {
    const found = findFileRecursive(extractDir, name)
    if (!found) {
      fail(`解压包内未找到 ${name}`)
    }
    const target = join(targetDir, name)
    copyFileSync(found, target)
    copied.set(name, target)
    log(`已写入 ${target}`)
  }

  const licenseCandidates = ['LICENSE', 'LICENSE.txt', 'COPYING']
  for (const licenseName of licenseCandidates) {
    const licensePath = findFileRecursive(extractDir, licenseName)
    if (licensePath) {
      const targetLicense = join(targetDir, 'LICENSE.txt')
      copyFileSync(licensePath, targetLicense)
      log(`已写入 ${targetLicense}`)
      break
    }
  }

  for (const [name, filePath] of copied) {
    const digest = await sha256File(filePath)
    const sizeMb = (statSync(filePath).size / (1024 * 1024)).toFixed(1)
    log(`${name}: ${sizeMb} MB, sha256=${digest.slice(0, 16)}…`)
  }
}

async function main() {
  ensureWinPlatform()
  mkdirSync(targetDir, { recursive: true })

  const allPresent = REQUIRED_BINARIES.every((name) => existsSync(join(targetDir, name)))
  if (allPresent) {
    log('vendor/ffmpeg/win 已存在 ffmpeg.exe 与 ffprobe.exe，跳过下载')
    log('若需重新下载，请先删除 vendor/ffmpeg/win/*.exe')
    return
  }

  rmSync(tmpRoot, { recursive: true, force: true })
  mkdirSync(tmpRoot, { recursive: true })

  let downloaded = false
  for (const url of FFMPEG_DOWNLOAD_URLS) {
    try {
      log(`下载 ${url}`)
      await downloadFile(url, zipPath)
      downloaded = true
      break
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log(`下载失败: ${message}`)
    }
  }
  if (!downloaded) {
    fail('所有下载源均失败，请检查网络或手动放入 vendor/ffmpeg/win/')
  }

  log('解压中…')
  extractZipWindows(zipPath, extractDir)
  await copyBinaries()

  rmSync(tmpRoot, { recursive: true, force: true })
  log('完成。开发态与 electron-builder extraResources 将使用 vendor/ffmpeg/win/')
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  fail(message)
})
