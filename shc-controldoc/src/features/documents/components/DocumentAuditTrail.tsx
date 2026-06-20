import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Documento } from '../../../types/documents.types'

const PAGE_SIZE = 20

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
      <ol className="space-y-3">
        {visible.map((entry) => (
          <li
            key={entry.id}
            className="rounded-lg border border-hairline bg-canvas p-3.5 dark:border-hairline/20 dark:bg-surface-dark"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted dark:text-on-dark-soft">
                  {formatTimestamp(entry.timestamp, locale)}
                </span>
                <span className="font-medium text-sm text-body dark:text-on-dark">
                  {entry.realizadoPorNombre}
                </span>
              </div>
              <span className="rounded-[9999px] bg-surface-soft px-2 py-0.5 text-xs font-medium text-muted dark:bg-surface-dark-soft dark:text-on-dark-soft">
                {t(`auditTrail.actions.${entry.accion}`, { defaultValue: entry.accion })}
              </span>
            </div>
            {(entry.estadoAnterior || entry.estadoNuevo) && (
              <p className="mt-1.5 text-xs text-muted dark:text-on-dark-soft">
                {entry.estadoAnterior && <span>{entry.estadoAnterior}</span>}
                {entry.estadoAnterior && entry.estadoNuevo && <span> → </span>}
                {entry.estadoNuevo && <span className="font-medium text-body dark:text-on-dark">{entry.estadoNuevo}</span>}
              </p>
            )}
            {entry.campoModificado && (
              <p className="mt-1.5 text-xs text-muted dark:text-on-dark-soft">
                <span className="font-medium">{entry.campoModificado}:</span>{' '}
                {entry.valorAnterior && <span className="line-through">{entry.valorAnterior}</span>}
                {entry.valorAnterior && entry.valorNuevo && ' → '}
                {entry.valorNuevo && <span>{entry.valorNuevo}</span>}
              </p>
            )}
          </li>
        ))}
      </ol>

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
