/**
 * 计费 API probe 共用 helper
 */
import { createProbeApi } from './probe-api.mjs'

export function createBillingProbe() {
  return createProbeApi()
}

export async function registerProbeUser(api, prefix) {
  const username = `${prefix}_${Date.now().toString(36)}`
  const reg = await api('/client/auth/register', {
    method: 'POST',
    body: { username, password: 'password123' },
  })
  if (reg.json?.code !== 0 || !reg.json?.data?.access_token) {
    throw new Error(`register failed: ${JSON.stringify(reg.json)}`)
  }
  return {
    token: reg.json.data.access_token,
    username,
    user: reg.json.data.user,
  }
}

export async function fetchMe(api, token) {
  const res = await api('/client/auth/me', { token })
  if (res.json?.code !== 0) {
    throw new Error(`GET /client/auth/me failed: ${JSON.stringify(res.json)}`)
  }
  return res.json.data
}

export async function fetchModels(api, token) {
  const res = await api('/client/models', { token })
  if (res.json?.code !== 0) {
    throw new Error(`GET /client/models failed: ${JSON.stringify(res.json)}`)
  }
  const list = res.json.data?.list ?? res.json.data ?? []
  if (!Array.isArray(list)) {
    throw new Error(`unexpected models payload: ${JSON.stringify(res.json)}`)
  }
  return list
}

export function pickExternalBillableModel(list, kind) {
  return list.find(
    (item) =>
      item.billing_mode !== 'internal' &&
      item.proxy_available !== false &&
      Number(item.haodou_cost) > 0 &&
      String(item.model_key || '').trim() &&
      (!kind || item.kind === kind),
  )
}

export function pickInternalChargeVideoModel(list) {
  return list.find(
    (m) =>
      m.billing_mode === 'internal' &&
      m.kind === 'video' &&
      m.consumption?.billing_enabled === true &&
      m.model_key,
  )
}

export function pickInternalFastVideoModel(list) {
  return list.find(
    (m) =>
      m.billing_mode === 'internal' &&
      m.kind === 'video' &&
      String(m.model_key || '').includes('fast') &&
      !m.consumption?.billing_enabled,
  )
}

export function haodouReasonForKind(kind) {
  if (kind === 'image') return 'consume_image'
  if (kind === 'video') return 'consume_video'
  return 'consume_script'
}

export async function consumeHaodou(api, token, { modelKey, reason, quantity }) {
  return api('/client/haodou/consume', {
    method: 'POST',
    token,
    body: { model_key: modelKey, reason, quantity },
  })
}

export async function refundHaodou(api, token, amount) {
  return api('/client/haodou/refund', {
    method: 'POST',
    token,
    body: { amount, reason: 'refund_failed' },
  })
}

export async function videoConsumption(api, token, body) {
  return api('/client/projects/video-consumption', {
    method: 'POST',
    token,
    body,
  })
}

export function auditInternalConfigIssues(list) {
  const issues = []
  for (const item of list) {
    if (item.billing_mode !== 'internal') continue
    if (item.consumption?.billing_enabled === true) continue
    issues.push({
      model_key: item.model_key,
      kind: item.kind,
      issue: 'internal 但 consumption.billing_enabled 未启用',
    })
  }
  return issues
}
