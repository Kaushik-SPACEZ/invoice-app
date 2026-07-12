import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  sidebarCollapsed: boolean
  darkMode: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleDarkMode: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: typeof window !== 'undefined' && window.innerWidth < 1024,
      darkMode: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      toggleDarkMode: () =>
        set((s) => {
          const next = !s.darkMode
          document.documentElement.classList.toggle('dark', next)
          document.documentElement.classList.toggle('light', !next)
          return { darkMode: next }
        }),
    }),
    { name: 'ui-storage' }
  )
)
