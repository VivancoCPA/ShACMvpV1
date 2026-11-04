import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { deleteQualityEvent } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'

export function useDeleteQualityEvent() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (id: string) => deleteQualityEvent(id),
    onSuccess: (qe, id) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      // El backend libera el incidente de origen (incidentes-qe-estado-alertas D5): su detalle
      // debe volver a mostrar "Crear QE".
      if (qe.incidenteId) {
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      toast.success(t('toasts.deleted'))
    },
    onError: () => {
      toast.error(t('toasts.deleteError'))
    },
  })
}
