import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../../../stores/authStore'
import {
  getParametrosSesion,
  getPoliticaSesion,
  getSeguridadSesionEmpresa,
  registrarActividad,
  updateParametrosSesion,
  updateSeguridadSesionEmpresa,
} from '../api/sesion.api'
import type { ParametrosSesionInput, SeguridadSesionEmpresaInput } from '../types/sesion.types'

export const SESION_QUERY_KEYS = {
  all: ['sesion'] as const,
  politica: (empresaActivaId: string | null) => ['sesion', 'politica', empresaActivaId] as const,
  empresa: (empresaId: string) => ['sesion', 'empresa', empresaId] as const,
  parametros: ['sesion', 'parametros'] as const,
} as const

/** Política efectiva de la sesión actual para el temporizador del cliente. Se vuelve a pedir al
 *  cambiar de empresa (la key incluye `empresaActivaId`); nunca se refresca sola — un objeto
 *  estable evita re-armar los temporizadores de SessionTimeoutManager. */
export function usePoliticaSesion() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const empresaActivaId = useAuthStore((s) => s.empresaActivaId)
  return useQuery({
    queryKey: SESION_QUERY_KEYS.politica(empresaActivaId),
    queryFn: getPoliticaSesion,
    enabled: isAuthenticated,
    staleTime: Infinity,
    retry: false,
  })
}

/** `POST /api/auth/actividad` — solo para actividad REAL del usuario (design.md D4). */
export function useRegistrarActividad() {
  return useMutation({ mutationFn: registrarActividad })
}

export function useSeguridadSesionEmpresa(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: SESION_QUERY_KEYS.empresa(empresaId ?? ''),
    queryFn: () => getSeguridadSesionEmpresa(empresaId as string),
    enabled: !!empresaId,
  })
}

export function useUpdateSeguridadSesionEmpresa(empresaId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('sesion')
  return useMutation({
    mutationFn: (data: SeguridadSesionEmpresaInput) => updateSeguridadSesionEmpresa(empresaId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESION_QUERY_KEYS.empresa(empresaId), updated)
      // La política efectiva de la sesión actual puede haber cambiado (mismo admin, misma empresa).
      void queryClient.invalidateQueries({ queryKey: ['sesion', 'politica'] })
      toast.success(t('config.saved'))
    },
    onError: () => {
      toast.error(t('config.saveError'))
    },
  })
}

export function useParametrosSesion() {
  return useQuery({
    queryKey: SESION_QUERY_KEYS.parametros,
    queryFn: getParametrosSesion,
  })
}

export function useUpdateParametrosSesion() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('sesion')
  return useMutation({
    mutationFn: (data: ParametrosSesionInput) => updateParametrosSesion(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESION_QUERY_KEYS.parametros, updated)
      // Cambian los límites/defaults: cualquier vista de empresa y la política propia quedan viejas.
      void queryClient.invalidateQueries({ queryKey: ['sesion', 'empresa'] })
      void queryClient.invalidateQueries({ queryKey: ['sesion', 'politica'] })
      toast.success(t('global.saved'))
    },
    onError: () => {
      toast.error(t('global.saveError'))
    },
  })
}
