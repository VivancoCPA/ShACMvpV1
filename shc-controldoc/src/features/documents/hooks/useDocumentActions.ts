import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { isAxiosError } from 'axios'
import { formatCalendarDateMedium } from '../../../utils/date.utils'
import {
  patchDocumentStatus,
  signDocument,
  deleteDocument,
  createNuevaVersion,
  getArchivoOriginalUrl,
  replaceArchivoOriginal,
  exportarPdfControlado,
  confirmarRevisionPeriodica,
  restaurarDocumento,
  vincularQE,
  desvincularQE,
  vincularNC,
  desvincularNC,
} from '../../../api/endpoints/documents.api'
import type {
  PatchDocumentStatusPayload,
  SignDocumentPayload,
  NuevaVersionPayload,
  ConfirmarRevisionPeriodicaPayload,
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
      navigate(-1)
    },
    onError: () => {
      toast.error(t('toasts.deleteError'))
    },
  })
}

export function useExportarPdfControlado() {
  const { t } = useTranslation('documents')
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (documento: Documento) => {
      if (!user) throw new Error('No authenticated user')
      return exportarPdfControlado(documento.id, {
        userNombreCompleto: `${user.nombre} ${user.apellido}`,
      })
    },
    onSuccess: ({ blob, fileName }, documento) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      // fix-log-refresco-inmediato: el backend registra DESCARGA en el audit trail, pero sin
      // esta invalidación el detalle (refetchOnWindowFocus: false) no lo muestra hasta recargar.
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documento.id) })
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
      // nueva-version-autor-permisos: si el backend dejó revisorId/aprobadorId vacíos (el
      // heredado era el nuevo autor, o ya no era candidato válido), avisar y llevar directo a
      // editar en vez del detalle — ahí es donde se reasigna.
      if (!newDoc.revisorId || !newDoc.aprobadorId) {
        toast.success(t('nuevaVersion.toast.faltaAsignacion', { version: newDoc.version }))
        navigate(`/documents/${newDoc.id}/edit`)
        return
      }
      toast.success(t('nuevaVersion.toast.success', { version: newDoc.version }))
      navigate(`/documentos/${newDoc.id}`)
    },
    onError: (error) => {
      const serverMsg =
        isAxiosError(error) && error.response?.status === 409
          ? (error.response.data as { message?: string } | null)?.message
          : null
      toast.error(serverMsg ?? t('nuevaVersion.toast.error'))
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

export function useGetArchivoOriginalUrl() {
  const { t } = useTranslation('documents')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: ({ documentoId, fallbackNombre }: { documentoId: string; fallbackNombre?: string }) =>
      getArchivoOriginalUrl(documentoId, fallbackNombre),
    onSuccess: ({ blob, fileName }, { documentoId }) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentoId) })
    },
    onError: (error) => {
      // Download access denial (RN-DOC-013/016: not assigned to this document, or wrong estado)
      // is a distinct case from the file being frozen (RN-DOC-014/015, which only blocks
      // replacement, not download) — don't conflate the two under the same message.
      const is403 = isAxiosError(error) && error.response?.status === 403
      toast.error(is403 ? t('archivo.original.accesoDenegadoMsg') : t('archivo.errorAbrir'))
    },
  })

  return {
    // fallbackNombre: documento.archivoOriginalNombre ya conocido por el caller — usado cuando el
    // header Content-Disposition no trae nombre (fix-descarga-archivos-nombre).
    abrirArchivoOriginal: async (documentoId: string, fallbackNombre?: string): Promise<void> => {
      try {
        await mutation.mutateAsync({ documentoId, fallbackNombre })
      } catch {
        // handled by onError
      }
    },
    isLoading: mutation.isPending,
  }
}

export function useReplaceArchivoOriginal(documentId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (file: File) => replaceArchivoOriginal(documentId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('archivo.original.reemplazoExitoso'))
    },
    onError: (error) => {
      const is403 = isAxiosError(error) && error.response?.status === 403
      toast.error(is403 ? t('archivo.original.accesoDenegadoMsg') : t('archivo.errorAbrir'))
    },
  })
}

export function useConfirmarRevisionPeriodica(documentoId: string) {
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('documents')

  return useMutation({
    mutationFn: (payload?: ConfirmarRevisionPeriodicaPayload) => confirmarRevisionPeriodica(documentoId, payload),
    onSuccess: (updatedDoc) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentoId) })
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      const locale = i18n.language
      // revision-periodica-fecha-editable: fechaRevisionProxima es una fecha de calendario — se
      // formatea en UTC (formatCalendarDateMedium), nunca con un formateador de timestamp en la
      // zona local del navegador (podía mostrar un día antes en UTC-5).
      const fecha = updatedDoc.fechaRevisionProxima
        ? formatCalendarDateMedium(updatedDoc.fechaRevisionProxima, locale)
        : '—'
      toast.success(t('revisionPeriodica.toast.confirmada', { fecha }))
    },
    onError: () => {
      toast.error(t('toasts.statusChangeError'))
    },
  })
}

export function useVincularQE(documentId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (qualityEventId: string) => vincularQE(documentId, qualityEventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
      toast.success(t('qeVinculados.toast.vinculado'))
    },
    onError: () => {
      toast.error(t('qeVinculados.toast.vincularError'))
    },
  })
}

export function useDesvincularQE(documentId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (qualityEventId: string) => desvincularQE(documentId, qualityEventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
      toast.success(t('qeVinculados.toast.desvinculado'))
    },
    onError: () => {
      toast.error(t('qeVinculados.toast.desvincularError'))
    },
  })
}

export function useVincularNC(documentId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (noConformidadId: string) => vincularNC(documentId, noConformidadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
      toast.success(t('ncVinculados.toast.vinculado'))
    },
    onError: () => {
      toast.error(t('ncVinculados.toast.vincularError'))
    },
  })
}

export function useDesvincularNC(documentId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (noConformidadId: string) => desvincularNC(documentId, noConformidadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.detail(documentId) })
      toast.success(t('ncVinculados.toast.desvinculado'))
    },
    onError: () => {
      toast.error(t('ncVinculados.toast.desvincularError'))
    },
  })
}
