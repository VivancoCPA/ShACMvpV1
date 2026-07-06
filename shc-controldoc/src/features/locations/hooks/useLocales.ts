import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
  listarLocales,
  listarZonas,
  obtenerLocal,
  crearLocal,
  actualizarLocal,
  desactivarLocal,
  reactivarLocal,
  crearZona,
  actualizarZona,
  desactivarZona,
  reactivarZona,
} from '../api/locales.api'
import type { LocalFormInput } from '../schemas/localForm.schema'
import type { ZonaFormInput } from '../schemas/zonaForm.schema'

export const LOCATION_ADMIN_QUERY_KEYS = {
  all: ['locationsAdmin'] as const,
  list: ['locationsAdmin', 'list'] as const,
  zonas: ['locationsAdmin', 'zonas'] as const,
  detail: (id: string) => ['locationsAdmin', 'detail', id] as const,
} as const

function getServerErrorMessage(error: unknown): string | null {
  if (isAxiosError(error) && (error.response?.status === 409 || error.response?.status === 400)) {
    return (error.response.data as { message?: string } | null)?.message ?? null
  }
  return null
}

export function useLocales() {
  return useQuery({
    queryKey: LOCATION_ADMIN_QUERY_KEYS.list,
    queryFn: () => listarLocales(),
  })
}

export function useZonas() {
  return useQuery({
    queryKey: LOCATION_ADMIN_QUERY_KEYS.zonas,
    queryFn: () => listarZonas(),
  })
}

export function useLocal(id: string) {
  return useQuery({
    queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(id),
    queryFn: () => obtenerLocal(id),
    enabled: !!id,
  })
}

export function useCrearLocal() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: (data: LocalFormInput) => crearLocal(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.list })
      toast.success(t('toasts.localCreado'))
    },
    onError: () => {
      toast.error(t('toasts.localCreateError'))
    },
  })
}

export function useActualizarLocal() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LocalFormInput> }) =>
      actualizarLocal(id, data),
    onSuccess: (_local, { id }) => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.list })
      toast.success(t('toasts.localActualizado'))
    },
    onError: () => {
      toast.error(t('toasts.localActualizarError'))
    },
  })
}

export function useDesactivarLocal() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: (id: string) => desactivarLocal(id),
    onSuccess: (_local, id) => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.list })
      toast.success(t('toasts.localDesactivado'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.localDesactivarError'))
    },
  })
}

export function useReactivarLocal() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: (id: string) => reactivarLocal(id),
    onSuccess: (_local, id) => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.list })
      toast.success(t('toasts.localReactivado'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.localReactivarError'))
    },
  })
}

export function useCrearZona() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: ({ localId, data }: { localId: string; data: ZonaFormInput }) =>
      crearZona(localId, data),
    onSuccess: (_zona, { localId }) => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(localId) })
      toast.success(t('toasts.zonaCreada'))
    },
    onError: () => {
      toast.error(t('toasts.zonaCreateError'))
    },
  })
}

export function useActualizarZona() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: ({ zonaId, data }: { zonaId: string; data: Partial<ZonaFormInput> }) =>
      actualizarZona(zonaId, data),
    onSuccess: (zona) => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(zona.localId) })
      toast.success(t('toasts.zonaActualizada'))
    },
    onError: () => {
      toast.error(t('toasts.zonaActualizarError'))
    },
  })
}

export function useDesactivarZona() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: (zonaId: string) => desactivarZona(zonaId),
    onSuccess: (zona) => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(zona.localId) })
      toast.success(t('toasts.zonaDesactivada'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.zonaDesactivarError'))
    },
  })
}

export function useReactivarZona() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('locations')

  return useMutation({
    mutationFn: (zonaId: string) => reactivarZona(zonaId),
    onSuccess: (zona) => {
      void queryClient.invalidateQueries({ queryKey: LOCATION_ADMIN_QUERY_KEYS.detail(zona.localId) })
      toast.success(t('toasts.zonaReactivada'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.zonaReactivarError'))
    },
  })
}
