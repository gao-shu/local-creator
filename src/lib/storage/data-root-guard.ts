// Copyright (c) local-creator contributors. All rights reserved.

import { toast } from 'sonner'
import { hasConfiguredDataRoot, readSettings } from '@/lib/storage/settings-service'

export async function ensureDataRootConfigured(options?: { silent?: boolean }): Promise<boolean> {
  const settingsRes = await readSettings()
  if (hasConfiguredDataRoot(settingsRes)) {
    return true
  }
  if (!options?.silent) {
    toast.error('请先在「系统设置 → 存储位置」中选择数据根目录，才能创建和管理项目')
  }
  return false
}
