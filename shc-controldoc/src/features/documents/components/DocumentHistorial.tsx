import { useTranslation } from 'react-i18next'
import type { Documento } from '../../../types/documents.types'

interface DocumentHistorialProps {
  documento: Documento
}

interface HistorialItem {
  key: string
  version: string
  fecha: string
  descripcion: string
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

export function DocumentHistorial({ documento }: DocumentHistorialProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language

  const items: HistorialItem[] = documento.historialVersiones.map((entry) => ({
    key: entry.version,
    version: entry.version,
    fecha: entry.fechaPublicacion,
    descripcion: entry.descripcionCambios,
  }))

  const creadoEntry = documento.auditTrail.find((entry) => entry.accion === 'DOCUMENTO_CREADO')
  if (creadoEntry) {
    items.push({
      key: 'creado-en-borrador',
      version: documento.version,
      fecha: creadoEntry.timestamp,
      descripcion: t('historial.createdInBorrador'),
    })
  }

  const sorted = items.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())

  return (
    <ol className="relative border-l-2 border-hairline dark:border-hairline/20">
      {sorted.map((entry) => {
        const isCurrent = entry.version === documento.version
        return (
          <li key={entry.key} className="mb-6 pl-5">
            <div className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-hairline bg-canvas dark:border-hairline/20 dark:bg-surface-dark" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-[9999px] bg-surface-soft px-2.5 py-0.5 text-xs font-semibold text-body dark:bg-surface-dark-soft dark:text-on-dark">
                {entry.version}
              </span>
              {isCurrent && (
                <span className="rounded-[9999px] bg-coral/20 px-2.5 py-0.5 text-xs font-medium text-coral dark:bg-coral/15">
                  {t('historial.currentVersion')}
                </span>
              )}
              <span className="text-xs text-muted dark:text-on-dark-soft">
                {formatDate(entry.fecha, locale)}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-body dark:text-on-dark">{entry.descripcion}</p>
          </li>
        )
      })}
    </ol>
  )
}
