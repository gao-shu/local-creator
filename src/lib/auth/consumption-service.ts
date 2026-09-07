// Copyright (c) local-creator contributors. All rights reserved.

import { hasPersistedRealToken } from '@/lib/auth/login-mode'
import { useAuthStore } from '@/stores/auth-store'

/** @deprecated 客户端已移除组织项目消耗上报；仅用于 billing-display 识别内部员工 */
export function canReportProjectConsumption(): boolean {
  const { token, user } = useAuthStore.getState()
  if (!hasPersistedRealToken(token)) return false
  return Boolean(user?.is_internal)
}

/** @deprecated 使用 canReportProjectConsumption */
export const canReportVideoConsumption = canReportProjectConsumption
