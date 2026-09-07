/**
 * Phase 5.2：API 场景编排 + T1–T8 对照报告
 *
 * 用法:
 *   npm run probe:billing:scenarios
 *   PROBE_STRICT=1 npm run probe:billing:scenarios
 *   PROBE_INTERNAL_TOKEN=... PROBE_ORG_PROJECT_ID=uuid npm run probe:billing:scenarios
 */
import { ScenarioReport, maybePrintJsonReport } from './lib/probe-scenario-report.mjs'
import {
  auditInternalConfigIssues,
  consumeHaodou,
  createBillingProbe,
  fetchMe,
  fetchModels,
  haodouReasonForKind,
  pickExternalBillableModel,
  pickInternalChargeVideoModel,
  pickInternalFastVideoModel,
  refundHaodou,
  registerProbeUser,
  videoConsumption,
} from './lib/probe-billing-helpers.mjs'

const report = new ScenarioReport()
const { api, apiBase } = createBillingProbe()
const internalToken = process.env.PROBE_INTERNAL_TOKEN?.trim() || ''
const orgProjectId = process.env.PROBE_ORG_PROJECT_ID?.trim() || ''
const shouldRefund = process.env.PROBE_REFUND !== '0'

async function runContractScenarios(token, models) {
  const invalid = await consumeHaodou(api, token, {
    modelKey: 'nonexistent_model_key_probe',
    reason: 'consume_script',
    quantity: 1,
  })
  if (invalid.json?.code === 0) {
    report.fail('contract-invalid-key', '-', 'api', 'invalid model_key 不应成功')
  } else {
    report.pass(
      'contract-invalid-key',
      '-',
      'api',
      `code=${invalid.json?.code} ${invalid.json?.message ?? ''}`.trim(),
    )
  }

  const internal = models.find((m) => m.billing_mode === 'internal' && m.model_key)
  if (!internal) {
    report.skip('contract-internal-zero', 'T3/T4', 'api', 'catalog 无 internal 模型')
  } else {
    const res = await consumeHaodou(api, token, {
      modelKey: internal.model_key,
      reason: 'consume_video',
      quantity: 5,
    })
    const consumed = Number(res.json?.data?.consumed ?? NaN)
    if (res.json?.code === 0 && consumed === 0) {
      report.pass('contract-internal-zero', 'T3/T4', 'api', `${internal.model_key} consumed=0`)
    } else if (res.json?.code !== 0) {
      report.pass('contract-internal-zero', 'T3/T4', 'api', `rejected code=${res.json?.code}`)
    } else {
      report.fail('contract-internal-zero', 'T3/T4', 'api', `internal 不应扣好豆: ${JSON.stringify(res.json?.data)}`)
    }
  }

  const refundZero = await refundHaodou(api, token, 0)
  if (refundZero.json?.code === 0) {
    report.pass('contract-refund-zero', '-', 'api', 'amount=0 accepted (no-op)')
  } else {
    report.pass(
      'contract-refund-zero',
      '-',
      'api',
      `amount=0 rejected http=${refundZero.status}`,
    )
  }
}

async function runConfigAudit(models) {
  const issues = auditInternalConfigIssues(models)
  if (!issues.length) {
    report.pass('config-models-audit', 'T5', 'config', 'internal consumption 配置正常')
    return
  }
  const detail = issues.map((i) => `${i.model_key}: ${i.issue}`).join('; ')
  report.warn('config-models-audit', 'T5', 'config', detail)
}

async function runHaodouScenario({
  id,
  matrix,
  token,
  billable,
  userLabel,
}) {
  if (!billable) {
    report.skip(id, matrix, 'api', '无 external 模型（haodou_cost>0 且可代理）')
    return
  }

  const reason = haodouReasonForKind(billable.kind)
  const quantity = billable.kind === 'video' ? 5 : 1

  const consumeRes = await consumeHaodou(api, token, {
    modelKey: billable.model_key,
    reason,
    quantity,
  })

  if (consumeRes.json?.code !== 0) {
    report.fail(
      id,
      matrix,
      'api',
      `${userLabel} consume failed code=${consumeRes.json?.code} ${consumeRes.json?.message ?? ''}`,
    )
    return
  }

  const consumed = Number(consumeRes.json.data?.consumed ?? 0)
  let detail = `${userLabel} ${billable.model_key} consumed=${consumed}`

  if (shouldRefund && consumed > 0) {
    const refundRes = await refundHaodou(api, token, consumed)
    if (refundRes.json?.code !== 0) {
      report.fail(id, matrix, 'api', `refund failed: ${JSON.stringify(refundRes.json)}`)
      return
    }
    detail += `; refunded=${refundRes.json.data?.refunded ?? consumed}`
  }

  report.pass(id, matrix, 'api', detail)
}

async function runProjectScenarios(models, externalToken) {
  const fakeProjectId = '00000000-0000-4000-8000-000000000001'
  const blocked = await videoConsumption(api, externalToken, {
    project_id: fakeProjectId,
    episode_id: null,
    task_id: `probe-gate-${Date.now()}`,
    action: 'charge',
    provider: 'weishi',
    duration_sec: 5,
    model_key: 'sys_internal_seedance_20',
  })

  if (blocked.json?.code === 0) {
    report.fail('gate-ext-video', 'T1', 'api', '外部用户不应 charge 项目消耗')
  } else {
    report.pass(
      'gate-ext-video',
      'T1',
      'api',
      `外部用户 blocked code=${blocked.json?.code}`,
    )
  }

  const chargeModel = pickInternalChargeVideoModel(models)
  if (!internalToken || !orgProjectId) {
    report.skip('T3-api-charge', 'T3/T4', 'api', '需 PROBE_INTERNAL_TOKEN + PROBE_ORG_PROJECT_ID')
    report.skip('T5-api-fast-skip', 'T5', 'api', '需 PROBE_INTERNAL_TOKEN + PROBE_ORG_PROJECT_ID')
    return
  }

  const me = await fetchMe(api, internalToken)
  if (!me?.is_internal) {
    report.skip('T3-api-charge', 'T3/T4', 'api', 'PROBE_INTERNAL_TOKEN 非内部员工')
    report.skip('T5-api-fast-skip', 'T5', 'api', 'PROBE_INTERNAL_TOKEN 非内部员工')
    return
  }

  if (!chargeModel) {
    report.skip('T3-api-charge', 'T3/T4', 'api', '无 billing_enabled internal 视频模型')
  } else {
    const taskId = `probe-t3t4-${Date.now()}`
    const charge = await videoConsumption(api, internalToken, {
      project_id: orgProjectId,
      episode_id: null,
      task_id: taskId,
      action: 'charge',
      provider: 'weishi',
      duration_sec: 5,
      model_key: chargeModel.model_key,
    })

    if (charge.json?.code !== 0) {
      report.fail('T3-api-charge', 'T3/T4', 'api', `charge failed: ${JSON.stringify(charge.json)}`)
    } else {
      const reverse = await videoConsumption(api, internalToken, {
        project_id: orgProjectId,
        task_id: taskId,
        action: 'reverse',
        provider: 'weishi',
      })
      if (reverse.json?.code !== 0) {
        report.fail('T3-api-charge', 'T3/T4', 'api', `reverse failed: ${JSON.stringify(reverse.json)}`)
      } else {
        report.pass(
          'T3-api-charge',
          'T3/T4',
          'api',
          `charge+reverse ok model=${chargeModel.model_key} cost=${charge.json.data?.cost_yuan ?? '?'}`,
        )
      }
    }
  }

  const fastModel =
    pickInternalFastVideoModel(models) ??
    models.find((m) => m.model_key === 'sys_internal_seedance_20_fast')

  if (!fastModel) {
    report.skip('T5-api-fast-skip', 'T5', 'api', 'catalog 无 Fast internal 模型')
    return
  }

  if (fastModel.consumption?.billing_enabled) {
    report.pass('T5-api-fast-skip', 'T5', 'api', 'Admin 已补 Fast consumption（可 charge）')
    return
  }

  const fastCharge = await videoConsumption(api, internalToken, {
    project_id: orgProjectId,
    episode_id: null,
    task_id: `probe-t5-${Date.now()}`,
    action: 'charge',
    provider: 'weishi',
    duration_sec: 5,
    model_key: fastModel.model_key,
  })

  if (fastCharge.json?.code === 0 && Number(fastCharge.json.data?.cost_yuan ?? 0) > 0) {
    report.warn(
      'T5-api-fast-skip',
      'T5',
      'api',
      `Fast 无 consumption 但仍 charge cost=${fastCharge.json.data?.cost_yuan}`,
    )
  } else if (fastCharge.json?.code !== 0) {
    report.pass(
      'T5-api-fast-skip',
      'T5',
      'api',
      `Fast 无 consumption → charge rejected code=${fastCharge.json?.code}`,
    )
  } else {
    report.pass('T5-api-fast-skip', 'T5', 'api', 'Fast charge 返回 0 cost（等价 skip）')
  }
}

async function runT7Unauthenticated() {
  const res = await api('/client/haodou/consume', {
    method: 'POST',
    body: {
      model_key: 'sys_ext_llm',
      reason: 'consume_script',
      quantity: 1,
    },
  })
  if (res.json?.code === 0) {
    report.fail('T7-api-no-auth', 'T7', 'api', '未登录不应 consume 成功')
  } else {
    report.pass('T7-api-no-auth', 'T7', 'api', `未登录 blocked code=${res.json?.code ?? res.status}`)
  }
}

async function main() {
  console.log(`\n=== Phase 5.2 billing scenarios @ ${apiBase} ===\n`)

  const external = await registerProbeUser(api, 'probe_sc_ext')
  console.log(`external user: ${external.username} (is_internal=${Boolean(external.user?.is_internal)})`)

  const models = await fetchModels(api, external.token)
  console.log(`catalog models: ${models.length}\n`)

  await runConfigAudit(models)
  await runContractScenarios(external.token, models)
  await runT7Unauthenticated()

  const externalLlm = pickExternalBillableModel(models, 'llm') ?? pickExternalBillableModel(models)
  await runHaodouScenario({
    id: 'T1-api-consume',
    matrix: 'T1',
    token: external.token,
    billable: externalLlm,
    userLabel: '外部用户',
  })

  if (internalToken) {
    const internalBillable =
      pickExternalBillableModel(await fetchModels(api, internalToken), 'llm') ?? externalLlm
    await runHaodouScenario({
      id: 'T2-api-consume',
      matrix: 'T2',
      token: internalToken,
      billable: internalBillable,
      userLabel: '内部用户',
    })

    const externalImage = pickExternalBillableModel(await fetchModels(api, internalToken), 'image')
    if (!externalImage) {
      report.skip('T8-api-consume-image', 'T8', 'api', '无 external 生图模型')
    } else {
      const imageRes = await consumeHaodou(api, internalToken, {
        modelKey: externalImage.model_key,
        reason: 'consume_image',
        quantity: 1,
      })
      if (imageRes.json?.code !== 0) {
        report.fail('T8-api-consume-image', 'T8', 'api', `consume_image failed: ${JSON.stringify(imageRes.json)}`)
      } else {
        const consumed = Number(imageRes.json.data?.consumed ?? 0)
        if (shouldRefund && consumed > 0) {
          await refundHaodou(api, internalToken, consumed)
        }
        report.pass(
          'T8-api-consume-image',
          'T8',
          'api',
          `${externalImage.model_key} consume_image consumed=${consumed}`,
        )
      }
    }
  } else {
    report.skip('T2-api-consume', 'T2', 'api', '需 PROBE_INTERNAL_TOKEN')
    report.skip('T8-api-consume-image', 'T8', 'api', '需 PROBE_INTERNAL_TOKEN')
  }

  await runProjectScenarios(models, external.token)

  report.delegate('T6-client-openai', 'T6', '自定义 OpenAI 无 billing API → npm run smoke:billing:calls')
  report.delegate('T6b-client-no-org', 'T6b', '无 orgProjectId 不上报 → npm run smoke:billing:calls')
  report.delegate('T1-T8-http-order', 'T1–T8', 'npm run smoke:billing:calls 验证 consume 在 proxy 之前')

  report.finalizeExit(apiBase)
  maybePrintJsonReport(report)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
