import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings } from '../src/types/settings'

if (process.env.LC_E2E_MOCK_AI === '1') {
  contextBridge.exposeInMainWorld('__LC_E2E_MOCK_AI__', true)
}

const e2eMockDelayRaw = process.env.LC_E2E_MOCK_DELAY_MS?.trim()
if (e2eMockDelayRaw) {
  const parsed = Number(e2eMockDelayRaw)
  if (Number.isFinite(parsed) && parsed > 0) {
    contextBridge.exposeInMainWorld('__LC_E2E_MOCK_DELAY_MS__', parsed)
  }
}

const e2eMockFailRaw = process.env.LC_E2E_MOCK_FAIL?.trim()
if (e2eMockFailRaw) {
  contextBridge.exposeInMainWorld('__LC_E2E_MOCK_FAIL__', e2eMockFailRaw)
}

if (process.env.LC_E2E === '1') {
  contextBridge.exposeInMainWorld('__LC_E2E__', true)
}

contextBridge.exposeInMainWorld('settingsAPI', {
  read: () => ipcRenderer.invoke('settings:read'),
  write: (data: AppSettings) => ipcRenderer.invoke('settings:write', data),
  bindDataRoot: (dataRoot: string) => ipcRenderer.invoke('settings:bind-data-root', dataRoot),
  exportDataRootPackage: () => ipcRenderer.invoke('settings:export-data-root-package'),
  getFilePath: () => ipcRenderer.invoke('settings:get-file-path'),
  selectDirectory: (options?: { defaultPath?: string }) =>
    ipcRenderer.invoke('dialog:select-directory', options),
})

contextBridge.exposeInMainWorld('workflowAPI', {
  listProjects: () => ipcRenderer.invoke('workflow:list-projects'),
  createProject: (payload: {
    title?: string
    description?: string
  }) => ipcRenderer.invoke('workflow:create-project', payload),
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke('workflow:delete-project', projectId),
  listDeletedProjects: () => ipcRenderer.invoke('workflow:list-deleted-projects'),
  restoreProject: (projectId: string) =>
    ipcRenderer.invoke('workflow:restore-project', projectId),
  purgeProject: (projectId: string) =>
    ipcRenderer.invoke('workflow:purge-project', projectId),
  getProject: (projectId: string) => ipcRenderer.invoke('workflow:get-project', projectId),
  readData: (projectId: string) => ipcRenderer.invoke('workflow:read-data', projectId),
  writeData: (projectId: string, data: unknown) =>
    ipcRenderer.invoke('workflow:write-data', projectId, data),
  updateProject: (projectId: string, patch: unknown) =>
    ipcRenderer.invoke('workflow:update-project', projectId, patch),
  readTasks: (projectId: string) => ipcRenderer.invoke('workflow:read-tasks', projectId),
  writeTasks: (projectId: string, tasks: unknown) =>
    ipcRenderer.invoke('workflow:write-tasks', projectId, tasks),
  exportProject: (projectId: string) => ipcRenderer.invoke('workflow:export-project', projectId),
  importProject: () => ipcRenderer.invoke('workflow:import-project'),
})

contextBridge.exposeInMainWorld('canvasAPI', {
  listProjects: () => ipcRenderer.invoke('canvas:list-projects'),
  createProject: (payload: {
    title?: string
    description?: string
  }) => ipcRenderer.invoke('canvas:create-project', payload),
  deleteProject: (projectId: string) => ipcRenderer.invoke('canvas:delete-project', projectId),
  listDeletedProjects: () => ipcRenderer.invoke('canvas:list-deleted-projects'),
  restoreProject: (projectId: string) =>
    ipcRenderer.invoke('canvas:restore-project', projectId),
  purgeProject: (projectId: string) => ipcRenderer.invoke('canvas:purge-project', projectId),
  getProject: (projectId: string) => ipcRenderer.invoke('canvas:get-project', projectId),
  readData: (projectId: string) => ipcRenderer.invoke('canvas:read-data', projectId),
  writeData: (projectId: string, data: unknown) =>
    ipcRenderer.invoke('canvas:write-data', projectId, data),
  backupData: (projectId: string, label?: string) =>
    ipcRenderer.invoke('canvas:backup-data', projectId, label),
  updateProject: (projectId: string, patch: unknown) =>
    ipcRenderer.invoke('canvas:update-project', projectId, patch),
  readTasks: (projectId: string) => ipcRenderer.invoke('canvas:read-tasks', projectId),
  writeTasks: (projectId: string, tasks: unknown) =>
    ipcRenderer.invoke('canvas:write-tasks', projectId, tasks),
})

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getUpdateStatus: () => ipcRenderer.invoke('get-update-status'),
  getUpdateFeedUrl: () => ipcRenderer.invoke('get-update-feed-url'),
  notifyAppReady: () => ipcRenderer.send('app-splash-ready'),
  onCloseRequest: (callback: () => void) => {
    ipcRenderer.on('app:close-request', () => callback())
  },
  sendCloseDecision: (allow: boolean) => {
    ipcRenderer.send('app:close-decision', allow)
  },
  onUpdateChecking: (callback: () => void) => {
    ipcRenderer.on('update-checking', () => callback())
  },
  onUpdateAvailable: (callback: (info: unknown) => void) => {
    ipcRenderer.on('update-available', (_event, info) => callback(info))
  },
  onUpdateNotAvailable: (callback: (info: unknown) => void) => {
    ipcRenderer.on('update-not-available', (_event, info) => callback(info))
  },
  onDownloadProgress: (callback: (progress: unknown) => void) => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback: (info: unknown) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info))
  },
  onUpdateError: (callback: (error: string) => void) => {
    ipcRenderer.on('update-error', (_event, error) => callback(error))
  },
  onMainProcessMessage: (callback: (message: string) => void) => {
    ipcRenderer.on('main-process-message', (_event, message) => callback(String(message)))
  },
  prepareVideoDragSource: (payload: {
    storedPath: string
    projectRoot?: string
    filename?: string
  }) => ipcRenderer.invoke('video:prepare-drag-source', payload),
  prepareVideoDragSources: (payload: {
    items: Array<{ storedPath: string; projectRoot?: string; filename?: string }>
  }) => ipcRenderer.invoke('video:prepare-drag-sources', payload),
  startVideoDrag: (payload: { filePath?: string; filePaths?: string[] }) =>
    ipcRenderer.send('video:start-drag', payload),
  exportCapcutEpisode: (payload: {
    projectName: string
    clips: Array<{ label: string; absolutePath: string }>
    draftsDir?: string
  }) => ipcRenderer.invoke('capcut:export-episode', payload),
  resolveCapcutDefaultDraftsDir: () => ipcRenderer.invoke('capcut:resolve-default-drafts-dir'),
  openCapcutDraftsDir: (draftsDir: string) => ipcRenderer.invoke('capcut:open-drafts-dir', draftsDir),
})

contextBridge.exposeInMainWorld('materialsAPI', {
  read: () => ipcRenderer.invoke('materials:read'),
  write: (data: unknown) => ipcRenderer.invoke('materials:write', data),
  upsertEntry: (payload: { kind: string; entry: unknown }) =>
    ipcRenderer.invoke('materials:upsert-entry', payload),
  syncAsset: (payload: {
    asset: unknown
    projectId: string
    projectTitle: string
    projectKind?: 'workflow' | 'canvas'
  }) => ipcRenderer.invoke('materials:sync-asset', payload),
  removeEntries: (payload: { entryIds: string[] }) =>
    ipcRenderer.invoke('materials:remove-entries', payload),
})

contextBridge.exposeInMainWorld('fsAPI', {
  selectImage: (options?: { includeDataUrl?: boolean }) =>
    ipcRenderer.invoke('fs:select-image', options),
  selectVideo: () => ipcRenderer.invoke('fs:select-video'),
  selectVideos: () => ipcRenderer.invoke('fs:select-videos'),
  importLocalImage: (payload: { sourcePath: string; targetDir: string; filename?: string }) =>
    ipcRenderer.invoke('fs:import-local-image', payload),
  saveGeneratedImage: (payload: { dataUrl: string; targetDir?: string; filename?: string }) =>
    ipcRenderer.invoke('fs:save-generated-image', payload),
  readImageDataUrl: (filePath: string) => ipcRenderer.invoke('fs:read-image-data-url', filePath),
  saveRemoteFile: (payload: {
    url: string
    targetDir?: string
    filename?: string
    headers?: Record<string, string>
    allowPrivateNetwork?: boolean
  }) => ipcRenderer.invoke('fs:save-remote-file', payload),
  ensureDirectories: (directories: string[]) =>
    ipcRenderer.invoke('fs:ensure-directories', directories),
  copyReferenceAudio: (payload: {
    sourcePath: string
    targetDir: string
    filename?: string
  }) => ipcRenderer.invoke('fs:copy-reference-audio', payload),
  copyMediaFile: (payload: {
    sourcePath: string
    targetDir: string
    filename?: string
    externalTarget?: boolean
  }) => ipcRenderer.invoke('fs:copy-media-file', payload),
  readAudioDataUrl: (filePath: string) => ipcRenderer.invoke('fs:read-audio-data-url', filePath),
  revealPath: (payload: { absolutePath: string; revealFile?: boolean }) =>
    ipcRenderer.invoke('fs:reveal-path', payload),
})

contextBridge.exposeInMainWorld('voiceAPI', {
  list: () => ipcRenderer.invoke('voice-library:list'),
  selectReferenceAudio: () => ipcRenderer.invoke('voice-library:select-reference-audio'),
  addVoice: (payload: {
    name: string
    sourceAudioPath: string
    projectId: string
    projectTitle?: string
    projectKind?: 'workflow' | 'canvas'
  }) => ipcRenderer.invoke('voice-library:add-voice', payload),
  forkEntries: (payload: {
    sourceProjectId: string
    sourceProjectKind?: 'workflow' | 'canvas'
    targetProjectId: string
    targetProjectKind?: 'canvas' | 'workflow'
    voiceIds: string[]
  }) => ipcRenderer.invoke('voice-library:fork-entries', payload),
})

contextBridge.exposeInMainWorld('mediaAPI', {
  probeVideoAudio: (payload: { inputPath: string; projectRoot?: string }) =>
    ipcRenderer.invoke('media:probe-video-audio', payload),
  extractAudio: (payload: {
    inputPath: string
    outputPath: string
    startSec?: number
    endSec?: number
    projectRoot?: string
  }) => ipcRenderer.invoke('media:extract-audio', payload),
})

contextBridge.exposeInMainWorld('doubaoWebPanelAPI', {
  open: () => ipcRenderer.invoke('doubao-web-panel:open'),
  close: () => ipcRenderer.invoke('doubao-web-panel:close'),
  toggle: () => ipcRenderer.invoke('doubao-web-panel:toggle'),
  setBounds: (bounds: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('doubao-web-panel:set-bounds', bounds),
  getState: () => ipcRenderer.invoke('doubao-web-panel:get-state'),
  openExternal: () => ipcRenderer.invoke('doubao-web-panel:open-external'),
})
