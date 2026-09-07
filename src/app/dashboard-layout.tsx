import { useMemo, useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { AppHeader } from '@/components/dashboard/app-header'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { SidebarUserDock } from '@/components/dashboard/sidebar-user-dock'
import { SidebarFeedbackButton } from '@/components/dashboard/sidebar-feedback-button'
import { useProfileRefreshOnRoute } from '@/hooks/use-profile-refresh-on-route'
import { LayoutContext, useLayoutState } from '@/hooks/use-layout'
import { isCanvasProjectPath, isWorkshopProjectPath } from '@/lib/nav/list-section-paths'
import { cn } from '@/lib/utils'

export function DashboardLayout() {
  useProfileRefreshOnRoute()
  const { pathname } = useLocation()
  const { fullWidth, setFullWidth } = useLayoutState()
  const [sidebarRoute, setSidebarRoute] = useState<string | null>(null)
  const sidebarOpen = sidebarRoute === pathname
  const isWorkshopProject = isWorkshopProjectPath(pathname)
  const isCanvasProject = isCanvasProjectPath(pathname)
  const isImmersiveProject = isWorkshopProject || isCanvasProject
  // 工坊/画布列表页：无侧栏导航，也不展示左下挂件，主内容区拉满
  const isWorkshopOrCanvasList =
    (pathname.startsWith('/workshop') || pathname.startsWith('/canvas')) && !isImmersiveProject
  const showSidebarNav =
    isWorkshopProject ||
    (!pathname.startsWith('/workshop') && !pathname.startsWith('/canvas'))
  const showLeftRail = !isCanvasProject && !isWorkshopOrCanvasList
  const contentFullWidth = fullWidth || isImmersiveProject || isWorkshopOrCanvasList

  // 路由切换时关闭移动端侧栏遮罩，避免透明层挡住顶部导航点击
  useEffect(() => {
    setSidebarRoute(null)
  }, [pathname])

  const layoutCtx = useMemo(
    () => ({ fullWidth, setFullWidth }),
    [fullWidth, setFullWidth],
  )

  return (
    <LayoutContext.Provider value={layoutCtx}>
      <div className="h-screen overflow-hidden flex flex-col bg-background">
        {!isImmersiveProject ? (
          <motion.div
            className="relative z-[110]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <AppHeader />
          </motion.div>
        ) : null}

        <motion.div
          className={cn('flex flex-1 min-h-0', !isImmersiveProject && 'pt-20')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: isImmersiveProject ? 0 : 0.15 }}
        >
          <div
            className={cn(
              'hidden lg:flex flex-col shrink-0 self-stretch min-h-0',
              showLeftRail &&
                (isImmersiveProject
                  ? 'w-[200px] px-1.5 pt-1 pb-2'
                  : 'w-[clamp(218px,18.4vw,266px)] px-3 pt-1 pb-2'),
            )}
          >
            {showLeftRail ? (
              <>
                {showSidebarNav ? (
                  <div className="flex-1 min-h-0">
                    <SidebarNav />
                  </div>
                ) : null}
                {!isImmersiveProject ? (
                  <SidebarUserDock
                    className={cn('shrink-0', showSidebarNav ? 'mt-2' : 'mt-auto')}
                  />
                ) : null}
              </>
            ) : null}
          </div>

          <AnimatePresence>
            {sidebarOpen && showSidebarNav ? (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="fixed inset-0 z-40 bg-white/40 backdrop-blur-sm lg:hidden"
                  onClick={() => setSidebarRoute(null)}
                />
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="fixed left-4 top-22 z-50 lg:hidden w-[60vw] min-w-[160px] max-w-[240px]"
                >
                  <SidebarNav onNavigate={() => setSidebarRoute(null)} />
                </motion.div>
              </>
            ) : null}
          </AnimatePresence>

          {isImmersiveProject ? (
            <div className="fixed bottom-4 left-3 z-[35] lg:hidden w-[52px]">
              <SidebarFeedbackButton
                variant="compact"
                testId={isCanvasProject ? 'canvas-mobile-feedback' : 'workshop-mobile-feedback'}
              />
            </div>
          ) : !isWorkshopOrCanvasList ? (
            <div className="fixed left-3 bottom-4 z-60 lg:hidden w-[min(192px,calc(100vw-5.5rem))]">
              <SidebarUserDock />
            </div>
          ) : null}

          {showSidebarNav ? (
            <button
              onClick={() => setSidebarRoute(sidebarOpen ? null : pathname)}
              className={cn(
                'fixed right-3 bottom-4 z-60 lg:hidden',
                'h-11 w-11 rounded-full flex items-center justify-center',
                'bg-primary text-primary-foreground shadow-lg shadow-primary/20',
                'hover:shadow-primary/30 hover:scale-105',
                'active:scale-95 transition-all duration-200',
              )}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          ) : null}

          <main
            className={cn(
              'flex-1 min-w-0 min-h-0',
              isImmersiveProject
                ? 'overflow-hidden p-1.5 lg:p-2'
                : cn('overflow-auto', contentFullWidth ? 'py-2 px-2 lg:px-3' : 'py-4 px-5 lg:px-8'),
            )}
          >
            <div
              className={cn(
                'w-full h-full mx-auto transition-[max-width] duration-300 ease-in-out',
                contentFullWidth ? 'max-w-none' : 'max-w-7xl',
              )}
            >
              <Outlet />
            </div>
          </main>
        </motion.div>
      </div>
    </LayoutContext.Provider>
  )
}
