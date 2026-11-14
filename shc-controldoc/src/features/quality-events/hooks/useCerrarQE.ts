import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { cerrarQE } from '../api/quality-events.api'
import type { QualityEventCierreFormInput } from '../schemas/qualityEventCierre.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'

export function useCerrarQE() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QualityEventCierreFormInput }) => cerrarQE(id, data),
    onSuccess: (_qe, { id }) => {
      invalidarDashboard(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string; errorCode?: string }>
      // AREA_SIN_SUPERVISOR se muestra inline en QECierreSection (qe-cierre-firma-supervisor-area).
      if (axiosError.response?.data?.errorCode === 'AREA_SIN_SUPERVISOR') return
      const message = axiosError.response?.data?.message ?? 'Error al registrar el cierre'
      toast.error(message)
    },
  })
}
