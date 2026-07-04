import { useMutation, useQueryClient } from '@tanstack/react-query'
import { editarSeveridad } from '../api/quality-events.api'
import type { QualityEventEditSeveridadInput } from '../schemas/qualityEventEditSeveridad.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useEditarSeveridad() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QualityEventEditSeveridadInput }) =>
      editarSeveridad(id, data),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
    },
  })
}
