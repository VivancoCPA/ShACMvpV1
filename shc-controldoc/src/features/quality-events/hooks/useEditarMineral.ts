import { useMutation, useQueryClient } from '@tanstack/react-query'
import { editarMineral } from '../api/quality-events.api'
import type { QualityEventEditMineralInput } from '../schemas/qualityEventEditMineral.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useEditarMineral() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QualityEventEditMineralInput }) =>
      editarMineral(id, data),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
    },
  })
}
