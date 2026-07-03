import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { firmarCierre } from '../api/quality-events.api'
import type { FirmarCierreInput } from '../schemas/firmarCierre.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'

export function useFirmarCierre() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FirmarCierreInput }) => firmarCierre(id, data),
    onSuccess: (_qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string }>
      const message = axiosError.response?.data?.message ?? 'Error al registrar la firma'
      toast.error(message)
    },
  })
}
