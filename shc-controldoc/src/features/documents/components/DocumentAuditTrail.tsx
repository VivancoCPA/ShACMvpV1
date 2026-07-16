import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowRightLeft,
  Pencil,
  ShieldCheck,
  FilePlus,
  Download,
  Eye,
  FileText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AuditTrailEntry, Documento } from '../../../types/documents.types'

const PAGE_SIZE = 20

const ACCION_ICONS: Record<string, LucideIcon> = {
  ESTADO_CAMBIADO: ArrowRightLeft,
  CAMPO_EDITADO: Pencil,
  FIRMA_REGISTRADA: ShieldCheck,
  DOCUMENTO_CREADO: FilePlus,
  DESCARGA: Download,
  DESCARGA_ARCHIVO_ORIGINAL: Download,
  VISUALIZACION: Eye,
}

interface DocumentAuditTrailProps {
  documento: Documento
}

function formatTimestamp(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'America/Lima',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(new Date(iso))
}

function AuditTrailIcon({ accion }: { accion: string }) {
  const Icon = ACCION_ICONS[accion] ?? FileText
  return <Icon size={14} className="shrink-0 text-muted dark:text-on-dark-soft" aria-hidden="true" />
}

function describeEntry(entry: AuditTrailEntry, t: (key: string, options?: Record<string, unknown>) => string): string {
  const label = t(`auditTrail.actions.${entry.accion}`, { defaultValue: entry.accion })

  if (entry.accion === 'ESTADO_CAMBIADO' && (entry.estadoAnterior || entry.estadoNuevo)) {
    return `${label}: ${entry.estadoAnterior ?? '—'} → ${entry.estadoNuevo ?? '—'}`
  }
  if (entry.campoModificado) {
    return `${label} (${entry.campoModificado}): ${entry.valorAnterior ?? '—'} → ${entry.valorNuevo ?? '—'}`
  }
  return label
}

export function DocumentAuditTrail({ documento }: DocumentAuditTrailProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sorted = [...documento.auditTrail].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  )

  const visible = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length

  if (sorted.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted dark:text-on-dark-soft">
        {t('auditTrail.noEntries')}
      </p>
    )
  }

  return (
    <div>
      <ul className="divide-y divide-hairline dark:divide-hairline/20">
        {visible.map((entry) => (
          <li key={entry.id} className="flex items-start gap-2.5 py-2.5">
            <AuditTrailIcon accion={entry.accion} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-body dark:text-on-dark">
                  {describeEntry(entry, t)}
                </span>
                <time className="shrink-0 text-xs text-muted dark:text-on-dark-soft">
                  {formatTimestamp(entry.timestamp, locale)}
                </time>
              </div>
              <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">
                {entry.realizadoPorNombre}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-4 w-full rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-muted hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated"
        >
          {t('auditTrail.showMore')}
        </button>
      )}
    </div>
  )
}
