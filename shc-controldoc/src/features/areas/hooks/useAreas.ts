import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
  listarAreas,
  obtenerArea,
  crearArea,
  actualizarArea,
  desactivarArea,
  reactivarArea,
} from '../api/areas.api'
import type { AreaFormInput } from '../schemas/areaForm.schema'
import type { AreaConteoBloqueo } from '../types/area.types'

export const AREA_QUERY_KEYS = {
  all: ['areas'] as const,
  list: ['areas', 'list'] as const,
  detail: (id: string) => ['areas', 'detail', id] as const,
} as const

function getConteoBloqueo(error: unknown): AreaConteoBloqueo | null {
  if (isAxiosError(error) && error.response?.status === 409) {
    return (error.response.data as { conteo?: AreaConteoBloqueo } | null)?.conteo ?? null
  }
  return null
}

function getServerErrorMessage(error: unknown): string | null {
  if (isAxiosError(error) && (error.response?.status === 409 || error.response?.status === 400)) {
    return (error.response.data as { message?: string } | null)?.message ?? null
  }
  return null
}

export function useAreas() {
  return useQuery({
    queryKey: AREA_QUERY_KEYS.list,
    queryFn: () => listarAreas(),
  })
}

export function useArea(id: string) {
  return useQuery({
    queryKey: AREA_QUERY_KEYS.detail(id),
    queryFn: () => obtenerArea(id),
    enabled: !!id,
  })
}

export function useCrearArea() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('areas')

  return useMutation({
    mutationFn: (data: AreaFormInput) => crearArea(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: AREA_QUERY_KEYS.list })
      toast.success(t('toasts.areaCreada'))
    },
    onError: () => {
      toast.error(t('toasts.areaCreateError'))
    },
  })
}

export function useActualizarArea() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('areas')

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AreaFormInput> }) =>
      actualizarArea(id, data),
    onSuccess: (_area, { id }) => {
      void queryClient.invalidateQueries({ queryKey: AREA_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: AREA_QUERY_KEYS.list })
      toast.success(t('toasts.areaActualizada'))
    },
    onError: () => {
      toast.error(t('toasts.areaActualizarError'))
    },
  })
}

export function useDesactivarArea() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('areas')

  return useMutation({
    mutationFn: (id: string) => desactivarArea(id),
    onSuccess: (_area, id) => {
      void queryClient.invalidateQueries({ queryKey: AREA_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: AREA_QUERY_KEYS.list })
      toast.success(t('toasts.areaDesactivada'))
    },
    onError: (error) => {
      const conteo = getConteoBloqueo(error)
      if (conteo) {
        toast.error(
          t('toasts.areaDesactivarBloqueada', {
            total: conteo.total,
          }),
        )
        return
      }
      toast.error(getServerErrorMessage(error) ?? t('toasts.areaDesactivarError'))
    },
  })
}

export function useReactivarArea() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('areas')

  return useMutation({
    mutationFn: (id: string) => reactivarArea(id),
    onSuccess: (_area, id) => {
      void queryClient.invalidateQueries({ queryKey: AREA_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: AREA_QUERY_KEYS.list })
      toast.success(t('toasts.areaReactivada'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.areaReactivarError'))
    },
  })
}
