// Copyright (c) Haode AI. All rights reserved.

/**
 * Step 1 验收：检查 vendor/ffmpeg/win 是否就绪（不依赖 Electron app）。
 * Step 12 完整打包验证：npm run verify:ffmpeg-win-pack
 * 打包后路径为 process.resourcesPath/ffmpeg/win/，由 electron-builder extraResources 注入。
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const bundleDir = join(projectRoot, 'vendor', 'ffmpeg', 'win')
const required = ['ffmpeg.exe', 'ffprobe.exe'] as const

let ok = true
console.log('[test:ffmpeg-bundle] dev bundle dir:', bundleDir)
for (const name of required) {
  const filePath = join(bundleDir, name)
  const exists = existsSync(filePath)
  console.log(`  ${name}: ${exists ? 'OK' : 'MISSING — run npm run fetch:ffmpeg-win'}`)
  if (!exists) ok = false
}

if (!ok) {
  process.exitCode = 1
  console.error('[test:ffmpeg-bundle] FAILED')
} else {
  console.log('[test:ffmpeg-bundle] PASSED')
}
