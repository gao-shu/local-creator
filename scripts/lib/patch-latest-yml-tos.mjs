/**
 * 将 latest.yml 中的安装包路径改为 TOS 绝对 URL（客户端从 TOS feed 拉取）
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readTosReleaseConfig, tosPublicUrl } from './tos-release-env.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const releaseDir = resolve(projectRoot, 'release')

export function patchLatestYmlForTos(ymlPath = resolve(releaseDir, 'latest.yml')) {
  const config = readTosReleaseConfig()
  const text = readFileSync(ymlPath, 'utf8')
  const lines = text.split(/\r?\n/)

  const patchName = (fileName) => {
    if (!fileName || /^https?:\/\//i.test(fileName)) return fileName
    return tosPublicUrl(config, fileName)
  }

  const out = lines.map((line) => {
    const pathMatch = line.match(/^path:\s*(.+)$/)
    if (pathMatch) {
      return `path: ${patchName(pathMatch[1].trim())}`
    }
    const urlMatch = line.match(/^(\s*-\s*url:\s*)(.+)$/)
    if (urlMatch) {
      return `${urlMatch[1]}${patchName(urlMatch[2].trim())}`
    }
    return line
  })

  writeFileSync(ymlPath, `${out.join('\n')}\n`, 'utf8')
  return ymlPath
}

/** 将 TOS 绝对 URL 还原为相对文件名，供业务服务器 feed（旧版客户端走服务器镜像） */
export function toServerRelativeLatestYml(text) {
  const stripToFileName = (value) => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return trimmed
    if (!/^https?:\/\//i.test(trimmed)) return trimmed
    try {
      return decodeURIComponent(new URL(trimmed).pathname.split('/').pop() || trimmed)
    } catch {
      const slash = trimmed.lastIndexOf('/')
      return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
    }
  }

  const out = text.split(/\r?\n/).map((line) => {
    const pathMatch = line.match(/^path:\s*(.+)$/)
    if (pathMatch) return `path: ${stripToFileName(pathMatch[1])}`
    const urlMatch = line.match(/^(\s*-\s*url:\s*)(.+)$/)
    if (urlMatch) return `${urlMatch[1]}${stripToFileName(urlMatch[2])}`
    return line
  })

  return `${out.join('\n')}\n`
}
