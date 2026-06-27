import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import {
  getNonconformities,
  getNonconformity,
  createNonconformity,
  updateNonconformity,
  anularNonconformity,
  deleteNonconformity,
  restoreNonconformity,
  createAccionCorrectiva,
  updateAccionCorrectiva,
  cerrarAccionCorrectiva,
} from '../api/nonconformities.api'
import type { NCFilters, CreateACInput, UpdateACInput, CerrarACInput } from '../types/nonconformity.types'
import type { CreateNCInput } from '../schemas/createNC.schema'
import type { UpdateNCInput } from '../schemas/updateNC.schema'

export const QUERY_KEYS = {
  nonconformities: {
    all: ['nonconformities'] as const,
    list: (filters: NCFilters) => ['nonconformities', 'list', filters] as const,
    detail: (id: string) => ['nonconformities', 'detail', id] as const,
  },
} as const

export function useNonconformities(filters?: NCFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.nonconformities.list(filters ?? {}),
    queryFn: () => getNonconformities(filters),
    staleTime: 5 * 60 * 1000,
  })
}

export function useNonconformity(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.nonconformities.detail(id),
    queryFn: () => getNonconformity(id),
    enabled: !!id,
  })
}

export function useCreateNonconformity() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: (data: CreateNCInput) => createNonconformity(data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nonconformities.all })
      toast.success(t('toasts.created'))
      if (result.warning === 'POSIBLE_DUPLICADO') {
        toast.warning(t('toasts.posibleDuplicado'))
      }
    },
    onError: () => {
      toast.error(t('toasts.createError'))
    },
  })
}

export function useUpdateNonconformity() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNCInput }) =>
      updateNonconformity(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nonconformities.all })
      toast.success(t('toasts.updated'))
    },
    onError: () => {
      toast.error(t('toasts.updateError'))
    },
  })
}

export function useAnularNonconformity() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: ({ id, justificacion }: { id: string; justificacion: string }) =>
      anularNonconformity(id, justificacion),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nonconformities.all })
      toast.success(t('toasts.anulada'))
    },
    onError: () => {
      toast.error(t('toasts.anularError'))
    },
  })
}

export function useDeleteNC() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: (id: string) => deleteNonconformity(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nonconformities.all })
      toast.success(t('toasts.deleted'))
    },
    onError: () => {
      toast.error(t('toasts.deleteError'))
    },
  })
}

export function useRestoreNC() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: (id: string) => restoreNonconformity(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nonconformities.all })
      toast.success(t('toasts.restored'))
    },
    onError: () => {
      toast.error(t('toasts.restoreError'))
    },
  })
}

export function useCreateAccionCorrectiva(ncId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: (data: CreateACInput) => createAccionCorrectiva(ncId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.nonconformities.detail(ncId),
      })
      toast.success(t('toasts.acCreada'))
    },
    onError: () => {
      toast.error(t('toasts.acCreateError'))
    },
  })
}

export function useUpdateAccionCorrectiva(ncId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: UpdateACInput }) =>
      updateAccionCorrectiva(ncId, acId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.nonconformities.detail(ncId),
      })
      toast.success(t('toasts.acUpdated'))
    },
    onError: () => {
      toast.error(t('toasts.acUpdateError'))
    },
  })
}

export function useCerrarAccionCorrectiva(ncId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('nonconformities')

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: CerrarACInput }) =>
      cerrarAccionCorrectiva(ncId, acId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.nonconformities.detail(ncId),
      })
      toast.success(t('toasts.acCerrada'))
    },
    onError: () => {
      toast.error(t('toasts.acCerrarError'))
    },
  })
}
