// Copyright (c) Haode AI. All rights reserved.
/**
 * P2：分镜稿导入 → 画布节点
 * 运行：npx --yes tsx scripts/test-storyboard-template-action.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Node } from '@xyflow/react'
import { CANVAS_NODE_TYPES } from '../src/types/canvas-nodes'
import {
  runCanvasStoryboardTemplateImport,
  shortenStoryboardDialogueTitle,
} from '../src/lib/canvas/canvas-storyboard-template-action'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.join(__dirname, 'fixtures', 'storyboard-template')

function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

function readFixture(name: string): string {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8')
}

function makeSourceNode(): Node {
  return {
    id: 'source_prompt_1',
    type: CANVAS_NODE_TYPES.shotPrompt,
    position: { x: 100, y: 80 },
    data: { prompt: 'origin', label: '文本  源' },
  }
}

function main() {
  assert(shortenStoryboardDialogueTitle('短') === '短', '短标题')
  assert(shortenStoryboardDialogueTitle('一二三四五六七八九十1234567890').endsWith('…'), '长标题截断')

  const source = makeSourceNode()
  const three = readFixture('02-three-shots.md')
  const result = runCanvasStoryboardTemplateImport({
    sourceNode: source,
    content: three,
    canvasProjectId: 'canvas_test',
    existingNodes: [source],
    existingEdges: [],
  })

  assert(result.shots.length === 3, '3 镜')
  const promptNodes = result.nodes.filter((n) => n.type === CANVAS_NODE_TYPES.shotPrompt)
  const videoNodes = result.nodes.filter((n) => n.type === CANVAS_NODE_TYPES.storyVideo)
  assert(promptNodes.length === 3, '默认 3 个分镜文本')
  assert(videoNodes.length === 3, '默认 3 个视频')

  const video1 = videoNodes.find((n) => Number((n.data as { shotNumber?: number }).shotNumber) === 1)
  assert(video1, '有镜 1 视频')
  assert(Number((video1!.data as { durationSec?: number }).durationSec) === 5, '镜1 duration 5')
  assert(String((video1!.data as { templateSourceNodeId?: string }).templateSourceNodeId) === source.id, '溯源')

  // 源 → 分镜文本；分镜文本 → 视频
  const sourceToPrompt = result.edges.filter((e) => e.source === source.id)
  assert(sourceToPrompt.length === 3, '源连到 3 个文本')
  const promptToVideo = result.edges.filter((e) =>
    promptNodes.some((p) => p.id === e.source) && videoNodes.some((v) => v.id === e.target),
  )
  assert(promptToVideo.length === 3, '文本连到 3 个视频')
  assert(!result.edges.some((e) => e.source === source.id && videoNodes.some((v) => v.id === e.target)), '源不直连视频')

  // 并排：视频列 X > 文本列 X
  assert(videoNodes[0].position.x > promptNodes[0].position.x, '视频在文本右侧')
  assert(Math.abs(videoNodes[0].position.y - promptNodes[0].position.y) < 1, '首行 Y 对齐')

  const videosOnly = runCanvasStoryboardTemplateImport({
    sourceNode: source,
    content: three,
    canvasProjectId: 'canvas_test',
    existingNodes: [source],
    existingEdges: [],
    options: { createShotPromptNodes: false, createVideoNodes: true },
  })
  assert(videosOnly.nodes.every((n) => n.type === CANVAS_NODE_TYPES.storyVideo), '仅视频')
  assert(videosOnly.edges.every((e) => e.source === source.id), '源直连视频')

  const promptsOnly = runCanvasStoryboardTemplateImport({
    sourceNode: source,
    content: readFixture('01-single-shot-full.md'),
    canvasProjectId: 'canvas_test',
    existingNodes: [source],
    existingEdges: [],
    options: { createShotPromptNodes: true, createVideoNodes: false },
  })
  assert(promptsOnly.nodes.length === 1, '单镜仅文本')
  assert(promptsOnly.nodes[0].type === CANVAS_NODE_TYPES.shotPrompt, '类型文本')
  assert(String((promptsOnly.nodes[0].data as { prompt?: string }).prompt || '').includes('阿尔多'), 'prompt 写入')

  let failed = false
  try {
    runCanvasStoryboardTemplateImport({
      sourceNode: source,
      content: readFixture('03-prose-no-shots.md'),
      canvasProjectId: 'canvas_test',
      existingNodes: [source],
      existingEdges: [],
    })
  } catch (error) {
    failed = true
    assert(String((error as Error).message).includes('智能分镜'), '失败引导')
  }
  assert(failed, '散文应抛错')

  console.log('ok: storyboard-template action P2')
}

main()
