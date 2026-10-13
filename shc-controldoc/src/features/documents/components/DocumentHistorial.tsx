import { useTranslation } from 'react-i18next'
import type { AuditTrailEntry, Documento } from '../../../types/documents.types'

interface DocumentHistorialProps {
  documento: Documento
}

// "Historial de estados" cubre solo el ciclo de vida de ESTA fila (BORRADOR -> ... -> PUBLICADO),
// derivado de documento.auditTrail — nunca historialVersiones (no existe en el backend real, ver
// fix-detalle-documento-historial-audit). El historial de VERSIONES pasadas (otras filas que
// comparten codigo) lo cubre exclusivamente DocumentVersionesTab vía useDocumentVersiones(codigo);
// no se duplica aquí.
const ACCIONES_RELEVANTES = new Set([
  'DOCUMENTO_CREADO',
  'ESTADO_CAMBIADO',
  'FIRMA_REGISTRADA',
  'NUEVA_VERSION_INICIADA',
  'RESTAURADO',
  // documentos-rechazo-visible: reemplazan a ESTADO_CAMBIADO en las transiciones _ -> BORRADOR.
  'RECHAZADO_EN_REVISION',
  'RECHAZADO_EN_APROBACION',
  'REVISION_CANCELADA',
  // revision-periodica-trazabilidad
  'REVISION_PERIODICA_INICIADA',
  'REVISION_PERIODICA_VENCIDA',
])

// timestamp es un instante real (con hora significativa) — se convierte a hora local, a
// diferencia de las fechas de calendario de fix-fechas-utc.
function formatTimestamp(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

/**
 * Entradas que `DocumentHistorial` efectivamente muestra (filtradas por `ACCIONES_RELEVANTES`,
 * orden descendente) — exportada para que `DocumentDetailPage` calcule el contador de la
 * pestaña "Historial" sin reimplementar el mismo filtro ni asumir un campo que no existe en el
 * backend real (ver comentario de `ACCIONES_RELEVANTES` arriba: nunca `historialVersiones`).
 */
export function getHistorialEntries(documento: Documento): AuditTrailEntry[] {
  return (documento.auditTrail ?? [])
    .filter((entry) => ACCIONES_RELEVANTES.has(entry.accion))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

function describeEntry(entry: AuditTrailEntry, t: (key: string, options?: Record<string, unknown>) => string): string {
  const label = t(`auditTrail.actions.${entry.accion}`, { defaultValue: entry.accion })
  if (entry.accion === 'ESTADO_CAMBIADO' && (entry.estadoAnterior || entry.estadoNuevo)) {
    return `${label}: ${entry.estadoAnterior ?? '—'} → ${entry.estadoNuevo ?? '—'}`
  }
  return label
}

export function DocumentHistorial({ documento }: DocumentHistorialProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language

  const entries = getHistorialEntries(documento)

  if (entries.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted dark:text-on-dark-soft">
        {t('auditTrail.noEntries')}
      </p>
    )
  }

  return (
    <ol className="relative border-l-2 border-hairline dark:border-hairline/20">
      {entries.map((entry) => (
        <li key={entry.id} className="mb-6 pl-5">
          <div className="absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-hairline bg-canvas dark:border-hairline/20 dark:bg-surface-dark" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted dark:text-on-dark-soft">
              {formatTimestamp(entry.timestamp, locale)}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-body dark:text-on-dark">{describeEntry(entry, t)}</p>
          <p className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{entry.realizadoPorNombre}</p>
          {entry.motivo && (
            <p className="mt-0.5 text-xs text-body dark:text-on-dark">
              {t('auditTrail.motivo', { motivo: entry.motivo })}
            </p>
          )}
        </li>
      ))}
    </ol>
  )
}
