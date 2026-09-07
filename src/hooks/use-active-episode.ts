import { useCallback, useMemo } from 'react'
import {
  resolveActiveEpisode,
  resolveActiveEpisodeId,
} from '@/lib/workflow/episode-utils'
import { useWorkflowSessionStore } from '@/stores/workflow-session-store'
import type { WorkflowEpisode } from '@/types/workflow'

/** 跨 Step2/3/4 共享当前分集选择，持久化在 project data.activeEpisodeId */
export function useActiveEpisode() {
  const data = useWorkflowSessionStore((s) => s.data)
  const patchData = useWorkflowSessionStore((s) => s.patchData)

  const episodes = data?.episodes ?? []

  const activeEpisodeId = useMemo(
    () => resolveActiveEpisodeId(episodes, data?.activeEpisodeId),
    [episodes, data?.activeEpisodeId],
  )

  const activeEpisode = useMemo(
    () => resolveActiveEpisode(episodes, data?.activeEpisodeId),
    [episodes, data?.activeEpisodeId],
  )

  const setActiveEpisodeId = useCallback(
    (episodeId: string) => {
      if (!episodes.some((ep) => ep.id === episodeId)) return
      if (data?.activeEpisodeId === episodeId) return
      patchData({ activeEpisodeId: episodeId })
    },
    [data?.activeEpisodeId, episodes, patchData],
  )

  return {
    episodes,
    activeEpisodeId,
    activeEpisode,
    setActiveEpisodeId,
  } satisfies {
    episodes: WorkflowEpisode[]
    activeEpisodeId: string | null
    activeEpisode: WorkflowEpisode | null
    setActiveEpisodeId: (episodeId: string) => void
  }
}
