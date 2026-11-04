import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { updateQEAccion } from '../api/quality-events.api'
import type { UpdateQEACStatusInput } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import type { QualityEvent } from '../types/qualityEvent.types'

export function useUpdateQEAccion(qeId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ acId, data }: { acId: string; data: UpdateQEACStatusInput }) =>
      updateQEAccion(qeId, acId, data),
    onSuccess: () => {
      // Cerrar la última AC puede auto-transicionar el QE a PENDIENTE_CIERRE, y con él al
      // incidente vinculado (incidentes-qe-estado-alertas D1). Sin el QE en caché no se sabe si
      // tiene incidente, así que se invalida igual.
      const qe = queryClient.getQueryData<QualityEvent>(QE_QUERY_KEYS.detail(qeId))
      if (!qe || qe.incidenteId) {
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      toast.success('Acción correctiva actualizada.')
    },
    onError: () => {
      toast.error('Error al actualizar la acción correctiva.')
    },
  })
}
