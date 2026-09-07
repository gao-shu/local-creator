/**
 * Phase 5.2：项目 video-consumption API 门禁探测
 *
 * 外部用户 charge 应被拒绝（1113 非内部用户 / 1114 项目不存在 等）。
 *
 * 用法:
 *   npm run probe:project-consumption
 *   PROBE_INTERNAL_TOKEN=... PROBE_ORG_PROJECT_ID=uuid npm run probe:project-consumption
 */
import { createProbeApi } from './lib/probe-api.mjs'
import { isProbeStrict } from './lib/probe-scenario-report.mjs'

const { api, apiBase } = createProbeApi()
const internalToken = process.env.PROBE_INTERNAL_TOKEN?.trim() || ''
const orgProjectId = process.env.PROBE_ORG_PROJECT_ID?.trim() || ''

async function registerExternalUser() {
  const username = `probe_vc_ext_${Date.now().toString(36)}`
  const reg = await api('/client/auth/register', {
    method: 'POST',
    body: { username, password: 'password123' },
  })
  if (reg.json?.code !== 0 || !reg.json?.data?.access_token) {
    throw new Error(`register failed: ${JSON.stringify(reg.json)}`)
  }
  return { token: reg.json.data.access_token, username, user: reg.json.data.user }
}

async function videoConsumption(token, body) {
  return api('/client/projects/video-consumption', {
    method: 'POST',
    token,
    body,
  })
}

function pickInternalVideoModel(list) {
  return list.find(
    (m) =>
      m.billing_mode === 'internal' &&
      m.kind === 'video' &&
      m.consumption?.billing_enabled === true &&
      m.model_key,
  )
}

async function main() {
  console.log(`\n=== Phase 5.2 video-consumption @ ${apiBase} ===\n`)

  const { token, username, user } = await registerExternalUser()
  console.log(`registered external user ${username} (is_internal=${Boolean(user?.is_internal)})`)

  const fakeProjectId = '00000000-0000-4000-8000-000000000001'
  const taskId = `probe-video-${Date.now()}`

  const blocked = await videoConsumption(token, {
    project_id: fakeProjectId,
    episode_id: null,
    task_id: taskId,
    action: 'charge',
    provider: 'weishi',
    duration_sec: 5,
    model_key: 'sys_internal_seedance_20',
  })

  if (blocked.json?.code === 0) {
    console.error('✗ external user should not charge project consumption:', JSON.stringify(blocked.json))
    process.exit(1)
  }

  console.log('✓ external user charge blocked:', {
    code: blocked.json?.code,
    message: blocked.json?.message,
  })

  const modelsRes = await api('/client/models', { token })
  const list = modelsRes.json?.data?.list ?? modelsRes.json?.data ?? []
  const internalModel = pickInternalVideoModel(list)

  if (!internalToken || !orgProjectId) {
    console.log('\n⚠ SKIP internal charge E2E: 需 PROBE_INTERNAL_TOKEN + PROBE_ORG_PROJECT_ID')
    console.log('  外部用户门禁已通过；内部 charge/reverse 请用真实内部账号手工或 CI 注入')
    process.exit(isProbeStrict() ? 1 : 0)
  }

  if (!internalModel) {
    console.log('\n⚠ SKIP internal charge: catalog 无 billing_enabled 的 internal 视频模型')
    process.exit(isProbeStrict() ? 1 : 0)
  }

  const me = await api('/client/auth/me', { token: internalToken })
  if (me.json?.code !== 0) {
    throw new Error(`internal token invalid: ${JSON.stringify(me.json)}`)
  }
  if (!me.json.data?.is_internal) {
    console.log('⚠ PROBE_INTERNAL_TOKEN 不是内部员工，skip charge E2E')
    process.exit(isProbeStrict() ? 1 : 0)
  }

  const chargeTaskId = `probe-internal-${Date.now()}`
  const charge = await videoConsumption(internalToken, {
    project_id: orgProjectId,
    episode_id: null,
    task_id: chargeTaskId,
    action: 'charge',
    provider: 'weishi',
    duration_sec: 5,
    model_key: internalModel.model_key,
  })

  if (charge.json?.code !== 0) {
    console.error('✗ internal charge failed:', JSON.stringify(charge.json, null, 2))
    process.exit(1)
  }

  console.log('\n✓ internal charge ok:', {
    task_id: charge.json.data?.task_id ?? chargeTaskId,
    cost_yuan: charge.json.data?.cost_yuan,
    model_key: internalModel.model_key,
  })

  const reverse = await videoConsumption(internalToken, {
    project_id: orgProjectId,
    task_id: chargeTaskId,
    action: 'reverse',
    provider: 'weishi',
  })

  if (reverse.json?.code !== 0) {
    console.error('✗ internal reverse failed:', JSON.stringify(reverse.json, null, 2))
    process.exit(1)
  }

  console.log('✓ internal reverse ok:', {
    task_id: chargeTaskId,
    status: reverse.json.data?.status,
  })

  console.log('\n=== Phase 5.2 video-consumption 完成 ===')
  console.log('T 矩阵对照: npm run probe:billing:scenarios')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
