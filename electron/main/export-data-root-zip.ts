import { createWriteStream } from 'node:fs'
import path from 'node:path'
import archiver from 'archiver'

/** 将目录打包为 zip（根目录内保留一层文件夹名） */
export async function zipDirectoryToFile(sourceDir: string, outputFile: string): Promise<void> {
  const folderName = path.basename(sourceDir) || 'haode-data'

  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(outputFile)
    const archive = archiver('zip', { zlib: { level: 6 } })

    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('error', reject)

    archive.pipe(output)
    archive.directory(sourceDir, folderName)
    void archive.finalize()
  })
}
