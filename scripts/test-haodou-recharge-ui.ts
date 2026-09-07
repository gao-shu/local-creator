/**
 * 好豆充值 helper 回归
 *
 * 用法：npx --yes tsx scripts/test-haodou-recharge-ui.ts
 */

import assert from 'node:assert/strict'

import {
  formatHaodouPackagePrice,
  formatHaodouPaymentMethod,
} from '@/lib/auth/haodou-recharge-service'
import { shouldShowHaodouRechargeUi } from '@/components/settings/haodou-recharge-section'

console.log('[test:haodou-recharge-ui] visibility gate')
assert.equal(shouldShowHaodouRechargeUi(true), true)
assert.equal(shouldShowHaodouRechargeUi(false), false)
assert.equal(shouldShowHaodouRechargeUi(undefined), false)

console.log('[test:haodou-recharge-ui] price labels')
assert.equal(formatHaodouPackagePrice(0), '免费（内测）')
assert.equal(formatHaodouPackagePrice(990), '¥9.90')
assert.equal(formatHaodouPackagePrice(1000), '¥10')

console.log('[test:haodou-recharge-ui] payment method labels')
assert.equal(formatHaodouPaymentMethod('wxpay'), '微信支付')
assert.equal(formatHaodouPaymentMethod('alipay'), '支付宝')

console.log('[test:haodou-recharge-ui] all passed')
