import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PageWrapper } from '../../../components/layout/PageWrapper'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { IncidentList } from '../components/IncidentList'
import { IncidentMapView } from './IncidentMapView'
import { useAuthStore } from '../../../stores/authStore'

const CAN_CREATE_ROLES = new Set(['OPERARIO', 'SUPERVISOR', 'JEFE_CALIDAD_SYST'])

export function IncidentListPage() {
  const { t } = useTranslation('incidents')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const user = useAuthStore((s) => s.user)

  const view = searchParams.get('view') ?? 'list'
  const canCreate = user?.rol ? CAN_CREATE_ROLES.has(user.rol) : false

  function setView(v: 'list' | 'map') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('view', v)
      return next
    })
  }

  const tabBase = 'rounded-md px-4 py-2 text-sm font-medium transition-colors'
  const tabActive = `${tabBase} bg-coral text-white dark:bg-coral`
  const tabInactive = `${tabBase} bg-canvas text-ink border border-hairline hover:bg-surface-soft dark:bg-surface-dark dark:text-on-dark dark:border-hairline/20 dark:hover:bg-surface-dark-soft`

  const actions = (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setView('list')}
        aria-pressed={view === 'list'}
        className={view === 'list' ? tabActive : tabInactive}
      >
        {t('list.tabs.list')}
      </button>
      <button
        type="button"
        onClick={() => setView('map')}
        aria-pressed={view === 'map'}
        className={view === 'map' ? tabActive : tabInactive}
      >
        {t('list.tabs.map')}
      </button>
      {canCreate && (
        <button
          type="button"
          onClick={() => navigate('/incidents/nuevo')}
          className="flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-dark"
        >
          <Plus size={16} />
          {t('list.actions.nuevo')}
        </button>
      )}
    </div>
  )

  return (
    <PageWrapper title={t('list.title')} actions={actions}>
      {view === 'map' ? (
        <ErrorBoundary>
          <IncidentMapView />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary>
          <Suspense>
            <IncidentList />
          </Suspense>
        </ErrorBoundary>
      )}
    </PageWrapper>
  )
}
