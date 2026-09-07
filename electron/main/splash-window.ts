import { BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let splashWin: BrowserWindow | null = null

function resolveSplashHtmlPath(): string {
  const built = path.join(__dirname, 'splash.html')
  if (existsSync(built)) return built
  return path.join(process.env.APP_ROOT!, 'electron', 'splash.html')
}

function resolveSplashLogoPath(): string {
  const candidates = [
    path.join(process.env.APP_ROOT!, 'public', 'favicon.png'),
    path.join(__dirname, '../renderer/favicon.png'),
    path.join(process.env.APP_ROOT!, 'build', 'icon.png'),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0]
}

export function createSplashWindow(): void {
  if (splashWin && !splashWin.isDestroyed()) return

  splashWin = new BrowserWindow({
    width: 440,
    height: 320,
    frame: false,
    resizable: false,
    movable: false,
    center: true,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#050505',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  splashWin.setMenuBarVisibility(false)
  splashWin.once('ready-to-show', () => {
    splashWin?.show()
  })
  void splashWin.loadFile(resolveSplashHtmlPath(), {
    query: { logo: pathToFileURL(resolveSplashLogoPath()).href },
  })
}

export function closeSplashWindow(): void {
  if (!splashWin || splashWin.isDestroyed()) return
  splashWin.close()
  splashWin = null
}
