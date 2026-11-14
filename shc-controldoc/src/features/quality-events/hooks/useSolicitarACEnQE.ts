import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { solicitarACEnQE } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'
import { invalidarDashboard } from '../../dashboard/utils/invalidarDashboard'

const CODIGOS_CONOCIDOS = ['SOLICITUD_AC_ROL_NO_PERMITIDO', 'SOLICITUD_AC_ESTADO_INVALIDO'] as const

type ApiError = AxiosError<{ message?: string; errorCode?: string }>

export function useSolicitarACEnQE() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (qeId: string) => solicitarACEnQE(qeId),
    // Lista y detalle: el contador "Solicitudes pendientes en el QE" del incidente/NC y el badge.
    onSuccess: () => {
      invalidarDashboard(queryClient)
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
    },
    onError: (error) => {
      const data = (error as ApiError).response?.data
      const codigo = CODIGOS_CONOCIDOS.find((c) => c === data?.errorCode)
      toast.error(codigo ? t(`errors.${codigo}`) : (data?.message ?? t('detail.acSection.toasts.error')))
    },
  })
}
