// Copyright (c) 2025 好的AI. All rights reserved.

import { resolveApiBase } from '@/lib/auth/api-base'
import { noteClientSessionFailure } from '@/lib/auth/session-expired'
import type { FeedbackDiagnostics, FeedbackType } from '@/lib/feedback/feedback-diagnostics'
import type { ApiEnvelope } from '@/types/auth'

const FETCH_TIMEOUT_MS = 15000

export type SubmitFeedbackResult = {
  id: string
  status: string
}

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    window.clearTimeout(timer)
  }
}

function buildUrl(path: string, apiBase?: string): string {
  const base = resolveApiBase(apiBase)
  return base.startsWith('/')
    ? `${base}${path}`
    : `${base.replace(/\/+$/, '')}${path}`
}

export async function submitClientFeedback(params: {
  token: string
  feedbackType: FeedbackType
  content: string
  diagnostics: FeedbackDiagnostics
  imageUrls?: string[]
  apiBase?: string
}): Promise<SubmitFeedbackResult> {
  const url = buildUrl('/client/feedback', params.apiBase)
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.token}`,
    },
    body: JSON.stringify({
      feedback_type: params.feedbackType,
      content: params.content.trim(),
      app_version: params.diagnostics.appVersion,
      diagnostics: params.diagnostics,
      image_urls: params.imageUrls ?? [],
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    noteClientSessionFailure(res.status, text)
    throw new Error(`提交失败 ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }

  const body = (await res.json()) as ApiEnvelope<SubmitFeedbackResult>
  if (body.code !== 0 && body.code !== undefined) {
    noteClientSessionFailure(res.status, body.message, body.code)
    throw new Error(body.message || `提交失败（${body.code}）`)
  }
  if (!body.data?.id) {
    throw new Error('提交失败：未返回工单编号')
  }
  return body.data
}
