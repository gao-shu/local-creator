/**
 * 一次性将 dataRoot 根目录下的创作工坊数据迁入 dataRoot/workflow/
 * 用法: node scripts/migrate-workflow-layout.mjs "E:\test\333"
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const WORKFLOW_SUBDIR = 'workflow'
const WF_PREFIX = /^wf_/i

const RESERVED = new Set([
  WORKFLOW_SUBDIR,
  'canvas',
  'settings.json',
  'projects.json',
  'haode-settings-backup.json',
])

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function isProjectDir(dir) {
  return exists(path.join(dir, 'data.json'))
}

async function migrate(dataRoot) {
  const root = path.resolve(dataRoot)
  const workflowDir = path.join(root, WORKFLOW_SUBDIR)
  await fs.mkdir(workflowDir, { recursive: true })

  let moved = 0

  const srcIndex = path.join(root, 'projects.json')
  const destIndex = path.join(workflowDir, 'projects.json')
  if (!(await exists(destIndex)) && (await exists(srcIndex))) {
    await fs.rename(srcIndex, destIndex)
    console.log('moved projects.json -> workflow/')
    moved++
  }

  const entries = await fs.readdir(root)
  for (const entry of entries) {
    if (RESERVED.has(entry) || entry.startsWith('.')) continue
    const srcDir = path.join(root, entry)
    let stat
    try {
      stat = await fs.stat(srcDir)
    } catch {
      continue
    }
    if (!stat.isDirectory()) continue
    if (!WF_PREFIX.test(entry) && !(await isProjectDir(srcDir))) continue

    const destDir = path.join(workflowDir, entry)
    if (await exists(destDir)) {
      console.log('skip (exists):', entry)
      continue
    }
    await fs.rename(srcDir, destDir)
    console.log('moved:', entry, '-> workflow/')
    moved++
  }

  const settingsPath = path.join(root, 'settings.json')
  if (await exists(settingsPath)) {
    const raw = await fs.readFile(settingsPath, 'utf-8')
    const settings = JSON.parse(raw)
    const workflowPath = workflowDir.replace(/\\/g, '\\\\')
    settings.workflowDataPath = workflowDir
    settings.dataRootPath = root
    settings.projectsDataPath = root
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8')
    console.log('updated settings.json workflowDataPath ->', workflowDir)
  }

  console.log(`done, moved ${moved} entries`)
}

const target = process.argv[2]
if (!target) {
  console.error('Usage: node scripts/migrate-workflow-layout.mjs <dataRoot>')
  process.exit(1)
}

migrate(target).catch((err) => {
  console.error(err)
  process.exit(1)
})
