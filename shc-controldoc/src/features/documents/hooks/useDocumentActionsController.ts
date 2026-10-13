import { useState } from 'react'
import { useAuthStore } from '../../../stores/authStore'
import { useChangeStatus, useDeleteDocument, useExportarPdfControlado, useRestaurarDocumento } from './useDocumentActions'
import type { Documento } from '../../../types/documents.types'

export type DocumentActionModalState =
  | 'none'
  | 'confirm-send'
  | 'confirm-approve'
  | 'confirm-cancel'
  | 'confirm-delete'
  | 'sign'
  | 'reject'
  | 'nueva-version'
  | 'revision-periodica'

/**
 * Estado y mutaciones de las acciones del detalle de documento (detalle-documento-dos-columnas,
 * D6) — extraído de `DocumentActionPanel` para que el encabezado (botones de gestión + menú
 * "⋯"), la barra lateral (acciones de lectura) y los modales (montados una sola vez en la
 * página) compartan la misma fuente de estado en vez de cada uno manejar el suyo. Ningún
 * comportamiento cambia: es el mismo `useState`/mutations que antes vivían inline.
 */
export function useDocumentActionsController(documento: Documento, initialAction?: 'revision-periodica') {
  const user = useAuthStore((s) => s.user)

  const [modal, setModal] = useState<DocumentActionModalState>(() => {
    if (
      initialAction === 'revision-periodica' &&
      documento.estado === 'PUBLICADO' &&
      (user?.rol === 'JEFE_CALIDAD_SYST' || user?.rol === 'JEFE_CONTROL_DOCUMENTARIO')
    ) {
      return 'revision-periodica'
    }
    return 'none'
  })
  const [showVisor, setShowVisor] = useState(false)
  const [showPdfPreview, setShowPdfPreview] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)

  const changeStatus = useChangeStatus(documento.id)
  const deleteDocument = useDeleteDocument(documento.id)
  const restaurar = useRestaurarDocumento(documento.id)
  const { exportar, isLoading: isLoadingExportar } = useExportarPdfControlado()

  async function handleConfirm(nuevoEstado: string) {
    await changeStatus.mutateAsync({ estado: nuevoEstado as Documento['estado'] })
    setModal('none')
  }

  async function handleConfirmDelete() {
    await deleteDocument.mutateAsync()
    setModal('none')
  }

  return {
    modal,
    setModal,
    showVisor,
    setShowVisor,
    showPdfPreview,
    setShowPdfPreview,
    showRestoreConfirm,
    setShowRestoreConfirm,
    changeStatus,
    deleteDocument,
    restaurar,
    exportar,
    isLoadingExportar,
    handleConfirm,
    handleConfirmDelete,
  }
}

export type DocumentActionsController = ReturnType<typeof useDocumentActionsController>
