import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { DocumentListFilters } from '../components/DocumentListFilters'
import { DocumentList } from '../components/DocumentList'
import { useAuthStore } from '../../../stores/authStore'
import { useDocumentosPendientesCount } from '../hooks/useDocumentosPendientesCount'
import type { UserRole } from '../../../types/auth.types'

const CREATE_ROLES = new Set(['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST'])
const PENDIENTES_ROLES = new Set<UserRole>(['SUPERVISOR', 'JEFE_CALIDAD_SYST', 'JEFE_CONTROL_DOCUMENTARIO'])

// Module-level flag: survives React remounts (navigate away and back) within the same
// page load, so auto-activation fires only once per session. Resets on hard refresh.
let pendientesAutoActivated = false

export function DocumentsPage() {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const userRole = useAuthStore((s) => s.user?.rol)
  const { data: pendientesData } = useDocumentosPendientesCount()
  const hasAutoActivated = useRef(pendientesAutoActivated)

  const canCreate = userRole !== undefined && CREATE_ROLES.has(userRole)

  // Auto-activate "Mis pendientes" on first visit if the user has pending docs and no filters set
  useEffect(() => {
    if (pendientesData === undefined || hasAutoActivated.current) return
    hasAutoActivated.current = true
    pendientesAutoActivated = true
    const hasPendientes = pendientesData.count > 0
    const hasExplicitFilter =
      searchParams.has('search') ||
      searchParams.has('estado') ||
      searchParams.has('tipo') ||
      searchParams.has('areaId') ||
      searchParams.has('pendientes') ||
      searchParams.has('includeDeleted')
    const canSeePendientes = userRole !== undefined && PENDIENTES_ROLES.has(userRole)
    if (hasPendientes && !hasExplicitFilter && canSeePendientes) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('pendientes', 'true')
        return next
      }, { replace: true })
    }
  }, [pendientesData])

  const actions = canCreate ? (
    <button
      type="button"
      onClick={() => navigate('/documents/new')}
      className="rounded-md bg-coral px-5 py-2.5 text-sm font-medium text-white hover:bg-coral-dark focus:outline-none focus:ring-2 focus:ring-coral/50 dark:hover:bg-coral-dark"
    >
      {t('list.actions.nuevo')}
    </button>
  ) : undefined

  return (
    <PageWrapper title={t('list.title')} actions={actions}>
      <DocumentListFilters />
      <ErrorBoundary>
        <DocumentList />
      </ErrorBoundary>
    </PageWrapper>
  )
}
