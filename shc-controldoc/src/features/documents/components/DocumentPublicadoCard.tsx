import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileText, Eye, Copy } from 'lucide-react'
import { formatDateTime, formatCalendarDateMedium } from '../../../utils/date.utils'
import { getDatosPublicacion } from '../utils/publicacion'
import type { DocumentActionsAvailability } from '../hooks/useDocumentActionsAvailability'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'
import type { Documento } from '../../../types/documents.types'

const ESTADOS_CON_TARJETA: ReadonlyArray<Documento['estado']> = ['PUBLICADO', 'EN_REVISION_PERIODICA', 'OBSOLETO']

function abreviarHash(hash: string): string {
  if (hash.length <= 10) return hash
  return `${hash.slice(0, 4)}…${hash.slice(-4)}`
}

interface DocumentPublicadoCardProps {
  documento: Documento
  availability: DocumentActionsAvailability
  controller: DocumentActionsController
  getName: (id?: string | null) => string
}

/**
 * resumen-info-publicacion: tarjeta "Documento publicado" de la pestaña Resumen — firmante,
 * fecha/hora, hash (abreviado, con tooltip + copiar) y botón "Ver" que reutiliza la misma acción
 * de "Ver documento" de la sidebar (sin lógica de permisos nueva).
 */
export function DocumentPublicadoCard({ documento, availability, controller, getName }: DocumentPublicadoCardProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language

  if (!ESTADOS_CON_TARJETA.includes(documento.estado)) return null

  const datos = getDatosPublicacion(documento)
  if (!datos) return null

  const nombreArchivo = `${documento.codigo} ${documento.version}.pdf`
  const fechaHora = formatDateTime(datos.fecha, locale)

  function handleCopiarHash() {
    if (!datos?.hash) return
    try {
      void navigator.clipboard.writeText(datos.hash)
      toast.success(t('detail.publicado.hashCopiado'))
    } catch {
      // Entornos sin Clipboard API (algunos navegadores/tests) — no rompemos la tarjeta.
    }
  }

  return (
    <div className="rounded-lg border border-hairline bg-surface-soft p-4 dark:border-hairline/20 dark:bg-surface-dark-elevated">
      <div className="flex items-start gap-3">
        <FileText size={20} className="mt-0.5 shrink-0 text-coral" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
            {t('detail.publicado.titulo')}
          </h4>
          <p className="truncate text-sm font-medium text-ink dark:text-on-dark">{nombreArchivo}</p>

          <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-body dark:text-on-dark">
            <span>{t('detail.publicado.firmadoPor', { nombre: getName(datos.firmadoPorId), fecha: fechaHora })}</span>
            {datos.hash && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-xs" title={datos.hash}>
                  {abreviarHash(datos.hash)}
                </span>
                <button
                  type="button"
                  onClick={handleCopiarHash}
                  aria-label={t('detail.publicado.copiarHash')}
                  title={t('detail.publicado.copiarHash')}
                  className="rounded p-0.5 text-muted hover:text-coral-dark dark:text-on-dark-soft"
                >
                  <Copy size={12} aria-hidden="true" />
                </button>
              </>
            )}
          </p>

          {documento.estado === 'OBSOLETO' && documento.fechaObsolescencia && (
            <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
              {t('detail.publicado.obsoletoDesde', {
                fecha: formatCalendarDateMedium(documento.fechaObsolescencia, locale),
              })}
            </p>
          )}

          {availability.canVerDocumento && (
            <button
              type="button"
              onClick={() => controller.setShowVisor(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 py-1.5 text-xs font-medium text-ink hover:bg-surface-cream dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
            >
              <Eye size={12} aria-hidden="true" />
              {t('visor.verDocumento')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
