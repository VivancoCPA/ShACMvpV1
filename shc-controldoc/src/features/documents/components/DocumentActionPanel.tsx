import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '../../../stores/authStore'
import { useChangeStatus, useDeleteDocument } from '../hooks/useDocumentActions'
import { DocumentSignatureModal } from './DocumentSignatureModal'
import { DocumentRejectModal } from './DocumentRejectModal'
import type { Documento } from '../../../types/documents.types'

type ModalState = 'none' | 'confirm-send' | 'confirm-approve' | 'confirm-cancel' | 'confirm-periodic' | 'confirm-delete' | 'sign' | 'reject'

interface DocumentActionPanelProps {
  documento: Documento
}

export function DocumentActionPanel({ documento }: DocumentActionPanelProps) {
  const { t } = useTranslation('documents')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const [modal, setModal] = useState<ModalState>('none')

  const changeStatus = useChangeStatus(documento.id)
  const deleteDocument = useDeleteDocument(documento.id)

  if (!user) return null

  const isJefeCalidad = user.rol === 'JEFE_CALIDAD_SYST' || user.rol === 'JEFE_CONTROL_DOCUMENTARIO'
  const isRevisor = documento.revisorId === user.id
  const isAprobador = documento.aprobadorId === user.id
  const canSendToReview = documento.estado === 'BORRADOR' && (documento.autorId === user.id || isJefeCalidad)
  const canDelete = documento.estado === 'BORRADOR' && (documento.autorId === user.id || isJefeCalidad)
  const canApproveReview = documento.estado === 'EN_REVISION' && (isRevisor || isJefeCalidad)
  const canRejectReview = documento.estado === 'EN_REVISION' && (isRevisor || isJefeCalidad)
  const canCancelReview = documento.estado === 'EN_REVISION' && isJefeCalidad
  const canSign = documento.estado === 'EN_APROBACION' && (isAprobador || isJefeCalidad)
  const canRejectAprobacion = documento.estado === 'EN_APROBACION' && (isAprobador || isJefeCalidad)
  const canStartPeriodic = documento.estado === 'PUBLICADO' && isJefeCalidad
  const canCreateVersion = documento.estado === 'PUBLICADO' && isJefeCalidad
  const canStartNewVersion = documento.estado === 'EN_REVISION_PERIODICA' && isJefeCalidad

  const hasAnyAction =
    canSendToReview || canDelete || canApproveReview || canRejectReview ||
    canCancelReview || canSign || canRejectAprobacion || canStartPeriodic ||
    canCreateVersion || canStartNewVersion

  async function handleConfirm(nuevoEstado: string) {
    await changeStatus.mutateAsync({ estado: nuevoEstado as Documento['estado'] })
    setModal('none')
  }

  return (
    <div className="sticky top-6 rounded-lg border border-hairline bg-surface-card p-5 dark:border-hairline/20 dark:bg-surface-dark-elevated">
      <h3 className="mb-4 text-sm font-semibold text-body dark:text-on-dark">
        {t('detail.title')}
      </h3>

      {!hasAnyAction && (
        <p className="text-sm text-muted dark:text-on-dark-soft">
          {t('detail.noActionsAvailable')}
        </p>
      )}

      <div className="flex flex-col gap-2">
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
            onClick={() => setModal('confirm-periodic')}
            className="rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
          >
            {t('detail.actions.startPeriodicReview')}
          </button>
        )}

        {canCreateVersion && (
          <button
            onClick={() => navigate(`/documentos/nuevo?baseId=${documento.id}`)}
            className="rounded-md border border-hairline bg-canvas px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-soft dark:border-hairline/30 dark:bg-surface-dark dark:text-on-dark"
          >
            {t('detail.actions.createNewVersion')}
          </button>
        )}

        {canStartNewVersion && (
          <button
            onClick={() => navigate(`/documentos/nuevo?baseId=${documento.id}`)}
            className="rounded-md bg-coral px-4 py-2.5 text-sm font-medium text-white hover:bg-coral-dark"
          >
            {t('detail.actions.startNewVersion')}
          </button>
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
      {(modal === 'confirm-send' || modal === 'confirm-approve' || modal === 'confirm-cancel' || modal === 'confirm-periodic' || modal === 'confirm-delete') && (
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
              {modal === 'confirm-periodic' && t('detail.confirmStartPeriodicReview')}
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
                  else if (modal === 'confirm-periodic') await handleConfirm('EN_REVISION_PERIODICA')
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
    </div>
  )
}
