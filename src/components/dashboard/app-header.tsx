import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  FolderKanban,
  GitBranch,
  Images,
  LayoutDashboard,
  Menu,
  Settings,
  Wrench,
  X,
} from 'lucide-react'
import { MenuBar, MobileMenuPanel, type MenuDisplayMode } from '@/components/ui/glow-menu'
import { AppLogo } from '@/components/ui/app-logo'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'
import { NoticeButton } from '@/components/dashboard/notice-button'
import { TaskStatusButton } from '@/components/dashboard/task-status-panel'
import { cn } from '@/lib/utils'

type HeaderMenuItem = {
  icon: typeof LayoutDashboard
  label: string
  href: string
  gradient: string
  iconColor: string
}

const menuItems: HeaderMenuItem[] = [
  {
    icon: LayoutDashboard,
    label: '首页',
    href: '/dashboard',
    gradient:
      'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(37,99,235,0.06) 50%, rgba(29,78,216,0) 85%, rgba(29,78,216,0) 100%)',
    iconColor: 'text-blue-500',
  },
  {
    icon: FolderKanban,
    label: '创作工坊',
    href: '/workshop',
    gradient:
      'radial-gradient(circle, rgba(168,85,247,0.15) 0%, rgba(147,51,234,0.06) 50%, rgba(126,34,206,0) 85%, rgba(126,34,206,0) 100%)',
    iconColor: 'text-purple-500',
  },
  {
    icon: GitBranch,
    label: '无限画布',
    href: '/canvas',
    gradient:
      'radial-gradient(circle, rgba(34,211,238,0.15) 0%, rgba(6,182,212,0.06) 50%, rgba(8,145,178,0) 85%, rgba(8,145,178,0) 100%)',
    iconColor: 'text-cyan-500',
  },
  {
    icon: Images,
    label: '素材库',
    href: '/materials',
    gradient:
      'radial-gradient(circle, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.06) 50%, rgba(194,65,12,0) 85%, rgba(194,65,12,0) 100%)',
    iconColor: 'text-orange-500',
  },
  {
    icon: Wrench,
    label: '工具箱',
    href: '/toolbox',
    gradient:
      'radial-gradient(circle, rgba(236,72,153,0.15) 0%, rgba(219,39,119,0.06) 50%, rgba(190,24,93,0) 85%, rgba(190,24,93,0) 100%)',
    iconColor: 'text-pink-500',
  },
  {
    icon: Settings,
    label: '系统设置',
    href: '/settings',
    gradient:
      'radial-gradient(circle, rgba(34,197,94,0.15) 0%, rgba(22,163,74,0.06) 50%, rgba(21,128,61,0) 85%, rgba(21,128,61,0) 100%)',
    iconColor: 'text-green-500',
  },
]

const routeToLabel: Record<string, string> = {
  '/workshop': '创作工坊',
  '/canvas': '无限画布',
  '/materials': '素材库',
  '/toolbox': '工具箱',
  '/settings': '系统设置',
  '/dashboard': '首页',
}

export function AppHeader() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [mobileMenuRoute, setMobileMenuRoute] = useState<string | null>(null)
  const [displayMode, setDisplayMode] = useState<MenuDisplayMode>('full')
  const headerRef = useRef<HTMLDivElement>(null)
  const mobileMenuOpen = displayMode === 'mobile' && mobileMenuRoute === pathname

  const activeLabel =
    Object.entries(routeToLabel).find(([route]) => pathname.startsWith(route))?.[1] ||
    '首页'

  useEffect(() => {
    setMobileMenuRoute(null)
  }, [pathname])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileMenuRoute(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [mobileMenuOpen])

  const handleMenuClick = (label: string) => {
    const item = menuItems.find((m) => m.label === label)
    if (!item) return
    setMobileMenuRoute(null)
    navigate(item.href)
  }

  const handleDisplayModeChange = useCallback((mode: MenuDisplayMode) => {
    setDisplayMode(mode)
    if (mode !== 'mobile') {
      setMobileMenuRoute(null)
    }
  }, [])

  return (
    <header ref={headerRef} className="fixed top-0 left-0 right-0 z-[110] px-4 pt-3">
      <MenuBar
        items={menuItems}
        activeItem={activeLabel}
        onItemClick={handleMenuClick}
        onDisplayModeChange={handleDisplayModeChange}
        className="w-full"
        leftContent={
          <div
            className="flex items-center cursor-pointer shrink-0"
            onClick={() => navigate('/dashboard')}
          >
            <AppLogo className="ml-2" nameClassName="text-foreground" />
          </div>
        }
        mobileControls={
          <button
            onClick={() => setMobileMenuRoute(mobileMenuOpen ? null : pathname)}
            className={cn(
              'p-2 rounded-xl transition-all duration-200',
              'text-muted-foreground hover:text-foreground',
              mobileMenuOpen
                ? 'bg-foreground/10 text-foreground'
                : 'hover:bg-foreground/5',
            )}
            aria-label={mobileMenuOpen ? '关闭菜单' : '打开菜单'}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        }
        rightContent={
          <div className="flex items-center gap-2 justify-end">
            <NoticeButton />
            <TaskStatusButton />
            <AnimatedThemeToggler className="rounded-xl text-violet-500 hover:text-violet-600 hover:bg-violet-500/10 dark:text-violet-300 dark:hover:text-violet-200 dark:hover:bg-violet-400/10 transition-colors" />
          </div>
        }
      />

      <MobileMenuPanel
        items={menuItems}
        activeItem={activeLabel}
        onItemClick={handleMenuClick}
        isOpen={mobileMenuOpen}
      />
    </header>
  )
}
