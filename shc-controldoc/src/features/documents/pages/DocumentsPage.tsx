import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { DocumentListFilters } from '../components/DocumentListFilters'
import { DocumentList } from '../components/DocumentList'
import { useAuthStore } from '../../../stores/authStore'

const CREATE_ROLES = new Set(['JEFE_CONTROL_DOCUMENTARIO', 'JEFE_CALIDAD_SYST'])

export function DocumentsPage() {
  const { t } = useTranslation('documents')
  const userRole = useAuthStore((s) => s.user?.rol)

  const canCreate = userRole !== undefined && CREATE_ROLES.has(userRole)

  const actions = canCreate ? (
    <button
      type="button"
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
