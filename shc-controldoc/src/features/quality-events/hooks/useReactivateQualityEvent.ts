import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { reactivateQualityEvent } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useReactivateQualityEvent() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (id: string) => reactivateQualityEvent(id),
    onSuccess: (_qe, id) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      toast.success(t('toasts.reactivated'))
    },
    onError: () => {
      toast.error(t('toasts.reactivateError'))
    },
  })
}
