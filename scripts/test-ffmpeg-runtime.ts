// Copyright (c) Haode AI. All rights reserved.

/**
 * Step 2 验收：直接调用 electron/main/ffmpeg-runtime（executablePath 注入，不启动 Electron）。
 */
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  formatFfmpegRunFailure,
  isFfmpegRunSuccess,
  runFfmpeg,
  runFfprobe,
} from '../electron/main/ffmpeg-runtime'

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')
const bundleDir = join(projectRoot, 'vendor', 'ffmpeg', 'win')

async function main() {
  if (process.platform !== 'win32') {
    console.log('[test:ffmpeg-runtime] 跳过：当前仅验收 Windows vendor 路径')
    return
  }

  const tools = [
    {
      name: 'ffprobe' as const,
      file: 'ffprobe.exe',
      run: runFfprobe,
    },
    {
      name: 'ffmpeg' as const,
      file: 'ffmpeg.exe',
      run: runFfmpeg,
    },
  ]

  let ok = true
  for (const tool of tools) {
    const executablePath = join(bundleDir, tool.file)
    if (!existsSync(executablePath)) {
      console.log(`[test:ffmpeg-runtime] ${tool.file}: MISSING — run npm run fetch:ffmpeg-win`)
      ok = false
      continue
    }

    const result = await tool.run(['-version'], { executablePath })
    const versionLine = (result.stdout || result.stderr)
      .split('\n')
      .find((line) => /version/i.test(line))
      ?.trim()

    if (!isFfmpegRunSuccess(result)) {
      console.log(`[test:ffmpeg-runtime] ${tool.name}: FAILED — ${formatFfmpegRunFailure(result)}`)
      ok = false
      continue
    }

    console.log(`[test:ffmpeg-runtime] ${tool.name}: OK${versionLine ? ` — ${versionLine}` : ''}`)
  }

  if (!ok) {
    process.exitCode = 1
    console.error('[test:ffmpeg-runtime] FAILED')
  } else {
    console.log('[test:ffmpeg-runtime] PASSED')
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[test:ffmpeg-runtime]', message)
  process.exitCode = 1
})
