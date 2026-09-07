import type {

  AppSettings,

  BindDataRootResult,

  ExportDataRootPackageResult,

  SelectDirectoryResult,

  SettingsReadResult,

  SettingsWriteResult,

} from '@/types/settings'

/** 是否已在系统设置中绑定数据根目录 */
export function hasConfiguredDataRoot(settingsRes: SettingsReadResult): boolean {
  return Boolean(settingsRes.dataRoot?.trim() || settingsRes.data.dataRootPath?.trim())
}

export async function readSettings(): Promise<SettingsReadResult> {

  if (window.settingsAPI) {

    return window.settingsAPI.read()

  }

  const { createDefaultSettings } = await import('./settings-defaults')

  const launcherDir = 'Documents/HaodeAI'

  return {

    success: true,

    fileExists: false,

    data: createDefaultSettings(''),

    filePath: `${launcherDir}/settings.json`,

    launcherDir,

    dataRoot: '',

    appDataDir: launcherDir,

  }

}



export async function writeSettings(data: AppSettings): Promise<SettingsWriteResult> {

  if (window.settingsAPI) {

    return window.settingsAPI.write(data)

  }

  return { success: true }

}



export async function bindDataRoot(dataRoot: string): Promise<BindDataRootResult> {

  if (window.settingsAPI?.bindDataRoot) {

    return window.settingsAPI.bindDataRoot(dataRoot)

  }

  return { success: false, error: '当前环境不支持绑定数据目录' }

}



export async function exportDataRootPackage(): Promise<ExportDataRootPackageResult> {
  const invoke = window.settingsAPI?.exportDataRootPackage
  if (typeof invoke === 'function') {
    return invoke()
  }

  // settingsAPI 存在说明已在 Electron 内，但 preload 未包含新接口（旧安装包或未重启 dev）
  if (window.settingsAPI || window.electronAPI?.isElectron) {
    return {
      success: false,
      error: '打包导出模块未加载，请完全退出客户端后重新打开；开发调试请重新运行 npm run dev',
    }
  }

  return { success: false, error: '打包导出需要在「好的漫创」桌面客户端中使用' }
}



export async function selectDirectory(options?: {
  defaultPath?: string
}): Promise<SelectDirectoryResult> {
  if (window.settingsAPI) {
    return window.settingsAPI.selectDirectory(options)
  }

  return { success: true, canceled: true }
}



export async function getSettingsFilePath(): Promise<{

  filePath: string

  launcherDir: string

  dataRoot: string

  appDataDir: string

}> {

  if (window.settingsAPI) {

    const res = await window.settingsAPI.getFilePath()

    return {

      filePath: res.filePath,

      launcherDir: res.launcherDir,

      dataRoot: res.dataRoot,

      appDataDir: res.appDataDir,

    }

  }

  const launcherDir = 'Documents/HaodeAI'

  return {

    filePath: `${launcherDir}/settings.json`,

    launcherDir,

    dataRoot: '',

    appDataDir: launcherDir,

  }

}


