import { app } from 'electron'

/** 未配置时默认开机自启 */
export function resolveOpenAtLogin(openAtLogin: boolean | undefined): boolean {
  return openAtLogin !== false
}

/**
 * 将「开机自启」同步到系统登录项。
 * 开发态 / 未打包可执行文件时跳过，避免把 Electron.exe 写进开机启动。
 */
export function applyOpenAtLogin(enabled: boolean): void {
  if (!app.isPackaged) return
  try {
    app.setLoginItemSettings({ openAtLogin: enabled })
  } catch (error) {
    console.warn('[login-item] setLoginItemSettings failed', error)
  }
}
