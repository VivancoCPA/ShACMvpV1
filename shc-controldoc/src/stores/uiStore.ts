import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  sidebarOpen: boolean
  theme: Theme
}

interface UIActions {
  toggleSidebar(): void
  setTheme(theme: Theme): void
}

function applyThemeClass(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}

export const useUIStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      sidebarOpen: false,
      theme: 'system' as Theme,

      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setTheme: (theme: Theme) => {
        applyThemeClass(theme)
        set({ theme })
      },
    }),
    {
      name: 'shac-theme',
      partialize: (state) => ({ theme: state.theme }),
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme)
      },
    }
  )
)

// Apply on initial load (before hydration)
applyThemeClass(
  (localStorage.getItem('shac-theme')
    ? (JSON.parse(localStorage.getItem('shac-theme')!).state?.theme ?? 'system')
    : 'system') as Theme
)
