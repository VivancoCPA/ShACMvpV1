import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { DocumentoQECombobox } from '../../../components/shared/DocumentoQECombobox'
import { useVincularQE, useDesvincularQE } from '../hooks/useDocumentActions'
import type { Documento } from '../../../types/documents.types'

interface DocumentQEVinculadosListProps {
  documento: Documento
  canEdit: boolean
}

export function DocumentQEVinculadosList({ documento, canEdit }: DocumentQEVinculadosListProps) {
  const { t } = useTranslation('documents')
  const vincular = useVincularQE(documento.id)
  const desvincular = useDesvincularQE(documento.id)

  return (
    <div className="space-y-4">
      {documento.qeVinculados.length === 0 ? (
        <p className="text-sm text-muted dark:text-on-dark-soft">{t('qeVinculados.vacio')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documento.qeVinculados.map((qe) => (
            <li
              key={qe.id}
              className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-canvas px-3 py-2 dark:border-hairline/20 dark:bg-surface-dark"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-xs font-semibold text-ink dark:text-on-dark">
                  {qe.numero}
                </span>
                <span className="truncate text-xs text-muted dark:text-on-dark-soft">
                  {qe.tipo} · {qe.severidad}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={qe.estado} />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => desvincular.mutate(qe.id)}
                    disabled={desvincular.isPending}
                    aria-label={t('qeVinculados.quitar', { numero: qe.numero })}
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

      {canEdit && (
        <DocumentoQECombobox
          mode="document-search-qe"
          linkedIds={documento.qeVinculados.map((q) => q.id)}
          onSelect={(qualityEventId) => vincular.mutate(qualityEventId)}
          ariaLabel={t('qeVinculados.combobox.ariaLabel')}
        />
      )}
    </div>
  )
}
