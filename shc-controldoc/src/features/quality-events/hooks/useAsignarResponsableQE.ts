import { useMutation, useQueryClient } from '@tanstack/react-query'
import { asignarResponsableQE } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'

export function useAsignarResponsableQE() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, responsableInvestigacionId }: { id: string; responsableInvestigacionId: string }) =>
      asignarResponsableQE(id, responsableInvestigacionId),
    onSuccess: (_qe, { id }) => {
      invalidarDashboard(queryClient)
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
    },
  })
}
