import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { getResponsablesAc, restablecerResponsablesAc, updateResponsablesAc } from '../api/responsablesAc.api'
import type { ActualizarResponsablesAcInput, ConfiguracionResponsablesAc } from '../types/responsablesAc.types'

export const RESPONSABLES_AC_QUERY_KEYS = {
  empresa: (empresaId: string) => ['acciones-correctivas', 'responsables-config', empresaId] as const,
  // Prefijo de useCandidatosResponsableAC: los combos de responsable toman la regla nueva.
  candidatos: ['acciones-correctivas', 'candidatos'] as const,
} as const

export function useResponsablesAc(empresaId: string) {
  return useQuery({
    queryKey: RESPONSABLES_AC_QUERY_KEYS.empresa(empresaId),
    queryFn: () => getResponsablesAc(empresaId),
  })
}

function useOnSaved(empresaId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('users')
  return (updated: ConfiguracionResponsablesAc) => {
    queryClient.setQueryData(RESPONSABLES_AC_QUERY_KEYS.empresa(empresaId), updated)
    void queryClient.invalidateQueries({ queryKey: RESPONSABLES_AC_QUERY_KEYS.candidatos })
    toast.success(t('responsablesAc.guardado'))
  }
}

export function useActualizarResponsablesAc(empresaId: string) {
  const onSuccess = useOnSaved(empresaId)
  return useMutation({
    mutationFn: (data: ActualizarResponsablesAcInput) => updateResponsablesAc(empresaId, data),
    onSuccess,
  })
}

export function useRestablecerResponsablesAc(empresaId: string) {
  const onSuccess = useOnSaved(empresaId)
  return useMutation({
    mutationFn: () => restablecerResponsablesAc(empresaId),
    onSuccess,
  })
}
