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
    onSuccess: () => {
      // La respuesta de este endpoint es la AC, no el QE (ver design.md Hallazgo 4) — mismo
      // patrón que useCerrarQEAccion/useUpdateQEAccion: invalidar en vez de escribir la caché
      // directamente con un objeto de forma distinta a QualityEvent.
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(qeId) })
    },
  })
}
