import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { AccionesRequeridasWidget } from '../components/AccionesRequeridasWidget'

function WidgetSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-hairline dark:bg-surface-dark-soft" />
      ))}
    </div>
  )
}

export function JefeControlDocumentarioDashboard() {
  const { t } = useTranslation('dashboard')
  const { data, isLoading } = useDashboardSummary()

  return (
    <PageWrapper title={t('jefeControlDoc.title')}>
      <div className="mb-8">
        <AccionesRequeridasWidget />
      </div>
      {isLoading || !data || data.rol !== 'JEFE_CONTROL_DOC' ? (
        <div className="space-y-8">
          <WidgetSkeleton />
        </div>
      ) : null}
    </PageWrapper>
  )
}
