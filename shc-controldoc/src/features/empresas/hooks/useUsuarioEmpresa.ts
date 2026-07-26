import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import {
  listarUsuariosDeEmpresa,
  asignarUsuarioEmpresa,
  toggleUsuarioEmpresa,
} from '../api/empresas.api'
import type { AsignarUsuarioEmpresaInput } from '../schemas/asignarUsuarioEmpresa.schema'

export const USUARIO_EMPRESA_QUERY_KEYS = {
  porEmpresa: (empresaId: string) => ['empresas', empresaId, 'usuarios'] as const,
} as const

function getServerErrorMessage(error: unknown): string | null {
  if (isAxiosError(error) && (error.response?.status === 409 || error.response?.status === 400)) {
    return (error.response.data as { message?: string } | null)?.message ?? null
  }
  return null
}

export function useUsuarioEmpresaPorEmpresa(empresaId: string) {
  return useQuery({
    queryKey: USUARIO_EMPRESA_QUERY_KEYS.porEmpresa(empresaId),
    queryFn: () => listarUsuariosDeEmpresa(empresaId),
    enabled: !!empresaId,
  })
}

export function useAsignarUsuarioEmpresa(empresaId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('empresas')

  return useMutation({
    mutationFn: (data: AsignarUsuarioEmpresaInput) => asignarUsuarioEmpresa(empresaId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USUARIO_EMPRESA_QUERY_KEYS.porEmpresa(empresaId) })
      toast.success(t('toasts.asignacionCreada'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.asignacionError'))
    },
  })
}

export function useToggleUsuarioEmpresa(empresaId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('empresas')

  return useMutation({
    mutationFn: ({ usuarioId, estado }: { usuarioId: string; estado: 'ACTIVO' | 'INACTIVO' }) =>
      toggleUsuarioEmpresa(empresaId, usuarioId, estado),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: USUARIO_EMPRESA_QUERY_KEYS.porEmpresa(empresaId) })
      toast.success(t('toasts.asignacionActualizada'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.asignacionError'))
    },
  })
}
