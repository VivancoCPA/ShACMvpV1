import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createQEAccion } from '../api/quality-events.api'
import type { CreateQEACInput } from '../schemas/createQEAccion.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useCreateQEAccion(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateQEACInput) => createQEAccion(qeId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      toast.success('Acción correctiva creada.')
    },
    onError: () => {
      toast.error('Error al crear la acción correctiva.')
    },
  })
}
