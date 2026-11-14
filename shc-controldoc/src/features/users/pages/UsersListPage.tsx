import { useTranslation } from 'react-i18next'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { UserList } from '../components/UserList'
import { SeguridadSesionSection } from '../../sesion/components/SeguridadSesionSection'
import { ResponsablesAcSection } from '../../acciones-correctivas/components/ResponsablesAcSection'

export function UsersListPage() {
  const { t } = useTranslation('users')

  return (
    <PageWrapper title={t('list.title')}>
      <ErrorBoundary>
        <UserList />
      </ErrorBoundary>
      {/* sesion-timeout-inactividad: el ADMINISTRADOR_EMPRESA configura aquí la sesión de su empresa. */}
      <SeguridadSesionSection />
      {/* ac-responsables-configurable-empresa: qué roles pueden ser responsables de cada tipo de AC. */}
      <ResponsablesAcSection />
    </PageWrapper>
  )
}
