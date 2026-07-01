import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { transitionQEStatus } from '../api/quality-events.api'
import type { QEStatusTransitionInput } from '../types/qualityEvent.types'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useTransitionQEStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QEStatusTransitionInput }) =>
      transitionQEStatus(id, data),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      const message = axiosError.response?.data?.message ?? 'Error al cambiar estado'
      toast.error(message)
    },
  })
}
