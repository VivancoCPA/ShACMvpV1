import { useMutation, useQueryClient } from '@tanstack/react-query'
import { solicitarAjustePlazoAC } from '../api/quality-events.api'
import type { SolicitarAjustePlazoACInput } from '../schemas/solicitarAjustePlazoAC.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'

export function useSolicitarAjustePlazoAC(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: SolicitarAjustePlazoACInput }) =>
      solicitarAjustePlazoAC(qeId, acId, data),
    onSuccess: (updatedQE) => {
      queryClient.setQueryData(QE_QUERY_KEYS.detail(qeId), updatedQE)
      queryClient.setQueryData(QE_AUDIT_TRAIL_QUERY_KEY(qeId), updatedQE.auditTrail)
    },
  })
}
