import { create } from 'zustand'
import { isRemoteVersionNewer } from '@/lib/update/app-updater'

interface UpdateStore {
  currentVersion: string
  nextVersion: string | null
  updateAvailable: boolean
  setUpdateAvailability: (payload: {
    currentVersion: string
    nextVersion?: string | null
  }) => void
}

export const useUpdateStore = create<UpdateStore>((set) => ({
  currentVersion: '',
  nextVersion: null,
  updateAvailable: false,
  setUpdateAvailability: ({ currentVersion, nextVersion }) => {
    const next = nextVersion?.trim() || null
    const available = Boolean(next && isRemoteVersionNewer(next, currentVersion))
    set({
      currentVersion,
      nextVersion: available ? next : null,
      updateAvailable: available,
    })
  },
}))
