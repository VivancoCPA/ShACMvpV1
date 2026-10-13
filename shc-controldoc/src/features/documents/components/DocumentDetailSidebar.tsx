import { useTranslation } from 'react-i18next'
import { Eye, FileDown, Loader2 } from 'lucide-react'
import { UserAvatar } from '../../../components/ui/UserAvatar'
import { useArea } from '../../areas/hooks/useAreas'
import { formatCalendarDateMedium, formatRelativeTime } from '../../../utils/date.utils'
import { getDatosPublicacion } from '../utils/publicacion'
import type { DocumentActionsAvailability } from '../hooks/useDocumentActionsAvailability'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'
import type { Documento } from '../../../types/documents.types'

const ACTIVIDAD_RECIENTE_LIMIT = 5

interface DocumentDetailSidebarProps {
  documento: Documento
  availability: DocumentActionsAvailability
  controller: DocumentActionsController
  getName: (id?: string | null) => string
  getUser: (id?: string | null) => { nombre: string; apellido: string; avatarUrl?: string } | undefined
  onVerLog: () => void
}

/**
 * Barra lateral fija del detalle de documento (detalle-documento-dos-columnas): tres tarjetas —
 * acciones de lectura, ficha de metadatos (D2) y actividad reciente — `sticky` desde `xl`,
 * estática por debajo (el `grid-cols-1` de la página ya la ordena antes de las pestañas).
 */
export function DocumentDetailSidebar({
  documento,
  availability,
  controller,
  getName,
  getUser,
  onVerLog,
}: DocumentDetailSidebarProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const { data: area } = useArea(documento.areaId)

  if (availability.isDeleted) return null

  const fechaPublicacion = getDatosPublicacion(documento)?.fecha
  const actividadReciente = [...documento.auditTrail]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, ACTIVIDAD_RECIENTE_LIMIT)

  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-[64px]">
      {/* Acciones de lectura */}
      <div className="rounded-lg border border-hairline bg-surface-card p-5 dark:border-hairline/20 dark:bg-surface-dark-elevated">
        {availability.canVerDocumento && (
          <button
            type="button"
            onClick={() => controller.setShowVisor(true)}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-md bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-dark"
          >
            <Eye size={14} aria-hidden="true" />
            {t('visor.verDocumento')}
          </button>
        )}

        {availability.canDescargarCopia && (
          <>
            <button
              type="button"
              onClick={() => controller.setShowPdfPreview(true)}
              disabled={controller.isLoadingExportar}
              className="flex w-full items-center justify-center gap-2 rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
            >
              {controller.isLoadingExportar
                ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                : <FileDown size={14} aria-hidden="true" />}
              {controller.isLoadingExportar ? t('actions.exportando') : t('actions.descargarCopia')}
            </button>
            <p className="mt-2 text-xs text-muted dark:text-on-dark-soft">{t('actions.descargarCopiaAyuda')}</p>
          </>
        )}

        {!availability.canVerDocumento && !availability.canDescargarCopia && (
          <p className="text-sm text-muted dark:text-on-dark-soft">{t('detail.noActionsAvailable')}</p>
        )}
      </div>

      {/* Ficha */}
      <div className="rounded-lg border border-hairline bg-surface-card p-5 dark:border-hairline/20 dark:bg-surface-dark-elevated">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
          {t('detail.ficha.titulo')}
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.ficha.versionVigente')}
            </dt>
            <dd className="mt-0.5 font-mono font-semibold text-ink dark:text-on-dark">{documento.version}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.ficha.publicado')}
            </dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">
              {fechaPublicacion ? formatCalendarDateMedium(fechaPublicacion, locale) : t('detail.ficha.sinPublicar')}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.ficha.tipo')}
            </dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">
              {t(`types.${documento.tipo}`, { defaultValue: documento.tipo })}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.ficha.area')}
            </dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">{area?.nombre ?? documento.areaId}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.ficha.proxRevision')}
            </dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">
              {documento.fechaRevisionProxima ? formatCalendarDateMedium(documento.fechaRevisionProxima, locale) : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted dark:text-on-dark-soft">
              {t('detail.ficha.confidencialidad')}
            </dt>
            <dd className="mt-0.5 text-body dark:text-on-dark">
              {t(`confidencialidad.${documento.confidencialidad}`)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 border-t border-hairline pt-3 dark:border-hairline/20">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted dark:text-on-dark-soft">
            {t('detail.ficha.responsables')}
          </div>
          <div className="space-y-2.5">
            <ResponsableRow
              roleLabel={t('detail.ficha.autor')}
              userId={documento.autorId}
              getName={getName}
              getUser={getUser}
              sinAsignarLabel={t('detail.ficha.sinAsignar')}
            />
            <ResponsableRow
              roleLabel={t('detail.ficha.revisor')}
              userId={documento.revisorId}
              getName={getName}
              getUser={getUser}
              sinAsignarLabel={t('detail.ficha.sinAsignar')}
            />
            <ResponsableRow
              roleLabel={t('detail.ficha.aprobador')}
              userId={documento.aprobadorId}
              getName={getName}
              getUser={getUser}
              sinAsignarLabel={t('detail.ficha.sinAsignar')}
            />
          </div>
        </div>
      </div>

      {/* Actividad reciente */}
      <div className="rounded-lg border border-hairline bg-surface-card p-5 dark:border-hairline/20 dark:bg-surface-dark-elevated">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-on-dark-soft">
            {t('detail.actividadReciente.titulo')}
          </span>
          <button
            type="button"
            onClick={onVerLog}
            className="text-xs font-semibold text-coral-dark hover:underline"
          >
            {t('detail.actividadReciente.verLog')}
          </button>
        </div>

        {actividadReciente.length === 0 ? (
          <p className="text-sm text-muted dark:text-on-dark-soft">{t('detail.actividadReciente.vacio')}</p>
        ) : (
          <ul className="divide-y divide-hairline/60 dark:divide-hairline/10">
            {actividadReciente.map((entry) => (
              <li key={entry.id} className="flex items-center gap-2 py-2 text-sm first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1 truncate text-body dark:text-on-dark">
                  {entry.realizadoPorNombre} {t(`auditTrail.actions.${entry.accion}`, { defaultValue: entry.accion })}
                </span>
                <span className="shrink-0 text-xs text-muted-soft dark:text-on-dark-soft">
                  {formatRelativeTime(entry.timestamp, locale)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

interface ResponsableRowProps {
  roleLabel: string
  userId: string | null | undefined
  getName: (id?: string | null) => string
  getUser: (id?: string | null) => { nombre: string; apellido: string; avatarUrl?: string } | undefined
  sinAsignarLabel: string
}

function ResponsableRow({ roleLabel, userId, getName, getUser, sinAsignarLabel }: ResponsableRowProps) {
  if (!userId) {
    return (
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="h-9 w-9 shrink-0 rounded-full border border-dashed border-hairline dark:border-hairline/30"
        />
        <div className="min-w-0">
          <p className="truncate text-sm text-muted dark:text-on-dark-soft">{sinAsignarLabel}</p>
          <p className="text-xs text-muted-soft dark:text-on-dark-soft">{roleLabel}</p>
        </div>
      </div>
    )
  }

  const user = getUser(userId)

  return (
    <div className="flex items-center gap-2.5">
      <UserAvatar user={{ nombre: user?.nombre ?? '', apellido: user?.apellido ?? '', avatarUrl: user?.avatarUrl }} size="sm" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-body dark:text-on-dark">{getName(userId)}</p>
        <p className="text-xs text-muted-soft dark:text-on-dark-soft">{roleLabel}</p>
      </div>
    </div>
  )
}
