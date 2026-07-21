import { useMutation, useQueryClient } from '@tanstack/react-query'
import { exportQualityEventPdf } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useExportQualityEventPdf(id: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => exportQualityEventPdf(id),
    onSuccess: (qe) => {
      queryClient.setQueryData(QE_QUERY_KEYS.detail(id), qe)
    },
  })
}
