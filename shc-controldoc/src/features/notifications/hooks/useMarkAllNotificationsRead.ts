import { useMutation, useQueryClient } from '@tanstack/react-query'
import { markAllNotificationsRead } from '../../../api/endpoints/notifications.api'
import { QUERY_KEYS } from './useNotifications'

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notifications.all })
    },
  })
}
