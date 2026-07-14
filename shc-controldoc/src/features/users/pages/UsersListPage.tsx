import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { UserList } from '../components/UserList'

export function UsersListPage() {
  const { t } = useTranslation('users')

  return (
    <PageWrapper title={t('list.title')}>
      <ErrorBoundary>
        <UserList />
      </ErrorBoundary>
    </PageWrapper>
  )
}
