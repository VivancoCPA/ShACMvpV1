import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { DocumentConfidencialidadBadge } from './DocumentConfidencialidadBadge'
import { RevisionSemaforo } from './RevisionSemaforo'
import { DocumentManagementActions } from './DocumentManagementActions'
import { getManagementActionItems } from '../utils/documentManagementActions'
import type { DocumentActionsAvailability } from '../hooks/useDocumentActionsAvailability'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'
import type { Documento } from '../../../types/documents.types'

interface DocumentDetailHeaderProps {
  documento: Documento
  availability: DocumentActionsAvailability
  controller: DocumentActionsController
}

/**
 * Encabezado fijo del detalle de documento (detalle-documento-dos-columnas): `sticky top-0`,
 * contiene breadcrumb/código/título/badges/semáforo y las acciones de GESTIÓN (máx. 2 inline +
 * menú "⋯", ver `getManagementActionItems`/design.md D7). Ya no incluye la cuadrícula de
 * metadatos (Tipo/Área/Autor/Revisor/Aprobador/fechas — ahora en la ficha de la sidebar) ni los
 * banners contextuales (ahora en `DocumentDetailBanners`, fuera de esta zona fija).
 */
export function DocumentDetailHeader({ documento, availability, controller }: DocumentDetailHeaderProps) {
  const { t } = useTranslation('documents')

  const showPeriodicReviewSemaforo =
    documento.estado === 'PUBLICADO' || documento.estado === 'EN_REVISION_PERIODICA'

  const managementItems = availability.isDeleted
    ? []
    : getManagementActionItems(availability, controller, t)

  return (
    <header className="sticky top-0 z-10 border-b border-hairline bg-canvas dark:border-hairline/20 dark:bg-surface-dark">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
        <nav className="w-full text-xs text-muted dark:text-on-dark-soft">
          <Link to="/documentos" className="hover:underline">
            {t('detail.backToList')}
          </Link>
          {' / '}
          <span className="font-mono">{documento.codigo}</span>
        </nav>

        <span className="font-mono text-sm font-semibold text-muted dark:text-on-dark-soft">
          {documento.codigo}
        </span>

        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-ink dark:text-on-dark">
          {documento.titulo}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={documento.estado} />
          <DocumentConfidencialidadBadge confidencialidad={documento.confidencialidad} />
          <span className="rounded-md border border-hairline bg-surface-card px-2 py-0.5 font-mono text-xs text-body dark:border-hairline/20 dark:bg-surface-dark-elevated dark:text-on-dark">
            {documento.version}
          </span>
          {showPeriodicReviewSemaforo && (
            <RevisionSemaforo fechaRevisionProxima={documento.fechaRevisionProxima} />
          )}
        </div>

        <div className="ml-auto">
          {availability.isDeleted ? (
            <DocumentDeletedAction availability={availability} controller={controller} />
          ) : (
            <DocumentManagementActions items={managementItems} />
          )}
        </div>
      </div>
    </header>
  )
}

interface DocumentDeletedActionProps {
  availability: DocumentActionsAvailability
  controller: DocumentActionsController
}

/**
 * Reemplaza las acciones de gestión normales cuando el documento está eliminado (soft-delete).
 * El mensaje de "este documento fue eliminado…" vive en `DocumentDetailBanners` (franja debajo
 * del header), no aquí — este bloque es solo el botón/confirmación de restaurar, o nada si el
 * rol actual no puede restaurar (sin texto de "sin acciones": el mensaje del banner ya cubre
 * ese contexto).
 */
function DocumentDeletedAction({ availability, controller }: DocumentDeletedActionProps) {
  const { t } = useTranslation('documents')
  const { showRestoreConfirm, setShowRestoreConfirm, restaurar } = controller

  if (!availability.canRestore) return null

  if (showRestoreConfirm) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-sm text-body dark:text-on-dark">{t('deleted.restore.confirm.title')}</p>
        <button
          type="button"
          onClick={() => setShowRestoreConfirm(false)}
          disabled={restaurar.isPending}
          className="rounded-md border border-hairline bg-canvas px-3 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
        >
          {t('deleted.restore.confirm.cancel')}
        </button>
        <button
          type="button"
          onClick={() => restaurar.mutate()}
          disabled={restaurar.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-teal px-3 py-2 text-sm font-medium text-white hover:bg-teal/90 disabled:opacity-50"
        >
          {t('deleted.restore.confirm.confirm')}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setShowRestoreConfirm(true)}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-teal/40 bg-teal/10 px-4 py-2 text-sm font-medium text-teal hover:bg-teal/20 dark:border-teal/30"
    >
      {t('deleted.banner.restaurar')}
    </button>
  )
}
