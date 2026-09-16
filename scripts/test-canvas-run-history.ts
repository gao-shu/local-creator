// Copyright (c) local-creator contributors. All rights reserved.
/**
 * 画布运行队列：执行历史不覆盖 + 按时间排序
 * 运行：npx --yes tsx scripts/test-canvas-run-history.ts
 */
import assert from 'node:assert/strict'
import type { Node } from '@xyflow/react'
import type { WorkflowTask } from '../src/types/workflow'
import { CANVAS_NODE_TYPES } from '../src/types/canvas-nodes'
import {
  buildCanvasRunQueueRows,
  reconcileStaleCanvasRunHistory,
  applyCanvasRunHistoryNodeSync,
} from '../src/lib/canvas/canvas-run-history-service'
import { readCanvasTasks, writeCanvasTasks } from '../src/lib/storage/canvas-service'
import { VIDEO_REMOTE_JOB_HANG_MS } from '../src/types/video-remote-job'

function node(id: string, label: string, status?: string): Node {
  return {
    id,
    type: CANVAS_NODE_TYPES.storyVideo,
    position: { x: 0, y: 0 },
    data: { status, videoName: label, prompt: label },
  }
}

function attempt(
  id: string,
  nodeId: string,
  label: string,
  status: WorkflowTask['status'],
  at: number,
  errorMessage?: string,
): WorkflowTask {
  return {
    id,
    type: 'video',
    status,
    canvasSourceNodeId: nodeId,
    label,
    createdAt: at,
    updatedAt: at,
    errorMessage,
  }
}

async function main() {
  ;(globalThis as { window?: { canvasAPI?: unknown } }).window = {}
  const nodes = [
    node('n1', '视频 镜 1'),
    node('n2', '视频 镜 2', 'error'),
    node('n3', '视频 镜 3'),
    node('idle-new', '视频 镜 9'),
  ]

  const tasks: WorkflowTask[] = [
    attempt('a-fail', 'n2', '视频 镜 2 · 第一次', 'failed', 1000, '429 rate limit'),
    attempt('a-retry', 'n2', '视频 镜 2 · 重试', 'running', 3000),
    attempt('a-n1', 'n1', '视频 镜 1', 'running', 2000),
    attempt('a-n3', 'n3', '视频 镜 3', 'completed', 500),
  ]

  const rows = buildCanvasRunQueueRows(nodes, tasks)
  assert.deepEqual(
    rows.map((row) => row.key),
    ['a-retry', 'a-n1', 'a-fail', 'a-n3', 'idle:idle-new'],
  )
  assert.equal(rows.filter((row) => row.nodeId === 'n2').length, 2)
  assert.equal(rows.find((row) => row.key === 'a-fail')?.status, 'error')
  assert.equal(rows.find((row) => row.key === 'a-retry')?.status, 'running')
  assert.equal(rows.find((row) => row.key === 'idle:idle-new')?.activityAt, 0)

  // 排序用 createdAt：恢复时即使 updatedAt 变新，顺序仍按创建时间
  const n1 = tasks.find((t) => t.id === 'a-n1')!
  const resumed = buildCanvasRunQueueRows(nodes, [
    ...tasks.filter((t) => t.id !== 'a-n1'),
    { ...n1, updatedAt: 99999 },
  ])
  assert.equal(resumed[0].key, 'a-retry')
  assert.equal(resumed.find((row) => row.key === 'a-n1')?.activityAt, 2000)

  const overnightMs = 14 * 60 * 60 * 1000
  assert.ok(overnightMs > VIDEO_REMOTE_JOB_HANG_MS, 'overnight tasks exceed hang window')

  const staleRows = buildCanvasRunQueueRows(
    [node('n1', '视频 镜 1', 'error')],
    [
      attempt(
        'stale-running',
        'n1',
        '视频 镜 1 · 昨晚',
        'failed',
        Date.now() - overnightMs,
        '视频生成已超时，请重新生成',
      ),
    ],
  )
  assert.equal(staleRows[0]?.status, 'error')
  assert.equal(staleRows[0]?.error, '视频生成已超时，请重新生成')

  const projectId = 'test-reconcile-history'
  const overnightAt = Date.now() - 14 * 60 * 60 * 1000
  await writeCanvasTasks(projectId, [
    {
      id: 'orphan-running',
      type: 'video',
      status: 'running',
      canvasSourceNodeId: 'n1',
      label: '视频 镜 1 · 昨晚',
      createdAt: overnightAt,
      updatedAt: overnightAt,
      remoteJob: {
        provider: 'openai_compatible',
        apiTaskId: 'task-old-1',
        createdAt: overnightAt,
      },
    },
    {
      id: 'active-running',
      type: 'video',
      status: 'running',
      canvasSourceNodeId: 'n2',
      label: '视频 镜 2 · 当前',
      createdAt: Date.now() - 60_000,
      updatedAt: Date.now() - 30_000,
      remoteJob: {
        provider: 'openai_compatible',
        apiTaskId: 'task-active-2',
        createdAt: Date.now() - 60_000,
      },
    },
  ])

  const failedCount = await reconcileStaleCanvasRunHistory(projectId, [
    node('n1', '视频 镜 1', 'error'),
    {
      id: 'n2',
      type: CANVAS_NODE_TYPES.storyVideo,
      position: { x: 0, y: 0 },
      data: {
        status: 'running',
        videoName: '视频 镜 2',
        remoteJob: {
          provider: 'openai_compatible',
          apiTaskId: 'task-active-2',
          createdAt: Date.now() - 60_000,
        },
      },
    },
  ])
  assert.equal(failedCount.failedCount, 1)

  const reconciled = await readCanvasTasks(projectId)
  const orphan = reconciled.find((item) => item.id === 'orphan-running')
  const active = reconciled.find((item) => item.id === 'active-running')
  assert.equal(orphan?.status, 'failed')
  assert.equal(orphan?.errorMessage, '视频生成已超时，请重新生成')
  assert.equal(active?.status, 'running')

  const syncProjectId = 'test-history-sync-node'
  const syncNodeId = 'sync-n1'
  const syncAt = Date.now() - 14 * 60 * 60 * 1000
  await writeCanvasTasks(syncProjectId, [
    {
      id: 'sync-attempt',
      type: 'video',
      status: 'running',
      canvasSourceNodeId: syncNodeId,
      label: '视频 镜 1',
      createdAt: syncAt,
      updatedAt: syncAt,
    },
  ])
  const syncResult = await reconcileStaleCanvasRunHistory(syncProjectId, [
    {
      id: syncNodeId,
      type: CANVAS_NODE_TYPES.storyVideo,
      position: { x: 0, y: 0 },
      data: { status: 'running', videoName: '视频 镜 1', progressMessage: '生成中 0%' },
    },
  ])
  assert.equal(syncResult.failedCount, 1)
  assert.equal(syncResult.syncedNodes.length, 1)
  assert.equal(syncResult.syncedNodes[0]?.error, '视频生成已超时，请重新生成')
  const synced = applyCanvasRunHistoryNodeSync(
    [
      {
        id: syncNodeId,
        type: CANVAS_NODE_TYPES.storyVideo,
        position: { x: 0, y: 0 },
        data: { status: 'running', videoName: '视频 镜 1' },
      },
    ],
    syncResult.syncedNodes,
  )
  assert.equal((synced[0]?.data as { status?: string }).status, 'error')

  const staleJobProject = 'test-stale-job-sync'
  const staleJobNodeId = 'stale-n1'
  const staleAt = Date.now() - 14 * 60 * 60 * 1000
  await writeCanvasTasks(staleJobProject, [
    {
      id: 'stale-job-attempt',
      type: 'video',
      status: 'running',
      canvasSourceNodeId: staleJobNodeId,
      label: '视频 镜 1',
      createdAt: staleAt,
      updatedAt: staleAt,
      remoteJob: {
        provider: 'openai_compatible',
        apiTaskId: 'old-task',
        createdAt: staleAt,
      },
    },
  ])
  const staleJobResult = await reconcileStaleCanvasRunHistory(staleJobProject, [
    {
      id: staleJobNodeId,
      type: CANVAS_NODE_TYPES.storyVideo,
      position: { x: 0, y: 0 },
      data: {
        status: 'running',
        videoName: '视频 镜 1',
        progressMessage: '生成中 0%',
        remoteJob: {
          provider: 'openai_compatible',
          apiTaskId: 'old-task',
          createdAt: staleAt,
        },
      },
    },
  ])
  assert.equal(staleJobResult.failedCount, 1)
  assert.equal(staleJobResult.syncedNodes.length, 1)
  assert.equal(staleJobResult.syncedNodes[0]?.error, '视频生成已超时，请重新生成')

  console.log('ok: canvas run history queue rows')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
