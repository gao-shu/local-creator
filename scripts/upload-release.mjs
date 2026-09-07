/**
 * 本机发版：上传 release/ 安装包 + website/ 静态页到服务器
 * 依赖 .env.production 中的 DEPLOY_* 配置（勿提交 Git）
 */
import { existsSync, readFileSync, readdirSync, statSync, copyFileSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from 'ssh2'
import SftpClient from 'ssh2-sftp-client'
import { readEnv } from './lib/read-env.mjs'
import { isTosReleaseEnabled } from './lib/tos-release-env.mjs'
import { uploadReleaseArtifactsToTos } from './lib/tos-release-upload.mjs'
import { patchLatestYmlForTos, toServerRelativeLatestYml } from './lib/patch-latest-yml-tos.mjs'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const releaseDir = resolve(projectRoot, 'release')
const websiteDir = resolve(projectRoot, 'website')

function listWinArtifacts() {
  const files = []
  const yml = join(releaseDir, 'latest.yml')
  if (existsSync(yml)) files.push(yml)
  if (!existsSync(releaseDir)) return files
  for (const name of readdirSync(releaseDir)) {
    if (/\.(exe|blockmap)$/i.test(name)) {
      files.push(join(releaseDir, name))
    }
  }
  return files
}

function listMacArtifacts() {
  const skipZip = /^(1|true|yes)$/i.test(readEnv('UPLOAD_MAC_SKIP_ZIP') || '')
  const files = []
  if (!skipZip) {
    const yml = join(releaseDir, 'latest-mac.yml')
    if (existsSync(yml)) files.push(yml)
  } else {
    console.log('[upload] Mac 手动更新模式：仅上传 .dmg（跳过 .zip 与 latest-mac.yml）')
  }
  if (!existsSync(releaseDir)) return files

  const names = readdirSync(releaseDir)
  const dmg =
    names.find((n) => /universal.*\.dmg$/i.test(n)) ||
    names.find((n) => /\.dmg$/i.test(n))
  if (dmg) {
    files.push(join(releaseDir, dmg))
  } else {
    for (const name of names) {
      if (/\.dmg$/i.test(name)) files.push(join(releaseDir, name))
    }
  }

  if (!skipZip) {
    const zip =
      names.find((n) => /universal.*\.zip$/i.test(n)) ||
      names.find((n) => /\.zip$/i.test(n))
    if (zip) {
      files.push(join(releaseDir, zip))
    } else {
      for (const name of names) {
        if (/\.zip$/i.test(name)) files.push(join(releaseDir, name))
      }
    }
  } else {
    console.log('[upload] UPLOAD_MAC_SKIP_ZIP=1，跳过 .zip')
  }

  return files
}

function ensureWebsiteFavicon() {
  const dest = join(websiteDir, 'favicon.png')
  if (existsSync(dest)) return
  const candidates = [
    join(projectRoot, 'public/favicon.png'),
    join(projectRoot, 'build/icon.png'),
  ]
  for (const src of candidates) {
    if (existsSync(src)) {
      copyFileSync(src, dest)
      console.log(`[upload] 已从 ${basename(src)} 复制 favicon 到 website/`)
      return
    }
  }
}

function listWebsiteArtifacts() {
  ensureWebsiteFavicon()
  const files = []
  for (const name of ['index.html', 'version.json', 'favicon.png']) {
    const file = join(websiteDir, name)
    if (existsSync(file)) files.push(file)
  }
  return files
}

function resolveArtifacts() {
  const platform = process.platform
  if (platform === 'win32') {
    console.log('[upload] 当前平台 Windows，上传 Win 安装包')
    return listWinArtifacts()
  }
  if (platform === 'darwin') {
    console.log('[upload] 当前平台 macOS，上传 Mac 安装包')
    return listMacArtifacts()
  }
  console.error('[upload] 仅支持在 Windows 或 macOS 上执行上传')
  process.exit(1)
}

function sshConfig(host, port, username, password) {
  return { host, port, username, password, readyTimeout: 20000 }
}

async function ensureRemoteDir(sftp, remotePath) {
  const exists = await sftp.exists(remotePath)
  if (!exists) {
    await sftp.mkdir(remotePath, true)
  }
}

async function uploadFiles(sftp, localFiles, remoteDir) {
  await ensureRemoteDir(sftp, remoteDir)
  const base = remoteDir.replace(/\/+$/, '')
  for (const localFile of localFiles) {
    const remoteFile = `${base}/${basename(localFile)}`
    const { size } = statSync(localFile)
    const sizeMb = (size / 1024 / 1024).toFixed(1)
    console.log(`[upload] ${basename(localFile)} (${sizeMb} MB) → ${remoteFile}`)
    const started = Date.now()
    let lastLoggedPct = -1
    await sftp.put(localFile, remoteFile, {
      step: (transferred, _chunk, total) => {
        if (!total || total <= 0) return
        const pct = Math.min(100, Math.floor((transferred / total) * 100))
        if (pct >= lastLoggedPct + 10 || pct === 100) {
          const elapsed = ((Date.now() - started) / 1000).toFixed(0)
          console.log(`[upload]   … ${pct}%（${elapsed}s）`)
          lastLoggedPct = pct
        }
      },
    })
    const elapsed = ((Date.now() - started) / 1000).toFixed(0)
    console.log(`[upload]   ✓ ${basename(localFile)} 完成（${elapsed}s）`)
  }
}

function execRemote(command, config, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    const timer = setTimeout(() => {
      conn.end()
      reject(new Error(`远程命令超时（${timeoutMs}ms）`))
    }, timeoutMs)
    conn
      .on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer)
            conn.end()
            reject(err)
            return
          }
          let stderr = ''
          stream.stderr.on('data', (chunk) => {
            stderr += chunk.toString()
          })
          stream.on('close', (code) => {
            clearTimeout(timer)
            conn.end()
            if (code !== 0) {
              reject(new Error(stderr.trim() || `远程命令失败: ${command}`))
              return
            }
            resolve()
          })
        })
      })
      .on('error', (error) => {
        clearTimeout(timer)
        reject(error)
      })
      .connect(config)
  })
}

/** 解析 semver x.y.z 用于排序 */
function parseSemver(name) {
  const match = name.match(/^好的漫创 Setup (\d+\.\d+\.\d+)/)
  if (!match) return null
  const parts = match[1].split('.').map((n) => Number.parseInt(n, 10))
  return { version: match[1], parts, fileName: name }
}

function compareSemver(a, b) {
  for (let i = 0; i < 3; i += 1) {
    const diff = (b.parts[i] || 0) - (a.parts[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

/**
 * 清理服务器旧安装包：保留最近 N 个版本（含当前），供浏览器手动下载；
 * latest.yml 仍只指向最新版，应用内更新不受影响。
 */
async function cleanupRemoteOldInstallers(sftp, remotePath, keepVersion) {
  const keepCount = Math.max(
    1,
    Number.parseInt(readEnv('DEPLOY_KEEP_INSTALLER_VERSIONS') || '5', 10) || 5,
  )
  const names = await sftp.list(remotePath)
  const setups = names
    .filter((entry) => entry.type === '-' && entry.name)
    .map((entry) => parseSemver(entry.name))
    .filter(Boolean)
    .sort(compareSemver)

  const keepSet = new Set(
    setups.slice(0, keepCount).map((item) => item.version),
  )
  keepSet.add(keepVersion)

  console.log(
    `[upload] 保留最近 ${keepCount} 个安装包版本：${[...keepSet].sort().join('、')}`,
  )

  for (const item of setups) {
    if (keepSet.has(item.version)) continue

    const base = remotePath.replace(/\/+$/, '')
    const remoteFile = `${base}/${item.fileName}`
    console.log(`[upload] 删除旧版 ${item.fileName}`)
    try {
      await sftp.delete(remoteFile)
    } catch {
      console.warn(`[upload] 跳过删除 ${item.fileName}（可能已不存在）`)
    }

    const blockmap = `${item.fileName}.blockmap`
    if (!names.some((n) => n.name === blockmap)) continue
    console.log(`[upload] 删除旧版 ${blockmap}`)
    try {
      await sftp.delete(`${base}/${blockmap}`)
    } catch {
      console.warn(`[upload] 跳过删除 ${blockmap}（可能已不存在）`)
    }
  }
}

async function syncServerLatestYml(ymlPath, { host, port, username, password, staticRoot }) {
  const config = sshConfig(host, port, username, password)
  const sftp = new SftpClient()
  console.log(`[upload] 同步 latest.yml → ${staticRoot}/（相对路径，供旧版客户端从服务器拉包）`)
  await sftp.connect(config)
  await uploadFiles(sftp, [ymlPath], staticRoot)
  await sftp.end()
}

/** 生成服务器 feed 用 latest.yml（相对路径，安装包走服务器镜像） */
function prepareServerLatestYml(ymlPath) {
  if (!existsSync(ymlPath)) return ''
  const serverYmlPath = join(releaseDir, '.latest-server.yml')
  const current = readFileSync(ymlPath, 'utf8')
  const hasAbsolute = /https?:\/\//i.test(current)
  if (hasAbsolute) {
    writeFileSync(serverYmlPath, toServerRelativeLatestYml(current), 'utf8')
  } else {
    writeFileSync(serverYmlPath, current, 'utf8')
    patchLatestYmlForTos(ymlPath)
  }
  return serverYmlPath
}

async function syncServerInstallerMirror(
  binaryArtifacts,
  { host, port, username, password, staticRoot, keepVersion },
) {
  if (binaryArtifacts.length === 0) return
  const config = sshConfig(host, port, username, password)
  const sftp = new SftpClient()
  console.log(`[upload] 同步安装包镜像 → ${staticRoot}/（旧版应用内更新走服务器，速度接近浏览器）`)
  await sftp.connect(config)
  await uploadFiles(sftp, binaryArtifacts, staticRoot)
  const skipWinCleanup =
    process.platform === 'darwin' ||
    /^(1|true|yes)$/i.test(readEnv('UPLOAD_SKIP_WIN_CLEANUP') || '')
  if (!skipWinCleanup) {
    await cleanupRemoteOldInstallers(sftp, staticRoot, keepVersion)
  }
  await sftp.end()
}

async function main() {
  const websiteOnlyFlag = process.argv.includes('--website-only')
  const tosEnabled = isTosReleaseEnabled(readEnv)
  const host = readEnv('DEPLOY_HOST')
  const username = readEnv('DEPLOY_USER')
  const password = readEnv('DEPLOY_PASSWORD')
  const remotePath = readEnv('DEPLOY_UPDATE_PATH') || '/opt/haode-client/download'
  const port = Number.parseInt(readEnv('DEPLOY_PORT') || '22', 10)
  const staticRoot = remotePath.replace(/\/+$/, '')

  const artifacts = resolveArtifacts()
  const websiteFiles = listWebsiteArtifacts()
  const websiteOnly =
    websiteOnlyFlag ||
    /^(1|true|yes)$/i.test(readEnv('UPLOAD_WEBSITE_ONLY') || '') ||
    /^(1|true|yes)$/i.test(readEnv('DEPLOY_WEBSITE_ONLY') || '')
  const syncFeedOnly =
    process.argv.includes('--sync-feed-only') ||
    /^(1|true|yes)$/i.test(readEnv('UPLOAD_SYNC_FEED_ONLY') || '')
  const serverMirrorOnly =
    process.argv.includes('--server-mirror-only') ||
    /^(1|true|yes)$/i.test(readEnv('UPLOAD_SERVER_MIRROR_ONLY') || '')

  const needServer =
    websiteFiles.length > 0 &&
    (websiteOnly || !tosEnabled || /^(1|true|yes)$/i.test(readEnv('UPLOAD_WEBSITE_TO_SERVER') || '1'))

  if (!websiteOnly && !syncFeedOnly && !serverMirrorOnly && artifacts.length === 0) {
    console.error('[upload] release/ 下没有可上传的安装包，请先 npm run build')
    process.exit(1)
  }
  if (websiteOnly) {
    console.log('[upload] 仅上传下载页（跳过安装包）')
  }
  if (syncFeedOnly) {
    console.log('[upload] 仅同步自动更新 feed（latest.yml → TOS + 服务器）')
  }
  if (serverMirrorOnly) {
    console.log('[upload] 仅同步服务器安装包镜像 + 相对路径 latest.yml（修复旧版应用内下载速度）')
  }
  if (websiteFiles.length === 0 && needServer) {
    console.error('[upload] website/ 下没有 index.html 或 version.json')
    process.exit(1)
  }

  let serverYmlPath = ''
  let serverMirrorArtifacts = []

  if (serverMirrorOnly) {
    const ymlPath = join(releaseDir, 'latest.yml')
    const binaryArtifacts = listWinArtifacts().filter((f) => /\.exe$/i.test(f))
    if (binaryArtifacts.length === 0) {
      console.error('[upload] release/ 下没有 .exe，请先 npm run build')
      process.exit(1)
    }
    serverMirrorArtifacts = binaryArtifacts
    if (existsSync(ymlPath)) serverYmlPath = prepareServerLatestYml(ymlPath)
  } else if (syncFeedOnly) {
    const ymlPath = join(releaseDir, 'latest.yml')
    if (!existsSync(ymlPath)) {
      console.error('[upload] release/latest.yml 不存在，请先 npm run build')
      process.exit(1)
    }
    if (tosEnabled) serverYmlPath = prepareServerLatestYml(ymlPath)
    else serverYmlPath = ymlPath
    if (tosEnabled) {
      await uploadReleaseArtifactsToTos([ymlPath], { skipCleanup: true })
    }
  } else if (!websiteOnly && tosEnabled) {
    const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
    console.log('[upload] 安装包 → 火山 TOS（官网直链 / 新客户端 feed）')
    const ymlPath = join(releaseDir, 'latest.yml')
    const binaryArtifacts = artifacts.filter((f) => !/\.ya?ml$/i.test(basename(f)))
    serverMirrorArtifacts = binaryArtifacts
    const tosFiles = [...binaryArtifacts]
    if (existsSync(ymlPath)) {
      serverYmlPath = prepareServerLatestYml(ymlPath)
      tosFiles.push(ymlPath)
    }
    await uploadReleaseArtifactsToTos(tosFiles, { keepVersion: pkg.version })
  } else if (!websiteOnly) {
    if (!host || !username || !password) {
      console.error(
        '[upload] 请在 .env.production 填写 DEPLOY_*，或设置 RELEASE_STORAGE=tos + TOS_*',
      )
      process.exit(1)
    }
  }

  const syncServerYml =
    serverYmlPath &&
    host &&
    username &&
    password &&
    !/^(0|false|no)$/i.test(readEnv('UPLOAD_SYNC_SERVER_YML') ?? '1')

  const uploadServerMirror =
    serverMirrorArtifacts.length > 0 &&
    host &&
    username &&
    password &&
    tosEnabled &&
    (serverMirrorOnly || (!websiteOnly && !syncFeedOnly)) &&
    !/^(0|false|no)$/i.test(readEnv('UPLOAD_SERVER_INSTALLER_MIRROR') ?? '1')

  if (uploadServerMirror) {
    const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
    await syncServerInstallerMirror(serverMirrorArtifacts, {
      host,
      port,
      username,
      password,
      staticRoot,
      keepVersion: pkg.version,
    })
  }

  if (syncServerYml) {
    await syncServerLatestYml(serverYmlPath, { host, port, username, password, staticRoot })
  }

  if (serverMirrorOnly) {
    console.log('[upload] 全部上传完成')
    return
  }

  if (!needServer) {
    if (websiteFiles.length > 0) {
      console.log('[upload] 已跳过下载页 SFTP（UPLOAD_WEBSITE_TO_SERVER=0）')
    }
    console.log('[upload] 全部上传完成')
    return
  }

  if (!host || !username || !password) {
    console.error('[upload] 上传下载页需要 DEPLOY_HOST、DEPLOY_USER、DEPLOY_PASSWORD')
    process.exit(1)
  }

  const config = sshConfig(host, port, username, password)
  const sftp = new SftpClient()
  console.log(`[upload] 连接 ${username}@${host}:${port} …`)

  try {
    await sftp.connect(config)

    if (websiteFiles.length > 0) {
      console.log(`[upload] 上传静态页 → ${staticRoot}/`)
      await uploadFiles(sftp, websiteFiles, staticRoot)
    }

    if (!websiteOnly && !tosEnabled) {
      console.log(`[upload] 上传安装包 → ${staticRoot}/`)
      await uploadFiles(sftp, artifacts, staticRoot)

      const skipWinCleanup =
        process.platform === 'darwin' ||
        /^(1|true|yes)$/i.test(readEnv('UPLOAD_SKIP_WIN_CLEANUP') || '')

      if (skipWinCleanup) {
        console.log('[upload] 跳过 Windows 安装包远端清理（Mac 本机打包 / UPLOAD_SKIP_WIN_CLEANUP）')
      } else {
        const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
        await cleanupRemoteOldInstallers(sftp, staticRoot, pkg.version)
      }
    }

    await sftp.end()

    const skipChown = !/^(0|false|no)$/i.test(readEnv('UPLOAD_SKIP_CHOWN') || '1')
    if (skipChown) {
      console.log('[upload] 跳过远程 chown（UPLOAD_SKIP_CHOWN=1）')
    } else {
      const chownRoot = staticRoot.replace(/\/download$/, '') || '/opt/haode-client'
      console.log('[upload] 修正目录权限 …')
      try {
        await execRemote(
          `mkdir -p ${staticRoot} && chown -R www:www ${chownRoot} && chmod -R 755 ${chownRoot}`,
          config,
          2000,
        )
      } catch (error) {
        console.warn(`[upload] 权限修正跳过：${error instanceof Error ? error.message : error}`)
      }
    }

    console.log('[upload] 全部上传完成')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[upload] 失败:', message)
    process.exit(1)
  }
}

main()
