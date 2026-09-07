/**
 * 一次性清理「全局媒体副本」时代遗留的磁盘目录与索引脏数据（索引模式不再使用）。
 *
 * 删除目标（存在时）：
 *   {dataRoot}/materials/assets/              — 旧素材库图片副本
 *   {dataRoot}/materials/.migrated-global-v1.json — 旧素材库迁移标记
 *   {dataRoot}/voice-library/voices/          — 旧音色库音频副本
 *
 * 用法:
 *   node scripts/purge-global-library-copies.mjs <dataRoot>
 *   node scripts/purge-global-library-copies.mjs <dataRoot> --dry-run
 *   node scripts/purge-global-library-copies.mjs <dataRoot> --clean-index
 *   node scripts/purge-global-library-copies.mjs <dataRoot> --clean-index --dry-run
 *
 * 示例:
 *   npm run purge:global-library-copies -- "D:\haode-data" --dry-run
 *   npm run purge:global-library-copies -- "D:\haode-data" --clean-index
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const LEGACY_MATERIALS_ASSETS = path.join('materials', 'assets')
const LEGACY_MATERIALS_MIGRATION_MARKER = path.join('materials', '.migrated-global-v1.json')
const LEGACY_VOICE_VOICES = path.join('voice-library', 'voices')
const MATERIALS_INDEX = 'materials.json'
const VOICE_INDEX = path.join('voice-library', 'voice-library.json')

const GLOBAL_MAT_COPY_PATH = /^assets\/lib_[^/]+\//i
const GLOBAL_MAT_ABS_COPY_PATH = /materials[/\\]assets[/\\]lib_/i

function parseArgs(argv) {
  const args = argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const cleanIndex = args.includes('--clean-index')
  const dataRoot = args.find((item) => item && !item.startsWith('-'))
  return { dataRoot, dryRun, cleanIndex }
}

async function exists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

function collectEntryMediaPaths(entry) {
  return [
    entry?.generatedImagePath,
    entry?.referenceImagePath,
    entry?.reviewImagePath,
    ...(entry?.generatedImagePaths ?? []),
    ...(entry?.referenceImagePaths ?? []),
  ]
    .map((value) => String(value || '').replace(/\\/g, '/').trim())
    .filter(Boolean)
}

function isLegacyMaterialEntry(entry) {
  for (const storedPath of collectEntryMediaPaths(entry)) {
    if (GLOBAL_MAT_COPY_PATH.test(storedPath)) return true
    if (GLOBAL_MAT_ABS_COPY_PATH.test(storedPath)) return true
  }
  return false
}

function isLegacyVoiceEntry(entry) {
  const storedPath = String(entry?.referenceAudio || '').replace(/\\/g, '/').trim()
  if (!storedPath) return false
  if (/^[a-z]:[/\\]/i.test(storedPath) && /voice-library[/\\]voices[/\\]/i.test(storedPath)) {
    return true
  }
  if (/^voices\/voice_\d+\//i.test(storedPath) && !String(entry?.sourceProjectId || '').trim()) {
    return true
  }
  return false
}

async function listLegacyPurgeTargets(dataRoot) {
  const targets = []
  const pushIfExists = async (relativePath, label) => {
    const abs = path.join(dataRoot, relativePath)
    if (await exists(abs)) {
      targets.push({ relativePath, abs, label })
    }
  }

  await pushIfExists(LEGACY_MATERIALS_ASSETS, '素材库全局图片副本')
  await pushIfExists(LEGACY_MATERIALS_MIGRATION_MARKER, '素材库迁移标记')
  await pushIfExists(LEGACY_VOICE_VOICES, '音色库全局音频副本')
  return targets
}

function collectMaterialLegacyPaths(index) {
  const hits = []
  for (const kind of ['characters', 'scenes', 'props']) {
    for (const entry of index?.[kind] ?? []) {
      for (const storedPath of collectEntryMediaPaths(entry)) {
        if (GLOBAL_MAT_COPY_PATH.test(storedPath) || GLOBAL_MAT_ABS_COPY_PATH.test(storedPath)) {
          hits.push({ id: entry?.id, path: storedPath })
        }
      }
    }
  }
  return hits
}

function collectVoiceLegacyPaths(voices) {
  const hits = []
  for (const entry of voices ?? []) {
    if (!isLegacyVoiceEntry(entry)) continue
    const storedPath = String(entry?.referenceAudio || '').replace(/\\/g, '/').trim()
    const reason = /^[a-z]:/i.test(storedPath)
      ? '全局副本绝对路径'
      : '缺少 sourceProjectId 的全局 voices/ 路径'
    hits.push({ id: entry?.id, path: storedPath, reason })
  }
  return hits
}

async function readJsonIfExists(filePath) {
  if (!(await exists(filePath))) return null
  const raw = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(raw)
}

function cleanMaterialsIndex(index) {
  const next = { characters: [], scenes: [], props: [] }
  const removed = []
  for (const kind of ['characters', 'scenes', 'props']) {
    for (const entry of index?.[kind] ?? []) {
      if (isLegacyMaterialEntry(entry)) {
        removed.push({ kind, id: entry?.id, name: entry?.name })
        continue
      }
      next[kind].push(entry)
    }
  }
  return { next, removed }
}

function cleanVoiceIndex(voices) {
  const next = []
  const removed = []
  for (const entry of voices ?? []) {
    if (isLegacyVoiceEntry(entry)) {
      removed.push({ id: entry?.id, name: entry?.name })
      continue
    }
    next.push(entry)
  }
  return { next, removed }
}

async function cleanLegacyIndexEntries(dataRoot, dryRun) {
  const summary = { materialsRemoved: [], voiceRemoved: [] }

  const materialsPath = path.join(dataRoot, MATERIALS_INDEX)
  const materialsIndex = await readJsonIfExists(materialsPath)
  if (materialsIndex) {
    const { next, removed } = cleanMaterialsIndex(materialsIndex)
    if (removed.length) {
      summary.materialsRemoved = removed
      if (dryRun) {
        console.log(`[dry-run] 将从 ${MATERIALS_INDEX} 移除 ${removed.length} 条遗留索引`)
      } else {
        await fs.writeFile(materialsPath, JSON.stringify(next, null, 2), 'utf-8')
        console.log(`[purge] 已从 ${MATERIALS_INDEX} 移除 ${removed.length} 条遗留索引`)
      }
      for (const item of removed.slice(0, 10)) {
        console.log(`      - [${item.kind}] ${item.id} ${item.name || ''}`.trim())
      }
    }
  }

  const voicePath = path.join(dataRoot, VOICE_INDEX)
  const voiceIndex = await readJsonIfExists(voicePath)
  if (Array.isArray(voiceIndex)) {
    const { next, removed } = cleanVoiceIndex(voiceIndex)
    if (removed.length) {
      summary.voiceRemoved = removed
      if (dryRun) {
        console.log(`[dry-run] 将从 ${VOICE_INDEX} 移除 ${removed.length} 条遗留索引`)
      } else {
        await fs.writeFile(voicePath, JSON.stringify(next, null, 2), 'utf-8')
        console.log(`[purge] 已从 ${VOICE_INDEX} 移除 ${removed.length} 条遗留索引`)
      }
      for (const item of removed.slice(0, 10)) {
        console.log(`      - ${item.id} ${item.name || ''}`.trim())
      }
    }
  }

  return summary
}

async function scanIndexWarnings(dataRoot) {
  const warnings = []

  const materialsPath = path.join(dataRoot, MATERIALS_INDEX)
  const materialsIndex = await readJsonIfExists(materialsPath)
  if (materialsIndex) {
    const legacyPaths = collectMaterialLegacyPaths(materialsIndex)
    if (legacyPaths.length) {
      warnings.push({
        file: MATERIALS_INDEX,
        message: `仍有 ${legacyPaths.length} 条路径指向 materials/assets/lib_*`,
        samples: legacyPaths.slice(0, 5),
      })
    }
  }

  const voicePath = path.join(dataRoot, VOICE_INDEX)
  const voiceIndex = await readJsonIfExists(voicePath)
  if (Array.isArray(voiceIndex)) {
    const legacyPaths = collectVoiceLegacyPaths(voiceIndex)
    if (legacyPaths.length) {
      warnings.push({
        file: VOICE_INDEX,
        message: `仍有 ${legacyPaths.length} 条疑似全局副本音色路径`,
        samples: legacyPaths.slice(0, 5),
      })
    }
  }

  return warnings
}

async function removeTarget(target, dryRun) {
  const stat = await fs.stat(target.abs)
  if (dryRun) {
    console.log(`[dry-run] 将删除 ${target.label}: ${target.relativePath}`)
    return
  }
  if (stat.isDirectory()) {
    await fs.rm(target.abs, { recursive: true, force: true })
  } else {
    await fs.unlink(target.abs)
  }
  console.log(`[purge] 已删除 ${target.label}: ${target.relativePath}`)
}

async function removeEmptyMaterialsDir(dataRoot, dryRun) {
  const materialsDir = path.join(dataRoot, 'materials')
  if (!(await exists(materialsDir))) return
  const entries = await fs.readdir(materialsDir)
  if (entries.length > 0) return
  if (dryRun) {
    console.log('[dry-run] 将删除空目录: materials/')
    return
  }
  await fs.rmdir(materialsDir)
  console.log('[purge] 已删除空目录: materials/')
}

async function purge(dataRoot, dryRun, cleanIndex) {
  const root = path.resolve(dataRoot)
  const rootStat = await fs.stat(root).catch(() => null)
  if (!rootStat?.isDirectory()) {
    throw new Error(`dataRoot 不是有效目录: ${root}`)
  }

  console.log(`[purge] dataRoot: ${root}`)
  if (dryRun) console.log('[purge] 模式: dry-run（不实际删除）')

  const targets = await listLegacyPurgeTargets(root)
  if (!targets.length) {
    console.log('[purge] 未发现需清理的全局副本目录/标记。')
  } else {
    for (const target of targets) {
      await removeTarget(target, dryRun)
    }
    await removeEmptyMaterialsDir(root, dryRun)
  }

  if (cleanIndex) {
    await cleanLegacyIndexEntries(root, dryRun)
  }

  const warnings = await scanIndexWarnings(root)
  if (warnings.length) {
    console.log('\n[purge] 索引告警：')
    for (const warning of warnings) {
      console.log(`  - ${warning.file}: ${warning.message}`)
      for (const sample of warning.samples) {
        const suffix = sample.reason ? ` (${sample.reason})` : ''
        console.log(`      ${sample.id}: ${sample.path}${suffix}`)
      }
    }
    if (!cleanIndex) {
      console.log('  可追加 --clean-index 自动移除遗留索引，或在客户端素材页「清理无效条目」。')
    }
  } else if (targets.length || cleanIndex) {
    console.log('\n[purge] 索引未发现明显的全局副本路径引用。')
  }

  console.log('\n[purge] 完成。')
}

const { dataRoot, dryRun, cleanIndex } = parseArgs(process.argv)
if (!dataRoot) {
  console.error(
    'Usage: node scripts/purge-global-library-copies.mjs <dataRoot> [--dry-run] [--clean-index]',
  )
  process.exit(1)
}

purge(dataRoot, dryRun, cleanIndex).catch((error) => {
  console.error('[purge] 失败:', error?.message || error)
  process.exit(1)
})
