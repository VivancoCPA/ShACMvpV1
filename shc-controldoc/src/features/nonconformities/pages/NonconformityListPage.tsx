import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { NCListFilters } from '../components/NCListFilters'
import { NCList } from '../components/NCList'
import { useAuthStore } from '../../../stores/authStore'

const CAN_CREATE_ROLES = new Set(['SUPERVISOR', 'JEFE_CALIDAD_SYST'])

export function NonconformityListPage() {
  const { t } = useTranslation('nonconformities')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const canCreate = user?.rol ? CAN_CREATE_ROLES.has(user.rol) : false

  const actions = canCreate ? (
    <button
      type="button"
      onClick={() => navigate('/nonconformities/new')}
      className="flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
    >
      <PlusCircle size={16} />
      {t('list.actions.nueva')}
    </button>
  ) : undefined

  return (
    <PageWrapper title={t('list.title')} actions={actions}>
      <NCListFilters />
      <ErrorBoundary>
        <NCList />
      </ErrorBoundary>
    </PageWrapper>
  )
}
