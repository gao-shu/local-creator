// Copyright (c) local-creator. All rights reserved.

import { useAuthStore } from '@/stores/auth-store'

/** 开源版仅本地会话，无公司云账户管理 */
export function AccountTab() {
  const user = useAuthStore((s) => s.user)
  const displayName = user?.nickname || user?.username || '本地用户'

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-semibold">账户</h2>
      <p className="text-sm text-muted-foreground">
        当前为本地模式（{displayName}）。不连接公司云登录、充值或资料同步。
      </p>
    </div>
  )
}
