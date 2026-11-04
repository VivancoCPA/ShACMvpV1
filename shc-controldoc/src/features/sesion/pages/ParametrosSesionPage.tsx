import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { ParametrosSesionForm } from '../components/ParametrosSesionForm'

/** `/admin/parametros-sesion` — exclusivo de SUPERADMIN (sesion-timeout-inactividad). */
export function ParametrosSesionPage() {
  const { t } = useTranslation('sesion')

  return (
    <PageWrapper title={t('global.title')}>
      <ErrorBoundary>
        <div className="max-w-3xl rounded-lg bg-surface-card p-6 dark:bg-surface-dark-elevated">
          <p className="mb-6 text-sm text-body dark:text-on-dark-soft">{t('global.description')}</p>
          <ParametrosSesionForm />
        </div>
      </ErrorBoundary>
    </PageWrapper>
  )
}
