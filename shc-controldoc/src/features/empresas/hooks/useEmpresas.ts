import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { isAxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { listarEmpresas, crearEmpresa, actualizarEmpresa } from '../api/empresas.api'
import type { EmpresaFormInput } from '../schemas/empresaForm.schema'

export const EMPRESA_QUERY_KEYS = {
  all: ['empresas'] as const,
  list: ['empresas', 'list'] as const,
} as const

function getServerErrorMessage(error: unknown): string | null {
  if (isAxiosError(error) && (error.response?.status === 409 || error.response?.status === 400)) {
    return (error.response.data as { message?: string } | null)?.message ?? null
  }
  return null
}

export function useEmpresas() {
  return useQuery({
    queryKey: EMPRESA_QUERY_KEYS.list,
    queryFn: () => listarEmpresas(),
  })
}

export function useCreateEmpresa() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('empresas')

  return useMutation({
    mutationFn: (data: EmpresaFormInput) => crearEmpresa(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EMPRESA_QUERY_KEYS.list })
      toast.success(t('toasts.empresaCreada'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.empresaCreateError'))
    },
  })
}

export function useUpdateEmpresa() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('empresas')

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EmpresaFormInput> }) =>
      actualizarEmpresa(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: EMPRESA_QUERY_KEYS.list })
      toast.success(t('toasts.empresaActualizada'))
    },
    onError: (error) => {
      toast.error(getServerErrorMessage(error) ?? t('toasts.empresaActualizarError'))
    },
  })
}
