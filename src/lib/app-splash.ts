/** 通知主进程关闭独立 splash 并显示主窗口 */
export function dismissAppSplash(): void {
  void window.electronAPI?.notifyAppReady?.()
  window.dispatchEvent(new Event('lc:app-ready'))
}
