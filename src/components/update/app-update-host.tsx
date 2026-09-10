import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isElectronApp,
  isRemoteVersionNewer,
  type CheckUpdatesResult,
  type UpdateDownloadMode,
  type UpdatePhase,
  type UpdateProgress,
  type UpdateStatusResult,
} from '@/lib/update/app-updater'
import { AUTO_UPDATE_DISABLED_HINT, isAutoUpdateEnabled } from '@/lib/update/update-policy'
import { useUpdateStore } from '@/stores/update-store'
import { UpdateDialog } from './update-dialog'

type UpdateCheckMode = 'interactive' | 'silent' | 'boot'

/** 安装过渡动画时长，让用户感知「正在安装」而非闪退 */
const INSTALL_TRANSITION_MS = 1200

const UPDATE_HINT_KEY = 'local-creator-update-next-version'

function readUpdateHint(): string | null {
  try {
    return localStorage.getItem(UPDATE_HINT_KEY)
  } catch {
    return null
  }
}

function writeUpdateHint(nextVersion: string | null) {
  try {
    if (nextVersion) localStorage.setItem(UPDATE_HINT_KEY, nextVersion)
    else localStorage.removeItem(UPDATE_HINT_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

function syncUpdateAvailability(currentVersion: string, nextVersion?: string | null) {
  useUpdateStore.getState().setUpdateAvailability({ currentVersion, nextVersion })
  const next = nextVersion?.trim() || null
  writeUpdateHint(next && isRemoteVersionNewer(next, currentVersion) ? next : null)
}

function parseUpdateInfo(info: unknown): string | undefined {
  if (!info || typeof info !== 'object') return undefined
  const version = (info as { version?: string }).version
  return version || undefined
}

function parseProgress(raw: unknown): UpdateProgress {
  if (!raw || typeof raw !== 'object') return {}
  const p = raw as UpdateProgress
  return {
    percent: typeof p.percent === 'number' ? p.percent : 0,
    transferred: typeof p.transferred === 'number' ? p.transferred : 0,
    total: typeof p.total === 'number' ? p.total : 0,
    bytesPerSecond: typeof p.bytesPerSecond === 'number' ? p.bytesPerSecond : 0,
  }
}

export function AppUpdateHost() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<UpdatePhase>('idle')
  const [currentVersion, setCurrentVersion] = useState('0.0.0')
  const [nextVersion, setNextVersion] = useState<string | undefined>()
  const [progress, setProgress] = useState<UpdateProgress>({})
  const [errorMessage, setErrorMessage] = useState('')
  const bootCheckedRef = useRef(false)
  const checkModeRef = useRef<UpdateCheckMode>('silent')
  const downloadModeRef = useRef<UpdateDownloadMode>('interactive')
  const downloadInFlightRef = useRef(false)
  const phaseRef = useRef<UpdatePhase>('idle')
  const checkRef = useRef<(mode?: UpdateCheckMode) => Promise<void>>(async () => {})
  const currentVersionRef = useRef('0.0.0')
  const nextVersionRef = useRef<string | undefined>()

  const shouldPromptForAvailable = (mode: UpdateCheckMode) =>
    mode === 'interactive' || mode === 'boot'
  const shouldPromptForStatus = (mode: UpdateCheckMode) => mode === 'interactive'

  const applyRemoteVersion = useCallback(
    (localVersion: string, remoteVersion: string | undefined, mode: UpdateCheckMode) => {
      if (remoteVersion && isRemoteVersionNewer(remoteVersion, localVersion)) {
        setNextVersion(remoteVersion)
        nextVersionRef.current = remoteVersion
        syncUpdateAvailability(localVersion, remoteVersion)
        setPhase('available')
        if (shouldPromptForAvailable(mode)) setOpen(true)
        return
      }
      setNextVersion(undefined)
      syncUpdateAvailability(localVersion, null)
      nextVersionRef.current = undefined
      if (shouldPromptForStatus(mode)) {
        setPhase('uptodate')
        setOpen(true)
      }
    },
    [],
  )

  const checkForUpdates = useCallback(async (mode: UpdateCheckMode = 'interactive') => {
    const api = window.electronAPI
    if (!api) return

    if (!isAutoUpdateEnabled()) {
      if (shouldPromptForStatus(mode)) {
        setOpen(true)
        setPhase('error')
        setErrorMessage(AUTO_UPDATE_DISABLED_HINT)
      }
      return
    }

    checkModeRef.current = mode

    if (shouldPromptForStatus(mode)) {
      setOpen(true)
      setPhase('checking')
      setErrorMessage('')
    }

    try {
      const versionRes = (await api.getAppVersion()) as { success?: boolean; version?: string }
      const localVersion = versionRes?.success && versionRes.version ? versionRes.version : ''
      if (localVersion) {
        setCurrentVersion(localVersion)
        currentVersionRef.current = localVersion
      }

      const result = (await api.checkForUpdates()) as CheckUpdatesResult
      if (result.manualUpdateOnly) {
        if (shouldPromptForStatus(mode)) {
          setPhase('error')
          setErrorMessage(result.message || '请从官网下载 dmg 手动安装')
          setOpen(true)
        }
        return
      }
      if (!result.success) {
        if (shouldPromptForStatus(mode)) {
          setPhase('error')
          setErrorMessage(result.error || '检查更新失败')
        }
        return
      }
      applyRemoteVersion(localVersion, result.updateInfo?.version, mode)
    } catch (error) {
      if (shouldPromptForStatus(mode)) {
        setPhase('error')
        setErrorMessage(error instanceof Error ? error.message : '检查更新失败')
      }
    } finally {
      checkModeRef.current = 'silent'
    }
  }, [applyRemoteVersion])

  checkRef.current = checkForUpdates

  const runDownload = useCallback(async (mode: UpdateDownloadMode) => {
    const api = window.electronAPI
    if (!api || downloadInFlightRef.current) return

    downloadModeRef.current = mode
    downloadInFlightRef.current = true
    setPhase('downloading')
    setProgress({ percent: 0 })
    setErrorMessage('')
    if (mode === 'interactive') setOpen(true)

    try {
      const result = (await api.downloadUpdate()) as {
        success?: boolean
        error?: string
      }
      if (!result?.success) {
        if (mode === 'interactive') {
          setPhase('error')
          setErrorMessage(result?.error || '下载失败')
          setOpen(true)
        } else {
          setPhase('available')
        }
      }
    } catch (error) {
      if (mode === 'interactive') {
        setPhase('error')
        setErrorMessage(error instanceof Error ? error.message : '下载失败')
        setOpen(true)
      } else {
        setPhase('available')
      }
    } finally {
      downloadInFlightRef.current = false
      downloadModeRef.current = 'interactive'
    }
  }, [])

  const downloadUpdate = useCallback(() => {
    void runDownload('interactive')
  }, [runDownload])

  const installUpdate = useCallback(() => {
    setPhase('installing')
    setOpen(true)
    window.setTimeout(() => {
      window.electronAPI?.installUpdate()
    }, INSTALL_TRANSITION_MS)
  }, [])

  const handleDialogClose = useCallback(() => {
    setOpen(false)
  }, [])

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  useEffect(() => {
    if (!isElectronApp()) return
    const api = window.electronAPI
    if (!api) return

    void api.getAppVersion().then((res) => {
      const payload = res as { success?: boolean; version?: string }
      if (!payload?.success || !payload.version) return
      setCurrentVersion(payload.version)
      currentVersionRef.current = payload.version
      const hinted = readUpdateHint()
      if (hinted && isRemoteVersionNewer(hinted, payload.version)) {
        setNextVersion(hinted)
        nextVersionRef.current = hinted
        syncUpdateAvailability(payload.version, hinted)
      } else {
        writeUpdateHint(null)
        syncUpdateAvailability(payload.version, nextVersionRef.current)
      }
    })

    api.onUpdateChecking(() => {
      if (!shouldPromptForStatus(checkModeRef.current)) return
      setPhase('checking')
      setOpen(true)
    })
    api.onUpdateAvailable((info) => {
      const remote = parseUpdateInfo(info)
      const local = currentVersionRef.current
      if (!remote || !isRemoteVersionNewer(remote, local)) {
        syncUpdateAvailability(local, null)
        nextVersionRef.current = undefined
        setNextVersion(undefined)
        return
      }
      setNextVersion(remote)
      nextVersionRef.current = remote
      syncUpdateAvailability(local, remote)
      setPhase('available')
      if (shouldPromptForAvailable(checkModeRef.current)) setOpen(true)
    })
    api.onUpdateNotAvailable(() => {
      syncUpdateAvailability(currentVersionRef.current, null)
      nextVersionRef.current = undefined
      if (!shouldPromptForStatus(checkModeRef.current)) return
      setPhase('uptodate')
      setOpen(true)
    })
    api.onDownloadProgress((raw) => {
      setPhase('downloading')
      setProgress(parseProgress(raw))
      if (downloadModeRef.current === 'interactive') setOpen(true)
    })
    api.onUpdateDownloaded((info) => {
      setNextVersion(parseUpdateInfo(info))
      setPhase('downloaded')
      setOpen(true)
    })
    api.onUpdateError((message) => {
      if (downloadModeRef.current === 'background') return
      if (!shouldPromptForStatus(checkModeRef.current) && !downloadInFlightRef.current) return
      setPhase('error')
      setErrorMessage(message)
      setOpen(true)
    })
  }, [])

  useEffect(() => {
    if (!isElectronApp()) return
    if (!isAutoUpdateEnabled()) return

    const runBootUpdateCheck = () => {
      if (bootCheckedRef.current) return
      bootCheckedRef.current = true

      void (async () => {
        const api = window.electronAPI
        if (!api) return

        checkModeRef.current = 'boot'
        try {
          const versionRes = (await api.getAppVersion()) as { success?: boolean; version?: string }
          const localVersion = versionRes?.success && versionRes.version ? versionRes.version : ''
          if (localVersion) {
            setCurrentVersion(localVersion)
            currentVersionRef.current = localVersion
          }

          if (api.getUpdateStatus) {
            try {
              const status = (await api.getUpdateStatus()) as UpdateStatusResult
              if (status?.success && status.checkedAt && !status.error) {
                applyRemoteVersion(localVersion, status.updateInfo?.version, 'boot')
                if (
                  status.updateInfo?.version &&
                  isRemoteVersionNewer(status.updateInfo.version, localVersion)
                ) {
                  return
                }
              }
            } catch {
              /* fall through to explicit check */
            }
          }

          await checkRef.current('boot')
        } finally {
          checkModeRef.current = 'silent'
        }
      })()
    }

    // splash 可能先于本 effect 触发 app-ready，故用短延时启动检查
    const timer = window.setTimeout(runBootUpdateCheck, 500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [applyRemoteVersion])

  useEffect(() => {
    const onCheck = () => {
      void checkForUpdates('interactive')
    }
    const onOpen = () => {
      if (downloadInFlightRef.current || phaseRef.current === 'downloading') {
        setPhase('downloading')
        setOpen(true)
        return
      }
      if (phaseRef.current === 'downloaded') {
        setOpen(true)
        return
      }
      const current = currentVersionRef.current
      const next = nextVersionRef.current
      if (next && isRemoteVersionNewer(next, current)) {
        setPhase('available')
        setOpen(true)
        return
      }
      void checkForUpdates('interactive')
    }
    window.addEventListener('lc:check-updates', onCheck)
    window.addEventListener('lc:open-update-dialog', onOpen)
    return () => {
      window.removeEventListener('lc:check-updates', onCheck)
      window.removeEventListener('lc:open-update-dialog', onOpen)
    }
  }, [checkForUpdates])

  if (!isElectronApp()) return null

  return (
    <UpdateDialog
      open={open}
      phase={phase}
      currentVersion={currentVersion}
      nextVersion={nextVersion}
      progress={progress}
      errorMessage={errorMessage}
      onClose={handleDialogClose}
      onCheck={() => void checkForUpdates('interactive')}
      onDownload={downloadUpdate}
      onInstall={installUpdate}
    />
  )
}

export function requestAppUpdateCheck(): void {
  window.dispatchEvent(new Event('lc:check-updates'))
}

/** 打开更新弹窗；若已检测到新版本则直接展示，否则先检查更新 */
export function requestAppUpdateOpen(): void {
  window.dispatchEvent(new Event('lc:open-update-dialog'))
}
