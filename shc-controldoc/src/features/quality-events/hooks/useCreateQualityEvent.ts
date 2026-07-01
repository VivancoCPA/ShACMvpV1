import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createQualityEvent } from '../api/quality-events.api'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useCreateQualityEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: QualityEventCreateInput) => createQualityEvent(data),
    onSuccess: (qe) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      toast.success(`QE ${qe.numero} creado correctamente`)
    },
  })
}
