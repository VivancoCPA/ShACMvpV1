import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import esPE from './es-PE.json'
import enUS from './en-US.json'
import { usePreferencesStore } from '../stores/preferencesStore'

const persistedLang = usePreferencesStore.getState().language ?? 'es-PE'

export const i18nReady = i18n.use(initReactI18next).init({
  lng: persistedLang,
  fallbackLng: 'es-PE',
  ns: ['common', 'auth', 'nav', 'documents', 'qualityEvents', 'incidents', 'nonconformities', 'dashboard', 'locations'],
  defaultNS: 'common',
  resources: {
    'es-PE': esPE,
    'en-US': enUS,
  },
  interpolation: {
    escapeValue: false,
  },
})

// Keep <html lang> in sync with the active language so <input type="date">
// renders the correct regional format (Chrome uses the document lang attribute).
i18n.on('languageChanged', (lang) => {
  document.documentElement.lang = lang
})

export default i18n
