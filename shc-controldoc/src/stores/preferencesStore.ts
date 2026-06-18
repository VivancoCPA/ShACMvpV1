import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Language = 'es-PE' | 'en-US'

interface PreferencesState {
  language: Language
  dateFormat: string
}

interface PreferencesActions {
  setLanguage(lang: Language): void
  setDateFormat(format: string): void
}

export const usePreferencesStore = create<PreferencesState & PreferencesActions>()(
  persist(
    (set) => ({
      language: 'es-PE',
      dateFormat: 'dd/MM/yyyy',

      setLanguage: (language: Language) => set({ language }),
      setDateFormat: (dateFormat: string) => set({ dateFormat }),
    }),
    { name: 'shac-preferences' }
  )
)
