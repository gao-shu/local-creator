// Copyright (c) Haode AI. All rights reserved.
/**
 * P4：画布拖入文本文件收集
 * 运行：npx --yes tsx scripts/test-canvas-file-drop-scripts.ts
 */
import assert from 'node:assert/strict'
import { collectCanvasDroppedScripts } from '../src/lib/canvas/canvas-file-drop'

function fakeDt(files: File[]): DataTransfer {
  return { files } as unknown as DataTransfer
}

function main() {
  const md = new File(['镜头号：1\n画面内容：测试'], 'shots.md', { type: 'text/markdown' })
  const png = new File(['x'], 'a.png', { type: 'image/png' })
  const txt = new File(['hello'], 'note.txt', { type: 'text/plain' })

  const onlyScripts = collectCanvasDroppedScripts(fakeDt([md, txt]))
  assert.equal(onlyScripts.length, 2)
  assert.equal(onlyScripts[0]?.displayName, 'shots')
  assert.equal(onlyScripts[1]?.displayName, 'note')

  const mixed = collectCanvasDroppedScripts(fakeDt([png, md]))
  assert.equal(mixed.length, 1)
  assert.equal(mixed[0]?.displayName, 'shots')

  assert.equal(collectCanvasDroppedScripts(fakeDt([png])).length, 0)
  assert.equal(collectCanvasDroppedScripts(null).length, 0)

  console.log('ok: canvas file drop scripts P4')
}

main()
