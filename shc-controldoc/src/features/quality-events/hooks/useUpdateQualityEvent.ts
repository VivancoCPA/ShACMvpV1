import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateQualityEvent } from '../api/quality-events.api'
import type { QualityEventUpdateInput } from '../types/qualityEvent.types'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useUpdateQualityEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QualityEventUpdateInput }) =>
      updateQualityEvent(id, data),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
    },
  })
}
