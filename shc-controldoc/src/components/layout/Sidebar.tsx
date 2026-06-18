import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  AlertCircle,
  ShieldAlert,
  ClipboardList,
  BarChart2,
  Users,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { UserAvatar } from '../ui/UserAvatar'
import type { UserRole } from '../../types/auth.types'

interface NavItem {
  key: string
  path: string
  icon: React.ElementType
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  { key: 'documents', path: '/documentos', icon: FileText },
  {
    key: 'nonconformities',
    path: '/no-conformidades',
    icon: AlertCircle,
    roles: ['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  { key: 'incidents', path: '/incidentes', icon: ShieldAlert },
  {
    key: 'qualityEvents',
    path: '/quality-events',
    icon: ClipboardList,
    roles: ['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  {
    key: 'dashboard',
    path: '/dashboard',
    icon: BarChart2,
    roles: ['JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  {
    key: 'users',
    path: '/usuarios',
    icon: Users,
    roles: ['JEFE_CALIDAD_SYST', 'ALTA_DIRECCION'],
  },
]

export function Sidebar() {
  const { t } = useTranslation('nav')
  const { t: tAuth } = useTranslation('auth')
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const user = useAuthStore((s) => s.user)

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || (user?.rol && item.roles.includes(user.rol)),
  )

  return (
    <aside
      className={`flex flex-shrink-0 flex-col border-r border-hairline bg-surface-card transition-all duration-200 dark:border-hairline/20 dark:bg-surface-dark-elevated ${
        sidebarOpen ? 'w-60' : 'w-16'
      }`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-4">
        {sidebarOpen && (
          <span className="text-lg font-semibold tracking-widest text-coral">SHAC</span>
        )}
        <button
          onClick={toggleSidebar}
          aria-label={sidebarOpen ? 'Colapsar sidebar' : 'Expandir sidebar'}
          className={`ml-auto rounded-md p-1.5 text-muted transition-colors hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-soft dark:hover:text-on-dark ${
            !sidebarOpen ? 'mx-auto' : ''
          }`}
        >
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Navegación principal">
        {visibleItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.key}
              to={item.path}
              title={!sidebarOpen ? t(item.key) : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-l-2 border-coral bg-coral/10 text-coral'
                    : 'border-l-2 border-transparent text-muted hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-soft dark:hover:text-on-dark'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              {sidebarOpen && <span>{t(item.key)}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      {sidebarOpen && user && (
        <div className="border-t border-hairline p-4 dark:border-hairline/20">
          <div className="flex items-center gap-3">
            <UserAvatar user={user} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink dark:text-on-dark">
                {user.nombre} {user.apellido}
              </p>
              <p className="truncate text-xs text-muted dark:text-on-dark-soft">
                {tAuth(`roles.${user.rol}`)}
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
