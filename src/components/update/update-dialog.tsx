import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { APP_LOGO_SRC, APP_PRODUCT_NAME } from '@/components/ui/app-logo'
import { formatBytes, type UpdatePhase, type UpdateProgress } from '@/lib/update/app-updater'

interface UpdateDialogProps {
  open: boolean
  phase: UpdatePhase
  currentVersion: string
  nextVersion?: string
  progress: UpdateProgress
  errorMessage?: string
  onClose: () => void
  onCheck: () => void
  onDownload: () => void
  onInstall: () => void
}

export function UpdateDialog({
  open,
  phase,
  currentVersion,
  nextVersion,
  progress,
  errorMessage,
  onClose,
  onCheck,
  onDownload,
  onInstall,
}: UpdateDialogProps) {
  const canClose = phase !== 'downloading' && phase !== 'installing'

  const headline =
    phase === 'available'
      ? `发现新版本 v${nextVersion || ''}`
      : phase === 'downloaded'
        ? '最新版本已准备好'
        : phase === 'installing'
          ? '正在安装更新'
          : APP_PRODUCT_NAME

  const tagline =
    phase === 'checking'
      ? '正在检查更新…'
      : phase === 'available'
        ? `当前 v${currentVersion} · 可更新至 v${nextVersion || ''}`
        : phase === 'downloading'
          ? `正在下载 ${Math.round(progress.percent || 0)}% · ${formatBytes(progress.transferred || 0)} / ${formatBytes(progress.total || 0)}`
          : phase === 'downloaded'
            ? `v${nextVersion || ''} 已下载，重启后即可使用`
            : phase === 'installing'
              ? '新版本正在安装，请稍候…'
              : phase === 'uptodate'
                ? `当前 v${currentVersion} 已是最新`
                : phase === 'error'
                  ? errorMessage || '更新失败，请稍后重试'
                  : '保持客户端最新'

  const showIndeterminateBar =
    phase === 'checking' || phase === 'installing' || (phase === 'downloading' && !progress.total)

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#050505]/92 backdrop-blur-[2px] px-6"
          onClick={canClose ? onClose : undefined}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="flex max-w-sm flex-col items-center text-center select-none"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <img
              src={APP_LOGO_SRC}
              alt={APP_PRODUCT_NAME}
              className="mb-[18px] h-[72px] w-[72px] object-contain drop-shadow-[0_8px_24px_rgba(168,85,247,0.25)]"
              draggable={false}
            />
            <h2 className="text-[28px] font-bold tracking-wide text-white">{headline}</h2>
            <p className="mb-9 mt-2 text-[13px] text-white/45">{tagline}</p>

            <div className="mb-3.5 h-[3px] w-[min(280px,72vw)] overflow-hidden rounded-full bg-white/10">
              {showIndeterminateBar ? (
                <div className="update-splash-bar h-full w-[36%] rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500" />
              ) : (
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, progress.percent || 0)}%` }}
                />
              )}
            </div>

            <p className="min-h-[18px] text-xs text-white/35">
              {phase === 'checking'
                ? '正在检查更新…'
                : phase === 'downloading'
                  ? `${formatBytes(progress.bytesPerSecond || 0)}/s`
                  : phase === 'installing'
                    ? '正在安装更新…'
                    : null}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {phase === 'available' ? (
                <>
                  <button
                    type="button"
                    onClick={onDownload}
                    className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                  >
                    下载更新
                  </button>
                  {canClose ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg px-4 py-2 text-sm text-white/45 transition hover:text-white/70"
                    >
                      稍后再说
                    </button>
                  ) : null}
                </>
              ) : null}
              {phase === 'downloaded' ? (
                <>
                  <button
                    type="button"
                    onClick={onInstall}
                    className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                  >
                    立即重启
                  </button>
                  {canClose ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg px-4 py-2 text-sm text-white/45 transition hover:text-white/70"
                    >
                      稍后再说
                    </button>
                  ) : null}
                </>
              ) : null}
              {phase === 'error' || phase === 'uptodate' ? (
                <>
                  <button
                    type="button"
                    onClick={onCheck}
                    className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black transition hover:bg-white/90"
                  >
                    重新检测
                  </button>
                  {canClose ? (
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-lg px-4 py-2 text-sm text-white/45 transition hover:text-white/70"
                    >
                      关闭
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          </motion.div>
          <style>{`
            @keyframes update-splash-progress {
              0% { transform: translateX(-120%); }
              100% { transform: translateX(320%); }
            }
            .update-splash-bar {
              animation: update-splash-progress 1.4s ease-in-out infinite;
            }
          `}</style>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
