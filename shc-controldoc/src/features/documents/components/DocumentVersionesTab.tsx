import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDocumentVersiones } from '../hooks/useDocumentVersiones'
import { useAuthStore } from '../../../stores/authStore'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import type { Documento } from '../../../types/documents.types'
import type { UserRole } from '../../../types/auth.types'

interface DocumentVersionesTabProps {
  documento: Documento
}

const HIDE_OBSOLETO_ROLES = new Set<UserRole>(['OPERARIO', 'SUPERVISOR'])

const STATUS_SORT_RANK: Record<string, number> = {
  PUBLICADO: 0,
  EN_REVISION_PERIODICA: 1,
  EN_APROBACION: 2,
  EN_REVISION: 3,
  BORRADOR: 4,
  OBSOLETO: 5,
}

function getPublisher(doc: Documento): string | undefined {
  const reversed = [...doc.auditTrail].reverse()
  const entry = reversed.find(
    (e) =>
      e.accion === 'FIRMA_REGISTRADA' ||
      (e.accion === 'ESTADO_CAMBIADO' && e.estadoNuevo === 'PUBLICADO'),
  )
  return entry?.realizadoPorNombre
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4">
          <div className="mt-0.5 h-5 w-5 flex-shrink-0 rounded-full bg-hairline dark:bg-surface-dark-elevated" />
          <div className="flex-1 space-y-2">
            <div className="flex gap-2">
              <div className="h-4 w-12 rounded bg-hairline dark:bg-surface-dark-elevated" />
              <div className="h-4 w-20 rounded-full bg-hairline dark:bg-surface-dark-elevated" />
            </div>
            <div className="h-3 w-48 rounded bg-hairline dark:bg-surface-dark-elevated" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function DocumentVersionesTab({ documento }: DocumentVersionesTabProps) {
  const { t, i18n } = useTranslation('documents')
  const navigate = useNavigate()
  const userRole = useAuthStore((s) => s.user?.rol)
  const { data, isLoading } = useDocumentVersiones(documento.codigo)

  const locale = i18n.language
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))

  const hideObsoleto = userRole !== undefined && HIDE_OBSOLETO_ROLES.has(userRole as UserRole)

  const allVersions = (data?.items ?? []).filter(
    (d) => !(hideObsoleto && d.estado === 'OBSOLETO'),
  )

  // Sort: active states first (by STATUS_SORT_RANK), then by creation date desc within same rank
  const sortedVersions = [...allVersions].sort((a, b) => {
    const ra = STATUS_SORT_RANK[a.estado] ?? 99
    const rb = STATUS_SORT_RANK[b.estado] ?? 99
    if (ra !== rb) return ra - rb
    const da = a.fechaEmision ?? a.creadoEn
    const db = b.fechaEmision ?? b.creadoEn
    return db.localeCompare(da)
  })

  if (isLoading) return <TimelineSkeleton />

  if (sortedVersions.length <= 1) {
    return (
      <p className="text-sm text-muted dark:text-on-dark-soft">
        {t('versiones.sinVersionesAnteriores')}
      </p>
    )
  }

  return (
    <div className="relative">
      {sortedVersions.map((version, index) => {
        const isCurrent = version.id === documento.id
        // The motivo for the current entry is in the NEWER version (one index above in sorted array)
        const newerVersion = index > 0 ? sortedVersions[index - 1] : undefined
        const motivoCambio = newerVersion?.motivoVersion
        const publisher = getPublisher(version)
        const publishedAt = version.fechaEmision

        return (
          <div key={version.id} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Vertical line connecting entries */}
            {index < sortedVersions.length - 1 && (
              <div
                className="absolute left-[9px] top-5 bottom-0 w-px bg-hairline dark:bg-hairline/30"
                aria-hidden="true"
              />
            )}

            {/* Timeline dot */}
            <div
              className={`relative mt-0.5 h-5 w-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center ${
                isCurrent
                  ? 'border-coral bg-coral'
                  : 'border-hairline bg-canvas dark:border-hairline/40 dark:bg-surface-dark'
              }`}
              aria-hidden="true"
            >
              {isCurrent && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pb-0">
              {/* Version + badge */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`font-mono text-sm ${
                    isCurrent
                      ? 'font-bold text-coral'
                      : 'font-medium text-ink dark:text-on-dark'
                  }`}
                >
                  {version.version}
                </span>
                <StatusBadge status={version.estado} />
                {isCurrent && (
                  <span className="text-xs text-muted dark:text-on-dark-soft">
                    ({t('versiones.versionActual')})
                  </span>
                )}
              </div>

              {/* Published info */}
              <p className="mt-1 text-xs text-muted dark:text-on-dark-soft">
                {publisher && (
                  <>{t('versiones.publicadoPor', { nombre: publisher })}</>
                )}
                {publishedAt && (
                  <>
                    {publisher ? ' · ' : ''}
                    {t('versiones.publicadoEl', { fecha: fmt(publishedAt) })}
                  </>
                )}
                {version.fechaObsolescencia && (
                  <> — {t('versiones.obsoletoEl', { fecha: fmt(version.fechaObsolescencia) })}</>
                )}
              </p>

              {/* Motivo del cambio (reason this version was superseded) */}
              {motivoCambio && (
                <p className="mt-1 text-xs text-body dark:text-on-dark">
                  <span className="font-medium">{t('versiones.motivoCambio')}:</span>{' '}
                  {motivoCambio}
                </p>
              )}

              {/* Link to version (not for current) */}
              {!isCurrent && (
                <button
                  type="button"
                  onClick={() => navigate(`/documentos/${version.id}`)}
                  className="mt-1.5 text-xs text-coral transition-colors hover:text-coral-dark dark:hover:text-coral/80"
                >
                  {t('versiones.verDocumento')} →
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
