import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { canEditApiBaseUrl, resolveApiBase } from '@/lib/auth/api-base'
import { SettingsToggleField } from '@/components/settings/model-config-dialog-shared'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-border/30 bg-card/30 p-4 space-y-4', className)}>
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        {description ? (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  )
}

export function SystemTab() {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  if (!settings) return null

  const debugEnabled = Boolean(settings.debugEnabled)
  const apiBaseEditable = canEditApiBaseUrl(debugEnabled)
  const effectiveApiBase = resolveApiBase(settings.apiBaseUrl)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">系统参数</h2>
        <p className="text-sm text-muted-foreground mt-1">
          调试开关与后端联调地址等行为配置。
        </p>
      </div>

      <div className="space-y-4">
        <SettingsSection
          title="启动"
          description="控制应用随系统开机启动；仅安装后的正式版会写入系统登录项。"
        >
          <SettingsToggleField
            label="开机时自动启动"
            description="默认开启。关闭后下次开机不再自动打开本应用；开发态切换不会写入系统启动项。"
            checked={settings.openAtLogin !== false}
            onCheckedChange={(checked) => updateSettings({ openAtLogin: checked })}
          />
        </SettingsSection>

        <SettingsSection
          title="调试与开发"
          description="面向联调与排障；打包版关闭调试时将使用生产默认行为。"
        >
          <SettingsToggleField
            label="开启调试"
            description="开启后，使用微视 API 生成视频时会弹出请求参数确认窗口；关闭则直接创建视频任务。"
            checked={debugEnabled}
            onCheckedChange={(checked) => updateSettings({ debugEnabled: checked })}
          />
        </SettingsSection>

        <section className="rounded-xl border border-border/30 bg-card/20 overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-foreground/3 transition-colors"
            onClick={() => setAdvancedOpen((open) => !open)}
          >
            <div>
              <h3 className="text-sm font-medium">高级</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                后端 API 地址{apiBaseEditable ? '（调试模式下可编辑）' : '（正式版使用官方地址）'}
              </p>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', advancedOpen && 'rotate-180')}
            />
          </button>

          {advancedOpen ? (
            <div className="border-t border-border/30 px-4 py-4 space-y-1.5">
              <Label>后端 API 地址</Label>
              {apiBaseEditable ? (
                <>
                  <Input
                    type="url"
                    placeholder="/api 或 http://localhost:28080/api"
                    value={settings.apiBaseUrl || ''}
                    onChange={(e) => updateSettings({ apiBaseUrl: e.target.value.trim() })}
                  />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    微信扫码登录与用户相关接口的根地址。开发环境可用 <code className="text-[11px]">/api</code>；
                    直连 Docker 常用 <code className="text-[11px]">http://localhost:28080/api</code>。
                    修改前请确认目标环境可访问。
                  </p>
                </>
              ) : (
                <>
                  <Input type="url" value={effectiveApiBase} readOnly disabled />
                  <p className="text-xs text-muted-foreground">
                    正式版自动使用 <code className="text-[11px]">{effectiveApiBase}</code>。如需联调测试环境，请先在「调试与开发」中开启调试。
                  </p>
                </>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
