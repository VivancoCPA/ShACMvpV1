import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { rechazarCierre } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'

// PRD §1.5 P5 (qe-cierre-firma-supervisor-area): mismas invalidaciones que useFirmarCierre — el
// rechazo devuelve el QE (y el incidente/NC vinculado) a EN_EJECUCION.
export function useRechazarCierreQE() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) => rechazarCierre(id, motivo),
    onSuccess: (qe, { id }) => {
      invalidarDashboard(queryClient)
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(id) })
      if (qe.incidenteId) {
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      if (qe.ncId) {
        void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      }
      toast.success(t('detail.cierre.toasts.rechazado'))
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosError<{ message?: string; errorCode?: string }>
      if (axiosError.response?.data?.errorCode === 'NO_ES_SUPERVISOR_DEL_AREA') {
        toast.error(t('errors.NO_ES_SUPERVISOR_DEL_AREA'))
        return
      }
      toast.error(axiosError.response?.data?.message ?? t('detail.cierre.toasts.rechazoError'))
    },
  })
}
