import { useEffect, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AppLogo } from '@/components/ui/app-logo'
import { IcpFooter } from '@/components/ui/icp-footer'
import { cn } from '@/lib/utils'

interface AuthLayoutProps {
  className?: string
  children: React.ReactNode
  showSuccess?: boolean
  successTitle?: string
  successSubtitle?: string
  onTransitionComplete?: () => void
}

export function AuthLayout({
  className,
  children,
  showSuccess = false,
  successTitle = '操作成功',
  successSubtitle = '正在跳转...',
  onTransitionComplete,
}: AuthLayoutProps) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )
  const [successAnimDone, setSuccessAnimDone] = useState(false)

  useEffect(() => {
    if (!showSuccess) {
      setSuccessAnimDone(false)
    }
  }, [showSuccess])

  return (
    <div
      className={cn(
        'flex w-full flex-col min-h-screen bg-black relative overflow-hidden',
        className,
      )}
    >
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.18),transparent_45%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.14),transparent_40%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.85)_0%,transparent_70%)]" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <div className="absolute top-6 left-6 z-20">
          <AppLogo size="md" nameClassName="text-white" />
        </div>

        <div className="flex flex-1 flex-col justify-center items-center px-4">
          <div className="w-full max-w-sm">
            <AnimatePresence mode="wait">
              {!showSuccess ? (
                <motion.div
                  key="form-content"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                  className="space-y-6 text-center"
                >
                  {children}
                </motion.div>
              ) : (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  className="space-y-6 text-center -translate-y-24"
                >
                  <div className="space-y-1">
                    <h1 className="text-[2.5rem] font-bold leading-[1.1] tracking-tight text-white">
                      {successTitle}
                    </h1>
                    <p className="text-[1.25rem] text-white/50 font-light">{successSubtitle}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="relative z-10 shrink-0 px-4 pb-5 pt-2">
          <IcpFooter variant="dark" />
        </div>
      </div>

      {showSuccess &&
        isClient &&
        !successAnimDone &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
            <motion.div
              className="absolute top-[calc(50%-1rem)] left-1/2 -translate-x-1/2"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
            >
              <motion.div
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
                initial={{ scale: 1 }}
                animate={{ scale: 60 }}
                transition={{
                  duration: 0.6,
                  delay: 1.5,
                  ease: [0.55, 0, 1, 0.45],
                }}
                onAnimationComplete={() => {
                  setSuccessAnimDone(true)
                  onTransitionComplete?.()
                }}
              >
                <motion.svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-black"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 1.3 }}
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </motion.svg>
              </motion.div>
            </motion.div>
          </div>,
          document.body,
        )}
    </div>
  )
}
