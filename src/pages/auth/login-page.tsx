// Copyright (c) local-creator. All rights reserved.

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppLogo } from '@/components/ui/app-logo'

/** 开源版无公司云登录；保留路由以免旧书签 404 */
export function LoginPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/dashboard', { replace: true })
  }, [navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <AppLogo className="h-10 w-auto" />
      <h1 className="text-lg font-semibold">本地模式</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        无需登录。正在进入工作台…
      </p>
    </div>
  )
}

export default LoginPage
