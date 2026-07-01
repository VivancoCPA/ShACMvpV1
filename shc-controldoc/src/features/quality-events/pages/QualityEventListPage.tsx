import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { QEListFilters } from '../components/QEListFilters'
import { QEList } from '../components/QEList'
import { useAuthStore } from '../../../stores/authStore'
import type { UserRole } from '../../../types/auth.types'

const ROLES_PUEDEN_CREAR: UserRole[] = ['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST']

export function QualityEventListPage() {
  const { t } = useTranslation('qualityEvents')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const puedeCrear = user?.rol ? ROLES_PUEDEN_CREAR.includes(user.rol) : false

  const actions = puedeCrear ? (
    <button
      type="button"
      onClick={() => navigate('/quality-events/nuevo')}
      className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      {t('list.actions.nueva')}
    </button>
  ) : undefined

  return (
    <PageWrapper title={t('list.title')} actions={actions}>
      <QEListFilters />
      <ErrorBoundary>
        <QEList />
      </ErrorBoundary>
    </PageWrapper>
  )
}
