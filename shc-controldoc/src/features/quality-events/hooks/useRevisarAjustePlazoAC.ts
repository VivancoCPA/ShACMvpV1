import { useMutation, useQueryClient } from '@tanstack/react-query'
import { revisarAjustePlazoAC } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'

interface RevisarAjustePlazoACVariables {
  acId: string
  solicitudId: string
  data: { accion: 'APROBAR' | 'RECHAZAR'; comentarioRevision?: string }
}

export function useRevisarAjustePlazoAC(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ acId, solicitudId, data }: RevisarAjustePlazoACVariables) =>
      revisarAjustePlazoAC(qeId, acId, solicitudId, data),
    onSuccess: (updatedQE) => {
      queryClient.setQueryData(QE_QUERY_KEYS.detail(qeId), updatedQE)
      queryClient.setQueryData(QE_AUDIT_TRAIL_QUERY_KEY(qeId), updatedQE.auditTrail)
    },
  })
}
