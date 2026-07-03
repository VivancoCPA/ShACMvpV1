import { useMutation, useQueryClient } from '@tanstack/react-query'
import { solicitarACEnQE } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useSolicitarACEnQE() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (qeId: string) => solicitarACEnQE(qeId),
    onSuccess: (_qe, qeId) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
    },
  })
}
