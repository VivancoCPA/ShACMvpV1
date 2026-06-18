import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  getDocuments,
  getDocumentById,
  createDocument,
  updateDocument,
  changeDocumentStatus,
  deleteDocument,
} from '../../../api/endpoints/documents.api'
import type { ChangeDocumentStatusPayload } from '../../../api/endpoints/documents.api'
import { QUERY_KEYS } from '../constants'
import type { DocFilters } from '../../../types/documents.types'
import type { CreateDocumentInput } from '../schemas/createDocument.schema'
import type { UpdateDocumentInput } from '../schemas/updateDocument.schema'

export function useDocuments(filters: DocFilters = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.documents.list(filters),
    queryFn: () => getDocuments(filters),
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.documents.detail(id),
    queryFn: () => getDocumentById(id),
    enabled: id !== '',
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (data: CreateDocumentInput) => createDocument(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('toasts.createSuccess'))
    },
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDocumentInput }) =>
      updateDocument(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('toasts.updateSuccess'))
    },
  })
}

export function useChangeDocumentStatus() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ChangeDocumentStatusPayload }) =>
      changeDocumentStatus(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('toasts.statusChangeSuccess'))
    },
    onError: () => {
      toast.error(t('toasts.statusChangeError'))
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('documents')

  return useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.documents.all })
      toast.success(t('toasts.deleteSuccess'))
    },
    onError: () => {
      toast.error(t('toasts.deleteError'))
    },
  })
}
