// Copyright (c) local-creator contributors. All rights reserved.

/**
 * Phase 3.5：同一剧本 5 镜「增强前 / 增强后」prompt 规模与分批预算对比。
 * 效果类结论需真模型手测；本模块给出可复现的 token/费用代理指标。
 */

import {
  STORYBOARD_VALIDATE_BATCH_SIZE,
  STORYBOARD_VALIDATE_CONTEXT_LOOKBACK,
  buildValidatePrompt,
  chunkShotsForValidate,
  type ValidatePromptShotInput,
} from './storyboard-prompt'

/** 覆盖：群戏人数、门开着残留、坐姿延续 */
export const CONTINUITY_EVAL_5_SHOTS: ValidatePromptShotInput[] = [
  {
    shotNumber: 1,
    dialogue: '教室全景',
    prompt:
      '远景，平视。教室里约二十名学生安静上课，@老师 站在黑板前，左侧门关着，高清写实',
  },
  {
    shotNumber: 2,
    dialogue: '老师走向门口',
    prompt:
      '中景。@老师 走到教室左侧门前推开门后站定，门保持开着，课桌间学生们仍坐着，没有离开教室',
  },
  {
    shotNumber: 3,
    dialogue: '门外走廊',
    prompt: '中景。走廊一侧，@老师 站在敞开的教室门旁侧身张望，门框内可见教室内坐着的若干学生',
  },
  {
    shotNumber: 4,
    dialogue: '课桌特写',
    prompt: '近景。两名学生仍坐在课桌前低头写字，姿势未起身，背景虚化可见敞开的门与走廊光',
  },
  {
    shotNumber: 5,
    dialogue: '操场跳切',
    prompt: '远景，室外操场。@老师 独自站在跑道边，阳光刺眼，与教室无直接空间连续',
  },
]

/** 增强前（Phase 3 以前）轻量 prompt，仅作对比基线，产品路径不再调用 */
export function buildBaselineValidatePrompt(shots: ValidatePromptShotInput[]): string {
  const list = shots
    .map((s) => `镜号 ${s.shotNumber} | 标题：${s.dialogue}\nPrompt：${s.prompt}`)
    .join('\n\n')
  return `你是分镜审核导演。请为下方每个镜头补充「全局空间锚点」（场景方位、人物站位、光线方向，一句话），并轻微润色 prompt 保证镜头间空间连贯。

只返回 JSON，格式：
{"shots":[{"shot_number":1,"spatial_anchor":"...","prompt":"润色后的完整 prompt"}]}

分镜列表：
${list}`
}

/** 中英混排粗估：按字符数 / 2（偏中文场景，略保守） */
export function estimatePromptTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 2))
}

export type ValidatePromptCompareRow = {
  label: string
  chars: number
  estTokens: number
  batchCount: number
  /** 相对基线的费用代理（仅比输入规模） */
  costIndex: number
}

export type ValidatePromptCompareReport = {
  shotCount: number
  batchSize: number
  lookback: number
  rows: ValidatePromptCompareRow[]
  checklist: Array<{ id: string; coveredInEnhanced: boolean; note: string }>
  notes: string[]
}

function measurePrompt(label: string, text: string, batchCount: number, baselineTokens: number): ValidatePromptCompareRow {
  const estTokens = estimatePromptTokens(text)
  return {
    label,
    chars: text.length,
    estTokens,
    batchCount,
    costIndex: Number((estTokens / Math.max(1, baselineTokens)).toFixed(2)),
  }
}

/** 深度档对比用的示意原文（教室戏，含门开着/群戏） */
export const CONTINUITY_EVAL_SCRIPT = `教室内，二十来名学生正在上课。老师擦完黑板后走向左侧侧门，把门推开，门口光线洒进来。老师在门边朝走廊张望两秒，教室里学生仍坐在原位写字。随后画面切到室外操场，老师独自站在跑道边。`

function sumBatchedPromptSize(
  shots: ValidatePromptShotInput[],
  batchSize: number,
  lookback: number,
  mode: 'quick' | 'deep',
  scriptSummary?: string,
): { chars: number; estTokens: number; batchCount: number } {
  const batches = chunkShotsForValidate(shots, batchSize)
  let chars = 0
  let estTokens = 0
  let offset = 0
  for (const batch of batches) {
    const start = offset
    offset += batch.length
    const contextShots =
      lookback > 0 && start > 0 ? shots.slice(Math.max(0, start - lookback), start) : []
    const prompt = buildValidatePrompt(batch, {
      contextShots,
      mode,
      scriptSummary: mode === 'deep' ? scriptSummary : undefined,
    })
    chars += prompt.length
    estTokens += estimatePromptTokens(prompt)
  }
  return { chars, estTokens, batchCount: batches.length }
}

/**
 * 对比：旧基线 / Phase4 快速 / Phase4 深度（含原文摘要）的输入规模。
 */
export function compareValidatePromptBudget(
  shots: ValidatePromptShotInput[] = CONTINUITY_EVAL_5_SHOTS,
  options?: { batchSize?: number; lookback?: number; scriptSummary?: string },
): ValidatePromptCompareReport {
  const batchSize = options?.batchSize ?? STORYBOARD_VALIDATE_BATCH_SIZE
  const lookback = options?.lookback ?? STORYBOARD_VALIDATE_CONTEXT_LOOKBACK
  const scriptSummary = options?.scriptSummary ?? CONTINUITY_EVAL_SCRIPT

  const baseline = buildBaselineValidatePrompt(shots)
  const baselineTokens = estimatePromptTokens(baseline)

  const quick = sumBatchedPromptSize(shots, batchSize, lookback, 'quick')
  const deep = sumBatchedPromptSize(shots, batchSize, lookback, 'deep', scriptSummary)
  const deepPromptSample = buildValidatePrompt(shots, {
    mode: 'deep',
    scriptSummary,
  })

  const rows: ValidatePromptCompareRow[] = [
    measurePrompt('旧基线（润色 prompt）', baseline, 1, baselineTokens),
    {
      label: quick.batchCount > 1 ? `快速补锚点（${quick.batchCount} 批）` : '快速补锚点',
      chars: quick.chars,
      estTokens: quick.estTokens,
      batchCount: quick.batchCount,
      costIndex: Number((quick.estTokens / Math.max(1, baselineTokens)).toFixed(2)),
    },
    {
      label: deep.batchCount > 1 ? `深度连续性审查（${deep.batchCount} 批）` : '深度连续性审查',
      chars: deep.chars,
      estTokens: deep.estTokens,
      batchCount: deep.batchCount,
      costIndex: Number((deep.estTokens / Math.max(1, baselineTokens)).toFixed(2)),
    },
  ]

  const checklist = [
    {
      id: 'crowd',
      coveredInEnhanced: deepPromptSample.includes('人群继承'),
      note: '深度档：人群继承硬规则',
    },
    {
      id: 'pose',
      coveredInEnhanced: deepPromptSample.includes('姿势继承'),
      note: '深度档：姿势继承硬规则',
    },
    {
      id: 'door',
      coveredInEnhanced:
        deepPromptSample.includes('道具残留') || deepPromptSample.includes('门开着'),
      note: '深度档：同场道具残留',
    },
    {
      id: 'jumpcut',
      coveredInEnhanced: deepPromptSample.includes('场景跳切'),
      note: '深度档：跳切可重置',
    },
    {
      id: 'script-summary',
      coveredInEnhanced: deepPromptSample.includes('原文摘要'),
      note: '深度档注入截断原文摘要（非画镜全文）',
    },
    {
      id: 'quick-light',
      coveredInEnhanced: !buildValidatePrompt(shots, { mode: 'quick' }).includes('人群继承'),
      note: '快速档不含硬规则块，控成本',
    },
  ]

  const notes = [
    '费用代理仅按输入 prompt 估算 token；costIndex 以「旧基线」为 1.00。',
    `默认：内部账号 → 深度；外部账号 → 快速。可在 Step4 设置「补空间锚点」覆盖。`,
    `分批阈值 ${batchSize}、lookback ${lookback}；本样本 ${shots.length} 镜。`,
    '真模型手测：深度档查镜2门开着、镜4仍坐、镜5勿误继承教室人群。',
  ]

  return {
    shotCount: shots.length,
    batchSize,
    lookback,
    rows,
    checklist,
    notes,
  }
}

export function formatValidatePromptCompareReport(report: ValidatePromptCompareReport): string {
  const lines: string[] = [
    `## 空间锚点 Prompt 预算对比（${report.shotCount} 镜）`,
    '',
    '| 版本 | 字符 | 估 token | 批次数 | 费用指数 |',
    '|---|---:|---:|---:|---:|',
    ...report.rows.map(
      (row) =>
        `| ${row.label} | ${row.chars} | ${row.estTokens} | ${row.batchCount} | ${row.costIndex}× |`,
    ),
    '',
    '### 规则覆盖（相对增强前）',
    ...report.checklist.map(
      (item) => `- [${item.coveredInEnhanced ? 'x' : ' '}] ${item.id}: ${item.note}`,
    ),
    '',
    '### 说明',
    ...report.notes.map((n) => `- ${n}`),
  ]
  return lines.join('\n')
}
