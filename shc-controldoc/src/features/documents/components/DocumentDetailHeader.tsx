import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { DocumentConfidencialidadBadge } from './DocumentConfidencialidadBadge'
import { RevisionSemaforo } from './RevisionSemaforo'
import { useAuthStore } from '../../../stores/authStore'
import { useArea } from '../../areas/hooks/useAreas'
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

interface DocumentDetailHeaderProps {
  documento: Documento
  /** Resuelve autorId/revisorId/aprobadorId a nombre real — ver DocumentDetailPage (D4). */
  getName: (id?: string | null) => string
}

// fechaEmision/fechaVigencia/fechaRevisionProxima son fechas de calendario (sin hora
// significativa) — formatCalendarDateMedium las lee en UTC para no desfasarlas un día en
// zonas horarias negativas (fix-fechas-utc).
function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—'
  return formatCalendarDateMedium(iso, locale)
}

export function DocumentDetailHeader({ documento, getName }: DocumentDetailHeaderProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const user = useAuthStore((s) => s.user)
  const { data: area } = useArea(documento.areaId)

  const isJefeDocOrDireccion =
    user?.rol === 'JEFE_CONTROL_DOCUMENTARIO' || user?.rol === 'ALTA_DIRECCION'

  const showPeriodicReviewSemaforo =
    documento.estado === 'PUBLICADO' || documento.estado === 'EN_REVISION_PERIODICA'

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
  // el botón "Iniciar revisión periódica" ya vive en DocumentActionPanel, junto al título, no se
  // duplica aquí (design.md D7). Mismo umbral que RevisionSemaforo vía getRevisionPeriodicaNivel.
  const diasRestantesRevision = documento.fechaRevisionProxima ? calendarDaysUntil(documento.fechaRevisionProxima) : null
  const nivelRevision = diasRestantesRevision !== null ? getRevisionPeriodicaNivel(diasRestantesRevision) : null
  const showRevisionProximaBanner = documento.estado === 'PUBLICADO' && nivelRevision === 'proximo'
  const showRevisionVencidaBanner = documento.estado === 'PUBLICADO' && nivelRevision === 'vencido'

  const entradaInicioRevision = documento.estado === 'EN_REVISION_PERIODICA'
    ? [...(documento.auditTrail ?? [])]
        .filter((e) => e.accion === 'REVISION_PERIODICA_INICIADA')
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
    : undefined

  return (
    <div className="space-y-4">
      {/* Banners */}
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

      {/* Header card — unified: title + badges + metadata grid */}
      <div className="rounded-lg border border-hairline bg-surface-card p-6 dark:border-hairline/20 dark:bg-surface-dark-elevated">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm font-semibold text-muted dark:text-on-dark-soft">
            {documento.codigo}
          </span>
          <StatusBadge status={documento.estado} />
          <DocumentConfidencialidadBadge confidencialidad={documento.confidencialidad} />
          {showPeriodicReviewSemaforo && (
            <RevisionSemaforo fechaRevisionProxima={documento.fechaRevisionProxima} />
          )}
        </div>

        <h1 className="text-2xl font-semibold text-ink dark:text-on-dark">
          {documento.titulo}
        </h1>

        {/* Metadata grid */}
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Tipo</dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">
              {t(`types.${documento.tipo}`, { defaultValue: documento.tipo })}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Versión</dt>
            <dd className="mt-0.5 font-mono text-body dark:text-on-dark">{documento.version}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Área</dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">{area?.nombre ?? documento.areaId}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Autor</dt>
            <dd className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{getName(documento.autorId)}</dd>
          </div>
          {documento.revisorId && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Revisor</dt>
              <dd className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{getName(documento.revisorId)}</dd>
            </div>
          )}
          {documento.aprobadorId && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Aprobador</dt>
              <dd className="mt-0.5 text-xs text-muted dark:text-on-dark-soft">{getName(documento.aprobadorId)}</dd>
            </div>
          )}
          {documento.fechaEmision && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Emisión</dt>
              <dd className="mt-0.5 text-body dark:text-on-dark">{formatDate(documento.fechaEmision, locale)}</dd>
            </div>
          )}
          {documento.fechaVigencia && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Vigencia</dt>
              <dd className="mt-0.5 text-body dark:text-on-dark">{formatDate(documento.fechaVigencia, locale)}</dd>
            </div>
          )}
          {documento.fechaRevisionProxima && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted dark:text-on-dark-soft">Próx. revisión</dt>
              <dd className="mt-0.5 text-body dark:text-on-dark">{formatDate(documento.fechaRevisionProxima, locale)}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}
