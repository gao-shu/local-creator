// Copyright (c) local-creator contributors. All rights reserved.

import type { ParsedStoryboardItem } from '@/lib/workflow/storyboard-prompt'

/** 走 Seedance 四段时间轴 QA 的模板 key */
export const SEEDANCE_TIMELINE_TEMPLATE_KEYS = new Set([
  'seedance-15s',
  'seedance-15s-standard',
  'seedance-10s',
])

export type StoryboardFormatIssueType =
  | 'timecode_count'
  | 'timecode_start'
  | 'timecode_end'
  | 'missing_sfx'
  | 'missing_anchor'
  | 'banned_phrase'

export interface StoryboardFormatIssue {
  shotNumber: number
  type: StoryboardFormatIssueType
  problem: string
  /** 1-based 子镜头序号（四段中的第几段） */
  segmentIndex?: number
}

export interface StoryboardFormatQaResult {
  passed: boolean
  issues: StoryboardFormatIssue[]
  templateKey: string
  checkedCount: number
  /** 非 Seedance 时间轴模板时跳过检查 */
  skipped?: boolean
}

interface SeedanceTimelineSpec {
  segmentCount: number
  expectedStart: string
  expectedEnd: string
}

const SEEDANCE_15S_SPEC: SeedanceTimelineSpec = {
  segmentCount: 4,
  expectedStart: '00:00',
  expectedEnd: '00:15',
}

const SEEDANCE_10S_SPEC: SeedanceTimelineSpec = {
  segmentCount: 4,
  expectedStart: '00:00',
  expectedEnd: '00:10',
}

/** 不可拍虚写禁词（与 seedance-15s-standard 模板一致） */
export const STORYBOARD_BANNED_UNSHOOTABLE_PHRASES = [
  '内心独白浮现',
  '字幕弹出',
  '画面切换至回忆',
  '蒙太奇快切',
  '分屏对比',
  '文字说明浮层',
  '思想气泡',
  'UI 弹窗',
  '镜头外旁白框',
] as const

const TIMECODE_PAIR_RE = /(\d{2}:\d{2})\s*[-–—]\s*(\d{2}:\d{2})/g
const SFX_FIELD_RE = /音效\s*(?:[&＆]\s*BGM)?\s*[:：]/i
const ANCHOR_RE = /衔接锚点\s*[:：]/i

export function shouldRunStoryboardFormatQa(templateKey: string | undefined): boolean {
  if (!templateKey?.trim()) return false
  return SEEDANCE_TIMELINE_TEMPLATE_KEYS.has(templateKey.trim())
}

function resolveSeedanceTimelineSpec(templateKey: string): SeedanceTimelineSpec | null {
  const key = templateKey.trim()
  if (key === 'seedance-10s') return SEEDANCE_10S_SPEC
  if (key === 'seedance-15s' || key === 'seedance-15s-standard') return SEEDANCE_15S_SPEC
  return null
}

interface PromptSegment {
  range: string
  start: string
  end: string
  body: string
}

function splitPromptByTimecodes(prompt: string): PromptSegment[] {
  const markers: Array<{ index: number; range: string; start: string; end: string }> = []
  TIMECODE_PAIR_RE.lastIndex = 0
  let match = TIMECODE_PAIR_RE.exec(prompt)
  while (match) {
    markers.push({
      index: match.index,
      range: `${match[1]}-${match[2]}`,
      start: match[1],
      end: match[2],
    })
    match = TIMECODE_PAIR_RE.exec(prompt)
  }

  return markers.map((marker, index) => {
    const nextIndex = index + 1 < markers.length ? markers[index + 1].index : prompt.length
    return {
      range: marker.range,
      start: marker.start,
      end: marker.end,
      body: prompt.slice(marker.index, nextIndex),
    }
  })
}

function findBannedPhrases(prompt: string): string[] {
  const hits: string[] = []
  for (const phrase of STORYBOARD_BANNED_UNSHOOTABLE_PHRASES) {
    if (prompt.includes(phrase)) hits.push(phrase)
  }
  return hits
}

/** 单条分镜 prompt 的 Seedance 四段格式 QA */
export function validateStoryboardPromptFormat(
  shotNumber: number,
  prompt: string,
  templateKey: string,
): StoryboardFormatIssue[] {
  const spec = resolveSeedanceTimelineSpec(templateKey)
  if (!spec) return []

  const issues: StoryboardFormatIssue[] = []
  const trimmed = prompt.trim()
  if (!trimmed) {
    issues.push({
      shotNumber,
      type: 'timecode_count',
      problem: 'prompt 为空',
    })
    return issues
  }

  const segments = splitPromptByTimecodes(trimmed)
  if (segments.length !== spec.segmentCount) {
    issues.push({
      shotNumber,
      type: 'timecode_count',
      problem: `时间轴段数应为 ${spec.segmentCount}，实际为 ${segments.length}`,
    })
  }

  if (segments.length > 0) {
    if (segments[0].start !== spec.expectedStart) {
      issues.push({
        shotNumber,
        type: 'timecode_start',
        problem: `首段应从 ${spec.expectedStart} 开始，实际为 ${segments[0].start}`,
        segmentIndex: 1,
      })
    }
    const last = segments[segments.length - 1]
    if (last.end !== spec.expectedEnd) {
      issues.push({
        shotNumber,
        type: 'timecode_end',
        problem: `末段应结束于 ${spec.expectedEnd}，实际为 ${last.end}`,
        segmentIndex: segments.length,
      })
    }
  }

  segments.forEach((segment, index) => {
    if (!SFX_FIELD_RE.test(segment.body)) {
      issues.push({
        shotNumber,
        type: 'missing_sfx',
        problem: `第 ${index + 1} 段缺少「音效&BGM：」或「音效：」`,
        segmentIndex: index + 1,
      })
    }
  })

  if (segments.length > 0) {
    const lastBody = segments[segments.length - 1].body
    if (!ANCHOR_RE.test(lastBody)) {
      issues.push({
        shotNumber,
        type: 'missing_anchor',
        problem: '末段缺少「衔接锚点：」',
        segmentIndex: segments.length,
      })
    }
  }

  for (const phrase of findBannedPhrases(trimmed)) {
    issues.push({
      shotNumber,
      type: 'banned_phrase',
      problem: `含不可拍虚写：${phrase}`,
    })
  }

  return issues
}

/** 批量 QA：仅对 Seedance 时间轴模板生效 */
export function validateStoryboardFormat(
  items: ParsedStoryboardItem[],
  templateKey: string,
): StoryboardFormatQaResult {
  const key = templateKey.trim()
  if (!shouldRunStoryboardFormatQa(key)) {
    return {
      passed: true,
      issues: [],
      templateKey: key,
      checkedCount: 0,
      skipped: true,
    }
  }

  const issues: StoryboardFormatIssue[] = []
  for (const item of items) {
    issues.push(...validateStoryboardPromptFormat(item.shotNumber, item.prompt, key))
  }

  return {
    passed: issues.length === 0,
    issues,
    templateKey: key,
    checkedCount: items.length,
  }
}

/** 供 Step4 toast 使用的简短摘要（Step 4 接入时可直接调用） */
export function summarizeStoryboardFormatIssues(
  issues: StoryboardFormatIssue[],
  maxLines = 5,
): string {
  if (issues.length === 0) return ''
  const lines = issues.slice(0, maxLines).map((issue) => {
    const seg =
      issue.segmentIndex != null ? ` 第${issue.segmentIndex}段` : ''
    return `镜 ${issue.shotNumber}${seg}：${issue.problem}`
  })
  const tail =
    issues.length > maxLines ? `\n…另有 ${issues.length - maxLines} 项` : ''
  return `分镜格式 QA 未通过（${issues.length} 项）：\n${lines.join('\n')}${tail}`
}

/** 推理落盘后需 toast.warning 时返回文案；通过或跳过时返回 undefined */
export function getStoryboardFormatQaWarningMessage(
  qa?: StoryboardFormatQaResult,
): string | undefined {
  if (!qa || qa.skipped || qa.passed) return undefined
  const summary = summarizeStoryboardFormatIssues(qa.issues)
  return summary || undefined
}
