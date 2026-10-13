import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../../stores/authStore'
import { formatCalendarDateMedium, calendarDaysUntil } from '../../../utils/date.utils'
import { getDocumentPermissions, resolveDocRoleForUser } from '../permissions'
import { getRevisionPeriodicaNivel } from '../utils/revisionPeriodica'
import type { AuditTrailEntry, Documento } from '../../../types/documents.types'

// documentos-rechazo-visible: la última entrada entre estas 3 acciones determina si corresponde
// mostrar el banner de rechazo — nunca para REVISION_CANCELADA. Derivado de auditTrail ya
// cargado, sin useEffect ni fetch adicional.
const ACCIONES_RECHAZO_O_CANCELACION = new Set(['RECHAZADO_EN_REVISION', 'RECHAZADO_EN_APROBACION', 'REVISION_CANCELADA'])

function getUltimaEntradaDeRechazo(auditTrail: AuditTrailEntry[]): AuditTrailEntry | undefined {
  return [...auditTrail]
    .filter((e) => ACCIONES_RECHAZO_O_CANCELACION.has(e.accion))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
}

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—'
  return formatCalendarDateMedium(iso, locale)
}

interface DocumentDetailBannersProps {
  documento: Documento
}

/**
 * Franja de avisos contextuales del detalle de documento (detalle-documento-dos-columnas):
 * antes vivían dentro de `DocumentDetailHeader` (que ahora es `sticky`); se extraen a su propio
 * componente para que la página los renderice en una franja a todo el ancho, DEBAJO del
 * encabezado fijo y fuera de su área sticky — así no ocupan pantalla permanentemente al hacer
 * scroll. Ninguna condición de visibilidad cambia respecto a como ya funcionaban.
 */
export function DocumentDetailBanners({ documento }: DocumentDetailBannersProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const user = useAuthStore((s) => s.user)

  const isJefeDocOrDireccion =
    user?.rol === 'JEFE_CONTROL_DOCUMENTARIO' || user?.rol === 'ALTA_DIRECCION'

  const ultimaEntradaRechazo = getUltimaEntradaDeRechazo(documento.auditTrail ?? [])
  const showRechazoBanner =
    documento.estado === 'BORRADOR' &&
    (ultimaEntradaRechazo?.accion === 'RECHAZADO_EN_REVISION' || ultimaEntradaRechazo?.accion === 'RECHAZADO_EN_APROBACION')

  // nueva-version-autor-permisos: solo relevante para quien podría enviarlo a revisión
  // (AUTOR/JEFE_CALIDAD para este documento) — a un REVISOR/APROBADOR/OPERARIO no le sirve un
  // enlace a "Editar" que no puede usar.
  const docRole = resolveDocRoleForUser(documento, user)
  const puedeEditarEnBorrador = documento.estado === 'BORRADOR' && getDocumentPermissions(documento.estado, docRole).canEdit
  const showFaltaAsignacionBanner = puedeEditarEnBorrador && (!documento.revisorId || !documento.aprobadorId)

  // revision-periodica-trazabilidad: avisos visibles para cualquier lector (sin gate de rol) —
  // el botón "Iniciar revisión periódica" vive en el encabezado (acciones de gestión), junto al
  // título, no se duplica aquí (design.md D7). Mismo umbral que RevisionSemaforo vía
  // getRevisionPeriodicaNivel.
  const diasRestantesRevision = documento.fechaRevisionProxima ? calendarDaysUntil(documento.fechaRevisionProxima) : null
  const nivelRevision = diasRestantesRevision !== null ? getRevisionPeriodicaNivel(diasRestantesRevision) : null
  const showRevisionProximaBanner = documento.estado === 'PUBLICADO' && nivelRevision === 'proximo'
  const showRevisionVencidaBanner = documento.estado === 'PUBLICADO' && nivelRevision === 'vencido'

  const entradaInicioRevision = documento.estado === 'EN_REVISION_PERIODICA'
    ? [...(documento.auditTrail ?? [])]
        .filter((e) => e.accion === 'REVISION_PERIODICA_INICIADA')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    : undefined

  const deletedBy = documento.deletedAt
    ? documento.auditTrail.filter((e) => e.accion === 'DOCUMENTO_ELIMINADO').at(-1)?.realizadoPorNombre ?? '—'
    : undefined

  return (
    <div className="col-span-full space-y-3">
      {documento.deletedAt && (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning dark:border-warning/30">
          {/* deletedAt es un timestamp real (momento del soft-delete), no una fecha de
              calendario — Intl.DateTimeFormat directo en la zona local, NUNCA
              formatCalendarDateMedium (que fuerza UTC y es solo para fechas de calendario). */}
          ⚠ {t('deleted.banner.mensaje', {
            fecha: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(documento.deletedAt)),
            usuario: deletedBy,
          })}
        </div>
      )}

      {documento.estado === 'OBSOLETO' && (
        <div className="rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">
          {t('detail.banners.obsoleto')}
        </div>
      )}

      {documento.qeVinculados.length > 0 && (
        <div className="rounded-md border border-amber/30 bg-amber/10 p-3 text-sm text-amber">
          {t('detail.banners.qeVinculados', { ids: documento.qeVinculados.map((q) => q.numero).join(', ') })}
        </div>
      )}

      {documento.confidencialidad === 'RESTRINGIDO' && isJefeDocOrDireccion && (
        <div className="rounded-md border border-teal/30 bg-teal/10 p-3 text-sm text-teal">
          {t('detail.banners.restringido', {
            roles: (documento.rolesAutorizados ?? []).join(', '),
          })}
        </div>
      )}

      {showFaltaAsignacionBanner && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <span>{t('detail.banners.faltaAsignacion')}</span>
          <Link
            to={`/documents/${documento.id}/edit`}
            className="shrink-0 font-medium underline hover:no-underline"
          >
            {t('detail.banners.faltaAsignacionEditar')}
          </Link>
        </div>
      )}

      {showRevisionProximaBanner && documento.fechaRevisionProxima && (
        <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          {t('detail.banners.revisionProxima', {
            fecha: formatDate(documento.fechaRevisionProxima, locale),
            dias: diasRestantesRevision,
          })}
        </div>
      )}

      {showRevisionVencidaBanner && documento.fechaRevisionProxima && (
        <div className="rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">
          {t('detail.banners.revisionVencida', {
            fecha: formatDate(documento.fechaRevisionProxima, locale),
            dias: Math.abs(diasRestantesRevision ?? 0),
          })}
        </div>
      )}

      {entradaInicioRevision && (
        <div className="rounded-md border border-teal/30 bg-teal/10 p-3 text-sm text-teal">
          {t('detail.banners.revisionEnCurso', {
            fecha: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(entradaInicioRevision.timestamp)),
            nombre: entradaInicioRevision.realizadoPorNombre,
          })}
        </div>
      )}

      {showRechazoBanner && ultimaEntradaRechazo && (
        <div className="rounded-md border border-error/30 bg-error/10 p-3 text-sm text-error">
          {t(
            ultimaEntradaRechazo.accion === 'RECHAZADO_EN_REVISION'
              ? 'detail.banners.rechazadoEnRevision'
              : 'detail.banners.rechazadoEnAprobacion',
            {
              nombre: ultimaEntradaRechazo.realizadoPorNombre,
              fecha: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                new Date(ultimaEntradaRechazo.timestamp),
              ),
              motivo: ultimaEntradaRechazo.motivo ?? '',
            },
          )}
        </div>
      )}
    </div>
  )
}
