import * as React from 'react'
import { AuthSessionListener } from '@/components/auth/auth-guard'
import { AppCloseGuardHost } from '@/components/app/app-close-guard-host'
import { AppUpdateHost } from '@/components/update/app-update-host'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import { ThemeFlickerEasterEggHost } from '@/components/ui/theme-flicker-easter-egg'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  startVideoBackgroundResumeLoop,
  stopVideoBackgroundResumeLoop,
} from '@/lib/video/video-background-resume-service'

export function RootLayout({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    startVideoBackgroundResumeLoop()
    return () => stopVideoBackgroundResumeLoop()
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <TooltipProvider>
        <AuthSessionListener />
        <AppUpdateHost />
        <AppCloseGuardHost />
        {children}
        <Toaster richColors position="top-center" />
        <ThemeFlickerEasterEggHost />
      </TooltipProvider>
    </ThemeProvider>
  )
}
