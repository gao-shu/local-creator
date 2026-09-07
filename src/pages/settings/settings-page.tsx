import { useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { PageHeader } from '@/components/ui/page-header'
import { GlassCard } from '@/components/ui/glass-card'
import { LoadingState } from '@/components/ui/empty-state'
import { PathsTab } from '@/components/settings/paths-tab'
import { ModelsTab } from '@/components/settings/models-tab'
import { TemplatesTab } from '@/components/settings/templates-tab'
import { SystemTab } from '@/components/settings/system-tab'
import { AgreementTab } from '@/components/settings/agreement-tab'
import { AccountTab } from '@/components/settings/account-tab'
import { IcpFooter } from '@/components/ui/icp-footer'
import { useSettingsStore } from '@/stores/settings-store'
import { isLoginRequired } from '@/lib/auth/login-mode'
import type { SettingsTabId } from '@/types/settings'

const TAB_TITLES: Record<SettingsTabId, string> = {
  paths: '存储位置',
  models: '模型配置',
  templates: '提示词模板',
  system: '系统参数',
  account: '账户',
  agreement: '用户协议',
}

function resolveTab(pathname: string): SettingsTabId {
  if (pathname.includes('/settings/models')) return 'models'
  if (pathname.includes('/settings/templates')) return 'templates'
  if (pathname.includes('/settings/system')) return 'system'
  if (pathname.includes('/settings/account')) return 'account'
  if (pathname.includes('/settings/agreement')) return 'agreement'
  return 'paths'
}

function SettingsTabPanel({ tab }: { tab: SettingsTabId }) {
  switch (tab) {
    case 'models':
      return <ModelsTab />
    case 'templates':
      return <TemplatesTab />
    case 'system':
      return <SystemTab />
    case 'account':
      return isLoginRequired() ? <AccountTab /> : <PathsTab />
    case 'agreement':
      return <AgreementTab />
    default:
      return <PathsTab />
  }
}

export function SettingsPage() {
  const { pathname } = useLocation()
  const activeTab = useMemo(() => resolveTab(pathname), [pathname])
  const load = useSettingsStore((s) => s.load)
  const loading = useSettingsStore((s) => s.loading)
  const settings = useSettingsStore((s) => s.settings)

  useEffect(() => {
    void load()
  }, [load])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-full max-w-[1200px] flex-col"
    >
      <div className="flex-1">
        <PageHeader
          title="系统设置"
          description={`当前：${TAB_TITLES[activeTab]} · 配置与项目数据保存在所选便携数据目录内`}
        />

        {loading || !settings ? (
          <LoadingState label="加载设置..." />
        ) : (
          <GlassCard className="p-6">
            <SettingsTabPanel tab={activeTab} />
          </GlassCard>
        )}
      </div>

      <IcpFooter className="mt-auto shrink-0 pb-2 pt-8" />
    </motion.div>
  )
}
