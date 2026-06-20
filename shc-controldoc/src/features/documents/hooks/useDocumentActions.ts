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
} from '../../../api/endpoints/documents.api'
import type {
  PatchDocumentStatusPayload,
  SignDocumentPayload,
  RegisterAccessPayload,
} from '../../../api/endpoints/documents.api'
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
