import type {
  AppSettings,
  BindDataRootResult,
  ExportDataRootPackageResult,
  SelectDirectoryResult,
  SettingsReadResult,
  SettingsWriteResult,
} from '@/types/settings'
import type { WorkflowAPI } from '@/lib/storage/workflow-service'
import type { CanvasAPI } from '@/lib/storage/canvas-service'
import type { MaterialsAPI } from '@/lib/materials/materials-index-service'
import type { VoiceLibraryAPI } from '@/lib/voice/voice-library-service'
import type { FsAPI } from '@/lib/storage/fs-service'
import type { MediaAPI } from '@/lib/media/media-service'
import type { DoubaoWebPanelAPI } from '@/types/doubao-web-panel'

export interface SettingsAPI {
  read: () => Promise<SettingsReadResult>
  write: (data: AppSettings) => Promise<SettingsWriteResult>
  bindDataRoot: (dataRoot: string) => Promise<BindDataRootResult>
  exportDataRootPackage: () => Promise<ExportDataRootPackageResult>
  getFilePath: () => Promise<{
    success: boolean
    filePath: string
    launcherDir: string
    dataRoot: string
    appDataDir: string
  }>
  selectDirectory: (options?: { defaultPath?: string }) => Promise<SelectDirectoryResult>
}

export interface ElectronAPI {
  isElectron: boolean
  checkForUpdates: () => Promise<unknown>
  downloadUpdate: () => Promise<{
    success?: boolean
    error?: string
  }>
  installUpdate: () => Promise<unknown>
  getAppVersion: () => Promise<{ success?: boolean; version?: string }>
  getUpdateStatus: () => Promise<import('@/lib/update/app-updater').UpdateStatusResult>
  getUpdateFeedUrl: () => Promise<{ success?: boolean; url?: string }>
  notifyAppReady: () => void
  onCloseRequest?: (callback: () => void) => void
  sendCloseDecision?: (allow: boolean) => void
  onUpdateChecking: (callback: () => void) => void
  onUpdateAvailable: (callback: (info: unknown) => void) => void
  onUpdateNotAvailable: (callback: (info: unknown) => void) => void
  onDownloadProgress: (callback: (progress: unknown) => void) => void
  onUpdateDownloaded: (callback: (info: unknown) => void) => void
  onUpdateError: (callback: (error: string) => void) => void
  onMainProcessMessage?: (callback: (message: string) => void) => void
  prepareVideoDragSource: (payload: {
    storedPath: string
    projectRoot?: string
    filename?: string
  }) => Promise<{ success: boolean; filePath?: string; error?: string }>
  prepareVideoDragSources: (payload: {
    items: Array<{ storedPath: string; projectRoot?: string; filename?: string }>
  }) => Promise<{ success: boolean; filePaths?: string[]; error?: string }>
  startVideoDrag: (payload: { filePath?: string; filePaths?: string[] }) => void
  exportCapcutEpisode?: (payload: {
    projectName: string
    clips: Array<{ label: string; absolutePath: string }>
    draftsDir?: string
  }) => Promise<{
    success: boolean
    error?: string
    code?: 'NO_CLIPS' | 'DRAFTS_DIR_NOT_FOUND' | 'EXPORT_FAILED'
    draftPath?: string
    draftName?: string
    draftsDir?: string
    clipCount?: number
    registered?: boolean
    editorRunning?: boolean
  }>
  resolveCapcutDefaultDraftsDir?: () => Promise<{ success: boolean; draftsDir?: string }>
  openCapcutDraftsDir?: (draftsDir: string) => Promise<{ success: boolean; error?: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
    settingsAPI?: SettingsAPI
    workflowAPI?: WorkflowAPI
    canvasAPI?: CanvasAPI
    materialsAPI?: MaterialsAPI
    fsAPI?: FsAPI
    voiceAPI?: VoiceLibraryAPI
    mediaAPI?: MediaAPI
    /** 画布豆包网页侧栏（仅豆包；主进程 BrowserView） */
    doubaoWebPanelAPI?: DoubaoWebPanelAPI
    /** Electron E2E：由 preload 注入，开启 mock 生图/生视频 */
    __HAODE_E2E_MOCK_AI__?: boolean
    /** Electron E2E：mock 生图/生视频延迟（ms） */
    __HAODE_E2E_MOCK_DELAY_MS__?: number
    /** Electron E2E：mock 失败注入 shot-image | shot-video | asset-image | all */
    __HAODE_E2E_MOCK_FAIL__?: string
    /** Electron E2E：由 preload 注入，跳过登录走本地 Session */
    __HAODE_E2E__?: boolean
  }
}

export {}
