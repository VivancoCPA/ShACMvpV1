import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cerrarQEAccion } from '../api/quality-events.api'
import type { CerrarQEACInput } from '../schemas/cerrarQEAccion.schema'
import type { QualityEvent } from '../types/qualityEvent.types'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'

export function useCerrarQEAccion(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: CerrarQEACInput }) =>
      cerrarQEAccion(qeId, acId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      // Cerrar la última AC pendiente puede disparar la transición automática a
      // PENDIENTE_CIERRE (ver diagnóstico de sincronización de estado). La respuesta de este
      // endpoint es la AC, no el QE, así que el incidenteId/ncId se lee del QE ya cacheado.
      const qe = queryClient.getQueryData<QualityEvent>(QE_QUERY_KEYS.detail(qeId))
      if (qe?.incidenteId) {
        // .all cubre tanto el detalle como el listado de Incidentes — invalidar solo .detail
        // dejaba el listado desactualizado (ver diagnóstico de sincronización de estado).
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      if (qe?.ncId) {
        void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      }
      toast.success('Acción correctiva cerrada.')
    },
    onError: () => {
      toast.error('Error al cerrar la acción correctiva.')
    },
  })
}
