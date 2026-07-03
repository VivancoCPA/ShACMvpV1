import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { userFixtures } from '../../../mocks/fixtures/users.fixtures'
import { QEStatusBadge } from './QEStatusBadge'
import { QETypeBadge } from './QETypeBadge'
import { QEOriginBadge } from './QEOriginBadge'
import { QESeverityBadge } from './QESeverityBadge'
import type { QualityEvent } from '../types/qualityEvent.types'

interface QEHeaderSectionProps {
  qe: QualityEvent
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-muted dark:text-on-dark-soft">{label}</dt>
      <dd className="mt-0.5 text-sm text-body dark:text-on-dark sm:col-span-2 sm:mt-0">
        {children}
      </dd>
    </div>
  )
}

export function QEHeaderSection({ qe }: QEHeaderSectionProps) {
  const { t, i18n } = useTranslation('qualityEvents')

  const reportedBy = userFixtures.find((u) => u.id === qe.reportadoPorId)
  const dateFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' })
  const dateOnlyFormatter = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' })

  const formatDateTime = (value?: string | null) => (value ? dateFormatter.format(new Date(value)) : '—')
  const formatDateOnly = (value?: string | null) => (value ? dateOnlyFormatter.format(new Date(value)) : '—')

  return (
    <section
      aria-labelledby="qe-header-title"
      className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      {qe.severidad === 'CRITICA' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-error/30 bg-error/10 px-4 py-3 text-error">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <p className="text-sm">{t('detail.header.criticaBanner')}</p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h1 id="qe-header-title" className="font-display text-2xl font-normal text-ink dark:text-on-dark">
          {qe.numero}
        </h1>
        <QEStatusBadge status={qe.estado} />
        <QETypeBadge type={qe.tipo} />
        <QEOriginBadge origin={qe.origen} />
        <QESeverityBadge severity={qe.severidad} />
        {qe.ciclo > 1 && (
          <span className="inline-flex items-center rounded-pill bg-amber/15 px-2 py-0.5 text-xs font-medium text-amber">
            {t('detail.header.reincidencia', { count: qe.ciclo })}
          </span>
        )}
      </div>

      <dl className="divide-y divide-hairline dark:divide-hairline/20">
        <FieldRow label={t('detail.header.areaAfectada')}>{qe.areaAfectada}</FieldRow>
        {qe.mineralInvolucrado && (
          <FieldRow label={t('detail.header.mineralInvolucrado')}>{qe.mineralInvolucrado}</FieldRow>
        )}
        <FieldRow label={t('detail.header.turno')}>{t(`form.turno.${qe.turno}`)}</FieldRow>
        <FieldRow label={t('detail.header.fechaHoraEvento')}>
          {formatDateTime(qe.fechaHoraEvento)}
        </FieldRow>
        <FieldRow label={t('detail.header.fechaHoraReporte')}>
          {formatDateTime(qe.fechaHoraReporte)}
        </FieldRow>
        <FieldRow label={t('detail.header.reportadoPor')}>
          {reportedBy ? `${reportedBy.nombre} ${reportedBy.apellido}` : qe.reportadoPorId}
        </FieldRow>

        {qe.origen === 'O1_INCIDENTE_CAMPO' && qe.incidenteId && (
          <FieldRow label={t('detail.header.origenRef')}>
            <Link to={`/incidents/${qe.incidenteId}`} className="text-coral hover:underline">
              {t('detail.header.verIncidente')}
            </Link>
          </FieldRow>
        )}
        {qe.origen === 'O2_NC_DETECTADA' && qe.ncId && (
          <FieldRow label={t('detail.header.origenRef')}>
            <Link to={`/nonconformities/${qe.ncId}`} className="text-coral hover:underline">
              {t('detail.header.verNoConformidad')}
            </Link>
          </FieldRow>
        )}
        {qe.origen === 'O3_HALLAZGO_AUDITORIA' && qe.hallazgoAuditoriaRef && (
          <FieldRow label={t('detail.header.hallazgoAuditoria')}>{qe.hallazgoAuditoriaRef}</FieldRow>
        )}
        {qe.origen === 'O4_REPORTE_EXTERNO' && qe.reporteExternoRef && (
          <>
            <FieldRow label={t('detail.header.nombreCliente')}>
              {qe.reporteExternoRef.nombreCliente}
            </FieldRow>
            <FieldRow label={t('detail.header.fechaRecepcion')}>
              {formatDateOnly(qe.reporteExternoRef.fechaRecepcion)}
            </FieldRow>
          </>
        )}
      </dl>
    </section>
  )
}
