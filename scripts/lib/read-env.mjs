import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

export function readEnvFile(name) {
  const file = resolve(projectRoot, name)
  if (!existsSync(file)) return {}
  const map = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx < 1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim()
    if (value) map[key] = value
  }
  return map
}

export function readEnv(key) {
  const fromProcess = process.env[key]?.trim()
  if (fromProcess) return fromProcess
  for (const name of ['.env.production.local', '.env.production']) {
    const map = readEnvFile(name)
    if (map[key]) return map[key]
  }
  return ''
}
