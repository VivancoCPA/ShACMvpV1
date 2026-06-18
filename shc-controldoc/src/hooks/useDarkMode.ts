import { useUIStore } from '../stores/uiStore'

export function useDarkMode() {
  const theme = useUIStore((s) => s.theme)
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', isDark)
}
