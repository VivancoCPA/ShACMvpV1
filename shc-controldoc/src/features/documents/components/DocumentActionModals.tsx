import { useTranslation } from 'react-i18next'
import { FileDown, Info, Loader2, X } from 'lucide-react'
import { useArea } from '../../areas/hooks/useAreas'
import { DocumentSignatureModal } from './DocumentSignatureModal'
import { DocumentRejectModal } from './DocumentRejectModal'
import { DocumentNuevaVersionModal } from './DocumentNuevaVersionModal'
import { DocumentRevisionPeriodicaModal } from './DocumentRevisionPeriodicaModal'
import { DocumentViewer } from './DocumentViewer'
import { formatCalendarDateMedium } from '../../../utils/date.utils'
import type { DocumentActionsController } from '../hooks/useDocumentActionsController'
import type { Documento } from '../../../types/documents.types'

interface DocumentActionModalsProps {
  documento: Documento
  controller: DocumentActionsController
  /** Resuelve aprobadorId a nombre real en el preview de PDF — ver DocumentDetailPage (D4). */
  getName: (id?: string | null) => string
}

/**
 * Todos los diálogos/overlays de las acciones del detalle de documento, montados una sola vez
 * en la página (detalle-documento-dos-columnas, D6) — los botones que los disparan viven ahora
 * en el encabezado (acciones de gestión) y en la barra lateral (acciones de lectura), pero el
 * propio markup de cada modal es el mismo que tenía `DocumentActionPanel` antes del rediseño.
 */
export function DocumentActionModals({ documento, controller, getName }: DocumentActionModalsProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const { data: area } = useArea(documento.areaId)
  const {
    modal,
    setModal,
    showVisor,
    setShowVisor,
    showPdfPreview,
    setShowPdfPreview,
    changeStatus,
    deleteDocument,
    exportar,
    isLoadingExportar,
    handleConfirm,
    handleConfirmDelete,
  } = controller

  return (
    <>
      {/* Inline confirmation dialogs */}
      {(modal === 'confirm-send' || modal === 'confirm-approve' || modal === 'confirm-cancel' || modal === 'confirm-delete') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm dark:bg-ink/60">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-xl bg-surface-card p-6 shadow-xl dark:bg-surface-dark-elevated"
          >
            <p className="mb-5 text-sm text-body dark:text-on-dark">
              {modal === 'confirm-send' && t('detail.confirmSendToReview')}
              {modal === 'confirm-approve' && t('detail.confirmApproveReview')}
              {modal === 'confirm-cancel' && t('detail.confirmCancelReview')}
              {modal === 'confirm-delete' && t('detail.confirmDelete')}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setModal('none')}
                className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
              >
                {t('detail.cancel')}
              </button>
              <button
                disabled={changeStatus.isPending || deleteDocument.isPending}
                onClick={async () => {
                  if (modal === 'confirm-send') await handleConfirm('EN_REVISION')
                  else if (modal === 'confirm-approve') await handleConfirm('EN_APROBACION')
                  else if (modal === 'confirm-cancel') await handleConfirm('BORRADOR')
                  else if (modal === 'confirm-delete') await handleConfirmDelete()
                }}
                className="rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-50"
              >
                {t('detail.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'sign' && (
        <DocumentSignatureModal documentId={documento.id} onClose={() => setModal('none')} />
      )}

      {modal === 'reject' && (
        <DocumentRejectModal documentId={documento.id} onClose={() => setModal('none')} />
      )}

      {modal === 'nueva-version' && (
        <DocumentNuevaVersionModal
          documentoId={documento.id}
          versionActual={documento.version}
          onClose={() => setModal('none')}
        />
      )}

      {modal === 'revision-periodica' && (
        <DocumentRevisionPeriodicaModal
          documento={documento}
          onClose={() => setModal('none')}
          onCrearNuevaVersion={() => setModal('nueva-version')}
        />
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm dark:bg-ink/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-preview-title"
            className="w-full max-w-lg rounded-xl bg-surface-card p-6 shadow-xl dark:bg-surface-dark-elevated"
          >
            <h2 id="pdf-preview-title" className="mb-1 text-base font-semibold text-ink dark:text-on-dark">
              {t('pdf.previewTitle')}
            </h2>
            <p className="mb-4 flex items-center gap-1.5 text-xs text-muted dark:text-on-dark-soft">
              <Info size={12} aria-hidden="true" />
              {t('pdf.previewNote')}
            </p>

            {/* Preview container — forzar tema claro para simular impresión */}
            <div className="bg-white text-gray-900 rounded-lg p-5 shadow-inner text-sm">
              <div className="border-b border-gray-200 pb-3 mb-4">
                <p className="font-mono text-xs text-gray-500 mb-0.5">{documento.codigo}</p>
                <h3 className="text-base font-bold leading-snug">{documento.titulo}</h3>
                <p className="mt-1 text-xs text-gray-500">
                  {t(`types.${documento.tipo}`, { defaultValue: documento.tipo })}
                  {' · '}
                  {documento.version}
                  {' · '}
                  {documento.estado}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {locale === 'es-PE' ? 'Área' : 'Area'}
                  </dt>
                  <dd className="mt-0.5">{area?.nombre ?? documento.areaId}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {locale === 'es-PE' ? 'Vigencia' : 'Valid until'}
                  </dt>
                  {/* fechaVigencia es una fecha de calendario, no un timestamp (deletedAt sí lo
                      es y sigue usando Intl.DateTimeFormat directo en el resto del flujo) —
                      fix-fechas-utc. */}
                  <dd className="mt-0.5">
                    {documento.fechaVigencia ? formatCalendarDateMedium(documento.fechaVigencia, locale) : '—'}
                  </dd>
                </div>
                {documento.aprobadorId && (
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {locale === 'es-PE' ? 'Aprobado por' : 'Approved by'}
                    </dt>
                    <dd className="mt-0.5 text-xs text-gray-600">{getName(documento.aprobadorId)}</dd>
                  </div>
                )}
              </dl>

              <div className="rounded bg-gray-50 border border-gray-200 px-3 py-2 text-xs text-gray-500">
                <span className="font-bold">
                  {locale === 'es-PE'
                    ? 'COPIA NO CONTROLADA — Solo válido al momento de impresión'
                    : 'UNCONTROLLED COPY — Valid only at time of printing'}
                </span>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowPdfPreview(false)}
                disabled={isLoadingExportar}
                className="rounded-md border border-hairline bg-canvas px-4 py-2 text-sm font-medium text-ink hover:bg-surface-soft disabled:opacity-50 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
              >
                {t('pdf.cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  void exportar(documento)
                  setShowPdfPreview(false)
                }}
                disabled={isLoadingExportar}
                className="inline-flex items-center gap-2 rounded-md bg-coral px-4 py-2 text-sm font-medium text-white hover:bg-coral-dark disabled:opacity-50"
              >
                {isLoadingExportar
                  ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  : <FileDown size={14} aria-hidden="true" />}
                {t('pdf.download')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVisor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm dark:bg-ink/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="visor-documento-title"
            className="flex h-[90vh] w-full max-w-4xl flex-col rounded-xl bg-canvas shadow-xl dark:bg-surface-dark"
          >
            <div className="flex items-center justify-between border-b border-hairline px-4 py-3 dark:border-hairline/20">
              <h2 id="visor-documento-title" className="text-sm font-semibold text-ink dark:text-on-dark">
                {t('visor.tituloModal')} · {documento.codigo}
              </h2>
              <button
                type="button"
                aria-label={t('visor.cerrar')}
                onClick={() => setShowVisor(false)}
                className="rounded-md p-1.5 text-muted hover:bg-surface-soft dark:text-on-dark-soft dark:hover:bg-surface-dark-elevated"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden p-2">
              <DocumentViewer documentoId={documento.id} />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
