import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import type { Documento } from '../../../types/documents.types'

interface DocumentVersionSubRowProps {
  documento: Documento
  onClick: () => void
}

export function DocumentVersionSubRow({ documento, onClick }: DocumentVersionSubRowProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).format(new Date(iso))

  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-b border-hairline/60 bg-surface-soft/50 hover:bg-coral/5 dark:border-hairline/10 dark:bg-surface-dark-elevated/40 dark:hover:bg-coral/10"
    >
      <td colSpan={8} className="py-2 pl-12 pr-4">
        <div className="flex flex-wrap items-center gap-2.5 text-sm">
          <span className="select-none text-muted dark:text-on-dark-soft">└─</span>
          <span className="font-mono text-xs font-medium text-muted dark:text-on-dark-soft">
            {documento.version}
          </span>
          <StatusBadge status={documento.estado} />
          {documento.fechaEmision && (
            <span className="text-xs text-muted dark:text-on-dark-soft">
              {t('versiones.publicadoEl', { fecha: fmt(documento.fechaEmision) })}
            </span>
          )}
          {documento.fechaObsolescencia && (
            <>
              <span className="text-xs text-muted dark:text-on-dark-soft">→</span>
              <span className="text-xs text-muted dark:text-on-dark-soft">
                {t('versiones.obsoletoEl', { fecha: fmt(documento.fechaObsolescencia) })}
              </span>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
