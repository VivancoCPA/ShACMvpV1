import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { deleteQualityEvent } from '../api/quality-events.api'
import { QE_QUERY_KEYS } from './useQualityEvents'

export function useDeleteQualityEvent() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('qualityEvents')

  return useMutation({
    mutationFn: (id: string) => deleteQualityEvent(id),
    onSuccess: (_qe, id) => {
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.all })
      void queryClient.invalidateQueries({ queryKey: QE_QUERY_KEYS.detail(id) })
      toast.success(t('toasts.deleted'))
    },
    onError: () => {
      toast.error(t('toasts.deleteError'))
    },
  })
}
