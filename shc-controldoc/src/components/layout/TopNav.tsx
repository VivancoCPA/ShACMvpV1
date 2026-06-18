import { useState, useRef } from 'react'
import { useMatches } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, Sun, Moon, Monitor, ChevronDown } from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { usePreferencesStore } from '../../stores/preferencesStore'
import { useAuthStore } from '../../stores/authStore'
import { useLogout } from '../../features/auth/hooks/useLogout'
import { UserAvatar } from '../ui/UserAvatar'
import { ROLE_BG_CLASSES } from '../ui/roleColors'

interface RouteHandle {
  breadcrumb?: string
}

export function TopNav() {
  const { t, i18n } = useTranslation('nav')
  const { t: tAuth } = useTranslation('auth')
  const { theme, setTheme, toggleSidebar } = useUIStore()
  const { language, setLanguage } = usePreferencesStore()
  const user = useAuthStore((s) => s.user)
  const { mutate: logout } = useLogout()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const matches = useMatches()
  const breadcrumbs = matches
    .filter((m) => (m.handle as RouteHandle)?.breadcrumb)
    .map((m) => (m.handle as RouteHandle).breadcrumb as string)

  const toggleTheme = () => {
    if (theme === 'light') setTheme('dark')
    else if (theme === 'dark') setTheme('system')
    else setTheme('light')
  }

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor

  const handleLanguageToggle = () => {
    const newLang = language === 'es-PE' ? 'en-US' : 'es-PE'
    setLanguage(newLang)
    void i18n.changeLanguage(newLang)
  }

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-hairline bg-canvas px-4 dark:border-hairline/20 dark:bg-surface-dark">
      {/* Left: hamburger + breadcrumb */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          aria-label="Abrir menú de navegación"
          className="rounded-md p-1.5 text-muted hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-elevated dark:hover:text-on-dark md:hidden"
        >
          <Menu size={18} />
        </button>

        <nav aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 text-sm text-muted dark:text-on-dark-soft">
            {breadcrumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                <span className={i === breadcrumbs.length - 1 ? 'text-ink dark:text-on-dark' : ''}>
                  {t(crumb, { defaultValue: crumb })}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Right: controls */}
      <div className="flex items-center gap-2">
        {/* Language toggle */}
        <button
          onClick={handleLanguageToggle}
          aria-label={t('toggleLanguage')}
          className="rounded-md px-2 py-1 text-xs font-medium text-muted hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-elevated dark:hover:text-on-dark"
        >
          {language === 'es-PE' ? 'ES' : 'EN'}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={t('toggleTheme')}
          className="rounded-md p-1.5 text-muted hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-elevated dark:hover:text-on-dark"
        >
          <ThemeIcon size={17} />
        </button>

        {/* User block */}
        {user && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-hairline dark:hover:bg-surface-dark-elevated"
            >
              <UserAvatar user={user} size="sm" />
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-sm font-medium leading-none text-ink dark:text-on-dark">
                  {user.nombre} {user.apellido}
                </span>
                <span
                  className={`mt-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium ${ROLE_BG_CLASSES[user.rol]}`}
                >
                  {tAuth(`roles.${user.rol}`)}
                </span>
              </div>
              <ChevronDown size={14} className="text-muted" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-hairline bg-canvas shadow-lg dark:border-hairline/20 dark:bg-surface-dark-elevated">
                <button
                  className="w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-hairline dark:text-on-dark dark:hover:bg-surface-dark-soft"
                  onClick={() => setDropdownOpen(false)}
                >
                  {t('myProfile')}
                </button>
                <hr className="border-hairline dark:border-hairline/20" />
                <button
                  className="w-full px-4 py-2.5 text-left text-sm text-error hover:bg-hairline dark:hover:bg-surface-dark-soft"
                  onClick={() => {
                    setDropdownOpen(false)
                    logout()
                  }}
                >
                  {t('logout')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
