import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NCStatusBadge } from '../../../components/shared/NCStatusBadge'
import { DocumentoNCCombobox } from '../../../components/shared/DocumentoNCCombobox'
import { useVincularNC, useDesvincularNC } from '../hooks/useDocumentActions'
import type { Documento } from '../../../types/documents.types'

interface DocumentNCVinculadasListProps {
  documento: Documento
  canEdit: boolean
}

export function DocumentNCVinculadasList({ documento, canEdit }: DocumentNCVinculadasListProps) {
  const { t } = useTranslation('documents')
  const vincular = useVincularNC(documento.id)
  const desvincular = useDesvincularNC(documento.id)

  return (
    <div className="space-y-4">
      {documento.ncVinculados.length === 0 ? (
        <p className="text-sm text-muted dark:text-on-dark-soft">{t('ncVinculados.vacio')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documento.ncVinculados.map((nc) => (
            <li
              key={nc.id}
              className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-canvas px-3 py-2 dark:border-hairline/20 dark:bg-surface-dark"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-mono text-xs font-semibold text-ink dark:text-on-dark">
                  {nc.numero}
                </span>
                <span className="truncate text-xs text-muted dark:text-on-dark-soft">
                  {nc.tipo} · {nc.severidad}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <NCStatusBadge status={nc.estado} />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => desvincular.mutate(nc.id)}
                    disabled={desvincular.isPending}
                    aria-label={t('ncVinculados.quitar', { numero: nc.numero })}
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
        <DocumentoNCCombobox
          mode="document-search-nc"
          linkedIds={documento.ncVinculados.map((n) => n.id)}
          onSelect={(noConformidadId) => vincular.mutate(noConformidadId)}
          ariaLabel={t('ncVinculados.combobox.ariaLabel')}
        />
      )}
    </div>
  )
}
