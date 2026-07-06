import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { LocalList } from '../components/LocalList'

export function LocalesAdminPage() {
  const { t } = useTranslation('locations')

  return (
    <PageWrapper title={t('header.title')}>
      <ErrorBoundary>
        <LocalList />
      </ErrorBoundary>
    </PageWrapper>
  )
}
