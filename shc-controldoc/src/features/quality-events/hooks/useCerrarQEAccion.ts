import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cerrarQEAccion } from '../api/quality-events.api'
import type { CerrarQEACInput } from '../schemas/cerrarQEAccion.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useCerrarQEAccion(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: CerrarQEACInput }) =>
      cerrarQEAccion(qeId, acId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      toast.success('Acción correctiva cerrada.')
    },
    onError: () => {
      toast.error('Error al cerrar la acción correctiva.')
    },
  })
}
