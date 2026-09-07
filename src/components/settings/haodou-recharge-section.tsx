// Copyright (c) Haode AI. All rights reserved.

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { resolveApiBase } from '@/lib/auth/api-base'
import { fetchClientProfile } from '@/lib/auth/auth-service'
import {
  createHaodouPaymentOrder,
  fetchHaodouOrder,
  fetchHaodouPackages,
  fetchHaodouPaymentInfo,
  formatHaodouPackagePrice,
  formatHaodouPaymentMethod,
  mockPurchaseHaodouPackage,
  type HaodouPackageItem,
  type HaodouPaymentInfo,
} from '@/lib/auth/haodou-recharge-service'
import { useAuthStore } from '@/stores/auth-store'
import { useSettingsStore } from '@/stores/settings-store'
import { cn } from '@/lib/utils'

/** 充值套餐仅内部员工可见（外部用户靠侧栏/账户余额；上线正式充值另开闸门） */
export function shouldShowHaodouRechargeUi(isInternal: boolean | undefined): boolean {
  return isInternal === true
}

export function HaodouRechargeSection() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const setSession = useAuthStore((s) => s.setSession)
  const settings = useSettingsStore((s) => s.settings)
  const apiBase = resolveApiBase(settings?.apiBaseUrl)

  const [loading, setLoading] = useState(true)
  const [purchasingKey, setPurchasingKey] = useState<string | null>(null)
  const [paymentInfo, setPaymentInfo] = useState<HaodouPaymentInfo | null>(null)
  const [packages, setPackages] = useState<HaodouPackageItem[]>([])

  const refreshProfile = useCallback(async () => {
    if (!token) return
    const profile = await fetchClientProfile(token, apiBase)
    if (profile) setSession(token, profile)
  }, [apiBase, setSession, token])

  const loadCatalog = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [info, list] = await Promise.all([
        fetchHaodouPaymentInfo(token, apiBase),
        fetchHaodouPackages(token, apiBase),
      ])
      setPaymentInfo(info)
      setPackages(list)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载充值信息失败')
      setPaymentInfo(null)
      setPackages([])
    } finally {
      setLoading(false)
    }
  }, [apiBase, token])

  useEffect(() => {
    if (!shouldShowHaodouRechargeUi(user?.is_internal) || !token) {
      setLoading(false)
      return
    }
    void loadCatalog()
  }, [loadCatalog, token, user?.is_internal])

  if (!shouldShowHaodouRechargeUi(user?.is_internal) || !token || !user) {
    return null
  }

  const balance = user.bells ?? user.remaining_quota ?? 0
  const mockEnabled = paymentInfo?.mock_enabled ?? true
  const onlineEnabled =
    paymentInfo?.mode === 'epay' && paymentInfo.epay_ready && !mockEnabled
  const paymentMethods = paymentInfo?.methods?.length
    ? paymentInfo.methods
    : ['wxpay', 'alipay']

  async function handleMockPurchase(pkg: HaodouPackageItem) {
    if (!token) return
    setPurchasingKey(pkg.package_key)
    try {
      const result = await mockPurchaseHaodouPackage(token, pkg.package_key, apiBase)
      await refreshProfile()
      toast.success(`充值成功，当前余额 ${result.balance} 好豆`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '模拟充值失败')
    } finally {
      setPurchasingKey(null)
    }
  }

  async function handleOnlinePurchase(pkg: HaodouPackageItem, paymentMethod: string) {
    if (!token) return
    setPurchasingKey(`${pkg.package_key}:${paymentMethod}`)
    try {
      const order = await createHaodouPaymentOrder(
        token,
        { packageKey: pkg.package_key, paymentMethod },
        apiBase,
      )
      if (!order.pay_url?.trim()) {
        throw new Error('未获取到支付链接')
      }
      window.open(order.pay_url, '_blank', 'noopener,noreferrer')
      toast.message('已打开支付页面，完成后请刷新余额', {
        action: {
          label: '刷新余额',
          onClick: () => {
            void (async () => {
              try {
                const latest = await fetchHaodouOrder(token, order.trade_no, apiBase)
                if (latest.status === 'paid') {
                  await refreshProfile()
                  toast.success(`支付成功，当前余额 ${latest.balance ?? balance} 好豆`)
                } else {
                  await refreshProfile()
                  toast.info('订单尚未支付完成')
                }
              } catch (err) {
                toast.error(err instanceof Error ? err.message : '查询订单失败')
              }
            })()
          },
        },
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '创建支付订单失败')
    } finally {
      setPurchasingKey(null)
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-medium">好豆充值</h3>
          <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:text-amber-200">
            仅内部联调
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          用于联调套餐与支付网关。当前余额见上方「好豆」与侧栏；外部用户不会看到此区块。
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载套餐中…
        </div>
      ) : packages.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          暂无可购套餐，请先在管理端「充值套餐」中配置并启用。
        </p>
      ) : (
        <ul className="space-y-2">
          {packages.map((pkg) => {
            const busy = purchasingKey?.startsWith(pkg.package_key) ?? false
            return (
              <li
                key={pkg.package_key}
                className="rounded-lg border border-border/35 bg-background/60 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{pkg.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pkg.haodou_amount} 好豆 · {formatHaodouPackagePrice(pkg.price_fen)}
                    </p>
                    {pkg.description ? (
                      <p className="text-[11px] text-muted-foreground mt-1">{pkg.description}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {mockEnabled ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={busy}
                        onClick={() => void handleMockPurchase(pkg)}
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '模拟充值'}
                      </Button>
                    ) : null}
                    {onlineEnabled
                      ? paymentMethods.map((method) => (
                          <Button
                            key={`${pkg.package_key}-${method}`}
                            type="button"
                            size="sm"
                            className={cn('h-8', method === 'wxpay' && 'bg-emerald-600 hover:bg-emerald-500')}
                            disabled={busy}
                            onClick={() => void handleOnlinePurchase(pkg, method)}
                          >
                            {busy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              formatHaodouPaymentMethod(method)
                            )}
                          </Button>
                        ))
                      : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {paymentInfo ? (
        <p className="text-[11px] text-muted-foreground">
          支付模式：{mockEnabled ? '模拟充值（内测）' : '易支付在线支付'}
          {onlineEnabled ? ` · 支持 ${paymentMethods.map(formatHaodouPaymentMethod).join(' / ')}` : ''}
          {!mockEnabled && !onlineEnabled ? ' · 在线支付暂未就绪' : ''}
        </p>
      ) : null}
    </section>
  )
}
