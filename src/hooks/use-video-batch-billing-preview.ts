// Copyright (c) Haode AI. All rights reserved.

import { useEffect, useState } from 'react'
import {
  buildVideoBatchBillingLines,
  estimateVideoBatchBillingAsync,
  resolveVideoBatchBarPreview,
  type VideoBatchBarPreview,
  type VideoBatchBillingLine,
} from '@/lib/auth/billing-display'
import type { ModelConfig } from '@/types/settings'

export function useVideoBatchBillingPreview(options: {
  videoModel: ModelConfig | null | undefined
  shotCount: number
  durationSec?: number
  resolution?: string | null
  apiBase?: string
  enabled?: boolean
}): {
  lines: VideoBatchBillingLine[]
  barPreview: VideoBatchBarPreview | null
  loading: boolean
} {
  const enabled = options.enabled !== false
  const shotCount = options.shotCount
  const durationSec = options.durationSec
  const resolution = options.resolution
  const videoModel = options.videoModel

  const [lines, setLines] = useState<VideoBatchBillingLine[]>([])
  const [barPreview, setBarPreview] = useState<VideoBatchBarPreview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || shotCount <= 0) {
      setLines([])
      setBarPreview(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    void estimateVideoBatchBillingAsync({
      videoModel,
      shotCount,
      durationSec,
      resolution,
      apiBase: options.apiBase,
    })
      .then((estimate) => {
        if (cancelled) return
        setLines(buildVideoBatchBillingLines(estimate))
        setBarPreview(resolveVideoBatchBarPreview(estimate))
      })
      .catch(() => {
        if (!cancelled) {
          setLines([])
          setBarPreview(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    enabled,
    videoModel?.id,
    videoModel?.modelKey,
    videoModel?.videoPricing?.pricingMode,
    shotCount,
    durationSec,
    resolution,
    options.apiBase,
  ])

  return { lines, barPreview, loading }
}
