// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveApiBase } from '@/lib/auth/api-base'
import { fetchBellLedger, type BellLedgerItem } from '@/lib/auth/auth-service'
import { haodouReasonLabel } from '@/lib/auth/haodou-labels'
import { hasPersistedRealToken } from '@/lib/auth/login-mode'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

const LEDGER_PREVIEW_LIMIT = 10

function formatLedgerTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 账户页：真实登录用户可见的好豆流水（与充值套餐内部闸门无关） */
export function HaodouLedgerSection() {
  const token = useAuthStore((s) => s.token)
  const bells = useAuthStore((s) => s.user?.bells)
  const settings = useSettingsStore((s) => s.settings)
  const apiBase = resolveApiBase(settings?.apiBaseUrl)

  const [loading, setLoading] = useState(true)
  const [ledger, setLedger] = useState<BellLedgerItem[]>([])
  const [expanded, setExpanded] = useState(false)

  const loadLedger = useCallback(async () => {
    if (!token || !hasPersistedRealToken(token)) {
      setLedger([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetchBellLedger(token, apiBase)
      setLedger(res.list ?? [])
    } catch {
      setLedger([])
    } finally {
      setLoading(false)
    }
  }, [apiBase, token])

  useEffect(() => {
    void loadLedger()
  }, [loadLedger, bells])

  if (!token || !hasPersistedRealToken(token)) return null

  const visibleLedger = expanded ? ledger : ledger.slice(0, LEDGER_PREVIEW_LIMIT)
  const hasMore = ledger.length > LEDGER_PREVIEW_LIMIT

  return (
    <section className="space-y-3 rounded-xl border border-border/30 bg-card/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">好豆明细</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">充值、消耗与退还记录</p>
        </div>
        {hasMore ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setExpanded((open) => !open)}
          >
            {expanded ? '收起' : `查看全部 (${ledger.length})`}
          </Button>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载明细中…
        </div>
      ) : ledger.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">暂无好豆变动记录</p>
      ) : (
        <div className="rounded-xl border border-border/50 overflow-hidden">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] gap-3 px-3 py-2 text-xs text-muted-foreground border-b border-border/40 bg-muted/30">
            <span>日期</span>
            <span>说明</span>
            <span className="text-right">变动</span>
          </div>
          <ul className="divide-y divide-border/30 text-sm">
            {visibleLedger.map((item) => (
              <li
                key={item.id}
                className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] gap-3 px-3 py-2.5 items-center"
              >
                <span className="text-xs text-muted-foreground tabular-nums">
                  {formatLedgerTime(item.created_at)}
                </span>
                <span className="text-muted-foreground min-w-0 truncate" title={item.remark ?? undefined}>
                  {haodouReasonLabel(item.reason)}
                  {item.remark ? ` · ${item.remark}` : ''}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-right tabular-nums',
                    item.delta >= 0 ? 'text-green-500' : 'text-red-400',
                  )}
                >
                  {item.delta >= 0 ? '+' : ''}
                  {item.delta}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
