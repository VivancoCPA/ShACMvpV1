import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, FileDown, Loader2, Info, RotateCcw } from 'lucide-react'

import { useAuthStore } from '../../../stores/authStore'
import { resolveUserDisplayName } from '../../../mocks/fixtures/userIdentity.fixtures'
import { useChangeStatus, useDeleteDocument, useGetArchivoUrl, useExportarPdfControlado, useRestaurarDocumento } from '../hooks/useDocumentActions'
import { useDocumentsByCode } from '../hooks/useDocuments'
import { canAccessDocument } from '../permissions'
import { DocumentSignatureModal } from './DocumentSignatureModal'
import { DocumentRejectModal } from './DocumentRejectModal'
import { DocumentNuevaVersionModal } from './DocumentNuevaVersionModal'
import { DocumentRevisionPeriodicaModal } from './DocumentRevisionPeriodicaModal'
import type { Documento, DocStatus } from '../../../types/documents.types'

type ModalState =
  | 'none'
  | 'confirm-send'
  | 'confirm-approve'
  | 'confirm-cancel'
  | 'confirm-delete'
  | 'sign'
  | 'reject'
  | 'nueva-version'
  | 'revision-periodica'

interface DocumentActionPanelProps {
  documento: Documento
  initialAction?: 'revision-periodica'
}

function formatDate(iso: string | undefined, locale: string): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(iso))
}

export function DocumentActionPanel({ documento, initialAction }: DocumentActionPanelProps) {
  const { t, i18n } = useTranslation('documents')
  const locale = i18n.language
  const user = useAuthStore((s) => s.user)

  const [modal, setModal] = useState<ModalState>(() => {
    if (
      initialAction === 'revision-periodica' &&
      documento.estado === 'PUBLICADO' &&
      (user?.rol === 'JEFE_CALIDAD_SYST' || user?.rol === 'JEFE_CONTROL_DOCUMENTARIO')
    ) {
      return 'revision-periodica'
    }
    return 'none'
  })
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)

  const changeStatus = useChangeStatus(documento.id)
  const deleteDocument = useDeleteDocument(documento.id)
  const restaurar = useRestaurarDocumento(documento.id)
  const { abrirArchivo, isLoading: isLoadingArchivo } = useGetArchivoUrl()
  const { exportar, isLoading: isLoadingExportar } = useExportarPdfControlado()

  if (!user) return null

  // --- Deleted document: suppress all normal actions ---
  if (documento.deletedAt) {
    const canRestore = user.rol === 'JEFE_CALIDAD_SYST' || user.rol === 'ALTA_DIRECCION'
    const deletedBy = documento.auditTrail
      .filter((e) => e.accion === 'DOCUMENTO_ELIMINADO')
      .at(-1)?.realizadoPorNombre ?? '—'

    return (
      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 dark:border-warning/30">
          <p className="text-sm text-warning">
            ⚠ {t('deleted.banner.mensaje', {
              fecha: formatDate(documento.deletedAt, locale),
              usuario: deletedBy,
            })}
          </p>
        </div>

        {canRestore && (
          showRestoreConfirm ? (
            <div className="flex items-center gap-2">
              <p className="text-sm text-body dark:text-on-dark">
                {t('deleted.restore.confirm.title')}
              </p>
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
                {restaurar.isPending
                  ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  : <RotateCcw size={14} aria-hidden="true" />}
                {t('deleted.restore.confirm.confirm')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowRestoreConfirm(true)}
              className="inline-flex items-center justify-center gap-2 rounded-md border border-teal/40 bg-teal/10 px-4 py-2.5 text-sm font-medium text-teal hover:bg-teal/20 dark:border-teal/30"
            >
              <RotateCcw size={14} aria-hidden="true" />
              {t('deleted.banner.restaurar')}
            </button>
          )
        )}

        {!canRestore && (
          <p className="text-sm text-muted dark:text-on-dark-soft">
            {t('detail.noActionsAvailable')}
          </p>
        )}
      </div>
    )
  }

  const hasFileAccess = canAccessDocument(documento.confidencialidad, user.rol, documento.rolesAutorizados ?? [])
  const canVerArchivo = hasFileAccess && !!documento.archivoUrl
  const canExportarPdf = documento.estado === 'PUBLICADO' && hasFileAccess && !!documento.archivoUrl

  const isJefeCalidad = user.rol === 'JEFE_CALIDAD_SYST' || user.rol === 'JEFE_CONTROL_DOCUMENTARIO'
  const isAutor = documento.autorId === user.id
  const isRevisor = documento.revisorId === user.id
  const isAprobador = documento.aprobadorId === user.id
  const canSendToReview = documento.estado === 'BORRADOR' && (isAutor || isJefeCalidad)
  const canDelete = documento.estado === 'BORRADOR' && (isAutor || isJefeCalidad)
  // RN: aprobar/rechazar están reservados al revisorId/aprobadorId específico
  // asignado al documento — JEFE_CALIDAD tiene editar/comentar en EN_REVISION,
  // pero no firma ni aprueba/rechaza por otro (ver permissions.ts).
  const canApproveReview = documento.estado === 'EN_REVISION' && isRevisor
  const canRejectReview = documento.estado === 'EN_REVISION' && isRevisor
  const canCancelReview = documento.estado === 'EN_REVISION' && isJefeCalidad
  const canSign = documento.estado === 'EN_APROBACION' && isAprobador
  const canRejectAprobacion = documento.estado === 'EN_APROBACION' && isAprobador
  const canStartPeriodic = documento.estado === 'PUBLICADO' && isJefeCalidad
  const canCreateVersion = documento.estado === 'PUBLICADO' && (isAutor || isJefeCalidad)
  const canStartNewVersion = documento.estado === 'EN_REVISION_PERIODICA' && (isAutor || isJefeCalidad)

  const IN_PROCESS_STATUSES = new Set<DocStatus>(['BORRADOR', 'EN_REVISION', 'EN_APROBACION'])
  const { data: versionesData } = useDocumentsByCode(
    documento.codigo,
    !documento.deletedAt && (canCreateVersion || canStartNewVersion),
  )
  const otraVersionEnProceso = (versionesData?.items ?? []).find(
    (d) => d.id !== documento.id && !d.deletedAt && IN_PROCESS_STATUSES.has(d.estado),
  )

  const hasAnyAction =
    canVerArchivo || canExportarPdf ||
    canSendToReview || canDelete || canApproveReview || canRejectReview ||
    canCancelReview || canSign || canRejectAprobacion || canStartPeriodic ||
    canCreateVersion || canStartNewVersion

  async function handleConfirm(nuevoEstado: string) {
    await changeStatus.mutateAsync({ estado: nuevoEstado as Documento['estado'] })
    setModal('none')
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!hasAnyAction && (
        <p className="text-sm text-muted dark:text-on-dark-soft">
          {t('detail.noActionsAvailable')}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {canVerArchivo && (
          <button
            type="button"
            onClick={() => void abrirArchivo(documento.id)}
            disabled={isLoadingArchivo}
            className="inline-flex items-center gap-2 rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {isLoadingArchivo
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <FileText size={14} aria-hidden="true" />}
            {t('actions.verArchivo')}
          </button>
        )}

        {canExportarPdf && (
          <button
            type="button"
            onClick={() => setShowPdfPreview(true)}
            disabled={isLoadingExportar}
            className="inline-flex items-center gap-2 rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-60 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
          >
            {isLoadingExportar
              ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              : <FileDown size={14} aria-hidden="true" />}
            {isLoadingExportar ? t('actions.exportando') : t('actions.exportarPdfControlado')}
          </button>
        )}

        {(canVerArchivo || canExportarPdf) && (canSendToReview || canApproveReview || canRejectReview || canCancelReview || canSign || canRejectAprobacion || canStartPeriodic || canCreateVersion || canStartNewVersion || canDelete) && (
          <div className="h-6 w-px bg-hairline dark:bg-hairline/20" aria-hidden="true" />
        )}

        {canSendToReview && (
          <button
            onClick={() => setModal('confirm-send')}
            className="rounded-md bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('detail.actions.sendToReview')}
          </button>
        )}

        {canApproveReview && (
          <button
            onClick={() => setModal('confirm-approve')}
            className="rounded-md bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('detail.actions.approveReview')}
          </button>
        )}

        {(canRejectReview || canRejectAprobacion) && (
          <button
            onClick={() => setModal('reject')}
            className="rounded-md border border-error bg-error/10 px-4 py-2.5 text-sm font-medium text-error hover:bg-error/20 dark:border-error/30 dark:bg-error/10"
          >
            {t('detail.actions.reject')}
          </button>
        )}

        {canSign && (
          <button
            onClick={() => setModal('sign')}
            className="rounded-md bg-success px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            {t('detail.actions.sign')}
          </button>
        )}

        {canCancelReview && (
          <button
            onClick={() => setModal('confirm-cancel')}
            className="rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
          >
            {t('detail.actions.cancelReview')}
          </button>
        )}

        {canStartPeriodic && (
          <button
            onClick={() => setModal('revision-periodica')}
            className="rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
          >
            {t('detail.actions.startPeriodicReview')}
          </button>
        )}

        {canCreateVersion && (
          <span title={otraVersionEnProceso ? t('nuevaVersion.tooltipYaExiste', { estado: t(`common:statuses.${otraVersionEnProceso.estado}`) }) : undefined}>
            <button
              type="button"
              onClick={() => setModal('nueva-version')}
              disabled={!!otraVersionEnProceso}
              className="rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft disabled:cursor-not-allowed disabled:opacity-40 dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark dark:hover:bg-surface-dark-elevated"
            >
              {t('detail.actions.createNewVersion')}
            </button>
          </span>
        )}

        {canStartNewVersion && (
          <span title={otraVersionEnProceso ? t('nuevaVersion.tooltipYaExiste', { estado: t(`common:statuses.${otraVersionEnProceso.estado}`) }) : undefined}>
            <button
              type="button"
              onClick={() => setModal('nueva-version')}
              disabled={!!otraVersionEnProceso}
              className="rounded-md bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('detail.actions.startNewVersion')}
            </button>
          </span>
        )}

        {canDelete && (
          <button
            onClick={() => setModal('confirm-delete')}
            className="rounded-md border border-error bg-error/10 px-4 py-2.5 text-sm font-medium text-error hover:bg-error/20 dark:border-error/30"
          >
            {t('detail.actions.delete')}
          </button>
        )}
      </div>

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
                  else if (modal === 'confirm-delete') {
                    await deleteDocument.mutateAsync()
                    setModal('none')
                  }
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
                  <dd className="mt-0.5">{documento.area}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    {locale === 'es-PE' ? 'Vigencia' : 'Valid until'}
                  </dt>
                  <dd className="mt-0.5">{formatDate(documento.fechaVigencia, locale)}</dd>
                </div>
                {documento.aprobadorId && (
                  <div className="col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                      {locale === 'es-PE' ? 'Aprobado por' : 'Approved by'}
                    </dt>
                    <dd className="mt-0.5 text-xs text-gray-600">{resolveUserDisplayName(documento.aprobadorId)}</dd>
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
    </div>
  )
}
