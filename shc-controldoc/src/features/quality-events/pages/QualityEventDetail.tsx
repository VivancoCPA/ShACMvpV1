import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { useQualityEvent } from '../hooks/useQualityEvent'
import { useAuthStore } from '../../../stores/authStore'
import { QEHeaderSection } from '../components/QEHeaderSection'
import { QEStatusTransitionPanel } from '../components/QEStatusTransitionPanel'
import { QEInvestigationSection } from '../components/QEInvestigationSection'
import { QEACSection } from '../components/QEACSection'
import { QEAuditTrail } from '../components/QEAuditTrail'

function SectionSkeleton() {
  return (
    <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
        ))}
      </div>
    </div>
  )
}

export function QualityEventDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)

  const { data: qe, isLoading, isError } = useQualityEvent(id ?? '')

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl space-y-6">
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
          <SectionSkeleton />
        </div>
      </div>
    )
  }

  if (isError || !qe) {
    return (
      <div className="p-6">
        <div className="mx-auto max-w-3xl rounded-lg border border-error/30 bg-error/5 px-6 py-12 text-center">
          <p className="text-4xl" aria-hidden="true">🔍</p>
          <p className="mt-4 text-sm font-medium text-ink dark:text-on-dark">{t('detail.notFound.title')}</p>
          <p className="mt-1 text-sm text-muted dark:text-on-dark-soft">{t('detail.notFound.message')}</p>
          <button
            type="button"
            onClick={() => navigate('/quality-events')}
            className="mt-4 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('detail.notFound.volver')}
          </button>
        </div>
      </div>
    )
  }

  const isDeleted = !!qe.deletedAt

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => navigate('/quality-events')}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-ink dark:text-on-dark-soft dark:hover:text-on-dark"
        >
          <ArrowLeft size={14} />
          {t('detail.back')}
        </button>

        {isDeleted && (
          <div className="flex items-start gap-2.5 rounded-lg border border-error/20 bg-error/5 px-4 py-3">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-error" />
            <p className="text-sm font-medium text-error">{t('detail.deletedBanner')}</p>
          </div>
        )}

        <div className="space-y-4">
          <QEHeaderSection qe={qe} />
          {user && !isDeleted && <QEStatusTransitionPanel qe={qe} rol={user.rol} />}
        </div>
        <QEInvestigationSection qe={qe} />
        <QEACSection
          qeId={qe.id}
          qeEstado={qe.estado}
          accionesCorrectivas={qe.accionesCorrectivas}
          solicitudesAC={qe.solicitudesAC}
          readOnly={isDeleted}
        />
        <QEAuditTrail qeId={qe.id} />
      </div>
    </div>
  )
}
