// Copyright (c) Haode AI. All rights reserved.
/**
 * 运行队列排序（纯时间）
 * 运行：npx --yes tsx scripts/test-canvas-run-queue-sort.ts
 */
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import { sortCanvasRunQueueNodes } from '../src/lib/canvas/canvas-run-queue-sort'
import { CANVAS_NODE_TYPES } from '../src/types/canvas-nodes'

function node(
  id: string,
  options: {
    status?: string
    shotNumber?: number
    statusUpdatedAt?: number
    remoteCreatedAt?: number
    x?: number
    y?: number
    type?: string
  } = {},
): Node {
  return {
    id,
    type: options.type ?? CANVAS_NODE_TYPES.storyVideo,
    position: { x: options.x ?? 0, y: options.y ?? 0 },
    data: {
      status: options.status,
      shotNumber: options.shotNumber,
      statusUpdatedAt: options.statusUpdatedAt,
      ...(options.remoteCreatedAt != null
        ? { remoteJob: { createdAt: options.remoteCreatedAt } }
        : {}),
      videoName: id,
    },
  }
}

function main() {
  const sorted = sortCanvasRunQueueNodes([
    node('t100', { status: 'idle', statusUpdatedAt: 100 }),
    node('t9000-success', { status: 'success', statusUpdatedAt: 9000 }),
    node('t500-error', { status: 'error', statusUpdatedAt: 500 }),
    node('t50-running', { status: 'running', statusUpdatedAt: 50 }),
    node('t800', { status: 'idle', statusUpdatedAt: 800 }),
    node('remote-only', { status: 'running', remoteCreatedAt: 700 }),
    node('same-time-upper', { status: 'idle', statusUpdatedAt: 200, y: 10 }),
    node('same-time-lower', { status: 'error', statusUpdatedAt: 200, y: 80 }),
  ])

  assert.deepEqual(
    sorted.map((item) => item.id),
    [
      't9000-success',
      't800',
      'remote-only',
      't500-error',
      'same-time-upper',
      'same-time-lower',
      't100',
      't50-running',
    ],
  )

  console.log('ok: canvas run queue sort by time')
}

main()
