import path from 'node:path'
import fs from 'node:fs/promises'

const pathLocks = new Map<string, Promise<unknown>>()

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryableWriteError(error: unknown) {
  const code = (error as NodeJS.ErrnoException).code
  return code === 'EPERM' || code === 'EACCES' || code === 'EBUSY'
}

/** 同一路径串行化读写，避免 read-modify-write 竞态 */
export function withPathLock<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const key = path.resolve(filePath)
  const prev = pathLocks.get(key) ?? Promise.resolve()
  const run = prev.then(task, task)
  pathLocks.set(
    key,
    run.then(
      () => undefined,
      () => undefined,
    ),
  )
  return run
}

async function commitTempFile(filePath: string, tempPath: string) {
  const maxRetries = 5

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await fs.rename(tempPath, filePath)
      return
    } catch (error: unknown) {
      if (!isRetryableWriteError(error) || attempt === maxRetries - 1) break
      await sleep(50 * (attempt + 1))
    }
  }

  // Windows 上目标文件被占用时，rename 可能 EPERM；copyFile 覆盖通常更稳
  try {
    await fs.copyFile(tempPath, filePath)
    await fs.unlink(tempPath).catch(() => {})
    return
  } catch (copyError: unknown) {
    await fs.unlink(tempPath).catch(() => {})
    throw copyError
  }
}

async function writeFileAtomicUnsafe(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`
  await fs.writeFile(tempPath, content, 'utf-8')
  await commitTempFile(filePath, tempPath)
}

export function writeFileAtomic(filePath: string, content: string): Promise<void> {
  return withPathLock(filePath, () => writeFileAtomicUnsafe(filePath, content))
}

export function writeJsonAtomic(filePath: string, data: unknown): Promise<void> {
  return writeFileAtomic(filePath, JSON.stringify(data, null, 2))
}

export async function readModifyWriteJsonAtomic<T>(
  filePath: string,
  defaultValue: T,
  mutator: (current: T) => T | Promise<T>,
): Promise<T> {
  return withPathLock(filePath, async () => {
    let current: T
    try {
      const raw = await fs.readFile(filePath, 'utf-8')
      current = JSON.parse(raw) as T
    } catch (error: unknown) {
      const err = error as NodeJS.ErrnoException
      if (err.code === 'ENOENT') current = defaultValue
      else throw error
    }
    const next = await mutator(current)
    await writeFileAtomicUnsafe(filePath, JSON.stringify(next, null, 2))
    return next
  })
}
