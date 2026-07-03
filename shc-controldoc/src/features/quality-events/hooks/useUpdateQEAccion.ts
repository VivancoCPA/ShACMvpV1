import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updateQEAccion } from '../api/quality-events.api'
import type { UpdateQEACStatusInput } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useUpdateQEAccion(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: UpdateQEACStatusInput }) =>
      updateQEAccion(qeId, acId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      toast.success('Acción correctiva actualizada.')
    },
    onError: () => {
      toast.error('Error al actualizar la acción correctiva.')
    },
  })
}
