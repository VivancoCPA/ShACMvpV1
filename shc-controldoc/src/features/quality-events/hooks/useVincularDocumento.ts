import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { vincularDocumento } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useVincularDocumento(qeId: string) {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (documentoId: string) => vincularDocumento(qeId, documentoId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(qeId) })
      toast.success(t('documentosVinculados.toast.vinculado'))
    },
    onError: () => {
      toast.error(t('documentosVinculados.toast.vincularError'))
    },
  })
}
