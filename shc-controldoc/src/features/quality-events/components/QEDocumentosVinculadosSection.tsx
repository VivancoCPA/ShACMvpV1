import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { DocumentoQECombobox } from '../../../components/shared/DocumentoQECombobox'
import { useAuthStore } from '../../../stores/authStore'
import { useVincularDocumento } from '../hooks/useVincularDocumento'
import { useDesvincularDocumento } from '../hooks/useDesvincularDocumento'
import { puedeVincularDocumentos } from '../utils/qualityEventPermissions'
import type { QualityEvent } from '../types/qualityEvent.types'

interface QEDocumentosVinculadosSectionProps {
  qe: QualityEvent
  readOnly?: boolean
}

export function QEDocumentosVinculadosSection({ qe, readOnly = false }: QEDocumentosVinculadosSectionProps) {
  const { t } = useTranslation('qualityEvents')
  const user = useAuthStore((s) => s.user)
  const vincular = useVincularDocumento(qe.id)
  const desvincular = useDesvincularDocumento(qe.id)

  const canLink = !readOnly && !!user && puedeVincularDocumentos(qe, user)

  return (
    <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
      <h2 className="mb-4 text-sm font-semibold text-ink dark:text-on-dark">
        {t('documentosVinculados.titulo')}
      </h2>

      {qe.documentosVinculados.length === 0 ? (
        <p className="text-sm text-muted dark:text-on-dark-soft">{t('documentosVinculados.vacio')}</p>
      ) : (
        <ul className="mb-4 flex flex-col gap-2">
          {qe.documentosVinculados.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-canvas px-3 py-2 dark:border-hairline/20 dark:bg-surface-dark"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-xs font-semibold text-ink dark:text-on-dark">
                  {doc.codigo}
                </span>
                <span className="truncate text-xs text-muted dark:text-on-dark-soft">{doc.titulo}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={doc.estado} />
                {canLink && (
                  <button
                    type="button"
                    onClick={() => desvincular.mutate(doc.id)}
                    disabled={desvincular.isPending}
                    aria-label={t('documentosVinculados.quitar', { codigo: doc.codigo })}
                    className="rounded p-1 text-muted hover:bg-error/10 hover:text-error dark:text-on-dark-soft"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canLink && (
        <DocumentoQECombobox
          mode="qe-search-document"
          linkedIds={qe.documentosVinculados.map((d) => d.id)}
          onSelect={(documentoId) => vincular.mutate(documentoId)}
          ariaLabel={t('documentosVinculados.combobox.ariaLabel')}
        />
      )}
    </div>
  )
}
