import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { forzarVencimientoVerificacion } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'

export function useForzarVencimientoVerificacion() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id }: { id: string }) => forzarVencimientoVerificacion(id),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      const message = axiosError.response?.data?.message ?? 'Error al forzar el vencimiento'
      toast.error(message)
    },
  })
}
