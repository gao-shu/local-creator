/**
 * 客户端发版安装包 → 火山 TOS 上传
 */
import { statSync } from 'node:fs'
import { basename } from 'node:path'
import { TosClient, ACLType } from '@volcengine/tos-sdk'
import {
  assertTosReleaseConfig,
  readTosReleaseConfig,
  tosObjectKey,
  tosPublicUrl,
} from './tos-release-env.mjs'

function contentTypeFor(fileName) {
  if (/\.yml$/i.test(fileName)) return 'text/yaml; charset=utf-8'
  if (/\.exe$/i.test(fileName)) return 'application/vnd.microsoft.portable-executable'
  if (/\.blockmap$/i.test(fileName)) return 'application/octet-stream'
  if (/\.dmg$/i.test(fileName)) return 'application/x-apple-diskimage'
  if (/\.zip$/i.test(fileName)) return 'application/zip'
  return 'application/octet-stream'
}

function createTosClient(config) {
  return new TosClient({
    accessKeyId: config.accessKey,
    accessKeySecret: config.secretKey,
    region: config.region,
    endpoint: config.endpoint,
    bucket: config.bucket,
  })
}

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

async function uploadOneFile(client, config, localFile) {
  const fileName = basename(localFile)
  const key = tosObjectKey(config.prefix, fileName)
  const { size } = statSync(localFile)
  const sizeMb = (size / 1024 / 1024).toFixed(1)
  const publicUrl = tosPublicUrl(config, fileName)

  console.log(`[upload:tos] ${fileName} (${sizeMb} MB) → ${key}`)
  const started = Date.now()
  let lastLoggedPct = -1

  await client.putObjectFromFile({
    bucket: config.bucket,
    key,
    filePath: localFile,
    acl: ACLType.ACLPublicRead,
    contentType: contentTypeFor(fileName),
    progress: (percent) => {
      const pct = Math.min(100, Math.floor(percent * 100))
      if (pct >= lastLoggedPct + 10 || pct === 100) {
        const elapsed = ((Date.now() - started) / 1000).toFixed(0)
        console.log(`[upload:tos]   … ${pct}%（${elapsed}s）`)
        lastLoggedPct = pct
      }
    },
  })

  const elapsed = ((Date.now() - started) / 1000).toFixed(0)
  console.log(`[upload:tos]   ✓ ${fileName} 完成（${elapsed}s）`)
  console.log(`[upload:tos]   公网：${publicUrl}`)
}

async function cleanupOldInstallers(client, config, keepVersion) {
  const prefix = `${config.prefix.replace(/\/+$/, '')}/`
  const result = await client.listObjectsType2({
    bucket: config.bucket,
    prefix,
    maxKeys: 200,
  })

  const objects = result.data?.Contents || []
  const setups = objects
    .map((item) => parseSemver(basename(item.Key || '')))
    .filter(Boolean)
    .sort(compareSemver)

  const keepSet = new Set(setups.slice(0, config.keepVersions).map((item) => item.version))
  keepSet.add(keepVersion)

  console.log(
    `[upload:tos] 保留最近 ${config.keepVersions} 个安装包版本：${[...keepSet].sort().join('、')}`,
  )

  for (const item of setups) {
    if (keepSet.has(item.version)) continue
    const keysToDelete = [
      tosObjectKey(config.prefix, item.fileName),
      tosObjectKey(config.prefix, `${item.fileName}.blockmap`),
    ]
    for (const key of keysToDelete) {
      const exists = objects.some((obj) => obj.Key === key)
      if (!exists) continue
      console.log(`[upload:tos] 删除旧版 ${basename(key)}`)
      try {
        await client.deleteObject({ bucket: config.bucket, key })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(`[upload:tos] 跳过删除 ${basename(key)}：${message}`)
      }
    }
  }
}

/**
 * @param {string[]} localFiles 绝对路径列表
 * @param {object} [options]
 * @param {string} [options.keepVersion] 当前 semver
 * @param {boolean} [options.skipCleanup]
 */
export async function uploadReleaseArtifactsToTos(localFiles, options = {}) {
  const config = readTosReleaseConfig()
  assertTosReleaseConfig(config)
  const client = createTosClient(config)

  if (localFiles.length === 0) {
    throw new Error('release/ 下没有可上传的安装包')
  }

  console.log(`[upload:tos] bucket=${config.bucket} prefix=${config.prefix}`)
  console.log(`[upload:tos] 自动更新 feed：${config.publicBase}/${config.prefix}`)

  for (const localFile of localFiles) {
    await uploadOneFile(client, config, localFile)
  }

  const skipCleanup =
    options.skipCleanup ||
    process.platform === 'darwin' ||
    /^(1|true|yes)$/i.test(process.env.UPLOAD_SKIP_WIN_CLEANUP || '')

  if (!skipCleanup && options.keepVersion) {
    await cleanupOldInstallers(client, config, options.keepVersion)
  } else if (skipCleanup) {
    console.log('[upload:tos] 跳过旧版清理')
  }

  console.log('[upload:tos] TOS 上传完成')
}
