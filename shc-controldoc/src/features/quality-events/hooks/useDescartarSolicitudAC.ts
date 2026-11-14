import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { descartarSolicitudAC } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { QE_AUDIT_TRAIL_QUERY_KEY } from './useQEAuditTrail'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'

type ApiError = AxiosError<{ message?: string; errorCode?: string }>

// solicitudes-ac-y-ac-del-qe-en-origen: refresca detalle, lista (badge) y dashboard para que el
// aviso y RN-QE-009 se actualicen sin recargar.
export function useDescartarSolicitudAC(qeId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (motivo: string) => descartarSolicitudAC(qeId, motivo),
    onSuccess: () => {
      invalidarDashboard(queryClient)
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      void queryClient.invalidateQueries({ queryKey: QE_AUDIT_TRAIL_QUERY_KEY(qeId) })
      toast.success(t('detail.acSection.toasts.solicitudDescartada'))
    },
    onError: (error) => {
      const data = (error as ApiError).response?.data
      toast.error(
        data?.errorCode === 'SIN_SOLICITUDES_PENDIENTES'
          ? t('errors.SIN_SOLICITUDES_PENDIENTES')
          : (data?.message ?? t('detail.acSection.toasts.error')),
      )
    },
  })
}
