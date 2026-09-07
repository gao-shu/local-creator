/**
 * E1-1 落盘契约自测（无需 dev server / Electron）
 *   node scripts/test-canvas-e1-1-persist.mjs
 */
import assert from 'node:assert/strict'
import {
  E1_API_TASK_ID,
  E1_PROGRESS_MESSAGE,
  NODE_ID,
  PROJECT_ID,
  VIDEO_REMOTE_JOB_HANG_MS,
  applyPersistRemoteJobToCanvasData,
  buildCanvasDataWithVideoNode,
  buildIdleVideoNodeData,
  buildPersistRemoteJobPatch,
  buildRemoteJobSnapshot,
  buildResumableCanvasData,
  readVideoNodeFromCanvasJson,
} from './lib/canvas-e1-fixtures.mjs'

function isVideoRemoteJobStale(job, now = Date.now()) {
  return now - (job.createdAt || 0) > VIDEO_REMOTE_JOB_HANG_MS
}

function hasPendingVideoRemoteJob(nodeData, now = Date.now()) {
  if (nodeData.status === 'success' || nodeData.status === 'error') return false
  const remoteJob = nodeData.remoteJob
  return Boolean(remoteJob?.apiTaskId?.trim() && !isVideoRemoteJobStale(remoteJob, now))
}

function isActiveCanvasVideoTask(nodeData, now = Date.now()) {
  if (nodeData.status === 'running') return true
  return hasPendingVideoRemoteJob(nodeData, now)
}

function test(name, fn) {
  fn()
  console.log(`✓ ${name}`)
}

const now = Date.now()

test('E1-1d：persist 补丁含 remoteJob.apiTaskId', () => {
  const remoteJob = buildRemoteJobSnapshot(now)
  const patch = buildPersistRemoteJobPatch(remoteJob, now)
  assert.equal(patch.remoteJob.apiTaskId, E1_API_TASK_ID)
  assert.equal(patch.status, 'running')
  assert.equal(patch.error, undefined)
})

test('E1-1e：persist 后节点 status 为 running', () => {
  const idle = buildCanvasDataWithVideoNode(buildIdleVideoNodeData())
  const next = applyPersistRemoteJobToCanvasData(idle, NODE_ID, buildRemoteJobSnapshot(now), now)
  const node = readVideoNodeFromCanvasJson(next)
  assert.equal(node.data.status, 'running')
  assert.equal(node.data.remoteJob.apiTaskId, E1_API_TASK_ID)
})

test('E1-1：idle → persist 后 UI 应判为 active', () => {
  const idle = buildCanvasDataWithVideoNode(buildIdleVideoNodeData())
  assert.equal(isActiveCanvasVideoTask(idle.nodes[1].data), false)

  const next = applyPersistRemoteJobToCanvasData(idle, NODE_ID, buildRemoteJobSnapshot(now), now)
  const nodeData = readVideoNodeFromCanvasJson(next).data
  assert.equal(isActiveCanvasVideoTask(nodeData), true)
  assert.equal(hasPendingVideoRemoteJob(nodeData), true)
})

test('E1-1：progressMessage 可随 persist 保留', () => {
  const resumable = buildResumableCanvasData(now)
  const node = readVideoNodeFromCanvasJson(resumable)
  assert.equal(node.data.progressMessage, E1_PROGRESS_MESSAGE)
})

test('E1-1：completed 节点不因 remoteJob 误判 active', () => {
  const nodeData = {
    status: 'success',
    remoteJob: buildRemoteJobSnapshot(now),
  }
  assert.equal(hasPendingVideoRemoteJob(nodeData), false)
})

test('E1-1：stale remoteJob 不算 pending', () => {
  const staleAt = now - VIDEO_REMOTE_JOB_HANG_MS - 1000
  const nodeData = {
    status: 'running',
    remoteJob: buildRemoteJobSnapshot(staleAt),
  }
  assert.equal(hasPendingVideoRemoteJob(nodeData, now), false)
})

test('E1-1：sessionStorage 往返后 remoteJob 仍在', () => {
  const payload = buildResumableCanvasData(now)
  const serialized = JSON.stringify(payload)
  const roundTrip = readVideoNodeFromCanvasJson(serialized)
  assert.equal(roundTrip.data.remoteJob.apiTaskId, E1_API_TASK_ID)
  assert.equal(roundTrip.data.status, 'running')
})

test('E1-1：projectId / nodeId 与 dev preview 对齐', () => {
  assert.equal(PROJECT_ID, 'cv_dev_preview')
  assert.equal(NODE_ID, 'import_video_preview_1')
})

console.log('\nE1-1 落盘契约自测全部通过')
