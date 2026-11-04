import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { AxiosError } from 'axios'
import { transitionQEStatus } from '../api/quality-events.api'
import type { QEStatusTransitionInput } from '../types/qualityEvent.types'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { INCIDENT_QUERY_KEYS } from '../../incidents/hooks/useIncidents'
import { QUERY_KEYS as NC_QUERY_KEYS } from '../../nonconformities/hooks/useNonconformities'

export function useTransitionQEStatus() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: QEStatusTransitionInput }) =>
      transitionQEStatus(id, data),
    onSuccess: (qe, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['quality-events', 'list'] })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      // El Incidente/NC vinculado sigue el estado del QE (ver diagnóstico de sincronización de
      // estado): sin esto, IncidentDetailPage/IncidentList o NonconformityDetailPage/NCList
      // seguirían mostrando el estado previo hasta un refetch manual, aunque el mock ya haya
      // sincronizado el dato en el servidor. .all cubre tanto el detalle como el listado.
      if (qe.incidenteId) {
        void queryClient.invalidateQueries({ queryKey: INCIDENT_QUERY_KEYS.all })
      }
      if (qe.ncId) {
        void queryClient.invalidateQueries({ queryKey: NC_QUERY_KEYS.nonconformities.all })
      }
    },
    onError: (error: unknown) => {
      // errorCode con traducción propia (p.ej. QE_SIN_RESPONSABLE) → mensaje localizado; si no,
      // el message del servidor como antes (qe-precarga-incidente-responsable D12).
      const axiosError = error as AxiosError<{ message?: string; errorCode?: string }>
      const errorCode = axiosError.response?.data?.errorCode
      const traducido = errorCode ? t(`errors.${errorCode}`, { defaultValue: '' }) : ''
      if (traducido) {
        toast.error(traducido)
        return
      }
      const message = axiosError.response?.data?.message ?? 'Error al cambiar estado'
      toast.error(message)
    },
  })
}
