import { create } from 'zustand'
import {
  countActiveTasks,
  listAllUnifiedTasks,
  type UnifiedTaskEntry,
} from '@/lib/workflow/task-service'
import { isActiveTaskStatus } from '@/lib/workflow/task-service'

const POLL_MS = 3000

interface TaskStore {
  entries: UnifiedTaskEntry[]
  loading: boolean
  activeCount: number
  pollTimer: number | null
  refresh: () => Promise<void>
  startPolling: () => void
  stopPolling: () => void
}

function countUnifiedActiveTasks(entries: UnifiedTaskEntry[]): number {
  return entries.filter((entry) => isActiveTaskStatus(entry.task.status)).length
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  entries: [],
  loading: false,
  activeCount: 0,
  pollTimer: null,

  refresh: async () => {
    set({ loading: true })
    try {
      const entries = await listAllUnifiedTasks()
      set({ entries, activeCount: countUnifiedActiveTasks(entries) })
    } catch {
      set({ entries: [], activeCount: 0 })
    } finally {
      set({ loading: false })
    }
  },

  startPolling: () => {
    const { pollTimer, refresh } = get()
    if (pollTimer != null) return
    void refresh()
    const timer = window.setInterval(() => {
      void refresh()
    }, POLL_MS)
    set({ pollTimer: timer })
  },

  stopPolling: () => {
    const { pollTimer } = get()
    if (pollTimer != null) {
      window.clearInterval(pollTimer)
      set({ pollTimer: null })
    }
  },
}))
