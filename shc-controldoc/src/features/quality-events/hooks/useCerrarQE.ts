import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { cerrarQE } from '../api/quality-events.api'
import type { QualityEventCierreFormInput } from '../schemas/qualityEventCierre.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'

export function useCerrarQE() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QualityEventCierreFormInput }) => cerrarQE(id, data),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      const message = axiosError.response?.data?.message ?? 'Error al registrar el cierre'
      toast.error(message)
    },
  })
}
