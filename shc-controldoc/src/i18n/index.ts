import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import esPE from './es-PE.json'
import enUS from './en-US.json'
import { usePreferencesStore } from '../stores/preferencesStore'

const persistedLang = usePreferencesStore.getState().language ?? 'es-PE'

void i18n.use(initReactI18next).init({
  lng: persistedLang,
  fallbackLng: 'es-PE',
  ns: ['common', 'auth', 'nav', 'documents', 'qualityEvents', 'incidents', 'nonconformities', 'dashboard'],
  defaultNS: 'common',
  resources: {
    'es-PE': esPE,
    'en-US': enUS,
  },
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
