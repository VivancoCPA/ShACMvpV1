import { useQuery } from '@tanstack/react-query'
import { getNotifications } from '../../../api/endpoints/notifications.api'

export const QUERY_KEYS = {
  notifications: {
    all: ['notifications'] as const,
  },
} as const

export function useNotifications() {
  return useQuery({
    queryKey: QUERY_KEYS.notifications.all,
    queryFn: getNotifications,
  })
}
