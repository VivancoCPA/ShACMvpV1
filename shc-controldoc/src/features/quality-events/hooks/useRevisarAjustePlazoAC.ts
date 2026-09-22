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
    onSuccess: () => {
      // La respuesta de este endpoint es la AC, no el QE (ver design.md Hallazgo 4) — mismo
      // patrón que useCerrarQEAccion/useUpdateQEAccion: invalidar en vez de escribir la caché
      // directamente con un objeto de forma distinta a QualityEvent.
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(qeId) })
    },
  })
}
