/**
 * 唯一维护 website/version.json 的模块
 *
 * windowsDirectUrl = TOS/官网 exe 直链；windowsUrl = 官网下载页（备用字段）
 * macOnly：Mac 本机打包；默认不写 version.json（Mac dmg 不上传服务器）
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readEnv as readEnvDefault } from './read-env.mjs'
import { resolveUpdatePublishUrl } from './tos-release-env.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const releaseDir = resolve(projectRoot, 'release')
const versionFile = resolve(projectRoot, 'website/version.json')

const PRODUCT_NAME = '本地漫创'
const DEFAULT_OFFICIAL_DOWNLOAD_URL =
  'https://duanju.haodeweishi.cn/haode-client/download/'

export function shanghaiNowString() {
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const get = (type) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`
}

function trimSlashes(value) {
  return String(value || '').replace(/\/+$/, '')
}

/** 将 base + 文件名拼成可下载 URL（中文文件名 encodeURIComponent） */
export function buildEncodedDownloadUrl(base, fileName) {
  const baseTrim = trimSlashes(base)
  if (!baseTrim || !fileName) return ''
  return `${baseTrim}/${encodeURIComponent(fileName)}`
}

/** 官网 Windows 安装包直链（与 electron-builder nsis artifactName 一致） */
export function resolveWindowsDirectUrl(version, readEnv = readEnvDefault) {
  const explicit = readEnv('DOWNLOAD_WINDOWS_DIRECT_URL')?.trim()
  if (explicit) return explicit

  const publishBase = trimSlashes(resolveUpdatePublishUrl(readEnv))
  if (!publishBase || !version) return ''
  const fileName = `${PRODUCT_NAME} Setup ${version}.exe`
  return buildEncodedDownloadUrl(publishBase, fileName)
}

function listReleaseFileNames() {
  if (!existsSync(releaseDir)) return []
  return readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
}

function readPreviousVersionJson() {
  if (!existsSync(versionFile)) return {}
  try {
    return JSON.parse(readFileSync(versionFile, 'utf8'))
  } catch {
    return {}
  }
}

function resolveOfficialDownloadPageUrl(readEnv) {
  const explicit = readEnv('DOWNLOAD_WINDOWS_URL')?.trim()
  if (explicit) return explicit.replace(/\/?$/, '/')

  const publishBase = trimSlashes(resolveUpdatePublishUrl(readEnv))
  if (publishBase) {
    try {
      const url = new URL(publishBase)
      return `${url.origin}/haode-client/download/`
    } catch {
      /* ignore */
    }
  }

  const origin = trimSlashes(readEnv('VITE_UPLOAD_ORIGIN'))
  if (origin) return `${origin}/haode-client/download/`

  return DEFAULT_OFFICIAL_DOWNLOAD_URL
}

function resolveMacUrl(names, readEnv, previous) {
  const externalMac = readEnv('DOWNLOAD_MAC_URL')
  if (externalMac) return externalMac

  const macDmg =
    names.find((n) => /universal.*\.dmg$/i.test(n)) ||
    names.find((n) => /\.dmg$/i.test(n))
  if (macDmg) return `./${macDmg}`
  return previous.macUrl || ''
}

/**
 * @param {object} [options]
 * @param {(key: string) => string} [options.readEnv]
 * @param {boolean} [options.touchUpdatedAt]
 * @param {boolean} [options.macOnly] Mac 本机打包：只写 macUrl，Windows 字段不改动
 */
export function syncVersionJson({
  readEnv = readEnvDefault,
  touchUpdatedAt = true,
  macOnly = false,
} = {}) {
  const pkg = JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8'))
  const version = pkg.version
  const previous = readPreviousVersionJson()
  const names = listReleaseFileNames()

  const updatedAt = touchUpdatedAt
    ? shanghaiNowString()
    : previous.updatedAt || shanghaiNowString()

  if (macOnly) {
    const skipVersionJson =
      process.env.BUILD_MAC_SKIP_SERVER_UPLOAD === '1' ||
      process.env.BUILD_MAC_SKIP_SERVER_UPLOAD === 'true'
    if (skipVersionJson) {
      console.log('[version.json] Mac 本机打包：跳过写入（dmg 不上传生产服务器，Mac 从官网下载）')
      return previous.version ? previous : { version, macUrl: resolveMacUrl(names, readEnv, previous) }
    }
    const data = {
      version,
      windowsUrl: previous.windowsUrl || '',
      windowsDirectUrl: previous.windowsDirectUrl || '',
      macUrl: resolveMacUrl(names, readEnv, previous),
      releaseNotes: `版本 ${version}`,
      updatedAt,
    }
    writeFileSync(versionFile, `${JSON.stringify(data, null, 2)}\n`)
    console.log(`[version.json] Mac 合并模式：仅更新 macUrl（v${version}）`)
    return data
  }

  const winSetup = names.find((n) => / Setup /.test(n) && /\.exe$/i.test(n))
  const winExe = winSetup || names.find((n) => /\.exe$/i.test(n))

  const officialPage = resolveOfficialDownloadPageUrl(readEnv)
  const windowsDirectUrl = resolveWindowsDirectUrl(version, readEnv)

  const data = {
    version,
    windowsUrl:
      officialPage || (winExe ? `./${winExe}` : '') || previous.windowsUrl || '',
    windowsDirectUrl:
      windowsDirectUrl || previous.windowsDirectUrl || '',
    macUrl: resolveMacUrl(names, readEnv, previous),
    releaseNotes: `版本 ${version}`,
    updatedAt,
  }

  writeFileSync(versionFile, `${JSON.stringify(data, null, 2)}\n`)
  return data
}
