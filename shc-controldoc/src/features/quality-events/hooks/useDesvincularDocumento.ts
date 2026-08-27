import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { desvincularDocumento } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useDesvincularDocumento(qeId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (documentoId: string) => desvincularDocumento(qeId, documentoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      toast.success(t('documentosVinculados.toast.desvinculado'))
    },
    onError: () => {
      toast.error(t('documentosVinculados.toast.desvincularError'))
    },
  })
}
