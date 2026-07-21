import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { reactivateQualityEvent } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'

export function useReactivateQualityEvent() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (id: string) => reactivateQualityEvent(id),
    onSuccess: (qe, id) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      if (qe.incidenteId) {
        // .all cubre tanto el detalle como el listado de Incidentes (ver diagnóstico de
        // sincronización de estado).
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      if (qe.ncId) {
        void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      }
      toast.success(t('toasts.reactivated'))
    },
    onError: () => {
      toast.error(t('toasts.reactivateError'))
    },
  })
}
