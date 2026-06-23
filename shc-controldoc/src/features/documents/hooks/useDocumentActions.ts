import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  patchDocumentStatus,
  signDocument,
  deleteDocument,
  getDocumentDownloadUrl,
  registerDocumentAccess,
  createNuevaVersion,
  getArchivoUrl,
  exportarPdfControlado,
  confirmarRevisionPeriodica,
  restaurarDocumento,
} from '../../../api/endpoints/documents.api'
import type {
  PatchDocumentStatusPayload,
  SignDocumentPayload,
  RegisterAccessPayload,
  NuevaVersionPayload,
} from '../../../api/endpoints/documents.api'
import type { Documento } from '../../../types/documents.types'
import { useAuthStore } from '../../../stores/authStore'
import { QUERY_KEYS } from '../constants'

export function useChangeStatus(documentId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (payload: PatchDocumentStatusPayload) =>
      patchDocumentStatus(documentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('toasts.statusChangeSuccess'))
    },
    onError: () => {
      toast.error(t('toasts.statusChangeError'))
    },
  })
}

export function useSignDocument(documentId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (payload: SignDocumentPayload) => signDocument(documentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('toasts.signSuccess'))
    },
  })
}

export function useDeleteDocument(documentId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: () => deleteDocument(documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('toasts.deleteSuccess'))
      navigate('/documentos')
    },
    onError: () => {
      toast.error(t('toasts.deleteError'))
    },
  })
}

export function useGetDownloadUrl(documentId: string) {
  return useMutation({
    mutationFn: () => getDocumentDownloadUrl(documentId),
  })
}

export function useRegisterAccess(documentId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: RegisterAccessPayload) =>
      registerDocumentAccess(documentId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
    },
  })
}

export function useGetArchivoUrl() {
  const { t } = useTranslation('documents')

  const mutation = useMutation({
    mutationFn: (documentoId: string) => getArchivoUrl(documentoId),
    onSuccess: (data) => {
      window.open(data.url, '_blank', 'noopener,noreferrer')
    },
    onError: () => {
      toast.error(t('archivo.errorAbrir'))
    },
  })

  return {
    abrirArchivo: async (documentoId: string): Promise<void> => {
      try {
        await mutation.mutateAsync(documentoId)
      } catch {
        // handled by onError
      }
    },
    isLoading: mutation.isPending,
  }
}

export function useExportarPdfControlado() {
  const { t } = useTranslation('documents')
  const user = useAuthStore((s) => s.user)

  const mutation = useMutation({
    mutationFn: async (documento: Documento) => {
      if (!user) throw new Error('No authenticated user')
      return exportarPdfControlado(documento.id, {
        userNombreCompleto: `${user.nombre} ${user.apellido}`,
      })
    },
    onSuccess: ({ blob, fileName }) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    onError: () => {
      toast.error(t('actions.errorExportar'))
    },
  })

  return {
    exportar: async (documento: Documento): Promise<void> => {
      try {
        await mutation.mutateAsync(documento)
      } catch {
        // handled by onError
      }
    },
    isLoading: mutation.isPending,
  }
}

export function useCreateNuevaVersion(documentoId: string) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (payload: NuevaVersionPayload) => createNuevaVersion(documentoId, payload),
    onSuccess: (newDoc) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('nuevaVersion.toast.success', { version: newDoc.version }))
      navigate(`/documentos/${newDoc.id}`)
    },
  })
}

export function useRestaurarDocumento(documentoId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: () => restaurarDocumento(documentoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentoId) })
      toast.success(t('deleted.restore.toast.success'))
    },
    onError: () => {
      toast.error(t('deleted.restore.toast.error'))
    },
  })
}

export function useConfirmarRevisionPeriodica(documentoId: string) {
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('documents')

  return useMutation({
    mutationFn: () => confirmarRevisionPeriodica(documentoId),
    onSuccess: (updatedDoc) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentoId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      const locale = i18n.language
      const fecha = updatedDoc.fechaRevisionProxima
        ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
            new Date(updatedDoc.fechaRevisionProxima),
          )
        : '—'
      toast.success(t('revisionPeriodica.toast.confirmada', { fecha }))
    },
    onError: () => {
      toast.error(t('toasts.statusChangeError'))
    },
  })
}
