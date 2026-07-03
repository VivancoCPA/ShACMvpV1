import { useTranslation } from 'react-i18next'
import {
  FilePlus,
  ArrowRightLeft,
  Pencil,
  ShieldCheck,
  Bell,
  ListPlus,
  RefreshCw,
  Circle,
  Sparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useQEAuditTrail } from '../hooks/useQEAuditTrail'
import { QE_STATUS_LABELS } from '../../../constants/shared.constants'
import type { QEAuditTrailEntry, QEStatus } from '../types/qualityEvent.types'

const ACCION_ICONS: Record<string, LucideIcon> = {
  CREADO: FilePlus,
  ESTADO_CAMBIADO: ArrowRightLeft,
  CAMPO_EDITADO: Pencil,
  CAUSA_RAIZ_APROBADA: ShieldCheck,
  NOTIFICACION_GERENCIA: Bell,
  AC_CREADA: ListPlus,
  AC_ESTADO_CAMBIADO: RefreshCw,
}

interface QEAuditTrailProps {
  qeId: string
}

function AuditTrailIcon({ accion }: { accion: string }) {
  const Icon = ACCION_ICONS[accion] ?? Circle
  return <Icon size={14} className="shrink-0 text-muted dark:text-on-dark-soft" aria-hidden="true" />
}

function describeEntry(entry: QEAuditTrailEntry, t: (key: string) => string): string {
  const base = t(`detail.auditTrail.acciones.${entry.accion}`)
  const label = base === `detail.auditTrail.acciones.${entry.accion}` ? entry.accion : base

  if (entry.accion === 'ESTADO_CAMBIADO' && entry.estadoAnterior && entry.estadoNuevo) {
    const anterior = QE_STATUS_LABELS[entry.estadoAnterior as QEStatus] ?? entry.estadoAnterior
    const nuevo = QE_STATUS_LABELS[entry.estadoNuevo as QEStatus] ?? entry.estadoNuevo
    return `${label}: ${anterior} → ${nuevo}`
  }
  if (entry.accion === 'CAMPO_EDITADO' && entry.campoModificado) {
    return `${label} (${entry.campoModificado})`
  }
  return label
}

export function QEAuditTrail({ qeId }: QEAuditTrailProps) {
  const { t, i18n } = useTranslation('qualityEvents')
  const { data: entries = [], isLoading } = useQEAuditTrail(qeId)

  const formatter = new Intl.DateTimeFormat(i18n.language, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <section
      aria-labelledby="qe-audit-trail-title"
      className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated"
    >
      <h2 id="qe-audit-trail-title" className="mb-3 text-base font-medium text-ink dark:text-on-dark">
        {t('detail.auditTrail.title')}
      </h2>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-hairline dark:bg-surface-dark-soft" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="py-4 text-sm text-muted dark:text-on-dark-soft">{t('detail.auditTrail.empty')}</p>
      ) : (
        <ul className="divide-y divide-hairline dark:divide-hairline/20">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2.5 py-2.5">
              <AuditTrailIcon accion={entry.accion} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium text-body dark:text-on-dark">
                    {describeEntry(entry, t)}
                  </span>
                  <time className="shrink-0 text-xs text-muted dark:text-on-dark-soft">
                    {formatter.format(new Date(entry.timestamp))}
                  </time>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted dark:text-on-dark-soft">
                  {entry.realizadoPorNombre}
                  {entry.generadoPorIA && (
                    <span className="inline-flex items-center gap-1 rounded-pill bg-teal/10 px-1.5 py-0.5 text-[10px] font-medium text-teal">
                      <Sparkles size={9} aria-hidden="true" />
                      {t('detail.auditTrail.generadoPorIA')}
                    </span>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
