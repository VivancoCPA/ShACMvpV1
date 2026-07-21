import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markNotificationRead } from '../../../api/endpoints/notifications.api'
import { QUERY_KEYS } from './useNotifications'

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all })
    },
  })
}
