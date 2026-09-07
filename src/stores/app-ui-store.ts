import { create } from 'zustand'

interface AppUiStore {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppUiStore = create<AppUiStore>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
