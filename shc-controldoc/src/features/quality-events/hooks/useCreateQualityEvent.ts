import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createQualityEvent } from '../api/quality-events.api'
import type { QualityEventCreateInput } from '../schemas/qualityEventCreate.schema'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'

export function useCreateQualityEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: QualityEventCreateInput) => createQualityEvent(data),
    onSuccess: (qe, variables) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      // El Incidente/NC origen se actualiza por separado (useVincularQE / useVincularNC,
      // disparado desde QualityEventForm); esta invalidación asegura que si el usuario vuelve a
      // su detalle o al listado, canCrearQE / el badge de estado ya reflejen el vínculo recién
      // creado en vez de servir datos obsoletos. .all cubre tanto el detalle como el listado.
      if (variables.origen === 'O1_INCIDENTE_CAMPO' && variables.incidenteId) {
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      if (variables.origen === 'O2_NC_DETECTADA' && variables.ncId) {
        void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      }
      toast.success(`QE ${qe.numero} creado correctamente`)
    },
  })
}
