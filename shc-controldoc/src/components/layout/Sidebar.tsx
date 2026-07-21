import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  FileText,
  ClipboardX,
  ShieldAlert,
  ClipboardList,
  BarChart2,
  Users,
  MapPin,
  Building2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useUIStore } from '../../stores/uiStore'
import { useAuthStore } from '../../stores/authStore'
import { useDocumentosPendientesCount } from '../../features/documents/hooks/useDocumentosPendientesCount'
import { UserAvatar } from '../ui/UserAvatar'
import type { UserRole } from '../../types/auth.types'

const PENDIENTES_BADGE_ROLES = new Set<UserRole>(['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO'])

interface NavItem {
  key: string
  path: string
  icon: React.ElementType
  roles?: UserRole[]
}

const NAV_ITEMS: NavItem[] = [
  {
    key: 'documents',
    path: '/documentos',
    icon: FileText,
    roles: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  {
    key: 'nonconformities',
    path: '/nonconformities',
    icon: ClipboardX,
    roles: ['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  {
    key: 'incidents',
    path: '/incidents',
    icon: ShieldAlert,
    roles: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  {
    key: 'qualityEvents',
    path: '/quality-events',
    icon: ClipboardList,
    roles: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  {
    key: 'dashboard',
    path: '/dashboard',
    icon: BarChart2,
    roles: ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO', 'AUDITOR_INTERNO', 'ALTA_DIRECCION'],
  },
  {
    key: 'users',
    path: '/usuarios',
    icon: Users,
    roles: ['ADMINISTRADOR_SISTEMA'],
  },
  {
    key: 'areas',
    path: '/admin/areas',
    icon: Building2,
    roles: ['ADMINISTRADOR_SISTEMA'],
  },
  {
    key: 'locations',
    path: '/admin/locales',
    icon: MapPin,
    roles: ['ADMINISTRADOR_SISTEMA', 'JEFE_CALIDAD_SYST'],
  },
]

export function Sidebar() {
  const { t } = useTranslation('nav')
  const { t: tAuth } = useTranslation('auth')
  const { t: tDocs } = useTranslation('documents')
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const user = useAuthStore((s) => s.user)

  const showBadge = user?.rol !== undefined && PENDIENTES_BADGE_ROLES.has(user.rol)
  const { data: pendientesData } = useDocumentosPendientesCount()
  const pendientesCount = showBadge ? (pendientesData?.count ?? 0) : 0

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
              title={
                !sidebarOpen
                  ? item.key === 'documents' && pendientesCount > 0
                    ? tDocs('pendientes.sidebar.badge', { count: pendientesCount })
                    : t(item.key)
                  : undefined
              }
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                  isActive
                    ? 'border-l-2 border-coral bg-coral/10 text-coral'
                    : 'border-l-2 border-transparent text-muted hover:bg-hairline hover:text-ink dark:hover:bg-surface-dark-soft dark:hover:text-on-dark'
                }`
              }
            >
              <span className="relative flex-shrink-0">
                <Icon size={18} />
                {!sidebarOpen && item.key === 'documents' && pendientesCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute -right-1.5 -top-1.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-amber px-0.5 text-[9px] font-bold leading-none text-white dark:text-surface-dark"
                  >
                    {pendientesCount > 9 ? '9+' : pendientesCount}
                  </span>
                )}
              </span>
              {sidebarOpen && (
                <span className="flex flex-1 items-center justify-between gap-2">
                  {t(item.key)}
                  {item.key === 'documents' && pendientesCount > 0 && (
                    <span
                      title={tDocs('pendientes.sidebar.badge', { count: pendientesCount })}
                      className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber px-1.5 text-xs font-semibold text-white dark:text-surface-dark"
                    >
                      {pendientesCount > 99 ? '99+' : pendientesCount}
                    </span>
                  )}
                </span>
              )}
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
