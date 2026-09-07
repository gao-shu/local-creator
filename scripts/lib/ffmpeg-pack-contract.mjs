/**
 * Step 12：Windows FFmpeg 打包约定（开发 vendor → extraResources → resources/ffmpeg/win）
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const FFMPEG_VENDOR_REL = join('vendor', 'ffmpeg', 'win')
export const FFMPEG_PACKAGED_REL = join('resources', 'ffmpeg', 'win')
export const FFMPEG_REQUIRED_BINARIES = ['ffmpeg.exe', 'ffprobe.exe']

export function resolveVendorFfmpegDir(projectRoot) {
  return join(projectRoot, FFMPEG_VENDOR_REL)
}

export function resolvePackagedFfmpegDir(unpackedRoot) {
  return join(unpackedRoot, FFMPEG_PACKAGED_REL)
}

/** 检查 vendor/ffmpeg/win 是否包含打包所需 exe */
export function assertVendorFfmpegBundle(projectRoot) {
  const vendorDir = resolveVendorFfmpegDir(projectRoot)
  const missing = FFMPEG_REQUIRED_BINARIES.filter((name) => !existsSync(join(vendorDir, name)))
  if (missing.length) {
    return {
      ok: false,
      vendorDir,
      missing,
      message:
        `缺少 vendor/ffmpeg/win/${missing.join(', ')}。` +
        '请先执行 npm run fetch:ffmpeg-win，或手动放入 exe。',
    }
  }
  return { ok: true, vendorDir, missing: [] }
}

/** 校验 electron-builder.yml extraResources 是否指向 vendor/ffmpeg/win → ffmpeg/win */
export function assertElectronBuilderFfmpegExtraResources(projectRoot) {
  const configPath = join(projectRoot, 'electron-builder.yml')
  if (!existsSync(configPath)) {
    return { ok: false, message: '缺少 electron-builder.yml' }
  }
  const text = readFileSync(configPath, 'utf8')
  const checks = [
    { label: 'extraResources.from=vendor/ffmpeg/win', ok: /from:\s*vendor\/ffmpeg\/win/m.test(text) },
    { label: 'extraResources.to=ffmpeg/win', ok: /to:\s*ffmpeg\/win/m.test(text) },
    { label: 'filter includes ffmpeg.exe', ok: /ffmpeg\.exe/m.test(text) },
    { label: 'filter includes ffprobe.exe', ok: /ffprobe\.exe/m.test(text) },
  ]
  const failed = checks.filter((item) => !item.ok).map((item) => item.label)
  if (failed.length) {
    return {
      ok: false,
      message: `electron-builder.yml FFmpeg extraResources 不完整：${failed.join('；')}`,
    }
  }
  return { ok: true }
}

/** 检查 win-unpacked 内 resources/ffmpeg/win 是否就绪 */
export function assertPackagedFfmpegBundle(unpackedRoot) {
  const bundleDir = resolvePackagedFfmpegDir(unpackedRoot)
  const missing = FFMPEG_REQUIRED_BINARIES.filter((name) => !existsSync(join(bundleDir, name)))
  if (missing.length) {
    return {
      ok: false,
      bundleDir,
      missing,
      message: `打包产物缺少 ${FFMPEG_PACKAGED_REL}/${missing.join(', ')}`,
    }
  }
  return { ok: true, bundleDir, missing: [] }
}
