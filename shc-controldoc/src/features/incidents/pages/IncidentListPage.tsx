import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { IncidentList } from '../components/IncidentList'
import { useAuthStore } from '../../../stores/authStore'

const CAN_CREATE_ROLES = new Set(['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST'])

export function IncidentListPage() {
  const { t } = useTranslation('incidents')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const canCreate = user?.rol ? CAN_CREATE_ROLES.has(user.rol) : false

  const actions = canCreate ? (
    <button
      type="button"
      onClick={() => navigate('/incidents/nuevo')}
      className="flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      <Plus size={16} />
      {t('list.actions.nuevo')}
    </button>
  ) : undefined

  return (
    <PageWrapper title={t('list.title')} actions={actions}>
      <ErrorBoundary>
        <Suspense>
          <IncidentList />
        </Suspense>
      </ErrorBoundary>
    </PageWrapper>
  )
}
