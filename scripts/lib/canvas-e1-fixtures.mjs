/** E1 画布 remoteJob 验收共享夹具（verify-canvas-e1 / verify-canvas-e1-1） */

export const PROJECT_ID = 'cv_dev_preview'
export const NODE_ID = 'import_video_preview_1'
export const STORAGE_PREFIX = 'haode:dev:canvas:data:'
export const VIDEO_REMOTE_JOB_HANG_MS = 30 * 60 * 1000
export const E1_PROGRESS_MESSAGE = 'E1验收：视频生成中…'
export const E1_API_TASK_ID = 'verify-e1-task-id'

export const VERIFY_AUTH_STORAGE = JSON.stringify({
  state: {
    token: 'verify-ui-token',
    refreshToken: '',
    user: {
      id: 'verify-ui',
      username: 'verify-ui',
      nickname: 'UI验证',
      role: 'user',
      status: 'active',
      remaining_quota: 999999,
      free_quota: 999999,
      used_quota: 0,
      avatar_url: null,
    },
  },
  version: 0,
})

export function storageKey(projectId = PROJECT_ID) {
  return `${STORAGE_PREFIX}${projectId}`
}

export function buildRemoteJobSnapshot(now = Date.now()) {
  return {
    provider: 'weishi',
    apiTaskId: E1_API_TASK_ID,
    createUrl: 'https://example.invalid/v1/video/tasks',
    modelId: 'verify-model',
    createdAt: now,
  }
}

/** 模拟 onRemoteJobCreated 落盘后的节点 data */
export function buildPersistedVideoNodeData(now = Date.now()) {
  return {
    label: '镜1 视频',
    status: 'running',
    error: undefined,
    progressMessage: E1_PROGRESS_MESSAGE,
    remoteJob: buildRemoteJobSnapshot(now),
    importShotId: 'shot_preview_1',
    importShotNumber: 1,
    importWorkflowProjectId: 'wf_dev_preview',
    videoName: '镜1 视频',
    statusUpdatedAt: now,
  }
}

/** E1-1 落盘前：可再次生成的视频节点（dev preview 默认成片态） */
export function buildIdleVideoNodeData() {
  return {
    label: '镜1 视频',
    status: 'success',
    outputPath: 'assets/videos/preview_shot_1.mp4',
    outputOwnerKind: 'canvas',
    outputOwnerProjectId: PROJECT_ID,
    importShotId: 'shot_preview_1',
    importShotNumber: 1,
    importWorkflowProjectId: 'wf_dev_preview',
    videoName: '镜1 视频',
  }
}

export function buildCanvasDataWithVideoNode(nodeData, nodeId = NODE_ID) {
  return {
    version: 1,
    nodes: [
      {
        id: 'group_assets_preview',
        type: 'group',
        position: { x: 80, y: 80 },
        style: { width: 348, height: 384 },
        data: { label: '本集资产 · 只读' },
        zIndex: 0,
      },
      {
        id: nodeId,
        type: 'storyVideo',
        position: { x: 80, y: 520 },
        data: nodeData,
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 0.75 },
  }
}

/** E1-1c 之后 / E1-2 之前：remoteJob 已落盘 */
export function buildResumableCanvasData(now = Date.now()) {
  return buildCanvasDataWithVideoNode(buildPersistedVideoNodeData(now))
}

export function assertCondition(condition, message, errors) {
  if (!condition) errors.push(message)
}

export function readVideoNodeFromCanvasJson(json, nodeId = NODE_ID) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  return data.nodes?.find((item) => item.id === nodeId) ?? null
}

/** 与 persistCanvasVideoRemoteJob 写入字段对齐 */
export function buildPersistRemoteJobPatch(remoteJob, now = Date.now()) {
  return {
    remoteJob,
    status: 'running',
    error: undefined,
    statusUpdatedAt: now,
  }
}

export function applyPersistRemoteJobToCanvasData(canvasData, nodeId, remoteJob, now = Date.now()) {
  const patch = buildPersistRemoteJobPatch(remoteJob, now)
  return {
    ...canvasData,
    nodes: canvasData.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            data: {
              ...node.data,
              ...patch,
              progressMessage: node.data.progressMessage || E1_PROGRESS_MESSAGE,
            },
          }
        : node,
    ),
  }
}
